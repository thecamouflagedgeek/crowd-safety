import React from 'react'
import { Check, Radio, AlertCircle, ShieldCheck, BellRing, Eye } from 'lucide-react'

export function IncidentLifecycle({ currentStep = 'VERIFIED', incidentId = 'INC001' }) {
  const steps = [
    { key: 'DETECTED', label: 'DETECTED', icon: AlertCircle, desc: '18:21:04 IST' },
    { key: 'INVESTIGATING', label: 'INVESTIGATING', icon: Eye, desc: 'CCTV Dual Feed' },
    { key: 'VERIFIED', label: 'VERIFIED', icon: ShieldCheck, desc: 'Multi-Source Agree' },
    { key: 'ADVISORY_PUBLISHED', label: 'ADVISORY PUBLISHED', icon: BellRing, desc: 'Pushed to Citizens' },
    { key: 'MONITORING', label: 'MONITORING', icon: Radio, desc: 'Continuous CV' }
  ]

  const stepOrder = ['DETECTED', 'INVESTIGATING', 'VERIFIED', 'ADVISORY_PUBLISHED', 'MONITORING']
  const currentIndex = stepOrder.indexOf(currentStep)

  return (
    <div className="p4-lifecycle-strip">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8, paddingRight: 10, borderRight: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-title)', letterSpacing: '0.06em' }}>
          {incidentId} LIFECYCLE
        </span>
      </div>
      {steps.map((step, idx) => {
        const isPast = idx < currentIndex
        const isCurrent = idx === currentIndex
        const Icon = step.icon

        return (
          <React.Fragment key={step.key}>
            <div className={`p4-lifecycle-step ${isPast ? 'completed' : ''} ${isCurrent ? 'active' : ''}`}>
              {isPast ? (
                <Check size={13} style={{ color: 'var(--lime-deep)' }} />
              ) : (
                <Icon size={12} style={{ color: isCurrent ? 'var(--ink)' : 'var(--ink-muted)' }} />
              )}
              <span style={{ color: isCurrent ? 'var(--ink)' : isPast ? 'var(--ink)' : 'var(--ink-secondary)', fontWeight: isCurrent ? 800 : 700 }}>
                {step.label}
              </span>
              <small style={{ fontSize: 9.5, opacity: 0.8, color: 'var(--ink-muted)' }}>({step.desc})</small>
            </div>
            {idx < steps.length - 1 && <span className="p4-lifecycle-arrow" style={{ color: 'var(--border)' }}>→</span>}
          </React.Fragment>
        )
      })}
    </div>
  )
}
