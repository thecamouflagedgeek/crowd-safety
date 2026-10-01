import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  Activity,
  AlertTriangle,
  Bell,
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers3,
  MapPin,
  Menu,
  RotateCcw,
  Share2,
  Shield,
  Siren,
  Users,
  Video,
  X
} from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import './App.css'
import './p4/styles/p4.css'
import { HeatmapLayer } from './HeatmapLayer'
import { EvidenceReconstructionPage } from './p4/pages/EvidenceReconstructionPage'
import { InformationPropagationPage } from './p4/pages/InformationPropagationPage'
import { VerificationPage } from './p4/pages/VerificationPage'
import { AdvisoriesPage } from './p4/pages/AdvisoriesPage'

const demoIncidents = [
  { id: 'INC001', type: 'Crowd Anomaly', location: 'Gate 3, Mumbai', latitude: 19.076, longitude: 72.8777, severity: 'HIGH', confidence: .91, density: 86, velocity: .24, status: 'ACTIVE', timestamp: '18:21', description: 'Abnormally high crowd density detected with reduced movement velocity.', camera: 'Camera 03 · Gate 3' },
  { id: 'INC002', type: 'Traffic Accident', location: 'Eastern Express Highway', latitude: 19.12, longitude: 72.91, severity: 'HIGH', confidence: .87, density: 42, velocity: .8, status: 'ACTIVE', timestamp: '12:05', camera: 'Traffic Cam 12' },
  { id: 'INC003', type: 'Unattended Baggage', location: 'Andheri Station', latitude: 19.1197, longitude: 72.8468, severity: 'MEDIUM', confidence: .82, density: 30, velocity: .4, status: 'ACTIVE', timestamp: '11:48', camera: 'Station Cam 08' },
  { id: 'INC004', type: 'Crowd Anomaly', location: 'Bandra West', latitude: 19.0596, longitude: 72.8295, severity: 'HIGH', confidence: .88, density: 78, velocity: .3, status: 'ACTIVE', timestamp: '10:32', camera: 'Camera 11 · Bandra' },
  { id: 'INC005', type: 'Traffic Accident', location: 'NH48, Pune', latitude: 18.5204, longitude: 73.8567, severity: 'LOW', confidence: .76, density: 23, velocity: 1.2, status: 'MONITORING', timestamp: '09:15', camera: 'Highway Cam 04' },
  { id: 'INC006', type: 'Public Gathering', location: 'BKC Ground, Mumbai', latitude: 19.0678, longitude: 72.8691, severity: 'MEDIUM', confidence: .79, density: 56, velocity: .6, status: 'ACTIVE', timestamp: '08:41', camera: 'Camera 21 · BKC' },
  { id: 'INC007', type: 'Unattended Baggage', location: 'Dadar Station', latitude: 19.0178, longitude: 72.8478, severity: 'LOW', confidence: .71, density: 14, velocity: .5, status: 'MONITORING', timestamp: '07:50', camera: 'Station Cam 02' },
  { id: 'INC008', type: 'Crowd Anomaly', location: 'Gateway of India, Mumbai', latitude: 18.922, longitude: 72.8347, severity: 'MEDIUM', confidence: .79, density: 61, velocity: .48, status: 'ACTIVE', timestamp: '08:20', camera: 'Camera 05 · Colaba' },
  { id: 'INC009', type: 'Public Gathering', location: 'Connaught Place, Delhi', latitude: 28.6315, longitude: 77.2167, severity: 'HIGH', confidence: .89, density: 81, velocity: .29, status: 'ACTIVE', timestamp: '08:03', camera: 'Camera 18 · CP' },
  { id: 'INC010', type: 'Traffic Accident', location: 'MI Road, Jaipur', latitude: 26.9124, longitude: 75.7873, severity: 'MEDIUM', confidence: .83, density: 33, velocity: .7, status: 'ACTIVE', timestamp: '07:42', camera: 'Road Cam 06' },
  { id: 'INC011', type: 'Crowd Anomaly', location: 'Howrah Station, Kolkata', latitude: 22.5958, longitude: 88.2636, severity: 'MEDIUM', confidence: .84, density: 74, velocity: .34, status: 'ACTIVE', timestamp: '07:29', camera: 'Station Cam 14' },
  { id: 'INC012', type: 'Unattended Baggage', location: 'Secunderabad Station, Hyderabad', latitude: 17.4344, longitude: 78.5013, severity: 'LOW', confidence: .73, density: 18, velocity: .5, status: 'MONITORING', timestamp: '07:11', camera: 'Station Cam 09' },
  { id: 'INC013', type: 'Traffic Accident', location: 'MG Road, Bengaluru', latitude: 12.9756, longitude: 77.6068, severity: 'HIGH', confidence: .86, density: 47, velocity: .62, status: 'ACTIVE', timestamp: '06:55', camera: 'Road Cam 23' },
  { id: 'INC014', type: 'Public Gathering', location: 'Marina Beach, Chennai', latitude: 13.0500, longitude: 80.2824, severity: 'LOW', confidence: .77, density: 45, velocity: .68, status: 'MONITORING', timestamp: '06:32', camera: 'Camera 07 · Marina' },
  { id: 'INC015', type: 'Crowd Anomaly', location: 'Sabarmati Riverfront, Ahmedabad', latitude: 23.0225, longitude: 72.5714, severity: 'MEDIUM', confidence: .81, density: 69, velocity: .39, status: 'ACTIVE', timestamp: '06:17', camera: 'Camera 16 · Riverfront' },
  { id: 'INC016', type: 'Traffic Accident', location: 'Tank Bund, Hyderabad', latitude: 17.4239, longitude: 78.4738, severity: 'LOW', confidence: .72, density: 29, velocity: .9, status: 'MONITORING', timestamp: '05:58', camera: 'Road Cam 15' },
  { id: 'INC017', type: 'Public Gathering', location: 'India Gate, Delhi', latitude: 28.6129, longitude: 77.2295, severity: 'LOW', confidence: .75, density: 51, velocity: .65, status: 'MONITORING', timestamp: '05:36', camera: 'Camera 04 · Rajpath' }
]

