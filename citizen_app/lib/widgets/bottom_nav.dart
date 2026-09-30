import 'package:flutter/material.dart';

class BottomNav extends StatelessWidget {
  final int index;
  final ValueChanged<int> onTap;
  const BottomNav(this.index, this.onTap, {super.key});
  @override
  Widget build(BuildContext c) => NavigationBar(selectedIndex: index, onDestinationSelected: onTap, destinations: const [
        NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map), label: 'Home'),
        NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore), label: 'Explore'),
        NavigationDestination(icon: Icon(Icons.verified_outlined), selectedIcon: Icon(Icons.verified), label: 'Verify'),
        NavigationDestination(icon: Icon(Icons.notifications_outlined), selectedIcon: Icon(Icons.notifications), label: 'Alerts'),
      ]);
}
