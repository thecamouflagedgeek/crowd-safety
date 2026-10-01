import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

import 'offline_store.dart';

export 'offline_store.dart' show SavedLocation, CachedSnapshot;

/// Must match CELL_DEG in backend/geo_alerts.py (0.05 deg ~ 5.5 km).
const double kZoneCellDeg = 0.05;

/// Coarse safety-zone id. Exact coordinates never leave the device.
String zoneIdFor(double lat, double lon) =>
    '${(lat / kZoneCellDeg).floor()}_${(lon / kZoneCellDeg).floor()}';

/// Centre of a zone cell, used for display and saved locations.
({double lat, double lon}) zoneCenter(String zoneId) {
  final p = zoneId.split('_');
  return (
    lat: (int.parse(p[0]) + 0.5) * kZoneCellDeg,
    lon: (int.parse(p[1]) + 0.5) * kZoneCellDeg,
  );
}

class GeoAlertSync extends ChangeNotifier {
  GeoAlertSync({required this.baseUrl, OfflineStore? store}) : _store = store ?? OfflineStore();

  final String baseUrl;
  final OfflineStore _store;

  static const _timeout = Duration(seconds: 8);
  static const _syncEvery = Duration(minutes: 10);
  static const staleAfter = Duration(minutes: 15);

  // ---- state the UI reads
  late String userId;
  bool alertsEnabled = false;
  bool online = true;                 // result of the LAST request, not just "wifi is on"
  String? zoneId;
  String? pushToken;                  // set from FirebaseMessaging.instance.getToken()
  DateTime? lastSyncedAt;
  CachedSnapshot? snapshot;

  int get pendingReportCount => _store.pendingReports().length;

  // ---- profile (persisted locally)
  String get profileName => _store.profileName;
  String get profilePhone => _store.profilePhone;
  bool get smsFallback => _store.smsFallback;
  List<SavedLocation> get savedLocations => _store.savedLocations();

  ({double lat, double lon})? get currentAreaCenter => zoneId == null ? null : zoneCenter(zoneId!);

  /// Number of cached incidents whose coordinates fall inside [zone].
  int incidentsInZone(String zone) {
    var n = 0;
    for (final i in snapshot?.incidents ?? const <Map<String, dynamic>>[]) {
      final lat = (i['latitude'] ?? i['lat']) as num?;
      final lon = (i['longitude'] ?? i['lon']) as num?;
      if (lat == null || lon == null) continue;
      if (zoneIdFor(lat.toDouble(), lon.toDouble()) == zone) n++;
    }
    return n;
  }

  Timer? _timer;
  StreamSubscription? _connSub;
  bool _syncing = false;

  Future<void> init() async {
    await _store.init();
    userId = await _store.userId();
    alertsEnabled = _store.alertsEnabled;
    zoneId = _store.lastZone;
    snapshot = _store.loadSnapshot();          // show cached data immediately
    lastSyncedAt = snapshot?.syncedAt;
    notifyListeners();

    _connSub = Connectivity().onConnectivityChanged.listen((_) => syncNow());
    _timer = Timer.periodic(_syncEvery, (_) => syncNow());
    unawaited(syncNow());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _connSub?.cancel();
    super.dispose();
  }

  // ----------------------------------------------------------------- profile
  /// Call after login and from the profile popup. 10-digit numbers are assumed to be Indian (+91).
  /// Returns false if the phone number is not valid.
  Future<bool> updateProfile({required String name, required String phone}) async {
    final cleaned = phone.replaceAll(RegExp(r'[\s\-()]'), '');
    final normalized = RegExp(r'^\d{10}$').hasMatch(cleaned) ? '+91$cleaned' : cleaned;
    if (normalized.isNotEmpty && !RegExp(r'^\+\d{10,14}$').hasMatch(normalized)) return false;
    await _store.setProfile(name: name.trim(), phone: normalized);
    notifyListeners();
    if (alertsEnabled) unawaited(syncNow()); // keep the server's SMS number current
    return true;
  }

  Future<bool> saveCurrentArea(String label) async {
    final z = zoneId;
    if (z == null || label.trim().isEmpty) return false;
    final c = zoneCenter(z);
    final list = _store.savedLocations()
      ..add(SavedLocation(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        label: label.trim(),
        zoneId: z,
        lat: c.lat,
        lon: c.lon,
      ));
    await _store.writeSavedLocations(list);
    notifyListeners();
    return true;
  }

