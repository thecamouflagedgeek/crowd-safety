import React, { useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCheck
} from 'lucide-react'
import { IncidentLifecycle } from '../components/IncidentLifecycle'
import { VerificationMatrix } from '../components/VerificationMatrix'
import '../styles/evidence-airly.css'

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

export function VerificationPage({ onNavigate, incidentId = 'INC001' }) {
  const [lifecycleStatus, setLifecycleStatus] = useState('VERIFIED')

  return (
    <div className="p4-workspace ev-page">
      {/* HEADER */}
      <div className="ev-head">
        <div>
          <span className="ev-kicker">Vigil · DECISION GATEWAY</span>
          <h1 className="ev-title">
            <span className="ev-chip">Cross-check</span>
            Multi-source <b>verification</b>
          </h1>
          <p className="ev-sub">
            Cross-reference public reports against live CCTV, ground marshals, and news before issuing an official advisory.
          </p>
        </div>

        <button className="ev-btn ink" onClick={() => onNavigate('/advisories')}>
          <span>DRAFT OFFICIAL ADVISORY</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Incident Lifecycle Strip */}
      <IncidentLifecycle currentStep={lifecycleStatus} incidentId={incidentId} />

      {/* HERO + STAT TILES (Matches Evidence Reconstruction & Information Propagation) */}
      <div className="ev-hero-grid">
        <section className="ev-hero">
          <div className="ev-blob">
            <Contours />
            <div className="ev-num">
              <b>94</b>
              <sup>% CONF</sup>
            </div>
          </div>
          <div className="ev-hero-text">
            <span className="ev-sev" style={{ background: '#eff6ce', color: '#456000' }}>
              GATE 3 · CORROBORATED
            </span>
            <FileCheck size={18} style={{ color: 'var(--ink)' }} />
            <h2>Decision Integrity Gateway</h2>
            <p>Multi-source triangulation confirms 4 of 5 streams agree on congestion at Gate 3. Zero safety incidents logged.</p>
            <div className="ev-hero-actions">
              <button className="ev-btn ink" onClick={() => onNavigate('/advisories')}>
                <span>PROCEED TO ADVISORY</span>
                <ArrowRight size={13} />
              </button>
              <button className="ev-btn light" onClick={() => onNavigate('/evidence')}>
                <span>RECONSTRUCTION</span>
              </button>
            </div>
          </div>
        </section>

        <div className="ev-tile">
          <div className="ev-tile-top">
            <span>Audited claims</span>
            <span className="ev-tile-arrow"><ArrowUpRight size={16} /></span>
          </div>
          <div className="ev-tile-val">3<small>claims</small></div>
          <span className="ev-dots" />
        </div>

        <div className="ev-tile slate" style={{ background: 'linear-gradient(165deg, var(--sl1), var(--sl2))', color: '#fff' }}>
          <div className="ev-tile-top" style={{ color: '#fff' }}>
            <span>Consensus trust</span>
            <span className="ev-tile-arrow" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}><ShieldCheck size={16} /></span>
          </div>
          <div className="ev-tile-val" style={{ color: '#fff' }}>92<small style={{ color: 'rgba(255,255,255,0.7)' }}>%</small></div>
          <span className="ev-dots" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1.6px, transparent 1.9px)' }} />
        </div>

        <div className="ev-tile">
          <div className="ev-tile-top">
            <span>Flagged rumors</span>
            <span className="ev-tile-arrow"><AlertTriangle size={16} /></span>
          </div>
          <div className="ev-tile-val">1<small>filtered</small></div>
          <span className="ev-dots" />
        </div>
      </div>

      {/* Verification Matrix Workspace */}
      <VerificationMatrix
        incidentId={incidentId}
        onNavigateAdvisory={(claim) =>
          onNavigate('/advisories', {
            prefillMessage: claim.suggestedAdvisory || `Official Notice: ${claim.claim}`
          })
        }
        onStatusChange={(newStatus) => {
          if (newStatus === 'VERIFIED') setLifecycleStatus('VERIFIED')
        }}
      />
    </div>
  )
}

