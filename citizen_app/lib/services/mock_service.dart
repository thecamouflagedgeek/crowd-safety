import '../models/incident.dart';

class Mock {
  static List<Incident> incidents() => [
        Incident('INC001', 'Crowd Anomaly', 'Gate 3', 19.076, 72.877, 15, 'HIGH', .91, 'ACTIVE', .86, 'Very slow'),
        Incident('INC002', 'Traffic Accident', 'Junction A', 19.082, 72.891, 8, 'HIGH', .87, 'ACTIVE', .40, 'Stopped'),
        Incident('INC003', 'Unattended Baggage', 'Station B', 19.090, 72.900, 21, 'MEDIUM', .82, 'ACTIVE', .15, 'Normal'),
      ];

  static List<Map> advisories() => [
        {'title': 'Gate 3 is experiencing severe congestion.', 'body': 'Avoid the area until further notice.', 'source': 'Event Authority', 'time': '18:23'},
        {'title': 'Accident at Junction A', 'body': 'Traffic police on site. Use the service road.', 'source': 'City Traffic Police', 'time': '18:10'},
      ];

  static Map verify(String claim) {
    final bad = claim.toLowerCase().contains('closed');
    return bad
        ? {'verdict': 'UNVERIFIED', 'confidence': .28, 'sources': {'cctv': 'no', 'citizen': 'no', 'official': 'no', 'news': 'partial'}}
        : {'verdict': 'VERIFIED', 'confidence': .94, 'sources': {'cctv': 'yes', 'citizen': 'yes', 'official': 'yes', 'news': 'yes'}};
  }

  static Map chat(String msg, Incident? i) => {
        'reply': i == null
            ? 'Nearby CCTV shows 2 high-risk incidents. Open one for details.'
            : 'Current CCTV analysis indicates ${i.summary.toLowerCase()} at ${i.location}. I recommend avoiding the area and using the alternate route.'
      };

  static Map route(Incident i) => {
        'avoid': i.location,
        'via': 'Gate 5',
        'explanation': '${i.location} is currently classified as ${i.severity} risk. Use the alternate route through Gate 5.'
      };
}
