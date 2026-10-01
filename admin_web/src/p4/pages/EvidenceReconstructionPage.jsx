import React, { useState, useEffect, useRef } from 'react'
import {
  Video,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  Maximize
} from 'lucide-react'
import { IncidentLifecycle } from '../components/IncidentLifecycle'
import { IncidentSelectorBar } from '../components/IncidentSelectorBar'
import { RadialEvidenceConvergence } from '../components/RadialEvidenceConvergence'
import { EvidenceDrawer } from '../components/EvidenceDrawer'
import { fetchIncidents } from '../services/api'
import { DEFAULT_INCIDENT, INCIDENTS_LIST, TIMELINE_EVENTS, CAMERAS_CONFIG } from '../services/mockData'

export function EvidenceReconstructionPage({ onNavigate }) {
  const [incidents, setIncidents] = useState(INCIDENTS_LIST)
  const [selectedIncident, setSelectedIncident] = useState(DEFAULT_INCIDENT)
  const [selectedNode, setSelectedNode] = useState(null)
  const [drawerItem, setDrawerItem] = useState(null)
  const [activeCamIndex, setActiveCamIndex] = useState(0) // 0: Cam 01, 1: Cam 02
  const [currentTimecode, setCurrentTimecode] = useState('18:08:32')
  const [activeTimelineId, setActiveTimelineId] = useState('evt-2') // 18:08

  // Video playback state
  const [isPlaying, setIsPlaying] = useState(true)
  const [showEqualizer, setShowEqualizer] = useState(false)
  const videoRef = useRef(null)

  useEffect(() => {
    fetchIncidents().then((res) => {
      if (res.data) setIncidents(res.data)
    })
  }, [])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      videoRef.current.play().catch(() => { })
      setIsPlaying(true)
    }
  }

  const restartVideo = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = 0
    videoRef.current.play().catch(() => { })
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

  const activeCam = CAMERAS_CONFIG[activeCamIndex] || CAMERAS_CONFIG[0]

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
        timeRange="18:00 — 18:30"
      />

      {/* 2-COLUMN EDITORIAL RECONSTRUCTION GRID */}
      <div className="p4-recon-grid">
        {/* LEFT COLUMN: HERO VISUAL ANCHORS (Convergence Radar UP + CCTV Video Deck DOWN) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 1. Monochromatic Convergence Radar Graph (UP) */}
          <div className="p4-bubble-cluster-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink)', letterSpacing: '0.08em' }}>
                  MONOCHROMATIC CONVERGENCE RADAR
                </span>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-secondary)' }}>
                  Multi-Source Convergence on INC001
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <span className="p4-pill-badge yellow">GATE 3 CLUSTER</span>
                <span className="p4-pill-badge green">ALL FEEDS SYNCED</span>
              </div>
            </div>

            <RadialEvidenceConvergence
              density={selectedIncident.density || 86}
              confidence={Math.round((selectedIncident.confidence || 0.91) * 100)}
              incidentId={selectedIncident.id}
              selectedNode={selectedNode}
              onSelectNode={handleSelectNode}
            />
          </div>

          {/* 2. Synchronized CCTV Surveillance Video Deck (DOWN) */}
          <div className="p4-panel-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Video size={18} style={{ color: 'var(--ink)' }} />
                <h3 className="p4-box-title">SYNCHRONIZED CCTV SURVEILLANCE</h3>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className={`p4-outline-btn ${activeCamIndex === 0 ? 'active' : ''}`}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    background: activeCamIndex === 0 ? 'var(--ink)' : 'transparent',
                    color: activeCamIndex === 0 ? 'var(--lime)' : 'var(--ink)'
                  }}
                  onClick={() => setActiveCamIndex(0)}
                >
                  Cam 01 (Gate Concourse)
                </button>
                <button
                  className={`p4-outline-btn ${activeCamIndex === 1 ? 'active' : ''}`}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    background: activeCamIndex === 1 ? 'var(--ink)' : 'transparent',
                    color: activeCamIndex === 1 ? 'var(--lime)' : 'var(--ink)'
                  }}
                  onClick={() => setActiveCamIndex(1)}
                >
                  Cam 02 (Perimeter Flow)
                </button>
              </div>
            </div>

            {/* Video Player */}
            <div className="p4-video-box">
              <div className="p4-video-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
                  {activeCam.label}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--lime)', fontWeight: 800 }}>
                  {currentTimecode} IST
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
                <div style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  background: 'rgba(20, 32, 52, 0.85)',
                  padding: '4px 8px',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: 700,
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(216, 243, 68, 0.4)'
                }}>
                  CV STATUS: CORROBORATED
                </div>
              </div>

              <div className="p4-video-controls">
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="p4-outline-btn" style={{ padding: '3px 8px', color: '#fff', borderColor: '#334155' }} onClick={togglePlay}>
                    {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                  <button className="p4-outline-btn" style={{ padding: '3px 8px', color: '#fff', borderColor: '#334155' }} onClick={restartVideo}>
                    <RotateCcw size={12} />
                  </button>
                </div>
                <button className="p4-outline-btn" style={{ padding: '3px 8px', color: '#fff', borderColor: '#334155' }} onClick={toggleFullscreen}>
                  <Maximize size={12} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-secondary)' }}>
              <span>Zone: <b>{activeCam.zone}</b></span>
              <span style={{ color: '#047d53', fontWeight: 800 }}>● {activeCam.status} (1080p @ 30 FPS)</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: EDITORIAL INCIDENT DOSSIER & EVIDENCE RELIABILITY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Incident Telemetry Card */}
          <div className="p4-panel-box">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="p4-badge-tag">INCIDENT DOSSIER</span>
                <span className="p4-pill-badge red">HIGH SEVERITY</span>
              </div>
              <h2 style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-title)' }}>
                {selectedIncident.type}
              </h2>
              <span style={{ fontSize: 12, color: 'var(--ink-secondary)' }}>
                Location: <b style={{ color: 'var(--ink)' }}>{selectedIncident.location}</b> · 18:21 IST
              </span>
            </div>

            {/* Headline Key Metrics */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              padding: '12px 14px',
              background: 'var(--surface-soft)',
              borderRadius: 14,
              border: '1px solid var(--border)'
            }}>
              <div>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>Crowd Density</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{selectedIncident.density || 86} <small style={{ fontSize: 10, fontWeight: 600 }}>people</small></div>
              </div>
              <div>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>Verified Confidence</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--lime-deep)' }}>{Math.round((selectedIncident.confidence || 0.91) * 100)}%</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="p4-ink-btn"
                style={{ flex: 1.2, justifyContent: 'center' }}
                onClick={() => onNavigate('/verification')}
              >
                <span>VALIDATE IN MATRIX</span>
                <ArrowRight size={13} />
              </button>
              <button
                className="p4-outline-btn"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => onNavigate('/advisories')}
              >
                <span>ADVISORIES</span>
              </button>
            </div>
          </div>

          {/* Evidence Breakdown Card */}
          <div className="p4-panel-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="p4-box-title">Multi-Source Reliability</h3>
              <span style={{ fontSize: 10, color: 'var(--ink-muted)', fontWeight: 700 }}>CROSS-CHECK</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="p4-source-item">
                <div className="p4-source-left">
                  <span className="p4-source-circle" style={{ background: '#a7cc08' }} />
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>CCTV Camera 01</span>
                </div>
                <span style={{ color: '#116b4b', fontWeight: 800 }}>94%</span>
              </div>

              <div className="p4-source-item">
                <div className="p4-source-left">
                  <span className="p4-source-circle" style={{ background: '#ca8a04' }} />
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>CCTV Camera 02</span>
                </div>
                <span style={{ color: '#116b4b', fontWeight: 800 }}>90%</span>
              </div>

              <div className="p4-source-item">
                <div className="p4-source-left">
                  <span className="p4-source-circle" style={{ background: '#142034' }} />
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Ground Marshals</span>
                </div>
                <span style={{ color: '#116b4b', fontWeight: 800 }}>98%</span>
              </div>

              <div className="p4-source-item">
                <div className="p4-source-left">
                  <span className="p4-source-circle" style={{ background: '#d8f344' }} />
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Citizen Reports</span>
                </div>
                <span style={{ color: '#116b4b', fontWeight: 800 }}>78%</span>
              </div>

              <div className="p4-source-item">
                <div className="p4-source-left">
                  <span className="p4-source-circle" style={{ background: '#c3db29' }} />
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>News Wire N003</span>
                </div>
                <span style={{ color: '#116b4b', fontWeight: 800 }}>74%</span>
              </div>

              <div className="p4-source-item">
                <div className="p4-source-left">
                  <span className="p4-source-circle" style={{ background: '#eab308' }} />
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Social Media</span>
                </div>
                <span style={{ color: '#795100', fontWeight: 800 }}>45%</span>
              </div>
            </div>
          </div>

          {/* Progressive Disclosure: Collapsible Sensor Equalizer */}
          <div className="p4-panel-box" style={{ padding: '14px 18px' }}>
            <button
              onClick={() => setShowEqualizer(prev => !prev)}
              style={{
                background: 'none',
                border: 'none',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: 0,
                color: 'var(--ink)',
                fontWeight: 800,
                fontSize: 12
              }}
            >
              <span>{showEqualizer ? '− HIDE SENSOR EQUALIZER' : '+ SENSOR CONGRUENCE & EQUALIZER'}</span>
              <span className="p4-pill-badge yellow">94.2%</span>
            </button>

            {showEqualizer && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            )}
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
            Window: 18:00 — 18:30
          </span>
        </div>

        <div className="p4-scrub-track">
          <div className="p4-track-line" />

          {TIMELINE_EVENTS.map((evt) => {
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
