"""Demo scenario engine for the PS-06 Public Safety backend.

Provides curated, realistic Mumbai public-safety scenarios when no live
CV incidents are available (or as supplementary context alongside live
incidents). Scenarios evolve deterministically over a 30-minute window so
the Flutter app sees changing severity values on each poll — without any
live video required.

IMPORTANT: Demo incidents are NEVER labelled as live. Every record carries:
  live=False, demo=True, source_type="DEMO_DATASET"

Live CV incidents (produced by store.apply_camera_signals) carry:
  live=True, demo=False, source_type="CCTV_CV"
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Dict, List


# ---------------------------------------------------------------------------
# Scenario catalogue — realistic Mumbai public-safety contexts
# Each scenario specifies a 30-minute severity arc (index = minute bucket).
# ---------------------------------------------------------------------------

# (density, motion_anomaly, persistence, risk_score, severity)
_ARC_HIGH = [
    # minute 0-4
    (0.35, 0.40, 0.35, 0.37, "LOW"),
    # minute 5-9
    (0.52, 0.55, 0.50, 0.52, "MEDIUM"),
    # minute 10-14
    (0.70, 0.68, 0.70, 0.69, "HIGH"),
    # minute 15-19
    (0.78, 0.72, 0.80, 0.76, "HIGH"),
    # minute 20-24
    (0.62, 0.58, 0.65, 0.61, "MEDIUM"),
    # minute 25-29
    (0.41, 0.38, 0.42, 0.40, "LOW"),
]

_ARC_MEDIUM = [
    (0.28, 0.30, 0.25, 0.28, "LOW"),
    (0.42, 0.44, 0.40, 0.41, "MEDIUM"),
    (0.50, 0.48, 0.52, 0.50, "MEDIUM"),
    (0.55, 0.50, 0.58, 0.53, "MEDIUM"),
    (0.44, 0.42, 0.48, 0.44, "MEDIUM"),
    (0.30, 0.28, 0.32, 0.30, "LOW"),
]

_ARC_LOW = [
    (0.20, 0.22, 0.18, 0.20, "LOW"),
    (0.25, 0.26, 0.22, 0.24, "LOW"),
    (0.30, 0.28, 0.28, 0.29, "LOW"),
    (0.28, 0.25, 0.30, 0.27, "LOW"),
    (0.22, 0.20, 0.24, 0.21, "LOW"),
    (0.18, 0.17, 0.19, 0.18, "LOW"),
]


_SCENARIOS: List[Dict] = [
    {
        "id": "DEMO001",
        "event_name": "Ganpati Visarjan",
        "event_type": "Religious Procession",
        "type": "Crowd Anomaly",
        "location": "Girgaum Chowpatty",
        "city": "Mumbai",
        "latitude": 18.9545,
        "longitude": 72.8142,
        "zone_id": "zone_girgaum_chowpatty",
        "camera_ids": ["camera_01", "camera_02"],
        "base_confidence": 0.88,
        "arc": _ARC_HIGH,
        "status": "RECENT",
        "source_name": "Curated Event Dataset",
        "source_type": "DEMO_DATASET",
        "observed_at": "2026-09-25T18:30:00",
        "valid_from": "2026-09-25T00:00:00",
        "valid_until": "2026-09-25T23:59:59",
        "guidance": (
            "Ganesh Visarjan procession has concluded at Girgaum Chowpatty. "
            "Residual crowd activity may be present. Pedestrian movement is returning to normal."
        ),
    },
    {
        "id": "DEMO002",
        "event_name": "Political Rally",
        "event_type": "Public Rally",
        "type": "Crowd Anomaly",
        "location": "Azad Maidan",
        "city": "Mumbai",
        "latitude": 18.9392,
        "longitude": 72.8347,
        "zone_id": "zone_azad_maidan",
        "camera_ids": ["camera_01", "camera_02"],
        "base_confidence": 0.91,
        "arc": _ARC_HIGH,
        "status": "ACTIVE",
        "source_name": "Curated Event Dataset",
        "source_type": "DEMO_DATASET",
        "observed_at": None,  # filled at runtime
        "valid_from": None,
        "valid_until": None,
        "guidance": (
            "Large political rally active at Azad Maidan. CCTV analysis shows elevated crowd "
            "density and slowed movement. Avoid the area. Use alternate routes via CST Road."
        ),
    },
    {
        "id": "DEMO003",
        "event_name": "Festival Gathering",
        "event_type": "Cultural Festival",
        "type": "Crowd Anomaly",
        "location": "Lalbaug",
        "city": "Mumbai",
        "latitude": 18.9648,
        "longitude": 72.8358,
        "zone_id": "zone_lalbaug",
        "camera_ids": ["camera_01"],
        "base_confidence": 0.85,
        "arc": _ARC_MEDIUM,
        "status": "ACTIVE",
        "source_name": "Curated Event Dataset",
        "source_type": "DEMO_DATASET",
        "observed_at": None,
        "valid_from": None,
        "valid_until": None,
        "guidance": (
            "Festival gathering detected near Lalbaug. Moderate crowd activity. "
            "Pedestrian movement is slower than normal. Allow extra travel time."
        ),
    },
    {
        "id": "DEMO004",
        "event_name": "Traffic Accident",
        "event_type": "Road Incident",
        "type": "Traffic Disruption",
        "location": "Marine Drive Junction",
        "city": "Mumbai",
        "latitude": 18.9436,
        "longitude": 72.8237,
        "zone_id": "zone_marine_drive",
        "camera_ids": ["camera_02"],
        "base_confidence": 0.87,
        "arc": _ARC_MEDIUM,
        "status": "ACTIVE",
        "source_name": "Curated Event Dataset",
        "source_type": "DEMO_DATASET",
        "observed_at": None,
        "valid_from": None,
        "valid_until": None,
        "guidance": (
            "Traffic disruption near Marine Drive Junction. Lane restrictions reported. "
            "Expect delays. Use Netaji Subhash Chandra Bose Road as alternate route."
        ),
    },
    {
        "id": "DEMO005",
        "event_name": "Unattended Baggage",
        "event_type": "Security Alert",
        "type": "Unattended Object",
        "location": "CSMT",
        "city": "Mumbai",
        "latitude": 18.9398,
        "longitude": 72.8355,
        "zone_id": "zone_csmt",
        "camera_ids": ["camera_01"],
        "base_confidence": 0.82,
        "arc": _ARC_LOW,
        "status": "ACTIVE",
        "source_name": "Curated Event Dataset",
        "source_type": "DEMO_DATASET",
        "observed_at": None,
        "valid_from": None,
        "valid_until": None,
        "guidance": (
            "Unattended baggage reported at CSMT. Railway Police on site. "
            "Avoid Platform 4. Follow station staff instructions."
        ),
    },
    {
        "id": "DEMO006",
        "event_name": "Public Concert",
        "event_type": "Public Event",
        "type": "Crowd Anomaly",
        "location": "NCPA, Nariman Point",
        "city": "Mumbai",
        "latitude": 18.9256,
        "longitude": 72.8194,
        "zone_id": "zone_ncpa",
        "camera_ids": ["camera_02"],
        "base_confidence": 0.80,
        "arc": _ARC_LOW,
        "status": "PLANNED",
        "source_name": "Curated Event Dataset",
        "source_type": "DEMO_DATASET",
        "observed_at": None,
        "valid_from": None,
        "valid_until": None,
        "guidance": (
            "Public concert scheduled at NCPA this evening. Expect increased pedestrian "
            "activity around Nariman Point. Plan additional travel time."
        ),
    },
    {
        "id": "DEMO007",
        "event_name": "Dadar Market Rush",
        "event_type": "Daily Crowd Peak",
        "type": "Crowd Anomaly",
        "location": "Dadar West",
        "city": "Mumbai",
        "latitude": 19.0178,
        "longitude": 72.8478,
        "zone_id": "zone_dadar_west",
        "camera_ids": ["camera_01"],
        "base_confidence": 0.83,
        "arc": _ARC_MEDIUM,
        "status": "ACTIVE",
        "source_name": "Curated Event Dataset",
        "source_type": "DEMO_DATASET",
        "observed_at": None,
        "valid_from": None,
        "valid_until": None,
        "guidance": (
            "Evening market rush at Dadar West. High pedestrian density near the market area. "
            "CCTV shows crowd movement slowing. Exercise caution."
        ),
    },
    {
        "id": "DEMO008",
        "event_name": "Transit Disruption",
        "event_type": "Rail Incident",
        "type": "Transit Disruption",
        "location": "Bandra Station",
        "city": "Mumbai",
        "latitude": 19.0543,
        "longitude": 72.8403,
        "zone_id": "zone_bandra",
        "camera_ids": ["camera_02"],
        "base_confidence": 0.86,
        "arc": _ARC_MEDIUM,
        "status": "ACTIVE",
        "source_name": "Curated Event Dataset",
        "source_type": "DEMO_DATASET",
        "observed_at": None,
        "valid_from": None,
        "valid_until": None,
        "guidance": (
            "Passenger congestion at Bandra Station due to delayed services. "
            "Allow extra time. Consider Andheri or Dadar as alternate boarding points."
        ),
    },
]


# ---------------------------------------------------------------------------
# Arc interpolation — deterministic based on current minute-of-hour
# ---------------------------------------------------------------------------

def _arc_index() -> int:
    """Returns the 5-minute bucket index (0-5) based on current minute-of-hour."""
    minute = datetime.now(timezone.utc).minute
    return (minute // 5) % 6


def _lerp(a: float, b: float, t: float) -> float:
    return round(a + (b - a) * t, 3)


def _interpolate_arc(arc: List, minute: int) -> Dict:
    """Smoothly interpolate between two arc buckets within the current 5-min window."""
    bucket = (minute // 5) % 6
    next_bucket = (bucket + 1) % 6
    t = (minute % 5) / 5.0  # 0.0 → 1.0 within the bucket

    cur = arc[bucket]
    nxt = arc[next_bucket]

    density = _lerp(cur[0], nxt[0], t)
    motion_anomaly = _lerp(cur[1], nxt[1], t)
    persistence = _lerp(cur[2], nxt[2], t)
    risk_score = _lerp(cur[3], nxt[3], t)
    severity = cur[4]  # severity steps at bucket boundary, not interpolated

    # Derive confidence: higher with better signal quality
    noise = math.sin(minute * 0.7) * 0.02  # ±2% jitter
    confidence = min(0.97, max(0.65, 0.75 + density * 0.22 + noise))

    return {
        "density": round(density * 100),   # store as 0-100 int (same as CV engine)
        "velocity": round(1.0 - motion_anomaly, 2),
        "risk_score": risk_score,
        "severity": severity,
        "confidence": round(confidence, 2),
        "factors": {
            "density": round(density, 3),
            "motion_anomaly": round(motion_anomaly, 3),
            "persistence": round(persistence, 3),
            "citizen_reports": 0.45,  # neutral baseline for demo
        },
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_demo_incidents(live_incident_ids: set[str] | None = None) -> List[Dict]:
    """Return all demo incidents with current arc-interpolated risk values.

    Parameters
    ----------
    live_incident_ids:
        Set of incident IDs already covered by live CV data. Demo incidents
        whose IDs overlap are suppressed so LIVE always wins.
    """
    now = datetime.now(timezone.utc)
    minute = now.minute
    now_iso = now.strftime("%Y-%m-%dT%H:%M:%S")
    live_ids = live_incident_ids or set()

    results = []
    for scenario in _SCENARIOS:
        if scenario["id"] in live_ids:
            continue  # live data takes precedence

        arc_values = _interpolate_arc(scenario["arc"], minute)

        severity = arc_values["severity"]
        status = scenario["status"]

        # Determine display status from scenario status + live flag
        if status == "RECENT":
            display_status = "RECENT"
        elif status == "PLANNED":
            display_status = "PLANNED"
        else:
            display_status = "ACTIVE"

        # Build explanation string
        top_factor = "crowd density" if arc_values["factors"]["density"] > 0.55 else "movement patterns"
        explanation = (
            f"{severity} risk score {arc_values['risk_score']:.2f} "
            f"driven by {top_factor} — DEMO SCENARIO."
        )

        incident = {
            "id": scenario["id"],
            "event_name": scenario["event_name"],
            "event_type": scenario["event_type"],
            "type": scenario["type"],
            "location": scenario["location"],
            "city": scenario["city"],
            "latitude": scenario["latitude"],
            "longitude": scenario["longitude"],
            "zone_id": scenario["zone_id"],
            "camera_ids": scenario["camera_ids"],
            # Arc-driven values (change every minute)
            "severity": arc_values["severity"],
            "risk_score": arc_values["risk_score"],
            "confidence": arc_values["confidence"],
            "density": arc_values["density"],
            "velocity": arc_values["velocity"],
            "factors": arc_values["factors"],
            # Status / lifecycle
            "status": display_status,
            "timestamp": now_iso,
            "updated_at": now_iso,
            # Source provenance
            "source_name": scenario["source_name"],
            "source_type": scenario["source_type"],
            "observed_at": scenario.get("observed_at") or now_iso,
            "valid_from": scenario.get("valid_from") or now_iso,
            "valid_until": scenario.get("valid_until"),
            # Explicit live/demo flags — never mislead
            "live": False,
            "demo": True,
            # Human context
            "guidance": scenario["guidance"],
            "explanation": explanation,
        }
        results.append(incident)

    return results


def is_demo_mode(live_incident_ids: set[str] | None = None) -> bool:
    """Returns True when no live CV incidents exist (full demo mode)."""
    return not live_incident_ids
