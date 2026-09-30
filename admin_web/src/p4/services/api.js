import {
  DEFAULT_INCIDENT,
  INCIDENTS_LIST,
  TIMELINE_EVENTS,
  SUPPORTING_SOURCES,
  GRAPH_NETWORK,
  SEEDED_CLAIMS,
  SEEDED_ADVISORIES
} from './mockData'

// Single source of truth for the backend origin. App.jsx and the P4 workspaces
// both import this, so the dashboard and the evidence pages can never point at
// different backends (this was previously two different defaults).
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

// Camera clips live on the FastAPI static mount (/videos/{file}). Never fake a
// URL: always resolve it against the same configured backend origin.
export function mediaUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

// Backend claim records -> the shape the verification matrix renders.
export function normalizeClaim(raw) {
  if (!raw) return null
  return {
    id: raw.id,
    incident_id: raw.incident_id || 'INC001',
    claim: raw.claim || '',
    location: raw.location || '',
    timestamp: raw.timestamp || '',
    status: raw.status || 'UNDER_VALIDATION',
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
    submitted_by: raw.validated_by || raw.source || 'Citizen Report',
    note: raw.note || '',
    evidenceMatrix: raw.evidenceMatrix
  }
}

// Persistent in-memory store for newly published advisories & validation changes during session
let runtimeAdvisories = [...SEEDED_ADVISORIES]
let runtimeClaims = [...SEEDED_CLAIMS]
let runtimeTimeline = [...TIMELINE_EVENTS]

