"""
CrowdSafe - Resilient Geo-Alert Sync (backend)

Opt-in, purpose-limited safety-zone sync -> match HIGH/CRITICAL incident geo-zones
-> push + SMS fallback. Stores ONE coarse zone per user with an expiry; no movement history.

Wire-up in main.py:
    from geo_alerts import router as geo_router, configure, dispatch_for_incident, purge_expired
    app.include_router(geo_router)
    configure(incidents_fn=lambda: list_incidents_as_dicts(),
              advisories_fn=lambda: list_advisories_as_dicts())
    # call dispatch_for_incident(incident_dict) whenever an incident is created or its
    # severity changes (it de-duplicates per incident/user/severity, so re-calling is safe)
    # call purge_expired() on a timer (e.g. every minute)

Storage here is in-memory so the demo runs anywhere. Swap CITIZENS / OUTBOX / REPORTS
for Redis or a DB table with a TTL index for anything beyond a demo.
"""
from __future__ import annotations

import math
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

IST = timezone(timedelta(hours=5, minutes=30))
CELL_DEG = 0.05            # ~5.5 km grid cell. MUST match kZoneCellDeg in the Flutter app.
SYNC_TTL_S = 30 * 60       # a synced zone is trusted for 30 min, then ignored/purged
SEVERITY_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
ALERT_MIN_RANK = SEVERITY_RANK["HIGH"]

# ---------------------------------------------------------------- zone helpers


def zone_id(lat: float, lon: float) -> str:
    return f"{math.floor(lat / CELL_DEG)}_{math.floor(lon / CELL_DEG)}"


def zones_within(lat: float, lon: float, radius_km: float) -> set[str]:
    """Every grid cell touching the incident's bounding box (errs on the side of alerting)."""
    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * max(math.cos(math.radians(lat)), 0.01))
    out: set[str] = set()
    for i in range(math.floor((lat - dlat) / CELL_DEG), math.floor((lat + dlat) / CELL_DEG) + 1):
        for j in range(math.floor((lon - dlon) / CELL_DEG), math.floor((lon + dlon) / CELL_DEG) + 1):
            out.add(f"{i}_{j}")
    return out


# ---------------------------------------------------------------------- state


@dataclass
class Citizen:
    user_id: str
    zone_id: str
    synced_at: float
    expires_at: float
    push_token: Optional[str] = None
    sms_number: Optional[str] = None   # only set if the user opted into SMS (verify via OTP first)


CITIZENS: dict[str, Citizen] = {}
ALERT_LOG: set[tuple[str, str, str]] = set()   # (incident_id, user_id, severity) -> de-dup
OUTBOX: list[dict] = []                        # what we sent; also powers in-app alerts + demo view
REPORTS: dict[str, dict] = {}                  # client_id -> report (idempotent offline uploads)

_providers: dict[str, Callable[[], list]] = {"incidents": lambda: [], "advisories": lambda: []}


def configure(incidents_fn: Callable[[], list], advisories_fn: Callable[[], list]) -> None:
    _providers["incidents"] = incidents_fn
    _providers["advisories"] = advisories_fn


# ------------------------------------------------------------------ channels
# Replace the bodies with FCM (firebase_admin.messaging) and an SMS provider
# (Twilio / MSG91). In India, commercial SMS needs a DLT-registered sender and template.


def send_push(token: str, title: str, body: str, incident_id: str) -> bool:
    print(f"[PUSH simulated] -> {token[:10]}...: {title} | {body}")
    return True


def send_sms(number: str, text: str) -> bool:
    print(f"[SMS simulated] -> {mask(number)}:\n{text}")
    return True


def mask(number: str) -> str:
    return f"{number[:3]}••••{number[-4:]}" if len(number) > 7 else "••••"


def sms_text(updated: str) -> str:
    return (
        "CROWDSAFE ALERT\n\n"
        "High-risk public-safety incident near your last known safety zone.\n\n"
        "Avoid the affected area. Follow official instructions.\n\n"
        f"Updated: {updated}"
    )


PUSH_BODY = (
    "A high-risk public-safety incident is near your last known safety zone. "
    "Avoid the affected area and follow the official advisory."
)

# ----------------------------------------------------------------- dispatcher


