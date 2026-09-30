"""Public-safety news retrieval endpoint.

Incident/location specific only. Results are normalized source objects with
status ``REPORTED`` - they are corroboration, never proof on their own.
"""

from __future__ import annotations

from typing import Dict, Optional

from fastapi import APIRouter, Query

import news
import store

router = APIRouter(tags=["news"])


@router.get("/news")
def get_news(
    incident_id: Optional[str] = Query(default=None),
    location: Optional[str] = Query(default=None),
    intents: Optional[str] = Query(default=None, description="comma separated, e.g. CONGESTION"),
    limit: int = Query(default=5, ge=1, le=20),
) -> Dict:
    incident = store.get_incident(incident_id) if incident_id else None
    place = location or (incident or {}).get("location", "")
    intent_set = {item.strip().upper() for item in (intents or "").split(",") if item.strip()}
    if incident and not intent_set:
        # Infer the keyword family from the incident type.
        itype = (incident.get("type") or "").lower()
        if "crowd" in itype:
            intent_set = {"CONGESTION"}
        elif "accident" in itype:
            intent_set = {"ACCIDENT"}
        elif "baggage" in itype:
            intent_set = {"SUSPICIOUS_OBJECT"}

    result = news.fetch_news(place, intent_set, (incident or {}).get("type", ""), limit=limit)
    return {
        "incident_id": incident_id,
        "location": place,
        "queries": result["queries"],
        "providers": result["providers"],
        "items": result["items"],
        "note": "Live news is labelled REPORTED and never confirms an incident by itself.",
    }
