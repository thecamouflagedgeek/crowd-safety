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
import { fetchIncidents, uploadEvidence, fetchEvidenceItem, mediaUrl } from '../services/api'
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
  const [evidenceFile, setEvidenceFile] = useState(null)
  const [evidenceRecord, setEvidenceRecord] = useState(null)
  const [evidenceRecords, setEvidenceRecords] = useState([])
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [evidenceTime, setEvidenceTime] = useState(0)
  const evidenceVideoRef = useRef(null)
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

  // Upload state is session-only: after a browser refresh the original dashboard returns.
  useEffect(() => {
    setEvidenceRecord(null)
    setEvidenceRecords([])
    setEvidenceFile(null)
    setUploadError('')
    setEvidenceTime(0)
  }, [selectedIncident.id])

  useEffect(() => {
    if (!evidenceRecord?.evidence_id || !['UPLOADED', 'ANALYZING'].includes(evidenceRecord.status)) return undefined
    let active = true
    const poll = async () => {
      try {
        const current = await fetchEvidenceItem(evidenceRecord.evidence_id)
        if (active) {
          setEvidenceRecord(current)
          setEvidenceRecords((records) => records.map((item) => item.evidence_id === current.evidence_id ? current : item))
        }
      } catch (error) { if (active) setUploadError(error.message) }
    }
    const timer = window.setInterval(poll, 1500)
    poll()
    return () => { active = false; window.clearInterval(timer) }
  }, [evidenceRecord?.evidence_id, evidenceRecord?.status])

  const handleEvidenceUpload = async (event) => {
    event.preventDefault()
    if (!evidenceFile) return
    setUploadError('')
    setIsUploading(true)
    setUploadPercent(0)
    try {
      const record = await uploadEvidence(selectedIncident.id, evidenceFile, { source: 'Authority Upload' }, setUploadPercent)
      setEvidenceRecord(record)
      setEvidenceRecords((records) => [record, ...records])
      setEvidenceTime(0)
    } catch (error) { setUploadError(error.message) }
    finally { setIsUploading(false) }
  }

  const seekEvidence = (seconds) => {
    if (!evidenceVideoRef.current) return
    evidenceVideoRef.current.currentTime = Math.max(0, seconds || 0)
    setEvidenceTime(Math.max(0, seconds || 0))
    evidenceVideoRef.current.play().catch(() => {})
  }

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
          <span className="ev-kicker">Vigil · EVIDENCE HUB</span>
          <h1 className="ev-title">
            <span className="ev-chip">Real-time</span>
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

      {!evidenceRecord && <IncidentLifecycle currentStep="INVESTIGATING" incidentId={selectedIncident.id} />}

      <IncidentSelectorBar
        incidents={incidents}
        selectedIncident={selectedIncident}
        onSelectIncident={setSelectedIncident}
        timeRange="18:00 — 18:30"
      />

      <EvidenceIngestion
        incident={selectedIncident}
        file={evidenceFile}
        onFile={setEvidenceFile}
        onSubmit={handleEvidenceUpload}
        isUploading={isUploading}
        uploadPercent={uploadPercent}
        error={uploadError}
        record={evidenceRecord}
        records={evidenceRecords}
        onSelectEvidence={(item) => { setEvidenceRecord(item); setEvidenceTime(0) }}
        videoRef={evidenceVideoRef}
        currentTime={evidenceTime}
        onTime={setEvidenceTime}
        onSeek={seekEvidence}
      />

      {!evidenceRecord && <>
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
      </>}
    </div>
  )
}
function EvidenceIngestion({ incident, file, onFile, onSubmit, isUploading, uploadPercent, error, record, records, onSelectEvidence, videoRef, currentTime, onTime, onSeek }) {
  const analysis = record?.analysis
  const samples = analysis?.samples || []
  const nearest = samples.reduce((best, sample) => !best || Math.abs(sample.time_seconds - currentTime) < Math.abs(best.time_seconds - currentTime) ? sample : best, null)
  const chartX = (index) => samples.length < 2 ? 500 : 24 + (index / (samples.length - 1)) * 952
  const motionPoints = samples.map((sample, index) => `${chartX(index)},${182 - Math.min(1, sample.motion_energy || 0) * 150}`).join(' ')
  const densityPoints = samples.map((sample, index) => `${chartX(index)},${182 - Math.min(1, sample.density || 0) * 150}`).join(' ')
  const stage = isUploading ? `Uploading… ${uploadPercent}%` : record?.stage || (record?.status === 'ANALYZED' ? 'ANALYZED ✓' : record?.status || 'Ready')
  const sourceWidth = Math.min(analysis?.width || 640, 480)
  const sourceHeight = analysis?.width ? sourceWidth * analysis.height / analysis.width : 270
  return (
    <section className="ev-card ev-ingestion">
      <div className="ev-card-head">
        <div><h3 className="ev-card-title" style={{ color: 'var(--ink)' }}>INGEST NEW EVIDENCE</h3>
          <div className="ev-card-sub" style={{ color: 'var(--mute)' }}>Add a video to {incident.id} and analyze it with the existing CCTV detector.</div></div>
        <div className="ev-ingest-head-actions">{records.length > 1 && <select value={record?.evidence_id || ''} onChange={(event) => onSelectEvidence(records.find((item) => item.evidence_id === event.target.value))}>{records.map((item) => <option key={item.evidence_id} value={item.evidence_id}>{item.evidence_id} · {item.filename}</option>)}</select>}
          <span className={`ev-ingest-status ${record?.status === 'FAILED' ? 'failed' : ''}`}>{stage}</span></div>
      </div>
      <form className="ev-upload-row" onSubmit={onSubmit}>
        <label className="ev-file-pick"><Video size={19} /><span>{file?.name || 'Choose an MP4, MOV, or WebM video'}</span>
          <input type="file" accept="video/mp4,video/quicktime,video/webm,video/*" onChange={(event) => onFile(event.target.files?.[0] || null)} /></label>
        <button className="ev-btn ink" type="submit" disabled={!file || isUploading}>{isUploading ? 'UPLOADING…' : 'ANALYZE EVIDENCE'}</button>
      </form>
      {isUploading && <div className="ev-upload-progress"><i style={{ width: `${uploadPercent}%` }} /></div>}
      {error && <p className="ev-upload-error">{error}</p>}
      {record && <>
        {record.status === 'FAILED' && <p className="ev-upload-error">Could not analyze evidence. {record.error || 'Original file is preserved.'}</p>}
        {record.status !== 'FAILED' && <div className="ev-ingest-stages"><span className={record.status ? 'done' : ''}>Uploaded</span><span className={record.sha256 ? 'done' : ''}>Hashing</span><span className={record.status === 'ANALYZING' || record.status === 'ANALYZED' ? 'done' : ''}>Analyzing frames</span><span className={record.status === 'ANALYZED' ? 'done' : ''}>Signals + timeline</span></div>}
        <div className="ev-evidence-meta"><b>Evidence {record.evidence_id}</b><span>{record.source || 'Authority Upload'}</span><span>{record.filename}</span>
          <span>Uploaded {new Date(record.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {record.duration_seconds != null && <span>{record.duration_seconds.toFixed(1)} sec</span>}
          {record.camera_name && <span>Camera: {record.camera_name}</span>}
          {record.location && <span>Location: {record.location}</span>}
          <span className="ev-hash">File integrity fingerprint · SHA-256: {record.sha256}</span>
          {record.analysis && <span>CV: {record.analysis.backend}{record.analysis.model ? ` · ${record.analysis.model}` : ''}</span>}
          {record.analysis?.incident_reassessment && <span>Incident re-evaluated · risk {Math.round(record.analysis.incident_reassessment.risk_score * 100)}% · {record.analysis.incident_reassessment.severity}</span>}
        </div>
        {record.status === 'ANALYZED' && analysis && <>
          <div className="ev-reconstruction-grid">
            <div>
              <h4>ORIGINAL VIDEO · {record.filename}</h4>
              <div className="ev-ingest-video-wrap">
                <video ref={videoRef} src={mediaUrl(record.video_url)} controls playsInline preload="metadata"
                  onTimeUpdate={(event) => onTime(event.currentTarget.currentTime)} onClick={() => {}} />
                {nearest?.detections?.length > 0 && <div className="ev-detection-overlay" aria-label="Detector person boxes">
                  {nearest.detections.map((box, index) => <div key={index} className="ev-detection-box" style={{ left: `${box[0] / sourceWidth * 100}%`, top: `${box[1] / sourceHeight * 100}%`, width: `${(box[2] - box[0]) / sourceWidth * 100}%`, height: `${(box[3] - box[1]) / sourceHeight * 100}%` }}><small>PERSON</small></div>)}
                </div>}
              </div>
              <p className="ev-box-note">{nearest?.detections?.length ? `${nearest.detections.length} detector person box(es) at ${Math.floor(currentTime)} sec` : 'No person boxes in the nearest sampled frame. Counts and occupancy use detector signals.'}</p>
            </div>
            <div className="ev-signal-metrics"><h4>MEASURED CV SIGNALS</h4>
              <div><span>Persons observed</span><b>{nearest?.person_count ?? analysis.metrics.person_count}</b></div>
              <div><span>Density</span><b>{Math.round((nearest?.density ?? analysis.metrics.density) * 100)}%</b></div>
              <div><span>Motion energy</span><b>{(nearest?.motion_energy ?? analysis.metrics.motion).toFixed(3)}</b></div>
              <div><span>Persistence</span><b>{Math.round((nearest?.persistence ?? analysis.metrics.persistence) * 100)}%</b></div>
              <div><span>Detector confidence</span><b>{nearest?.confidence ? `${Math.round(nearest.confidence * 100)}%` : '—'}</b></div>
              <small>Signal sample near {Math.floor(currentTime)} sec · measurements are clip-derived.</small>
            </div>
          </div>
          <div className="ev-signal-chart"><div className="ev-signal-chart-head"><h4>MOTION / DENSITY OVER TIME</h4><span>Motion · Density · Click a sample to seek</span></div>
            <div className="ev-chart-area"><svg viewBox="0 0 1000 210" preserveAspectRatio="none" role="img" aria-label="Motion and density signal samples">
              <line x1="24" y1="182" x2="976" y2="182" stroke="#aab5bf" strokeWidth="1" />
              {motionPoints && <polyline points={motionPoints} fill="none" stroke="#e45747" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />}
              {densityPoints && <polyline points={densityPoints} fill="none" stroke="#278d70" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />}
              <line x1={24 + Math.min(1, currentTime / Math.max(analysis.duration_seconds, 1)) * 952} x2={24 + Math.min(1, currentTime / Math.max(analysis.duration_seconds, 1)) * 952} y1="12" y2="182" stroke="#111820" strokeWidth="1.5" opacity=".65" />
              {samples.map((sample, index) => { const x = chartX(index); const y = 182 - Math.min(1, sample.motion_energy || 0) * 150; return <circle key={index} cx={x} cy={y} r={Math.abs(sample.time_seconds-currentTime)<0.5 ? 7 : 3.5} fill="#e45747" onClick={() => onSeek(sample.time_seconds)} style={{ cursor: 'pointer' }}><title>{sample.time_seconds}s · motion {sample.motion_energy} · density {sample.density}</title></circle> })}
              {analysis.events.map((event) => <line key={event.id} x1={24 + event.timestamp_seconds / Math.max(analysis.duration_seconds, 1) * 952} x2={24 + event.timestamp_seconds / Math.max(analysis.duration_seconds, 1) * 952} y1="25" y2="182" stroke="#d94452" strokeDasharray="4 4" onClick={() => onSeek(event.timestamp_seconds)} style={{ cursor: 'pointer' }} />)}
            </svg></div>
            <div className="ev-signal-heatmap" aria-label="Motion signal intensity by sampled time">{samples.map((sample, index) => <i key={index} title={`${sample.time_seconds}s · motion ${sample.motion_energy}`} style={{ opacity: 0.18 + Math.min(0.82, sample.motion_energy * 4) }} />)}</div>
          </div>
          <div className="ev-upload-events"><h4>INCIDENT TIMELINE · {incident.id}</h4>
            {analysis.timeline?.length ? analysis.timeline.map((event, index) => <button key={event.id || index} onClick={() => event.timestamp_seconds != null && onSeek(event.timestamp_seconds)} disabled={event.timestamp_seconds == null}><b>{event.timestamp_label || event.time || event.timestamp}</b><span>{event.event || event.description}</span><small>{event.source || 'Incident record'}{event.evidence_id ? ` · ${event.evidence_id} · Click to seek video` : ''}</small></button>) : <p>No sustained motion or density elevation was found relative to this clip’s initial baseline.</p>}
          </div>
        </>}
      </>}
    </section>
  )
}
