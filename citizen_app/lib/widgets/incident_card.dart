import 'package:flutter/material.dart';
import '../models/incident.dart';
import '../theme.dart';
import 'risk_badge.dart';

/// Status badge colours and labels.
const _kLiveBg = Color(0xFF1A3A2A);
const _kLiveFg = kGreen;
const _kDemoBg = Color(0xFF2A2A3A);
const _kDemoFg = Color(0xFFAAB4FF);
const _kRecentBg = Color(0xFF3A2A1A);
const _kRecentFg = Color(0xFFFFB347);
const _kPlannedBg = Color(0xFF1A2A3A);
const _kPlannedFg = Color(0xFF64B5F6);

class IncidentCard extends StatelessWidget {
  final Incident inc;
  final VoidCallback onTap;

  /// User GPS position — passed through so distance renders from real location.
  final double? userLat;
  final double? userLon;

  const IncidentCard(
    this.inc,
    this.onTap, {
    super.key,
    this.userLat,
    this.userLon,
  });

  // ── Status badge ─────────────────────────────────────────────────────────
  Widget _statusBadge() {
    final Color bg;
    final Color fg;
    final IconData icon;
    final String label;

    if (inc.isLive) {
      bg = _kLiveBg;
      fg = _kLiveFg;
      icon = Icons.sensors;
      label = 'LIVE';
    } else if (inc.isRecent) {
      bg = _kRecentBg;
      fg = _kRecentFg;
      icon = Icons.history_rounded;
      label = 'RECENT';
    } else if (inc.isDemo) {
      bg = _kDemoBg;
      fg = _kDemoFg;
      icon = Icons.science_outlined;
      label = 'DEMO';
    } else if (inc.status == 'PLANNED') {
      bg = _kPlannedBg;
      fg = _kPlannedFg;
      icon = Icons.event_rounded;
      label = 'PLANNED';
    } else {
      // Seed data that CV hasn't touched yet — show as FEED (not LIVE)
      bg = const Color(0xFF1A2A3A);
      fg = Colors.white70;
      icon = Icons.rss_feed_rounded;
      label = 'FEED';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 11, color: fg),
        const SizedBox(width: 4),
        Text(label,
            style:
                TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 10.5)),
      ]),
    );
  }

  @override
  Widget build(BuildContext c) {
    final dist = inc.distanceFrom(userLat, userLon);
    final distStr = dist >= 10
        ? '${dist.toStringAsFixed(0)} km'
        : '${dist.toStringAsFixed(1)} km';
    final mins = (dist * 2).round().clamp(1, 999);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(6, 0, 6, 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(30),
            boxShadow: softShadow),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start,
            children: [
          Row(children: [
            // Icon tile
            Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  gradient: LinearGradient(
                      colors: [inc.color, inc.color.withOpacity(.6)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight)),
              child: Stack(children: [
                Positioned(
                    right: -14,
                    bottom: -14,
                    child: Icon(inc.icon, size: 70, color: Colors.white.withOpacity(.25))),
                Center(child: Icon(inc.icon, color: Colors.white, size: 38)),
              ]),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Risk badge + status badge
                Row(children: [
                  RiskBadge(inc.severity, inc.color),
                  const SizedBox(width: 8),
                  _statusBadge(),
                ]),
                const SizedBox(height: 7),

                // Event name (human context) — primary title
                Text(
                  inc.eventName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w800,
                      color: kInk,
                      height: 1.1),
                ),

                // CV classification — secondary label
                if (inc.eventName != inc.type)
                  Text(
                    inc.type,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.black45),
                  ),

                const SizedBox(height: 3),

                // Location · distance · time
                Text(
                  '${inc.location} · $distStr · $mins min',
                  style: const TextStyle(color: Colors.black54, fontSize: 13),
                ),
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
                  style: FilledButton.styleFrom(
                      backgroundColor: kBlue, shape: const StadiumBorder()),
                  child: const Text('View incident',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Container(
              width: 50,
              height: 50,
              decoration:
                  const BoxDecoration(color: Color(0xFFE3EEFF), shape: BoxShape.circle),
              child: const Icon(Icons.alt_route, color: kBlue),
            ),
          ]),
        ]),
      ),
    );
  }
}
