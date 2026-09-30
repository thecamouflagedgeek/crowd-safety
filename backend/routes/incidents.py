"""Incident read endpoints shared by the citizen app and the authority dashboard."""

from __future__ import annotations

from typing import Dict, List

from fastapi import APIRouter, HTTPException

import store

router = APIRouter(tags=["incidents"])


@router.get("/incidents")
def list_incidents() -> Dict[str, List[Dict]]:
    return {"incidents": store.get_incidents()}


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str) -> Dict:
    incident = store.get_incident(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    incident["claims"] = store.get_claims(incident_id)
    incident["advisories"] = [a for a in store.get_advisories() if a.get("incident_id") == incident_id]
    return incident
