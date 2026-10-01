import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Video, ArrowRight, ArrowUpRight, Play, Pause, RotateCcw, Maximize,
  ThumbsUp, Newspaper, Tv, Clapperboard,
  Check, Clock, Camera, ShieldCheck, Users, Share2
} from 'lucide-react'
import { IncidentLifecycle } from '../components/IncidentLifecycle'
import { IncidentSelectorBar } from '../components/IncidentSelectorBar'
import { RadialEvidenceConvergence } from '../components/RadialEvidenceConvergence'
import { EvidenceDrawer } from '../components/EvidenceDrawer'
import { fetchIncidents } from '../services/api'
import { DEFAULT_INCIDENT, INCIDENTS_LIST, TIMELINE_EVENTS, CAMERAS_CONFIG } from '../services/mockData'
import { adminVideoFor } from '../utils/adminVideos'
import { getSourcesFor } from '../services/incidentSources'
import '../styles/evidence-airly.css'

const RELIABILITY = [
  { label: 'Ground Marshals', pct: 98, Icon: ShieldCheck },
  { label: 'CCTV Camera 01', pct: 94, Icon: Camera },
  { label: 'CCTV Camera 02', pct: 90, Icon: Camera },
  { label: 'Citizen Reports', pct: 78, Icon: Users },
  { label: 'News Wire N003', pct: 74, Icon: Newspaper },
  { label: 'Social Media', pct: 45, Icon: Share2 }
]
const tierOf = (p) => (p >= 90 ? { name: 'Verified', c: 'v' } : p >= 70 ? { name: 'Probable', c: 'p' } : { name: 'Unconfirmed', c: 'u' })
const OVERALL = Math.round(RELIABILITY.reduce((a, r) => a + r.pct, 0) / RELIABILITY.length)

// Flags hung below the timeline bar (edit freely; positioned by time)
const EXTRA_MARKERS = [
  { id: 'm1', time: '18:05', title: 'Marshal radio call', note: 'Ground team reports crowding at the gate', color: 'green' },
  { id: 'm2', time: '18:19', title: 'Citizen reports spike', note: 'Social posts surge, awaiting verification', color: 'red' }
]

const WINDOW_END = '18:30'
const toMin = (t) => {
  const [h, m] = String(t || '').split(':').map(Number)
  return h * 60 + (m || 0)
}

const KIND = {
  news: { label: 'News', Icon: Newspaper },
  tv: { label: 'TV report', Icon: Tv },
  reel: { label: 'Reel', Icon: Clapperboard }
}

