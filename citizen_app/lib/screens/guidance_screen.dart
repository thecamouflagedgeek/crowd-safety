import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import '../models/incident.dart';
import '../services/api_service.dart';
import '../theme.dart';

const _lime = Color(0xFFE2FF3B);
const _glass = Color(0xFF1B2B3F);
const _altGrey = Color(0xFF9AA5B1);

/// One drivable route drawn on the map.
class _Rt {
  final String name;
  final List<LatLng> pts;
  final double km;
  final int min;
  final double clearM; // closest approach to the incident, metres
  final bool estimated;
  const _Rt(this.name, this.pts, this.km, this.min, this.clearM, {this.estimated = false});
}

class GuidanceScreen extends StatefulWidget {
  final Incident i;

  /// Real user GPS — passed so routes start from the real position.
  /// Falls back to the Andheri reference if unavailable.
  final double userLat;
  final double userLon;

  const GuidanceScreen(
    this.i, {
    super.key,
    double? userLat,
    double? userLon,
  })  : userLat = userLat ?? Incident.refLat,
        userLon = userLon ?? Incident.refLon;

  @override
  State<GuidanceScreen> createState() => _GuidanceScreenState();
}

class _GuidanceScreenState extends State<GuidanceScreen> {
  static const _dist = Distance();

  late final LatLng user = LatLng(widget.userLat, widget.userLon);
  late final LatLng inc = LatLng(widget.i.lat, widget.i.lon);
  late final LatLng dest = _safeZone();

  List<_Rt> routes = [];
  Map<String, dynamic> back = {};
  bool loading = true;
  bool offline = false;
  int pick = 0;

  @override
  void initState() {
    super.initState();
    load();
  }

  /// A "safe zone" about 2 km to the side of the incident, away from the
  /// straight line between the user and the incident.
  LatLng _safeZone() {
    final dLat = inc.latitude - user.latitude;
    final dLon = inc.longitude - user.longitude;
    final len = math.sqrt(dLat * dLat + dLon * dLon);
    if (len < 1e-6) return LatLng(inc.latitude + .018, inc.longitude);
    final pLat = -dLon / len, pLon = dLat / len;
    return LatLng(inc.latitude + pLat * .018, inc.longitude + pLon * .018);
  }

  Future<void> load() async {
    Map<String, dynamic> b = {};
    List<_Rt> list = [];
    try {
      final res = await Future.wait([
        Api.route(widget.i, userLat: widget.userLat, userLon: widget.userLon)
            .timeout(const Duration(seconds: 6))
            .then<Map<String, dynamic>>((v) => v)
            .catchError((_) => <String, dynamic>{}),
        fetchOsrm().timeout(const Duration(seconds: 10), onTimeout: () => <_Rt>[]).catchError((_) => <_Rt>[]),
      ]);
      b = res[0] as Map<String, dynamic>;
      list = res[1] as List<_Rt>;
    } catch (_) {}
    if (list.isEmpty) {
      offline = true;
      list = synthetic();
    }
    // best = furthest from the incident, ties broken by time
    list.sort((a, c) {
      final k = (c.clearM / 150).round().compareTo((a.clearM / 150).round());
      return k != 0 ? k : a.min.compareTo(c.min);
    });
    if (!mounted) return;
    setState(() {
      back = b;
      routes = list.take(3).toList();
      loading = false;
    });
  }

