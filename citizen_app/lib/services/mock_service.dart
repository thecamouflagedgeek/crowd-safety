import '../models/incident.dart';

/// Curated Mumbai demo feed — used only when the PS-06 backend is unreachable.
///
/// All incidents carry demo=true, live=false so the UI can clearly label them
/// as DEMO SCENARIO rather than LIVE. Locations, coordinates and event contexts
/// are realistic Mumbai public-safety scenarios.
///
/// This data is NEVER mixed with real backend responses.
class Mock {
  static List<Incident> incidents() => [
        Incident(
          id: 'DEMO001',
          eventName: 'Ganpati Visarjan',
          eventType: 'Religious Procession',
          type: 'Crowd Anomaly',
          location: 'Girgaum Chowpatty',
          city: 'Mumbai',
          lat: 18.9545,
          lon: 72.8142,
          distance: 0,
          severity: 'MEDIUM',
          confidence: 0.88,
          status: 'RECENT',
          density: 54,
          movement: 'Slow',
          velocity: 0.32,
          live: false,
          demo: true,
          riskScore: 0.52,
          factors: {
            'density': 0.54,
            'motion_anomaly': 0.48,
            'persistence': 0.60,
            'citizen_reports': 0.45,
          },
          guidance:
              'Ganesh Visarjan procession has concluded at Girgaum Chowpatty. '
              'Residual crowd activity may be present. Movement is returning to normal.',
          explanation: 'MEDIUM risk — DEMO SCENARIO. Crowd density moderate, movement recovering.',
          sourceName: 'Curated Event Dataset',
          sourceType: 'DEMO_DATASET',
          observedAt: '2026-09-25T18:30:00',
          validFrom: '2026-09-25T00:00:00',
          validUntil: '2026-09-25T23:59:59',
        ),
        Incident(
          id: 'DEMO002',
          eventName: 'Political Rally',
          eventType: 'Public Rally',
          type: 'Crowd Anomaly',
          location: 'Azad Maidan',
          city: 'Mumbai',
          lat: 18.9392,
          lon: 72.8347,
          distance: 0,
          severity: 'HIGH',
          confidence: 0.91,
          status: 'ACTIVE',
          density: 76,
          movement: 'Very slow',
          velocity: 0.18,
          live: false,
          demo: true,
          riskScore: 0.74,
          factors: {
            'density': 0.76,
            'motion_anomaly': 0.70,
            'persistence': 0.82,
            'citizen_reports': 0.65,
          },
          guidance:
              'Large political rally active at Azad Maidan. CCTV analysis shows elevated '
              'crowd density and slowed movement. Avoid the area. Use alternate routes via CST Road.',
          explanation: 'HIGH risk — DEMO SCENARIO. Elevated density and sustained crowd anomaly.',
          sourceName: 'Curated Event Dataset',
          sourceType: 'DEMO_DATASET',
        ),
        Incident(
          id: 'DEMO003',
          eventName: 'Traffic Accident',
          eventType: 'Road Incident',
          type: 'Traffic Disruption',
          location: 'Marine Drive Junction',
          city: 'Mumbai',
          lat: 18.9436,
          lon: 72.8237,
          distance: 0,
          severity: 'MEDIUM',
          confidence: 0.85,
          status: 'ACTIVE',
          density: 38,
          movement: 'Slow',
          velocity: 0.35,
          live: false,
          demo: true,
          riskScore: 0.48,
          factors: {
            'density': 0.38,
            'motion_anomaly': 0.55,
            'persistence': 0.50,
            'citizen_reports': 0.42,
          },
          guidance:
              'Traffic disruption near Marine Drive Junction. Lane restrictions reported. '
              'Expect delays. Use Netaji Subhash Chandra Bose Road as alternate route.',
          explanation: 'MEDIUM risk — DEMO SCENARIO. Reduced movement near junction.',
          sourceName: 'Curated Event Dataset',
          sourceType: 'DEMO_DATASET',
        ),
        Incident(
          id: 'DEMO004',
          eventName: 'Unattended Baggage',
          eventType: 'Security Alert',
          type: 'Unattended Object',
          location: 'CSMT',
          city: 'Mumbai',
          lat: 18.9398,
          lon: 72.8355,
          distance: 0,
          severity: 'MEDIUM',
          confidence: 0.82,
          status: 'ACTIVE',
          density: 22,
          movement: 'Normal',
          velocity: 0.51,
          live: false,
          demo: true,
          riskScore: 0.38,
          factors: {
            'density': 0.22,
            'motion_anomaly': 0.40,
            'persistence': 0.45,
            'citizen_reports': 0.50,
          },
          guidance:
              'Unattended baggage reported at CSMT. Railway Police on site. '
              'Avoid Platform 4. Follow station staff instructions.',
          explanation: 'MEDIUM risk — DEMO SCENARIO. Unverified unattended object.',
          sourceName: 'Curated Event Dataset',
          sourceType: 'DEMO_DATASET',
        ),
        Incident(
          id: 'DEMO005',
          eventName: 'Festival Gathering',
          eventType: 'Cultural Festival',
          type: 'Crowd Anomaly',
          location: 'Lalbaug',
          city: 'Mumbai',
          lat: 18.9648,
          lon: 72.8358,
          distance: 0,
          severity: 'MEDIUM',
          confidence: 0.83,
          status: 'ACTIVE',
          density: 51,
          movement: 'Slow',
          velocity: 0.38,
          live: false,
          demo: true,
          riskScore: 0.50,
          factors: {
            'density': 0.51,
            'motion_anomaly': 0.46,
            'persistence': 0.55,
            'citizen_reports': 0.44,
          },
          guidance:
              'Festival gathering detected near Lalbaug. Moderate crowd activity. '
              'Pedestrian movement slower than normal. Allow extra travel time.',
          explanation: 'MEDIUM risk — DEMO SCENARIO. Moderate crowd density at festival.',
          sourceName: 'Curated Event Dataset',
          sourceType: 'DEMO_DATASET',
        ),
      ];

