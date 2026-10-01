import React, { useState } from 'react'
import {
  ShieldCheck,
  ArrowRight
} from 'lucide-react'
import { IncidentLifecycle } from '../components/IncidentLifecycle'
import { VerificationMatrix } from '../components/VerificationMatrix'

export function VerificationPage({ onNavigate }) {
  const [lifecycleStatus, setLifecycleStatus] = useState('VERIFIED')

  return (
    <div className="p4-workspace">
      {/* Header */}
      <div className="p4-page-header">
        <div className="p4-header-info">
          <span className="p4-badge-tag">DECISION INTEGRITY GATEWAY</span>
          <h1 className="p4-page-title">
            <ShieldCheck size={24} style={{ color: 'var(--ink)' }} />
            INFORMATION VERIFICATION
          </h1>
          <p className="p4-page-subtitle">
            Validate public reports against available evidence before issuing an official response.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="p4-ink-btn"
            onClick={() => onNavigate('/advisories')}
          >
            <span>DRAFT OFFICIAL ADVISORY</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Incident Lifecycle Strip */}
      <IncidentLifecycle currentStep={lifecycleStatus} incidentId="INC001" />

      {/* Verification Matrix Workspace */}
      <VerificationMatrix
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
