import 'package:flutter/material.dart';

class RiskBadge extends StatelessWidget {
  final String severity;
  final Color color;
  const RiskBadge(this.severity, this.color, {super.key});
  @override
  Widget build(BuildContext c) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: color.withOpacity(.12), borderRadius: BorderRadius.circular(20)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.circle, size: 8, color: color),
          const SizedBox(width: 6),
          Text('$severity RISK', style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12, letterSpacing: .5)),
        ]),
      );
}
