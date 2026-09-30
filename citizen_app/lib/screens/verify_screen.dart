import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';

class VerifyScreen extends StatefulWidget {
  const VerifyScreen({super.key});
  @override
  State<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends State<VerifyScreen> {
  final ctl = TextEditingController(text: 'Gate 3 is completely closed.');
  Map? res;
  bool busy = false;

  Future<void> run() async {
    final claim = ctl.text.trim();
    if (claim.isEmpty) return;
    setState(() { busy = true; res = null; });
    final r = await Api.verify(claim, location: _locationForClaim(claim));
    if (mounted) setState(() { res = r; busy = false; });
  }

  String? _locationForClaim(String claim) {
    final lower = claim.toLowerCase();
    if (lower.contains('gate 3') || lower.contains('gate3')) return 'Gate 3';
    if (lower.contains('gate 5') || lower.contains('gate5')) return 'Gate 5';
    if (lower.contains('marine') || lower.contains('junction')) return 'Marine Drive Junction';
    if (lower.contains('csmt') || lower.contains('platform')) return 'CSMT Platform 4';
    return null;
  }

  @override
  void dispose() {
    ctl.dispose();
    super.dispose();
  }

  static IconData _iconForStatus(String status) {
    if (status == 'VERIFIED') return Icons.verified;
    if (status == 'UNDER_VALIDATION') return Icons.pending;
    return Icons.warning_amber_rounded;
  }

  static Color _colorForStatus(String status) {
    if (status == 'VERIFIED') return kGreen;
    if (status == 'UNDER_VALIDATION') return kAmber;
    return kRed;
  }

  @override
  Widget build(BuildContext c) {
    final status = res?['status']?.toString() ?? 'UNVERIFIED';
    final col = _colorForStatus(status);
    final conf = (res?['confidence'] is num) ? (res!['confidence'] as num).toDouble() : 0.0;
    final sources = res?['supporting_sources'];
    final sourceList = sources is List ? sources : <dynamic>[];
    final impact = res?['impact']?.toString() ?? '';
    final severity = res?['severity']?.toString() ?? '';
    final incidentId = res?['incident_id']?.toString();
    final location = res?['location']?.toString();
    final newsCount = (res?['corroborating_news'] is List) ? (res!['corroborating_news'] as List).length : 0;

    return SafeArea(
      child: ListView(padding: const EdgeInsets.all(20), children: [
        const Text('Verify information', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: kInk)),
        const SizedBox(height: 4),
        const Text('Paste a claim or link you saw or heard.', style: TextStyle(color: Colors.black54)),
        const SizedBox(height: 16),
        TextField(
          controller: ctl,
          maxLines: 3,
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
          ),
        ),
        const SizedBox(height: 14),
        pillButton(busy ? 'Checking sources…' : 'Verify', busy ? () {} : run, icon: Icons.fact_check_outlined),
        const SizedBox(height: 20),
        if (res != null)
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 400),
            builder: (_, t, child) => Opacity(
              opacity: t,
              child: Transform.translate(
                offset: Offset(0, 20 * (1 - t)),
                child: child,
              ),
            ),
            child: Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28),
                boxShadow: softShadow,
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(_iconForStatus(status), color: col, size: 30),
                  const SizedBox(width: 10),
                  Text(status, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: col)),
                  const Spacer(),
                  if (incidentId != null && incidentId.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(color: col.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
                      child: Text(incidentId, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: col)),
                    ),
                ]),
                const SizedBox(height: 6),
                if (severity.isNotEmpty)
                  Text('$severity severity', style: TextStyle(fontSize: 14, color: col.withOpacity(0.8), fontWeight: FontWeight.w600)),
                const SizedBox(height: 12),
                Text('Confidence  ${(conf * 100).round()}%', style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: (conf * 100 / 100),
                    minHeight: 10,
                    color: col,
                    backgroundColor: kBg,
                  ),
                ),
                if (impact.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: kBg, borderRadius: BorderRadius.circular(14)),
                    child: Row(children: [
                      Icon(Icons.tips_and_updates_rounded, color: col, size: 18),
                      const SizedBox(width: 10),
                      Expanded(child: Text(impact, style: const TextStyle(fontSize: 14, height: 1.4))),
                    ]),
                  ),
                ],
                const SizedBox(height: 16),
                if (sourceList.isNotEmpty) ...[
                  const Text('Supporting sources', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 8),
                  ...sourceList.map<Widget>((s) {
                    final label = (s is Map) ? (s['label'] ?? s['id'] ?? '?')?.toString() : s.toString();
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(children: [
                        Icon(Icons.check_circle, size: 18, color: col),
                        const SizedBox(width: 10),
                        Expanded(child: Text(label, style: const TextStyle(fontSize: 15))),
                      ]),
                    );
                  }),
                ] else
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: kBg, borderRadius: BorderRadius.circular(14)),
                    child: Row(children: [
                      Icon(Icons.cancel, color: kRed, size: 18),
                      const SizedBox(width: 10),
                      Expanded(child: const Text('No supporting sources found for this claim.')),
                    ]),
                  ),
                if (newsCount > 0) ...[
                  const SizedBox(height: 12),
                  Text('$newsCount live news items consulted (REPORTED only — not proof on their own)',
                      style: const TextStyle(color: Colors.black45, fontSize: 12)),
                ],
              ]),
            ),
          ),
      ]),
    );
  }
}
