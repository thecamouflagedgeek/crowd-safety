import React from 'react'
import {
  Video,
  Users,
  Shield,
  Newspaper,
  Share2,
  Clock,
  MapPin
} from 'lucide-react'

export function EvidenceSourcesGrid({
  sources = [],
  selectedSource,
  onSelectSource
}) {
  const getSourceTypeIcon = (source = '') => {
    const s = source.toLowerCase()
    if (s.includes('cctv')) return <Video size={13} style={{ color: 'var(--p4-accent-lime)' }} />
    if (s.includes('citizen')) return <Users size={13} style={{ color: 'var(--p4-accent-amber)' }} />
    if (s.includes('official') || s.includes('authority')) return <Shield size={13} style={{ color: 'var(--p4-accent-blue)' }} />
    if (s.includes('news')) return <Newspaper size={13} style={{ color: 'var(--p4-accent-cyan)' }} />
    return <Share2 size={13} style={{ color: '#e879f9' }} />
  }

  const getStatusBadge = (status = '') => {
    switch (status.toUpperCase()) {
      case 'VERIFIED':
      case 'CONFIRMED':
        return <span className="p4-pill-badge green">✓ VERIFIED</span>
      case 'SUPPORTING':
        return <span className="p4-pill-badge lime">SUPPORTING</span>
      case 'REFUTED':
        return <span className="p4-pill-badge red">✕ REFUTED</span>
      default:
        return <span className="p4-pill-badge amber">? UNVERIFIED</span>
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="p4-section-header">
        <h3 className="p4-section-title">
          <Shield size={16} style={{ color: 'var(--p4-accent-blue)' }} />
          MULTI-SOURCE SUPPORTING EVIDENCE REPOSITORY
        </h3>
        <span style={{ fontSize: 11, color: 'var(--p4-text-secondary)' }}>
          Click any source tile to open detailed forensic inspection & consensus analysis
        </span>
      </div>

      <div className="p4-sources-grid">
        {sources.map((item) => {
          const isSelected = selectedSource?.id === item.id

          return (
            <div
              key={item.id}
              className={`p4-source-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectSource(item)}
            >
              <div className="p4-source-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {getSourceTypeIcon(item.source)}
                  <span className="p4-source-type-pill">{item.source}</span>
                </div>
                {getStatusBadge(item.status)}
              </div>

              <div>
                <div className="p4-source-name">{item.label || item.id}</div>
                <div className="p4-source-claim">"{item.claim}"</div>
              </div>

              <div className="p4-source-foot">
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} />
                  {item.location || 'Gate 3'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} />
                  {item.timestamp || '—'}
                </span>
                <span style={{ color: 'var(--p4-accent-lime)', fontWeight: 700 }}>
                  {Math.round((item.credibility || 0.8) * 100)}% REL
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
