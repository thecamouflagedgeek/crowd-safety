"""Safe-route recommendation.

Tries OSRM for a real distance/duration when a routing service is configured and
reachable. Always returns a deterministic, named fallback route so citizens get
usable guidance with no external dependency.
"""

from __future__ import annotations

import os
from typing import Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import store

router = APIRouter(tags=["route"])

# Deterministic safe alternates per incident (prototype map knowledge).
SAFE_ALTERNATES = {
    "INC001": {"destination": "Gate 5", "via": ["Road B", "Gate 5"]},
    "INC002": {"destination": "Link Road", "via": ["Service Lane", "Link Road"]},
    "INC003": {"destination": "Platform 1 Exit", "via": ["Overbridge", "Platform 1 Exit"]},
}
DEFAULT_ALTERNATE = {"destination": "Nearest Safe Point", "via": ["Alternate Road", "Nearest Safe Point"]}


class RouteRequest(BaseModel):
    incident_id: str
    user_lat: Optional[float] = None
    user_lon: Optional[float] = None


def _osrm_route(user_lat: float, user_lon: float, dest_lat: float, dest_lon: float) -> Optional[Dict]:
    if os.getenv("ROUTING_ENABLED", "1") != "1":
        return None
    base = os.getenv("OSRM_BASE_URL", "").rstrip("/")
    if not base:
        return None
    url = f"{base}/route/v1/driving/{user_lon},{user_lat};{dest_lon},{dest_lat}"
    try:
        response = httpx.get(url, params={"overview": "false", "steps": "false"}, timeout=2.5)
        response.raise_for_status()
        data = response.json()
        route = (data.get("routes") or [None])[0]
        if not route:
            return None
        return {"distance_m": route.get("distance"), "duration_s": route.get("duration")}
    except Exception:
        return None


@router.post("/route")
def safe_route(payload: RouteRequest) -> Dict:
    incident = store.get_incident(payload.incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {payload.incident_id} not found")

    alternate = SAFE_ALTERNATES.get(payload.incident_id, DEFAULT_ALTERNATE)
    route_path: List[str] = ["Current Location", *alternate["via"]]

    severity = incident.get("severity", "UNKNOWN")
    recommended = severity in ("HIGH", "CRITICAL") or incident.get("type") == "Traffic Accident"

    osrm = None
    if payload.user_lat is not None and payload.user_lon is not None:
        # Approximate the safe destination by shifting away from the incident.
        dest_lat = incident.get("latitude", payload.user_lat) + 0.006
        dest_lon = incident.get("longitude", payload.user_lon) + 0.006
        osrm = _osrm_route(payload.user_lat, payload.user_lon, dest_lat, dest_lon)

    reason = (
        f"{incident.get('location')} currently has {severity} "
        f"{incident.get('type', 'risk').lower()} risk."
    )

    return {
        "recommended": recommended,
        "incident_id": payload.incident_id,
        "route": route_path,
        "reason": reason,
        "destination": alternate["destination"],
        "severity": severity,
        "distance_m": osrm.get("distance_m") if osrm else None,
        "duration_s": osrm.get("duration_s") if osrm else None,
        "routing_engine": "osrm" if osrm else "deterministic_fallback",
    }
