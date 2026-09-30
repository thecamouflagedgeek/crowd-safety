import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Activity, AlertTriangle, Bell, Camera, Check, ChevronRight, Clock3, Crosshair, Filter, Layers3, List, LoaderCircle, MapPin, Menu, Radio, Share2, Shield, Siren, Users, Video, X } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import './App.css'
import './p4/styles/p4.css'
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
  { id: 'INC017', type: 'Public Gathering', location: 'India Gate, Delhi', latitude: 28.6129, longitude: 77.2295, severity: 'LOW', confidence: .75, density: 51, velocity: .65, status: 'MONITORING', timestamp: '05:36', camera: 'Camera 04 · Rajpath' },
]
const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const apiBase = import.meta.env.VITE_API_BASE_URL || ''
const INCIDENT_FOCUS_ZOOM = 11

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
  return L.divIcon({ className: 'incident-marker-wrap', html: `<span class="incident-marker ${selected ? 'selected' : ''}" style="--marker-color:${color}"><span></span></span>`, iconSize: [34, 42], iconAnchor: [17, 34] })
}
function FocusMap({ incident }) {
  const map = useMap()
  useEffect(() => {
    if (!incident || incident.latitude == null || incident.longitude == null || !Number.isFinite(Number(incident.latitude)) || !Number.isFinite(Number(incident.longitude))) return
    const center = [Number(incident.latitude), Number(incident.longitude)]
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.setView(center, INCIDENT_FOCUS_ZOOM, { animate: false })
    else map.flyTo(center, INCIDENT_FOCUS_ZOOM, { duration: .28, easeLinearity: .25 })
  }, [incident, map])
  return null
}
const IncidentMarker = memo(function IncidentMarker({ item, selected, onSelect }) {
  const icon = useMemo(() => markerIcon(item.severity, selected), [item.severity, selected])
  return <Marker position={[item.latitude, item.longitude]} icon={icon} eventHandlers={{ click: () => onSelect(item) }}/>
})
function Severity({ level }) { return <span className={`severity severity-${(level || 'LOW').toLowerCase()}`}>{level || 'UNKNOWN'}</span> }
function routeFromPath() { const path = window.location.pathname.replace(/\/$/, ''); return path === '' || path === '/' ? '/dashboard' : path }
function getLocalTime() {
  const now = new Date()
  return { date: new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(now), time: new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(now) }
}

