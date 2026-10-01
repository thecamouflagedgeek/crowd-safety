import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  CheckCircle2,
  XCircle,
  Check,
  X,
  ArrowRight,
  Video,
  Newspaper,
  Radio,
  Users,
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react'
import { SEEDED_CLAIMS } from '../services/mockData'
import { validateClaimAction, verifyClaimRequest, fetchIncidentDetail, normalizeClaim } from '../services/api'

const API_BASE = (import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

// Only these three videos are ever shown on the Verification page.
const VIDEO_CROWD = `${API_BASE}/videos/admin_crowd.mp4`       // Heavy crowd congestion
const VIDEO_BLOCKED = `${API_BASE}/videos/admin_blocked.mp4`   // Gate 3 is blocked
const VIDEO_STAMPEDE = `${API_BASE}/videos/admin_stampede.mp4` // Stampede
const CLAIM_VIDEOS_BY_ORDER = [VIDEO_CROWD, VIDEO_BLOCKED, VIDEO_STAMPEDE]

// Picks the video from the claim text first, then falls back to claim order (1, 2, 3).
const getClaimVideo = (claim, index) => {
  const text = (claim?.claim || '').toLowerCase()
  if (text.includes('stampede')) return VIDEO_STAMPEDE
  if (text.includes('block')) return VIDEO_BLOCKED
  if (text.includes('crowd') || text.includes('congest')) return VIDEO_CROWD
  return CLAIM_VIDEOS_BY_ORDER[index] || null
}

export function VerificationMatrix({
  claims = SEEDED_CLAIMS,
  incidentId = 'INC001',
  onNavigateAdvisory,
  onStatusChange
}) {
  const [localClaims, setLocalClaims] = useState(claims)
  const [activeClaimId, setActiveClaimId] = useState('CLM001')
  const [activeMediaTab, setActiveMediaTab] = useState('cctv') // 'cctv' | 'news' | 'radio' | 'citizen'
  const [actionFeedback, setActionFeedback] = useState(null)

  // Result of the backend verification engine for the claim currently inspected.
  const [verification, setVerification] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [claimsState, setClaimsState] = useState('demo')

  // Video player controls
  const [isPlaying, setIsPlaying] = useState(true)
  const videoRef = useRef(null)

  // Load the real claim records the backend tracks for this incident.
  useEffect(() => {
    let live = true
    fetchIncidentDetail(incidentId).then((res) => {
      if (!live) return
      const apiClaims = (res.data?.claims || []).map(normalizeClaim).filter(Boolean)
      if (apiClaims.length) {
        setLocalClaims(apiClaims)
        setActiveClaimId(apiClaims[0].id)
        setClaimsState('api')
      } else {
        setClaimsState('demo')
      }
    })
    return () => { live = false }
  }, [incidentId])

  const currentClaim = localClaims.find((c) => c.id === activeClaimId) || localClaims[0]
  const media = currentClaim.mediaEvidence || {}
  const currentClaimIndex = Math.max(0, localClaims.findIndex((c) => c.id === currentClaim.id))
  const videoSrc = getClaimVideo(currentClaim, currentClaimIndex)

  // Live/public-safety news retrieved by the backend for this claim, or the
  // seeded press wire when nothing was retrieved.
  const newsItems = useMemo(() => {
    const live = verification?.corroborating_news
    if (live && live.length) {
      return live.map((n) => ({
        outlet: n.label || n.provider || 'News wire',
        status: n.status,
        badge: `${n.status || 'REPORTED'}${n.locality_match ? ' · LOCAL' : ''}`,
        time: n.timestamp || '',
        headline: n.title || ''
      }))
    }
    return media.news || []
  }, [verification, media])

  // Ask the backend verification engine (CCTV + official + SerpApi + NewsAPI + citizen).
  const handleRunVerification = async () => {
    if (!currentClaim) return
    setIsVerifying(true)
    setVerification(null)
    const res = await verifyClaimRequest({
      claim: currentClaim.claim,
      location: currentClaim.location || undefined,
      incident_id: currentClaim.incident_id || incidentId
    })
    setVerification(res.data)
    setIsVerifying(false)

    // The engine is the source of truth: reflect its verdict on the claim record,
    // but leave the authority's manual validate/reject decision untouched.
    setLocalClaims((prev) =>
      prev.map((c) =>
        c.id === currentClaim.id
          ? { ...c, engine_status: res.data.status, engine_confidence: res.data.confidence, engine_is_mock: res.isMock }
          : c
      )
    )
  }

  const handleValidate = async (claim) => {
    setActionFeedback({ type: 'loading', message: `Submitting authority validation for ${claim.id}...` })

    await validateClaimAction({
      incident_id: claim.incident_id || 'INC001',
      claim_id: claim.id,
      status: 'VERIFIED',
      note: 'Validated by Safety Authority Command console: multi-source media consensus confirms claim.'
    })

    setLocalClaims((prev) =>
      prev.map((c) => (c.id === claim.id ? { ...c, status: 'VERIFIED', confidence: 0.95 } : c))
    )

    setActionFeedback({
      type: 'success',
      message: `✓ CLAIM VALIDATED: Marked as verified ground truth. Ready for Advisory broadcast.`,
      claim: { ...claim, status: 'VERIFIED' }
    })

    if (onStatusChange) onStatusChange('VERIFIED')
  }

  const handleReject = async (claim) => {
    setActionFeedback({ type: 'loading', message: `Submitting authority rejection for ${claim.id}...` })

    await validateClaimAction({
      incident_id: claim.incident_id || 'INC001',
      claim_id: claim.id,
      status: 'REJECTED',
      note: 'Rejected by Authority: Contradicted by optical flow, live CCTV, and marshal dispatch.'
    })

    setLocalClaims((prev) =>
      prev.map((c) => (c.id === claim.id ? { ...c, status: 'REJECTED', confidence: 0.05 } : c))
    )

    setActionFeedback({
      type: 'reject',
      message: `✕ CLAIM REJECTED: Flagged as misinformation/rumor. Advisory broadcast blocked for this claim.`,
      claim: { ...claim, status: 'REJECTED' }
    })

    if (onStatusChange) onStatusChange('REJECTED')
  }

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  const restartVideo = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = 0
    videoRef.current.play()
    setIsPlaying(true)
  }

  const renderAgreeBadge = (val) => {
    if (val === true) {
      return (
        <span className="p4-agree-badge yes" title="Supported by this source">
          <Check size={14} />
        </span>
      )
    }
    if (val === false) {
      return (
        <span className="p4-agree-badge no" title="Contradicted or unsupported">
          <X size={14} />
        </span>
      )
    }
    return (
      <span className="p4-agree-badge partial" title="Ambiguous / partial mention">
        ~
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Claim Selector Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--surface)',
        padding: '12px 18px',
        borderRadius: 'var(--panel-radius)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-muted)', letterSpacing: '0.08em' }}>
          SELECT CLAIM TO AUDIT:
        </span>
        {localClaims.map((c) => {
          const isSelected = c.id === currentClaim.id
          const isVerified = c.status === 'VERIFIED'
          const isRejected = c.status === 'REJECTED'

          return (
            <button
              key={c.id}
              className={isSelected ? 'p4-ink-btn' : 'p4-outline-btn'}
              style={{ padding: '6px 14px', fontSize: 11 }}
              onClick={() => {
                setActiveClaimId(c.id)
                setActionFeedback(null)
                setIsPlaying(true)
              }}
            >
              <span style={{
                color: isVerified ? '#aee6ca' : isRejected ? '#fca5a5' : 'var(--lime)',
                fontWeight: 800,
                marginRight: 4
              }}>
                {isVerified ? '✓' : isRejected ? '✕' : '?'}
              </span>
              <span>{c.id}: "{c.claim.slice(0, 36)}…"</span>
            </button>
          )
        })}
      </div>

      {/* Main Verification Grid: Two Columns (Left: Claim & Source Matrix, Right: All Sources Media Dossier) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1.25fr)', gap: 16, alignItems: 'start' }}>

        {/* Left Column: Claim Statement & Evidence Agreement Matrix */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="p4-matrix-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="p4-badge-tag">CLAIM UNDER INSPECTION</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className={`p4-pill-badge ${currentClaim.status === 'VERIFIED' ? 'green' : currentClaim.status === 'REJECTED' ? 'red' : 'amber'}`}>
                  ● STATUS: {currentClaim.status}
                </span>
                <span className="p4-pill-badge yellow">
                  {Math.round(currentClaim.confidence * 100)}% CONFIDENCE
                </span>
              </div>
            </div>

            <blockquote className="p4-quote-line">
              "{currentClaim.claim}"
            </blockquote>

            <div style={{ fontSize: 11, color: 'var(--ink-secondary)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span>Target Location: <b style={{ color: 'var(--ink)' }}>{currentClaim.location}</b></span>
              <span>Logged: <b style={{ color: 'var(--ink)' }}>{currentClaim.timestamp} IST</b></span>
              <span>Source: <b style={{ color: 'var(--ink)' }}>{currentClaim.submitted_by}</b></span>
            </div>

            {/* Evidence Matrix Table */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--ink)', letterSpacing: '0.04em' }}>
                  EVIDENCE SOURCE AGREEMENT MATRIX
                </h4>
                <span style={{ fontSize: 10, color: 'var(--ink-muted)' }}>Cross-referenced against 5 live feeds</span>
              </div>

              <table className="p4-clean-table">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>SOURCE STREAM</th>
                    <th style={{ width: 60, textAlign: 'center' }}>MATCH</th>
                    <th>FORENSIC CROSS-CHECK DETAIL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>CCTV Optical Flow</b></td>
                    <td style={{ textAlign: 'center' }}>{renderAgreeBadge(currentClaim.evidenceMatrix?.cctv?.verified)}</td>
                    <td>{currentClaim.evidenceMatrix?.cctv?.label || 'Computer vision status'}</td>
                  </tr>
                  <tr>
                    <td><b>Citizen Reports</b></td>
                    <td style={{ textAlign: 'center' }}>{renderAgreeBadge(currentClaim.evidenceMatrix?.citizen?.verified)}</td>
                    <td>{currentClaim.evidenceMatrix?.citizen?.label || 'Citizen field reports'}</td>
                  </tr>
                  <tr>
                    <td><b>Ground Marshals</b></td>
                    <td style={{ textAlign: 'center' }}>{renderAgreeBadge(currentClaim.evidenceMatrix?.official?.verified)}</td>
                    <td>{currentClaim.evidenceMatrix?.official?.label || 'Event authority radio logs'}</td>
                  </tr>
                  <tr>
                    <td><b>News Outlets</b></td>
                    <td style={{ textAlign: 'center' }}>{renderAgreeBadge(currentClaim.evidenceMatrix?.news?.verified)}</td>
                    <td>{currentClaim.evidenceMatrix?.news?.label || 'Public broadcast wires'}</td>
                  </tr>
                  <tr>
                    <td><b>Social Chatter</b></td>
                    <td style={{ textAlign: 'center' }}>{renderAgreeBadge(currentClaim.evidenceMatrix?.social?.verified)}</td>
                    <td>{currentClaim.evidenceMatrix?.social?.label || 'Social media keyword stream'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Backend verification engine result (source of truth) */}
            <button
              className="p4-outline-btn"
              style={{ justifyContent: 'center', padding: '11px', width: '100%' }}
              onClick={handleRunVerification}
              disabled={isVerifying}
            >
              <ShieldCheck size={15} />
              <span>{isVerifying ? 'RUNNING MULTI-SOURCE VERIFICATION…' : 'RUN BACKEND VERIFICATION (CCTV + OFFICIAL + NEWS + SERP)'}</span>
            </button>

            {verification && (
              <div style={{
                background: 'var(--surface-soft)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-muted)', letterSpacing: '0.06em' }}>
                    BACKEND VERIFICATION ENGINE
                  </span>
                  <span className={`p4-pill-badge ${verification.status === 'VERIFIED' ? 'green' : verification.status === 'CONTRADICTED' ? 'red' : 'amber'}`}>
                    {verification.status}
                  </span>
                  <span className="p4-pill-badge yellow">{Math.round((verification.confidence || 0) * 100)}% CONFIDENCE</span>
                  <span className="p4-pill-badge lime">{verification.severity || 'UNKNOWN'} SEVERITY</span>
                  {verification.isMock && <span className="p4-pill-badge red">DEMO SIMULATION — API UNREACHABLE</span>}
                </div>

                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink)', lineHeight: 1.45 }}>
                  <b>Impact: </b>{verification.impact || '—'}
                </p>

                <div style={{ fontSize: 11, color: 'var(--ink-secondary)' }}>
                  <b style={{ color: 'var(--ink)' }}>Supporting sources: </b>
                  {(verification.supporting_sources || []).length
                    ? verification.supporting_sources.join(' · ')
                    : 'none — nothing corroborates this claim'}
                </div>

                <div style={{ fontSize: 10.5, color: 'var(--ink-muted)' }}>
                  Live corroboration checked with SerpApi: {verification.news_providers?.serpapi ? 'configured' : 'unavailable'} · NewsAPI:{' '}
                  {verification.news_providers?.newsapi ? 'configured' : 'unavailable'} · Retrieved items are REPORTED only and can never verify a claim by themselves.
                </div>
              </div>
            )}

            {/* Action Feedback Banner */}
            {actionFeedback && (
              <div style={{
                background: actionFeedback.type === 'success' ? '#eff6ce' : actionFeedback.type === 'reject' ? '#ffd7da' : 'var(--surface-soft)',
                border: `1px solid ${actionFeedback.type === 'success' ? '#c3db29' : actionFeedback.type === 'reject' ? '#fecaca' : 'var(--border)'}`,
                borderRadius: 14,
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 800,
                  fontSize: 12,
                  color: actionFeedback.type === 'success' ? 'var(--lime-deep)' : actionFeedback.type === 'reject' ? '#99212e' : 'var(--ink)'
                }}>
                  {actionFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <span>AUTHORITY AUDIT ACTION RECORDED</span>
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink)', lineHeight: 1.45 }}>
                  {actionFeedback.message}
                </p>

                {actionFeedback.type === 'success' && onNavigateAdvisory && (
                  <button
                    className="p4-ink-btn"
                    style={{ alignSelf: 'flex-start', marginTop: 4, padding: '6px 12px', fontSize: 11 }}
                    onClick={() => onNavigateAdvisory(actionFeedback.claim)}
                  >
                    <span>PROCEED TO PUBLISH ADVISORY</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            )}

            {/* Authority Decision Action Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="p4-ink-btn"
                style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                onClick={() => handleValidate(currentClaim)}
                disabled={currentClaim.status === 'VERIFIED'}
              >
                <CheckCircle2 size={16} />
                <span>{currentClaim.status === 'VERIFIED' ? 'CLAIM ALREADY VALIDATED' : 'VALIDATE CLAIM (GROUND TRUTH)'}</span>
              </button>
              <button
                className="p4-outline-btn"
                style={{ flex: 1, justifyContent: 'center', padding: '12px', borderColor: '#fca5a5', color: '#99212e' }}
                onClick={() => handleReject(currentClaim)}
                disabled={currentClaim.status === 'REJECTED'}
              >
                <XCircle size={16} />
                <span>{currentClaim.status === 'REJECTED' ? 'CLAIM ALREADY REJECTED' : 'REJECT (MARK AS RUMOR)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: ALL SOURCES OF MEDIA PRESENTED TO ADMIN */}
        <div className="p4-media-dossier">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span className="p4-badge-tag">EXECUTIVE MEDIA DOSSIER</span>
              <h3 className="p4-box-title" style={{ marginTop: 4 }}>
                Multi-Source Evidence Inspection
              </h3>
            </div>
            <span style={{ fontSize: 10, color: 'var(--ink-muted)', fontWeight: 700 }}>
              SYNCED TO CLAIM: {currentClaim.id}
            </span>
          </div>

          {/* Media Navigation Tabs */}
          <div className="p4-media-tabs">
            <button
              className={`p4-media-tab-btn ${activeMediaTab === 'cctv' ? 'active' : ''}`}
              onClick={() => setActiveMediaTab('cctv')}
            >
              <Video size={13} />
              <span>Live CCTV Stream</span>
            </button>
            <button
              className={`p4-media-tab-btn ${activeMediaTab === 'news' ? 'active' : ''}`}
              onClick={() => setActiveMediaTab('news')}
            >
              <Newspaper size={13} />
              <span>News Wire & Press</span>
            </button>
            <button
              className={`p4-media-tab-btn ${activeMediaTab === 'radio' ? 'active' : ''}`}
              onClick={() => setActiveMediaTab('radio')}
            >
              <Radio size={13} />
              <span>Marshal Radio Comms</span>
            </button>
            <button
              className={`p4-media-tab-btn ${activeMediaTab === 'citizen' ? 'active' : ''}`}
              onClick={() => setActiveMediaTab('citizen')}
            >
              <Users size={13} />
              <span>Citizen & Social Reports</span>
            </button>
          </div>

          {/* TAB 1: Live CCTV Video Feed */}
          {activeMediaTab === 'cctv' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="p4-video-box">
                <div className="p4-video-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ fontWeight: 800 }}>{media.cctv?.camName || 'CCTV 01 · Gate 3 Concourse'}</span>
                  </div>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--lime)' }}>
                    18:18:24 IST · 1080p
                  </span>
                </div>

                <div className="p4-video-player-wrap">
                  {videoSrc ? (
                    <video
                      key={videoSrc}
                      ref={videoRef}
                      src={videoSrc}
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 12 }}>
                      No CCTV footage linked to this claim
                    </div>
                  )}
                  {/* Real-time CV Forensic Overlay Banner */}
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
                    CV STATUS: {media.cctv?.status || 'CORROBORATED'}
                  </div>
                </div>

                <div className="p4-video-controls">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={togglePlay}
                      style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
                    >
                      {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={restartVideo}
                      style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: 10 }}>
                    Optical Flow Check: 0 falls, normal upright motion
                  </span>
                </div>

                {/* Resolved backend video URL */}
                <div style={{
                  background: '#18253a',
                  padding: '0 14px 10px',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: '#94a3b8',
                  wordBreak: 'break-all'
                }}>
                  {videoSrc ? (
                    <a href={videoSrc} target="_blank" rel="noreferrer" style={{ color: 'var(--lime)' }}>
                      {videoSrc}
                    </a>
                  ) : (
                    <span>No video URL</span>
                  )}
                </div>
              </div>

              <div style={{
                background: 'var(--surface-soft)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '12px',
                fontSize: 11.5,
                lineHeight: 1.45,
                color: 'var(--ink)'
              }}>
                <b style={{ color: 'var(--ink)' }}>Forensic CV Verification: </b>
                {media.cctv?.finding || 'Multi-camera triangulation confirms occupant density.'}
              </div>
            </div>
          )}

          {/* TAB 2: News Outlets & Press Wire */}
          {activeMediaTab === 'news' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {newsItems.map((n, i) => (
                <div key={i} className="p4-dispatch-card">
                  <div className="p4-dispatch-header">
                    <div className="p4-dispatch-title">
                      <Newspaper size={14} style={{ color: 'var(--ink)' }} />
                      <span>{n.outlet}</span>
                      <span className={`p4-pill-badge ${n.status === 'VERIFIED' ? 'green' : 'amber'}`} style={{ fontSize: 9, padding: '1px 6px' }}>
                        {n.badge}
                      </span>
                    </div>
                    <span className="p4-dispatch-time">{n.time}</span>
                  </div>
                  <p className="p4-dispatch-body">
                    "{n.headline}"
                  </p>
                </div>
              ))}

              {!newsItems.length && (
                <div className="p4-dispatch-card">
                  <p className="p4-dispatch-body">
                    No public-safety reports were retrieved for {currentClaim.location || 'this location'}. Run the backend verification to query SerpApi + NewsAPI.
                  </p>
                </div>
              )}

              <div className="p4-dispatch-card" style={{ background: '#ffffff' }}>
                <div className="p4-dispatch-header">
                  <div className="p4-dispatch-title">
                    <ShieldCheck size={14} style={{ color: '#047d53' }} />
                    <span>State Press Information Bureau</span>
                    <span className="p4-pill-badge green" style={{ fontSize: 9, padding: '1px 6px' }}>OFFICIAL</span>
                  </div>
                  <span className="p4-dispatch-time">18:22 IST</span>
                </div>
                <p className="p4-dispatch-body">
                  "Civic safety officers are actively deployed. Gate 4 and 5 auxiliary exit lanes are fully operational to absorb concourse spillover."
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Marshal & First Responder Radio Comms */}
          {activeMediaTab === 'radio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {media.radio && (
                <div className="p4-dispatch-card">
                  <div className="p4-dispatch-header">
                    <div className="p4-dispatch-title">
                      <Radio size={14} style={{ color: 'var(--lime-deep)' }} />
                      <span>{media.radio.unit}</span>
                      <span className="p4-pill-badge yellow" style={{ fontSize: 9, padding: '1px 6px' }}>
                        {media.radio.callsign}
                      </span>
                    </div>
                    <span className="p4-dispatch-time">{media.radio.time}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-muted)' }}>RADIO TRANSCRIPT:</span>
                    <span style={{ height: 2, flex: 1, background: 'var(--border)' }} />
                  </div>

                  <p className="p4-dispatch-body" style={{ fontStyle: 'italic', fontWeight: 600 }}>
                    "{media.radio.transcript}"
                  </p>
                </div>
              )}

              <div className="p4-dispatch-card">
                <div className="p4-dispatch-header">
                  <div className="p4-dispatch-title">
                    <AlertTriangle size={14} style={{ color: '#ca8a04' }} />
                    <span>Control Room Dispatcher (Desk 4)</span>
                    <span className="p4-pill-badge lime" style={{ fontSize: 9, padding: '1px 6px' }}>HQ DESK</span>
                  </div>
                  <span className="p4-dispatch-time">18:22 IST</span>
                </div>
                <p className="p4-dispatch-body">
                  "Marshal Unit R-4 report acknowledged. Auxiliary turnstiles unlocked. Zero medical incidents logged."
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: Citizen Geotags & Social Reports */}
          {activeMediaTab === 'citizen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {media.citizen && (
                <div className="p4-dispatch-card">
                  <div className="p4-dispatch-header">
                    <div className="p4-dispatch-title">
                      <Users size={14} style={{ color: 'var(--ink)' }} />
                      <span>{media.citizen.user}</span>
                      <span className="p4-pill-badge green" style={{ fontSize: 9, padding: '1px 6px' }}>
                        {media.citizen.badge}
                      </span>
                    </div>
                    <span className="p4-dispatch-time">{media.citizen.time}</span>
                  </div>
                  <p className="p4-dispatch-body">
                    "{media.citizen.report}"
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: '#116b4b' }}>
                    <span>▲ {media.citizen.upvotes} Citizens confirmed this report</span>
                  </div>
                </div>
              )}

              <div className="p4-dispatch-card">
                <div className="p4-dispatch-header">
                  <div className="p4-dispatch-title">
                    <span>Social Media Sentiment Monitor</span>
                    <span className="p4-pill-badge yellow" style={{ fontSize: 9, padding: '1px 6px' }}>#Gate3Rush</span>
                  </div>
                  <span className="p4-dispatch-time">18:18 IST</span>
                </div>
                <p className="p4-dispatch-body">
                  "28 posts detected in 15 minutes. NLP classification shows 88% transit delay complaints; 0 distress/panic signals."
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}