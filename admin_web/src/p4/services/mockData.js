// Seeded, deterministic mock data matching backend store for Golden Demo

export const DEFAULT_INCIDENT = {
  id: 'INC001',
  type: 'Crowd Anomaly',
  location: 'Gate 3',
  latitude: 19.076,
  longitude: 72.877,
  severity: 'HIGH',
  confidence: 0.91,
  density: 86,
  velocity: 0.24,
  status: 'ACTIVE',
  timestamp: '18:21',
  detected_at: '18:21:04 IST',
  risk_score: 0.88,
  description: 'Abnormally high crowd density detected with critically reduced movement velocity near Gate 3 turnstiles.',
  camera: 'Camera 01 · Gate 3'
}

export const INCIDENTS_LIST = [
  DEFAULT_INCIDENT,
  {
    id: 'INC002',
    type: 'Traffic Accident',
    location: 'Marine Drive Junction',
    latitude: 19.12,
    longitude: 72.91,
    severity: 'HIGH',
    confidence: 0.87,
    density: 42,
    velocity: 0.8,
    status: 'ACTIVE',
    timestamp: '17:49',
    detected_at: '17:48:32 IST',
    risk_score: 0.81,
    description: 'Two-vehicle collision blocking northbound lane causing rapid tailback.',
    camera: 'Traffic Cam 12'
  },
  {
    id: 'INC003',
    type: 'Unattended Baggage',
    location: 'CSMT Platform 4',
    latitude: 19.1197,
    longitude: 72.8468,
    severity: 'MEDIUM',
    confidence: 0.82,
    density: 30,
    velocity: 0.4,
    status: 'UNDER_VALIDATION',
    timestamp: '17:13',
    detected_at: '17:12:15 IST',
    risk_score: 0.64,
    description: 'Stationary unaccompanied backpack identified adjacent to bench for >10 mins.',
    camera: 'Station Cam 08'
  }
]

export const CAMERAS_CONFIG = [
  {
    id: 'cctv_01',
    label: 'CAMERA 01',
    location: 'Gate 3 · North Entry Corridor',
    streamUrl: '/videos/camera_01.mp4',
    status: 'LIVE / REC',
    fps: 30,
    resolution: '1080p @ 30fps',
    zone: 'Zone A - Primary Concourse',
    cvStatus: 'DENSITY_ANOMALY',
    metrics: { density: '86%', velocity: '0.24 m/s', count: '142' }
  },
  {
    id: 'cctv_02',
    label: 'CAMERA 02',
    location: 'Gate 3 · Perimeter & Turnstiles',
    streamUrl: '/videos/camera_02.mp4',
    status: 'LIVE / REC',
    fps: 30,
    resolution: '1080p @ 30fps',
    zone: 'Zone B - Turnstile Exit Vector',
    cvStatus: 'VELOCITY_DROP',
    metrics: { density: '79%', velocity: '0.19 m/s', count: '118' }
  }
]

