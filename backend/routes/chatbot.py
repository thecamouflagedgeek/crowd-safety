"""Contextual chatbot for citizens.

One pipeline, always grounded:

1. Build a SNAPSHOT of everything the system knows: every monitored CCTV
   incident (normalised, ranked by relevance to the question), active official
   advisories, and - best effort, time-boxed - news reports.
2. Ask the LLM to answer ONLY from that snapshot.
3. Guard the answer: if the LLM fails, is empty, or says "I don't have data"
   while the snapshot is not empty, return a deterministic answer built from
   the same snapshot instead.

So the chatbot can only say "nothing detected" when the store is truly empty.
CCTV facts may be stated as "CCTV monitoring has detected ...". News is only
ever "reported", never verified.
"""

from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutTimeout
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

import llm
import news
import store

log = logging.getLogger("chat")
router = APIRouter(tags=["chat"])
_pool = ThreadPoolExecutor(max_workers=4)

# --------------------------------------------------------------------- config
_TOPICS = {
    "crowd": ("protest", "rally", "procession", "gathering", "crowd", "bandh", "strike",
              "mela", "festival", "unrest", "stampede", "congest", "march", "gate", "event"),
    "traffic": ("accident", "crash", "traffic", "collision", "diversion", "jam", "road", "junction"),
    "baggage": ("baggage", "bag", "suspicious", "unattended", "abandoned", "station", "platform"),
}
_TOPIC_BLOB_KEYS = {
    "crowd": ("crowd", "protest", "rally", "gathering", "procession", "congest", "event"),
    "traffic": ("traffic", "accident", "collision", "transit", "road"),
    "baggage": ("baggage", "unattended", "suspicious"),
}
_INTENTS = {
    "CONGESTION": ("crowd", "congest", "stampede", "gathering", "surge", "rush", "protest", "rally"),
    "CLOSURE": ("closure", "closed", "block", "diversion", "restriction"),
    "ACCIDENT": ("accident", "crash", "collision"),
    "SUSPICIOUS_OBJECT": ("baggage", "suspicious", "unattended", "abandoned"),
}
_SEV_RANK = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 1, "LOW": 2}
_STOP = {"the", "and", "for", "are", "there", "this", "that", "what", "any", "now", "near",
         "right", "was", "were", "with", "about", "from", "have", "has", "can", "you", "tell",
         "please", "going", "happening", "safe", "info", "update"}
_REFUSAL = re.compile(
    r"(i (do not|don't|dont) have|no (relevant )?(information|data|reports?)|"
    r"not (available|enough information)|(can't|cannot|unable to) (find|provide|answer|confirm)|"
    r"nothing (has been )?(detected|found|reported)|i'?m not sure|no incident)",
    re.I,
)


def start_llm_probe() -> None:
    llm.start_probe()


start_probe = start_llm_probe


def gemini_ok() -> bool:
    return llm.provider_status()["gemini"]


# ------------------------------------------------------------------ normalise
def _first(d: Dict, *keys: str, default: Any = "") -> Any:
    for k in keys:
        v = d.get(k)
        if v not in (None, "", [], {}):
            return v
    return default


def _pct(v: Any) -> Optional[int]:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return round(f * 100) if f <= 1 else round(f)


def _movement(d: Dict) -> str:
    m = _first(d, "movement", "movement_label")
    if m:
        return str(m)
    try:
        v = float(d.get("velocity"))
    except (TypeError, ValueError):
        return ""
    return "very slow" if v < 0.3 else "slow" if v < 0.7 else "normal"


def _norm(raw: Dict) -> Dict:
    """Same shape no matter which keys the store uses."""
    return {
        "id": str(_first(raw, "id", "incident_id")),
        "type": str(_first(raw, "type", "category", default="Incident")),
        "event": str(_first(raw, "event_name", "eventName", "name")),
        "location": str(_first(raw, "location", "place")),
        "severity": str(_first(raw, "severity", default="UNKNOWN")).upper(),
        "risk": _first(raw, "risk_score", "riskScore", default=None),
        "density": _pct(raw.get("density")),
        "movement": _movement(raw),
        "status": str(_first(raw, "status")),
        "guidance": str(_first(raw, "guidance", "action", "recommendation")),
        "summary": str(_first(raw, "summary", "explanation")),
        "confidence": _pct(raw.get("confidence")),
    }


def _blob(i: Dict) -> str:
    return " ".join([i["type"], i["event"], i["location"], i["summary"]]).lower()


def _all_incidents() -> List[Dict]:
    try:
        return [_norm(r) for r in (store.get_incidents() or []) if isinstance(r, dict)]
    except Exception as exc:  # never let the store break chat
        log.warning("store.get_incidents failed: %s", exc)
        return []


