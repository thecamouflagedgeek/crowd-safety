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
    setState(() { busy = true; res = null; });
    final r = await Api.verify(ctl.text);
    if (mounted) setState(() { res = r; busy = false; });
  }

  Widget row(String label, String? v) {
    final ic = v == 'yes' ? Icons.check_circle : v == 'partial' ? Icons.remove_circle : Icons.cancel;
    final col = v == 'yes' ? kGreen : v == 'partial' ? kAmber : kRed;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [Expanded(child: Text(label, style: const TextStyle(fontSize: 16))), Icon(ic, color: col)]),
    );
  }

  @override
  Widget build(BuildContext c) {
    final ok = res?['verdict'] == 'VERIFIED';
    final col = ok ? kGreen : kAmber;
    final src = (res?['sources'] ?? {}) as Map;
    return SafeArea(
      child: ListView(padding: const EdgeInsets.all(20), children: [
        const Text('Verify information', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: kInk)),
        const SizedBox(height: 4),
        const Text('Paste a claim or link you saw or heard.', style: TextStyle(color: Colors.black54)),
        const SizedBox(height: 16),
        TextField(controller: ctl, maxLines: 3, decoration: InputDecoration(filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none))),
        const SizedBox(height: 14),
        pillButton(busy ? 'Checking sources…' : 'Verify', busy ? () {} : run, icon: Icons.fact_check_outlined),
        const SizedBox(height: 20),
        if (res != null)
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1), duration: const Duration(milliseconds: 400),
            builder: (_, t, child) => Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 20 * (1 - t)), child: child)),
            child: Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28), boxShadow: softShadow),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(ok ? Icons.verified : Icons.warning_amber_rounded, color: col, size: 30),
                  const SizedBox(width: 10),
                  Text('${res!['verdict']}', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: col)),
                ]),
                const SizedBox(height: 14),
                Text('Confidence  ${((res!['confidence'] as num) * 100).round()}%', style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                ClipRRect(borderRadius: BorderRadius.circular(8), child: LinearProgressIndicator(value: (res!['confidence'] as num).toDouble(), minHeight: 10, color: col, backgroundColor: kBg)),
                const SizedBox(height: 14),
                row('CCTV evidence', src['cctv']),
                row('Citizen reports', src['citizen']),
                row('Official source', src['official']),
                row('News', src['news']),
              ]),
            ),
          ),
      ]),
    );
  }
}