export const TIMELINE_EVENTS = [
  {
    id: 'evt-1',
    time: '18:02',
    timestamp: '18:02:14',
    event: 'Normal crowd conditions',
    source: 'Camera 01',
    sourceType: 'CCTV',
    severity: 'LOW',
    detail: 'Baseline ambient flow rate established. Density reading 24%, average flow 1.2 m/s. All 6 turnstile lanes clear.',
    verified: true
  },
  {
    id: 'evt-2',
    time: '18:08',
    timestamp: '18:08:45',
    event: 'Density begins increasing',
    source: 'Camera 01',
    sourceType: 'CCTV',
    severity: 'MEDIUM',
    detail: 'Sustained influx from North Metro Station. Concourse occupant density spikes from 35% to 62% in 3 minutes.',
    verified: true
  },
  {
    id: 'evt-3',
    time: '18:12',
    timestamp: '18:12:30',
    event: 'Movement velocity decreases',
    source: 'Camera 01',
    sourceType: 'CCTV',
    severity: 'MEDIUM',
    detail: 'Optical flow algorithm registers velocity drop below 0.40 m/s threshold. Pedestrian bottleneck forming near Turnstile 3 & 4.',
    verified: true
  },
  {
    id: 'evt-4',
    time: '18:17',
    timestamp: '18:17:02',
    event: 'Citizen report received',
    source: 'Citizen Report C014',
    sourceType: 'Citizen',
    severity: 'HIGH',
    detail: 'Field report from Citizen App: "Heavy crowd congestion near Gate 3, cannot move forward towards exit".',
    verified: true
  },
  {
    id: 'evt-5',
    time: '18:19',
    timestamp: '18:19:18',
    event: 'Second camera confirms congestion',
    source: 'Camera 02',
    sourceType: 'CCTV',
    severity: 'HIGH',
    detail: 'Cross-camera triangulation: Camera 02 verifies tailback extending 45 meters into outer perimeter courtyard.',
    verified: true
  },
  {
    id: 'evt-6',
    time: '18:21',
    timestamp: '18:21:00',
    event: 'Incident classified HIGH',
    source: 'Risk Engine',
    sourceType: 'Official',
    severity: 'HIGH',
    detail: 'Automated Risk Engine synthesizes multi-camera CV inputs + citizen corroboration. Confidence score: 91%. Risk level elevated to HIGH.',
    verified: true
  },
  {
    id: 'evt-7',
    time: '18:23',
    timestamp: '18:23:42',
    event: 'Advisory published',
    source: 'Authority Action',
    sourceType: 'Authority',
    severity: 'HIGH',
    detail: 'Safety command authority broadcasts live push notification to all citizens within 1.5km geofence.',
    verified: true
  },
  {
    id: 'evt-8',
    time: '18:30',
    timestamp: '18:30:15',
    event: 'Situation stabilizing',
    source: 'Camera 01',
    sourceType: 'CCTV',
    severity: 'LOW',
    detail: 'Crowd diversion through Gate 4 taking effect. Density decreasing to 54%, velocity recovering to 0.72 m/s.',
    verified: true
  }
]

export const SUPPORTING_SOURCES = [
  {
    id: 'cctv_01',
    source: 'CCTV',
    label: 'CCTV Camera 01',
    claim: 'Person density at Gate 3 rising steadily since 18:08',
    location: 'Gate 3 Concourse',
    timestamp: '18:12',
    status: 'VERIFIED',
    credibility: 0.94,
    technicalData: 'YOLOv8x-crowd | 142 detected centroids | optical flow -68%',
    agreement: 'Agrees with Gate 3 anomaly'
  },
  {
    id: 'cctv_02',
    source: 'CCTV',
    label: 'CCTV Camera 02',
    claim: 'Crowd movement velocity at Gate 3 falling below normal',
    location: 'Gate 3 Perimeter',
    timestamp: '18:19',
    status: 'VERIFIED',
    credibility: 0.90,
    technicalData: 'Perimeter tracker | Velocity: 0.19 m/s (critical threshold: 0.35)',
    agreement: 'Direct confirmation of bottleneck'
  },
  {
    id: 'citizen_C014',
    source: 'Citizen Reports',
    label: 'Citizen Report C014',
    claim: 'Heavy crowd congestion near Gate 3',
    location: 'Gate 3 Turnstiles',
    timestamp: '18:17',
    status: 'VERIFIED',
    credibility: 0.78,
    technicalData: 'Mobile GPS geotag: (19.0761, 72.8778) ±4m | 3 corroborating upvotes',
    agreement: 'First-hand human report from core surge'
  },
  {
    id: 'official_A001',
    source: 'Official Sources',
    label: 'Event Authority Ground Unit',
    claim: 'Gate 3 congestion confirmed by on-ground marshals',
    location: 'Gate 3 Inspection Booth',
    timestamp: '18:21',
    status: 'VERIFIED',
    credibility: 0.98,
    technicalData: 'Radio Dispatch Unit R-4 | Physical perimeter check completed',
    agreement: 'Official authority validation on ground'
  },
  {
    id: 'news_N003',
    source: 'News',
    label: 'News Wire Alert N003',
    claim: 'Event venue reports unusually large evening crowd at north gate',
    location: 'Gate 3 North Zone',
    timestamp: '18:20',
    status: 'SUPPORTING',
    credibility: 0.74,
    technicalData: 'Regional transit bulletin feed | Local metro congestion broadcast',
    agreement: 'External regional validation'
  },
  {
    id: 'social_S021',
    source: 'Social Reports',
    label: 'Social Media Feed S021',
    claim: 'Posts mention crowding near Gate 3',
    location: 'Gate 3 Public Area',
    timestamp: '18:18',
    status: 'UNVERIFIED',
    credibility: 0.45,
    technicalData: 'Keyword surge #Gate3Rush | 28 mentions in 10 minutes',
    agreement: 'Public chatter confirms interest'
  },
  {
    id: 'social_S044',
    source: 'Social Reports',
    label: 'Social Media Rumor S044',
    claim: 'Gate 3 is completely closed and locked',
    location: 'Gate 3 Outer Gates',
    timestamp: '18:24',
    status: 'REFUTED',
    credibility: 0.22,
    technicalData: 'Single viral post claiming closure | Disputed by live CCTV 02',
    agreement: 'Directly contradicted by CCTV and Marshals'
  }
]

