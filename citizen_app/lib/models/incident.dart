import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme.dart';

class Incident {
  // ── Core identity ────────────────────────────────────────────────────
  final String id;

  /// Human/public context — e.g. "Ganpati Visarjan", "Political Rally"
  final String eventName;

  /// Broad category — e.g. "Religious Procession", "Public Event"
  final String eventType;

  /// CV classification — e.g. "Crowd Anomaly", "Traffic Disruption"
  final String type;

  // ── Location ─────────────────────────────────────────────────────────
  final String location;
  final String city;
  final double lat, lon;

  /// Backend-supplied distance (km). 0 means not supplied — use displayDistance.
  final double distance;

  // ── Risk ──────────────────────────────────────────────────────────────
  final String severity;
  final double confidence;
  final double density;
  final double velocity;
  final String movement;
  final double? riskScore;
  final Map<String, double>? factors;

  // ── Lifecycle ─────────────────────────────────────────────────────────
  final String status;
  final String? guidance;
  final String? explanation;

  // ── Source provenance ────────────────────────────────────────────────
  /// true  → produced by live OpenCV/YOLO pipeline right now
  /// false → seed data or demo scenario
  final bool live;

  /// true  → curated demo scenario from the backend demo engine
  final bool demo;

  final String? sourceName;
  final String? sourceType;
  final String? observedAt;
  final String? validFrom;
  final String? validUntil;

  const Incident({
    required this.id,
    required this.eventName,
    required this.eventType,
    required this.type,
    required this.location,
    required this.city,
    required this.lat,
    required this.lon,
    required this.distance,
    required this.severity,
    required this.confidence,
    required this.status,
    required this.density,
    required this.movement,
    required this.velocity,
    required this.live,
    required this.demo,
    this.riskScore,
    this.factors,
    this.guidance,
    this.explanation,
    this.sourceName,
    this.sourceType,
    this.observedAt,
    this.validFrom,
    this.validUntil,
  });

  factory Incident.fromJson(Map<String, dynamic> j) {
    final velocity = (j['velocity'] ?? 0.3).toDouble();
    final type = (j['type'] ?? 'Incident').toString();

    // event_name falls back to type if not provided by backend
    final eventName = j['event_name']?.toString().isNotEmpty == true
        ? j['event_name'].toString()
        : type;

    // event_type falls back to a category derived from type
    final eventType = j['event_type']?.toString().isNotEmpty == true
        ? j['event_type'].toString()
        : _categoryFromType(type);

    return Incident(
      id: j['id'].toString(),
      eventName: eventName,
      eventType: eventType,
      type: type,
      location: (j['location'] ?? '').toString(),
      city: (j['city'] ?? 'Mumbai').toString(),
      lat: (j['latitude'] as num).toDouble(),
      lon: (j['longitude'] as num).toDouble(),
      distance: (j['distance'] ?? 0).toDouble(),
      severity: (j['severity'] ?? 'MEDIUM').toString().toUpperCase(),
      confidence: (j['confidence'] ?? 0).toDouble(),
      status: (j['status'] ?? 'ACTIVE').toString(),
      density: (j['density'] ?? 0.0).toDouble(),
      movement: _movementFromVelocity(velocity),
      velocity: velocity,
      live: j['live'] == true,
      demo: j['demo'] == true,
      riskScore: j['risk_score'] != null ? (j['risk_score'] as num).toDouble() : null,
      factors: _factors(j['factors']),
      guidance: j['guidance']?.toString(),
      explanation: j['explanation']?.toString(),
      sourceName: j['source_name']?.toString(),
      sourceType: j['source_type']?.toString(),
      observedAt: j['observed_at']?.toString(),
      validFrom: j['valid_from']?.toString(),
      validUntil: j['valid_until']?.toString(),
    );
  }

  // ── Distance helpers ─────────────────────────────────────────────────

  /// Compute display distance from a given user position.
  /// Falls back to the hardcoded Mumbai reference if userLat/userLon are null.
  double distanceFrom(double? userLat, double? userLon) {
    if (distance > 0) return distance;
    final fromLat = userLat ?? _kRefLat;
    final fromLon = userLon ?? _kRefLon;
    return _haversineKm(lat, lon, fromLat, fromLon);
  }

