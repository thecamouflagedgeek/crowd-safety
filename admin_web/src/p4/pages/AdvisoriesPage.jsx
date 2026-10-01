import React, { useState } from 'react'
import { ArrowLeft, ArrowUpRight, Bell, Radio, Users, Monitor, Send } from 'lucide-react'
import { IncidentLifecycle } from '../components/IncidentLifecycle'
import { AdvisoryComposer } from '../components/AdvisoryComposer'
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

export function AdvisoriesPage({ onNavigate, prefillMessage, incidentId = 'INC001' }) {
  const [lifecycleStep, setLifecycleStep] = useState('VERIFIED')

  const handlePublished = () => {
    setLifecycleStep('ADVISORY_PUBLISHED')
  }

  return (
    <div className="p4-workspace ev-page">
      {/* HEADER */}
      <div className="ev-head">
        <div>
          <span className="ev-kicker">EMERGENCY PUBLIC BROADCAST SERVICE</span>
          <h1 className="ev-title">
            <span className="ev-chip">Broadcast</span>
            Official <b>advisory</b>
          </h1>
          <p className="ev-sub">
            Authorize and transmit validated safety directives to citizens and digital signage for {incidentId}.
          </p>
        </div>

        <button className="ev-btn ink" onClick={() => onNavigate('/evidence')}>
          <ArrowLeft size={14} />
          <span>BACK TO EVIDENCE</span>
        </button>
      </div>

      {/* Incident Lifecycle Strip */}
      <IncidentLifecycle currentStep={lifecycleStep} incidentId={incidentId} />

      {/* HERO + STAT TILES (Matches Evidence Reconstruction & Information Propagation) */}
      <div className="ev-hero-grid">
        <section className="ev-hero">
          <div className="ev-blob">
            <Contours />
            <div className="ev-num">
              <b>4.2k</b>
              <sup>REACH</sup>
            </div>
          </div>
          <div className="ev-hero-text">
            <span className="ev-sev" style={{ background: '#eff6ce', color: '#456000' }}>
              CITIZEN ALERT DISPATCH
            </span>
            <Send size={18} style={{ color: 'var(--ink)' }} />
            <h2>Emergency Broadcast Hub</h2>
            <p>Direct priority push to nearby citizen devices, concourse LED digital boards, and municipal emergency relays.</p>
            <div className="ev-hero-actions">
              <button className="ev-btn ink" onClick={() => {
                const form = document.querySelector('form')
                if (form) form.scrollIntoView({ behavior: 'smooth' })
              }}>
                <span>COMPOSE NOW</span>
              </button>
              <button className="ev-btn light" onClick={() => onNavigate('/verification')}>
                <span>VERIFICATION MATRIX</span>
              </button>
            </div>
          </div>
        </section>

        <div className="ev-tile">
          <div className="ev-tile-top">
            <span>Broadcast channels</span>
            <span className="ev-tile-arrow"><Radio size={16} /></span>
          </div>
          <div className="ev-tile-val">3<small>active</small></div>
          <span className="ev-dots" />
        </div>

        <div className="ev-tile slate" style={{ background: 'linear-gradient(165deg, var(--sl1), var(--sl2))', color: '#fff' }}>
          <div className="ev-tile-top" style={{ color: '#fff' }}>
            <span>Target audience</span>
            <span className="ev-tile-arrow" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}><Users size={16} /></span>
          </div>
          <div className="ev-tile-val" style={{ color: '#fff' }}>4.2k<small style={{ color: 'rgba(255,255,255,0.7)' }}>nearby</small></div>
          <span className="ev-dots" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1.6px, transparent 1.9px)' }} />
        </div>

        <div className="ev-tile">
          <div className="ev-tile-top">
            <span>Digital signage</span>
            <span className="ev-tile-arrow"><Monitor size={16} /></span>
          </div>
          <div className="ev-tile-val">12<small>displays</small></div>
          <span className="ev-dots" />
        </div>
      </div>

      {/* Advisory Composer Workspace */}
      <AdvisoryComposer
        incidentId={incidentId}
        initialMessage={prefillMessage}
        onAdvisoryPublished={handlePublished}
      />
    </div>
  )
}