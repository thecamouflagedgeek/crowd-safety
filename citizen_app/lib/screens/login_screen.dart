import 'package:flutter/material.dart';
import '../theme.dart';
import '../widgets/bottom_nav.dart';
import 'home_screen.dart';
import 'verify_screen.dart';
import 'advisory_screen.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});
  @override
  Widget build(BuildContext c) => Scaffold(
        body: Container(
          decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF0F3FA8), kBlue], begin: Alignment.topLeft, end: Alignment.bottomRight)),
          padding: const EdgeInsets.all(24),
          child: SafeArea(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Spacer(),
              const Icon(Icons.shield_rounded, color: Colors.white, size: 56),
              const SizedBox(height: 16),
              const Text('SafeCity', style: TextStyle(color: Colors.white, fontSize: 38, fontWeight: FontWeight.w800)),
              const Text('See what\'s happening around you.\nKnow what to do.', style: TextStyle(color: Colors.white70, fontSize: 18, height: 1.4)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28)),
                child: Column(children: [
                  const TextField(decoration: InputDecoration(prefixIcon: Icon(Icons.person_outline), hintText: 'Name or phone')),
                  const SizedBox(height: 10),
                  TextField(controller: TextEditingController(text: 'Andheri, Mumbai'), decoration: const InputDecoration(prefixIcon: Icon(Icons.place_outlined), hintText: 'Your location')),
                  const SizedBox(height: 16),
                  pillButton('Continue', () => Navigator.pushReplacement(c, MaterialPageRoute(builder: (_) => const Shell()))),
                ]),
              ),
            ]),
          ),
        ),
      );
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
        body: IndexedStack(index: i, children: const [HomeScreen(), HomeScreen(listMode: true), VerifyScreen(), AdvisoryScreen()]),
        bottomNavigationBar: BottomNav(i, (v) => setState(() => i = v)),
      );
}