  /// Distance from the default Andheri reference point (used when no GPS).
  double get displayDistance {
    if (distance > 0) return distance;
    return _haversineKm(lat, lon, _kRefLat, _kRefLon);
  }

  /// Travel-time estimate derived from the display distance.
  int get displayMinutes => (displayDistance * 2).round().clamp(1, 999);

  // ── Reference point (Andheri, Mumbai) ───────────────────────────────
  // Used only as GPS fallback. Never presented as backend data.
  static const _kRefLat = 19.0760;
  static const _kRefLon = 72.8777;

  // Keep legacy static accessors so existing call-sites (guidance_screen) still compile.
  static const refLat = _kRefLat;
  static const refLon = _kRefLon;

  // ── Status badge logic ───────────────────────────────────────────────

  /// The label shown on cards and detail screens.
  /// Never calls a demo scenario "LIVE".
  String get statusLabel {
    if (live && !demo) return 'LIVE';
    if (status == 'RECENT') return 'RECENT';
    if (demo) return 'DEMO';
    if (status == 'PLANNED') return 'PLANNED';
    return 'FEED';
  }

  bool get isLive => live && !demo;
  bool get isDemo => demo;
  bool get isRecent => status == 'RECENT';

  // ── Derived visual helpers ────────────────────────────────────────────
  bool get high => severity == 'HIGH' || severity == 'CRITICAL';
  Color get color => high ? kRed : kAmber;

  IconData get icon {
    final t = type.toLowerCase();
    if (t.contains('crowd') || t.contains('protest') || t.contains('visarjan') || t.contains('rally') || t.contains('event')) {
      return Icons.groups_rounded;
    }
    if (t.contains('traffic') || t.contains('accident') || t.contains('transit')) {
      return Icons.car_crash_rounded;
    }
    if (t.contains('baggage') || t.contains('object') || t.contains('security')) {
      return Icons.luggage_rounded;
    }
    return Icons.warning_rounded;
  }

  String get summary {
    final t = type.toLowerCase();
    if (t.contains('crowd') || t.contains('protest') || t.contains('rally') || t.contains('visarjan')) {
      return 'Heavy crowd congestion detected';
    }
    if (t.contains('traffic') || t.contains('accident')) return 'Vehicles blocking the road';
    if (t.contains('transit')) return 'Transit disruption in progress';
    if (t.contains('baggage') || t.contains('object')) return 'Unattended object under review';
    return 'Public safety incident detected';
  }

  String get action {
    final t = type.toLowerCase();
    if (t.contains('crowd') || t.contains('protest') || t.contains('rally') || t.contains('visarjan')) {
      return 'Avoid $location and use an alternate route.';
    }
    if (t.contains('traffic') || t.contains('accident')) return 'Expect delays. Take an alternate road.';
    if (t.contains('transit')) return 'Check service status before travelling.';
    if (t.contains('baggage') || t.contains('object')) return 'Keep clear of $location until cleared.';
    return guidance ?? 'Follow official guidance for $location.';
  }

  // ── Private helpers ───────────────────────────────────────────────────
  static double _haversineKm(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371.0;
    final dLat = (lat2 - lat1) * math.pi / 180;
    final dLon = (lon2 - lon1) * math.pi / 180;
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180) *
            math.cos(lat2 * math.pi / 180) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
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
      for (final e in f.entries) e.key.toString(): (e.value as num).toDouble(),
    };
  }

  static String _categoryFromType(String type) {
    final t = type.toLowerCase();
    if (t.contains('crowd') || t.contains('protest') || t.contains('rally')) return 'Crowd Event';
    if (t.contains('traffic') || t.contains('accident')) return 'Traffic Incident';
    if (t.contains('transit')) return 'Transit Disruption';
    if (t.contains('baggage') || t.contains('object')) return 'Security Alert';
    return 'Public Safety';
  }
}
