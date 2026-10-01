import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../theme.dart';

const _lime = Color(0xFFE2FF3B);
const _glass = Color(0xFF1B2B3F);

class VerifyScreen extends StatefulWidget {
  const VerifyScreen({super.key});
  @override
  State<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends State<VerifyScreen> {
  final ctl = TextEditingController(text: 'There is heavy crowd near Azad Maidan.');
  Map? res;
  bool busy = false;

  static const examples = [
    'There is heavy crowd near Azad Maidan.',
    'Gate 3 is completely closed.',
    'Accident at Marine Drive Junction.',
    'Unattended bag at CSMT platform.',
  ];

  Future<void> run() async {
    final claim = ctl.text.trim();
    if (claim.isEmpty || busy) return;
    HapticFeedback.mediumImpact();
    FocusScope.of(context).unfocus();
    setState(() { busy = true; res = null; });
    Map? r;
    try {
      r = await Api.verify(
        claim,
        location: _locationForClaim(claim),
        url: _urlForClaim(claim),
      );
    } catch (_) {
      r = {'status': 'UNVERIFIED', 'confidence': 0.0, 'supporting_sources': []};
    }
    if (mounted) setState(() { res = r; busy = false; });
  }

  /// A pasted link/reel is forwarded to the backend for the record. It is never
  /// treated as proof — the backend decides the verdict from real evidence.
  String? _urlForClaim(String claim) =>
      RegExp(r'https?://\S+').firstMatch(claim)?.group(0);

  String? _locationForClaim(String claim) {
    final lower = claim.toLowerCase();
    if (lower.contains('azad maidan')) return 'Azad Maidan';
    if (lower.contains('girgaum') || lower.contains('chowpatty')) return 'Girgaum Chowpatty';
    if (lower.contains('lalbaug')) return 'Lalbaug';
    if (lower.contains('marine drive') || lower.contains('junction')) return 'Marine Drive Junction';
    if (lower.contains('csmt') || lower.contains('platform')) return 'CSMT';
    if (lower.contains('dadar')) return 'Dadar West';
    if (lower.contains('bandra')) return 'Bandra Station';
    if (lower.contains('ncpa') || lower.contains('nariman')) return 'NCPA, Nariman Point';
    if (lower.contains('gate 3') || lower.contains('gate3')) return 'Gate 3';
    if (lower.contains('gate 5') || lower.contains('gate5')) return 'Gate 5';
    return null;
  }

  @override
  void dispose() {
    ctl.dispose();
    super.dispose();
  }

  static IconData _iconForStatus(String s) {
    if (s == 'VERIFIED') return Icons.verified_rounded;
    if (s == 'UNDER_VALIDATION') return Icons.hourglass_top_rounded;
    return Icons.gpp_maybe_rounded;
  }

  static Color _colorForStatus(String s) {
    if (s == 'VERIFIED') return kGreen;
    if (s == 'UNDER_VALIDATION') return kAmber;
    return kRed;
  }

  static String _titleForStatus(String s) {
    if (s == 'VERIFIED') return 'Verified';
    if (s == 'UNDER_VALIDATION') return 'Under validation';
    return 'Unverified';
  }

  // ── Evidence tile: 0 = none, 1 = partial, 2 = confirmed ─────────────
  Widget evidence(IconData icon, String label, int state) {
    final Color bg, fg;
    final IconData mark;
    final String txt;
    if (state == 2) {
      bg = _lime; fg = kInk; mark = Icons.check_rounded; txt = 'Confirmed';
    } else if (state == 1) {
      bg = const Color(0xFFFFE3A3); fg = kInk; mark = Icons.remove_rounded; txt = 'Reported only';
    } else {
      bg = const Color(0xFFF0F2F4); fg = Colors.black45; mark = Icons.close_rounded; txt = 'No evidence';
    }
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: const Color(0xFFF7F8FA), borderRadius: BorderRadius.circular(24)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 38, height: 38,
            decoration: const BoxDecoration(color: kInk, shape: BoxShape.circle),
            child: Icon(icon, size: 19, color: _lime),
          ),
          const Spacer(),
          Container(
            width: 26, height: 26,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            child: Icon(mark, size: 16, color: fg),
          ),
        ]),
        const SizedBox(height: 12),
        Text(label, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: kInk, decoration: TextDecoration.none)),
        const SizedBox(height: 2),
        Text(txt, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: state == 0 ? Colors.black38 : Colors.black54, decoration: TextDecoration.none)),
      ]),
    );
  }

  Widget sectionLabel(String t) => Padding(
        padding: const EdgeInsets.fromLTRB(8, 22, 8, 10),
        child: Text(t.toUpperCase(),
            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: Colors.white60, decoration: TextDecoration.none)),
      );

  Widget exampleChip(String t) {
    return _Press(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() { ctl.text = t; res = null; });
      },
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(24),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: Colors.white.withAlpha(40)),
        ),
        child: Text(t, style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w600, decoration: TextDecoration.none)),
      ),
    );
  }

  Widget resultCards() {
    final status = res?['status']?.toString() ?? 'UNVERIFIED';
    final col = _colorForStatus(status);
    final conf = ((res?['confidence'] is num) ? (res!['confidence'] as num).toDouble() : 0.0).clamp(0.0, 1.0).toDouble();
    final sources = res?['supporting_sources'];
    final sourceList = sources is List ? sources : <dynamic>[];
    final labels = [
      for (final s in sourceList)
        ((s is Map) ? (s['label'] ?? s['id'] ?? '') : s).toString()
    ];
    final lower = labels.map((e) => e.toLowerCase()).toList();
    bool has(List<String> k) => lower.any((l) => k.any(l.contains));
    final impact = res?['impact']?.toString() ?? '';
    final severity = res?['severity']?.toString() ?? '';
    final incidentId = res?['incident_id']?.toString();
    final location = res?['location']?.toString();
    final newsCount = (res?['corroborating_news'] is List) ? (res!['corroborating_news'] as List).length : 0;

    final cctv = has(['cctv', 'camera', 'cam ']) ? 2 : 0;
    final citizen = has(['citizen', 'report']) ? 2 : 0;
    final official = has(['official', 'authority', 'police', 'bmc', 'event']) ? 2 : 0;
    final news = has(['news']) ? 2 : (newsCount > 0 ? 1 : 0);

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // verdict hero
      _Rise(
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(34),
            boxShadow: [BoxShadow(color: Colors.black.withAlpha(50), blurRadius: 30, offset: const Offset(0, 12))],
          ),
          child: Row(children: [
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: conf),
              duration: const Duration(milliseconds: 1300),
              curve: Curves.easeOutCubic,
              builder: (_, v, __) => SizedBox(
                width: 112, height: 112,
                child: CustomPaint(
                  painter: _RingPainter(v, col),
                  child: Center(
                    child: Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${(v * 100).round()}',
                          style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w500, letterSpacing: -1.2, color: kInk, height: 1.1, decoration: TextDecoration.none)),
                      const Padding(
                        padding: EdgeInsets.only(top: 5),
                        child: Text('%', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.black45, decoration: TextDecoration.none)),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  padding: const EdgeInsets.fromLTRB(8, 5, 12, 5),
                  decoration: BoxDecoration(color: col.withAlpha(30), borderRadius: BorderRadius.circular(18)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(_iconForStatus(status), size: 16, color: col),
                    const SizedBox(width: 5),
                    Text(status.replaceAll('_', ' '),
                        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: col, decoration: TextDecoration.none)),
                  ]),
                ),
                const SizedBox(height: 10),
                Text(_titleForStatus(status),
                    style: const TextStyle(fontSize: 30, height: 1.05, fontWeight: FontWeight.w500, letterSpacing: -1, color: kInk, decoration: TextDecoration.none)),
                const SizedBox(height: 6),
                Text(
                  [if (severity.isNotEmpty) '$severity severity', location ?? 'Mumbai'].join(' · '),
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Colors.black54, decoration: TextDecoration.none),
                ),
                if (incidentId != null && incidentId.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: kInk, borderRadius: BorderRadius.circular(12)),
                    child: Text('Linked · $incidentId',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _lime, decoration: TextDecoration.none)),
                  ),
                ],
              ]),
            ),
          ]),
        ),
      ),

      // evidence grid
      sectionLabel('Evidence check'),
      _Rise(
        delay: 120,
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(34)),
          child: Column(children: [
            Row(children: [
              Expanded(child: evidence(Icons.videocam_rounded, 'CCTV', cctv)),
              const SizedBox(width: 10),
              Expanded(child: evidence(Icons.groups_rounded, 'Citizen reports', citizen)),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: evidence(Icons.account_balance_rounded, 'Official source', official)),
              const SizedBox(width: 10),
              Expanded(child: evidence(Icons.newspaper_rounded, 'News', news)),
            ]),
          ]),
        ),
      ),

      // impact
      if (impact.isNotEmpty) ...[
        const SizedBox(height: 12),
        _Rise(
          delay: 220,
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: _lime,
              borderRadius: BorderRadius.circular(30),
              boxShadow: [BoxShadow(color: _lime.withAlpha(80), blurRadius: 26, offset: const Offset(0, 10))],
            ),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 42, height: 42,
                decoration: const BoxDecoration(color: kInk, shape: BoxShape.circle),
                child: const Icon(Icons.tips_and_updates_rounded, size: 21, color: _lime),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('WHAT THIS MEANS',
                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: kInk.withAlpha(150), decoration: TextDecoration.none)),
                  const SizedBox(height: 4),
                  Text(impact,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, height: 1.35, color: kInk, decoration: TextDecoration.none)),
                ]),
              ),
            ]),
          ),
        ),
      ],

      // sources
      sectionLabel('Supporting sources'),
      _Rise(
        delay: 300,
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(30)),
          child: labels.isNotEmpty
              ? Column(children: [
                  for (int n = 0; n < labels.length; n++)
                    Padding(
                      padding: EdgeInsets.only(top: n == 0 ? 0 : 12),
                      child: Row(children: [
                        Container(
                          width: 32, height: 32,
                          decoration: BoxDecoration(color: _lime, shape: BoxShape.circle),
                          child: const Icon(Icons.check_rounded, size: 18, color: kInk),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(labels[n],
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: kInk, decoration: TextDecoration.none)),
                        ),
                      ]),
                    ),
                ])
              : Row(children: [
                  Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(color: kRed.withAlpha(30), shape: BoxShape.circle),
                    child: const Icon(Icons.close_rounded, size: 18, color: kRed),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text('No supporting sources found for this claim.',
                        style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: Colors.black54, decoration: TextDecoration.none)),
                  ),
                ]),
        ),
      ),
      if (newsCount > 0)
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 12, 10, 0),
          child: Text('$newsCount live news items consulted (reported only, not proof on their own).',
              style: const TextStyle(color: Colors.white54, fontSize: 12, height: 1.35, decoration: TextDecoration.none)),
        ),
    ]);
  }

  @override
  Widget build(BuildContext c) {
    final hasUrl = _urlForClaim(ctl.text) != null;
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter, end: Alignment.bottomCenter,
          colors: [Color(0xFF56708A), Color(0xFF3B5268), Color(0xFF1B2B3F)],
          stops: [0, .45, 1],
        ),
      ),
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
                    padding: const EdgeInsets.fromLTRB(10, 7, 14, 7),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                    child: const Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.fact_check_rounded, size: 16, color: kInk),
                      SizedBox(width: 6),
                      Text('Fact check', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: kInk, decoration: TextDecoration.none)),
                    ]),
                  ),
                  const SizedBox(height: 14),
                  const Text('Is it\nreally true?',
                      style: TextStyle(fontSize: 42, height: 1.04, fontWeight: FontWeight.w500, letterSpacing: -1.4, color: Colors.white, decoration: TextDecoration.none)),
                  const SizedBox(height: 10),
                  Text('Paste a claim or link. We check CCTV, official and news evidence before calling it true.',
                      style: TextStyle(color: Colors.white.withAlpha(200), fontSize: 14, height: 1.4, fontWeight: FontWeight.w500, decoration: TextDecoration.none)),
                ]),
              ),
            ),

            // input card
            const SizedBox(height: 16),
            _Rise(
              delay: 100,
              child: _Glass(
                radius: 32,
                padding: const EdgeInsets.all(8),
                child: Column(children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                    child: Row(children: [
                      const Icon(Icons.edit_note_rounded, size: 18, color: Colors.white54),
                      const SizedBox(width: 6),
                      const Text('CLAIM',
                          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: Colors.white54, decoration: TextDecoration.none)),
                      const Spacer(),
                      if (hasUrl)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                          decoration: BoxDecoration(color: _lime.withAlpha(40), borderRadius: BorderRadius.circular(10)),
                          child: const Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.link_rounded, size: 13, color: _lime),
                            SizedBox(width: 4),
                            Text('Link detected', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: _lime, decoration: TextDecoration.none)),
                          ]),
                        ),
                    ]),
                  ),
                  TextField(
                    controller: ctl,
                    maxLines: 3,
                    cursorColor: _lime,
                    onChanged: (_) => setState(() {}),
                    style: const TextStyle(color: Colors.white, fontSize: 16, height: 1.35, fontWeight: FontWeight.w600),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      hintText: 'e.g. "Gate 3 is completely closed"',
                      hintStyle: TextStyle(color: Colors.white38),
                      contentPadding: EdgeInsets.fromLTRB(14, 10, 14, 12),
                    ),
                  ),
                  _Press(
                    onTap: run,
                    child: Container(
                      height: 60,
                      padding: const EdgeInsets.fromLTRB(26, 0, 7, 0),
                      decoration: BoxDecoration(
                        color: _lime,
                        borderRadius: BorderRadius.circular(30),
                        boxShadow: [BoxShadow(color: _lime.withAlpha(busy ? 40 : 100), blurRadius: 24, offset: const Offset(0, 8))],
                      ),
                      child: Row(children: [
                        Text(busy ? 'Checking sources…' : 'Verify claim',
                            style: const TextStyle(color: kInk, fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: -.2, decoration: TextDecoration.none)),
                        const Spacer(),
                        Container(
                          width: 46, height: 46,
                          decoration: const BoxDecoration(color: kInk, shape: BoxShape.circle),
                          child: busy
                              ? const Padding(padding: EdgeInsets.all(13), child: CircularProgressIndicator(color: _lime, strokeWidth: 2.4))
                              : const Icon(Icons.arrow_forward_rounded, color: _lime, size: 22),
                        ),
                      ]),
                    ),
                  ),
                ]),
              ),
            ),

            // examples
            const SizedBox(height: 14),
            _Rise(
              delay: 180,
              child: SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.only(left: 6),
                  children: [for (final e in examples) exampleChip(e)],
                ),
              ),
            ),

            // result
            if (res != null) ...[
              const SizedBox(height: 18),
              resultCards(),
            ] else if (!busy) ...[
              sectionLabel('How it works'),
              _Rise(
                delay: 260,
                child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(30)),
                  child: Column(children: [
                    for (final s in const [
                      (Icons.videocam_rounded, 'CCTV analysis', 'Matches your claim to live computer-vision detections.'),
                      (Icons.account_balance_rounded, 'Official sources', 'Checks authority advisories and event records.'),
                      (Icons.newspaper_rounded, 'News & reports', 'Counts as reported only, never as proof by itself.'),
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
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Painter + helpers (private to this file)
// ═══════════════════════════════════════════════════════════════════════

class _RingPainter extends CustomPainter {
  final double v;
  final Color color;
  _RingPainter(this.v, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(8, 8, size.width - 16, size.height - 16);
    canvas.drawArc(rect, 0, 2 * math.pi, false,
        Paint()..style = PaintingStyle.stroke..strokeWidth = 10..color = Colors.black.withAlpha(18));
    final sweep = 2 * math.pi * v;
    canvas.drawArc(rect, -math.pi / 2, sweep, false,
        Paint()..style = PaintingStyle.stroke..strokeWidth = 14..strokeCap = StrokeCap.round
          ..color = color.withAlpha(60)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 7));
    canvas.drawArc(rect, -math.pi / 2, sweep, false,
        Paint()..style = PaintingStyle.stroke..strokeWidth = 10..strokeCap = StrokeCap.round..color = color);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.v != v || old.color != color;
}

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