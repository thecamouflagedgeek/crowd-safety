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
                  _AdvisoryCard(a),
              ]),
      );
}

class _AdvisoryCard extends StatelessWidget {
  final Map a;
  const _AdvisoryCard(this.a);

  Color severityColor(String sev) {
    final s = sev.toUpperCase();
    if (s == 'HIGH' || s == 'CRITICAL') return kRed;
    if (s == 'MEDIUM') return kAmber;
    return kGreen;
  }

  @override
  Widget build(BuildContext context) {
    final message = a['message']?.toString() ?? a['title'] ?? 'Advisory';
    final severity = (a['severity'] ?? '').toString().toUpperCase();
    final issuedBy = a['issued_by']?.toString() ?? a['source']?.toString() ?? 'Authority';
    final timestamp = a['timestamp']?.toString() ?? a['time'] ?? '';
    final location = a['location']?.toString();
    final id = a['id']?.toString();
    final color = severityColor(severity);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28), boxShadow: softShadow),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.campaign_rounded, color: color, size: 20),
          const SizedBox(width: 8),
          Text('OFFICIAL ADVISORY', style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 1)),
          const Spacer(),
          if (id != null && id.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
              child: Text(id, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 11)),
            ),
        ]),
        const SizedBox(height: 10),
        Text(message, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700, height: 1.3)),
        if (location != null && location.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(location, style: TextStyle(color: color.withOpacity(0.8), fontSize: 14, fontWeight: FontWeight.w600)),
        ],
        if (severity.isNotEmpty) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
            child: Text('$severity SEVERITY', style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12, letterSpacing: 0.5)),
          ),
        ],
        const SizedBox(height: 12),
        Text('$issuedBy · $timestamp', style: const TextStyle(color: Colors.black45, fontSize: 13)),
      ]),
    );
  }
}
