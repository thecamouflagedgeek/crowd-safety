"""Contextual chatbot - a phrasing layer, never an information engine.

Two clearly separated modes:

``guidance``  (conversational)
    "Should I avoid Gate 3?" / "What does HIGH severity mean?"
    Answered from the CV/incident context the backend already owns.

``search``    (information / incident lookup)
    "Is there a protest near BKC?" / "What is happening near Andheri?"
    The backend first RETRIEVES evidence (SerpApi + NewsAPI + seeded sources),
    then the LLM is only allowed to summarise that retrieved evidence. The LLM
    is never asked to invent or establish current facts, and a retrieved news
    item is reported as ``REPORTED`` - never as verified.

Provider chain (see ``llm.py``): ``generate_llm_response()`` walks every configured
Gemini model in order, then every Grok model, then returns ``None`` so this module
can answer deterministically. Chat never fails because one model is retired,
rate-limited or unavailable.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

import llm
import news
import store

router = APIRouter(tags=["chat"])

# Words that mark a question as a lookup about the outside world rather than a
# question about an incident the backend already tracks.
_SEARCH_HINTS = {
    "news", "reported", "report", "protest", "rally", "procession", "gathering",
    "happening", "going on", "is there", "any update", "what is happening",
    "whats happening", "viral", "reel", "rumour", "rumor", "circulating",
    "unrest", "bandh", "strike", "mela", "festival",
}

# Message -> news keyword family (keeps retrieval incident-specific).
_INFO_INTENT_KEYWORDS = {
    "CONGESTION": ("crowd", "congest", "stampede", "gathering", "surge", "rush"),
    "CLOSURE": ("closure", "closed", "block", "blocked", "diversion", "restriction"),
    "ACCIDENT": ("accident", "crash", "collision", "hit"),
    "SUSPICIOUS_OBJECT": ("baggage", "suspicious", "unattended", "abandoned"),
}


def start_llm_probe() -> None:
    """Kick off the background capability probe used by /health."""
    llm.start_probe()


# Backwards-compatible alias for older callers.
start_probe = start_llm_probe


def gemini_ok() -> bool:
    return llm.provider_status()["gemini"]


# --------------------------------------------------------------- classification
def _is_search_question(message: str) -> bool:
    text = (message or "").lower()
    return any(hint in text for hint in _SEARCH_HINTS)


def _intents_from_message(message: str) -> set:
    words = set(re.findall(r"[a-z]+", (message or "").lower()))
    found = set()
    for family, keys in _INFO_INTENT_KEYWORDS.items():
        if any(word.startswith(key) for word in words for key in keys):
            found.add(family)
    return found


def _location_from_message(message: str) -> Optional[str]:
    """Prefer a location the backend actually monitors, else None."""
    text = (message or "").lower()
    for incident in store.get_incidents():
        location = (incident.get("location") or "").strip()
        if not location:
            continue
        if location.lower() in text:
            return location
        tokens = [t for t in re.findall(r"[a-z]{4,}", location.lower()) if len(t) >= 4]
        if tokens and all(token in text for token in tokens):
            return location
    return None


# ------------------------------------------------------------------- prompts
def _guidance_prompt(incident: Optional[Dict], message: str) -> str:
    context = (
        f"Incident ID: {incident.get('id')}\n"
        f"Type: {incident.get('type')}\n"
        f"Location: {incident.get('location')}\n"
        f"Severity: {incident.get('severity')}\n"
        f"Risk score: {incident.get('risk_score')}\n"
        f"Factors: {incident.get('factors')}\n"
        f"Density: {incident.get('density')}\n"
        f"Velocity: {incident.get('velocity')}\n"
        f"Guidance: {incident.get('guidance')}\n"
        if incident
        else "No incident context available.\n"
    )
    return (
        "You are a public-safety assistant for citizens. Answer in 2-3 sentences using "
        "ONLY the incident context below. Do not invent any facts, numbers, or locations. "
        "If the context does not cover the question, say you only have the listed information "
        "and advise following official guidance.\n\n"
        f"INCIDENT CONTEXT:\n{context}\n\nCITIZEN QUESTION: {message}\n"
    )


def _search_prompt(place: str, message: str, items: List[Dict]) -> str:
    evidence = "\n".join(
        f"- [{item.get('provider')}] {item.get('label')}: {item.get('title')} "
        f"(status: {item.get('status')}, locality match: {item.get('locality_match')})"
        for item in items[:6]
    ) or "No public-safety reports were retrieved for this location."
    return (
        "You are a public-safety assistant for citizens. You are given RETRIEVED "
        "public-safety reports below. Summarise them in 2-3 sentences. Rules: every "
        "retrieved item is only REPORTED by a news provider, never verified or confirmed. "
        "Never state that an incident is confirmed, verified, true or false. If the reports "
        "are weak or do not name the place, say clearly that nothing is corroborated for "
        "that location yet and advise following official advisories. Do not add facts that "
        "are not in the retrieved reports.\n\n"
        f"LOCATION: {place}\n"
        f"RETRIEVED REPORTS:\n{evidence}\n\nCITIZEN QUESTION: {message}\n"
    )


# ------------------------------------------------------------- deterministic
def _guidance_fallback(incident: Optional[Dict], message: str) -> Dict:
    if incident is None:
        return {
            "reply": "I don't have an incident for that location yet. Please share the gate or area name.",
            "source": "fallback",
            "grounded_on": None,
        }
    severity = incident.get("severity", "UNKNOWN")
    location = incident.get("location", "the area")
    factors = incident.get("factors", {}) or {}
    drivers = sorted(factors.items(), key=lambda kv: kv[1], reverse=True)[:2]
    readable = {
        "density": "increasing crowd density",
        "motion_anomaly": "reduced movement",
        "persistence": "sustained congestion over time",
        "citizen_reports": "multiple citizen reports",
    }
    reasons = " and ".join(readable.get(name, name) for name, _ in drivers) or "recent CV signals"
    guidance = incident.get("guidance", "Follow on-ground instructions and avoid the immediate area.")
    reply = (
        f"{location} is currently classified as {severity} risk because of {reasons}. "
        f"{guidance}"
    )
    return {
        "reply": reply,
        "source": "fallback",
        "grounded_on": incident.get("id"),
    }


def _search_fallback(place: str, items: List[Dict], incident: Optional[Dict]) -> Dict:
    strong = [item for item in items if item.get("locality_match")]
    if strong:
        headlines = "; ".join((item.get("title") or "").strip() for item in strong[:3])
        reply = (
            f"I found {len(strong)} public-safety report(s) that actually name {place}: {headlines}. "
            "These are only REPORTED by news providers, not verified - I cannot confirm them from "
            "reports alone. Follow the official advisory for this area."
        )
    elif items:
        reply = (
            f"I retrieved {len(items)} report(s) for {place}, but none of them actually name the "
            "location, so nothing is corroborated there. Treat them as unverified."
        )
    elif incident is not None:
        reply = (
            f"I have no live public-safety reports for {place} right now. The monitored incident "
            f"there is {incident.get('id')} ({incident.get('type')}, "
            f"{incident.get('severity')} severity) - that is backed by CCTV, not by news."
        )
    else:
        reply = (
            f"I have no retrieved public-safety reports for {place}. Please share the exact area or "
            "check the official advisory feed."
        )
    # Retrieved evidence is attached by _respond(), which owns the /chat contract.
    return {
        "reply": reply,
        "source": "fallback",
        "grounded_on": incident.get("id") if incident else None,
    }


# --------------------------------------------------------------------- route
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    incident_id: Optional[str] = None


def _evidence_item(item: Dict) -> Dict:
    return {
        "label": item.get("label"),
        "title": item.get("title"),
        "url": item.get("url"),
        "provider": item.get("provider"),
        "status": item.get("status"),
        "timestamp": item.get("timestamp"),
        "locality_match": item.get("locality_match", False),
    }


def _respond(payload: Dict, *, mode: str, retrieved: Optional[List[Dict]] = None) -> Dict:
    """Stable /chat contract, whichever path produced the answer.

    ``reply``, ``source``, ``model`` and ``grounded_on`` are ALWAYS present, so a
    client can read them without a KeyError. Search mode additionally reports the
    evidence it retrieved; guidance mode does not.
    """
    body = {
        "reply": payload.get("reply", ""),
        "source": payload.get("source", "fallback"),
        "model": payload.get("model"),
        "grounded_on": payload.get("grounded_on"),
        "mode": mode,
    }
    if mode == "search":
        items = retrieved if retrieved is not None else payload.get("evidence") or []
        body["evidence"] = [_evidence_item(item) for item in items[:5]]
        body["retrieved_count"] = len(items)
    return body


@router.post("/chat")
def chat(payload: ChatRequest) -> Dict:
    message = payload.message

    incident = None
    if payload.incident_id:
        incident = store.get_incident(payload.incident_id)
    if incident is None:
        incident = store.find_incident_for_location(payload.message)

    # ---- information / incident search: RETRIEVE, then let the LLM summarise.
    if _is_search_question(message):
        place = _location_from_message(message) or (incident or {}).get("location", "")
        intents = _intents_from_message(message)
        retrieved: List[Dict] = []
        if place:
            try:
                retrieved = news.fetch_news(
                    place, intents, (incident or {}).get("type", "")
                ).get("items", [])
            except Exception:
                retrieved = []
        result = llm.generate_llm_response(_search_prompt(place or "the requested area", message, retrieved))
        if result is None:
            result = _search_fallback(place or "that area", retrieved, incident)
        return _respond(result, mode="search", retrieved=retrieved)

    # ---- conversational guidance: answer strictly from backend-owned context.
    result = llm.generate_llm_response(_guidance_prompt(incident, message))
    if result is None:
        result = _guidance_fallback(incident, message)
    return _respond(result, mode="guidance")
