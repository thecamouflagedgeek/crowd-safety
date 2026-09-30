import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme.dart';
import '../widgets/bottom_nav.dart';
import 'home_screen.dart';
import 'verify_screen.dart';
import 'advisory_screen.dart';

const _lime = Color(0xFFE2FF3B);
const _glass = Color(0xFF1B2B3F);

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final name = TextEditingController();
  final place = TextEditingController(text: 'Andheri, Mumbai');
  late final AnimationController drift = AnimationController(vsync: this, duration: const Duration(seconds: 14))..repeat();
  bool loading = false;

  @override
  void dispose() {
    drift.dispose();
    name.dispose();
    place.dispose();
    super.dispose();
  }

  Future<void> go() async {
    if (loading) return;
    HapticFeedback.mediumImpact();
    setState(() => loading = true);
    await Future.delayed(const Duration(milliseconds: 650));
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 600),
        pageBuilder: (_, __, ___) => const Shell(),
        transitionsBuilder: (_, a, __, child) => FadeTransition(
          opacity: CurvedAnimation(parent: a, curve: Curves.easeOutCubic),
          child: ScaleTransition(scale: Tween(begin: 1.04, end: 1.0).animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)), child: child),
        ),
      ),
    );
  }

  InputDecoration field(IconData icon, String hint) => InputDecoration(
        prefixIcon: Icon(icon, color: Colors.white60, size: 22),
        hintText: hint,
        hintStyle: const TextStyle(color: Colors.white38, fontWeight: FontWeight.w500),
        filled: true,
        fillColor: Colors.white.withAlpha(22),
        contentPadding: const EdgeInsets.symmetric(vertical: 18),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide(color: Colors.white.withAlpha(25))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: const BorderSide(color: _lime, width: 1.4)),
      );

  @override
  Widget build(BuildContext c) {
    return Scaffold(
      backgroundColor: _glass,
      body: Stack(fit: StackFit.expand, children: [
        // slate gradient, like the reference
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter, end: Alignment.bottomCenter,
              colors: [Color(0xFF6B8296), Color(0xFF3B5268), Color(0xFF1B2B3F)],
              stops: [0, .5, 1],
            ),
          ),
        ),

        // slowly breathing topographic contour lines
        IgnorePointer(
          child: AnimatedBuilder(
            animation: drift,
            builder: (_, __) => CustomPaint(painter: _ContourPainter(drift.value)),
          ),
        ),

        // floating "incident" dots
        const _FloatDot(left: .18, top: .16, delay: 0),
        const _FloatDot(left: .78, top: .23, delay: 500),
        const _FloatDot(left: .62, top: .09, delay: 900),
        const _FloatDot(left: .88, top: .42, delay: 300),

        SafeArea(
          child: LayoutBuilder(
            builder: (_, box) => SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: box.maxHeight),
                child: IntrinsicHeight(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      // brand pill
                      _Enter(
                        dy: -24,
                        child: _Glass(
                          radius: 30,
                          padding: const EdgeInsets.fromLTRB(8, 8, 18, 8),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            Container(
                              width: 40, height: 40,
                              decoration: BoxDecoration(color: _lime, shape: BoxShape.circle, boxShadow: [BoxShadow(color: _lime.withAlpha(100), blurRadius: 16)]),
                              child: const Icon(Icons.shield_rounded, color: kInk, size: 22),
                            ),
                            const SizedBox(width: 12),
                            const Text('SafeCity', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: -.3)),
                          ]),
                        ),
                      ),
                      const Spacer(),

                      _Enter(
                        delay: 120,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                          child: const Row(mainAxisSize: MainAxisSize.min, children: [
                            _PulseDot(color: Color(0xFFE5484D), size: 8),
                            SizedBox(width: 8),
                            Text('Real-time', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: kInk)),
                          ]),
                        ),
                      ),
                      const SizedBox(height: 16),
                      _Enter(
                        delay: 200,
                        child: const Text("See what's\nhappening\naround you.",
                            style: TextStyle(color: Colors.white, fontSize: 48, height: 1.03, fontWeight: FontWeight.w500, letterSpacing: -1.6)),
                      ),
                      const SizedBox(height: 14),
                      _Enter(
                        delay: 300,
                        child: Text('Live CCTV intelligence, turned into\nclear guidance you can act on.',
                            style: TextStyle(color: Colors.white.withAlpha(190), fontSize: 16, height: 1.4, fontWeight: FontWeight.w500)),
                      ),
                      const SizedBox(height: 34),

                      // glass sign-in card
                      _Enter(
                        delay: 420,
                        dy: 60,
                        child: _Glass(
                          radius: 34,
                          padding: const EdgeInsets.all(18),
                          child: Column(children: [
                            TextField(
                              controller: name,
                              cursorColor: _lime,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                              decoration: field(Icons.person_outline_rounded, 'Name or phone'),
                            ),
                            const SizedBox(height: 10),
                            TextField(
                              controller: place,
                              cursorColor: _lime,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                              decoration: field(Icons.place_outlined, 'Your location'),
                            ),
                            const SizedBox(height: 16),
                            _Press(
                              onTap: go,
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 300),
                                curve: Curves.easeOutCubic,
                                height: 60,
                                padding: const EdgeInsets.fromLTRB(26, 0, 7, 0),
                                decoration: BoxDecoration(
                                  color: _lime,
                                  borderRadius: BorderRadius.circular(30),
                                  boxShadow: [BoxShadow(color: _lime.withAlpha(loading ? 40 : 100), blurRadius: 24, offset: const Offset(0, 8))],
                                ),
                                child: Row(children: [
                                  Text(loading ? 'Connecting…' : 'Continue',
                                      style: const TextStyle(color: kInk, fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: -.2)),
                                  const Spacer(),
                                  Container(
                                    width: 46, height: 46,
                                    decoration: const BoxDecoration(color: kInk, shape: BoxShape.circle),
                                    child: loading
                                        ? const Padding(padding: EdgeInsets.all(14), child: CircularProgressIndicator(color: _lime, strokeWidth: 2.4))
                                        : const Icon(Icons.arrow_forward_rounded, color: _lime, size: 22),
                                  ),
                                ]),
                              ),
                            ),
                          ]),
                        ),
                      ),
                      const SizedBox(height: 14),
                      _Enter(
                        delay: 560,
                        dy: 20,
                        child: Center(
                          child: Text('Location is only used to show incidents near you',
                              style: TextStyle(color: Colors.white.withAlpha(120), fontSize: 12, fontWeight: FontWeight.w500)),
                        ),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int i = 0;
  @override
  Widget build(BuildContext c) => Scaffold(
        body: Stack(children: [
          IndexedStack(index: i, children: const [
            HomeScreen(),
            HomeScreen(listMode: true),
            Padding(padding: EdgeInsets.only(bottom: 96), child: VerifyScreen()),
            Padding(padding: EdgeInsets.only(bottom: 96), child: AdvisoryScreen()),
          ]),
          Positioned.fill(child: BottomNav(i, (v) => setState(() => i = v))),
        ]),
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

/// Lime map-style dot that gently floats and glows.
class _FloatDot extends StatefulWidget {
  final double left, top; // fractions of screen
  final int delay;
  const _FloatDot({required this.left, required this.top, required this.delay});
  @override
  State<_FloatDot> createState() => _FloatDotState();
}

class _FloatDotState extends State<_FloatDot> with SingleTickerProviderStateMixin {
  late final AnimationController ctl = AnimationController(vsync: this, duration: const Duration(milliseconds: 3200));
  @override
  void initState() {
    super.initState();
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) ctl.repeat(reverse: true);
    });
  }

  @override
  void dispose() {
    ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sz = MediaQuery.of(context).size;
    return Positioned(
      left: sz.width * widget.left,
      top: sz.height * widget.top,
      child: IgnorePointer(
        child: AnimatedBuilder(
          animation: ctl,
          builder: (_, __) {
            final t = Curves.easeInOut.transform(ctl.value);
            return Transform.translate(
              offset: Offset(0, -8 * t),
              child: Container(
                width: 16, height: 16,
                decoration: BoxDecoration(
                  color: _lime, shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: _lime.withAlpha((60 + 80 * t).toInt()), blurRadius: 14 + 10 * t, spreadRadius: 1 + 3 * t)],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Faint topographic contour rings (echoes the reference's line art).
class _ContourPainter extends CustomPainter {
  final double t;
  _ContourPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width * .78, size.height * .22);
    final phase = t * 2 * math.pi;
    for (int r = 0; r < 14; r++) {
      final base = 40.0 + r * 26;
      final path = Path();
      for (int k = 0; k <= 120; k++) {
        final ang = k / 120 * 2 * math.pi;
        final wob = 1 + .07 * math.sin(ang * 3 + phase + r * .35) + .04 * math.sin(ang * 5 - phase + r * .2);
        final p = center + Offset(math.cos(ang), math.sin(ang)) * base * wob;
        k == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
      }
      path.close();
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = _lime.withAlpha((46 - r * 3).clamp(6, 46)),
      );
    }
  }

  @override
  bool shouldRepaint(_ContourPainter old) => old.t != t;
}