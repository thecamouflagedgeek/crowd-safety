import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import '../models/incident.dart';
import '../services/api_service.dart';
import '../theme.dart';
import 'guidance_screen.dart';

const _lime = Color(0xFFE2FF3B);
const _glass = Color(0xFF1B2B3F);

/// Incident number -> CCTV clip (bundled in assets/videos/).
const _byId = <String, String>{
  '001': 'protest1.mp4',
  '002': 'protest2.mp4',
  '003': 'traffic.mp4',
  '004': 'p2.mp4',
  '005': 'gv1.mp4',
};

class IncidentScreen extends StatefulWidget {
  final Incident i;

  /// Optional user GPS — passed through to the route screen so it can send real coords.
  final double? userLat;
  final double? userLon;

  const IncidentScreen(this.i, {super.key, this.userLat, this.userLon});

  @override
  State<IncidentScreen> createState() => _IncidentScreenState();
}

class _IncidentScreenState extends State<IncidentScreen> {
  /// Immediately shows list-payload data, then refreshes from the authoritative
  /// GET /incidents/{id} so severity, density and explanation are always fresh.
  late Incident i = widget.i;

  VideoPlayerController? vid;
  bool videoReady = false;
  bool showSource = false;

  @override
  void initState() {
    super.initState();
    initVideo();
    Api.incident(widget.i.id).then((fresh) {
      if (mounted && fresh != null) setState(() => i = fresh);
    });
  }

  /// Picks the clip by incident id (…001 → protest1, …002 → protest2, etc.).
  /// If the id isn't in the table, falls back to the incident type.
  String? videoFor(Incident x) {
  final id = x.id.toUpperCase();

  for (final e in _byId.entries) {
    if (id.endsWith(e.key)) {
      return e.value;
    }
  }

  final t = x.type.toLowerCase();

  if (t.contains('crowd') ||
      t.contains('protest') ||
      t.contains('rally')) {
    return _byId['001'];
  }

  if (t.contains('traffic') ||
      t.contains('accident')) {
    return _byId['003'];
  }

  if (t.contains('baggage')) {
    return _byId['005'];
  }

  return null;
}

  Future<void> initVideo() async {
  final fileName = videoFor(widget.i);

  if (fileName == null || fileName.isEmpty) {
    return;
  }

  final url = '${Api.base}/videos/$fileName';

  debugPrint('[VIDEO] Loading: $url');

  final ctl = VideoPlayerController.networkUrl(
    Uri.parse(url),
    videoPlayerOptions: VideoPlayerOptions(
      mixWithOthers: true,
    ),
  );

  vid = ctl;

  try {
    await ctl.initialize();

    await ctl.setVolume(0);
    await ctl.setLooping(true);
    await ctl.play();
    await ctl.setVolume(0);

    ctl.addListener(() {
      if (!mounted) return;

      if (ctl.value.volume != 0) {
        ctl.setVolume(0);
      }

      if (ctl.value.hasError) {
        debugPrint(
          '[VIDEO ERROR] ${ctl.value.errorDescription}',
        );
      }
    });

    if (mounted) {
      setState(() {
        videoReady = true;
      });
    }
  } catch (e) {
    debugPrint('[VIDEO ERROR] $e');

    if (mounted) {
      setState(() {
        videoReady = false;
      });
    }
  }
}

  @override
  void dispose() {
    vid?.dispose();
    super.dispose();
  }

