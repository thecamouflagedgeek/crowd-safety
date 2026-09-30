import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

const _lime = Color(0xFFE2FF3B);
const _ink = Color(0xFF0E0E10);
const _slate = Color(0xFF1B2B3F);

class BottomNav extends StatefulWidget {
  final int index;
  final ValueChanged<int> onTap;
  const BottomNav(this.index, this.onTap, {super.key});
  @override
  State<BottomNav> createState() => _BottomNavState();
}

class _BottomNavState extends State<BottomNav> with SingleTickerProviderStateMixin {
  static const tabs = [
    (Icons.map_rounded, Icons.map_outlined, 'Home'),
    (Icons.explore_rounded, Icons.explore_outlined, 'Explore'),
    (Icons.verified_rounded, Icons.verified_outlined, 'Verify'),
    (Icons.notifications_rounded, Icons.notifications_outlined, 'Alerts'),
  ];

  late final ctl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 520),
    reverseDuration: const Duration(milliseconds: 240),
  );

  @override
  void dispose() {
    ctl.dispose();
    super.dispose();
  }

  bool get open => ctl.status == AnimationStatus.forward || ctl.status == AnimationStatus.completed;

  void toggle() {
    HapticFeedback.selectionClick();
    open ? ctl.reverse() : ctl.forward();
  }

  void pick(int n) {
    HapticFeedback.mediumImpact();
    widget.onTap(n);
    ctl.reverse();
  }

  Widget popup(double t) {
    return Container(
      width: 230,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [BoxShadow(color: Colors.black.withAlpha(60), blurRadius: 40, offset: const Offset(0, 14))],
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        for (int n = 0; n < tabs.length; n++)
          Builder(builder: (_) {
            final s = (3 - n) * .08; // items nearest the pill appear first
            final e = Interval(s, (s + .6).clamp(0.0, 1.0), curve: Curves.easeOutBack).transform(t);
            final on = widget.index == n;
            return Opacity(
              opacity: e.clamp(0.0, 1.0),
              child: Transform.translate(
                offset: Offset(0, (1 - e) * 26),
                child: _Press(
                  onTap: () => pick(n),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeOutCubic,
                    margin: const EdgeInsets.symmetric(vertical: 2),
                    padding: const EdgeInsets.fromLTRB(8, 8, 18, 8),
                    decoration: BoxDecoration(color: on ? _ink : Colors.transparent, borderRadius: BorderRadius.circular(26)),
                    child: Row(children: [
                      Container(
                        width: 38, height: 38,
                        decoration: BoxDecoration(color: on ? _lime : const Color(0xFFF0F2F4), shape: BoxShape.circle),
                        child: Icon(on ? tabs[n].$1 : tabs[n].$2, size: 20, color: _ink),
                      ),
                      const SizedBox(width: 14),
                      Text(tabs[n].$3,
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: -.2, color: on ? Colors.white : _ink, decoration: TextDecoration.none)),
                    ]),
                  ),
                ),
              ),
            );
          }),
      ]),
    );
  }

  Widget pill(double t) {
    return _Press(
      onTap: toggle,
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(40),
          boxShadow: [BoxShadow(color: Colors.black.withAlpha(55), blurRadius: 28, offset: const Offset(0, 10))],
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 54, height: 54,
            decoration: const BoxDecoration(color: _ink, shape: BoxShape.circle),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 280),
              transitionBuilder: (w, a) => ScaleTransition(scale: a, child: FadeTransition(opacity: a, child: w)),
              child: Icon(tabs[widget.index].$1, key: ValueKey(widget.index), color: _lime, size: 24),
            ),
          ),
          SizedBox(
            width: 62, height: 54,
            child: Transform.rotate(
              angle: t * 3.14159 / 2,
              child: Icon(t > .5 ? Icons.close_rounded : Icons.grid_view_rounded, color: _ink, size: 24),
            ),
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: ctl,
      builder: (_, __) {
        final t = ctl.value;
        return Stack(fit: StackFit.expand, children: [
          // tap-outside-to-close scrim (only exists while open)
          if (t > 0)
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: toggle,
                child: ColoredBox(color: _slate.withAlpha((110 * t).toInt())),
              ),
            ),
          Align(
            alignment: Alignment.bottomCenter,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  if (t > 0)
                    Transform.scale(
                      scale: .86 + .14 * Curves.easeOutCubic.transform(t),
                      alignment: Alignment.bottomCenter,
                      child: popup(t),
                    ),
                  const SizedBox(height: 12),
                  pill(t),
                ]),
              ),
            ),
          ),
        ]);
      },
    );
  }
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
          scale: down ? .94 : 1,
          duration: Duration(milliseconds: down ? 100 : 300),
          curve: down ? Curves.easeOut : Curves.easeOutBack,
          child: widget.child,
        ),
      );
}