export const SEEDED_CLAIMS = [
  {
    id: 'CLM001',
    incident_id: 'INC001',
    claim: 'Heavy crowd congestion near Gate 3 turnstiles causing severe pedestrian bottleneck',
    location: 'Gate 3 Concourse',
    submitted_by: 'Citizen App #C014 (Corroborated)',
    timestamp: '18:17',
    status: 'VERIFIED',
    confidence: 0.94,
    mediaEvidence: {
      cctv: {
        camId: 'cctv_01',
        camName: 'CCTV 01 · North Entry Corridor',
        streamUrl: '/videos/camera_01.mp4',
        finding: 'Computer vision identifies 86% density surge and 0.24 m/s velocity drop.',
        status: 'CORROBORATED'
      },
      news: [
        {
          outlet: 'Metro City News 24',
          badge: 'AUTHENTICATED PRESS',
          time: '18:20 IST',
          headline: 'High passenger surge exiting North Metro Stadium line; queue extends to concourse.',
          status: 'VERIFIED'
        }
      ],
      radio: {
        unit: 'Marshal Unit R-4 (Sergeant K. Rao)',
        callsign: 'SEC-RADIO-CH4',
        time: '18:21 IST',
        transcript: 'Control, Gate 3 turnstiles are operational but congested due to ticket scanner delay. Tailback is approximately 45 meters. People are calm. We request Gate 4 auxiliary gate be opened.',
        verified: true
      },
      citizen: {
        user: 'Citizen C014 (+2 co-signers)',
        badge: 'GPS GEOTAGGED (±4m)',
        time: '18:17 IST',
        report: 'Line at Gate 3 is moving very slowly. Took about 12 minutes to get from perimeter to turnstiles.',
        upvotes: 3
      }
    },
    evidenceMatrix: {
      cctv: { verified: true, label: 'Camera 01 + 02 detect 86% density and velocity plunge' },
      citizen: { verified: true, label: '3 independent citizen submissions via mobile app' },
      official: { verified: true, label: 'On-ground marshal unit R-4 radioed confirmation' },
      news: { verified: true, label: 'Transit bulletin N003 corroborating metro surge' },
      social: { verified: true, label: 'Surge in #Gate3Rush geolocation matches' }
    },
    suggestedAdvisory: 'Gate 3 experiencing high footfall. Please proceed towards auxiliary Gate 4 for expedited exit.'
  },
  {
    id: 'CLM002',
    incident_id: 'INC001',
    claim: 'Gate 3 is completely locked and closed to the public.',
    location: 'Gate 3 Outer Gates',
    submitted_by: 'Social Media scraper (#Gate3Rush)',
    timestamp: '18:24',
    status: 'UNVERIFIED',
    confidence: 0.18,
    mediaEvidence: {
      cctv: {
        camId: 'cctv_02',
        camName: 'CCTV 02 · Turnstile Exit Vector',
        streamUrl: '/videos/camera_02.mp4',
        finding: 'Optical flow confirms active throughput of 42 people/min. Gates are physically wide open.',
        status: 'CONTRADICTED'
      },
      news: [
        {
          outlet: 'Civic Transport Wire',
          badge: 'GOVERNMENT WIRE',
          time: '18:22 IST',
          headline: 'Stadium security denies gate closure; confirms all turnstiles operating normally with marshal guidance.',
          status: 'REFUTED'
        }
      ],
      radio: {
        unit: 'Marshal Unit R-4 (Sergeant K. Rao)',
        callsign: 'SEC-RADIO-CH4',
        time: '18:25 IST',
        transcript: 'Refuting rumor: Turnstiles 1 through 6 are fully active. Gates are NOT locked. Flow is slow but steady.',
        verified: false
      },
      citizen: {
        user: 'Citizen App Consensus',
        badge: 'CROWD SOURCED',
        time: '18:25 IST',
        report: '0 out of 14 users report locked gates. Turnstiles are functioning.',
        upvotes: 0
      }
    },
    evidenceMatrix: {
      cctv: { verified: false, label: 'CCTV Camera 02 shows turnstiles active, not locked' },
      citizen: { verified: false, label: 'No citizen claims complete closure, only slow movement' },
      official: { verified: false, label: 'Ground marshals report gates remain open for flow' },
      news: { verified: false, label: 'Official news confirms all exit turnstiles operating' },
      social: { verified: false, label: 'Single unverified viral claim contradicted by optical flow' }
    },
    suggestedAdvisory: null
  },
  {
    id: 'CLM003',
    incident_id: 'INC001',
    claim: 'Stampede triggered with multiple civilian injuries at Gate 3.',
    location: 'Gate 3 Triage Zone',
    submitted_by: 'Anonymous Social Post',
    timestamp: '18:27',
    status: 'REJECTED',
    confidence: 0.05,
    mediaEvidence: {
      cctv: {
        camId: 'cctv_01',
        camName: 'CCTV 01 · North Entry Corridor',
        streamUrl: '/videos/camera_01.mp4',
        finding: 'CV behavioral analysis registers 0 falls, 0 ground collapse clusters. Crowd posture normal upright.',
        status: 'DEBUNKED'
      },
      news: [
        {
          outlet: 'State Disaster Authority Press',
          badge: 'OFFICIAL FACT-CHECK',
          time: '18:28 IST',
          headline: 'Fact Check: No stampede or injuries reported at Stadium Gate 3. False rumor circulating online.',
          status: 'DEBUNKED'
        }
      ],
      radio: {
        unit: 'Paramedic Station 2 (Dr. Ananya)',
        callsign: 'MED-POST-02',
        time: '18:28 IST',
        transcript: 'Medical Post 2 has zero triage admissions. We have visually verified Gate 3 perimeter. No injuries, no stampede.',
        verified: false
      },
      citizen: {
        user: 'On-site Verified Citizens',
        badge: 'COMMUNITY CHECK',
        time: '18:28 IST',
        report: 'Crowd is slow but peaceful. No panic or rush.',
        upvotes: 8
      }
    },
    evidenceMatrix: {
      cctv: { verified: false, label: 'Behavioral optical flow: 0 falls, 0 distress clusters' },
      citizen: { verified: false, label: 'Citizens on site debunk stampede claims' },
      official: { verified: false, label: 'Medical Post 2 confirms ZERO casualties or triage cases' },
      news: { verified: false, label: 'Official news agency issued active rumor debunk bulletin' },
      social: { verified: false, label: 'Viral sensationalism refuted by live multi-sensor feeds' }
    },
    suggestedAdvisory: null
  }
]

