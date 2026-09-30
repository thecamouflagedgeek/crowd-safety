import React, { useState } from 'react'
import {
  Bell,
  ArrowRight
} from 'lucide-react'
import { IncidentLifecycle } from '../components/IncidentLifecycle'
import { AdvisoryComposer } from '../components/AdvisoryComposer'

export function AdvisoriesPage({ onNavigate, prefillMessage }) {
  const [lifecycleStep, setLifecycleStep] = useState('VERIFIED')

  const handlePublished = () => {
    setLifecycleStep('ADVISORY_PUBLISHED')
  }

  return (
    <div className="p4-workspace">
      {/* Header */}
      <div className="p4-page-header">
        <div className="p4-header-info">
          <span className="p4-badge-tag">EMERGENCY PUBLIC BROADCAST SERVICE</span>
          <h1 className="p4-page-title">
            <Bell size={24} style={{ color: 'var(--p4-accent-red)' }} />
            OFFICIAL ADVISORY PUBLISHING
          </h1>
          <p className="p4-page-subtitle">
            Authorize and transmit validated safety directives directly to citizens and digital signage.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="p4-btn p4-btn-primary"
            style={{ width: 'auto', padding: '9px 16px', fontSize: 11 }}
            onClick={() => onNavigate('/evidence')}
          >
            <span>BACK TO EVIDENCE RECONSTRUCTION</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Incident Lifecycle Strip */}
      <IncidentLifecycle currentStep={lifecycleStep} incidentId="INC001" />

      {/* Advisory Composer Workspace */}
      <AdvisoryComposer
        incidentId="INC001"
        initialMessage={prefillMessage}
        onAdvisoryPublished={handlePublished}
      />
    </div>
  )
}
