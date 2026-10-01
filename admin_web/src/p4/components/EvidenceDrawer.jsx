import React from 'react'
import {
  X,
  Shield,
  Cpu,
  ArrowRight
} from 'lucide-react'

export function EvidenceDrawer({ item, onClose, onNavigateVerify }) {
  if (!item) return null

  const isTimeline = !!item.event
  const title = isTimeline ? item.event : item.label || item.id
  const claimText = isTimeline ? item.detail : item.claim
  const sourceName = item.source || item.sourceType || 'Sensor Feed'
  const time = item.time || item.timestamp || '18:12'
  const location = item.location || 'Gate 3'
  const credibility = item.credibility ? Math.round(item.credibility * 100) : 92

  return (
    <div className="p4-modal-overlay" onClick={onClose}>
      <div className="p4-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="p4-modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: '#eef2ff',
              border: '1px solid #e0e7ff',
              display: 'grid',
              placeItems: 'center',
              color: '#6366f1'
            }}>
              <Shield size={20} />
            </div>
            <div>
              <span className="p4-badge-tag">{isTimeline ? 'TIMELINE EVENT INSPECTION' : 'SOURCE EVIDENCE ARTIFACT'}</span>
              <h3 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: 'var(--p4-text-title)' }}>
                {title}
              </h3>
            </div>
          </div>
          <button className="p4-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Core Metadata in Light Mode */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          background: '#f8fafc',
          padding: 14,
          borderRadius: 14,
          border: '1px solid #e2e8f0'
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--p4-text-secondary)', textTransform: 'uppercase' }}>Source Provider</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--p4-text-title)', marginTop: 2 }}>{sourceName}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--p4-text-secondary)', textTransform: 'uppercase' }}>Observed Timestamp</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', marginTop: 2, fontFamily: 'var(--p4-font-mono)' }}>
              {time} IST
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--p4-text-secondary)', textTransform: 'uppercase' }}>Location Vector</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--p4-text-title)', marginTop: 2 }}>{location}</div>
          </div>
        </div>

        {/* Claim / Statement */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--p4-text-secondary)', textTransform: 'uppercase' }}>
            Forensic Claim / Observation Statement
          </span>
          <div style={{
            background: '#f1f5f9',
            borderLeft: '4px solid #6366f1',
            padding: '12px 16px',
            borderRadius: '0 12px 12px 0',
            fontSize: 13,
            lineHeight: 1.5,
            color: '#1e293b',
            fontWeight: 500
          }}>
            "{claimText}"
          </div>
        </div>

        {/* Technical Data / AI Signal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--p4-text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Cpu size={14} style={{ color: '#0284c7' }} />
            Computer Vision Telemetry & Consensus Signature
          </span>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: 14,
            fontFamily: 'var(--p4-font-mono)',
            fontSize: 11,
            color: '#334155',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <div><b style={{ color: '#6366f1' }}>• MODEL:</b> YOLOv8x-crowd-density (v2.4_fp16)</div>
            <div><b style={{ color: '#0284c7' }}>• SENSOR_ZONE:</b> Gate 3 North Concourse [Lat: 19.0760, Lng: 72.8777]</div>
            <div><b style={{ color: '#10b981' }}>• CONFIDENCE_RATING:</b> {credibility}% (Calibrated Bayesian Prior)</div>
            <div><b style={{ color: '#f59e0b' }}>• TECHNICAL_READING:</b> {item.technicalData || 'Optical flow gradient -68% | Density 86% | Tailback 45m'}</div>
            <div><b style={{ color: '#059669' }}>• STATUS:</b> VERIFIED by Dual Camera Triangulation + On-ground Marshal</div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button className="p4-outline-btn" style={{ padding: '8px 16px' }} onClick={onClose}>
            DISMISS
          </button>
          {onNavigateVerify && (
            <button
              className="p4-ink-btn"
              onClick={() => {
                onClose()
                onNavigateVerify(item)
              }}
            >
              <span>CROSS-CHECK IN VERIFICATION MATRIX</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
