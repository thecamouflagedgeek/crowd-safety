const enc = encodeURIComponent

// Optional: paste REAL article / report / reel URLs per incident id here.
// They replace the auto-generated search links for that incident.
const SOURCE_OVERRIDES = {
  // INC001: [
  //   { id: 'x1', kind: 'news', outlet: 'NDTV', title: 'Headline here', url: 'https://www.ndtv.com/...' },
  //   { id: 'x2', kind: 'tv',   outlet: 'NDTV 24x7', title: 'Report title', url: 'https://www.youtube.com/watch?v=...' },
  //   { id: 'x3', kind: 'reel', outlet: 'Instagram', title: 'Reel title', url: 'https://www.instagram.com/reel/...' }
  // ]
}

function profile(incident) {
  const t = (incident?.type || '').toLowerCase()
  if (t.includes('traffic') || t.includes('accident')) return { topic: 'road accident', tag: 'roadaccident' }
  if (t.includes('baggage') || t.includes('unattended')) return { topic: 'unattended bag security scare', tag: 'unattendedbag' }
  if (t.includes('gather')) return { topic: 'large crowd gathering', tag: 'crowdgathering' }
  return { topic: 'crowd crush stampede', tag: 'crowdcrush' }
}

export function getSourcesFor(incident) {
  if (SOURCE_OVERRIDES[incident?.id]) return SOURCE_OVERRIDES[incident.id]
  if (Array.isArray(incident?.sources) && incident.sources[0]?.url) return incident.sources

  const { topic, tag } = profile(incident)
  const place = (incident?.location || '').split(',')[0].trim()
  const placeTag = place.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'india'
  const q = `${topic} ${place}`.trim()

  return [
    { id: 's1', kind: 'news', outlet: 'NDTV', title: `${place || 'India'}: ${topic}`, meta: 'ndtv.com · search', url: `https://www.ndtv.com/search?searchtext=${enc(q)}` },
    { id: 's2', kind: 'news', outlet: 'NDTV via Google News', title: `Latest NDTV headlines on ${topic}`, meta: 'news.google.com', url: `https://www.google.com/search?q=${enc(`site:ndtv.com ${q}`)}&tbm=nws` },
    { id: 's3', kind: 'tv', outlet: 'NDTV 24x7', title: `TV report: ${topic}, ${place}`, meta: 'youtube.com', url: `https://www.youtube.com/results?search_query=${enc(`NDTV 24x7 ${q}`)}` },
    { id: 's4', kind: 'tv', outlet: 'Aaj Tak · Times Now', title: `Ground report: ${topic}`, meta: 'youtube.com', url: `https://www.youtube.com/results?search_query=${enc(`Aaj Tak Times Now ${q}`)}` },
    { id: 's5', kind: 'reel', outlet: 'Instagram', title: `#${tag} reels`, meta: 'instagram.com', url: `https://www.instagram.com/explore/tags/${tag}/` },
    { id: 's6', kind: 'reel', outlet: 'Instagram', title: `#${placeTag} on the ground`, meta: 'instagram.com', url: `https://www.instagram.com/explore/tags/${placeTag}/` }
  ]
}