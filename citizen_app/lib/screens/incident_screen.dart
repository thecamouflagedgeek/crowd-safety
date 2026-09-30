import 'package:flutter/material.dart';
import '../models/incident.dart';
import '../theme.dart';
import '../widgets/risk_badge.dart';
import 'guidance_screen.dart';

class IncidentScreen extends StatelessWidget {
  final Incident i;
  const IncidentScreen(this.i, {super.key});

  Widget stat(String label, String v) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: kBg, borderRadius: BorderRadius.circular(20)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(v, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: kInk)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          ]),
        ),
      );

  @override
  Widget build(BuildContext c) => Scaffold(
        backgroundColor: i.color,
        body: Column(children: [
          Container(
            height: 220, width: double.infinity,
            decoration: BoxDecoration(gradient: LinearGradient(colors: [i.color, i.color.withOpacity(.6)], begin: Alignment.topLeft, end: Alignment.bottomRight)),
            child: SafeArea(child: Stack(children: [
              Align(alignment: Alignment.topLeft, child: IconButton(icon: const Icon(Icons.arrow_back, color: Colors.white), onPressed: () => Navigator.pop(c))),
              Center(child: Icon(i.icon, size: 96, color: Colors.white.withOpacity(.9))),
            ])),
          ),
          Expanded(
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(22, 22, 22, 16),
              decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
              child: ListView(children: [
                RiskBadge(i.severity, i.color),
                if (i.riskScore != null) 
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text('Risk score ${(i.riskScore! * 100).round()}%', style: const TextStyle(color: Colors.black54, fontSize: 13)),
                  ),
                const SizedBox(height: 10),
                Text(i.type, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: kInk)),
                Text('${i.location} · ${i.displayDistance.toStringAsFixed(0)} km away', style: const TextStyle(color: Colors.black54, fontSize: 15)),
                if (i.live) 
                  const Padding(
                    padding: EdgeInsets.only(bottom: 6),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      SizedBox(width: 8, height: 8, child: CircularProgressIndicator(strokeWidth: 2, color: kGreen)),
                      SizedBox(width: 6),
                      Text('Live CCTV feed', style: TextStyle(color: kGreen, fontSize: 12, fontWeight: FontWeight.w600)),
                    ]),
                  ),
                const SizedBox(height: 18),
                Row(children: [
                  stat('CCTV confidence', '${(i.confidence * 100).round()}%'),
                  const SizedBox(width: 10),
                  stat(i.type.contains('Crowd') ? 'Crowd density' : 'Area impact', '${(i.density.round()).toString()}%'),
                  const SizedBox(width: 10),
                  stat('Movement', i.movement),
                ]),
                const SizedBox(height: 22),
                const Text('What this means', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 6),
                Text('${i.summary} near ${i.location}.', style: const TextStyle(fontSize: 15, height: 1.4)),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: i.color.withOpacity(.1), borderRadius: BorderRadius.circular(18)),
                  child: Row(children: [
                    Icon(Icons.tips_and_updates_rounded, color: i.color),
                    const SizedBox(width: 10),
                    Expanded(child: Text(i.action, style: const TextStyle(fontWeight: FontWeight.w600))),
                  ]),
                ),
                const SizedBox(height: 22),
                pillButton('Find Safe Route', () => Navigator.push(c, MaterialPageRoute(builder: (_) => GuidanceScreen(i))), icon: Icons.alt_route),
                const SizedBox(height: 10),
                pillButton('Ask AI', () => showChat(c, i), filled: false, icon: Icons.chat_bubble_outline),
              ]),
            ),
          ),
        ]),
      );
}
