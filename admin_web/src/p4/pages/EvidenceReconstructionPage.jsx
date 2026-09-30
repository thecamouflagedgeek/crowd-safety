import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Video,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  Maximize,
  CheckCircle2
} from 'lucide-react'
import { IncidentLifecycle } from '../components/IncidentLifecycle'
import { IncidentSelectorBar } from '../components/IncidentSelectorBar'
import { RadialEvidenceConvergence } from '../components/RadialEvidenceConvergence'
import { EvidenceDrawer } from '../components/EvidenceDrawer'
import { fetchIncidents, fetchEvidence, fetchSourceGraph, mediaUrl } from '../services/api'
import { DEFAULT_INCIDENT, INCIDENTS_LIST, TIMELINE_EVENTS, CAMERAS_CONFIG } from '../services/mockData'

// Same palette the breakdown card already used, keyed by backend source-graph node type.
const SOURCE_COLOR = {
  cctv: '#a7cc08',
  citizen: '#d8f344',
  official: '#142034',
  news: '#c3db29',
  social: '#eab308',
  other: '#94a3b8'
}

// Backend /evidence timeline entries -> the forensic scrubber's node shape.
function toTimelineNodes(entries) {
  return (entries || []).map((item, index) => ({
    id: item.id || `api-evt-${index}`,
    time: item.time || item.timestamp || '',
    timestamp: item.timestamp || item.time || '',
    event: item.event || 'Observation',
    source: item.source || 'CV Pipeline',
    sourceType: /camera|cctv|flow|optical/i.test(item.source || '')
      ? 'CCTV'
      : /authority|command|command room|marshal/i.test(item.source || '')
        ? 'Authority'
        : 'Citizen',
    severity: item.severity,
    detail: item.detail || item.event || '',
    verified: true
  }))
}

