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
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28), boxShadow: softShadow),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    node(Icons.my_location, kBlue, 'Your location', 'Andheri, Mumbai'),
                    line(),
                    node(Icons.close_rounded, kRed, '${r['avoid']}', '${i.severity} RISK · avoid'),
                    line(),
                    node(Icons.check_rounded, kGreen, '${r['via']}', 'Clear · recommended'),
                  ]),
                ),
                const SizedBox(height: 20),
                Text('${r['explanation']}', style: const TextStyle(fontSize: 16, height: 1.5)),
                const Spacer(),
                pillButton('Ask AI about this route', () => showChat(c, i), icon: Icons.chat_bubble_outline),
              ]),
            );
          },
        ),
      );
}

void showChat(BuildContext c, Incident? i) => showModalBottomSheet(
      context: c, isScrollControlled: true, backgroundColor: Colors.transparent,
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
              Expanded(child: TextField(controller: ctl, onSubmitted: (_) => send(), decoration: InputDecoration(hintText: 'Is ${widget.i?.location ?? 'it'} safe?', filled: true, fillColor: kBg, border: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: BorderSide.none)))),
              const SizedBox(width: 8),
              IconButton.filled(onPressed: send, icon: const Icon(Icons.arrow_upward), style: IconButton.styleFrom(backgroundColor: kBlue)),
            ]),
          ]),
        ),
      );
}