function App() {
  const [incidents, setIncidents] = useState([])
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('ALL')
  const [route, setRoute] = useState(routeFromPath)
  const [source, setSource] = useState('loading')
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [satellite, setSatellite] = useState(false)
  const [clock, setClock] = useState(getLocalTime)
  const [mapFocus, setMapFocus] = useState(null)
  const knownIncidentIds = useRef(new Set())

  useEffect(() => {
    let live = true
    getIncidents().then((rows) => { if (!live) return; const sorted = sortIncidents(rows); knownIncidentIds.current = new Set(sorted.map((item) => item.id)); setIncidents(sorted); setSource('api'); setError(''); setSelected(sorted.find((x) => x.id === 'INC001') || sorted[0] || null) }).catch((err) => { if (!live) return; knownIncidentIds.current = new Set(demoIncidents.map((item) => item.id)); setIncidents(demoIncidents); setSelected(demoIncidents[0]); setSource('demo'); setError(err.message) })
    const onPop = () => setRoute(routeFromPath())
    window.addEventListener('popstate', onPop)
    return () => { live = false; window.removeEventListener('popstate', onPop) }
  }, [])
  useEffect(() => {
    if (source === 'loading') return
    const reconnectingFromDemo = source === 'demo'
    let live = true
    let refreshing = false
    const refreshIncidents = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const rows = sortIncidents(await getIncidents())
        if (!live) return
        if (reconnectingFromDemo) {
          const newSinceDemo = rows.filter((item) => !knownIncidentIds.current.has(item.id))
          knownIncidentIds.current = new Set(rows.map((item) => item.id))
          setIncidents(rows)
          const focusIncident = newSinceDemo[0]
          setSelected(focusIncident || rows.find((item) => item.id === 'INC001') || rows[0] || null)
          if (focusIncident) setMapFocus(focusIncident)
          setSource('api')
          setError('')
          return
        }
        const known = knownIncidentIds.current
        const newIncidents = rows.filter((item) => !known.has(item.id))
        knownIncidentIds.current = new Set(rows.map((item) => item.id))
        setIncidents(rows)
        if (newIncidents.length) {
          const latest = newIncidents[0]
          setSelected(latest)
          setMapFocus(latest)
        } else {
          setSelected((current) => {
            const updated = rows.find((item) => item.id === current?.id)
            return updated && current ? { ...current, ...updated } : current
          })
        }
      } catch {
        // Keep the last successful incident snapshot visible during temporary API interruptions.
      } finally {
        refreshing = false
      }
    }
    const timer = window.setInterval(refreshIncidents, 5000)
    return () => { live = false; window.clearInterval(timer) }
  }, [source])
  useEffect(() => {
    const timer = window.setInterval(() => setClock(getLocalTime()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (source !== 'api' || !selected?.id) return
    let live = true
    getIncident(selected.id).then((detail) => { if (live) setSelected((current) => current?.id === detail.id ? { ...current, ...detail } : current) }).catch(() => {})
    return () => { live = false }
  }, [selected?.id, source])

  const counts = useMemo(() => incidents.reduce((acc, i) => { const severity = (i.severity || 'LOW').toUpperCase(); acc.total++; acc[severity] = (acc[severity] || 0) + 1; return acc }, { total: 0 }), [incidents])
  const visible = incidents.filter((i) => filter === 'ALL' || (i.severity || '').toUpperCase() === filter)
  const activeCount = incidents.filter((i) => (i.status || '').toUpperCase() === 'ACTIVE').length
  const [navState, setNavState] = useState({})
  const navigate = (to, state = {}) => { window.history.pushState({}, '', to); setRoute(to); setNavState(state); setMenuOpen(false) }
  const choose = useCallback((item) => { setSelected(item); setMapFocus(item); if (item.latitude != null && item.longitude != null) document.querySelector('.map-panel')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }) }, [])
  const cycleFilter = () => setFilter((current) => ({ ALL: 'HIGH', HIGH: 'MEDIUM', MEDIUM: 'LOW', LOW: 'ALL' })[current] || 'ALL')

  const links = [
    { path: '/dashboard', label: 'Dashboard', Icon: Layers3 },
    { path: '/evidence', label: 'Evidence Reconstruction', Icon: Video },
    { path: '/propagation', label: 'Information Propagation', Icon: Share2 },
    { path: '/verification', label: 'Information Verification', Icon: Activity },
    { path: '/advisories', label: 'Advisories', Icon: Bell }
  ]
  return <div className="app-shell">
    <header className="topbar">
      <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen}><Menu size={21}/></button>
      <div className="brand"><div className="brand-mark"><Shield size={26}/><span>✦</span></div><div><b>SURAKSHA</b><small>Public Safety Command Center</small></div></div>
      <div className="page-heading"><h1>PUBLIC SAFETY COMMAND CENTER</h1><p>REAL-TIME INCIDENT MONITORING <i/> INDIA</p></div>
      <div className="topbar-right"><div className={`live-card ${source}`}><span className="live-dot"/><b>{source === 'loading' ? 'CONNECTING' : source === 'api' ? 'CONNECTED' : 'DEMO MODE'}</b><small>{source === 'api' ? 'API · refresh 5s' : source === 'demo' ? 'Seeded incidents' : 'Loading incident feed'}</small></div><div className="date-card"><span>{clock.date}</span><b className="tabular-nums">{clock.time}</b></div></div>
    </header>
    {source === 'demo' && <div className="demo-banner"><AlertTriangle size={14}/> Demo data · API unavailable{error ? ` (${error})` : ''}</div>}
    {menuOpen && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}
    <div className="workspace">
      <aside className={`nav-rail ${menuOpen ? 'open' : ''}`}>
        <nav>{links.map(({ path, label, Icon }) => <button key={path} className={`nav-item ${route === path ? 'active' : ''}`} onClick={() => navigate(path)}><Icon size={20}/><span>{label}</span></button>)}</nav>
        <div className="nav-foot"><div className="foot-icon"><Activity size={21}/></div><span>India Safer<br/>Together</span><ChevronRight size={17}/></div>
      </aside>
      {route === '/evidence' ? (
        <EvidenceReconstructionPage onNavigate={navigate} />
      ) : route === '/propagation' ? (
        <InformationPropagationPage onNavigate={navigate} />
      ) : route === '/verification' ? (
        <VerificationPage onNavigate={navigate} />
      ) : route === '/advisories' ? (
        <AdvisoriesPage onNavigate={navigate} prefillMessage={navState?.prefillMessage} />
      ) : route !== '/dashboard' ? <main className="placeholder-page"><div className="placeholder-icon"><Shield size={28}/></div><span className="eyebrow">SURAKSHA · COMMAND CENTER</span><h2>{links.find((x) => x.path === route)?.label || 'Page'}</h2><p>This workspace is ready for the evidence, verification, and advisory modules.</p><button className="back-button" onClick={() => navigate('/dashboard')}>Return to dashboard <ChevronRight size={16}/></button></main> : <main className="dashboard">
        <section className="dashboard-intro" aria-label="Dashboard overview">
          <div><span className="intro-kicker"><i/> LIVE OPERATIONS <b>/{source === 'api' ? ' NATIONAL NETWORK' : source === 'demo' ? ' DEMO NETWORK' : ' CONNECTING'}</b></span><h2>Command overview</h2><p>See incidents as they unfold across India.</p></div>
          <div className="intro-context"><span className="context-orbit"><Activity size={18}/></span><div><b>{activeCount} ACTIVE</b><small>INCIDENTS NEED ATTENTION</small></div></div>
        </section>
        <section className="metrics-grid">
          <Metric title="TOTAL INCIDENTS" count={source === 'loading' ? '—' : counts.total} Icon={Layers3} tone="blue" note={source === 'loading' ? 'Loading' : `${counts.total} tracked`}/>
          <Metric title="HIGH RISK" count={source === 'loading' ? '—' : (counts.HIGH || 0) + (counts.CRITICAL || 0)} Icon={Siren} tone="red" note={source === 'loading' ? 'Loading' : `${counts.CRITICAL || 0} critical`}/>
          <Metric title="MEDIUM RISK" count={source === 'loading' ? '—' : counts.MEDIUM || 0} Icon={AlertTriangle} tone="amber" note={source === 'loading' ? 'Loading' : 'Needs attention'}/>
          <Metric title="LOW RISK" count={source === 'loading' ? '—' : counts.LOW || 0} Icon={Shield} tone="green" note={source === 'loading' ? 'Loading' : 'Monitoring'}/>
        </section>
        <section className="main-grid">
          <div className="map-panel panel">
            <MapContainer center={[22.8, 79.1]} zoom={4.7} minZoom={4} maxZoom={13} zoomControl={false} scrollWheelZoom className="india-map">
              <TileLayer attribution={satellite ? 'Tiles &copy; Esri' : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'} url={satellite ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}/>
              <ZoomControl position="topright"/><FocusMap incident={mapFocus}/>
              {incidents.map((item) => item.latitude != null && item.longitude != null && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)) && <IncidentMarker key={item.id} item={item} selected={selected?.id === item.id} onSelect={choose}/>) }
            </MapContainer>
            <div className="map-tools"><button className={`map-mode ${!satellite ? 'active' : ''}`} onClick={() => setSatellite(false)}>Map</button><button className={`map-mode ${satellite ? 'active' : ''}`} onClick={() => setSatellite(true)}>Satellite</button><button className="locate-button" onClick={() => document.querySelector('.leaflet-control-zoom-in')?.click()} aria-label="Zoom map"><Crosshair size={18}/></button></div>
            <div className="map-caption"><MapPin size={14}/><span>INDIA · NATIONAL INCIDENT MAP</span><span className="map-live"><i/> {source === 'api' ? 'CONNECTED' : source === 'demo' ? 'DEMO' : 'LOADING'}</span></div>
            <div className="map-legend"><b>SEVERITY</b>{[['high','High Risk'],['medium','Medium Risk'],['low','Low Risk']].map(([key,label]) => <span key={key}><i className={`legend-dot ${key}`}/>{label}</span>)}</div>
            <button className="map-list-button" onClick={() => document.querySelector('.incident-panel')?.scrollIntoView({ behavior: 'smooth' })}>View all incidents <List size={16}/></button>
          </div>
          <section className="incident-panel panel">
            <div className="section-heading"><div><h2>ACTIVE INCIDENTS</h2><p>{incidents.length} monitored · {activeCount} requiring attention</p></div><button className={`icon-button ${filter !== 'ALL' ? 'filter-on' : ''}`} onClick={cycleFilter} aria-label={`Cycle incident severity filter; currently ${filter.toLowerCase()}`} title={`Severity filter: ${filter}`}><Filter size={17}/></button></div>
            <div className="filter-tabs">{['ALL', ...(counts.CRITICAL ? ['CRITICAL'] : []), 'HIGH','MEDIUM','LOW'].map((f) => <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f === 'ALL' ? `All (${incidents.length})` : `${f[0]}${f.slice(1).toLowerCase()} (${counts[f] || 0})`}</button>)}</div>
            <div className="incident-list">{source === 'loading' ? <div className="loading-list" role="status" aria-label="Loading incidents">{[0,1,2,3].map((item) => <div className="loading-row" key={item} aria-hidden="true"><span/><div><i/><i/><i/></div><b/></div>)}</div> : visible.length ? visible.map((item) => <button key={item.id} className={`incident-row ${selected?.id === item.id ? 'chosen' : ''}`} onClick={() => choose(item)}>
              <div className={`incident-thumb thumb-${item.severity?.toLowerCase()}`}><Camera size={19}/><span>{item.id.slice(-2)}</span></div><div className="incident-copy"><div className="incident-meta"><Severity level={item.severity}/><span className="incident-time"><Clock3 size={12}/>{item.timestamp || '—'}</span></div><b>{item.type}</b><span className="incident-place">{item.location}</span><small>{item.status || 'ACTIVE'}</small></div><div className="confidence"><b>{Math.round((item.confidence || 0) * 100)}%</b><small>confidence</small></div><ChevronRight className="row-arrow" size={16}/>
            </button>) : <div className="empty-state">No incidents in this category.</div>}</div>
          </section>
          <aside className="detail-panel panel">
            <div className="detail-header"><h2>INCIDENT DETAILS</h2><button onClick={() => setSelected(null)} aria-label="Clear selection"><X size={19}/></button></div>
            {source === 'loading' ? <div className="empty-detail is-loading"><LoaderCircle size={26}/><b>Connecting to incident feed</b><span>Incident details will appear when data is ready.</span></div> : selected ? <>
              <div className="camera-preview"><div className="camera-scene"><Users size={40}/><span className="crowd-lines">············<br/>············</span></div><span className={`camera-live ${source === 'demo' ? 'demo-feed' : ''}`}><i/>{source === 'demo' ? 'DEMO VISUAL' : 'NO LIVE FEED'}</span><div className="camera-label"><Video size={13}/>{selected.camera || 'Camera source unavailable'}</div></div>
              <div className="detail-tags"><Severity level={selected.severity}/><span className={`status-pill status-${(selected.status || 'unknown').toLowerCase()}`}><i/>{selected.status || 'STATUS UNKNOWN'}</span></div>
              <h3>{selected.type}</h3><div className="detail-location"><MapPin size={15}/>{selected.location}</div><p className="incident-description">{selected.description || 'Incident detected by the real-time monitoring system.'}</p>
              <div className="detail-stats">{[[Camera,'Incident ID',selected.id || '—'],[Clock3,'Timestamp',selected.timestamp || '—'],[MapPin,'Location',selected.location || '—'],[Crosshair,'Latitude',Number.isFinite(Number(selected.latitude)) && selected.latitude !== null ? Number(selected.latitude).toFixed(4) : '—'],[Crosshair,'Longitude',Number.isFinite(Number(selected.longitude)) && selected.longitude !== null ? Number(selected.longitude).toFixed(4) : '—'],[Activity,'Confidence',selected.confidence == null ? '—' : `${Math.round(selected.confidence*100)}%`],[Users,'Crowd Density',selected.density == null ? '—' : `${selected.density}%`],[Activity,'Movement Velocity',selected.velocity == null ? '—' : `${selected.velocity} m/s`],[Shield,'Status',selected.status || '—']].map(([Icon,label,value]) => <div className="stat-row" key={label}><Icon size={14}/><span>{label}</span><b>{value}</b></div>)}</div>
              <div className="quick-actions"><h4>QUICK ACTIONS <kbd>P4</kbd></h4><button onClick={() => navigate('/evidence')}><Video size={18}/>View Evidence<ChevronRight size={17}/></button><button onClick={() => navigate('/verification')}><Activity size={18}/>Verify Information<ChevronRight size={17}/></button><button onClick={() => navigate('/advisories')}><Bell size={18}/>Publish Advisory<ChevronRight size={17}/></button></div>
            </> : <div className="empty-detail"><MapPin size={26}/><b>{incidents.length ? 'Select an incident' : 'No incidents available'}</b><span>{incidents.length ? 'Choose an incident from the map or list to inspect its details.' : 'There are no incidents in the current feed.'}</span></div>}
          </aside>
        </section>
        <footer className="dashboard-footer"><span><Radio size={14}/> Incident monitoring workspace</span><span>{source === 'api' ? <><Check size={14}/> Connected to incident API</> : source === 'demo' ? 'Demo mode · seeded incident data' : 'Connecting to incident API…'}</span></footer>
      </main>}
    </div>
  </div>
}

function Metric({ title, count, Icon, tone, note }) { return <article className={`metric-card ${tone}`}><div className="metric-icon"><Icon size={23}/></div><div className="metric-copy"><span>{title}</span><div><b>{count}</b><small>{note}</small></div></div><div className="metric-spark">↗</div></article> }
export default App