  /// Save a location the user picked by address. Only the coarse zone is stored,
/// same as saveCurrentArea, so the exact address never leaves the device.
Future<bool> saveLocationAt(String label, double lat, double lon, {String? address}) async {
  if (label.trim().isEmpty) return false;
  final z = zoneIdFor(lat, lon);
  final c = zoneCenter(z);
  final list = _store.savedLocations()
    ..add(SavedLocation(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      label: label.trim(),
      zoneId: z,
      lat: c.lat,
      lon: c.lon,
    ));
  await _store.writeSavedLocations(list);
  notifyListeners();
  return true;
}

/// Lets a user without GPS (or on an emulator) choose their current area by hand.
/// The next successful GPS fix will replace it.
Future<void> setManualArea(double lat, double lon) async {
  final z = zoneIdFor(lat, lon);
  zoneId = z;
  await _store.setLastZone(z);
  notifyListeners();
  if (alertsEnabled) unawaited(syncNow());
}

  Future<void> removeSavedLocation(String id) async {
    final list = _store.savedLocations()..removeWhere((l) => l.id == id);
    await _store.writeSavedLocations(list);
    notifyListeners();
  }

  // ------------------------------------------------------------ opt in / out
  Future<void> setAlertsEnabled(bool on) async {
    alertsEnabled = on;
    await _store.setAlertsEnabled(on);
    await _store.setOptOutPending(!on);        // retried until the server confirms erasure
    notifyListeners();
    await syncNow();
  }

  Future<void> setSmsFallback(bool on) async {
    await _store.setSmsFallback(on);
    notifyListeners();
    if (alertsEnabled) await syncNow();
  }

  String? get _smsNumberForServer =>
      _store.smsFallback && _store.profilePhone.isNotEmpty ? _store.profilePhone : null;

  // ----------------------------------------------------------------- reports
  /// Always safe to call: it is queued locally and uploaded when the network is back.
  Future<void> submitReport(String text) async {
    await _store.enqueueReport({
      'client_id': '${userId}_${DateTime.now().microsecondsSinceEpoch}',
      'text': text,
      'zone_id': zoneId,
      'created_at': DateTime.now().toUtc().toIso8601String(),
    });
    notifyListeners();
    unawaited(syncNow());
  }

  // -------------------------------------------------------------------- sync
  Future<void> syncNow() async {
    if (_syncing) return;
    _syncing = true;
    try {
      // 1) opt-out erasure takes priority
      if (_store.optOutPending) {
        final r = await http.delete(Uri.parse('$baseUrl/citizens/$userId')).timeout(_timeout);
        if (r.statusCode < 300) await _store.setOptOutPending(false);
      }

      // 2) refresh our coarse zone (even before opt-in, so the profile can show it locally)
      final z = await _currentZone();
      if (z != null) {
        zoneId = z;
        await _store.setLastZone(z);
      }

      // 3) tell the server only if the user opted in
      if (alertsEnabled && zoneId != null) {
        await http
            .post(
              Uri.parse('$baseUrl/citizens/sync'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'user_id': userId,
                'zone_id': zoneId,
                'alert_enabled': true,
                'push_token': pushToken,
                'sms_number': _smsNumberForServer,
              }),
            )
            .timeout(_timeout);
      }

      // 4) pull incidents + advisories + alerts and cache them
      final res = await http
          .get(Uri.parse('$baseUrl/sync/snapshot?user_id=$userId&zone_id=${zoneId ?? ''}'))
          .timeout(_timeout);
      if (res.statusCode == 200) {
        final j = jsonDecode(res.body) as Map<String, dynamic>;
        snapshot = CachedSnapshot.fromJson({...j, 'synced_at': DateTime.now().toIso8601String()});
        await _store.saveSnapshot(snapshot!);
        lastSyncedAt = snapshot!.syncedAt;
      }

      // 5) flush queued reports (server de-duplicates by client_id)
      final pending = _store.pendingReports();
      if (pending.isNotEmpty) {
        final up = await http
            .post(
              Uri.parse('$baseUrl/reports/batch'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode(pending),
            )
            .timeout(_timeout);
        if (up.statusCode == 200) {
          final ok = (jsonDecode(up.body)['accepted'] as List).cast<String>();
          await _store.removeReports(ok);
        }
      }
      online = true;
    } catch (_) {
      online = false; // keep serving the cache; never present it as live
    } finally {
      _syncing = false;
      notifyListeners();
    }
  }

  // -------------------------------------------------- coarse, cheap location
  Future<String?> _currentZone() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return null;

      final p = await Geolocator.getLastKnownPosition() ??
          await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.low,
              timeLimit: Duration(seconds: 8),
            ),
          );
      return zoneIdFor(p.latitude, p.longitude);
    } catch (_) {
      return null; // fall back to the last known zone
    }
  }
}