export async function fetchIncidents() {
  try {
    const res = await fetch(`${API_BASE}/incidents`, { signal: AbortSignal.timeout(2500) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const list = Array.isArray(data) ? data : data.incidents || []
    return { data: list.length ? list : INCIDENTS_LIST, isMock: !list.length }
  } catch (err) {
    console.warn('[P4 API] /incidents fallback to demo data:', err.message)
    return { data: INCIDENTS_LIST, isMock: true, error: err.message }
  }
}

export async function fetchIncidentDetail(incidentId = 'INC001') {
  try {
    const res = await fetch(`${API_BASE}/incidents/${encodeURIComponent(incidentId)}`, { signal: AbortSignal.timeout(2500) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return { data, isMock: false }
  } catch (err) {
    console.warn(`[P4 API] /incidents/${incidentId} fallback:`, err.message)
    const seeded = INCIDENTS_LIST.find((i) => i.id === incidentId) || DEFAULT_INCIDENT
    return {
      data: { ...seeded, claims: SEEDED_CLAIMS.filter((c) => (c.incident_id || 'INC001') === incidentId) },
      isMock: true,
      error: err.message
    }
  }
}

export async function fetchEvidence(incidentId = 'INC001') {
  try {
    const res = await fetch(`${API_BASE}/evidence/${encodeURIComponent(incidentId)}`, { signal: AbortSignal.timeout(2500) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const timeline = data.timeline && data.timeline.length ? data.timeline : runtimeTimeline
    const sources = data.sources && data.sources.length ? data.sources : SUPPORTING_SOURCES
    return {
      incident: data.incident || DEFAULT_INCIDENT,
      timeline,
      sources,
      cameras: data.cameras || [],
      metrics: data.metrics || {
        density: 86,
        velocity: 0.24,
        confidence: 0.91,
        risk_score: 0.88
      },
      // Honest flag: the timeline/sources came from seeded data, not the API.
      isMock: !(data.timeline && data.timeline.length)
    }
  } catch (err) {
    console.warn(`[P4 API] /evidence/${incidentId} fallback to demo data:`, err.message)
    return {
      incident: INCIDENTS_LIST.find((i) => i.id === incidentId) || DEFAULT_INCIDENT,
      timeline: runtimeTimeline,
      sources: SUPPORTING_SOURCES,
      cameras: [],
      metrics: {
        density: 86,
        velocity: 0.24,
        confidence: 0.91,
        risk_score: 0.88
      },
      isMock: true,
      error: err.message
    }
  }
}

export async function fetchCameras() {
  try {
    const res = await fetch(`${API_BASE}/cameras`, { signal: AbortSignal.timeout(2500) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return { data, isMock: false }
  } catch (err) {
    console.warn('[P4 API] /cameras fallback:', err.message)
    return { data: { cameras: [], observations: [] }, isMock: true, error: err.message }
  }
}

// Incident/location-scoped public-safety retrieval. Every item is REPORTED.
export async function fetchNews({ incidentId = null, location = null, intents = null, limit = 5 } = {}) {
  try {
    const params = new URLSearchParams()
    if (incidentId) params.set('incident_id', incidentId)
    if (location) params.set('location', location)
    if (intents) params.set('intents', intents)
    params.set('limit', String(limit))
    const res = await fetch(`${API_BASE}/news?${params.toString()}`, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return { data: data.items || [], providers: data.providers || {}, queries: data.queries || [], isMock: false }
  } catch (err) {
    console.warn('[P4 API] /news fallback:', err.message)
    return { data: [], providers: {}, queries: [], isMock: true, error: err.message }
  }
}

export async function fetchSourceGraph(incidentId = 'INC001', { live = false } = {}) {
  try {
    const query = live ? '?live=true' : ''
    const res = await fetch(`${API_BASE}/sources/${encodeURIComponent(incidentId)}${query}`, { signal: AbortSignal.timeout(live ? 8000 : 2500) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.nodes && data.nodes.length) {
      return { data, isMock: false }
    }
    return { data: GRAPH_NETWORK, isMock: true }
  } catch (err) {
    console.warn(`[P4 API] /sources/${incidentId} fallback:`, err.message)
    return { data: GRAPH_NETWORK, isMock: true, error: err.message }
  }
}

export async function verifyClaimRequest(payload) {
  try {
    const res = await fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return { data, isMock: false }
  } catch (err) {
    console.warn('[P4 API] /verify fallback:', err.message)
    // Deterministic simulation
    const normalizedClaim = (payload.claim || '').toLowerCase()
    const isCongestion = normalizedClaim.includes('congest') || normalizedClaim.includes('crowd')
    const isClosed = normalizedClaim.includes('closed') || normalizedClaim.includes('shut')

    return {
      data: {
        status: isCongestion ? 'VERIFIED' : isClosed ? 'UNVERIFIED' : 'UNDER_VALIDATION',
        confidence: isCongestion ? 0.94 : isClosed ? 0.28 : 0.55,
        severity: isCongestion ? 'HIGH' : 'LOW',
        impact: isCongestion ? 'High congestion near Gate 3' : 'Insufficient supporting evidence',
        supporting_sources: isCongestion
          ? ['CCTV Camera 01', 'CCTV Camera 02', 'Citizen Report C014', 'Event Authority']
          : ['Social Media S044'],
        corroborating_news: [],
        news_providers: {},
        incident_id: payload.incident_id || 'INC001',
        location: payload.location || 'Gate 3'
      },
      isMock: true,
      error: err.message
    }
  }
}

export async function validateClaimAction(payload) {
  try {
    const res = await fetch(`${API_BASE}/validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    // Update local runtime claims as well
    runtimeClaims = runtimeClaims.map(c => c.id === payload.claim_id ? { ...c, status: payload.status } : c)
    return { data, isMock: false }
  } catch (err) {
    console.warn('[P4 API] /validation fallback to local state:', err.message)
    runtimeClaims = runtimeClaims.map(c => c.id === payload.claim_id ? { ...c, status: payload.status } : c)

    // Add audit event to local timeline
    runtimeTimeline.unshift({
      id: `audit-${Date.now()}`,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }),
      event: `Authority marked ${payload.claim_id || 'claim'} as ${payload.status}`,
      source: 'Authority Validation',
      sourceType: 'Authority',
      severity: payload.status === 'VERIFIED' ? 'HIGH' : 'LOW',
      detail: payload.note || `Action completed by command operator: status set to ${payload.status}`,
      verified: payload.status === 'VERIFIED'
    })

    return {
      data: {
        status: 'ok',
        incident_id: payload.incident_id,
        validation_status: payload.status,
        note: payload.note
      },
      isMock: true,
      error: err.message
    }
  }
}

export async function publishAdvisoryRequest(payload) {
  try {
    const res = await fetch(`${API_BASE}/advisories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    runtimeAdvisories.unshift(data)
    return { data, isMock: false }
  } catch (err) {
    console.warn('[P4 API] /advisories fallback to local state:', err.message)
    const now = new Date()
    const newAdvisory = {
      id: `ADV00${runtimeAdvisories.length + 1}`,
      incident_id: payload.incident_id || 'INC001',
      severity: (payload.severity || 'HIGH').toUpperCase(),
      location: payload.location || 'Gate 3',
      message: payload.message,
      issued_by: payload.issued_by || 'Public Safety Command Center',
      timestamp: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      created_at: now.toISOString(),
      status: 'PUBLISHED',
      channels: ['Citizen Mobile App', 'Digital Concourse VMS', 'Broadcast SMS'],
      reach: '5,240 Citizens within Geofence',
      validated_claim: 'Severe crowd congestion near Gate 3'
    }
    runtimeAdvisories.unshift(newAdvisory)

    // Add to timeline
    runtimeTimeline.unshift({
      id: `adv-evt-${Date.now()}`,
      time: newAdvisory.timestamp,
      timestamp: now.toLocaleTimeString('en-IN', { hour12: false }),
      event: `Official advisory published: "${newAdvisory.message.slice(0, 48)}..."`,
      source: 'Safety Command',
      sourceType: 'Authority',
      severity: newAdvisory.severity,
      detail: `Broadcast advisory sent to citizens: ${newAdvisory.message}`,
      verified: true
    })

    return { data: newAdvisory, isMock: true, error: err.message }
  }
}

export async function fetchAdvisoriesList(incidentId = null) {
  try {
    const url = incidentId
      ? `${API_BASE}/advisories?incident_id=${encodeURIComponent(incidentId)}`
      : `${API_BASE}/advisories`
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const list = data.advisories || []
    return { data: list.length ? list : runtimeAdvisories, isMock: !list.length }
  } catch (err) {
    console.warn('[P4 API] /advisories fallback:', err.message)
    const filtered = incidentId
      ? runtimeAdvisories.filter(a => a.incident_id === incidentId)
      : runtimeAdvisories
    return { data: filtered, isMock: true, error: err.message }
  }
}

export function getRuntimeClaims() {
  return runtimeClaims
}
