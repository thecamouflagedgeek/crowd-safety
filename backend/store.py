"""Thread-safe, JSON-backed state store.

Holds the seeded demo data and merges live computer-vision observations into the
incident objects. Saving is best-effort: a failed write never crashes the API.
"""

from __future__ import annotations

import json
import threading
from datetime import datetime, time as datetime_time
from pathlib import Path
from typing import Dict, List, Optional

from cv import risk_engine

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

_LOCK = threading.RLock()

_incidents: Dict[str, Dict] = {}
_claims: Dict[str, Dict] = {}
_sources: Dict[str, Dict] = {}
_evidence: Dict[str, List[Dict]] = {}
_evidence_records: Dict[str, Dict] = {}
_advisories: Dict[str, Dict] = {}
_zones: Dict[str, Dict] = {}

# camera_id -> latest CV observation
_camera_observations: Dict[str, Dict] = {}

# Per-incident persistence window (list of per-camera density readings).
_persistence_window: Dict[str, List[float]] = {}
_PERSISTENCE_SIZE = 25

# Seeded citizen-report baseline, captured once so live updates cannot ratchet it.
_report_baseline: Dict[str, float] = {}
_REPORT_DEFAULT = 0.5


def _read_json(name: str, default):
    path = DATA_DIR / name
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return default


def _write_json(name: str, payload) -> bool:
    path = DATA_DIR / name
    try:
        with _LOCK:
            with path.open("w", encoding="utf-8") as handle:
                json.dump(payload, handle, indent=2, ensure_ascii=False)
        return True
    except Exception:
        return False


def load_all() -> None:
    with _LOCK:
        _incidents.clear()
        _report_baseline.clear()
        for item in _read_json("incidents.json", []):
            _incidents[item["id"]] = item
            _report_baseline[item["id"]] = float(
                item.get("factors", {}).get("citizen_reports", _REPORT_DEFAULT)
            )
        _claims.clear()
        for item in _read_json("claims.json", []):
            _claims[item["id"]] = item
        _sources.clear()
        for item in _read_json("sources.json", []):
            _sources[item["id"]] = item
        _evidence.clear()
        _evidence.update(_read_json("evidence.json", {}))
        _evidence_records.clear()
        _evidence_records.update(_read_json("evidence_records.json", {}))
        _advisories.clear()
        for item in _read_json("advisories.json", []):
            _advisories[item["id"]] = item
        _zones.clear()
        _zones.update(_read_json("zones.json", {}))


# --------------------------------------------------------------------- incidents
def get_incidents() -> List[Dict]:
    with _LOCK:
        return [dict(item) for item in _incidents.values()]


def get_incident(incident_id: str) -> Optional[Dict]:
    with _LOCK:
        item = _incidents.get(incident_id)
        return dict(item) if item else None


def find_incident_for_location(location: str) -> Optional[Dict]:
    if not location:
        return None
    target = location.strip().lower()
    with _LOCK:
        for item in _incidents.values():
            if item.get("location", "").strip().lower() == target:
                return dict(item)
        for item in _incidents.values():
            if target and target in item.get("location", "").strip().lower():
                return dict(item)
    return None


# ------------------------------------------------------------------ live CV merge
def _report_score_for(incident: Dict) -> float:
    """Citizen-report signal: seeded baseline plus verified citizen sources."""
    base = _report_baseline.get(incident["id"], _REPORT_DEFAULT)
    with _LOCK:
        citizen = [
            s
            for s in _sources.values()
            if s.get("incident_id") == incident["id"] and s.get("source") == "Citizen"
        ]
    confirmed = sum(1 for s in citizen if s.get("status") in ("CONFIRMED", "VERIFIED"))
    score = base + 0.03 * confirmed
    return max(0.0, min(1.0, score))


def apply_camera_signals(
    camera_id: str, incident_id: str, signals: Dict, raw: Dict
) -> Optional[Dict]:
    """Record one CV observation and re-derive the incident risk."""
    with _LOCK:
        _camera_observations[camera_id] = {
            "camera_id": camera_id,
            "incident_id": incident_id,
            "signals": dict(signals),
            "raw": dict(raw),
            "updated_at": datetime.now().strftime("%H:%M:%S"),
        }

        if incident_id not in _incidents:
            return None

        # Aggregate all cameras currently feeding this incident.
        peers = [
            obs
            for obs in _camera_observations.values()
            if obs["incident_id"] == incident_id
        ]
        if not peers:
            return None

        density = sum(p["signals"]["density"] for p in peers) / len(peers)
        motion = max(p["signals"]["motion_anomaly"] for p in peers)
        velocity = sum(p["signals"]["velocity"] for p in peers) / len(peers)

        window = _persistence_window.setdefault(incident_id, [])
        window.append(density)
        if len(window) > _PERSISTENCE_SIZE:
            del window[: len(window) - _PERSISTENCE_SIZE]
        persistence = sum(1 for value in window if value >= 0.4) / max(1, len(window))

        incident = _incidents[incident_id]
        report = _report_score_for(incident)

        result = risk_engine.compute_risk(density, motion, persistence, report)

        incident["severity"] = result["severity"]
        incident["risk_score"] = result["risk_score"]
        incident["factors"] = result["factors"]
        incident["density"] = int(round(density * 100))
        incident["velocity"] = round(velocity, 2)
        incident["confidence"] = round(
            min(0.97, 0.62 + 0.35 * max(density, motion)), 2
        )
        incident["updated_at"] = datetime.now().strftime("%H:%M:%S")
        incident["explanation"] = result["explanation"]
        incident["live"] = True
        return dict(incident)


def save_incidents() -> None:
    with _LOCK:
        _write_json("incidents.json", list(_incidents.values()))


