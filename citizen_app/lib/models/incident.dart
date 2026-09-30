import 'package:flutter/material.dart';
import '../theme.dart';

class Incident {
  final String id, type, location, severity, status;
  final double lat, lon, distance, confidence, density;
  final String movement;
  Incident(this.id, this.type, this.location, this.lat, this.lon, this.distance,
      this.severity, this.confidence, this.status, this.density, this.movement);

  factory Incident.fromJson(Map j) => Incident(
      j['id'].toString(), j['type'] ?? 'Incident', j['location'] ?? '',
      (j['latitude'] as num).toDouble(), (j['longitude'] as num).toDouble(),
      (j['distance'] ?? 0).toDouble(), (j['severity'] ?? 'MEDIUM').toString().toUpperCase(),
      (j['confidence'] ?? 0).toDouble(), j['status'] ?? 'ACTIVE',
      (j['density'] ?? 0.0).toDouble(), j['movement'] ?? 'Slow');

  bool get high => severity == 'HIGH';
  Color get color => high ? kRed : kAmber;
  IconData get icon => type.contains('Crowd')
      ? Icons.groups_rounded
      : type.contains('Accident') ? Icons.car_crash_rounded : Icons.luggage_rounded;
  String get summary => type.contains('Crowd')
      ? 'Heavy congestion detected'
      : type.contains('Accident') ? 'Vehicles blocking the road' : 'Unattended bag under review';
  String get action => type.contains('Crowd')
      ? 'Avoid $location and use an alternate entry.'
      : type.contains('Accident') ? 'Expect delays. Take an alternate road.' : 'Keep clear of $location until cleared.';
}
