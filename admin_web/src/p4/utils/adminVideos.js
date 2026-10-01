const VIDEO_BASE = (import.meta.env.VITE_VIDEO_BASE_URL || 'http://127.0.0.1:8000') + '/videos'

// Only the admin_*.mp4 files are used for evidence reconstruction
const ADMIN_VIDEOS = {
  crowd_anomaly: 'admin_crowd.mp4',
  public_gathering: 'admin_crowd.mp4', // no gathering-specific clip, so reuse the crowd one
  traffic_accident: 'admin_traffic.mp4',
  unattended_baggage: 'admin_unattended.mp4'
}

export function adminVideoFor(incident) {
  const key = (incident?.type || '').toLowerCase().trim().replace(/\s+/g, '_')
  return `${VIDEO_BASE}/${ADMIN_VIDEOS[key] || ADMIN_VIDEOS.crowd_anomaly}`
}