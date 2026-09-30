import 'package:flutter/material.dart';
import '../models/incident.dart';
import '../theme.dart';
import 'risk_badge.dart';

class IncidentCard extends StatelessWidget {
  final Incident inc;
  final VoidCallback onTap;
  const IncidentCard(this.inc, this.onTap, {super.key});

  @override
  Widget build(BuildContext c) => GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.fromLTRB(6, 0, 6, 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(30), boxShadow: softShadow),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                width: 84, height: 84,
                decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(24),
                    gradient: LinearGradient(colors: [inc.color, inc.color.withOpacity(.6)], begin: Alignment.topLeft, end: Alignment.bottomRight)),
                child: Stack(children: [
                  Positioned(right: -14, bottom: -14, child: Icon(inc.icon, size: 70, color: Colors.white.withOpacity(.25))),
                  Center(child: Icon(inc.icon, color: Colors.white, size: 38)),
                ]),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    RiskBadge(inc.severity, inc.color),
                    const Spacer(),
                    const Icon(Icons.sensors, size: 14, color: kGreen),
                    const SizedBox(width: 3),
                    const Text('Live', style: TextStyle(color: kGreen, fontWeight: FontWeight.w700, fontSize: 12)),
                  ]),
                  const SizedBox(height: 8),
                  Text(inc.type, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: kInk, height: 1.1)),
                  const SizedBox(height: 3),
                  Text('${inc.location} · ${inc.distance.toStringAsFixed(0)} km · ${(inc.distance * 2).round()} min', style: const TextStyle(color: Colors.black54, fontSize: 13)),
                ]),
              ),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: SizedBox(
                  height: 50,
                  child: FilledButton(
                    onPressed: onTap,
                    style: FilledButton.styleFrom(backgroundColor: kBlue, shape: const StadiumBorder()),
                    child: const Text('View incident', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                width: 50, height: 50,
                decoration: const BoxDecoration(color: Color(0xFFE3EEFF), shape: BoxShape.circle),
                child: const Icon(Icons.alt_route, color: kBlue),
              ),
            ]),
          ]),
        ),
      );
}