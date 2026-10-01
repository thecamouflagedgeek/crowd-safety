import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import '../services/geo_alert_sync.dart';

const _lime = Color(0xFFE2FF3B);
const _red = Color(0xFFD94452);

/// Slide-in safety alert. Shown ONLY while "Get alerts near my area" is on
/// AND the user has a current location/zone.
class BroadcastBanner extends StatefulWidget {
  const BroadcastBanner({super.key, required this.sync});
  final GeoAlertSync sync;
  @override
  State<BroadcastBanner> createState() => _BroadcastBannerState();
}

class _BroadcastBannerState extends State<BroadcastBanner> {
  Timer? timer;
  Map? current;
  int dismissed = 0;
  bool wasEnabled = false;

  @override
  void initState() {
    super.initState();
    wasEnabled = widget.sync.alertsEnabled;
    widget.sync.addListener(onSync);
    poll();
    timer = Timer.periodic(const Duration(seconds: 5), (_) => poll());
  }

  @override
  void dispose() {
    widget.sync.removeListener(onSync);
    timer?.cancel();
    super.dispose();
  }

  // poll right away when the user flips the toggle on
  void onSync() {
    final on = widget.sync.alertsEnabled;
    if (on && !wasEnabled) poll();
    wasEnabled = on;
  }

  Future<void> poll() async {
    final z = widget.sync.zoneId;
    // needs: toggle on AND a current location/zone
    if (!widget.sync.alertsEnabled || z == null) {
      if (current != null && mounted) setState(() => current = null);
      return;
    }
    try {
      final uri = Uri.parse('${widget.sync.baseUrl}/broadcasts/latest')
          .replace(queryParameters: {'zone': z});
      final r = await http.get(uri).timeout(const Duration(seconds: 4));
      if (r.statusCode != 200 || !mounted) return;
      final b = (jsonDecode(r.body) as Map)['broadcast'];
      if (b is Map && (b['id'] as int) > dismissed && current?['id'] != b['id']) {
        HapticFeedback.heavyImpact();
        setState(() => current = b);
      }
    } catch (_) {/* offline: keep whatever is showing */}
  }

  String hhmm(String iso) {
    final t = DateTime.tryParse(iso)?.toLocal();
    return t == null ? '' : '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.sync,
      builder: (context, _) {
        final b = (widget.sync.alertsEnabled && widget.sync.zoneId != null) ? current : null;
        return AnimatedSwitcher(
          duration: const Duration(milliseconds: 450),
          switchInCurve: Curves.easeOutBack,
          transitionBuilder: (w, a) => SlideTransition(
            position: Tween(begin: const Offset(0, -1.2), end: Offset.zero).animate(a),
            child: FadeTransition(opacity: a, child: w),
          ),
          child: b == null
              ? const SizedBox.shrink(key: ValueKey('none'))
              : Padding(
                  key: ValueKey(b['id']),
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: Material(
                    color: Colors.transparent,
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1B2B3F),
                        borderRadius: BorderRadius.circular(26),
                        border: Border.all(color: _red, width: 1.5),
                        boxShadow: [BoxShadow(color: _red.withAlpha(90), blurRadius: 24)],
                      ),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 38, height: 38,
                          decoration: const BoxDecoration(color: _red, shape: BoxShape.circle),
                          child: const Icon(Icons.campaign_rounded, color: Colors.white, size: 21),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${b['severity']} RISK · SAFETY ALERT',
                                style: const TextStyle(color: _lime, fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 1)),
                            const SizedBox(height: 3),
                            Text('${b['message']}',
                                style: const TextStyle(color: Colors.white, fontSize: 13.5, height: 1.3, fontWeight: FontWeight.w600)),
                            const SizedBox(height: 4),
                            Text('Updated ${hhmm('${b['sent_at']}')}',
                                style: const TextStyle(color: Colors.white54, fontSize: 11.5)),
                          ]),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 20),
                          onPressed: () => setState(() {
                            dismissed = b['id'] as int;
                            current = null;
                          }),
                        ),
                      ]),
                    ),
                  ),
                ),
        );
      },
    );
  }
}