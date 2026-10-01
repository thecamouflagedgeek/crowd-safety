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
  static Future<T> _go<T>(Future<T> Function() real, T Function() mock) async {
    if (base.isEmpty) return mock();
    try {
      return await real().timeout(const Duration(seconds: 6));
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
      () => Mock.incidents());

  /// GET /advisories  →  {"advisories": [...]}
  static Future<List<Map>> advisories() => _go(
      () async {
        final data = await _get('/advisories');
        final list = data['advisories'];
        if (list is! List) throw Exception('Unexpected /advisories shape');
        return list.map((e) => Map.from(e) as Map).toList();
      },
      () => Mock.advisories());

  /// POST /verify  →  {status, confidence, severity, impact, supporting_sources, ...}
  static Future<Map> verify(String claim, {String? location, String? incidentId}) =>
      _go(
          () => _post('/verify', {
                'claim': claim,
                if (location != null) 'location': location,
                if (incidentId != null) 'incident_id': incidentId,
              }),
          () => Mock.verify(claim));

  /// POST /chat  →  {reply, source, model, grounded_on}
  static Future<Map> chat(String msg, Incident? i) => _go(
      () => _post('/chat', {
            'message': msg,
            if (i != null) 'incident_id': i.id,
          }),
      () => Mock.chat(msg, i));

  /// POST /route  →  {recommended, route, reason, destination, severity, ...}
  static Future<Map> route(Incident i) => _go(
      () => _post('/route', {'incident_id': i.id}),
      () => Mock.route(i));
}
