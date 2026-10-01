"""Incident read endpoints shared by the citizen app and the authority dashboard.

Response shape (GET /incidents):
  {
    "incidents": [...],
    "mode": "live" | "demo" | "mixed",
    "live_count": int,
    "demo_count": int
  }

Live CV incidents (live=True) always take priority.
When no live incidents exist, the demo engine provides curated realistic scenarios.
When both exist, they are merged — clearly flagged by their live/demo fields.
"""

from __future__ import annotations

import logging
from typing import Dict, List

from fastapi import APIRouter, HTTPException

import demo_engine
import store

logger = logging.getLogger("incidents")

router = APIRouter(tags=["incidents"])


def _enrich_seed(incident: Dict) -> Dict:
    """Add provenance metadata to seed incidents that lack it (backwards-compatible)."""
    inc = dict(incident)

    # Provenance — only set if not already present
    if "source_type" not in inc:
        if inc.get("live"):
            inc.setdefault("source_name", "CCTV Camera")
            inc.setdefault("source_type", "CCTV_CV")
        else:
            inc.setdefault("source_name", "Seed Dataset")
            inc.setdefault("source_type", "SEED_DATA")

    # Ensure demo flag is explicit
    inc.setdefault("demo", False)

    # Ensure event_name / event_type — derive from type if absent
    if "event_name" not in inc or not inc["event_name"]:
        inc["event_name"] = inc.get("type", "Incident")
    if "event_type" not in inc or not inc["event_type"]:
        # Infer a broad category
        t = (inc.get("type") or "").lower()
        if "crowd" in t or "visarjan" in t or "protest" in t or "rally" in t or "event" in t:
            inc["event_type"] = "Crowd Event"
        elif "traffic" in t or "accident" in t or "transit" in t or "disruption" in t:
            inc["event_type"] = "Traffic / Transit"
        elif "baggage" in t or "object" in t or "security" in t:
            inc["event_type"] = "Security Alert"
        else:
            inc["event_type"] = "Public Safety"

    # city — default to Mumbai (all seeds are Mumbai)
    inc.setdefault("city", "Mumbai")

    return inc


@router.get("/incidents")
def list_incidents() -> Dict[str, object]:
    """Return live incidents merged with demo scenarios.

    Priority:
      1. Live CV incidents (live=True) — always included
      2. Demo scenarios (demo=True) — included unless a live incident has the same ID
    """
    # ── 1. Fetch current live/seed incidents from store ──────────────────
    raw_incidents: List[Dict] = store.get_incidents()

    # Separate live (CV-updated) from seed-only
    live_incidents: List[Dict] = []
    seed_only: List[Dict] = []
    for inc in raw_incidents:
        enriched = _enrich_seed(inc)
        if enriched.get("live"):
            live_incidents.append(enriched)
        else:
            seed_only.append(enriched)

    live_ids = {i["id"] for i in live_incidents}

    # ── 2. Get demo scenarios (suppresses any that clash with live IDs) ──
    demo_incidents = demo_engine.get_demo_incidents(live_incident_ids=live_ids)

    # ── 3. Build combined list ────────────────────────────────────────────
    # Live CV incidents take the top slots.
    # Seed-only (not yet touched by CV) come next.
    # Demo scenarios fill out the list (skip any whose ID is already present).
    existing_ids = live_ids | {i["id"] for i in seed_only}
    filtered_demo = [d for d in demo_incidents if d["id"] not in existing_ids]

    combined = live_incidents + seed_only + filtered_demo

    # ── 4. Determine data mode for the client ─────────────────────────────
    live_count = len(live_incidents)
    demo_count = len(filtered_demo)

    if live_count > 0 and demo_count == 0:
        mode = "live"
    elif live_count == 0 and demo_count > 0:
        mode = "demo"
    elif live_count > 0 and demo_count > 0:
        mode = "mixed"
    else:
        mode = "seed"

    logger.info(
        "[incidents] mode=%s live=%d seed=%d demo=%d total=%d",
        mode,
        live_count,
        len(seed_only),
        demo_count,
        len(combined),
    )

    return {
        "incidents": combined,
        "mode": mode,
        "live_count": live_count,
        "demo_count": demo_count,
    }


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str) -> Dict:
    """Authoritative detail for one incident, merged with live CV telemetry."""
    # Check store first (live/seed incidents)
    incident = store.get_incident(incident_id)

    if incident is None:
        # Check demo engine
        demo_list = demo_engine.get_demo_incidents()
        incident = next((d for d in demo_list if d["id"] == incident_id), None)

    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    incident = _enrich_seed(dict(incident))
    incident["claims"] = store.get_claims(incident_id)
    incident["advisories"] = [
        a for a in store.get_advisories() if a.get("incident_id") == incident_id
    ]
    return incident
