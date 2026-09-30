import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/incident.dart';
import 'mock_service.dart';

/// Run with: flutter run --dart-define=API=http://192.168.x.x:8000
class Api {
  static const base = String.fromEnvironment('API', defaultValue: '');
  static const _h = {'Content-Type': 'application/json'};

  static Future<T> _go<T>(Future<T> Function() real, T Function() mock) async {
    if (base.isEmpty) return mock();
    try {
      return await real().timeout(const Duration(seconds: 3));
    } catch (_) {
      return mock();
    }
  }

  static Future<dynamic> _get(String p) async {
    final r = await http.get(Uri.parse('$base$p'));
    if (r.statusCode != 200) throw Exception(r.statusCode);
    return jsonDecode(r.body);
  }

  static Future<Map> _post(String p, Map body) async {
    final r = await http.post(Uri.parse('$base$p'), headers: _h, body: jsonEncode(body));
    if (r.statusCode != 200) throw Exception(r.statusCode);
    return jsonDecode(r.body);
  }

  static Future<List<Incident>> incidents() => _go(
      () async => ((await _get('/incidents')) as List).map((e) => Incident.fromJson(e)).toList(),
      Mock.incidents);

  static Future<List<Map>> advisories() =>
      _go(() async => ((await _get('/advisories')) as List).cast<Map>(), Mock.advisories);

  static Future<Map> verify(String claim) =>
      _go(() => _post('/verify', {'claim': claim}), () => Mock.verify(claim));

  static Future<Map> chat(String msg, Incident? i) => _go(
      () => _post('/chat', {'message': msg, 'incident_id': i?.id, 'incident': i == null ? null : {'type': i.type, 'location': i.location, 'severity': i.severity}}),
      () => Mock.chat(msg, i));

  static Future<Map> route(Incident i) =>
      _go(() => _post('/route', {'incident_id': i.id, 'avoid': i.location}), () => Mock.route(i));
}
