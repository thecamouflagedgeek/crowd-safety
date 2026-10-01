import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

import '../services/geo_alert_sync.dart';
import 'freshness_banner.dart';

const _lime = Color(0xFFE4FF3B);
const _ink = Color(0xFF0B1017);
const _paper = Color(0xFFF4F4F3);
const _red = Color(0xFFD94452);

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((s) => s.isNotEmpty).toList();
  if (parts.isEmpty) return '';
  final a = parts.first[0];
  final b = parts.length > 1 ? parts.last[0] : '';
  return (a + b).toUpperCase();
}

/// Put this in AppBar.leading (set leadingWidth: 56). Shows initials, with a red dot
/// when the server has matched an alert to the user's last known safety zone.
class ProfileAvatarButton extends StatelessWidget {
  const ProfileAvatarButton({super.key, required this.sync});
  final GeoAlertSync sync;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: sync,
      builder: (context, _) {
        final ini = _initials(sync.profileName);
        final hasAlert = (sync.snapshot?.alerts ?? const []).isNotEmpty;
        return Padding(
          padding: const EdgeInsets.only(left: 12),
          child: Center(
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => showProfileSheet(context, sync),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: _ink,
                    child: ini.isEmpty
                        ? const Icon(Icons.person, size: 20, color: _lime)
                        : Text(ini, style: const TextStyle(color: _lime, fontWeight: FontWeight.w800, fontSize: 13)),
                  ),
                  if (hasAlert)
                    Positioned(
                      right: -1,
                      top: -1,
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: _red,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

Future<void> showProfileSheet(BuildContext context, GeoAlertSync sync) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) => ProfileSheet(sync: sync),
  );
}

class ProfileSheet extends StatefulWidget {
  const ProfileSheet({super.key, required this.sync});
  final GeoAlertSync sync;

  @override
  State<ProfileSheet> createState() => _ProfileSheetState();
}

class _ProfileSheetState extends State<ProfileSheet> {
  late final TextEditingController _name;
  late final TextEditingController _phone;
  String? _phoneError;

