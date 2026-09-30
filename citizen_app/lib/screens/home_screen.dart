import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../models/incident.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../widgets/incident_card.dart';
import '../widgets/map_view.dart';
import 'incident_screen.dart';

class HomeScreen extends StatefulWidget {
  final bool listMode; // Explore tab = list of all incidents
  const HomeScreen({super.key, this.listMode = false});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final map = MapController();
  final pager = PageController(viewportFraction: .92);
  List<Incident> all = [];
  int sel = 0;
  String filter = 'All';

  List<Incident> get items => filter == 'All' ? all : all.where((i) => i.type.contains(filter)).toList();

  @override
  void initState() {
    super.initState();
    Api.incidents().then((v) {
      if (mounted) setState(() => all = v..sort((a, b) => a.distance.compareTo(b.distance)));
    });
  }

  void open(Incident i) => Navigator.push(context, MaterialPageRoute(builder: (_) => IncidentScreen(i)));

  void focus(int n) {
    if (n >= items.length) return;
    setState(() => sel = n);
    map.move(LatLng(items[n].lat - .004, items[n].lon), 13.6); // offset so marker sits above the card
  }

  Widget chip(String label, IconData icon) {
    final on = filter == label;
    return GestureDetector(
      onTap: () {
        setState(() { filter = label; sel = 0; });
        if (items.isNotEmpty) { pager.jumpToPage(0); focus(0); }
      },
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(color: on ? kInk : Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: softShadow),
        child: Row(children: [
          Icon(icon, size: 16, color: on ? Colors.white : kInk),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: on ? Colors.white : kInk)),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext c) {
    if (all.isEmpty) return const Center(child: CircularProgressIndicator());
    if (widget.listMode) {
      return SafeArea(
        child: ListView(padding: const EdgeInsets.all(14), children: [
          const Padding(padding: EdgeInsets.fromLTRB(8, 8, 8, 4), child: Text('Around you', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: kInk))),
          const Padding(padding: EdgeInsets.fromLTRB(8, 0, 8, 14), child: Text('Live incidents detected by city CCTV', style: TextStyle(color: Colors.black54))),
          for (final i in all) IncidentCard(i, () => open(i)),
        ]),
      );
    }
    final high = all.where((i) => i.high).length;
    return SizedBox.expand(
      child: Stack(fit: StackFit.expand, children: [
        MapView(controller: map, incidents: items, selected: sel, onPick: (n) {
          pager.animateToPage(n, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
          focus(n);
        }),
        SafeArea(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              margin: const EdgeInsets.fromLTRB(14, 10, 14, 10),
              padding: const EdgeInsets.fromLTRB(18, 8, 8, 8),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32), boxShadow: softShadow),
              child: Row(children: [
                const Icon(Icons.search, color: Colors.black54),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Andheri, Mumbai', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: kInk)),
                    Text('$high high-risk nearby', style: const TextStyle(color: kRed, fontWeight: FontWeight.w600, fontSize: 12)),
                  ]),
                ),
                const CircleAvatar(radius: 20, backgroundColor: kBlue, child: Icon(Icons.person, color: Colors.white, size: 22)),
              ]),
            ),
            SizedBox(
              height: 42,
              child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.only(left: 14), children: [
                chip('All', Icons.layers_outlined),
                chip('Crowd', Icons.groups_rounded),
                chip('Traffic', Icons.car_crash_rounded),
                chip('Baggage', Icons.luggage_rounded),
              ]),
            ),
          ]),
        ),
        Positioned(
          right: 14, bottom: 250,
          child: FloatingActionButton.small(
            heroTag: 'loc', backgroundColor: Colors.white, foregroundColor: kBlue, elevation: 4,
            onPressed: () => map.move(
  const LatLng(19.0760, 72.8777),
  13.5,
),
            child: const Icon(Icons.my_location),
          ),
        ),
        if (items.isNotEmpty)
          Positioned(
            left: 0, right: 0, bottom: 4, height: 228,
            child: PageView.builder(
              controller: pager, itemCount: items.length, onPageChanged: focus,
              itemBuilder: (_, n) => Align(alignment: Alignment.bottomCenter, child: IncidentCard(items[n], () => open(items[n]))),
            ),
          ),
      ]),
    );
  }
}