"""Deterministic multi-source information verification (no live crawling).

Verification (is this CLAIM supported?) is deliberately separate from severity
(how bad is the AREA?). An area can be HIGH severity while a specific claim about
it is UNVERIFIED.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import news
import store

router = APIRouter(tags=["verification"])

STOPWORDS = {
    "the", "is", "are", "was", "were", "a", "an", "at", "near", "of", "in", "on",
    "and", "or", "to", "for", "with", "there", "this", "that", "has", "have",
    "been", "completely", "very", "so", "it", "its", "by", "from", "as",
}

# Intent categories keep "closed" from being counted as evidence for "congested".
INTENTS = {
    "CONGESTION": {"congest", "congestion", "crowd", "crowded", "dense", "density",
                    "rush", "packed", "jam", "heavy", "crush", "stampede"},
    "CLOSURE": {"closed", "close", "blocked", "shut", "barred", "sealed"},
    "ACCIDENT": {"accident", "crash", "collision", "collide", "hit", "vehicle"},
    "SUSPICIOUS_OBJECT": {"unattended", "baggage", "bag", "suspicious", "abandoned", "package"},
}

SOURCE_WEIGHT = {"CCTV": 1.0, "Official": 1.0, "Citizen": 0.7, "News": 0.55, "Social": 0.3}


class VerifyRequest(BaseModel):
    claim: str = Field(..., min_length=1)
    location: Optional[str] = None
    incident_id: Optional[str] = None
    # A news/social URL may accompany a claim; it is recorded but never scraped
    # and never treated as proof on its own.
    url: Optional[str] = None


class ValidationRequest(BaseModel):
    incident_id: str
    claim_id: Optional[str] = None
    source_id: Optional[str] = None
    status: str
    note: Optional[str] = None


def _tokens(text: str) -> set:
    words = re.findall(r"[a-z0-9]+", (text or "").lower())
    return {w for w in words if w not in STOPWORDS and (len(w) >= 3 or w.isdigit())}


def _similarity(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / float(len(ta | tb))


def _intents(text: str) -> set:
    words = set(re.findall(r"[a-z]+", (text or "").lower()))
    found = set()
    for name, keys in INTENTS.items():
        for key in keys:
            if any(word.startswith(key) for word in words):
                found.add(name)
                break
    return found


def _location_matches(claim_location: Optional[str], source_location: str) -> bool:
    if not claim_location:
        return False
    a, b = claim_location.strip().lower(), (source_location or "").strip().lower()
    return bool(a) and (a == b or a in b or b in a)


def _supporting_sources(incident_id: str, claim: str, location: Optional[str]) -> List[Dict]:
    """Sources whose claim agrees in intent and text/location."""
    claim_intents = _intents(claim)
    matched: List[Tuple[float, Dict]] = []
    for source in store.get_sources(incident_id):
        source_intents = _intents(source.get("claim", ""))
        intent_ok = bool(claim_intents & source_intents)
        sim = _similarity(claim, source.get("claim", ""))
        loc_ok = _location_matches(location, source.get("location", ""))
        # Require genuine agreement: same intent, or very high text overlap.
        if not intent_ok and sim < 0.45:
            continue
        agreement = 0.55 * sim + 0.25 * (1.0 if intent_ok else 0.0) + 0.20 * (1.0 if loc_ok else 0.0)
        positive = source.get("status") in ("CONFIRMED", "SUPPORTING", "VERIFIED")
        score = agreement * source.get("credibility", 0.5) * SOURCE_WEIGHT.get(source.get("source", ""), 0.5)
        if positive and score > 0.08:
            matched.append((score, source))
    matched.sort(key=lambda item: item[0], reverse=True)
    return [source for _score, source in matched]


def _match_seeded_claim(claim: str, incident_id: Optional[str]) -> Optional[Tuple[Dict, float]]:
    best: Optional[Tuple[Dict, float]] = None
    for record in store.get_claims(incident_id):
        sim = _similarity(claim, record.get("claim", ""))
        if best is None or sim > best[1]:
            best = (record, sim)
    if best and best[1] >= 0.5:
        return best
    return None


def _confidence_from_sources(sources: List[Dict]) -> float:
    if not sources:
        return 0.0
    total = sum(
        s.get("credibility", 0.5) * SOURCE_WEIGHT.get(s.get("source", ""), 0.5)
        for s in sources
    )
    return round(min(0.96, total / 2.2), 2)


def _impact(status: str, incident: Optional[Dict], location: Optional[str]) -> str:
    if status != "VERIFIED":
        return "Insufficient supporting evidence"
    incident_type = (incident or {}).get("type", "incident")
    severity = (incident or {}).get("severity", "")
    place = location or (incident or {}).get("location", "")
    if incident_type == "Crowd Anomaly":
        return f"{severity.title()} congestion near {place}".strip()
    return f"{severity.title()} {incident_type.lower()} near {place}".strip()


@router.post("/verify")
def verify(payload: VerifyRequest) -> Dict:
    incident = None
    if payload.incident_id:
        incident = store.get_incident(payload.incident_id)
    if incident is None:
        incident = store.find_incident_for_location(payload.location or "")

    claim_intents = _intents(payload.claim)
    if not claim_intents:
        # Unknown intent: fall back to seeded claim matching only.
        anchored = _match_seeded_claim(payload.claim, incident["id"] if incident else None)
        if anchored and anchored[0].get("status") == "VERIFIED":
            claim_intents = _intents(anchored[0].get("claim", ""))

    if incident is None:
        return {
            "status": "UNVERIFIED",
            "confidence": 0.1,
            "severity": "UNKNOWN",
            "impact": "No matching incident for this location",
            "supporting_sources": [],
            "incident_id": None,
            "location": payload.location,
            "intents": sorted(claim_intents),
            "corroborating_news": [],
            "news_providers": news.provider_status(),
            "submitted_url": payload.url,
        }

    anchored = _match_seeded_claim(payload.claim, incident["id"])
    supporting = _supporting_sources(incident["id"], payload.claim, payload.location)

    # Live public-safety news is only ever corroboration (status REPORTED).
    live: Dict = {"items": [], "providers": news.provider_status(), "queries": []}
    try:
        live = news.fetch_news(
            payload.location or incident.get("location", ""),
            claim_intents,
            incident.get("type", ""),
        )
    except Exception:
        pass
    corroborating_news = [
        {
            "title": item.get("title"),
            "label": item.get("label"),
            "url": item.get("url"),
            "provider": item.get("provider"),
            "status": item.get("status"),
            "timestamp": item.get("timestamp"),
            "locality_match": item.get("locality_match", False),
        }
        for item in live.get("items", [])
    ]

    if anchored is not None:
        record, sim = anchored
        status = record.get("status", "UNVERIFIED")
        if status == "VERIFIED":
            confidence = max(record.get("confidence", 0.0), _confidence_from_sources(supporting))
        elif status == "UNDER_VALIDATION":
            confidence = record.get("confidence", 0.5)
        else:
            confidence = record.get("confidence", 0.3)
            supporting = []
    else:
        high_trust = [s for s in supporting if s.get("source") in ("CCTV", "Official")]
        confidence = _confidence_from_sources(supporting)
        if confidence >= 0.55 and high_trust:
            status = "VERIFIED"
        elif confidence >= 0.45:
            status = "UNDER_VALIDATION"
        else:
            status = "UNVERIFIED"
        if status != "VERIFIED":
            supporting = supporting[:1] if status == "UNDER_VALIDATION" else []

    evidence_labels = [s.get("label", s.get("id")) for s in supporting]
    # Live news may only corroborate an already-supported claim, AND only when it
    # actually names the place. It can never create a VERIFIED result on its own.
    if status == "VERIFIED":
        for item in corroborating_news:
            if not item.get("locality_match"):
                continue
            label = item.get("label") or "News"
            if label not in evidence_labels:
                evidence_labels.append(label)
            if len(evidence_labels) >= len(supporting) + 2:
                break

    return {
        "status": status,
        "confidence": float(confidence),
        "severity": incident.get("severity", "UNKNOWN"),
        "impact": _impact(status, incident, payload.location),
        "supporting_sources": evidence_labels,
        "incident_id": incident["id"],
        "location": payload.location or incident.get("location"),
        "intents": sorted(claim_intents),
        "corroborating_news": corroborating_news,
        "news_providers": live.get("providers", news.provider_status()),
        "news_queries": live.get("queries", []),
        "submitted_url": payload.url,
    }


@router.post("/validation")
def validate(payload: ValidationRequest) -> Dict:
    claim = store.get_claim(payload.claim_id) if payload.claim_id else None
    if payload.claim_id and claim is None:
        raise HTTPException(status_code=404, detail=f"Claim {payload.claim_id} not found")

    updated_claim = None
    if claim is not None:
        updated_claim = store.update_claim(
            claim["id"],
            status=payload.status,
            validated_by="Authority",
            note=payload.note or "",
        )
        # Keep a linked citizen source in sync when one exists.
        for source in store.get_sources(payload.incident_id):
            if source.get("source") == "Citizen" and _similarity(
                source.get("claim", ""), claim.get("claim", "")
            ) >= 0.4:
                store.update_source(source["id"], status=payload.status)

    updated_source = None
    if payload.source_id:
        updated_source = store.update_source(
            payload.source_id, status=payload.status, validated_by="Authority"
        )
        if updated_source is None:
            raise HTTPException(status_code=404, detail=f"Source {payload.source_id} not found")

    store.add_evidence_event(
        payload.incident_id,
        {
            "time": datetime.now().strftime("%H:%M"),
            "event": f"Authority marked {payload.claim_id or payload.source_id or 'item'} as {payload.status}",
            "source": "Authority Validation",
        },
    )

    return {
        "status": "ok",
        "incident_id": payload.incident_id,
        "claim": updated_claim,
        "source": updated_source,
        "validation_status": payload.status,
    }