  GeoAlertSync get sync => widget.sync;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: sync.profileName);
    _phone = TextEditingController(text: sync.profilePhone);
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _toast(String msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  Future<void> _saveProfile() async {
    final ok = await sync.updateProfile(name: _name.text, phone: _phone.text);
    if (!mounted) return;
    setState(() => _phoneError = ok ? null : 'Enter a valid number, e.g. 98765 43210 or +919876543210');
    if (ok) {
      _phone.text = sync.profilePhone;
      _toast('Profile saved');
    }
  }

  /// Save wherever the user is right now (asks for GPS itself, no prior sync needed).
  Future<void> _addLocation() async {
    _toast('Getting your location…');
    final fix = await _gpsFix();
    final at = fix ?? sync.currentAreaCenter;
    if (!mounted) return;
    if (at == null) {
      _toast('Could not get your location. Turn on location and allow access, or use Add address.');
      return;
    }
    final ctrl = TextEditingController();
    final label = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Save current area'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'e.g. Home, Office, College'),
          textCapitalization: TextCapitalization.words,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: const Text('Save')),
        ],
      ),
    );
    ctrl.dispose();
    if (label == null || !mounted) return;
    final ok = await sync.saveLocationAt(label.trim().isEmpty ? 'My location' : label, at.lat, at.lon);
    if (!mounted) return;
    _toast(ok ? 'Location saved' : 'Could not save this location. Try again.');
  }

  /// Save a place the user searches for by address (Home, Office, ...).
  Future<void> _addAddress() async {
    final p = await showDialog<_PickedPlace>(
      context: context,
      builder: (_) => const _AddressPickerDialog(),
    );
    if (p == null || !mounted) return;
    final ok = await sync.saveLocationAt(p.label, p.lat, p.lon, address: p.address);
    if (!mounted) return;
    _toast(ok ? '${p.label} saved' : 'Could not save this location. Try again.');
  }

  /// Set the "current area" by hand when GPS is unavailable.
  Future<void> _setCurrentFromAddress() async {
    final p = await showDialog<_PickedPlace>(
      context: context,
      builder: (_) => const _AddressPickerDialog(),
    );
    if (p == null || !mounted) return;
    await sync.setManualArea(p.lat, p.lon);
    if (!mounted) return;
    _toast('Current area set');
  }

  /// Use the phone's GPS as the current area.
  Future<void> _useGps() async {
    _toast('Getting your location…');
    final fix = await _gpsFix();
    if (!mounted) return;
    if (fix == null) {
      _toast('Could not get GPS. Turn on location and allow access, or enter a location.');
      return;
    }
    await sync.setManualArea(fix.lat, fix.lon);
    if (!mounted) return;
    _toast('Current location updated');
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: .92,
      minChildSize: .5,
      maxChildSize: .95,
      expand: false,
      builder: (context, scroll) => Container(
        decoration: const BoxDecoration(
          color: _paper,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: ListenableBuilder(
          listenable: sync,
          builder: (context, _) {
            final c = sync.currentAreaCenter;
            final alerts = sync.snapshot?.alerts ?? const [];
            final saved = sync.savedLocations;
            return ListView(
              controller: scroll,
              padding: const EdgeInsets.fromLTRB(18, 10, 18, 28),
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(4)),
                  ),
                ),
                Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: _ink,
                      child: Text(
                        _initials(sync.profileName).isEmpty ? '?' : _initials(sync.profileName),
                        style: const TextStyle(color: _lime, fontWeight: FontWeight.w800, fontSize: 18),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(sync.profileName.isEmpty ? 'Your profile' : sync.profileName,
                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                          Text(sync.profilePhone.isEmpty ? 'No phone number added' : sync.profilePhone,
                              style: const TextStyle(color: Colors.black54, fontSize: 13)),
                        ],
                      ),
                    ),
                    IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                  ],
                ),
                const SizedBox(height: 16),

                // ---------------- details
                _Section(
                  title: 'Your details',
                  child: Column(
                    children: [
                      TextField(
                        controller: _name,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(labelText: 'Name', prefixIcon: Icon(Icons.person_outline)),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _phone,
                        keyboardType: TextInputType.phone,
                        decoration: InputDecoration(
                          labelText: 'Phone number',
                          prefixIcon: const Icon(Icons.phone_outlined),
                          errorText: _phoneError,
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          style: FilledButton.styleFrom(backgroundColor: _ink, foregroundColor: _lime),
                          onPressed: _saveProfile,
                          child: const Text('Save profile'),
                        ),
                      ),
                    ],
                  ),
                ),

                // ---------------- geo-sync alerts + current location
                _Section(
                  title: 'Geo-Sync safety alerts',
                  child: Column(
                    children: [
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        value: sync.alertsEnabled,
                        onChanged: (v) => sync.setAlertsEnabled(v),
                        title: const Text('Get alerts near my area', style: TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: const Text(
                          'Shares only your approximate area (about 5 km) for emergency alerts. '
                          'It expires after 30 minutes without a sync. Turn off any time.',
                          style: TextStyle(fontSize: 12),
                        ),
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        value: sync.smsFallback,
                        onChanged: sync.alertsEnabled && sync.profilePhone.isNotEmpty
                            ? (v) => sync.setSmsFallback(v)
                            : null,
                        title: const Text('SMS fallback', style: TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text(
                          sync.profilePhone.isEmpty
                              ? 'Add a phone number above to enable.'
                              : 'Text ${sync.profilePhone} if app/data alerts cannot reach you.',
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                      const Divider(height: 24),
                      Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: const BoxDecoration(color: _lime, shape: BoxShape.circle),
                            child: const Icon(Icons.my_location, size: 20, color: _ink),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Current location', style: TextStyle(fontWeight: FontWeight.w700)),
                                Text(
                                  c == null
                                      ? 'Not available yet. Allow location access, or enter one.'
                                      : 'Approx. area near ${c.lat.toStringAsFixed(2)}°, ${c.lon.toStringAsFixed(2)}° '
                                          '· zone ${sync.zoneId}',
                                  style: const TextStyle(fontSize: 12, color: Colors.black54),
                                ),
                                Wrap(
                                  spacing: 4,
                                  children: [
                                    TextButton.icon(
                                      style: TextButton.styleFrom(
                                        padding: const EdgeInsets.only(right: 8),
                                        minimumSize: const Size(0, 30),
                                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                      ),
                                      onPressed: _useGps,
                                      icon: const Icon(Icons.gps_fixed, size: 16),
                                      label: const Text('Use GPS'),
                                    ),
                                    TextButton.icon(
                                      style: TextButton.styleFrom(
                                        padding: const EdgeInsets.only(right: 8),
                                        minimumSize: const Size(0, 30),
                                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                      ),
                                      onPressed: _setCurrentFromAddress,
                                      icon: const Icon(Icons.edit_location_alt_outlined, size: 16),
                                      label: const Text('Enter a location'),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            tooltip: 'Refresh',
                            onPressed: sync.syncNow,
                            icon: const Icon(Icons.refresh),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // ---------------- freshness (popup version)
                _Section(title: 'Data freshness', child: FreshnessBanner(sync: sync)),

                // ---------------- zone alert card
                _Section(
                  title: 'Zone alerts',
                  child: alerts.isEmpty
                      ? const Row(
                          children: [
                            Icon(Icons.check_circle_outline, color: Color(0xFF17A673)),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text('No alerts for your last known safety zone.', style: TextStyle(fontSize: 13)),
                            ),
                          ],
                        )
                      : ZoneAlertCard(sync: sync),
                ),

                // ---------------- saved locations
                _Section(
                  title: 'Saved locations',
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TextButton.icon(
                        onPressed: _addAddress,
                        icon: const Icon(Icons.add_location_alt_outlined, size: 18),
                        label: const Text('Add address'),
                      ),
                      IconButton(
                        tooltip: 'Save current GPS area',
                        onPressed: _addLocation,
                        icon: const Icon(Icons.my_location, size: 18),
                      ),
                    ],
                  ),
                  child: saved.isEmpty
                      ? const Text(
                          'Save places like Home or Office to see incidents in those areas. '
                          'Stored on this device. Only the approximate zone is shared for alerts.',
                          style: TextStyle(fontSize: 12, color: Colors.black54),
                        )
                      : Column(
                          children: [
                            for (final l in saved)
                              Builder(builder: (context) {
                                final n = sync.incidentsInZone(l.zoneId);
                                return ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  leading: const CircleAvatar(
                                    backgroundColor: _ink,
                                    child: Icon(Icons.place, color: _lime, size: 20),
                                  ),
                                  title: Text(l.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                                  subtitle: Text(
                                    n > 0
                                        ? '$n active incident${n == 1 ? '' : 's'} in this zone'
                                        : 'No active incidents in this zone',
                                    style: TextStyle(fontSize: 12, color: n > 0 ? _red : Colors.black54),
                                  ),
                                  trailing: IconButton(
                                    tooltip: 'Remove',
                                    icon: const Icon(Icons.delete_outline),
                                    onPressed: () => sync.removeSavedLocation(l.id),
                                  ),
                                );
                              }),
                          ],
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child, this.trailing});
  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 14, offset: Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800))),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

// ------------------------------------------------------------ address picker

const _nominatim = 'nominatim.openstreetmap.org';
const _nominatimHeaders = {'User-Agent': 'SafeCityApp/1.0', 'Accept-Language': 'en'};

/// One GPS fix, asking for permission if needed. Null if unavailable.
Future<({double lat, double lon})?> _gpsFix() async {
  try {
    if (!await Geolocator.isLocationServiceEnabled()) return null;
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return null;
    final p = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 10)),
    );
    return (lat: p.latitude, lon: p.longitude);
  } catch (_) {
    try {
      final p = await Geolocator.getLastKnownPosition();
      if (p != null) return (lat: p.latitude, lon: p.longitude);
    } catch (_) {}
    return null;
  }
}