export function EvidenceReconstructionPage({ onNavigate, incidentId }) {
  const [incidents, setIncidents] = useState(INCIDENTS_LIST)
  const [selectedIncident, setSelectedIncident] = useState(
    () => INCIDENTS_LIST.find((i) => i.id === incidentId) || DEFAULT_INCIDENT
  )
  const [selectedNode, setSelectedNode] = useState(null)
  const [drawerItem, setDrawerItem] = useState(null)
  const [activeCamIndex, setActiveCamIndex] = useState(0) // 0: Cam 01, 1: Cam 02
  const [currentTimecode, setCurrentTimecode] = useState('18:08:32')
  const [activeTimelineId, setActiveTimelineId] = useState('evt-2') // 18:08

  // Live reconstruction pulled from the backend (timeline, sources, cameras, CV metrics).
  const [evidence, setEvidence] = useState(null)
  const [sourceGraph, setSourceGraph] = useState(null)
  const [feedState, setFeedState] = useState('loading')

  // Video playback state
  const [isPlaying, setIsPlaying] = useState(true)
  const videoRef = useRef(null)

  useEffect(() => {
    let live = true
    fetchIncidents().then((res) => {
      if (!live || !res.data) return
      setIncidents(res.data)
      setSelectedIncident((current) => {
        const wanted = incidentId || current?.id
        return res.data.find((i) => i.id === wanted) || res.data[0] || current
      })
      setFeedState(res.isMock ? 'demo' : 'api')
    })
    return () => { live = false }
  }, [incidentId])

  // Reload the whole reconstruction whenever the selected incident changes.
  useEffect(() => {
    const id = selectedIncident?.id
    if (!id) return
    let live = true
    Promise.all([fetchEvidence(id), fetchSourceGraph(id)]).then(([ev, graph]) => {
      if (!live) return
      setEvidence(ev)
      setSourceGraph(graph.data)
      if (ev.isMock) setFeedState('demo')
      const nodes = toTimelineNodes(ev.timeline)
      if (nodes.length) {
        const first = nodes[0]
        setActiveTimelineId(first.id)
        setCurrentTimecode(first.timestamp && first.timestamp.length > 5 ? first.timestamp : `${first.time}:00`)
      }
    })
    return () => { live = false }
  }, [selectedIncident?.id])

  const timelineNodes = useMemo(() => {
    const fromApi = toTimelineNodes(evidence?.timeline)
    return fromApi.length ? fromApi : TIMELINE_EVENTS
  }, [evidence])

  const metrics = evidence?.metrics || {}
  const density = metrics.density ?? selectedIncident.density
  const confidence = metrics.confidence ?? selectedIncident.confidence

  const evidenceSources = useMemo(
    () => (sourceGraph?.nodes || []).filter((node) => node.type !== 'incident'),
    [sourceGraph]
  )

  const cameras = useMemo(() => {
    const labels = evidence?.cameras || []
    return CAMERAS_CONFIG.map((cam, index) => ({
      ...cam,
      label: labels[index] || cam.label,
      // Real HTTP URL served by FastAPI's /videos static mount (never a fake path).
      streamUrl: mediaUrl(cam.streamUrl),
      metrics: {
        density: density == null ? cam.metrics.density : `${density}%`,
        velocity: metrics.velocity == null ? cam.metrics.velocity : `${metrics.velocity} m/s`,
        count: cam.metrics.count
      }
    }))
  }, [evidence, density, metrics.velocity])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      videoRef.current.play().catch(() => {})
      setIsPlaying(true)
    }
  }

  const restartVideo = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = 0
    videoRef.current.play().catch(() => {})
    setIsPlaying(true)
  }

  const toggleFullscreen = () => {
    if (!videoRef.current) return
    if (videoRef.current.requestFullscreen) videoRef.current.requestFullscreen()
  }

  const handleSelectNode = (node) => {
    setSelectedNode(node)
    setDrawerItem(node)
  }

  const handleTimelineClick = (evt) => {
    setActiveTimelineId(evt.id)
    if (evt.time) setCurrentTimecode(`${evt.time}:00`)
    setDrawerItem(evt)
  }

  const activeCam = cameras[activeCamIndex] || cameras[0]

  return (
    <div className="p4-workspace">
      {/* Top Header matching Suraksha theme */}
      <div className="p4-page-header">
        <div className="p4-header-info">
          <span className="p4-badge-tag">SURAKSHA · EVIDENCE HUB</span>
          <h1 className="p4-page-title">
            <Video size={23} style={{ color: 'var(--ink)' }} />
            EVIDENCE RECONSTRUCTION
          </h1>
          <p className="p4-page-subtitle">
            Reconstruct the sequence of events from synchronized video, reports, and verified sources.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="p4-ink-btn"
            onClick={() => onNavigate('/propagation')}
          >
            <span>PROPAGATION NETWORK</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Incident Lifecycle Bar */}
      <IncidentLifecycle currentStep="INVESTIGATING" incidentId={selectedIncident.id} />

      {/* Incident Selector Control Bar */}
      <IncidentSelectorBar
        incidents={incidents}
        selectedIncident={selectedIncident}
        onSelectIncident={setSelectedIncident}
        timeRange={timelineNodes.length ? `${timelineNodes[0].time} — ${timelineNodes[timelineNodes.length - 1].time}` : '18:00 — 18:30'}
      />

      {/* THREE-COLUMN SIMPLIFIED RECONSTRUCTION GRID */}
      <div className="p4-recon-grid">
        {/* LEFT COLUMN: Hero Stat & Source Breakdown Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="p4-panel-box">
            <div>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-muted)', letterSpacing: '0.08em' }}>
                INCIDENT TELEMETRY
              </span>
              <h2 style={{ margin: '4px 0 2px', fontSize: 22, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-title)' }}>
                {selectedIncident.type}
              </h2>
              <span style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>
                Location: <b style={{ color: 'var(--ink)' }}>{selectedIncident.location}</b>
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="p4-ink-btn"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => onNavigate('/verification')}
              >
                Validate
              </button>
              <button
                className="p4-outline-btn"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => onNavigate('/advisories')}
              >
                Advisories
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
                Verified Confidence
              </span>
              <div className="p4-stat-number" style={{ marginTop: 2 }}>
                {Math.round((confidence || 0) * 100)}%
              </div>
              <span style={{ fontSize: 11, color: '#047d53', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <CheckCircle2 size={13} />
                Multi-Source Agreement High
              </span>
            </div>
          </div>

          {/* Evidence Breakdown Card */}
          <div className="p4-panel-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="p4-box-title">Evidence Breakdown</h3>
              <span style={{ fontSize: 10, color: 'var(--ink-muted)', fontWeight: 700 }}>RELIABILITY (BACKEND SOURCES)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {evidenceSources.map((src) => (
                <div className="p4-source-item" key={src.id}>
                  <div className="p4-source-left">
                    <span className="p4-source-circle" style={{ background: SOURCE_COLOR[src.type] || SOURCE_COLOR.other }} />
                    <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{src.label}</span>
                  </div>
                  <span style={{ color: (src.credibility ?? 0) >= 0.7 ? '#116b4b' : '#795100', fontWeight: 800 }}>
                    {src.credibility == null ? '—' : `${Math.round(src.credibility * 100)}%`}
                  </span>
                </div>
              ))}
              {!evidenceSources.length && (
                <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                  No source records attributed to {selectedIncident.id} yet.
                </span>
              )}

            </div>
          </div>
        </div>

        {/* CENTER COLUMN: 2D Monochromatic Yellow Floating Bubble Network */}
        <div className="p4-bubble-cluster-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--border-light)' }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink)', letterSpacing: '0.08em' }}>
                MONOCHROMATIC CONVERGENCE RADAR
              </span>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-secondary)' }}>
                Multi-Source Convergence on {selectedIncident.id}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <span className="p4-pill-badge yellow">{(selectedIncident.location || 'ZONE').toUpperCase()} CLUSTER</span>
              <span className={`p4-pill-badge ${feedState === 'api' ? 'green' : 'amber'}`}>
                {feedState === 'api' ? 'LIVE BACKEND FEEDS' : feedState === 'demo' ? 'DEMO EVIDENCE DATA' : 'CONNECTING'}
              </span>
            </div>
          </div>

          <RadialEvidenceConvergence
            density={density || 0}
            confidence={Math.round((confidence || 0) * 100)}
            incidentId={selectedIncident.id}
            selectedNode={selectedNode}
            onSelectNode={handleSelectNode}
          />
        </div>

        {/* RIGHT COLUMN: Video Player & Metric Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Top Video Preview Box */}
          <div className="p4-panel-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="p4-box-title">Live Video Feeds</h3>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className={`p4-outline-btn ${activeCamIndex === 0 ? 'active' : ''}`}
                  style={{
                    padding: '3px 8px',
                    fontSize: 10,
                    background: activeCamIndex === 0 ? 'var(--ink)' : 'transparent',
                    color: activeCamIndex === 0 ? 'var(--lime)' : 'var(--ink)'
                  }}
                  onClick={() => setActiveCamIndex(0)}
                >
                  Cam 01
                </button>
                <button
                  className={`p4-outline-btn ${activeCamIndex === 1 ? 'active' : ''}`}
                  style={{
                    padding: '3px 8px',
                    fontSize: 10,
                    background: activeCamIndex === 1 ? 'var(--ink)' : 'transparent',
                    color: activeCamIndex === 1 ? 'var(--lime)' : 'var(--ink)'
                  }}
                  onClick={() => setActiveCamIndex(1)}
                >
                  Cam 02
                </button>
              </div>
            </div>

            {/* Video Box */}
            <div className="p4-video-box">
              <div className="p4-video-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                  {activeCam.label}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--lime)' }}>
                  {currentTimecode}
                </span>
              </div>

              <div className="p4-video-player-wrap">
                <video
                  ref={videoRef}
                  src={activeCam.streamUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              </div>

              <div className="p4-video-controls">
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="p4-outline-btn" style={{ padding: '3px 8px', color: '#fff', borderColor: '#334155' }} onClick={togglePlay}>
                    {isPlaying ? <Pause size={11} /> : <Play size={11} />}
                  </button>
                  <button className="p4-outline-btn" style={{ padding: '3px 8px', color: '#fff', borderColor: '#334155' }} onClick={restartVideo}>
                    <RotateCcw size={11} />
                  </button>
                </div>
                <button className="p4-outline-btn" style={{ padding: '3px 8px', color: '#fff', borderColor: '#334155' }} onClick={toggleFullscreen}>
                  <Maximize size={11} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-secondary)' }}>
              <span>Zone: <b>{activeCam.zone}</b></span>
              <span style={{ color: '#047d53', fontWeight: 800 }}>● {activeCam.status}</span>
            </div>
          </div>

          {/* Sensor Congruence Equalizer Card in Yellow/Lime Monochromatic tones */}
          <div className="p4-panel-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
                  SENSOR CONGRUENCE
                </span>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-title)' }}>
                  94.2% Agreement
                </div>
              </div>
              <span className="p4-pill-badge yellow">HIGH</span>
            </div>

            {/* Monochromatic Yellow/Lime Equalizer Bars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44, paddingTop: 8 }}>
              {[
                { h: 32, col: '#fef08a' },
                { h: 40, col: '#fef08a' },
                { h: 26, col: '#eaf4bb' },
                { h: 44, col: '#d8f344' },
                { h: 36, col: '#d8f344' },
                { h: 44, col: '#c3db29' },
                { h: 38, col: '#c3db29' },
                { h: 42, col: '#a7cc08' },
                { h: 38, col: '#a7cc08' },
                { h: 28, col: '#ca8a04' },
                { h: 44, col: '#142034' },
                { h: 36, col: '#142034' }
              ].map((bar, idx) => (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-end' }}>
                  <div
                    style={{ width: '100%', height: `${bar.h}px`, background: bar.col, borderRadius: 3 }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-muted)' }}>
              <span>18:00</span>
              <span>18:15</span>
              <span>18:30</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM STRIP: Horizontal Forensic Timeline Scrubber */}
      <div className="p4-bottom-timeline">
        <div className="p4-timeline-left-stat">
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Forensic Timeline
          </span>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-title)' }}>
            {currentTimecode.slice(0, 5)} IST
          </div>
          <span style={{ fontSize: 10, color: 'var(--lime-deep)', fontWeight: 700 }}>
            Window: {timelineNodes.length ? `${timelineNodes[0].time} — ${timelineNodes[timelineNodes.length - 1].time}` : '18:00 — 18:30'}
          </span>
        </div>

        <div className="p4-scrub-track">
          <div className="p4-track-line" />

          {timelineNodes.map((evt) => {
            const isActive = activeTimelineId === evt.id

            return (
              <div
                key={evt.id}
                className={`p4-track-node ${isActive ? 'active' : ''}`}
                onClick={() => handleTimelineClick(evt)}
                title={`${evt.time} - ${evt.event}`}
              >
                <span className="p4-track-node-time">{evt.time}</span>
                <span className="p4-track-node-label">
                  {evt.event.length > 14 ? `${evt.event.slice(0, 13)}…` : evt.event}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Forensic Inspection Modal Drawer */}
      {drawerItem && (
        <EvidenceDrawer
          item={drawerItem}
          onClose={() => setDrawerItem(null)}
          onNavigateVerify={(item) => onNavigate('/verification', { fromEvidence: item })}
        />
      )}
    </div>
  )
}
