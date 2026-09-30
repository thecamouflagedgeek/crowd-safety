import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';

class AdvisoryScreen extends StatefulWidget {
  const AdvisoryScreen({super.key});
  @override
  State<AdvisoryScreen> createState() => _AdvisoryScreenState();
}

class _AdvisoryScreenState extends State<AdvisoryScreen> {
  List<Map>? items;
  Timer? timer;

  void load() => Api.advisories().then((v) { if (mounted) setState(() => items = v); });

  @override
  void initState() {
    super.initState();
    load();
    timer = Timer.periodic(const Duration(seconds: 10), (_) => load()); // polling
  }

  @override
  void dispose() { timer?.cancel(); super.dispose(); }

  @override
  Widget build(BuildContext c) => SafeArea(
        child: items == null
            ? const Center(child: CircularProgressIndicator())
            : ListView(padding: const EdgeInsets.all(20), children: [
                const Text('Official alerts', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: kInk)),
                const SizedBox(height: 16),
                if (items!.isEmpty) const Center(child: Text('No active advisories. You\'re all clear.')),
                for (final a in items!)
                  Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28), boxShadow: softShadow),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Row(children: [Icon(Icons.campaign_rounded, color: kRed), SizedBox(width: 8), Text('OFFICIAL ADVISORY', style: TextStyle(color: kRed, fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 1))]),
                      const SizedBox(height: 10),
                      Text('${a['title']}', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, height: 1.3)),
                      const SizedBox(height: 6),
                      Text('${a['body']}', style: const TextStyle(color: Colors.black87)),
                      const SizedBox(height: 12),
                      Text('${a['source']} · ${a['time']}', style: const TextStyle(color: Colors.black45, fontSize: 13)),
                    ]),
                  ),
              ]),
      );
}
