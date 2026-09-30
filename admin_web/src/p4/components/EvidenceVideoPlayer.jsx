import React, { useRef, useState } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Maximize,
  Volume2,
  VolumeX,
  Radio,
  Eye,
  SlidersHorizontal,
  AlertCircle
} from 'lucide-react'
import { CAMERAS_CONFIG } from '../services/mockData'
import { mediaUrl } from '../services/api'

export function EvidenceVideoPlayer({ activeTime = '18:08:32' }) {
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(true)
  const [synced, setSynced] = useState(true)
  const [videoErrors, setVideoErrors] = useState({ cctv_01: false, cctv_02: false })

  const videoRef1 = useRef(null)
  const videoRef2 = useRef(null)

  const togglePlayPause = () => {
    const nextState = !isPlaying
    setIsPlaying(nextState)

    if (videoRef1.current) {
      if (nextState) videoRef1.current.play().catch(() => {})
      else videoRef1.current.pause()
    }
    if (videoRef2.current) {
      if (nextState) videoRef2.current.play().catch(() => {})
      else videoRef2.current.pause()
    }
  }

  const restartVideos = () => {
    if (videoRef1.current) {
      videoRef1.current.currentTime = 0
      videoRef1.current.play().catch(() => {})
    }
    if (videoRef2.current) {
      videoRef2.current.currentTime = 0
      videoRef2.current.play().catch(() => {})
    }
    setIsPlaying(true)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (videoRef1.current) videoRef1.current.muted = !isMuted
    if (videoRef2.current) videoRef2.current.muted = !isMuted
  }

  const toggleFullscreen = (camIndex) => {
    const el = camIndex === 1 ? videoRef1.current : videoRef2.current
    if (el) {
      if (el.requestFullscreen) el.requestFullscreen()
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
    }
  }

  const syncCameras = () => {
    if (videoRef1.current && videoRef2.current) {
      videoRef2.current.currentTime = videoRef1.current.currentTime
      setSynced(true)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Master Video Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(13, 21, 36, 0.95)',
        border: '1px solid var(--p4-panel-border)',
        borderRadius: 10,
        padding: '8px 16px',
        fontSize: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: '#fff', letterSpacing: '0.06em' }}>
            <Radio size={14} style={{ color: 'var(--p4-accent-lime)' }} />
            SYNCHRONIZED CV EVIDENCE FEEDS
          </span>
          <span style={{ fontSize: 11, color: 'var(--p4-text-secondary)', fontFamily: 'var(--p4-font-mono)' }}>
            TIMECODE: <b style={{ color: 'var(--p4-accent-lime)' }}>{activeTime}</b>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="p4-cctv-btn" onClick={togglePlayPause}>
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlaying ? 'PAUSE ALL' : 'PLAY ALL'}</span>
          </button>
          <button className="p4-cctv-btn" onClick={restartVideos}>
            <RotateCcw size={13} />
            <span>RESTART</span>
          </button>
          <button
            className={`p4-cctv-btn ${synced ? 'active' : ''}`}
            onClick={syncCameras}
            title="Lock camera playback to identical frame timestamp"
          >
            <SlidersHorizontal size={13} />
            <span>SYNC CLOCKS</span>
          </button>
          <button className="p4-cctv-btn" onClick={toggleMute}>
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        </div>
      </div>

      {/* Dual Video Cards */}
      <div className="p4-dual-cctv-grid">
        {CAMERAS_CONFIG.map((cam, idx) => {
          const videoRef = idx === 0 ? videoRef1 : videoRef2
          const hasError = idx === 0 ? videoErrors.cctv_01 : videoErrors.cctv_02

          return (
            <div key={cam.id} className="p4-cctv-card">
              {/* Header */}
              <div className="p4-cctv-header">
                <div className="p4-cctv-title">
                  <span className="p4-rec-dot" />
                  <span>{cam.label}</span>
                  <span style={{ color: 'var(--p4-text-muted)', fontWeight: 400 }}>· {cam.location}</span>
                </div>
                <div className="p4-cctv-meta">
                  <span style={{ color: 'var(--p4-accent-lime)', fontWeight: 700 }}>● {cam.status}</span>
                  <span>{activeTime}</span>
                </div>
              </div>

              {/* Video Player & Overlays */}
              <div className="p4-cctv-video-wrap">
                {!hasError ? (
                  <video
                    ref={videoRef}
                    className="p4-cctv-video"
                    src={mediaUrl(cam.streamUrl)}
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                    onError={() => {
                      setVideoErrors((prev) => ({
                        ...prev,
                        [cam.id]: true
                      }))
                    }}
                  />
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: 20,
                    textAlign: 'center',
                    color: 'var(--p4-text-secondary)',
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle, #101c30 0%, #050a12 100%)'
                  }}>
                    <AlertCircle size={32} style={{ color: 'var(--p4-accent-amber)' }} />
                    <b style={{ color: '#fff', fontSize: 13 }}>DEMO VIDEO STREAM ARCHIVE</b>
                    <span style={{ fontSize: 11, maxWidth: 300 }}>
                      Live sensor recorded stream for {cam.label} ({cam.zone}). Video stream standby.
                    </span>
                    <span className="p4-pill-badge lime" style={{ fontSize: 9 }}>
                      ACTIVE CV SENSORS: 142 TRACKS
                    </span>
                  </div>
                )}

                {/* HUD Scanlines */}
                <div className="p4-cctv-hud-overlay" />

                {/* Crosshairs */}
                <div className="p4-cctv-crosshair" />

                {/* Live CV Telemetry Overlay */}
                <div className="p4-cctv-telemetry-overlay">
                  <div>[OPTICAL FLOW: DENSITY {cam.metrics.density}]</div>
                  <div>[VELOCITY: {cam.metrics.velocity}]</div>
                  <div>[CV_STATE: {cam.cvStatus}]</div>
                  <div>[RESOLUTION: {cam.resolution}]</div>
                </div>
              </div>

              {/* Footer Controls */}
              <div className="p4-cctv-controls">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--p4-text-muted)', fontFamily: 'var(--p4-font-mono)' }}>
                  <Eye size={13} style={{ color: 'var(--p4-accent-blue)' }} />
                  <span>ZONE: {cam.zone}</span>
                </div>

                <div className="p4-control-btn-group">
                  <button
                    className="p4-cctv-btn"
                    onClick={() => toggleFullscreen(idx + 1)}
                    title="Fullscreen Feed"
                  >
                    <Maximize size={12} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
