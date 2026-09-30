"""Advisories: authority publishes, backend stores, citizen app retrieves."""

from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import store

router = APIRouter(tags=["advisories"])


class AdvisoryRequest(BaseModel):
    incident_id: str
    message: str = Field(..., min_length=1)
    severity: Optional[str] = None
    issued_by: Optional[str] = "Authority"


@router.post("/advisories")
def create_advisory(payload: AdvisoryRequest) -> Dict:
    incident = store.get_incident(payload.incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {payload.incident_id} not found")

    severity = (payload.severity or incident.get("severity") or "MEDIUM").upper()
    advisory = {
        "id": store.next_advisory_id(),
        "incident_id": payload.incident_id,
        "message": payload.message,
        "severity": severity,
        "location": incident.get("location"),
        "latitude": incident.get("latitude"),
        "longitude": incident.get("longitude"),
        "issued_by": payload.issued_by or "Authority",
        "timestamp": datetime.now().strftime("%H:%M"),
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "status": "PUBLISHED",
    }
    store.add_advisory(advisory)
    store.add_evidence_event(
        payload.incident_id,
        {
            "time": advisory["timestamp"],
            "event": f"Official advisory published: {payload.message}",
            "source": advisory["issued_by"],
        },
    )
    return advisory


@router.get("/advisories")
def list_advisories(incident_id: Optional[str] = None) -> Dict[str, List[Dict]]:
    advisories = store.get_advisories()
    if incident_id:
        advisories = [a for a in advisories if a.get("incident_id") == incident_id]
    advisories.sort(key=lambda a: a.get("created_at", ""), reverse=True)
    return {"advisories": advisories}
