"""Contextual chatbot.

Uses Gemini when GEMINI_API_KEY is configured, otherwise (or on any failure)
returns a deterministic, incident-grounded answer. The model is instructed to
use only the supplied incident context and never to invent facts.
"""

from __future__ import annotations

import os
import threading
from typing import Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

import store

router = APIRouter(tags=["chat"])

_PLACEHOLDER_KEYS = {"", "YOUR_KEY", "your_key", "changeme", "none"}

# Result of the background capability probe (None until it finishes).
_probe_result: Optional[bool] = None


def _api_key() -> Optional[str]:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if key in _PLACEHOLDER_KEYS:
        return None
    return key


def _model_candidates() -> list:
    """Primary model plus fallbacks, so a retired/busy model never breaks chat."""
    primary = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    ordered = [primary, "gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-flash-latest"]
    seen, result = set(), []
    for model in ordered:
        if model and model not in seen:
            seen.add(model)
            result.append(model)
    return result


def gemini_ok() -> bool:
    """True only if a key is configured AND the probe confirmed it works."""
    if _probe_result is not None:
        return _probe_result
    return _api_key() is not None


def probe_gemini() -> None:
    """Run once in the background so /health never blocks on the network."""
    global _probe_result
    key = _api_key()
    if key is None:
        _probe_result = False
        return
    try:
        from google import genai  # type: ignore

        client = genai.Client(api_key=key)
        for model in _model_candidates():
            try:
                client.models.generate_content(model=model, contents="ping")
                _probe_result = True
                return
            except Exception:
                continue
        _probe_result = False
    except Exception:
        _probe_result = False


def start_probe() -> None:
    threading.Thread(target=probe_gemini, daemon=True, name="gemini-probe").start()


def _fallback_answer(incident: Optional[Dict], message: str) -> Dict:
    if incident is None:
        return {
            "reply": "I don't have an incident for that location yet. Please share the gate or area name.",
            "source": "fallback",
            "grounded_on": None,
        }
    severity = incident.get("severity", "UNKNOWN")
    location = incident.get("location", "the area")
    factors = incident.get("factors", {})
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
    return {"reply": reply, "source": "fallback", "grounded_on": incident.get("id")}


def _gemini_answer(key: str, incident: Optional[Dict], message: str) -> Optional[Dict]:
    """Return {reply, model} from the first model in the fallback chain that works."""
    try:
        from google import genai  # type: ignore

        client = genai.Client(api_key=key)
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
            else "No incident context available."
        )
        prompt = (
            "You are a public-safety assistant for citizens. Answer in 2-3 sentences using "
            "ONLY the incident context below. Do not invent any facts, numbers, or locations. "
            "If the context does not cover the question, say you only have the listed information "
            "and advise following official guidance.\n\n"
            f"INCIDENT CONTEXT:\n{context}\n\nCITIZEN QUESTION: {message}\n"
        )
        for model in _model_candidates():
            try:
                response = client.models.generate_content(model=model, contents=prompt)
                text = (getattr(response, "text", None) or "").strip()
                if text:
                    return {"reply": text, "model": model}
            except Exception:
                continue
        return None
    except Exception:
        return None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    incident_id: Optional[str] = None


@router.post("/chat")
def chat(payload: ChatRequest) -> Dict:
    incident = None
    if payload.incident_id:
        incident = store.get_incident(payload.incident_id)
    if incident is None:
        incident = store.find_incident_for_location(payload.message)

    key = _api_key()
    if key and incident is not None:
        result = _gemini_answer(key, incident, payload.message)
        if result:
            return {
                "reply": result["reply"],
                "source": "gemini",
                "model": result["model"],
                "grounded_on": incident.get("id"),
            }

    fallback = _fallback_answer(incident, payload.message)
    return fallback