  static List<Map<String, dynamic>> advisories() => [
        {
          'id': 'ADV001',
          'incident_id': 'DEMO001',
          'message':
              'Ganesh Visarjan procession has concluded at Girgaum Chowpatty. '
              'Area is returning to normal. Traffic police managing dispersal.',
          'severity': 'LOW',
          'location': 'Girgaum Chowpatty',
          'issued_by': 'Mumbai Police',
          'timestamp': '2026-09-25T20:15:00',
          'status': 'PUBLISHED',
        },
        {
          'id': 'ADV002',
          'incident_id': 'DEMO002',
          'message':
              'Avoid Azad Maidan. Large political rally active. '
              'Use alternate routes via CST Road. Traffic police on site.',
          'severity': 'HIGH',
          'location': 'Azad Maidan',
          'issued_by': 'Mumbai Traffic Police',
          'timestamp': '2026-10-01T09:00:00',
          'status': 'PUBLISHED',
        },
      ];

  static Map<String, dynamic> verify(String claim) {
    final lower = claim.toLowerCase();
    final bad = lower.contains('closed') || lower.contains('blocked');
    return bad
        ? {
            'status': 'UNVERIFIED',
            'confidence': 0.28,
            'severity': 'HIGH',
            'impact': 'Insufficient supporting evidence',
            'supporting_sources': <Map>[],
            'incident_id': 'DEMO002',
            'location': 'Azad Maidan',
            'intents': ['CLOSURE'],
            'corroborating_news': <Map>[],
            'news_providers': {'serpapi': false, 'newsapi': false},
            'news_queries': <String>[],
            'submitted_url': null,
          }
        : {
            'status': 'VERIFIED',
            'confidence': 0.91,
            'severity': 'HIGH',
            'impact': 'HIGH congestion confirmed at Azad Maidan',
            'supporting_sources': [
              {'label': 'CCTV Camera 01'},
              {'label': 'Mumbai Police'},
              {'label': 'Citizen Report C014'},
            ],
            'incident_id': 'DEMO002',
            'location': 'Azad Maidan',
            'intents': ['CONGESTION'],
            'corroborating_news': [
              {
                'title': 'Heavy crowd near Azad Maidan as rally draws large turnout',
                'label': 'News Feed N003',
                'url': '#',
                'provider': 'serpapi',
                'status': 'REPORTED',
                'timestamp': '09:20',
                'locality_match': true,
              }
            ],
            'news_providers': {'serpapi': true, 'newsapi': true},
            'news_queries': ['Azad Maidan rally crowd', 'Azad Maidan congestion'],
            'submitted_url': null,
          };
  }

  static Map<String, dynamic> chat(String msg, Incident? i) => {
        'reply': i == null
            ? 'Nearby CCTV feeds show active incidents in Mumbai. Open one for current details and guidance.'
            : 'Current analysis for ${i.eventName} at ${i.location}: ${i.summary.toLowerCase()}. '
                '${i.guidance ?? i.action}',
        'source': 'demo_fallback',
        'model': null,
        'grounded_on': i?.id,
      };

  static Map<String, dynamic> route(Incident i) => {
        'recommended': i.severity == 'HIGH',
        'incident_id': i.id,
        'route': ['Current Location', 'Alternate Road', 'Safe Destination'],
        'reason':
            '${i.location} is currently classified as ${i.severity} risk. '
            '${i.guidance ?? 'Use the alternate route.'}',
        'destination': 'Safe Destination',
        'severity': i.severity,
        'distance_m': 1400.0,
        'duration_s': 120.0,
        'routing_engine': 'demo_fallback',
      };
}