def _advisories() -> List[Dict]:
    fn = getattr(store, "get_advisories", None) or getattr(store, "list_advisories", None)
    if not callable(fn):
        return []
    try:
        return [a for a in (fn() or []) if isinstance(a, dict)][:3]
    except Exception:
        return []


# -------------------------------------------------------------------- ranking
def _topics_in(text: str) -> set:
    return {t for t, keys in _TOPICS.items() if any(re.search(rf"\b{re.escape(k)}", text) for k in keys)}


def _rank(message: str, focus: Optional[Dict], incidents: List[Dict]) -> List[Dict]:
    """Most relevant first. NEVER filters anything out: ranking only."""
    text = (message or "").lower()
    words = {w for w in re.findall(r"[a-z0-9]{3,}", text) if w not in _STOP}
    topics = _topics_in(text)
    focus_id = (focus or {}).get("id")

    def score(i: Dict) -> float:
        b = _blob(i)
        s = 0.0
        if focus_id and i["id"] == focus_id:
            s += 6
        loc = i["location"].lower()
        if loc and loc in text:
            s += 5
        elif loc and (toks := [t for t in re.findall(r"[a-z]{4,}", loc)]) and all(t in text for t in toks):
            s += 4
        for t in topics:
            if any(k in b for k in _TOPIC_BLOB_KEYS[t]):
                s += 3
        s += sum(1 for w in words if w in b)
        s += {"HIGH": 2, "CRITICAL": 2, "MEDIUM": 1}.get(i["severity"], 0)
        return s

    return sorted(incidents, key=lambda i: (-score(i), _SEV_RANK.get(i["severity"], 3)))


# ----------------------------------------------------------------------- news
def _fetch_news(place: str, message: str, kind: str) -> List[Dict]:
    """Best effort, hard time-box, never raises."""
    if not place:
        return []
    text = message.lower()
    intents = {f for f, keys in _INTENTS.items() if any(k in text for k in keys)}
    try:
        fut = _pool.submit(news.fetch_news, place, intents, kind)
        return (fut.result(timeout=4).get("items", []) or [])[:6]
    except FutTimeout:
        log.info("news timed out")
    except Exception as exc:
        log.info("news failed: %s", exc)
    return []


# --------------------------------------------------------------------- prompt
def _line(i: Dict) -> str:
    bits = [f"{i['id']}: {i['type']}"]
    if i["event"] and i["event"] != i["type"]:
        bits.append(f"({i['event']})")
    bits.append(f"at {i['location'] or 'unknown location'}, {i['severity']} severity")
    if i["risk"] is not None:
        bits.append(f"risk score {i['risk']}")
    if i["density"] is not None:
        bits.append(f"density {i['density']}%")
    if i["movement"]:
        bits.append(f"movement {i['movement']}")
    if i["confidence"] is not None:
        bits.append(f"CCTV confidence {i['confidence']}%")
    line = ", ".join(bits)
    if i["guidance"]:
        line += f". Guidance: {i['guidance']}"
    return "- " + line


def _prompt(message: str, ranked: List[Dict], advisories: List[Dict], items: List[Dict]) -> str:
    cctv = "\n".join(_line(i) for i in ranked[:6]) or "None."
    adv = "\n".join(
        f"- {_first(a, 'message', 'title')} (severity {_first(a, 'severity', default='n/a')}, "
        f"by {_first(a, 'issued_by', 'source', default='Authority')})" for a in advisories
    ) or "None."
    nws = "\n".join(
        f"- [{n.get('provider')}] {n.get('title')} (names the place: {n.get('locality_match')})" for n in items
    ) or "None."
    return (
        "You are the SafeCity public-safety assistant. Answer the citizen's question in 2-4 "
        "plain sentences using ONLY the data below.\n"
        "Rules:\n"
        "1. Answer directly. The first block lists incidents our CCTV computer vision is "
        "detecting right now, most relevant first. If the question is about a protest, "
        "crowd, rally, gathering, traffic or baggage, use the matching incident(s): say "
        "'CCTV monitoring has detected ...', name the place, severity and the key metric "
        "(density or slow movement), then give the guidance.\n"
        "2. If the question names a place we do not monitor, say monitoring shows nothing "
        "there, then mention the most relevant monitored incident instead.\n"
        "3. Official advisories may be quoted as official.\n"
        "4. News is only 'reported', never verified. Mention it only if it names the place.\n"
        "5. Never reply that you have no data when any incident is listed. Never invent "
        "facts, numbers or places.\n\n"
        f"CCTV INCIDENTS (system-observed):\n{cctv}\n\n"
        f"OFFICIAL ADVISORIES:\n{adv}\n\n"
        f"NEWS REPORTS (unverified):\n{nws}\n\n"
        f"CITIZEN QUESTION: {message}\n"
    )