export const SEEDED_ADVISORIES = [
  {
    id: 'ADV001',
    incident_id: 'INC001',
    severity: 'HIGH',
    location: 'Gate 3',
    message: 'Severe congestion detected near Gate 3. Avoid the area until further notice.',
    issued_by: 'Public Safety Command Center',
    timestamp: '18:23',
    created_at: '2026-10-01T18:23:42',
    status: 'PUBLISHED',
    channels: ['Citizen App Push', 'Digital Signage Board G3', 'SMS Geofence'],
    reach: '4,820 Citizens in Geofence',
    validated_claim: 'Heavy crowd congestion near Gate 3'
  }
]

export const GRAPH_NETWORK = {
  incident_id: 'INC001',
  nodes: [
    {
      id: 'INC001',
      label: 'INC001: CROWD ANOMALY',
      type: 'incident',
      status: 'ACTIVE',
      severity: 'HIGH',
      location: 'Gate 3',
      confidence: 0.91,
      x: 450,
      y: 260
    },
    {
      id: 'cctv_01',
      label: 'CCTV Camera 01',
      type: 'cctv',
      status: 'VERIFIED',
      credibility: 0.94,
      location: 'Gate 3 Concourse',
      timestamp: '18:08',
      claim: 'Density rising steadily past 86%',
      x: 180,
      y: 130
    },
    {
      id: 'cctv_02',
      label: 'CCTV Camera 02',
      type: 'cctv',
      status: 'VERIFIED',
      credibility: 0.90,
      location: 'Gate 3 Perimeter',
      timestamp: '18:19',
      claim: 'Exit flow bottleneck; velocity at 0.19 m/s',
      x: 180,
      y: 380
    },
    {
      id: 'citizen_C014',
      label: 'Citizen Report C014',
      type: 'citizen',
      status: 'VERIFIED',
      credibility: 0.78,
      location: 'Gate 3',
      timestamp: '18:17',
      claim: 'Heavy crowd congestion near Gate 3',
      x: 450,
      y: 80
    },
    {
      id: 'official_A001',
      label: 'Official Authority',
      type: 'official',
      status: 'VERIFIED',
      credibility: 0.98,
      location: 'Gate 3 Ground Staff',
      timestamp: '18:21',
      claim: 'On-ground marshal confirmation of crowd rush',
      x: 720,
      y: 140
    },
    {
      id: 'news_N003',
      label: 'News Wire N003',
      type: 'news',
      status: 'SUPPORTING',
      credibility: 0.74,
      location: 'Gate 3 North Corridor',
      timestamp: '18:20',
      claim: 'Large evening crowd arriving from North Metro',
      x: 720,
      y: 360
    },
    {
      id: 'social_S021',
      label: 'Social Report S021',
      type: 'social',
      status: 'UNVERIFIED',
      credibility: 0.45,
      location: 'Gate 3 Public',
      timestamp: '18:18',
      claim: 'Posts complaining about turnstile delay',
      x: 450,
      y: 440
    }
  ],
  edges: [
    { id: 'e1', source: 'cctv_01', target: 'INC001', relation: 'PRIMARY_CV', weight: 0.94, status: 'VERIFIED' },
    { id: 'e2', source: 'cctv_02', target: 'INC001', relation: 'CONFIRMING_CV', weight: 0.90, status: 'VERIFIED' },
    { id: 'e3', source: 'citizen_C014', target: 'INC001', relation: 'FIELD_REPORT', weight: 0.78, status: 'VERIFIED' },
    { id: 'e4', source: 'official_A001', target: 'INC001', relation: 'AUTHORITY_CHECK', weight: 0.98, status: 'VERIFIED' },
    { id: 'e5', source: 'news_N003', target: 'INC001', relation: 'CORROBORATING', weight: 0.74, status: 'SUPPORTING' },
    { id: 'e6', source: 'social_S021', target: 'INC001', relation: 'PUBLIC_SIGNAL', weight: 0.45, status: 'UNVERIFIED' }
  ]
}
