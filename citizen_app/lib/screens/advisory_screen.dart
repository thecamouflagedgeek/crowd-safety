import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../theme.dart';

const _lime = Color(0xFFE2FF3B);
const _glass = Color(0xFF1B2B3F);

class AdvisoryScreen extends StatefulWidget {
  const AdvisoryScreen({super.key});
  @override
  State<AdvisoryScreen> createState() => _AdvisoryScreenState();
}

class _AdvisoryScreenState extends State<AdvisoryScreen> {
  List<Map>? items;
  Timer? timer;
  String filter = 'All';
  DateTime? updated;

  void load() => Api.advisories().then((v) {
        if (mounted) setState(() { items = v; updated = DateTime.now(); });
      }).catchError((_) {
        if (mounted) setState(() => items ??= <Map>[]);
      });

  @override
  void initState() {
    super.initState();
    load();
    timer = Timer.periodic(const Duration(seconds: 10), (_) => load()); // polling
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  // ── helpers ──────────────────────────────────────────────────────────
  static String sevOf(Map a) {
    final s = (a['severity'] ?? '').toString().toUpperCase();
    if (s == 'CRITICAL') return 'HIGH';
    return s;
  }

  static Color sevColor(String s) {
    if (s == 'HIGH') return kRed;
    if (s == 'MEDIUM') return kAmber;
    return kGreen;
  }

  static String msgOf(Map a) => (a['message'] ?? a['title'] ?? 'Advisory').toString();
  static String byOf(Map a) => (a['issued_by'] ?? a['source'] ?? 'Authority').toString();
  static String timeOf(Map a) => (a['timestamp'] ?? a['time'] ?? '').toString();

  List<Map> get shown {
    final all = items ?? <Map>[];
    if (filter == 'All') return all;
    return all.where((a) {
      final s = sevOf(a);
      if (filter == 'High') return s == 'HIGH';
      if (filter == 'Medium') return s == 'MEDIUM';
      return s != 'HIGH' && s != 'MEDIUM';
    }).toList();
  }

  // ── pieces ───────────────────────────────────────────────────────────
  Widget statTile(String value, String label, IconData icon, {bool accent = false}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: accent ? _lime : Colors.white,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [BoxShadow(color: (accent ? _lime : Colors.black).withAlpha(accent ? 80 : 25), blurRadius: 20, offset: const Offset(0, 8))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 34, height: 34,
            decoration: BoxDecoration(color: accent ? kInk : const Color(0xFFF0F2F4), shape: BoxShape.circle),
            child: Icon(icon, size: 18, color: accent ? _lime : kInk),
          ),
          const SizedBox(height: 12),
          Text(value, style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w500, letterSpacing: -1, height: 1, color: kInk, decoration: TextDecoration.none)),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kInk.withAlpha(150), decoration: TextDecoration.none)),
        ]),
      ),
    );
  }

  Widget chip(String label) {
    final on = filter == label;
    return _Press(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => filter = label);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
        decoration: BoxDecoration(
          color: on ? _lime : _glass.withAlpha(165),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withAlpha(on ? 0 : 38)),
          boxShadow: on ? [BoxShadow(color: _lime.withAlpha(90), blurRadius: 18, offset: const Offset(0, 4))] : null,
        ),
        child: Text(label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: on ? kInk : Colors.white, decoration: TextDecoration.none)),
      ),
    );
  }

  Widget sectionLabel(String t) => Padding(
        padding: const EdgeInsets.fromLTRB(8, 22, 8, 10),
        child: Text(t.toUpperCase(),
            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: Colors.white60, decoration: TextDecoration.none)),
      );

  Widget issuer(Map a, {bool dark = false}) {
    return Row(children: [
      Container(
        width: 26, height: 26,
        decoration: const BoxDecoration(color: kInk, shape: BoxShape.circle),
        child: const Icon(Icons.verified_rounded, size: 15, color: _lime),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Text('Issued by ${byOf(a)}',
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: dark ? Colors.white70 : Colors.black54, decoration: TextDecoration.none)),
      ),
      if (timeOf(a).isNotEmpty) ...[
        Icon(Icons.schedule_rounded, size: 14, color: dark ? Colors.white54 : Colors.black38),
        const SizedBox(width: 4),
        Text(timeOf(a), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: dark ? Colors.white54 : Colors.black45, decoration: TextDecoration.none)),
      ],
    ]);
  }

  Widget sevBadge(String sev, Color col) {
    if (sev.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 5, 12, 5),
      decoration: BoxDecoration(color: col.withAlpha(30), borderRadius: BorderRadius.circular(18)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        _PulseDot(color: col, size: 6),
        const SizedBox(width: 4),
        Text('$sev SEVERITY', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: .4, color: col, decoration: TextDecoration.none)),
      ]),
    );
  }

  // big card for the newest advisory
  Widget featured(Map a) {
    final sev = sevOf(a);
    final col = sevColor(sev);
    final loc = a['location']?.toString() ?? '';
    final id = a['id']?.toString() ?? '';
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(36),
        boxShadow: [BoxShadow(color: Colors.black.withAlpha(50), blurRadius: 30, offset: const Offset(0, 12))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // coloured header strip
        Container(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [col, col.withAlpha(190)], begin: Alignment.topLeft, end: Alignment.bottomRight),
          ),
          child: Row(children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(color: Colors.white.withAlpha(50), shape: BoxShape.circle),
              child: const Icon(Icons.campaign_rounded, color: Colors.white, size: 24),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text('OFFICIAL SAFETY ADVISORY',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12.5, letterSpacing: 1.1, decoration: TextDecoration.none)),
            ),
            if (id.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: Colors.black.withAlpha(40), borderRadius: BorderRadius.circular(12)),
                child: Text(id, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 11, decoration: TextDecoration.none)),
              ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(msgOf(a),
                style: const TextStyle(fontSize: 24, height: 1.2, fontWeight: FontWeight.w500, letterSpacing: -.6, color: kInk, decoration: TextDecoration.none)),
            const SizedBox(height: 14),
            Wrap(spacing: 8, runSpacing: 8, children: [
              sevBadge(sev, col),
              if (loc.isNotEmpty)
                Container(
                  padding: const EdgeInsets.fromLTRB(8, 5, 12, 5),
                  decoration: BoxDecoration(color: const Color(0xFFF0F2F4), borderRadius: BorderRadius.circular(18)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.place_rounded, size: 14, color: Colors.black54),
                    const SizedBox(width: 4),
                    Text(loc, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.black54, decoration: TextDecoration.none)),
                  ]),
                ),
            ]),
            const SizedBox(height: 16),
            Container(height: 1, color: Colors.black.withAlpha(14)),
            const SizedBox(height: 14),
            issuer(a),
          ]),
        ),
      ]),
    );
  }

  // timeline row for older advisories
  Widget timelineRow(Map a, bool last) {
    final sev = sevOf(a);
    final col = sevColor(sev);
    final loc = a['location']?.toString() ?? '';
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(
          width: 34,
          child: Column(children: [
            Container(
              width: 34, height: 34,
              decoration: BoxDecoration(color: col, shape: BoxShape.circle, boxShadow: [BoxShadow(color: col.withAlpha(110), blurRadius: 12)]),
              child: const Icon(Icons.campaign_rounded, size: 18, color: Colors.white),
            ),
            if (!last) Expanded(child: Container(width: 2, margin: const EdgeInsets.symmetric(vertical: 4), color: Colors.white24)),
          ]),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: last ? 0 : 12),
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(msgOf(a), style: const TextStyle(fontSize: 16.5, height: 1.3, fontWeight: FontWeight.w700, letterSpacing: -.2, color: kInk, decoration: TextDecoration.none)),
                const SizedBox(height: 10),
                Wrap(spacing: 8, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                  sevBadge(sev, col),
                  if (loc.isNotEmpty)
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.place_rounded, size: 14, color: Colors.black38),
                      const SizedBox(width: 3),
                      Text(loc, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Colors.black54, decoration: TextDecoration.none)),
                    ]),
                ]),
                const SizedBox(height: 12),
                issuer(a),
              ]),
            ),
          ),
        ),
      ]),
    );
  }

  Widget allClear() {
    return Container(
      padding: const EdgeInsets.all(26),
      decoration: BoxDecoration(
        color: _lime,
        borderRadius: BorderRadius.circular(36),
        boxShadow: [BoxShadow(color: _lime.withAlpha(90), blurRadius: 30, offset: const Offset(0, 12))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 56, height: 56,
          decoration: const BoxDecoration(color: kInk, shape: BoxShape.circle),
          child: const Icon(Icons.shield_rounded, size: 28, color: _lime),
        ),
        const SizedBox(height: 18),
        const Text("You're all clear", style: TextStyle(fontSize: 32, fontWeight: FontWeight.w500, letterSpacing: -1, height: 1.05, color: kInk, decoration: TextDecoration.none)),
        const SizedBox(height: 8),
        Text(
          filter == 'All'
              ? 'No active advisories right now. CCTV monitoring continues and new official alerts will appear here automatically.'
              : 'No $filter severity advisories at the moment.',
          style: TextStyle(fontSize: 14.5, height: 1.4, fontWeight: FontWeight.w500, color: kInk.withAlpha(190), decoration: TextDecoration.none),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext c) {
    final bg = const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topCenter, end: Alignment.bottomCenter,
        colors: [Color(0xFF56708A), Color(0xFF3B5268), Color(0xFF1B2B3F)],
        stops: [0, .45, 1],
      ),
    );

    if (items == null) {
      return Container(
        decoration: bg,
        child: const Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            SizedBox(width: 34, height: 34, child: CircularProgressIndicator(color: _lime, strokeWidth: 3)),
            SizedBox(height: 16),
            Text('Checking official channels…', style: TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w500, decoration: TextDecoration.none)),
          ]),
        ),
      );
    }

    final all = items!;
    final list = shown;
    final high = all.where((a) => sevOf(a) == 'HIGH').length;
    final u = updated;
    final upd = u == null ? '' : '${u.hour.toString().padLeft(2, '0')}:${u.minute.toString().padLeft(2, '0')}';

    return Container(
      decoration: bg,
      child: SafeArea(
        bottom: false,
        child: ListView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 130),
          children: [
            // header
            _Rise(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    padding: const EdgeInsets.fromLTRB(8, 7, 14, 7),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                    child: const Row(mainAxisSize: MainAxisSize.min, children: [
                      _PulseDot(color: Color(0xFFE5484D), size: 8),
                      SizedBox(width: 6),
                      Text('Live · Official', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: kInk, decoration: TextDecoration.none)),
                    ]),
                  ),
                  const SizedBox(height: 14),
                  const Text('Official\nalerts',
                      style: TextStyle(fontSize: 42, height: 1.04, fontWeight: FontWeight.w500, letterSpacing: -1.4, color: Colors.white, decoration: TextDecoration.none)),
                  const SizedBox(height: 10),
                  Text('Verified updates published by the authorities, straight from the control room.',
                      style: TextStyle(color: Colors.white.withAlpha(200), fontSize: 14, height: 1.4, fontWeight: FontWeight.w500, decoration: TextDecoration.none)),
                ]),
              ),
            ),

            // stats
            const SizedBox(height: 16),
            _Rise(
              delay: 100,
              child: IntrinsicHeight(
                child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  statTile('${all.length}', 'Active advisories', Icons.campaign_rounded, accent: true),
                  const SizedBox(width: 10),
                  statTile('$high', 'High severity', Icons.warning_amber_rounded),
                ]),
              ),
            ),

            // sync strip
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 12, 10, 0),
              child: Row(children: [
                const _PulseDot(color: _lime, size: 6),
                const SizedBox(width: 6),
                Text(upd.isEmpty ? 'Auto-refreshing every 10 s' : 'Synced $upd · refreshes every 10 s',
                    style: const TextStyle(color: Colors.white54, fontSize: 12, fontWeight: FontWeight.w600, decoration: TextDecoration.none)),
              ]),
            ),

            // filters
            const SizedBox(height: 14),
            _Rise(
              delay: 160,
              child: SizedBox(
                height: 44,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.only(left: 6),
                  children: [for (final f in const ['All', 'High', 'Medium', 'Low']) chip(f)],
                ),
              ),
            ),

            if (list.isEmpty) ...[
              const SizedBox(height: 18),
              _Rise(delay: 220, child: allClear()),
            ] else ...[
              sectionLabel('Latest advisory'),
              _Rise(delay: 220, child: featured(list.first)),
              if (list.length > 1) ...[
                sectionLabel('Earlier updates'),
                for (int n = 1; n < list.length; n++)
                  _Rise(delay: 300 + (n * 70).clamp(0, 420), child: timelineRow(list[n], n == list.length - 1)),
              ],
            ],

            // how it works
            sectionLabel('How alerts reach you'),
            _Rise(
              delay: 360,
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(30)),
                child: Column(children: [
                  for (final s in const [
                    (Icons.videocam_rounded, 'Detected', 'Computer vision flags a risk on CCTV.'),
                    (Icons.fact_check_rounded, 'Validated', 'Authorities review the evidence and sources.'),
                    (Icons.campaign_rounded, 'Published', 'Only validated advisories appear on this page.'),
                  ])
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 7),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 40, height: 40,
                          decoration: const BoxDecoration(color: kInk, shape: BoxShape.circle),
                          child: Icon(s.$1, size: 19, color: _lime),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(s.$2, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: kInk, decoration: TextDecoration.none)),
                            const SizedBox(height: 2),
                            Text(s.$3, style: const TextStyle(fontSize: 12.5, height: 1.35, color: Colors.black54, fontWeight: FontWeight.w500, decoration: TextDecoration.none)),
                          ]),
                        ),
                      ]),
                    ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Helpers (private to this file)
