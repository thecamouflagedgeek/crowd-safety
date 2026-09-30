import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../models/incident.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../widgets/incident_card.dart';
import '../widgets/map_view.dart';
import 'incident_screen.dart';

// ── Visual tokens (local to this screen) ───────────────────────────────
const _lime = Color(0xFFE2FF3B);
const _glass = Color(0xFF1B2B3F);

class HomeScreen extends StatefulWidget {
  final bool listMode; // Explore tab = list of all incidents
  const HomeScreen({super.key, this.listMode = false});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final map = MapController();
  final pager = PageController(viewportFraction: .92);
  final searchCtl = TextEditingController();
  List<Incident> all = [];
  int sel = 0;
  String filter = 'All';
  bool searching = false;
  String query = '';

  List<Incident> get items => all
      .where((i) => filter == 'All' || i.type.contains(filter))
      .where((i) => query.isEmpty || i.type.toLowerCase().contains(query))
      .toList();

  @override
  void initState() {
    super.initState();
    Api.incidents().then((v) {
      if (mounted) setState(() => all = v..sort((a, b) => a.distance.compareTo(b.distance)));
    });
  }

  @override
  void dispose() {
    searchCtl.dispose();
    pager.dispose();
    super.dispose();
  }

  void open(Incident i) => Navigator.push(context, MaterialPageRoute(builder: (_) => IncidentScreen(i)));

  void focus(int n) {
    if (n >= items.length) return;
    setState(() => sel = n);
    map.move(LatLng(items[n].lat - .004, items[n].lon), 13.6); // offset so marker sits above the card
  }

  void resetPager() {
    if (items.isNotEmpty && pager.hasClients) {
      pager.jumpToPage(0);
      focus(0);
    }
  }

