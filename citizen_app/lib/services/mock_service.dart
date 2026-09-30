import '../models/incident.dart';

/// Internal demo-only fallback used when the PS 06 backend is unreachable.
///
/// These responses are deliberately shaped like the real backend contracts so the
/// UI renders the same way in demo and live modes. They are NEVER mixed with real
/// responses — the API service returns either all-real or all-mock for a given call.
class Mock {
  static List<Incident> incidents() => [
        Incident(
          'INC001',
          'Crowd Anomaly',
          'Gate 3',
          19.076,
          72.877,
          0,
          'HIGH',
          0.91,
          'ACTIVE',
          86,
          'Very slow',
          0.16,
          0.81,
          {'density': 0.86, 'motion_anomaly': 0.72, 'persistence': 0.80, 'citizen_reports': 0.75},
          'Avoid Gate 3. Use Road B to Gate 5 as the alternate exit.',
          'HIGH risk driven mainly by increasing crowd density and sustained anomaly over time.',
          true,
        ),
        Incident(
          'INC002',
          'Traffic Accident',
          'Junction A',
          19.082,
          72.891,
          0,
          'HIGH',
          0.87,
          'ACTIVE',
          40,
          'Slow',
          0.61,
          0.52,
          {'density': 0.40, 'motion_anomaly': 0.66, 'persistence': 0.55, 'citizen_reports': 0.50},
          'Reduce speed near Junction A. Expect lane restrictions.',
          'MEDIUM risk from reduced movement near the junction.',
          true,
        ),
        Incident(
          'INC003',
          'Unattended Baggage',
          'Station B',
          19.090,
          72.900,
          0,
          'MEDIUM',
          0.82,
          'ACTIVE',
          15,
          'Normal',
          0.33,
          0.55,
          {'density': 0.41, 'motion_anomaly': 0.48, 'persistence': 0.62, 'citizen_reports': 0.60},
          'Avoid the marked area on Platform 4. Follow station staff instructions.',
          'MEDIUM risk from an unverified unattended object.',
          true,
        ),
      ];

  static List<Map> advisories() => [
        {
          'id': 'ADV001',
          'incident_id': 'INC001',
          'message': 'Severe congestion near Gate 3. Avoid the area and use Gate 5 via Road B.',
          'severity': 'HIGH',
          'location': 'Gate 3',
          'issued_by': 'Event Authority',
          'timestamp': '18:23',
          'status': 'PUBLISHED',
        },
        {
          'id': 'ADV002',
          'incident_id': 'INC002',
          'message': 'Accident at Junction A. Traffic police on site. Use the service road.',
          'severity': 'MEDIUM',
          'location': 'Junction A',
          'issued_by': 'City Traffic Police',
          'timestamp': '18:10',
          'status': 'PUBLISHED',
        },
      ];

  static Map verify(String claim) {
    final bad = claim.toLowerCase().contains('closed');
    return bad
        ? {
            'status': 'UNVERIFIED',
            'confidence': 0.28,
            'severity': 'HIGH',
            'impact': 'Insufficient supporting evidence',
            'supporting_sources': [],
            'incident_id': 'INC001',
            'location': 'Gate 3',
            'intents': ['CLOSURE'],
            'corroborating_news': [],
            'news_providers': {'serpapi': false, 'newsapi': false},
            'news_queries': [],
            'submitted_url': null,
          }
        : {
            'status': 'VERIFIED',
            'confidence': 0.94,
            'severity': 'HIGH',
            'impact': 'HIGH congestion near Gate 3',
            'supporting_sources': [
              {'label': 'CCTV Camera 01'},
              {'label': 'Event Authority'},
              {'label': 'Citizen Report C014'},
            ],
            'incident_id': 'INC001',
            'location': 'Gate 3',
            'intents': ['CONGESTION'],
            'corroborating_news': [
              {
                'title': 'Event venue reports unusually large evening crowd at north gate',
                'label': 'News Feed N003',
                'url': '#',
                'provider': 'serpapi',
                'status': 'REPORTED',
                'timestamp': '18:20',
                'locality_match': true,
              }
            ],
            'news_providers': {'serpapi': true, 'newsapi': true},
            'news_queries': ['Gate 3 crowd', 'Gate 3 crowd congestion'],
            'submitted_url': null,
          };
  }

  static Map chat(String msg, Incident? i) => {
        'reply': i == null
            ? 'Nearby CCTV shows 2 high-risk incidents. Open one for details.'
            : 'Current CCTV analysis indicates ${i.summary.toLowerCase()} at ${i.location}. I recommend avoiding the area and using the alternate route.',
        'source': 'fallback',
        'model': null,
        'grounded_on': i?.id,
      };

  static Map route(Incident i) => {
        'recommended': i.severity == 'HIGH',
        'incident_id': i.id,
        'route': ['Current Location', 'Road B', 'Gate 5'],
        'reason': '${i.location} is currently classified as ${i.severity} risk. Use the alternate route through Gate 5.',
        'destination': 'Gate 5',
        'severity': i.severity,
        'distance_m': 1196.2,
        'duration_s': 110.8,
        'routing_engine': 'deterministic_fallback',
      };
}
