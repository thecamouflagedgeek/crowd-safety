import 'package:flutter/material.dart';
import 'theme.dart';
import 'screens/login_screen.dart';

void main() => runApp(const CitizenApp());

class CitizenApp extends StatelessWidget {
  const CitizenApp({super.key});
  @override
  Widget build(BuildContext c) =>
      MaterialApp(title: 'SafeCity', debugShowCheckedModeBanner: false, theme: appTheme, home: const LoginScreen());
}