// ═══════════════════════════════════════════════════════════════════════

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
          scale: down ? .94 : 1,
          duration: Duration(milliseconds: down ? 110 : 320),
          curve: down ? Curves.easeOut : Curves.easeOutBack,
          child: widget.child,
        ),
      );
}

/// Fade + rise entrance (plays once when the widget is first built).
class _Rise extends StatelessWidget {
  final Widget child;
  final int delay;
  const _Rise({required this.child, this.delay = 0});
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: Duration(milliseconds: 600 + delay),
        curve: Interval(delay / (600 + delay), 1, curve: Curves.easeOutCubic),
        builder: (_, t, c) => Opacity(
          opacity: t.clamp(0.0, 1.0),
          child: Transform.translate(offset: Offset(0, 28 * (1 - t)), child: c),
        ),
        child: child,
      );
}

class _PulseDot extends StatefulWidget {
  final Color color;
  final double size;
  const _PulseDot({required this.color, this.size = 9});
  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot> with SingleTickerProviderStateMixin {
  late final AnimationController ctl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))..repeat();
  @override
  void dispose() {
    ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.size;
    return SizedBox(
      width: s * 2.4, height: s * 2.4,
      child: AnimatedBuilder(
        animation: ctl,
        builder: (_, __) => Stack(alignment: Alignment.center, children: [
          Container(
            width: s * (1 + 1.4 * ctl.value), height: s * (1 + 1.4 * ctl.value),
            decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color.withAlpha(((1 - ctl.value) * 110).toInt())),
          ),
          Container(width: s, height: s, decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color)),
        ]),
      ),
    );
  }
}