# ------------------------------------------------------------- deterministic
def _describe(i: Dict) -> str:
    what = i["event"] or i["type"]
    s = f"a {i['severity']}-risk {what} at {i['location'] or 'a monitored location'}"
    facts = []
    if i["density"] is not None:
        facts.append(f"density {i['density']}%")
    if i["movement"]:
        facts.append(f"movement {i['movement']}")
    return s + (f" ({', '.join(facts)})" if facts else "")


def _fallback(ranked: List[Dict], advisories: List[Dict], items: List[Dict]) -> str:
    if not ranked and not advisories:
        return ("Our CCTV monitoring has no active incidents right now. I'll show new ones as "
                "soon as they are detected. Please follow official advisories for updates.")
    parts: List[str] = []
    if ranked:
        top = ranked[0]
        parts.append(f"CCTV monitoring has detected {_describe(top)}.")
        if top["guidance"]:
            parts.append(top["guidance"].rstrip(".") + ".")
        else:
            parts.append("Avoid the area and follow on-ground instructions.")
        others = ranked[1:3]
        if others:
            parts.append("Also being monitored: " + "; ".join(_describe(o) for o in others) + ".")
    if advisories:
        a = advisories[0]
        parts.append(f"Official advisory: {_first(a, 'message', 'title')}.")
    strong = [n for n in items if n.get("locality_match")]
    if strong:
        parts.append("News outlets also report: " + "; ".join((n.get("title") or "").strip() for n in strong[:2])
                     + ". These are reported, not verified.")
    return " ".join(parts)


def _bad(reply: str, ranked: List[Dict]) -> bool:
    """LLM gave an empty / 'no data' answer although we have evidence."""
    if not reply or not reply.strip():
        return True
    if not ranked:
        return False
    if _REFUSAL.search(reply) and ranked[0]["location"].lower() not in reply.lower():
        return True
    return False


# ---------------------------------------------------------------------- route
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    incident_id: Optional[str] = None


def _ev(n: Dict) -> Dict:
    return {k: n.get(k) for k in ("label", "title", "url", "provider", "status", "timestamp")} | {
        "locality_match": n.get("locality_match", False)
    }


@router.post("/chat")
def chat(payload: ChatRequest) -> Dict:
    message = payload.message.strip()

    focus_raw = None
    try:
        if payload.incident_id:
            focus_raw = store.get_incident(payload.incident_id)
        if focus_raw is None:
            focus_raw = store.find_incident_for_location(message)
    except Exception:
        focus_raw = None
    focus = _norm(focus_raw) if isinstance(focus_raw, dict) else None

    incidents = _all_incidents()
    if focus and not any(i["id"] == focus["id"] for i in incidents):
        incidents.append(focus)
    ranked = _rank(message, focus, incidents)
    advisories = _advisories()

    anchor = (ranked[0] if ranked else {}) or {}
    items = _fetch_news(focus["location"] if focus else anchor.get("location", ""), message, anchor.get("type", ""))

    reply, source, model = "", "fallback", None
    try:
        res = llm.generate_llm_response(_prompt(message, ranked, advisories, items))
        if isinstance(res, dict):
            reply = str(res.get("reply") or "").strip()
            source, model = res.get("source", "llm"), res.get("model")
        elif isinstance(res, str):
            reply, source = res.strip(), "llm"
    except Exception as exc:
        log.warning("llm failed: %s", exc)

    if _bad(reply, ranked):
        log.info("LLM answer rejected (%r); using deterministic answer", reply[:80])
        reply, source, model = _fallback(ranked, advisories, items), "fallback", None

    return {
        "reply": reply,
        "source": source,
        "model": model,
        "grounded_on": ranked[0]["id"] if ranked else None,
        "mode": "grounded",
        "evidence": [_ev(n) for n in items[:5]],
        "retrieved_count": len(items),
        "cctv_incidents": [
            {"id": i["id"], "type": i["type"], "location": i["location"], "severity": i["severity"]}
            for i in ranked[:4]
        ],
    }


@router.get("/chat/debug")
def chat_debug(q: str = "Is there a protest happening?") -> Dict:
    """Open in a browser: shows exactly what the chatbot can see."""
    incidents = _all_incidents()
    ranked = _rank(q, None, incidents)
    return {
        "incident_count": len(incidents),
        "ranked": [{"id": i["id"], "type": i["type"], "location": i["location"], "severity": i["severity"]} for i in ranked],
        "advisory_count": len(_advisories()),
        "prompt_preview": _prompt(q, ranked, _advisories(), [])[:1800],
        "fallback_answer": _fallback(ranked, _advisories(), []),
        "llm_providers": llm.provider_status(),
    }