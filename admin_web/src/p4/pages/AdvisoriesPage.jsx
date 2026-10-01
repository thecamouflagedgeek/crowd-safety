import React, { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span
              style={{
                background: '#fff',
                borderRadius: 999,
                padding: '4px 16px',
                fontSize: '1.15rem',
                fontWeight: 500,
                color: 'var(--ink)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                whiteSpace: 'nowrap'
              }}
            >
              Publish
            </span>
            <h1 className="p4-page-title">Official advisory</h1>
          </div>
          <p className="p4-page-subtitle">
            Authorize and transmit validated safety directives to citizens and digital signage for INC001.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="p4-ink-btn"
            onClick={() => onNavigate('/evidence')}
          >
            <ArrowLeft size={13} />
            <span>BACK TO EVIDENCE RECONSTRUCTION</span>
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