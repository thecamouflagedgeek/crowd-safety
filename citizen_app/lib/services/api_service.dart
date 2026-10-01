import 'dart:convert';
import 'dart:developer' as dev;
import 'package:http/http.dart' as http;
import '../models/incident.dart';
import 'mock_service.dart';

/// Centralized API client for the PS-06 backend.
///
/// Configure the backend base URL:
///   flutter run --dart-define=API=http://127.0.0.1:8000        (Chrome / host)
///   flutter run --dart-define=API=http://10.0.2.2:8000         (Android emulator)
///
/// When the backend is unreachable the service falls back to the curated
/// Mumbai demo feed from MockService. The fallback is always explicitly
/// logged — the app never silently pretends the backend worked.
class Api {
  static const base = String.fromEnvironment(
    'API',
    defaultValue: 'http://127.0.0.1:8000',
  );
  static const _h = {'Content-Type': 'application/json'};

  // ── Internal helpers ────────────────────────────────────────────────

  static void _log(String msg) => dev.log(msg, name: 'API');

  /// Executes [real]. On any failure logs the error and returns [mock()].
  /// A blank [base] forces the demo path (pure offline preview).
  static Future<T> _go<T>(
    String label,
    Future<T> Function() real,
    T Function() mock, {
    Duration timeout = const Duration(seconds: 6),
  }) async {
    if (base.isEmpty) {
      _log('$label — base URL empty, using DEMO feed');
      return mock();
    }
    try {
      final result = await real().timeout(timeout);
      return result;
    } on Exception catch (e) {
      _log('$label — backend unavailable: $e');
      _log('$label — using DEMO feed');
      return mock();
    }
  }

  static Future<dynamic> _get(String path) async {
    _log('GET $base$path');
    final r = await http.get(Uri.parse('$base$path'));
    if (r.statusCode != 200) throw Exception('HTTP ${r.statusCode}: ${r.body}');
    return jsonDecode(r.body);
  }

  static Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    _log('POST $base$path');
    final r = await http.post(
      Uri.parse('$base$path'),
      headers: _h,
      body: jsonEncode(body),
    );
    if (r.statusCode != 200) throw Exception('HTTP ${r.statusCode}: ${r.body}');
    return Map<String, dynamic>.from(jsonDecode(r.body) as Map);
  }

  // ── Endpoints ────────────────────────────────────────────────────────

  /// GET /incidents → {"incidents": [...], "mode": "...", ...}
  static Future<List<Incident>> incidents() => _go(
        'GET /incidents',
        () async {
          final data = await _get('/incidents');
          if (data is! Map || data['incidents'] is! List) {
            throw Exception('Unexpected /incidents response shape');
          }
          final list = (data['incidents'] as List)
              .map((e) => Incident.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList();
          final mode = data['mode'] ?? 'unknown';
          final liveCount = data['live_count'] ?? 0;
          final demoCount = data['demo_count'] ?? 0;
          _log(
            'GET /incidents — mode=$mode live=$liveCount demo=$demoCount total=${list.length}',
          );
          return list;
        },
        () {
          final mock = Mock.incidents();
          _log('GET /incidents — using DEMO feed (${mock.length} incidents)');
          return mock;
        },
      );

  /// GET /incidents/{id} → the authoritative detail record for one incident
  static Future<Incident?> incident(String id) => _go(
        'GET /incidents/$id',
        () async {
          final data = await _get('/incidents/$id');
          if (data is! Map) throw Exception('Unexpected /incidents/$id shape');
          return Incident.fromJson(Map<String, dynamic>.from(data));
        },
        () {
          final all = Mock.incidents();
          return all.firstWhere((e) => e.id == id, orElse: () => all.first);
        },
      );

  /// GET /advisories → {"advisories": [...]}
  static Future<List<Map<String, dynamic>>> advisories() => _go(
        'GET /advisories',
        () async {
          final data = await _get('/advisories');
          if (data is! Map || data['advisories'] is! List) {
            throw Exception('Unexpected /advisories response shape');
          }
          final list = (data['advisories'] as List)
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
          _log('GET /advisories — received ${list.length}');
          return list;
        },
        () {
          final mock = Mock.advisories();
          _log('GET /advisories — using DEMO feed');
          return mock;
        },
      );

  /// POST /verify → {status, confidence, severity, impact, supporting_sources, ...}
  static Future<Map<String, dynamic>> verify(
    String claim, {
    String? location,
    String? incidentId,
    String? url,
  }) =>
      _go(
        'POST /verify',
        () => _post('/verify', {
          'claim': claim,
          if (location != null) 'location': location,
          if (incidentId != null) 'incident_id': incidentId,
          if (url != null) 'url': url,
        }),
        () => Mock.verify(claim),
      );

  /// GET /news → location-scoped public-safety items
  static Future<List<Map<String, dynamic>>> news({
    String? incidentId,
    String? location,
  }) =>
      _go(
        'GET /news',
        () async {
          final q = <String>[
            if (incidentId != null) 'incident_id=$incidentId',
            if (location != null) 'location=${Uri.encodeQueryComponent(location)}',
          ];
          final data = await _get('/news${q.isEmpty ? '' : '?${q.join('&')}'}');
          final list = data['items'];
          if (list is! List) throw Exception('Unexpected /news shape');
          return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        },
        () => const <Map<String, dynamic>>[],
        timeout: const Duration(seconds: 12),
      );

  /// POST /chat → {reply, source, model, grounded_on}
  static Future<Map<String, dynamic>> chat(String msg, Incident? i) => _go(
        'POST /chat',
        () => _post('/chat', {
          'message': msg,
          if (i != null) 'incident_id': i.id,
        }),
        () => Mock.chat(msg, i),
      );

  /// POST /route → {recommended, route, reason, destination, severity, ...}
  static Future<Map<String, dynamic>> route(
    Incident i, {
    double? userLat,
    double? userLon,
  }) =>
      _go(
        'POST /route',
        () => _post('/route', {
          'incident_id': i.id,
          if (userLat != null) 'user_lat': userLat,
          if (userLon != null) 'user_lon': userLon,
        }),
        () => Mock.route(i),
      );
}
