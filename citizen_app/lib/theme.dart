import 'package:flutter/material.dart';

const kBlue = Color(0xFF1B6EF3);
const kInk = Color(0xFF14171F);
const kRed = Color(0xFFE5383B);
const kAmber = Color(0xFFF2A007);
const kGreen = Color(0xFF1FA463);
const kBg = Color(0xFFF4F6FA);

final appTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(seedColor: kBlue),
  scaffoldBackgroundColor: kBg,
  fontFamily: 'Roboto',
  navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: Colors.white, indicatorColor: Color(0xFFE3EEFF)),
);

List<BoxShadow> softShadow = [
  BoxShadow(color: Colors.black.withOpacity(.12), blurRadius: 24, offset: const Offset(0, 8))
];

Widget pillButton(String label, VoidCallback onTap,
        {bool filled = true, IconData? icon}) =>
    SizedBox(
      width: double.infinity,
      height: 54,
      child: FilledButton.icon(
        onPressed: onTap,
        icon: Icon(icon ?? Icons.arrow_forward, size: 18),
        label: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
        style: FilledButton.styleFrom(
          backgroundColor: filled ? kBlue : const Color(0xFFE9EDF5),
          foregroundColor: filled ? Colors.white : kInk,
          shape: const StadiumBorder(),
        ),
      ),
    );
