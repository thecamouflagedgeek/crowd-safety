import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from './leaflet-heat-setup'
import 'leaflet.heat'

function generatePoints(incidents, zoom) {
  const highPoints = []
  const mediumPoints = []
  const lowPoints = []

  // Geographic degrees per pixel at current zoom level:
  // Dynamically adjusts so clusters stay geographically tight around the incident pin
  // and NEVER disperse/evaporate off screen when zooming in.
  const degPerPx = 360 / (256 * Math.pow(2, zoom))
  const clusterPx = Math.max(18, Math.min(36, 12 + zoom * 1.15))
  const spread = degPerPx * clusterPx

  incidents.forEach((item) => {
    if (
      item.latitude == null ||
      item.longitude == null ||
      !Number.isFinite(Number(item.latitude)) ||
      !Number.isFinite(Number(item.longitude))
    ) {
      return
    }

    const lat = Number(item.latitude)
    const lng = Number(item.longitude)
    const sev = (item.severity || 'LOW').toUpperCase()
    const density = item.density || 45

    if (sev === 'CRITICAL' || sev === 'HIGH') {
      // 12% reduced intensity from previous levels for refined, non-overwhelming presentation
      const baseIntensity = Math.min(0.81, 0.70 + (density / 400))
      highPoints.push([lat, lng, baseIntensity])

      const subPoints = 8
      for (let i = 0; i < subPoints; i++) {
        const angle = (i / subPoints) * Math.PI * 2 + (density % 7)
        const dist = spread * (0.32 + ((i % 3) * 0.22))
        highPoints.push([
          lat + Math.sin(angle) * dist,
          lng + Math.cos(angle) * dist,
          baseIntensity * 0.63
        ])
      }
    } else if (sev === 'MEDIUM') {
      const baseIntensity = Math.min(0.75, 0.60 + (density / 450))
      mediumPoints.push([lat, lng, baseIntensity])

      const subPoints = 6
      for (let i = 0; i < subPoints; i++) {
        const angle = (i / subPoints) * Math.PI * 2 + (density % 5)
        const dist = spread * (0.30 + ((i % 3) * 0.22))
        mediumPoints.push([
          lat + Math.sin(angle) * dist,
          lng + Math.cos(angle) * dist,
          baseIntensity * 0.58
        ])
      }
    } else {
      const baseIntensity = Math.min(0.63, 0.46 + (density / 500))
      lowPoints.push([lat, lng, baseIntensity])

      const subPoints = 4
      for (let i = 0; i < subPoints; i++) {
        const angle = (i / subPoints) * Math.PI * 2
        const dist = spread * (0.35 + ((i % 2) * 0.25))
        lowPoints.push([
          lat + Math.sin(angle) * dist,
          lng + Math.cos(angle) * dist,
          baseIntensity * 0.50
        ])
      }
    }
  })

  return { highPoints, mediumPoints, lowPoints }
}

