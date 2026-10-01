import 'dart:convert';
import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

/// Last good copy of what the server told us, plus when we got it.
class CachedSnapshot {
  CachedSnapshot({
    required this.incidents,
    required this.advisories,
    required this.alerts,
    required this.syncedAt,
  });

  final List<Map<String, dynamic>> incidents;
  final List<Map<String, dynamic>> advisories;
  final List<Map<String, dynamic>> alerts;
  final DateTime syncedAt;

  Map<String, dynamic> toJson() => {
        'incidents': incidents,
        'advisories': advisories,
        'alerts': alerts,
        'synced_at': syncedAt.toIso8601String(),
      };

  factory CachedSnapshot.fromJson(Map<String, dynamic> j) => CachedSnapshot(
        incidents: _list(j['incidents']),
        advisories: _list(j['advisories']),
        alerts: _list(j['alerts']),
        syncedAt: DateTime.parse(j['synced_at'] as String),
      );

  static List<Map<String, dynamic>> _list(dynamic v) =>
      (v as List? ?? const []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
}

/// A place the citizen cares about. Stored as a coarse zone (cell centre), never exact coordinates.
class SavedLocation {
  SavedLocation({required this.id, required this.label, required this.zoneId, required this.lat, required this.lon});

  final String id;
  final String label;
  final String zoneId;
  final double lat; // centre of the zone cell
  final double lon;

  Map<String, dynamic> toJson() => {'id': id, 'label': label, 'zone_id': zoneId, 'lat': lat, 'lon': lon};

  factory SavedLocation.fromJson(Map<String, dynamic> j) => SavedLocation(
        id: j['id'] as String,
        label: j['label'] as String,
        zoneId: j['zone_id'] as String,
        lat: (j['lat'] as num).toDouble(),
        lon: (j['lon'] as num).toDouble(),
      );
}

class OfflineStore {
  static const _kSnapshot = 'cs_snapshot_v1';
  static const _kQueue = 'cs_report_queue_v1';
  static const _kUserId = 'cs_user_id';
  static const _kEnabled = 'cs_alerts_enabled';
  static const _kZone = 'cs_last_zone';
  static const _kOptOutPending = 'cs_optout_pending';
  static const _kName = 'cs_profile_name';
  static const _kPhone = 'cs_profile_phone';
  static const _kSmsFallback = 'cs_sms_fallback';
  static const _kSaved = 'cs_saved_locations_v1';

  late final SharedPreferences _p;

  Future<void> init() async => _p = await SharedPreferences.getInstance();

  // ---- identity + settings (random id, not tied to the device or phone number)
  Future<String> userId() async {
    var id = _p.getString(_kUserId);
    if (id == null) {
      final r = Random.secure();
      id = 'U${List.generate(8, (_) => r.nextInt(16).toRadixString(16)).join()}';
      await _p.setString(_kUserId, id);
    }
    return id;
  }

  bool get alertsEnabled => _p.getBool(_kEnabled) ?? false;
  Future<void> setAlertsEnabled(bool v) => _p.setBool(_kEnabled, v);

  String? get lastZone => _p.getString(_kZone);
  Future<void> setLastZone(String z) => _p.setString(_kZone, z);

  bool get optOutPending => _p.getBool(_kOptOutPending) ?? false;
  Future<void> setOptOutPending(bool v) => _p.setBool(_kOptOutPending, v);

  // ---- profile
  String get profileName => _p.getString(_kName) ?? '';
  String get profilePhone => _p.getString(_kPhone) ?? '';
  Future<void> setProfile({required String name, required String phone}) async {
    await _p.setString(_kName, name);
    await _p.setString(_kPhone, phone);
  }

  bool get smsFallback => _p.getBool(_kSmsFallback) ?? false;
  Future<void> setSmsFallback(bool v) => _p.setBool(_kSmsFallback, v);

  // ---- saved locations
  List<SavedLocation> savedLocations() {
    final raw = _p.getString(_kSaved);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List)
          .map((e) => SavedLocation.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> writeSavedLocations(List<SavedLocation> l) =>
      _p.setString(_kSaved, jsonEncode(l.map((e) => e.toJson()).toList()));

  // ---- cached safety information
  Future<void> saveSnapshot(CachedSnapshot s) => _p.setString(_kSnapshot, jsonEncode(s.toJson()));

  CachedSnapshot? loadSnapshot() {
    final raw = _p.getString(_kSnapshot);
    if (raw == null) return null;
    try {
      return CachedSnapshot.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null; // corrupt cache: treat as "nothing cached"
    }
  }

  // ---- offline report queue
  List<Map<String, dynamic>> pendingReports() {
    final raw = _p.getString(_kQueue);
    if (raw == null) return [];
    return (jsonDecode(raw) as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> enqueueReport(Map<String, dynamic> report) async {
    final q = pendingReports()..add(report);
    await _p.setString(_kQueue, jsonEncode(q));
  }

  Future<void> removeReports(Iterable<String> clientIds) async {
    final drop = clientIds.toSet();
    final q = pendingReports().where((r) => !drop.contains(r['client_id'])).toList();
    await _p.setString(_kQueue, jsonEncode(q));
  }
}