String _shortName(String full) {
  final parts = full.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
  return parts.take(2).join(', ');
}

class _PickedPlace {
  _PickedPlace(this.label, this.address, this.lat, this.lon);
  final String label, address;
  final double lat, lon;
}

class _Hit {
  _Hit(this.name, this.lat, this.lon);
  final String name;
  final double lat, lon;
}

Future<List<_Hit>> _geocode(String q, {int limit = 5}) async {
  final r = await http
      .get(Uri.https(_nominatim, '/search', {'q': q, 'format': 'jsonv2', 'limit': '$limit'}), headers: _nominatimHeaders)
      .timeout(const Duration(seconds: 8));
  if (r.statusCode != 200) throw Exception('geocode failed');
  return (jsonDecode(r.body) as List)
      .map((e) => _Hit(e['display_name'].toString(), double.parse(e['lat'].toString()), double.parse(e['lon'].toString())))
      .toList();
}

/// Coordinates -> readable address. Falls back to the coordinates if offline.
Future<_Hit> _reverse(double lat, double lon) async {
  final coords = '${lat.toStringAsFixed(4)}, ${lon.toStringAsFixed(4)}';
  try {
    final r = await http
        .get(Uri.https(_nominatim, '/reverse', {'lat': '$lat', 'lon': '$lon', 'format': 'jsonv2'}), headers: _nominatimHeaders)
        .timeout(const Duration(seconds: 8));
    if (r.statusCode == 200) {
      final name = (jsonDecode(r.body) as Map)['display_name']?.toString();
      if (name != null && name.isNotEmpty) return _Hit(name, lat, lon);
    }
  } catch (_) {}
  return _Hit(coords, lat, lon);
}