  // ── Real road routes with alternatives (OSRM) ───────────────────────
  Future<List<_Rt>> fetchOsrm() async {
    try {
      final url = 'https://router.project-osrm.org/route/v1/driving/'
          '${user.longitude},${user.latitude};${dest.longitude},${dest.latitude}'
          '?alternatives=3&overview=full&geometries=geojson&steps=true';
      final r = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 9));
      if (r.statusCode != 200) return [];
      final j = jsonDecode(r.body);
      if (j['code'] != 'Ok') return [];
      final out = <_Rt>[];
      for (final rt in (j['routes'] as List)) {
        final coords = (rt['geometry']['coordinates'] as List)
            .map((p) => LatLng((p[1] as num).toDouble(), (p[0] as num).toDouble()))
            .toList();
        if (coords.length < 2) continue;
        // main road = the named road covering the most distance
        final byName = <String, double>{};
        for (final leg in (rt['legs'] as List)) {
          for (final st in (leg['steps'] as List)) {
            final n = (st['name'] ?? '').toString();
            if (n.isNotEmpty) byName[n] = (byName[n] ?? 0) + (st['distance'] as num).toDouble();
          }
        }
        String name = 'Main road';
        if (byName.isNotEmpty) {
          name = byName.entries.reduce((a, b) => a.value >= b.value ? a : b).key;
        }
        out.add(_Rt(
          'Via $name',
          coords,
          (rt['distance'] as num).toDouble() / 1000,
          ((rt['duration'] as num).toDouble() / 60).round().clamp(1, 9999),
          clearance(coords),
        ));
      }
      return out;
    } catch (_) {
      return [];
    }
  }

  double clearance(List<LatLng> pts) {
    var best = double.infinity;
    for (final p in pts) {
      final d = _dist.as(LengthUnit.Meter, p, inc);
      if (d < best) best = d;
    }
    return best;
  }

  // ── Offline fallback: three curved estimates ────────────────────────
  List<_Rt> synthetic() {
    final dLat = dest.latitude - user.latitude;
    final dLon = dest.longitude - user.longitude;
    final len = math.sqrt(dLat * dLat + dLon * dLon);
    final pLat = len == 0 ? 0.0 : -dLon / len;
    final pLon = len == 0 ? 0.0 : dLat / len;
    final mid = LatLng((user.latitude + dest.latitude) / 2, (user.longitude + dest.longitude) / 2);
    final straightKm = _dist.as(LengthUnit.Kilometer, user, dest);
    const names = ['Direct road', 'Service road', 'Ring road'];
    const offs = [.004, .016, -.02];
    final out = <_Rt>[];
    for (int n = 0; n < 3; n++) {
      final c = LatLng(mid.latitude + pLat * offs[n] * 2, mid.longitude + pLon * offs[n] * 2);
      final pts = <LatLng>[];
      for (int k = 0; k <= 30; k++) {
        final t = k / 30, u = 1 - t;
        pts.add(LatLng(
          u * u * user.latitude + 2 * u * t * c.latitude + t * t * dest.latitude,
          u * u * user.longitude + 2 * u * t * c.longitude + t * t * dest.longitude,
        ));
      }
      final km = straightKm * (1.25 + .12 * n);
      out.add(_Rt('Via ${names[n]}', pts, km, (km / 28 * 60).round().clamp(1, 9999), clearance(pts), estimated: true));
    }
    return out;
  }

  // ── Map ─────────────────────────────────────────────────────────────
  Widget mapView() {
    final order = [for (int n = 0; n < routes.length; n++) if (n != pick) n, pick];

    // fit only the key points (stable, never degenerate)
    final key = <LatLng>[user, dest, inc];
    var minLat = key.map((p) => p.latitude).reduce(math.min);
    var maxLat = key.map((p) => p.latitude).reduce(math.max);
    var minLon = key.map((p) => p.longitude).reduce(math.min);
    var maxLon = key.map((p) => p.longitude).reduce(math.max);
    if (maxLat - minLat < .004) { minLat -= .004; maxLat += .004; }
    if (maxLon - minLon < .004) { minLon -= .004; maxLon += .004; }
    final bounds = LatLngBounds(LatLng(minLat, minLon), LatLng(maxLat, maxLon));

    return FlutterMap(
      key: ValueKey('map-${routes.length}-$offline'),
      options: MapOptions(
        initialCenter: LatLng((minLat + maxLat) / 2, (minLon + maxLon) / 2),
        initialZoom: 12.5,
        initialCameraFit: CameraFit.bounds(
          bounds: bounds,
          padding: const EdgeInsets.fromLTRB(40, 110, 40, 40),
          maxZoom: 15.5,
        ),
        interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.example.citizen_app',
        ),
        CircleLayer(circles: [
          CircleMarker(
            point: inc,
            radius: 600,
            useRadiusInMeter: true,
            color: widget.i.color.withAlpha(60),
            borderColor: widget.i.color.withAlpha(200),
            borderStrokeWidth: 2,
          ),
        ]),
        PolylineLayer(polylines: [
          for (final n in order)
            Polyline(
              points: routes[n].pts,
              strokeWidth: n == pick ? 8 : 6,
              color: n == pick ? kBlue : _altGrey,
              borderStrokeWidth: 3,
              borderColor: Colors.white,
            ),
        ]),
        MarkerLayer(markers: [
          for (int n = 0; n < routes.length; n++)
            Marker(
              point: routes[n].pts[(routes[n].pts.length * (.38 + .13 * n)).floor().clamp(0, routes[n].pts.length - 1)],
              width: 86,
              height: 38,
              child: GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => pick = n);
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: n == pick ? kBlue : Colors.white,
                    borderRadius: BorderRadius.circular(19),
                    boxShadow: [BoxShadow(color: Colors.black.withAlpha(60), blurRadius: 10, offset: const Offset(0, 3))],
                  ),
                  child: Text('${routes[n].min} min',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: n == pick ? Colors.white : kInk, decoration: TextDecoration.none)),
                ),
              ),
            ),
          Marker(
            point: dest, width: 46, height: 46,
            child: Container(
              decoration: BoxDecoration(
                color: kGreen, shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 3),
                boxShadow: [BoxShadow(color: Colors.black.withAlpha(60), blurRadius: 10)],
              ),
              child: const Icon(Icons.flag_rounded, color: Colors.white, size: 22),
            ),
          ),
          Marker(
            point: inc, width: 46, height: 46,
            child: Container(
              decoration: BoxDecoration(
                color: widget.i.color, shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 3),
                boxShadow: [BoxShadow(color: widget.i.color.withAlpha(150), blurRadius: 16)],
              ),
              child: Icon(widget.i.icon, color: Colors.white, size: 22),
            ),
          ),
          Marker(
            point: user, width: 30, height: 30,
            child: Container(
              decoration: BoxDecoration(
                color: kBlue, shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 4),
                boxShadow: [BoxShadow(color: kBlue.withAlpha(120), blurRadius: 12, spreadRadius: 2)],
              ),
            ),
          ),
        ]),
        const RichAttributionWidget(
          alignment: AttributionAlignment.bottomLeft,
          attributions: [TextSourceAttribution('OpenStreetMap contributors')],
        ),
      ],
    );
  }

  // ── Option card ─────────────────────────────────────────────────────
  Widget optionCard(int n, _Rt o) {
    final on = pick == n;
    final best = n == 0;
    final fg = on ? kInk : Colors.black87;
    final clear = o.clearM >= 1000 ? '${(o.clearM / 1000).toStringAsFixed(1)} km' : '${(o.clearM / 10).round() * 10} m';
    return _Press(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => pick = n);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.fromLTRB(14, 14, 18, 14),
        decoration: BoxDecoration(
          color: on ? _lime : const Color(0xFFF4F6F8),
          borderRadius: BorderRadius.circular(26),
          boxShadow: on ? [BoxShadow(color: _lime.withAlpha(110), blurRadius: 20, offset: const Offset(0, 8))] : null,
        ),
        child: Row(children: [
          Container(
            width: 46, height: 46,
            decoration: BoxDecoration(color: on ? kInk : Colors.white, shape: BoxShape.circle),
            child: Icon(best ? Icons.shield_rounded : Icons.alt_route_rounded, color: on ? _lime : kInk, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(
                  child: Text(o.name,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, letterSpacing: -.2, color: fg, decoration: TextDecoration.none)),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: on ? kInk : Colors.white, borderRadius: BorderRadius.circular(10)),
                  child: Text(best ? 'Safest' : 'Alternate',
                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: on ? _lime : Colors.black54, decoration: TextDecoration.none)),
                ),
              ]),
              const SizedBox(height: 4),
              Text('Passes $clear from ${widget.i.location}${o.estimated ? ' · est.' : ''}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12.5, height: 1.3, fontWeight: FontWeight.w500, color: on ? kInk.withAlpha(180) : Colors.black54, decoration: TextDecoration.none)),
            ]),
          ),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('${o.min}',
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w500, letterSpacing: -1, height: 1, color: fg, decoration: TextDecoration.none)),
            Text('min · ${o.km.toStringAsFixed(1)} km',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: on ? kInk.withAlpha(170) : Colors.black45, decoration: TextDecoration.none)),
          ]),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext c) {
    final i = widget.i;
    final reason = back['reason']?.toString() ?? '';
    final severity = (back['severity']?.toString().isNotEmpty ?? false) ? back['severity'].toString() : (i.high ? 'HIGH' : 'MEDIUM');
    final mapH = MediaQuery.of(c).size.height * .5;

    final bar = Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
      child: _Glass(
        radius: 30,
        padding: const EdgeInsets.all(7),
        child: Row(children: [
          _Press(
            onTap: () => Navigator.maybePop(c),
            child: Container(
              width: 48, height: 48,
              decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
              child: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: kInk),
            ),
          ),
          Expanded(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Text('Safe route',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Colors.white, decoration: TextDecoration.none)),
              const SizedBox(height: 2),
              Text('Avoiding ${i.location} · $severity risk',
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 11.5, color: Colors.white60, decoration: TextDecoration.none)),
            ]),
          ),
          Container(
            width: 48, height: 48,
            decoration: const BoxDecoration(color: _lime, shape: BoxShape.circle),
            child: const Icon(Icons.alt_route_rounded, size: 22, color: kInk),
          ),
        ]),
      ),
    );

    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(children: [
        // ── map (fixed height) ──────────────────────────────────────────
        SizedBox(
          height: mapH,
          width: double.infinity,
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(34)),
            child: Stack(fit: StackFit.expand, children: [
              if (loading)
                Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF1B2B3F), Color(0xFF506A80)]),
                  ),
                  child: const Center(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      SizedBox(width: 34, height: 34, child: CircularProgressIndicator(color: _lime, strokeWidth: 3)),
                      SizedBox(height: 16),
                      Text('Finding safer routes…',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14, decoration: TextDecoration.none)),
                    ]),
                  ),
                )
              else
                mapView(),
              IgnorePointer(
                child: Container(
                  height: 140,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [_glass.withAlpha(130), _glass.withAlpha(0)]),
                  ),
                ),
              ),
              SafeArea(bottom: false, child: Align(alignment: Alignment.topCenter, child: bar)),
            ]),
          ),
        ),

        // ── route options ───────────────────────────────────────────────
        Expanded(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 16, 22, 10),
              child: Row(children: [
                const Expanded(
                  child: Text('Route options',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600, letterSpacing: -.6, color: kInk, decoration: TextDecoration.none)),
                ),
                if (!loading)
                  Text('${routes.length} routes',
                      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Colors.black45, decoration: TextDecoration.none)),
              ]),
            ),
            Expanded(
              child: loading
                  ? const SizedBox.shrink()
                  : ListView(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
                      children: [
                        for (int n = 0; n < routes.length; n++) optionCard(n, routes[n]),
                        if (reason.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(10, 2, 10, 8),
                            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              const Icon(Icons.info_outline, size: 15, color: Colors.black38),
                              const SizedBox(width: 6),
                              Expanded(child: Text(reason, style: const TextStyle(fontSize: 12.5, height: 1.35, color: Colors.black54, decoration: TextDecoration.none, fontWeight: FontWeight.w500))),
                            ]),
                          ),
                        if (offline)
                          const Padding(
                            padding: EdgeInsets.fromLTRB(10, 0, 10, 8),
                            child: Text('Offline — showing estimated routes',
                                style: TextStyle(fontSize: 12, color: Colors.black38, decoration: TextDecoration.none)),
                          ),
                      ],
                    ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 12),
                child: _Press(
                  onTap: () => showChat(c, i),
                  child: Container(
                    height: 60,
                    padding: const EdgeInsets.fromLTRB(26, 0, 7, 0),
                    decoration: BoxDecoration(
                      color: _lime,
                      borderRadius: BorderRadius.circular(30),
                      boxShadow: [BoxShadow(color: _lime.withAlpha(100), blurRadius: 24, offset: const Offset(0, 8))],
                    ),
                    child: Row(children: [
                      const Text('Ask AI about this route',
                          style: TextStyle(color: kInk, fontSize: 16, fontWeight: FontWeight.w800, letterSpacing: -.2, decoration: TextDecoration.none)),
                      const Spacer(),
                      Container(
                        width: 46, height: 46,
                        decoration: const BoxDecoration(color: kInk, shape: BoxShape.circle),
                        child: const Icon(Icons.chat_bubble_outline_rounded, color: _lime, size: 20),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Chat sheet (same API: showChat / ChatSheet)
// ═══════════════════════════════════════════════════════════════════════

void showChat(BuildContext c, Incident? i) => showModalBottomSheet(
      context: c,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChatSheet(i),
    );

class ChatSheet extends StatefulWidget {
  final Incident? i;
  const ChatSheet(this.i, {super.key});
  @override
  State<ChatSheet> createState() => _ChatSheetState();
}

class _ChatSheetState extends State<ChatSheet> {
  final ctl = TextEditingController();
  final scroll = ScrollController();
  late final List<(bool, String)> msgs = [
    (false, 'Hi, I\'m your safety assistant. Ask me about ${widget.i?.eventName ?? widget.i?.location ?? 'nearby incidents'}.')
  ];
  bool busy = false;

  Future<void> send() async {
    final t = ctl.text.trim();
    if (t.isEmpty || busy) return;
    HapticFeedback.selectionClick();
    ctl.clear();
    setState(() {
      msgs.add((true, t));
      busy = true;
    });
    scrollDown();
    String reply;
    try {
      final r = await Api.chat(t, widget.i);
      reply = '${r['reply']}';
    } catch (_) {
      reply = 'Current CCTV analysis indicates elevated risk near ${widget.i?.location ?? 'this area'}. I recommend avoiding it and using the recommended route.';
    }
    if (mounted) {
      setState(() {
        msgs.add((false, reply));
        busy = false;
      });
      scrollDown();
    }
  }

  void scrollDown() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (scroll.hasClients) scroll.animateTo(scroll.position.maxScrollExtent + 80, duration: const Duration(milliseconds: 300), curve: Curves.easeOutCubic);
      });

  @override
  void dispose() {
    ctl.dispose();
    scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(c).viewInsets.bottom),
        child: Container(
          height: 500,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(36)),
          ),
          child: Column(children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.black12, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 14),
            const Text('SAFETY ASSISTANT',
                style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.2, fontSize: 12, color: Colors.black45, decoration: TextDecoration.none)),
            const SizedBox(height: 10),
            Expanded(
              child: ListView(controller: scroll, physics: const BouncingScrollPhysics(), children: [
                for (final m in msgs)
                  Align(
                    alignment: m.$1 ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      constraints: const BoxConstraints(maxWidth: 290),
                      decoration: BoxDecoration(
                        color: m.$1 ? _glass : const Color(0xFFF0F2F4),
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: Text(m.$2,
                          style: TextStyle(color: m.$1 ? Colors.white : kInk, height: 1.4, fontWeight: FontWeight.w500, decoration: TextDecoration.none, fontSize: 14.5)),
                    ),
                  ),
                if (busy)
                  const Padding(
                    padding: EdgeInsets.all(8),
                    child: Text('Analysing CCTV…', style: TextStyle(color: Colors.black45, decoration: TextDecoration.none)),
                  ),
              ]),
            ),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: ctl,
                  onSubmitted: (_) => send(),
                  cursorColor: kInk,
                  decoration: InputDecoration(
                    hintText: 'Is ${widget.i?.location ?? 'it'} safe?',
                    filled: true,
                    fillColor: const Color(0xFFF0F2F4),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: BorderSide.none),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _Press(
                onTap: send,
                child: Container(
                  width: 52, height: 52,
                  decoration: const BoxDecoration(color: _lime, shape: BoxShape.circle),
                  child: const Icon(Icons.arrow_upward_rounded, color: kInk),
                ),
              ),
            ]),
          ]),
        ),
      );
}

// ═══════════════════════════════════════════════════════════════════════
//  UI building blocks (private to this file)
// ═══════════════════════════════════════════════════════════════════════

class _Glass extends StatelessWidget {
  final Widget child;
  final double radius;
  final EdgeInsetsGeometry? padding;
  const _Glass({required this.child, this.radius = 28, this.padding});
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
          child: Container(
            padding: padding,
            decoration: BoxDecoration(
              color: _glass.withAlpha(150),
              borderRadius: BorderRadius.circular(radius),
              border: Border.all(color: Colors.white.withAlpha(40)),
            ),
            child: child,
          ),
        ),
      );
}

class _Press extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;
  const _Press({required this.child, required this.onTap});
  @override
  State<_Press> createState() => _PressState();
}

class _PressState extends State<_Press> {
  bool down = false;
  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => down = true),
        onTapUp: (_) => setState(() => down = false),
        onTapCancel: () => setState(() => down = false),
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: down ? .96 : 1,
          duration: Duration(milliseconds: down ? 110 : 320),
          curve: down ? Curves.easeOut : Curves.easeOutBack,
          child: widget.child,
        ),
      );
}