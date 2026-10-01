import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["broadcast"])

_items: List[Dict] = []
TTL = timedelta(minutes=30)

DEFAULT_MSG = ("A high-risk public-safety incident is near your last known safety zone. "
               "Avoid the affected area and follow the official advisory.")


class BroadcastIn(BaseModel):
    message: Optional[str] = None
    severity: str = "HIGH"
    zone_id: Optional[str] = None      # None / "" / "string" = every opted-in citizen
    incident_id: Optional[str] = None


def _clean_zone(z: Optional[str]) -> Optional[str]:
    """Only a real 'lat_lon' grid id counts as a target. Anything else = everyone."""
    if not z:
        return None
    parts = z.strip().split("_")
    if len(parts) == 2 and all(p.lstrip("-").isdigit() for p in parts):
        return z.strip()
    return None


def _near(a: str, b: str) -> bool:
    """Same cell or any adjacent cell (about 5 km either way)."""
    try:
        a1, a2 = (int(x) for x in a.split("_"))
        b1, b2 = (int(x) for x in b.split("_"))
    except ValueError:
        return False
    return abs(a1 - b1) <= 1 and abs(a2 - b2) <= 1


@router.post("/broadcasts")
def send(b: BroadcastIn) -> Dict:
    item = {
        "id": int(time.time() * 1000),   # grows forever, survives backend restarts
        "message": (b.message or "").strip() or DEFAULT_MSG,
        "severity": (b.severity or "HIGH").upper(),
        "zone_id": _clean_zone(b.zone_id),
        "incident_id": None if b.incident_id in (None, "", "string") else b.incident_id,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    _items.append(item)
    del _items[:-50]
    return item


@router.get("/broadcasts/latest")
def latest(zone: Optional[str] = None) -> Dict:
    cutoff = datetime.now(timezone.utc) - TTL
    for item in reversed(_items):
        if datetime.fromisoformat(item["sent_at"]) < cutoff:
            break
        tz = item["zone_id"]
        if tz is None or (zone and _near(tz, zone)):
            return {"broadcast": item}
    return {"broadcast": None}


@router.delete("/broadcasts")
def clear() -> Dict:
    """Demo helper: wipe all alerts."""
    _items.clear()
    return {"cleared": True}