function Contours() {
  return (
    <svg className="ev-contours" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => (
        <ellipse
          key={i}
          cx={210 + Math.sin(i) * 14}
          cy={150 + Math.cos(i * 1.3) * 10}
          rx={26 + i * 17}
          ry={16 + i * 11}
          transform={`rotate(${-18 + i * 2.5} 210 150)`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
    </svg>
  )
}

export function EvidenceReconstructionPage({ onNavigate }) {
  const [incidents, setIncidents] = useState(INCIDENTS_LIST)
  const [selectedIncident, setSelectedIncident] = useState(DEFAULT_INCIDENT)
  const [selectedNode, setSelectedNode] = useState(null)
  const [drawerItem, setDrawerItem] = useState(null)
  const [activeCamIndex, setActiveCamIndex] = useState(0)
  const [currentTimecode, setCurrentTimecode] = useState('18:08:32')
  const [activeTimelineId, setActiveTimelineId] = useState('evt-2')
  const [srcFilter, setSrcFilter] = useState('all')

  const [isPlaying, setIsPlaying] = useState(true)
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
  const videoSrc = adminVideoFor(selectedIncident)

  const sources = useMemo(() => getSourcesFor(selectedIncident), [selectedIncident])
  const shownSources = sources.filter((s) => srcFilter === 'all' || s.kind === srcFilter)

  const confidence = Math.round((selectedIncident.confidence || 0.91) * 100)
  const density = selectedIncident.density || 86
  const severity = (selectedIncident.severity || 'HIGH').toUpperCase()
  const incTime = selectedIncident.timestamp || '18:21'

  // Timeline derived values
  const n = TIMELINE_EVENTS.length
  const activeIdx = Math.max(0, TIMELINE_EVENTS.findIndex((e) => e.id === activeTimelineId))
  const progressPct = n > 1 ? (activeIdx / (n - 1)) * 100 : 0
  const minsLeft = Math.max(0, toMin(WINDOW_END) - toMin(currentTimecode.slice(0, 5)))

  const flagPos = (time) => {
    const f = toMin(time)
    const tm = TIMELINE_EVENTS.map((e) => toMin(e.time))
    if (Number.isNaN(f) || n < 2) return null
    let i = tm.findIndex((t, k) => t <= f && (k === n - 1 || f < tm[k + 1]))
    if (i < 0) i = f < tm[0] ? 0 : n - 1
    const span = i < n - 1 ? tm[i + 1] - tm[i] : 1
    const frac = Math.min(1, Math.max(0, (f - tm[i]) / (span || 1)))
    const pos = ((i + 0.5 + (i < n - 1 ? frac : 0)) / n) * 100
    return Math.min(((n - 0.5) / n) * 100, Math.max((0.5 / n) * 100, pos))
  }

  return (
    <div className="p4-workspace ev-page">
      {/* HEADER */}
      <div className="ev-head">
        <div>
          <span className="ev-kicker">SURAKSHA · EVIDENCE HUB</span>
          <h1 className="ev-title">
            Evidence <b>reconstruction</b>
          </h1>
          <p className="ev-sub">
            Reconstruct the sequence of events from synchronized video, reports, and verified sources.
          </p>
        </div>
        <button className="ev-btn ink" onClick={() => onNavigate('/propagation')}>
          <span>PROPAGATION NETWORK</span>
          <ArrowRight size={14} />
        </button>
      </div>

      <IncidentLifecycle currentStep="INVESTIGATING" incidentId={selectedIncident.id} />

      <IncidentSelectorBar
        incidents={incidents}
        selectedIncident={selectedIncident}
        onSelectIncident={setSelectedIncident}
        timeRange="18:00 — 18:30"
      />

      {/* HERO + STAT TILES */}
      <div className="ev-hero-grid">
        <section className="ev-hero">
          <div className="ev-blob">
            <Contours />
            <div className="ev-num">
              <b>{confidence}</b>
              <sup>% CONF</sup>
            </div>
          </div>
          <div className="ev-hero-text">
            <span className="ev-sev">{severity} SEVERITY</span>
            <ThumbsUp size={18} />
            <h2>{selectedIncident.type}</h2>
            <p>{selectedIncident.location} · {incTime} IST<br />Evidence corroborated across sources</p>
            <div className="ev-hero-actions">
              <button className="ev-btn ink" onClick={() => onNavigate('/verification')}>
                <span>VALIDATE IN MATRIX</span>
                <ArrowRight size={13} />
              </button>
              <button className="ev-btn light" onClick={() => onNavigate('/advisories')}>
                <span>ADVISORIES</span>
              </button>
            </div>
          </div>
        </section>

        <div className="ev-tile">
          <div className="ev-tile-top"><span>Crowd density</span><span className="ev-tile-arrow"><ArrowUpRight size={16} /></span></div>
          <div className="ev-tile-val">{density}<small>people</small></div>
          <span className="ev-dots" />
        </div>
        <div className="ev-tile">
          <div className="ev-tile-top"><span>Linked sources</span><span className="ev-tile-arrow"><ArrowUpRight size={16} /></span></div>
          <div className="ev-tile-val">{sources.length}<small>public</small></div>
          <span className="ev-dots" />
        </div>
        <div className="ev-tile">
          <div className="ev-tile-top"><span>Camera feeds</span><span className="ev-tile-arrow"><ArrowUpRight size={16} /></span></div>
          <div className="ev-tile-val">2<small>synced</small></div>
          <span className="ev-dots" />
        </div>
      </div>

      {/* VIDEO + RADAR */}
      <div className="ev-main-grid">
        <section className="ev-card slate">
          <div className="ev-card-head">
            <div>
              <h3 className="ev-card-title">Synchronized CCTV</h3>
              <div className="ev-card-sub">
                <span className="ev-live"><i /> {activeCam.label}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="ev-timecode">{currentTimecode} IST</span>
              <div className="ev-seg">
                <button className={activeCamIndex === 0 ? 'on' : ''} onClick={() => setActiveCamIndex(0)}>Cam 01</button>
                <button className={activeCamIndex === 1 ? 'on' : ''} onClick={() => setActiveCamIndex(1)}>Cam 02</button>
              </div>
            </div>
          </div>

          <div className="ev-video">
            <video
              key={videoSrc}
              ref={videoRef}
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={() => console.error('Video failed to load:', videoSrc)}
            />
            <span className="ev-cv">CV STATUS: CORROBORATED</span>
            <div className="ev-controls">
              <button className="main" onClick={togglePlay} aria-label="Play or pause">
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <button onClick={restartVideo} aria-label="Restart"><RotateCcw size={15} /></button>
              <button onClick={toggleFullscreen} aria-label="Fullscreen"><Maximize size={15} /></button>
            </div>
          </div>

          <div className="ev-video-foot">
            <span>Zone: {activeCam.zone}</span>
            <span>● {activeCam.status} (1080p @ 30 FPS)</span>
          </div>
        </section>

        <section className="ev-card">
          <div className="ev-card-head">
            <div>
              <h3 className="ev-card-title" style={{ color: 'var(--ink)' }}>Convergence radar</h3>
              <div className="ev-card-sub" style={{ color: 'var(--mute)' }}>
                Multi-source convergence on {selectedIncident.id}
              </div>
            </div>
            <span className="ev-timecode">ALL FEEDS SYNCED</span>
          </div>
          <div className="ev-radar">
            <RadialEvidenceConvergence
              density={density}
              confidence={confidence}
              incidentId={selectedIncident.id}
              selectedNode={selectedNode}
              onSelectNode={handleSelectNode}
            />
          </div>
        </section>
      </div>

      {/* SOURCES + RELIABILITY */}
      <div className="ev-bottom-grid">
        <section className="ev-card">
          <div className="ev-card-head">
            <div>
              <h3 className="ev-card-title" style={{ color: 'var(--ink)' }}>Sources</h3>
              <div className="ev-card-sub" style={{ color: 'var(--mute)' }}>
                News, TV and social coverage linked to this incident
              </div>
            </div>
            <div className="ev-seg">
              {[['all', 'All'], ['news', 'News'], ['tv', 'TV'], ['reel', 'Reels']].map(([k, l]) => (
                <button key={k} className={srcFilter === k ? 'on' : ''} onClick={() => setSrcFilter(k)}>{l}</button>
              ))}
            </div>
          </div>

          <div className="ev-src-grid">
            {shownSources.map((s) => {
              const meta = KIND[s.kind] || KIND.news
              const Icon = meta.Icon
              return (
                <a key={s.id} className={`ev-src ${s.kind}`} href={s.url} target="_blank" rel="noopener noreferrer">
                  <div className="ev-src-top">
                    <span className="ev-src-ico"><Icon size={16} /></span>
                    <span className="ev-src-kind">{meta.label}</span>
                  </div>
                  <p className="ev-src-title">{s.title}</p>
                  <div className="ev-src-meta">
                    <span><b>{s.outlet}</b>{s.meta ? ` · ${s.meta}` : ''}</span>
                    <span className="ev-src-go"><ArrowUpRight size={14} /></span>
                  </div>
                </a>
              )
            })}
          </div>
          <p className="ev-note">External links open in a new tab. Coverage is unverified until cross-checked in the Verification matrix.</p>
        </section>

        <section className="ev-card slate">
          <div className="ev-card-head">
            <div>
              <h3 className="ev-card-title">Source reliability</h3>
              <div className="ev-card-sub">Cross-check score per feed</div>
            </div>
          </div>

          <div className="ev-gauge">
            <svg viewBox="0 0 160 92" aria-hidden="true">
              <defs>
                <linearGradient id="evg" x1="0" x2="1">
                  <stop offset="0" stopColor="#f59a1f" />
                  <stop offset=".5" stopColor="#f3d612" />
                  <stop offset="1" stopColor="#e4ff3b" />
                </linearGradient>
              </defs>
              <path d="M 12 84 A 68 68 0 0 1 148 84" pathLength="100" className="g-track" />
              <path d="M 12 84 A 68 68 0 0 1 148 84" pathLength="100" className="g-fill"
                strokeDasharray="100" strokeDashoffset={100 - OVERALL} />
            </svg>
            <div className="ev-gauge-num"><b>{OVERALL}</b><span>% weighted trust</span></div>
          </div>

          <ul className="ev-rel">
            {[...RELIABILITY].sort((a, b) => b.pct - a.pct).map((r) => {
              const t = tierOf(r.pct)
              const Icon = r.Icon
              return (
                <li key={r.label} className="ev-rel-row">
                  <span className="ev-rel-ico"><Icon size={14} /></span>
                  <div className="ev-rel-main">
                    <div className="ev-rel-top">
                      <span className="ev-rel-name">{r.label}</span>
                      <span className={`ev-rel-tier ${t.c}`}>{t.name}</span>
                    </div>
                    <div className="ev-rel-track">
                      <i className={`ev-rel-fill ${t.c}`} style={{ width: `${r.pct}%` }} />
                      <s style={{ left: '70%' }} /><s style={{ left: '90%' }} />
                    </div>
                  </div>
                  <b className="ev-rel-pct">{r.pct}%</b>
                </li>
              )
            })}
          </ul>
          <p className="ev-rel-legend">Ticks mark the 70% (probable) and 90% (verified) thresholds.</p>
        </section>
      </div>

      {/* EVENT TIMELINE (stepper) */}
      <section className="ev-card ev-tl-card">
        <div className="ev-card-head">
          <div>
            <h3 className="ev-card-title" style={{ color: 'var(--ink)' }}>Event timeline for {selectedIncident.id}</h3>
            <div className="ev-card-sub" style={{ color: 'var(--mute)' }}>Click a stage to inspect its evidence · Window 18:00 — 18:30</div>
          </div>
          <span className="ev-timecode">{currentTimecode} IST</span>
        </div>

        <div className="ev-tl-scroll">
          <div className="ev-tl" style={{ '--n': n }}>
            <div className="ev-tl-times">
              {TIMELINE_EVENTS.map((evt, i) => (
                <span key={evt.id} className={i <= activeIdx ? 'done' : ''}>{evt.time}</span>
              ))}
            </div>

            <div className="ev-tl-nodes">
              <div className="ev-tl-track"><i style={{ width: `${progressPct}%` }} /></div>
              {TIMELINE_EVENTS.map((evt, i) => {
                const state = i < activeIdx ? 'done' : i === activeIdx ? 'now' : 'todo'
                return (
                  <button
                    key={evt.id}
                    className={`ev-tl-dot ${state}`}
                    onClick={() => handleTimelineClick(evt)}
                    title={`${evt.time} - ${evt.event}`}
                  >
                    {i === n - 1 && state === 'todo' ? <em>{Math.round(progressPct)}%</em> : <Check size={16} />}
                  </button>
                )
              })}
            </div>

            <div className="ev-tl-labels">
              {TIMELINE_EVENTS.map((evt) => (
                <div key={evt.id}>
                  <b>{evt.event}</b>
                  <small>{evt.description || evt.detail || evt.source || ''}</small>
                </div>
              ))}
            </div>

            <div className="ev-tl-flags">
              {EXTRA_MARKERS.map((m) => {
                const pos = flagPos(m.time)
                if (pos == null) return null
                return (
                  <div key={m.id} className={`ev-flag ${m.color}`} style={{ left: `${pos}%` }}>
                    <span className="ev-flag-line" />
                    <span className="ev-flag-pin" />
                    <div className="ev-flag-text"><b>{m.time}</b><strong>{m.title}</strong><small>{m.note}</small></div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="ev-tl-foot">
          <Clock size={18} />
          <b>Left: {minsLeft} min</b>
          <span>in observation window</span>
        </div>
      </section>

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