const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const apiBase = import.meta.env.VITE_API_BASE_URL || ''
const INCIDENT_FOCUS_ZOOM = 15.5

function sortIncidents(rows) {
  return [...rows].sort((a, b) => (severityOrder[(a.severity || '').toUpperCase()] ?? 9) - (severityOrder[(b.severity || '').toUpperCase()] ?? 9))
}

async function getIncidents() {
  const response = await fetch(`${apiBase}/incidents`)
  if (!response.ok) throw new Error(`Incident service returned ${response.status}`)
  const data = await response.json()
  return Array.isArray(data) ? data : data.incidents || []
}

async function getIncident(id) {
  const response = await fetch(`${apiBase}/incidents/${encodeURIComponent(id)}`)
  if (!response.ok) throw new Error(`Incident detail returned ${response.status}`)
  return response.json()
}

function markerIcon(severity, selected) {
  const level = (severity || 'LOW').toUpperCase()
  const color = level === 'HIGH' || level === 'CRITICAL' ? '#f04452' : level === 'MEDIUM' ? '#f3a712' : '#16bd83'
  return L.divIcon({
    className: 'incident-marker-wrap',
    html: `<span class="incident-marker ${selected ? 'selected' : ''}" style="--marker-color:${color}"><span></span></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  })
}

function FocusMap({ incident, resetKey }) {
  const map = useMap()

  // Recenter to national overview when resetKey triggers
  useEffect(() => {
    if (!resetKey) return
    map.flyTo([22.8, 79.1], 4.8, { duration: 0.85 })
  }, [resetKey, map])

  // Focus incident when clicked
  useEffect(() => {
    if (!incident || incident.latitude == null || incident.longitude == null || !Number.isFinite(Number(incident.latitude)) || !Number.isFinite(Number(incident.longitude))) return
    const center = [Number(incident.latitude), Number(incident.longitude)]
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      map.setView(center, INCIDENT_FOCUS_ZOOM, { animate: false })
    } else {
      map.flyTo(center, INCIDENT_FOCUS_ZOOM, { duration: 1.05 })
    }
  }, [incident, map])
  return null
}

const IncidentMarker = memo(function IncidentMarker({ item, selected, onSelect }) {
  const icon = useMemo(() => markerIcon(item.severity, selected), [item.severity, selected])
  return <Marker position={[item.latitude, item.longitude]} icon={icon} eventHandlers={{ click: () => onSelect(item) }}/>
})

function Severity({ level }) {
  return <span className={`severity severity-${(level || 'LOW').toLowerCase()}`}>{level || 'UNKNOWN'}</span>
}

function routeFromPath() {
  const path = window.location.pathname.replace(/\/$/, '')
  return path === '' || path === '/' ? '/dashboard' : path
}

function getLocalTime() {
  const now = new Date()
  return {
    date: new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(now),
    time: new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(now)
  }
}

export function App() {
  const [incidents, setIncidents] = useState([])
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('ALL')
  const [route, setRoute] = useState(routeFromPath)
  const [source, setSource] = useState('loading')
  const [menuOpen, setMenuOpen] = useState(false)
  const [satellite, setSatellite] = useState(false)
  const [heatmap, setHeatmap] = useState(true)
  const [clock, setClock] = useState(getLocalTime)
  const [mapFocus, setMapFocus] = useState(null)
  const [resetKey, setResetKey] = useState(0)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [navState, setNavState] = useState({})
  const knownIncidentIds = useRef(new Set())

  // Initial Fetch & Route Listeners
  useEffect(() => {
    let live = true
    getIncidents().then((rows) => {
      if (!live) return
      const sorted = sortIncidents(rows)
      knownIncidentIds.current = new Set(sorted.map((item) => item.id))
      setIncidents(sorted)
      setSource('api')
      setSelected(sorted.find((x) => x.id === 'INC001') || sorted[0] || null)
    }).catch(() => {
      if (!live) return
      knownIncidentIds.current = new Set(demoIncidents.map((item) => item.id))
      setIncidents(demoIncidents)
      setSelected(demoIncidents[0])
      setSource('demo')
    })
    const onPop = () => setRoute(routeFromPath())
    window.addEventListener('popstate', onPop)
    return () => {
      live = false
      window.removeEventListener('popstate', onPop)
    }
  }, [])

  // Live Refresh Loop
  useEffect(() => {
    if (source === 'loading') return
    let live = true
    let refreshing = false
    const refreshIncidents = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const rows = sortIncidents(await getIncidents())
        if (!live) return
        setIncidents(rows)
        setSelected((current) => {
          const updated = rows.find((item) => item.id === current?.id)
          return updated && current ? { ...current, ...updated } : current
        })
      } catch {
        // Keep current snapshot
      } finally {
        refreshing = false
      }
    }
    const timer = window.setInterval(refreshIncidents, 5000)
    return () => {
      live = false
      window.clearInterval(timer)
    }
  }, [source])

  // Live Clock
  useEffect(() => {
    const timer = window.setInterval(() => setClock(getLocalTime()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // Deep detail load on selection
  useEffect(() => {
    if (source !== 'api' || !selected?.id) return
    let live = true
    getIncident(selected.id).then((detail) => {
      if (live) setSelected((current) => current?.id === detail.id ? { ...current, ...detail } : current)
    }).catch(() => {})
    return () => { live = false }
  }, [selected?.id, source])

  const counts = useMemo(() => incidents.reduce((acc, i) => {
    const severity = (i.severity || 'LOW').toUpperCase()
    acc.total++
    acc[severity] = (acc[severity] || 0) + 1
    return acc
  }, { total: 0 }), [incidents])

  const visibleIncidents = incidents.filter((i) => filter === 'ALL' || (i.severity || '').toUpperCase() === filter)

  const navigate = (to, state = {}) => {
    window.history.pushState({}, '', to)
    setRoute(to)
    setNavState(state)
    setMenuOpen(false)
  }

  const chooseIncident = useCallback((item) => {
    setSelected(item)
    setMapFocus({ ...item, _focusTs: Date.now() })
  }, [])

  const handleRecenter = useCallback(() => {
    setSelected(null)
    setMapFocus(null)
    setResetKey((prev) => prev + 1)
  }, [])

  const navigationItems = [
    { path: '/dashboard', label: 'Dashboard', Icon: Layers3 },
    { path: '/evidence', label: 'Evidence Reconstruction', Icon: Video },
    { path: '/propagation', label: 'Information Propagation', Icon: Share2 },
    { path: '/verification', label: 'Verification', Icon: Activity },
    { path: '/advisories', label: 'Advisories', Icon: Bell }
  ]

  return (
    <div className="app-shell">
      {/* Topbar with distinctive faceted brand mark, clean breathing room */}
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">
            <Menu size={20} />
          </button>
          <div className="brand" onClick={() => navigate('/dashboard')}>
            <div className="brand-mark">
              <Shield size={24} />
              <span>✦</span>
            </div>
            <div>
              <b>SURAKSHA</b>
              <small>Public Safety Command Center</small>
            </div>
          </div>
        </div>

        <div className="topbar-right">
          {route === '/dashboard' && (
            <button
              className="topbar-recenter-btn"
              onClick={handleRecenter}
              title="Zoom out and recenter map to national overview"
            >
              <RotateCcw size={12} />
              <span>Recenter</span>
            </button>
          )}
          <div className={`live-card ${source}`}>
            <span className="live-dot" />
            <b>{source === 'loading' ? 'CONNECTING' : source === 'api' ? 'CONNECTED' : 'DEMO MODE'}</b>
          </div>
          <div className="date-card">
            <span>{clock.date}</span>
            <b>{clock.time}</b>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="workspace">
        {/* Navigation Rail with Suraksha rounded active items */}
        <aside className={`nav-rail ${menuOpen ? 'open' : ''}`}>
          <nav>
            {navigationItems.map(({ path, label, Icon }) => (
              <button
                key={path}
                className={`nav-item ${route === path ? 'active' : ''}`}
                onClick={() => navigate(path)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="nav-foot">
            <Shield size={16} style={{ color: 'var(--lime-deep)' }} />
            <span>Suraksha Command v2.4</span>
          </div>
        </aside>

        {/* View Routing */}
        {route === '/evidence' ? (
          <EvidenceReconstructionPage onNavigate={navigate} />
        ) : route === '/propagation' ? (
          <InformationPropagationPage onNavigate={navigate} />
        ) : route === '/verification' ? (
          <VerificationPage onNavigate={navigate} />
        ) : route === '/advisories' ? (
          <AdvisoriesPage onNavigate={navigate} prefillMessage={navState?.prefillMessage} />
        ) : (
          /* Incident Dashboard with strong personality and clean editorial hierarchy */
          <main className="dashboard">
            {/* 4 Distinctive Suraksha Metric Cards with colored icon circles */}
            <section className="metrics-grid">
              <div className="metric-card blue">
                <div className="metric-icon">
                  <Layers3 size={20} />
                </div>
                <div className="metric-copy">
                  <span>TOTAL MONITORED</span>
                  <b>{source === 'loading' ? '—' : counts.total}</b>
                </div>
              </div>

              <div className="metric-card red">
                <div className="metric-icon">
                  <Siren size={20} />
                </div>
                <div className="metric-copy">
                  <span>HIGH RISK</span>
                  <b>{source === 'loading' ? '—' : (counts.HIGH || 0) + (counts.CRITICAL || 0)}</b>
                </div>
              </div>

              <div className="metric-card amber">
                <div className="metric-icon">
                  <AlertTriangle size={20} />
                </div>
                <div className="metric-copy">
                  <span>MEDIUM RISK</span>
                  <b>{source === 'loading' ? '—' : counts.MEDIUM || 0}</b>
                </div>
              </div>

              <div className="metric-card green">
                <div className="metric-icon">
                  <Shield size={20} />
                </div>
                <div className="metric-copy">
                  <span>LOW / ROUTINE</span>
                  <b>{source === 'loading' ? '—' : counts.LOW || 0}</b>
                </div>
              </div>
            </section>

            {/* Main 3-Column Layout */}
            <section className="main-grid">
              {/* Map Panel (Visual Anchor) */}
              <div className="panel map-panel">
                <div className="map-tools">
                  <button
                    className={`map-mode ${!satellite ? 'active' : ''}`}
                    onClick={() => setSatellite(false)}
                  >
                    Map
                  </button>
                  <button
                    className={`map-mode ${satellite ? 'active' : ''}`}
                    onClick={() => setSatellite(true)}
                  >
                    Satellite
                  </button>
                  <button
                    className={`map-mode ${heatmap ? 'active' : ''}`}
                    onClick={() => setHeatmap((prev) => !prev)}
                    title="Toggle Severity Heatmap Overlay"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: heatmap ? '#ef4444' : '#94a3b8',
                      boxShadow: heatmap ? '0 0 6px rgba(239, 68, 68, 0.8)' : 'none'
                    }} />
                    <span>Heatmap</span>
                  </button>
                  <button
                    className="map-mode"
                    onClick={handleRecenter}
                    title="Zoom out and recenter map to national overview"
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <RotateCcw size={12} />
                    <span>Recenter</span>
                  </button>
                </div>

                <MapContainer
                  center={[22.8, 79.1]}
                  zoom={4.8}
                  minZoom={4}
                  maxZoom={18}
                  zoomControl={false}
                  scrollWheelZoom
                  className="india-map"
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap"
                    url={satellite
                      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    }
                  />
                  <ZoomControl position="bottomright" />
                  <FocusMap incident={mapFocus} resetKey={resetKey} />
                  <HeatmapLayer incidents={incidents} visible={heatmap} />
                  {incidents.map((item) =>
                    item.latitude != null && item.longitude != null && Number.isFinite(Number(item.latitude)) && (
                      <IncidentMarker
                        key={item.id}
                        item={item}
                        selected={selected?.id === item.id}
                        onSelect={chooseIncident}
                      />
                    )
                  )}
                </MapContainer>
              </div>

              {/* Center Panel: Active Incidents List with Camera Thumb Tiles */}
              <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="section-heading">
                  <h2>ACTIVE INCIDENTS</h2>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{visibleIncidents.length} listed</span>
                </div>

                <div className="filter-tabs">
                  {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((tab) => (
                    <button
                      key={tab}
                      className={filter === tab ? 'selected' : ''}
                      onClick={() => setFilter(tab)}
                    >
                      {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>

                <div className="incident-list">
                  {visibleIncidents.map((item) => {
                    const isSelected = selected?.id === item.id
                    return (
                      <button
                        key={item.id}
                        className={`incident-row ${isSelected ? 'chosen' : ''}`}
                        onClick={() => chooseIncident(item)}
                      >
                        <div className={`incident-thumb thumb-${(item.severity || 'low').toLowerCase()}`}>
                          <Camera size={16} />
                          <span>{item.id.slice(-2)}</span>
                        </div>

                        <div className="incident-copy">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Severity level={item.severity} />
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.timestamp}</span>
                          </div>
                          <b>{item.type}</b>
                          <span className="incident-place">{item.location}</span>
                        </div>

                        <div className="confidence">
                          <b>{Math.round((item.confidence || 0) * 100)}%</b>
                          <small>conf.</small>
                        </div>
                        <ChevronRight className="row-arrow" size={14} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Right Panel: Selected Incident Summary with Strong Editorial Hierarchy */}
              <div className="panel detail-panel">
                <div className="detail-header">
                  <h2>INCIDENT INSPECTION</h2>
                  {selected && (
                    <button
                      onClick={() => setSelected(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {selected ? (
                  <>
                    {/* CRT Camera Visual Preview */}
                    <div className="camera-preview">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.85 }}>
                        <Users size={32} />
                        <span style={{ fontSize: 13, letterSpacing: 2 }}>········</span>
                      </div>
                      <span className="camera-live">
                        <i /> LIVE FEED
                      </span>
                      <div className="camera-label">
                        <Video size={11} style={{ marginRight: 4 }} />
                        {selected.camera || 'Camera Feed'}
                      </div>
                    </div>

                    {/* Dominant Editorial Incident Hero */}
                    <div className="detail-hero-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Severity level={selected.severity} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          ● {selected.status || 'ACTIVE'}
                        </span>
                      </div>
                      <h3 className="detail-headline">{selected.type}</h3>
                      <div className="detail-location-row">
                        <MapPin size={12} style={{ color: 'var(--lime-deep)' }} />
                        <span>{selected.location}</span>
                        <span>·</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{selected.timestamp} IST</span>
                      </div>
                      <p className="detail-desc">
                        {selected.description || 'Elevated crowd density detected by real-time computer vision.'}
                      </p>
                    </div>

                    {/* Key Telemetry Summary Box */}
                    <div className="detail-key-metrics">
                      <div className="detail-metric-item">
                        <span>Crowd Density</span>
                        <b>{selected.density != null ? `${selected.density}%` : '86%'}</b>
                      </div>
                      <div className="detail-metric-item">
                        <span>Movement Flow</span>
                        <b>{selected.velocity != null ? `${selected.velocity} m/s` : '0.24 m/s'}</b>
                      </div>
                      <div className="detail-metric-item">
                        <span>AI Confidence</span>
                        <b>{selected.confidence != null ? `${Math.round(selected.confidence * 100)}%` : '91%'}</b>
                      </div>
                      <div className="detail-metric-item">
                        <span>Camera Unit</span>
                        <b style={{ fontSize: 11 }}>{selected.camera?.split('·')[0] || 'Cam 03'}</b>
                      </div>
                    </div>

                    {/* Characterful Suraksha Action Buttons */}
                    <div className="quick-actions-box">
                      <button className="quick-action-btn primary" onClick={() => navigate('/evidence')}>
                        <Video size={16} />
                        <span>View Evidence Reconstruction</span>
                        <ChevronRight size={14} />
                      </button>
                      <button className="quick-action-btn" onClick={() => navigate('/verification')}>
                        <Activity size={16} />
                        <span>Verify Public Reports</span>
                        <ChevronRight size={14} />
                      </button>
                      <button className="quick-action-btn" onClick={() => navigate('/advisories')}>
                        <Bell size={16} />
                        <span>Publish Citizen Advisory</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    {/* Progressive Disclosure: Secondary Technical Metadata */}
                    <div className="tech-details-box">
                      <button
                        className="tech-details-toggle"
                        onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                      >
                        <span>{showTechnicalDetails ? '– Hide Technical Parameters' : '+ Technical Parameters & Logs'}</span>
                        {showTechnicalDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      {showTechnicalDetails && (
                        <div className="tech-details-content">
                          <div className="tech-row">
                            <span>Incident ID</span>
                            <b>{selected.id}</b>
                          </div>
                          <div className="tech-row">
                            <span>Camera Stream</span>
                            <b>{selected.camera || 'CCTV Network'}</b>
                          </div>
                          <div className="tech-row">
                            <span>Coordinates</span>
                            <b>{Number(selected.latitude).toFixed(4)}, {Number(selected.longitude).toFixed(4)}</b>
                          </div>
                          <div className="tech-row">
                            <span>CV Pipeline</span>
                            <b>YOLOv8 + Farneback Optical Flow</b>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="empty-detail-box">
                    <MapPin size={24} style={{ color: 'var(--text-muted)' }} />
                    <b>Select an Incident</b>
                    <p>Click on any marker on the map or incident list to inspect live evidence and dispatch responses.</p>
                  </div>
                )}
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  )
}

export default App