export function HeatmapLayer({ incidents = [], visible = true }) {
  const map = useMap()
  const layersRef = useRef({ high: null, medium: null, low: null })

  useEffect(() => {
    if (!map || !L.heatLayer) return

    // If disabled or empty, remove existing layers cleanly
    if (!visible || !incidents || incidents.length === 0) {
      Object.keys(layersRef.current).forEach((key) => {
        if (layersRef.current[key]) {
          map.removeLayer(layersRef.current[key])
          layersRef.current[key] = null
        }
      })
      return
    }

    const renderLayers = () => {
      const zoom = map.getZoom() || 5
      const { highPoints, mediumPoints, lowPoints } = generatePoints(incidents, zoom)

      // Dynamic radius scaling gracefully with zoom so heat NEVER evaporates at street level
      // maxZoom: 1 prevents Leaflet.heat from dividing intensity by 2^(maxZoom - zoom),
      // maintaining rock-solid visual consistency whether zoomed out or zoomed into a pin.
      const dynamicRadius = Math.round(Math.max(30, Math.min(48, 24 + zoom * 1.3)))
      const dynamicBlur = Math.round(dynamicRadius * 0.65)

      // 1. HIGH SEVERITY (Red / Orange / Crimson) - 12% reduced intensity
      if (highPoints.length > 0) {
        if (!layersRef.current.high) {
          layersRef.current.high = L.heatLayer(highPoints, {
            radius: dynamicRadius,
            blur: dynamicBlur,
            maxZoom: 1,
            max: 1.0,
            minOpacity: 0.20,
            gradient: {
              0.15: 'rgba(254, 215, 170, 0.44)',
              0.38: 'rgba(251, 146, 60, 0.65)',
              0.62: 'rgba(239, 68, 68, 0.74)',
              0.85: 'rgba(220, 38, 38, 0.80)',
              1.00: 'rgba(185, 28, 28, 0.84)'
            }
          }).addTo(map)
        } else {
          layersRef.current.high.setOptions({ radius: dynamicRadius, blur: dynamicBlur, maxZoom: 1 })
          layersRef.current.high.setLatLngs(highPoints)
        }
      } else if (layersRef.current.high) {
        map.removeLayer(layersRef.current.high)
        layersRef.current.high = null
      }

      // 2. MEDIUM SEVERITY (Amber / Gold / Yellow) - 12% reduced intensity
      if (mediumPoints.length > 0) {
        if (!layersRef.current.medium) {
          layersRef.current.medium = L.heatLayer(mediumPoints, {
            radius: dynamicRadius - 2,
            blur: dynamicBlur,
            maxZoom: 1,
            max: 1.0,
            minOpacity: 0.17,
            gradient: {
              0.15: 'rgba(254, 240, 138, 0.40)',
              0.40: 'rgba(250, 204, 21, 0.62)',
              0.65: 'rgba(245, 158, 11, 0.72)',
              0.85: 'rgba(217, 119, 6, 0.78)',
              1.00: 'rgba(180, 83, 9, 0.82)'
            }
          }).addTo(map)
        } else {
          layersRef.current.medium.setOptions({ radius: dynamicRadius - 2, blur: dynamicBlur, maxZoom: 1 })
          layersRef.current.medium.setLatLngs(mediumPoints)
        }
      } else if (layersRef.current.medium) {
        map.removeLayer(layersRef.current.medium)
        layersRef.current.medium = null
      }

      // 3. LOW SEVERITY (Emerald / Green / Soft Teal) - 12% reduced intensity
      if (lowPoints.length > 0) {
        if (!layersRef.current.low) {
          layersRef.current.low = L.heatLayer(lowPoints, {
            radius: dynamicRadius - 4,
            blur: dynamicBlur - 2,
            maxZoom: 1,
            max: 1.0,
            minOpacity: 0.14,
            gradient: {
              0.15: 'rgba(167, 243, 208, 0.36)',
              0.40: 'rgba(52, 211, 153, 0.58)',
              0.65: 'rgba(16, 185, 129, 0.68)',
              0.85: 'rgba(5, 150, 105, 0.74)',
              1.00: 'rgba(4, 120, 87, 0.78)'
            }
          }).addTo(map)
        } else {
          layersRef.current.low.setOptions({ radius: dynamicRadius - 4, blur: dynamicBlur - 2, maxZoom: 1 })
          layersRef.current.low.setLatLngs(lowPoints)
        }
      } else if (layersRef.current.low) {
        map.removeLayer(layersRef.current.low)
        layersRef.current.low = null
      }
    }

    renderLayers()
    map.on('zoomend', renderLayers)
    map.on('moveend', renderLayers)

    const activeLayers = layersRef.current
    return () => {
      map.off('zoomend', renderLayers)
      map.off('moveend', renderLayers)
      Object.keys(activeLayers).forEach((key) => {
        if (activeLayers[key] && map) {
          map.removeLayer(activeLayers[key])
          activeLayers[key] = null
        }
      })
    }
  }, [map, incidents, visible])

  return null
}