def dispatch_for_incident(incident: dict) -> list[dict]:
    sev = str(incident.get("severity", "")).upper()
    if SEVERITY_RANK.get(sev, 0) < ALERT_MIN_RANK:
        return []
    lat = incident.get("latitude", incident.get("lat"))
    lon = incident.get("longitude", incident.get("lon"))
    if lat is None or lon is None:
        return []

    zones = zones_within(float(lat), float(lon), float(incident.get("radius_km", 2.0)))
    now = time.time()
    stamp = datetime.now(IST).strftime("%H:%M")
    sent: list[dict] = []

    for c in list(CITIZENS.values()):
        if c.expires_at < now or c.zone_id not in zones:
            continue
        key = (str(incident["id"]), c.user_id, sev)
        if key in ALERT_LOG:
            continue
        ALERT_LOG.add(key)

        channels = ["in_app"]  # always available: the app pulls it via /sync/snapshot
        push_ok = bool(c.push_token) and send_push(c.push_token, "CrowdSafe alert", PUSH_BODY, str(incident["id"]))
        if push_ok:
            channels.append("push")
        # SMS fallback: push unavailable/failed, or CRITICAL where we double up on purpose
        if c.sms_number and (not push_ok or sev == "CRITICAL"):
            if send_sms(c.sms_number, sms_text(stamp)):
                channels.append("sms")

        rec = {
            "id": uuid.uuid4().hex[:10],
            "incident_id": str(incident["id"]),
            "user_id": c.user_id,
            "severity": sev,
            "channels": channels,
            "sms_to": mask(c.sms_number) if "sms" in channels and c.sms_number else None,
            "message": PUSH_BODY,
            "sent_at": stamp,
        }
        OUTBOX.append(rec)
        sent.append(rec)

    del OUTBOX[:-1000]
    return sent


def purge_expired() -> int:
    now = time.time()
    dead = [u for u, c in CITIZENS.items() if c.expires_at < now]
    for u in dead:
        del CITIZENS[u]
    return len(dead)


# ------------------------------------------------------------------ endpoints


class SyncIn(BaseModel):
    user_id: str
    zone_id: str
    alert_enabled: bool
    push_token: Optional[str] = None
    sms_number: Optional[str] = None


class ReportIn(BaseModel):
    client_id: str
    text: str
    zone_id: Optional[str] = None
    created_at: Optional[str] = None


@router.post("/citizens/sync")
def citizen_sync(body: SyncIn):
    if not body.alert_enabled:
        CITIZENS.pop(body.user_id, None)
        return {"ok": True, "stored": False}
    now = time.time()
    # upsert a single row per user: no history is kept
    CITIZENS[body.user_id] = Citizen(
        user_id=body.user_id,
        zone_id=body.zone_id,
        synced_at=now,
        expires_at=now + SYNC_TTL_S,
        push_token=body.push_token,
        sms_number=body.sms_number,
    )
    return {"ok": True, "stored": True, "valid_until": now + SYNC_TTL_S, "server_time": now}


@router.delete("/citizens/{user_id}")
def citizen_delete(user_id: str):
    """Opt-out / erasure."""
    CITIZENS.pop(user_id, None)
    OUTBOX[:] = [a for a in OUTBOX if a["user_id"] != user_id]
    for k in [k for k in ALERT_LOG if k[1] == user_id]:
        ALERT_LOG.discard(k)
    return {"ok": True}


@router.get("/sync/snapshot")
def sync_snapshot(user_id: Optional[str] = None, zone_id: Optional[str] = None):
    alerts = [a for a in OUTBOX if a["user_id"] == user_id][-5:] if user_id else []
    return {
        "server_time": time.time(),
        "incidents": _providers["incidents"](),
        "advisories": _providers["advisories"](),
        "alerts": alerts,
    }


@router.post("/reports/batch")
def reports_batch(items: list[ReportIn]):
    """Idempotent: the same client_id uploaded twice is stored once."""
    for r in items:
        REPORTS.setdefault(r.client_id, r.model_dump())
    return {"accepted": [r.client_id for r in items]}


# ------------------------------------------------------------- demo helpers


@router.get("/alerts/outbox")
def alerts_outbox():
    """Demo/authority view of what was sent. Phone numbers are masked."""
    return OUTBOX[-50:]


@router.post("/alerts/simulate")
def alerts_simulate(incident: dict):
    """Demo only: fire the dispatcher for a hand-made incident. Remove or protect in production."""
    return {"sent": dispatch_for_incident(incident)}