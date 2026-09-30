import 'package:flutter/material.dart';
import '../models/incident.dart';
import '../services/api_service.dart';
import '../theme.dart';

class GuidanceScreen extends StatelessWidget {
  final Incident i;
  const GuidanceScreen(this.i, {super.key});

  Widget node(IconData ic, Color col, String t, String sub) => Row(children: [
        CircleAvatar(radius: 24, backgroundColor: col.withOpacity(.14), child: Icon(ic, color: col)),
        const SizedBox(width: 14),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          Text(sub, style: const TextStyle(color: Colors.black54)),
        ]),
      ]);

  Widget line() => Container(margin: const EdgeInsets.only(left: 23, top: 4, bottom: 4), width: 2, height: 30, color: Colors.black12);

  @override
  Widget build(BuildContext c) => Scaffold(
        appBar: AppBar(title: const Text('Safe route'), backgroundColor: kBg),
        body: FutureBuilder<Map>(
          future: Api.route(i),
          builder: (_, s) {
            if (!s.hasData) return const Center(child: CircularProgressIndicator());
            final r = s.data!;
            final route = r['route'];
            final routeList = route is List ? route.cast<String>() : <String>[];
            final recommended = r['recommended'] == true;
            final reason = r['reason']?.toString() ?? '';
            final destination = r['destination']?.toString() ?? '';
            final severity = r['severity']?.toString() ?? '';
            final distM = r['distance_m'];
            final distKm = distM is num ? (distM as num).toDouble() / 1000 : null;
            final durS = r['duration_s'];
            final durMin = durS is num ? ((durS as num).toDouble() / 60).round() : null;
            final engine = r['routing_engine']?.toString() ?? 'deterministic_fallback';

            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28), boxShadow: softShadow),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    node(Icons.my_location, kBlue, 'Your location', 'Andheri, Mumbai'),
                    line(),
                    if (routeList.length > 1)
                      for (int n = 1; n < routeList.length; n++)
                        ...[node(
                              n == routeList.length - 1 ? Icons.check_rounded : Icons.directions_rounded,
                              n == routeList.length - 1 ? kGreen : Colors.black54,
                              routeList[n],
                              n == routeList.length - 1
                                  ? '$severity RISK · recommended'
                                  : n == 1
                                      ? 'Avoid ${i.location}'
                                      : 'Along the route',
                            ), line()]
                    else
                      node(Icons.check_rounded, kGreen, destination, '$severity RISK · recommended'),
                  ]),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: kBg, borderRadius: BorderRadius.circular(18)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Icon(recommended ? Icons.check_circle : Icons.info_outline, color: recommended ? kGreen : Colors.black45),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          recommended ? 'Alternate route recommended' : 'Route guidance',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ]),
                    const SizedBox(height: 8),
                    Text(reason, style: const TextStyle(fontSize: 15, height: 1.45)),
                    if (distKm != null) ...[
                      const SizedBox(height: 10),
                      Row(children: [
                        Icon(Icons.straighten, size: 16, color: Colors.black45),
                        const SizedBox(width: 6),
                        Text('${distKm.toStringAsFixed(1)} km', style: const TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(width: 14),
                        Icon(Icons.timer_outlined, size: 16, color: Colors.black45),
                        const SizedBox(width: 6),
                        Text(durMin != null ? '$durMin min' : '—', style: const TextStyle(fontWeight: FontWeight.w600)),
                        const Spacer(),
                        Text('via $engine', style: TextStyle(color: Colors.black45, fontSize: 12)),
                      ]),
                    ],
                  ]),
                ),
                const Spacer(),
                pillButton('Ask AI about this route', () => showChat(c, i), icon: Icons.chat_bubble_outline),
              ]),
            );
          },
        ),
      );
}

void showChat(BuildContext c, Incident? i) => showModalBottomSheet(
      context: c,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChatSheet(i),
    );

class ChatSheet extends StatefulWidget {
  final Incident? i;
  const ChatSheet(this.i, {super.key});
  @override
  State<ChatSheet> createState() => _ChatSheetState();
}

class _ChatSheetState extends State<ChatSheet> {
  final ctl = TextEditingController();
  late final List<(bool, String)> msgs = [(false, 'Hi, I\'m your safety assistant. Ask me about ${widget.i?.location ?? 'nearby incidents'}.')];
  bool busy = false;

  Future<void> send() async {
    final t = ctl.text.trim();
    if (t.isEmpty || busy) return;
    ctl.clear();
    setState(() { msgs.add((true, t)); busy = true; });
    final r = await Api.chat(t, widget.i);
    if (mounted) setState(() { msgs.add((false, '${r['reply']}')); busy = false; });
  }

  @override
  Widget build(BuildContext c) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(c).viewInsets.bottom),
        child: Container(
          height: 480,
          padding: const EdgeInsets.all(18),
          decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
          child: Column(children: [
            const Text('SAFETY ASSISTANT', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.2, fontSize: 12, color: Colors.black45)),
            const SizedBox(height: 10),
            Expanded(
              child: ListView(children: [
                for (final m in msgs)
                  Align(
                    alignment: m.$1 ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      padding: const EdgeInsets.all(14),
                      constraints: const BoxConstraints(maxWidth: 290),
                      decoration: BoxDecoration(color: m.$1 ? kBlue : kBg, borderRadius: BorderRadius.circular(20)),
                      child: Text(m.$2, style: TextStyle(color: m.$1 ? Colors.white : kInk, height: 1.4)),
                    ),
                  ),
                if (busy) const Padding(padding: EdgeInsets.all(8), child: Text('Analysing CCTV…', style: TextStyle(color: Colors.black45))),
              ]),
            ),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: ctl,
                  onSubmitted: (_) => send(),
                  decoration: InputDecoration(
                    hintText: 'Is ${widget.i?.location ?? 'it'} safe?',
                    filled: true,
                    fillColor: kBg,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: BorderSide.none),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(onPressed: send, icon: const Icon(Icons.arrow_upward), style: IconButton.styleFrom(backgroundColor: kBlue)),
            ]),
          ]),
        ),
      );
}
