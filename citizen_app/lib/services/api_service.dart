import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/incident.dart';
import 'mock_service.dart';

/// Centralized API client for the PS 06 backend.
///
/// Configure the backend base URL with:
///   flutter run --dart-define=API=http://10.0.2.2:8000
///
/// Default for Android emulator reaches the host machine at 10.0.2.2:8000.
/// When the backend is unreachable the service falls back to an internal demo
/// mock so the app never shows a blank screen. The mock path is clearly
/// demo-only and is never mixed with real responses.
class Api {
  static const base = String.fromEnvironment(
    'API',
    defaultValue: 'http://10.0.2.2:8000',
  );
  static const _h = {'Content-Type': 'application/json'};

  /// Returns [real] when the backend is reachable, otherwise the controlled
  /// demo [mock]. A blank [base] forces the demo path (useful for pure offline
  /// previews). Real/mock responses are never interleaved.
  static Future<T> _go<T>(Future<T> Function() real, T Function() mock,
      {Duration timeout = const Duration(seconds: 6)}) async {
    if (base.isEmpty) return mock();
    try {
      return await real().timeout(timeout);
    } catch (_) {
      return mock();
    }
  }

  static Future<dynamic> _get(String p) async {
    final r = await http.get(Uri.parse('$base$p'));
    if (r.statusCode != 200) throw Exception('${r.statusCode} ${r.body}');
    return jsonDecode(r.body);
  }

  static Future<Map> _post(String p, Map body) async {
    final r = await http.post(Uri.parse('$base$p'), headers: _h, body: jsonEncode(body));
    if (r.statusCode != 200) throw Exception('${r.statusCode} ${r.body}');
    return jsonDecode(r.body);
  }

  /// GET /incidents  →  {"incidents": [...]}
  static Future<List<Incident>> incidents() => _go(
      () async {
        final data = await _get('/incidents');
        final list = data['incidents'];
        if (list is! List) throw Exception('Unexpected /incidents shape');
        return list.map((e) => Incident.fromJson(Map.from(e))).toList();
      },
      () => Mock.incidents);

  /// GET /incidents/{id}  →  the authoritative detail record for one incident
  /// (already merged with live CV telemetry by the backend).
  static Future<Incident?> incident(String id) => _go(
      () async {
        final data = await _get('/incidents/$id');
        if (data is! Map) throw Exception('Unexpected /incidents/$id shape');
        return Incident.fromJson(Map.from(data));
      },
      () => Mock.incidents().firstWhere((e) => e.id == id, orElse: () => Mock.incidents().first));

  /// GET /advisories  →  {"advisories": [...]}
  static Future<List<Map>> advisories() => _go(
      () async {
        final data = await _get('/advisories');
        final list = data['advisories'];
        if (list is! List) throw Exception('Unexpected /advisories shape');
        return list.map((e) => Map.from(e) as Map).toList();
      },
      () => Mock.advisories);

  /// POST /verify  →  {status, confidence, severity, impact, supporting_sources, ...}
  ///
  /// The backend is the source of truth: the app never derives or invents a
  /// verdict. A pasted link/reel is forwarded as `url` (recorded only, never
  /// scraped and never treated as proof on its own).
  static Future<Map> verify(String claim,
          {String? location, String? incidentId, String? url}) =>
      _go(
          () => _post('/verify', {
                'claim': claim,
                if (location != null) 'location': location,
                if (incidentId != null) 'incident_id': incidentId,
                if (url != null) 'url': url,
              }),
          () => Mock.verify(claim));

  /// GET /news?incident_id=&location=  →  location-scoped public-safety items.
  ///
  /// Every item is status REPORTED (corroboration only). Longer timeout because
  /// the backend fans out to SerpApi + NewsAPI.
  static Future<List<Map>> news({String? incidentId, String? location}) => _go(
      () async {
        final q = <String>[
          if (incidentId != null) 'incident_id=$incidentId',
          if (location != null) 'location=${Uri.encodeQueryComponent(location)}',
        ];
        final data = await _get('/news${q.isEmpty ? '' : '?${q.join('&')}'}');
        final list = data['items'];
        if (list is! List) throw Exception('Unexpected /news shape');
        return list.map((e) => Map.from(e) as Map).toList();
      },
      () => const <Map>[],
      timeout: const Duration(seconds: 12));

  /// POST /chat  →  {reply, source, model, grounded_on}
  static Future<Map> chat(String msg, Incident? i) => _go(
      () => _post('/chat', {
            'message': msg,
            if (i != null) 'incident_id': i.id,
          }),
      () => Mock.chat(msg, i));

  /// POST /route  →  {recommended, route, reason, destination, severity, ...}
  ///
  /// Sends the citizen's location so the backend can return a real OSRM
  /// distance/duration, and falls back to its deterministic route when OSRM is
  /// unavailable.
  static Future<Map> route(Incident i, {double? userLat, double? userLon}) => _go(
      () => _post('/route', {
            'incident_id': i.id,
            if (userLat != null) 'user_lat': userLat,
            if (userLon != null) 'user_lon': userLon,
          }),
      () => Mock.route(i));
}
