import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme.dart';

class Incident {
  final String id, type, location, severity, status;
  final double lat, lon, distance, confidence, density, velocity;
  final String movement;
  final double? riskScore;
  final Map<String, double>? factors;
  final String? guidance;
  final String? explanation;
  final bool live;

  Incident(
    this.id,
    this.type,
    this.location,
    this.lat,
    this.lon,
    this.distance,
    this.severity,
    this.confidence,
    this.status,
    this.density,
    this.movement,
    this.velocity,
    this.riskScore,
    this.factors,
    this.guidance,
    this.explanation,
    this.live,
  );

  factory Incident.fromJson(Map j) {
    final velocity = (j['velocity'] ?? 0.3).toDouble();
    return Incident(
      j['id'].toString(),
      j['type'] ?? 'Incident',
      j['location'] ?? '',
      (j['latitude'] as num).toDouble(),
      (j['longitude'] as num).toDouble(),
      (j['distance'] ?? 0).toDouble(),
      (j['severity'] ?? 'MEDIUM').toString().toUpperCase(),
      (j['confidence'] ?? 0).toDouble(),
      j['status'] ?? 'ACTIVE',
      (j['density'] ?? 0.0).toDouble(),
      _movementFromVelocity(velocity),
      velocity,
      j['risk_score'] != null ? (j['risk_score'] as num).toDouble() : null,
      _factors(j['factors']),
      j['guidance']?.toString(),
      j['explanation']?.toString(),
      j['live'] == true,
    );
  }

  /// Client-side distance in kilometres from a default reference point (Andheri,
  /// Mumbai). Used only when the backend does not supply a distance so the map UI
  /// still has a meaningful "X km away" reading. It is never presented as backend
  /// data.
  double get displayDistance {
    if (distance > 0) return distance;
    const ref = LatLng(19.0760, 72.8777);
    return _haversineKm(lat, lon, ref.latitude, ref.longitude);
  }

  /// Travel-time estimate derived from the client-side distance only.
  int get displayMinutes => (displayDistance * 2).round().clamp(1, 999);

  static double _haversineKm(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371.0;
    final dLat = (lat2 - lat1) * math.pi / 180;
    final dLon = (lon2 - lon1) * math.pi / 180;
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180) *
            math.cos(lat2 * math.pi / 180) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return r * c;
  }

  static String _movementFromVelocity(double v) {
    if (v < 0.2) return 'Very slow';
    if (v < 0.4) return 'Slow';
    if (v < 0.65) return 'Normal';
    return 'Fast';
  }

  static Map<String, double>? _factors(dynamic f) {
    if (f is! Map) return null;
    return {
      for (final e in f.entries)
        e.key.toString(): (e.value as num).toDouble(),
    };
  }

  bool get high => severity == 'HIGH';
  Color get color => high ? kRed : kAmber;
  IconData get icon =>
      type.contains('Crowd')
          ? Icons.groups_rounded
          : type.contains('Accident') ? Icons.car_crash_rounded : Icons.luggage_rounded;
  String get summary =>
      type.contains('Crowd')
          ? 'Heavy congestion detected'
          : type.contains('Accident')
              ? 'Vehicles blocking the road'
              : 'Unattended bag under review';
  String get action =>
      type.contains('Crowd')
          ? 'Avoid $location and use an alternate entry.'
          : type.contains('Accident')
              ? 'Expect delays. Take an alternate road.'
              : 'Keep clear of $location until cleared.';
}

/// Lightweight 2D point used only for client-side distance rendering.
class LatLng {
  final double latitude;
  final double longitude;
  const LatLng(this.latitude, this.longitude);
}