class _AddressPickerDialog extends StatefulWidget {
  const _AddressPickerDialog();
  @override
  State<_AddressPickerDialog> createState() => _AddressPickerDialogState();
}

class _AddressPickerDialogState extends State<_AddressPickerDialog> {
  final _label = TextEditingController();
  final _query = TextEditingController();
  Timer? _debounce;
  int _reqId = 0;
  List<_Hit> _hits = [];
  _Hit? _sel;
  bool _busy = false;
  bool _saving = false;
  String? _err;

  @override
  void dispose() {
    _debounce?.cancel();
    _label.dispose();
    _query.dispose();
    super.dispose();
  }

  /// Search as the user types (debounced to respect the free geocoder).
  void _onChanged(String v) {
    _debounce?.cancel();
    if (v.trim().length < 3) {
      setState(() { _hits = []; _sel = null; _err = null; _busy = false; });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 600), _search);
  }

  Future<void> _search() async {
    final q = _query.text.trim();
    if (q.length < 3) return;
    final id = ++_reqId;
    setState(() { _busy = true; _err = null; });
    try {
      final hits = await _geocode(q);
      if (!mounted || id != _reqId) return;
      setState(() {
        _hits = hits;
        _sel = hits.isEmpty ? null : hits.first; // best match is pre-selected
        _busy = false;
        _err = hits.isEmpty ? 'No match yet. Keep typing or add the city.' : null;
      });
    } catch (_) {
      if (!mounted || id != _reqId) return;
      setState(() { _busy = false; _err = 'Search failed. Check your connection.'; });
    }
  }

  Future<void> _useCurrent() async {
    _debounce?.cancel();
    final id = ++_reqId;
    setState(() { _busy = true; _err = null; });
    final fix = await _gpsFix();
    if (!mounted || id != _reqId) return;
    if (fix == null) {
      setState(() { _busy = false; _err = 'Could not get your location. Turn on location and allow access.'; });
      return;
    }
    final hit = await _reverse(fix.lat, fix.lon);
    if (!mounted || id != _reqId) return;
    _query.text = _shortName(hit.name);
    setState(() { _hits = [hit]; _sel = hit; _busy = false; });
  }

  Future<void> _save() async {
    if (_saving) return;
    _debounce?.cancel();
    var sel = _sel;
    if (sel == null) {
      // Nothing picked yet: look up whatever was typed and use the best match.
      final q = _query.text.trim();
      if (q.isEmpty) {
        setState(() => _err = 'Enter an address or use your current location.');
        return;
      }
      setState(() { _saving = true; _err = null; });
      try {
        final hits = await _geocode(q, limit: 1);
        if (hits.isNotEmpty) sel = hits.first;
      } catch (_) {}
      if (!mounted) return;
      if (sel == null) {
        setState(() { _saving = false; _err = "Couldn't locate that address. Add the area or city and try again."; });
        return;
      }
    }
    final typed = _label.text.trim();
    final short = _shortName(sel.name);
    final label = typed.isEmpty ? short : '$typed · $short'; // keeps the address visible in the saved list
    Navigator.pop(context, _PickedPlace(label, sel.name, sel.lat, sel.lon));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add a location'),
      content: SizedBox(
        width: double.maxFinite,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _label,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Name', hintText: 'Home, Office, College'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _query,
                onChanged: _onChanged,
                onSubmitted: (_) => _search(),
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  labelText: 'Address or place',
                  hintText: 'Start typing an address',
                  suffixIcon: IconButton(icon: const Icon(Icons.search), onPressed: _search),
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _useCurrent,
                icon: const Icon(Icons.my_location, size: 18),
                label: const Text('Use my current location'),
              ),
              if (_busy) const Padding(padding: EdgeInsets.all(14), child: Center(child: CircularProgressIndicator())),
              if (_err != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(_err!, style: const TextStyle(color: _red, fontSize: 12)),
                ),
              for (final h in _hits)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  selected: identical(h, _sel),
                  leading: Icon(identical(h, _sel) ? Icons.check_circle : Icons.place_outlined),
                  title: Text(h.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                  onTap: () => setState(() => _sel = h),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save'),
        ),
      ],
    );
  }
}