  // ── Filter chip: lime when active, smoked glass when not ─────────────
  Widget chip(String label, IconData icon) {
    final on = filter == label;
    return _Press(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() { filter = label; sel = 0; });
        resetPager();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: on ? _lime : _glass.withAlpha(165),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withAlpha(on ? 0 : 38)),
          boxShadow: on ? [BoxShadow(color: _lime.withAlpha(90), blurRadius: 18, offset: const Offset(0, 4))] : null,
        ),
        child: Row(children: [
          Icon(icon, size: 16, color: on ? kInk : Colors.white),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: on ? kInk : Colors.white, decoration: TextDecoration.none)),
        ]),
      ),
    );
  }

  // ── Top bar: avatar · centered city · round search (expands to a field) ─
  Widget topBar() {
    return _Glass(
      radius: 30,
      padding: const EdgeInsets.all(7),
      child: Row(children: [
        Container(
          width: 48, height: 48,
          decoration: BoxDecoration(
            color: _lime, shape: BoxShape.circle,
            boxShadow: [BoxShadow(color: _lime.withAlpha(90), blurRadius: 14)],
          ),
          child: const Icon(Icons.person_rounded, color: kInk, size: 24),
        ),
        Expanded(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 280),
            child: searching
                ? Padding(
                    key: const ValueKey('field'),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: TextField(
                      controller: searchCtl,
                      autofocus: true,
                      cursorColor: _lime,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        isDense: true,
                        hintText: 'Search crowd, traffic, baggage…',
                        hintStyle: TextStyle(color: Colors.white38, fontSize: 14),
                      ),
                      onChanged: (v) {
                        setState(() { query = v.trim().toLowerCase(); sel = 0; });
                        resetPager();
                      },
                    ),
                  )
                : const Column(
                    key: ValueKey('label'),
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Andheri',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Colors.white, decoration: TextDecoration.none)),
                      SizedBox(height: 2),
                      Text('Mumbai, India',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontWeight: FontWeight.w500, fontSize: 11.5, color: Colors.white60, decoration: TextDecoration.none)),
                    ],
                  ),
          ),
        ),
        _Press(
          onTap: () {
            HapticFeedback.selectionClick();
            setState(() {
              searching = !searching;
              if (!searching) { query = ''; searchCtl.clear(); }
            });
            if (!searching) resetPager();
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 280),
            width: 48, height: 48,
            decoration: BoxDecoration(color: searching ? _lime : Colors.white.withAlpha(28), shape: BoxShape.circle),
            child: Icon(searching ? Icons.close_rounded : Icons.search_rounded, color: searching ? kInk : Colors.white, size: 22),
          ),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext c) {
    if (all.isEmpty) {
      return Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF1B2B3F), Color(0xFF506A80)]),
        ),
        child: const Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            SizedBox(width: 34, height: 34, child: CircularProgressIndicator(color: _lime, strokeWidth: 3)),
            SizedBox(height: 18),
            Text('Scanning live feeds…', style: TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w500, decoration: TextDecoration.none)),
          ]),
        ),
      );
    }

    // ── Explore tab ────────────────────────────────────────────────────
    if (widget.listMode) {
      return Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter, end: Alignment.bottomCenter,
            colors: [Color(0xFF56708A), Color(0xFF8FA3B5), Color(0xFFE9ECEF)],
            stops: [0, .45, 1],
          ),
        ),
        child: SafeArea(
          child: ListView(padding: const EdgeInsets.fromLTRB(14, 10, 14, 120), children: [
            _Enter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                    child: const Row(mainAxisSize: MainAxisSize.min, children: [
                      _PulseDot(color: Color(0xFFE5484D), size: 8),
                      SizedBox(width: 8),
                      Text('Real-time', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: kInk, decoration: TextDecoration.none)),
                    ]),
                  ),
                  const SizedBox(height: 14),
                  const Text('Incidents\naround you',
                      style: TextStyle(fontSize: 42, height: 1.05, fontWeight: FontWeight.w500, letterSpacing: -1.2, color: Colors.white, decoration: TextDecoration.none)),
                  const SizedBox(height: 10),
                  Text('Live incidents detected by city CCTV',
                      style: TextStyle(color: Colors.white.withAlpha(200), fontSize: 14, fontWeight: FontWeight.w500, decoration: TextDecoration.none)),
                  const SizedBox(height: 18),
                ]),
              ),
            ),
            for (int n = 0; n < all.length; n++)
              _Enter(
                delay: 120 + n * 80,
                dy: 36,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: IncidentCard(all[n], () => open(all[n])),
                ),
              ),
          ]),
        ),
      );
    }

    // ── Home / live map ────────────────────────────────────────────────
    final high = all.where((i) => i.high).length;
    return SizedBox.expand(
      child: Stack(fit: StackFit.expand, children: [
        MapView(controller: map, incidents: items, selected: sel, onPick: (n) {
          pager.animateToPage(n, duration: const Duration(milliseconds: 420), curve: Curves.easeOutCubic);
          focus(n);
        }),

        // soft top scrim so the glass UI always reads cleanly over the map
        IgnorePointer(
          child: Container(
            height: 230,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter, end: Alignment.bottomCenter,
                colors: [_glass.withAlpha(120), _glass.withAlpha(0)],
              ),
            ),
          ),
        ),

        SafeArea(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // top bar (avatar · city · search)
            _Enter(
              dy: -24,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
                child: topBar(),
              ),
            ),

            // lime risk pill (like the "airly" badge) + round locate button
            _Enter(
              delay: 90,
              dy: -18,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                child: Row(children: [
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 11, 20, 11),
                    decoration: BoxDecoration(
                      color: _lime, borderRadius: BorderRadius.circular(28),
                      boxShadow: [BoxShadow(color: _lime.withAlpha(110), blurRadius: 22, offset: const Offset(0, 6))],
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const _PulseDot(color: kInk, size: 9),
                      const SizedBox(width: 10),
                      Text('$high high-risk nearby',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: kInk, letterSpacing: -.2, decoration: TextDecoration.none)),
                    ]),
                  ),
                  const Spacer(),
                  _Press(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      map.move(const LatLng(19.0760, 72.8777), 13.5);
                    },
                    child: const _Glass(
                      radius: 26,
                      padding: EdgeInsets.all(13),
                      child: Icon(Icons.my_location_rounded, color: _lime, size: 22),
                    ),
                  ),
                ]),
              ),
            ),

            // filters
            _Enter(
              delay: 170,
              dy: -14,
              child: SizedBox(
                height: 44,
                child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.only(left: 14), children: [
                  chip('All', Icons.layers_rounded),
                  chip('Crowd', Icons.groups_rounded),
                  chip('Traffic', Icons.car_crash_rounded),
                  chip('Baggage', Icons.luggage_rounded),
                ]),
              ),
            ),
          ]),
        ),

        // incident carousel — lifted to clear the floating nav pill
        if (items.isNotEmpty)
          Positioned(
            left: 0, right: 0, bottom: 96, height: 228,
            child: _Enter(
              delay: 260,
              dy: 70,
              child: PageView.builder(
                controller: pager,
                itemCount: items.length,
                physics: const BouncingScrollPhysics(),
                onPageChanged: (n) { HapticFeedback.selectionClick(); focus(n); },
                itemBuilder: (_, n) => AnimatedBuilder(
                  animation: pager,
                  builder: (_, child) {
                    double page = sel.toDouble();
                    if (pager.hasClients && pager.position.haveDimensions) page = pager.page ?? page;
                    final d = (page - n).abs().clamp(0.0, 1.0);
                    return Opacity(
                      opacity: 1 - .4 * d,
                      child: Transform.translate(
                        offset: Offset(0, 16 * d),
                        child: Transform.scale(scale: 1 - .07 * d, alignment: Alignment.bottomCenter, child: child),
                      ),
                    );
                  },
                  child: Align(alignment: Alignment.bottomCenter, child: IncidentCard(items[n], () => open(items[n]))),
                ),
              ),
            ),
          ),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Small UI building blocks
// ═══════════════════════════════════════════════════════════════════════

/// Frosted smoked-glass surface.
class _Glass extends StatelessWidget {
  final Widget child;
  final double radius;
  final EdgeInsetsGeometry? padding;
  const _Glass({required this.child, this.radius = 28, this.padding});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
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
}

/// iOS-style press feedback: quick squish down, springy release.
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
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => down = true),
      onTapUp: (_) => setState(() => down = false),
      onTapCancel: () => setState(() => down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: down ? .92 : 1,
        duration: Duration(milliseconds: down ? 110 : 320),
        curve: down ? Curves.easeOut : Curves.easeOutBack,
        child: widget.child,
      ),
    );
  }
}

/// Staggered fade + slide entrance.
class _Enter extends StatefulWidget {
  final Widget child;
  final int delay; // ms
  final double dy; // starting vertical offset (px)
  const _Enter({required this.child, this.delay = 0, this.dy = 28});
  @override
  State<_Enter> createState() => _EnterState();
}

class _EnterState extends State<_Enter> with SingleTickerProviderStateMixin {
  late final AnimationController ctl = AnimationController(vsync: this, duration: const Duration(milliseconds: 750));
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
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: a,
      child: widget.child,
      builder: (_, child) => Opacity(
        opacity: a.value.clamp(0.0, 1.0),
        child: Transform.translate(offset: Offset(0, (1 - a.value) * widget.dy), child: child),
      ),
    );
  }
}

/// Live "radar" dot with an expanding ring.
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