  // ── Status pill (LIVE / DEMO / RECENT / PLANNED) ─────────────────────
  Widget statusPill() {
    final Color fg;
    final IconData icon;
    final String label;

    if (i.isLive) {
      fg = kGreen; icon = Icons.sensors; label = 'LIVE CCTV';
    } else if (i.isRecent) {
      fg = const Color(0xFFFFB347); icon = Icons.history_rounded; label = 'Recent';
    } else if (i.isDemo) {
      fg = const Color(0xFFAAB4FF); icon = Icons.science_outlined; label = 'Demo';
    } else if (i.status == 'PLANNED') {
      fg = const Color(0xFF64B5F6); icon = Icons.event_rounded; label = 'Planned';
    } else {
      fg = Colors.white70; icon = Icons.rss_feed_rounded; label = 'Seed feed';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: fg.withAlpha(36), borderRadius: BorderRadius.circular(20), border: Border.all(color: fg.withAlpha(90))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: fg),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 12, decoration: TextDecoration.none)),
      ]),
    );
  }

  String densityLabel() {
    final t = i.type.toLowerCase();
    if (t.contains('crowd') || t.contains('protest') || t.contains('rally')) return 'Crowd density';
    if (t.contains('traffic') || t.contains('transit') || t.contains('accident')) return 'Traffic density';
    return 'Area impact';
  }

  // ── Small metric card (density / movement) ───────────────────────────
  Widget metric({required String label, required Widget body}) {
    return _Glass(
      radius: 28,
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label.toUpperCase(),
            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: Colors.white54, decoration: TextDecoration.none)),
        const SizedBox(height: 8),
        body,
      ]),
    );
  }

  // ── Full-screen video background (cover-fit) ─────────────────────────
  Widget videoBackground() {
    final v = vid;
    return AnimatedOpacity(
      opacity: videoReady && v != null ? 1 : 0,
      duration: const Duration(milliseconds: 700),
      curve: Curves.easeOut,
      child: (videoReady && v != null)
          ? FittedBox(
              fit: BoxFit.cover,
              clipBehavior: Clip.hardEdge,
              child: SizedBox(
                width: v.value.size.width,
                height: v.value.size.height,
                child: VideoPlayer(v),
              ),
            )
          : const SizedBox.expand(),
    );
  }

  // ── CCTV overlay: REC chip, location, tap-for-source card ────────────
  Widget cctvOverlay() {
    final clip = (videoFor(widget.i) ?? '').split('/').last;
    final feed = i.isLive ? 'Live feed' : i.isRecent ? 'Recent event' : i.isDemo ? 'Demo scenario' : 'Seed feed';
    final cam = i.id.replaceAll(RegExp(r'[^0-9]'), '');
    final srcName = (i.sourceName != null && i.sourceName!.isNotEmpty) ? i.sourceName! : 'Simulated CCTV feed';

    Widget row(String k, String v) => Padding(
          padding: const EdgeInsets.only(top: 5),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(
              width: 50,
              child: Text(k, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white54, decoration: TextDecoration.none)),
            ),
            Expanded(
              child: Text(v, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Colors.white, decoration: TextDecoration.none)),
            ),
          ]),
        );

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => showSource = !showSource);
      },
      child: SizedBox(
        height: 220,
        child: Stack(children: [
          // REC chip (top left)
          Positioned(
            left: 6, top: 6,
            child: _Glass(
              radius: 20,
              padding: const EdgeInsets.fromLTRB(10, 7, 14, 7),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const _PulseDot(color: Color(0xFFE5484D), size: 8),
                const SizedBox(width: 6),
                Text('REC · CAM $cam',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: .6, color: Colors.white, decoration: TextDecoration.none)),
              ]),
            ),
          ),

          // location (bottom left)
          Positioned(
            left: 6, bottom: 8,
            child: Row(children: [
              const Icon(Icons.videocam_rounded, size: 15, color: Colors.white70),
              const SizedBox(width: 6),
              Text(i.location,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white70, decoration: TextDecoration.none)),
            ]),
          ),

          // "tap for source" hint (bottom right)
          Positioned(
            right: 6, bottom: 6,
            child: AnimatedOpacity(
              opacity: showSource ? 0 : 1,
              duration: const Duration(milliseconds: 250),
              child: Container(
                width: 30, height: 30,
                decoration: BoxDecoration(color: Colors.white.withAlpha(30), shape: BoxShape.circle),
                child: const Icon(Icons.info_outline_rounded, size: 17, color: Colors.white70),
              ),
            ),
          ),

          // source card (top right)
          Positioned(
            right: 6, top: 6,
            child: IgnorePointer(
              ignoring: !showSource,
              child: AnimatedScale(
                scale: showSource ? 1 : .85,
                alignment: Alignment.topRight,
                duration: const Duration(milliseconds: 380),
                curve: Curves.easeOutBack,
                child: AnimatedOpacity(
                  opacity: showSource ? 1 : 0,
                  duration: const Duration(milliseconds: 220),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 190),
                    child: _Glass(
                      radius: 22,
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                        Row(children: [
                          Container(
                            width: 22, height: 22,
                            decoration: const BoxDecoration(color: _lime, shape: BoxShape.circle),
                            child: const Icon(Icons.videocam_rounded, size: 13, color: kInk),
                          ),
                          const SizedBox(width: 8),
                          const Text('SOURCE',
                              style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: _lime, decoration: TextDecoration.none)),
                        ]),
                        const SizedBox(height: 8),
                        Text(srcName,
                            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, height: 1.2, color: Colors.white, decoration: TextDecoration.none)),
                        row('Camera', 'CAM $cam'),
                        if (clip.isNotEmpty) row('Clip', clip),
                        row('Type', feed),
                        row('Place', i.location),
                      ]),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext c) {
    final userLat = widget.userLat ?? Incident.refLat;
    final userLon = widget.userLon ?? Incident.refLon;
    final dist = i.distanceFrom(widget.userLat, widget.userLon);
    final distStr = dist >= 10 ? '${dist.toStringAsFixed(0)} km away' : '${dist.toStringAsFixed(1)} km away';
    final conf = i.confidence.clamp(0.0, 1.0).toDouble();
    final dens = (i.density / 100).clamp(0.0, 1.0).toDouble();
    final col = i.color;

    return Scaffold(
      backgroundColor: _glass,
      body: Stack(fit: StackFit.expand, children: [
        // fallback background (also visible while the video loads)
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter, end: Alignment.bottomCenter,
              colors: [Color.alphaBlend(col.withAlpha(120), const Color(0xFF2A3E55)), const Color(0xFF1B2B3F), const Color(0xFF141F2E)],
              stops: const [0, .45, 1],
            ),
          ),
        ),

        // the CCTV clip, playing (muted) behind everything
        videoBackground(),

        // tint + scrims: clip stays visible at the top, fades to dark so cards read cleanly
        IgnorePointer(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter, end: Alignment.bottomCenter,
                colors: [
                  _glass.withAlpha(150),
                  Color.alphaBlend(col.withAlpha(40), _glass.withAlpha(40)),
                  _glass.withAlpha(185),
                  _glass.withAlpha(240),
                ],
                stops: const [0, .30, .62, 1],
              ),
            ),
          ),
        ),

        SafeArea(
          child: Column(children: [
            // ── top bar ────────────────────────────────────────────────
            _Enter(
              dy: -24,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
                child: _Glass(
                  radius: 30,
                  padding: const EdgeInsets.all(7),
                  child: Row(children: [
                    _Press(
                      onTap: () => Navigator.pop(c),
                      child: Container(
                        width: 48, height: 48,
                        decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                        child: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: kInk),
                      ),
                    ),
                    Expanded(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Text('Incident',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Colors.white, decoration: TextDecoration.none)),
                        const SizedBox(height: 2),
                        Text(i.id, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 11.5, color: Colors.white60, decoration: TextDecoration.none)),
                      ]),
                    ),
                    statusPill(),
                    const SizedBox(width: 6),
                  ]),
                ),
              ),
            ),

            // ── scrolling content ──────────────────────────────────────
            Expanded(
              child: ListView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(14, 8, 14, 130),
                children: [
                  // window onto the clip (tap = source card)
                  _Enter(delay: 80, child: cctvOverlay()),

                  // title block
                  _Enter(
                    delay: 180,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(8, 4, 8, 18),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Container(
                            padding: const EdgeInsets.fromLTRB(10, 7, 14, 7),
                            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                            child: Row(mainAxisSize: MainAxisSize.min, children: [
                              _PulseDot(color: col, size: 8),
                              const SizedBox(width: 6),
                              Text('${i.severity.toUpperCase()} RISK',
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: kInk, decoration: TextDecoration.none)),
                            ]),
                          ),
                          if (i.riskScore != null) ...[
                            const SizedBox(width: 10),
                            Text('Risk score ${(i.riskScore! * 100).round()}%',
                                style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600, decoration: TextDecoration.none)),
                          ],
                        ]),
                        const SizedBox(height: 14),
                        Text(i.eventName,
                            style: const TextStyle(fontSize: 40, height: 1.04, fontWeight: FontWeight.w500, letterSpacing: -1.3, color: Colors.white, decoration: TextDecoration.none)),
                        if (i.eventName != i.type)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(i.type,
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: _lime.withAlpha(230), decoration: TextDecoration.none)),
                          ),
                        if (i.eventType.isNotEmpty && i.eventType != i.type && i.eventType != i.eventName)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(i.eventType, style: const TextStyle(fontSize: 13, color: Colors.white54, decoration: TextDecoration.none)),
                          ),
                        const SizedBox(height: 10),
                        Row(children: [
                          const Icon(Icons.place_rounded, size: 16, color: Colors.white60),
                          const SizedBox(width: 5),
                          Flexible(
                            child: Text('${i.location} · $distStr',
                                style: const TextStyle(color: Colors.white70, fontSize: 14.5, fontWeight: FontWeight.w500, decoration: TextDecoration.none)),
                          ),
                        ]),
                      ]),
                    ),
                  ),

                  // CV metrics: confidence ring + density + movement
                  _Enter(
                    delay: 300,
                    dy: 40,
                    child: IntrinsicHeight(
                      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        Expanded(
                          flex: 11,
                          child: _Glass(
                            radius: 30,
                            padding: const EdgeInsets.all(16),
                            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                              TweenAnimationBuilder<double>(
                                tween: Tween(begin: 0, end: conf),
                                duration: const Duration(milliseconds: 1500),
                                curve: Curves.easeOutCubic,
                                builder: (_, v, __) => SizedBox(
                                  width: 128, height: 128,
                                  child: CustomPaint(
                                    painter: _RingPainter(v, col),
                                    child: Center(
                                      child: Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                                        Text('${(v * 100).round()}',
                                            style: const TextStyle(fontSize: 38, fontWeight: FontWeight.w500, letterSpacing: -1.5, color: Colors.white, height: 1.05, decoration: TextDecoration.none)),
                                        const Padding(
                                          padding: EdgeInsets.only(top: 6),
                                          child: Text('%', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white70, decoration: TextDecoration.none)),
                                        ),
                                      ]),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 10),
                              const Text('CCTV CONFIDENCE',
                                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: Colors.white54, decoration: TextDecoration.none)),
                            ]),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 10,
                          child: Column(children: [
                            Expanded(
                              child: metric(
                                label: densityLabel(),
                                body: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text('${i.density.round()}%',
                                      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w500, letterSpacing: -1, color: Colors.white, height: 1, decoration: TextDecoration.none)),
                                  const SizedBox(height: 10),
                                  TweenAnimationBuilder<double>(
                                    tween: Tween(begin: 0, end: dens),
                                    duration: const Duration(milliseconds: 1400),
                                    curve: Curves.easeOutCubic,
                                    builder: (_, v, __) => ClipRRect(
                                      borderRadius: BorderRadius.circular(6),
                                      child: Stack(children: [
                                        Container(height: 8, color: Colors.white.withAlpha(30)),
                                        FractionallySizedBox(
                                          widthFactor: v,
                                          child: Container(
                                            height: 8,
                                            decoration: BoxDecoration(
                                              gradient: LinearGradient(colors: [_lime, col]),
                                              boxShadow: [BoxShadow(color: col.withAlpha(150), blurRadius: 8)],
                                            ),
                                          ),
                                        ),
                                      ]),
                                    ),
                                  ),
                                ]),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Expanded(
                              child: metric(
                                label: 'Movement',
                                body: Row(children: [
                                  Container(
                                    width: 30, height: 30,
                                    decoration: BoxDecoration(color: _lime.withAlpha(40), shape: BoxShape.circle),
                                    child: const Icon(Icons.speed_rounded, size: 17, color: _lime),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(i.movement,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white, height: 1.15, decoration: TextDecoration.none)),
                                  ),
                                ]),
                              ),
                            ),
                          ]),
                        ),
                      ]),
                    ),
                  ),

                  const SizedBox(height: 10),

                  // what this means
                  _Enter(
                    delay: 420,
                    dy: 40,
                    child: Container(
                      padding: const EdgeInsets.all(22),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(32),
                        boxShadow: [BoxShadow(color: Colors.black.withAlpha(50), blurRadius: 30, offset: const Offset(0, 12))],
                      ),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Container(
                            width: 34, height: 34,
                            decoration: BoxDecoration(color: col.withAlpha(36), shape: BoxShape.circle),
                            child: Icon(Icons.visibility_rounded, size: 18, color: col),
                          ),
                          const SizedBox(width: 10),
                          const Text('What this means',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17, letterSpacing: -.3, color: kInk, decoration: TextDecoration.none)),
                        ]),
                        const SizedBox(height: 12),
                        Text('${i.summary} near ${i.location}.',
                            style: const TextStyle(fontSize: 15.5, height: 1.45, fontWeight: FontWeight.w500, color: kInk, decoration: TextDecoration.none)),
                        if (i.explanation != null && i.explanation!.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Text(i.explanation!,
                              style: const TextStyle(fontSize: 13.5, color: Colors.black54, height: 1.4, decoration: TextDecoration.none)),
                        ],
                        if (i.sourceName != null && i.sourceName!.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          Row(children: [
                            const Icon(Icons.info_outline, size: 14, color: Colors.black38),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text('Source: ${i.sourceName}',
                                  style: const TextStyle(fontSize: 12, color: Colors.black38, decoration: TextDecoration.none)),
                            ),
                          ]),
                        ],
                      ]),
                    ),
                  ),

                  const SizedBox(height: 10),

                  // guidance
                  _Enter(
                    delay: 520,
                    dy: 40,
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: _lime,
                        borderRadius: BorderRadius.circular(32),
                        boxShadow: [BoxShadow(color: _lime.withAlpha(90), blurRadius: 28, offset: const Offset(0, 10))],
                      ),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 44, height: 44,
                          decoration: const BoxDecoration(color: kInk, shape: BoxShape.circle),
                          child: const Icon(Icons.tips_and_updates_rounded, color: _lime, size: 22),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('WHAT YOU SHOULD DO',
                                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: kInk.withAlpha(150), decoration: TextDecoration.none)),
                            const SizedBox(height: 5),
                            Text(i.guidance ?? i.action,
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, height: 1.35, letterSpacing: -.2, color: kInk, decoration: TextDecoration.none)),
                          ]),
                        ),
                      ]),
                    ),
                  ),
                ],
              ),
            ),
          ]),
        ),

        // ── floating actions ─────────────────────────────────────────────
        Positioned(
          left: 14, right: 14, bottom: 0,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: _Enter(
                delay: 620,
                dy: 70,
                child: _Glass(
                  radius: 40,
                  padding: const EdgeInsets.all(7),
                  child: Row(children: [
                    Expanded(
                      child: _Press(
                        onTap: () {
                          HapticFeedback.mediumImpact();
                          Navigator.push(
                            c,
                            MaterialPageRoute(builder: (_) => GuidanceScreen(i, userLat: userLat, userLon: userLon)),
                          );
                        },
                        child: Container(
                          height: 58,
                          padding: const EdgeInsets.fromLTRB(24, 0, 6, 0),
                          decoration: BoxDecoration(color: _lime, borderRadius: BorderRadius.circular(32)),
                          child: Row(children: [
                            const Text('Find Safe Route',
                                style: TextStyle(color: kInk, fontSize: 16.5, fontWeight: FontWeight.w800, letterSpacing: -.2, decoration: TextDecoration.none)),
                            const Spacer(),
                            Container(
                              width: 46, height: 46,
                              decoration: const BoxDecoration(color: kInk, shape: BoxShape.circle),
                              child: const Icon(Icons.alt_route_rounded, color: _lime, size: 21),
                            ),
                          ]),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    _Press(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        showChat(c, i);
                      },
                      child: Container(
                        width: 58, height: 58,
                        decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                        child: const Icon(Icons.chat_bubble_outline_rounded, color: kInk, size: 23),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Painters
// ═══════════════════════════════════════════════════════════════════════

/// Circular confidence gauge.
class _RingPainter extends CustomPainter {
  final double v;
  final Color color;
  _RingPainter(this.v, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(8, 8, size.width - 16, size.height - 16);
    canvas.drawArc(
      rect, 0, 2 * math.pi, false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 11
        ..color = Colors.white.withAlpha(26),
    );
    final sweep = 2 * math.pi * v;
    // soft glow under the arc
    canvas.drawArc(
      rect, -math.pi / 2, sweep, false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 16
        ..strokeCap = StrokeCap.round
        ..color = color.withAlpha(70)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );
    canvas.drawArc(
      rect, -math.pi / 2, sweep, false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 11
        ..strokeCap = StrokeCap.round
        ..color = _lime,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.v != v || old.color != color;
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
          scale: down ? .95 : 1,
          duration: Duration(milliseconds: down ? 110 : 320),
          curve: down ? Curves.easeOut : Curves.easeOutBack,
          child: widget.child,
        ),
      );
}

class _Enter extends StatefulWidget {
  final Widget child;
  final int delay;
  final double dy;
  const _Enter({required this.child, this.delay = 0, this.dy = 28});
  @override
  State<_Enter> createState() => _EnterState();
}

class _EnterState extends State<_Enter> with SingleTickerProviderStateMixin {
  late final AnimationController ctl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
  late final Animation<double> a = CurvedAnimation(parent: ctl, curve: Curves.easeOutCubic);

  @override
  void initState() {
    super.initState();
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) ctl.forward();
    });
  }

  @override
  void dispose() {
    ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: a,
        child: widget.child,
        builder: (_, child) => Opacity(
          opacity: a.value.clamp(0.0, 1.0),
          child: Transform.translate(offset: Offset(0, (1 - a.value) * widget.dy), child: child),
        ),
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