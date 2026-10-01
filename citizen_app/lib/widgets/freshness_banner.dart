import 'package:flutter/material.dart';

import '../services/geo_alert_sync.dart';

String _hhmm(DateTime t) {
  final l = t.toLocal();
  return '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
}

/// Never show cached data as live: LIVE / STALE / OFFLINE / NO DATA, always with a time.
class FreshnessBanner extends StatelessWidget {
  const FreshnessBanner({super.key, required this.sync});
  final GeoAlertSync sync;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: sync,
      builder: (context, _) {
        final t = sync.lastSyncedAt;
        final age = t == null ? null : DateTime.now().difference(t);

        late final Color color;
        late final String label;
        late final String detail;

        if (t == null) {
          color = Colors.grey;
          label = 'NO DATA YET';
          detail = 'Connect once to download safety information';
        } else if (!sync.online) {
          color = const Color(0xFFF59A1F);
          label = 'OFFLINE';
          detail = 'Last synced ${_hhmm(t)} · showing saved safety info';
        } else if (age! > GeoAlertSync.staleAfter) {
          color = const Color(0xFFCA8A04);
          label = 'STALE';
          detail = 'Last synced ${_hhmm(t)}';
        } else {
          color = const Color(0xFF17A673);
          label = 'LIVE';
          detail = 'Synced ${_hhmm(t)}';
        }

        final queued = sync.pendingReportCount;

        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: color.withOpacity(.12),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: color.withOpacity(.45)),
          ),
          child: Row(
            children: [
              Container(width: 9, height: 9, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              const SizedBox(width: 10),
              Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  queued > 0 ? '$detail · $queued report${queued == 1 ? '' : 's'} queued' : detail,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Shows alerts the server matched to the user's last known zone.
/// Wording is deliberate: "last known safety zone", never "your location".
class ZoneAlertCard extends StatelessWidget {
  const ZoneAlertCard({super.key, required this.sync, this.onOpenAdvisory});
  final GeoAlertSync sync;
  final VoidCallback? onOpenAdvisory;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: sync,
      builder: (context, _) {
        final alerts = sync.snapshot?.alerts ?? const [];
        if (alerts.isEmpty) return const SizedBox.shrink();
        final a = alerts.last;
        final stale = !sync.online;
        return Card(
          color: const Color(0xFFFFF1F2),
          child: ListTile(
            leading: const Icon(Icons.warning_amber_rounded, color: Color(0xFFD94452)),
            title: Text('${a['severity']} risk near your last known safety zone',
                style: const TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text(
              'Avoid the affected area and follow the official advisory.\n'
              '${stale ? 'Saved alert from' : 'Updated'} ${a['sent_at']}',
            ),
            isThreeLine: true,
            trailing: onOpenAdvisory == null ? null : const Icon(Icons.chevron_right),
            onTap: onOpenAdvisory,
          ),
        );
      },
    );
  }
}