def get_camera_observations() -> List[Dict]:
    with _LOCK:
        return [dict(obs) for obs in _camera_observations.values()]


# ------------------------------------------------------------------------ claims
def get_claims(incident_id: Optional[str] = None) -> List[Dict]:
    with _LOCK:
        items = list(_claims.values())
    if incident_id:
        items = [c for c in items if c.get("incident_id") == incident_id]
    return [dict(c) for c in items]


def get_claim(claim_id: str) -> Optional[Dict]:
    with _LOCK:
        item = _claims.get(claim_id)
        return dict(item) if item else None


def add_claim(claim: Dict) -> Dict:
    with _LOCK:
        _claims[claim["id"]] = claim
        _write_json("claims.json", list(_claims.values()))
        return dict(claim)


def update_claim(claim_id: str, **fields) -> Optional[Dict]:
    with _LOCK:
        item = _claims.get(claim_id)
        if not item:
            return None
        item.update(fields)
        item["updated_at"] = datetime.now().strftime("%H:%M:%S")
        _write_json("claims.json", list(_claims.values()))
        return dict(item)


def next_claim_id() -> str:
    with _LOCK:
        index = len(_claims) + 1
        while f"CLM{index:03d}" in _claims:
            index += 1
        return f"CLM{index:03d}"


# ----------------------------------------------------------------------- sources
def get_sources(incident_id: Optional[str] = None) -> List[Dict]:
    with _LOCK:
        items = list(_sources.values())
    if incident_id:
        items = [s for s in items if s.get("incident_id") == incident_id]
    return [dict(s) for s in items]


def update_source(source_id: str, **fields) -> Optional[Dict]:
    with _LOCK:
        item = _sources.get(source_id)
        if not item:
            return None
        item.update(fields)
        _write_json("sources.json", list(_sources.values()))
        return dict(item)


def add_source(source: Dict) -> Dict:
    with _LOCK:
        _sources[source["id"]] = source
        _write_json("sources.json", list(_sources.values()))
        return dict(source)


# ---------------------------------------------------------------------- evidence
def get_evidence(incident_id: str) -> List[Dict]:
    with _LOCK:
        return [dict(e) for e in _evidence.get(incident_id, [])]


def add_evidence_event(incident_id: str, event: Dict) -> None:
    with _LOCK:
        _evidence.setdefault(incident_id, []).append(event)
        _write_json("evidence.json", _evidence)


def merge_into_timeline(incident_id: str, events: List[Dict]) -> List[Dict]:
    """Append evidence observations without replacing prior incident history."""
    with _LOCK:
        timeline = _evidence.setdefault(incident_id, [])
        known = {item.get("id") for item in timeline}
        timeline.extend(event for event in events if event.get("id") not in known)
        def chronological_key(item):
            value = item.get("occurred_at") or item.get("timestamp") or item.get("time", "")
            try:
                parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
                return (parsed.date().isoformat(), parsed.hour, parsed.minute, parsed.second)
            except (ValueError, TypeError):
                try:
                    parsed_time = datetime_time.fromisoformat(str(value))
                    return (datetime.now().date().isoformat(), parsed_time.hour, parsed_time.minute, parsed_time.second)
                except (ValueError, TypeError):
                    return ("9999-12-31", 23, 59, 59)
        timeline.sort(key=chronological_key)
        _write_json("evidence.json", _evidence)
        return [dict(event) for event in timeline]


def add_evidence_record(record: Dict) -> Dict:
    with _LOCK:
        _evidence_records[record["evidence_id"]] = record
        _write_json("evidence_records.json", _evidence_records)
        return dict(record)


def get_evidence_record(evidence_id: str) -> Optional[Dict]:
    with _LOCK:
        record = _evidence_records.get(evidence_id)
        return dict(record) if record else None


def update_evidence_record(evidence_id: str, **fields) -> Optional[Dict]:
    with _LOCK:
        record = _evidence_records.get(evidence_id)
        if not record:
            return None
        record.update(fields)
        _write_json("evidence_records.json", _evidence_records)
        return dict(record)


def get_evidence_records(incident_id: str) -> List[Dict]:
    with _LOCK:
        return [dict(item) for item in _evidence_records.values() if item.get("incident_id") == incident_id]


def next_evidence_id() -> str:
    with _LOCK:
        index = len(_evidence_records) + 1
        while f"EVD-{index:04d}" in _evidence_records:
            index += 1
        return f"EVD-{index:04d}"


# --------------------------------------------------------------------- advisories
def get_advisories() -> List[Dict]:
    with _LOCK:
        return [dict(a) for a in _advisories.values()]


def get_advisory(advisory_id: str) -> Optional[Dict]:
    with _LOCK:
        item = _advisories.get(advisory_id)
        return dict(item) if item else None


def add_advisory(advisory: Dict) -> Dict:
    with _LOCK:
        _advisories[advisory["id"]] = advisory
        _write_json("advisories.json", list(_advisories.values()))
        return dict(advisory)


def next_advisory_id() -> str:
    with _LOCK:
        index = len(_advisories) + 1
        while f"ADV{index:03d}" in _advisories:
            index += 1
        return f"ADV{index:03d}"


# -------------------------------------------------------------------------- zones
def get_zones() -> List[Dict]:
    with _LOCK:
        return [dict(z) for z in _zones.values()]


def get_zone(zone_id: str) -> Optional[Dict]:
    with _LOCK:
        item = _zones.get(zone_id)
        return dict(item) if item else None


def find_zone_for_location(location: str) -> Optional[Dict]:
    if not location:
        return None
    target = location.strip().lower()
    with _LOCK:
        for zone in _zones.values():
            if zone.get("name", "").strip().lower() == target:
                return dict(zone)
        for zone in _zones.values():
            if target and target in zone.get("name", "").strip().lower():
                return dict(zone)
    return None
