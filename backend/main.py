"""PS 06 — Real-Time Computer Vision for Public Safety (backend prototype).

FastAPI backend that runs a real OpenCV pipeline over camera feeds, derives
explainable risk, manages incidents, verification, evidence, advisories, chat
and safe routing, and exposes stable JSON contracts for the citizen app and the
authority dashboard.
"""

from __future__ import annotations

import asyncio
import json
import os
import urllib.request
from contextlib import asynccontextmanager
from typing import Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()

import llm  # noqa: E402
import news  # noqa: E402
import store  # noqa: E402
from cv import video_processor  # noqa: E402
from geo_alerts import (  # noqa: E402
    configure as configure_geo_alerts,
    dispatch_for_incident,
    purge_expired,
    router as geo_router,
)
from routes import (  # noqa: E402
    advisories,
    chatbot,
    evidence,
    incidents,
    news_feed,
    route,
    verification,
)
import broadcast

PORT = int(os.getenv("PORT", "8000"))


# ---------------------------------------------------------------------------
# Geo-alert wiring
#
# The CV pipeline already updates incidents on its own, so instead of hooking
# into it we read the same /incidents and /advisories data the apps use. Once
# you know the exact function behind those routes (see routes/incidents.py and
# routes/advisories.py), replace _get_json() with a direct call, e.g.
#   return incidents.list_incidents()
# ---------------------------------------------------------------------------
def _get_json(path: str):
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}{path}", timeout=3) as r:
        return json.loads(r.read())


def _incident_dicts() -> List[dict]:
    data = _get_json("/incidents")
    return data if isinstance(data, list) else data.get("incidents", [])


def _advisory_dicts() -> List[dict]:
    data = _get_json("/advisories")
    return data if isinstance(data, list) else data.get("advisories", [])


configure_geo_alerts(incidents_fn=_incident_dicts, advisories_fn=_advisory_dicts)


async def _alert_watcher() -> None:
    """Every few seconds: alert opted-in citizens near HIGH/CRITICAL incidents.

    dispatch_for_incident() de-duplicates per (incident, user, severity), so
    re-checking the same incident is safe; an escalation alerts again.
    """
    while True:
        await asyncio.sleep(5)  # first pass after the server is listening
        try:
            for inc in await asyncio.to_thread(_incident_dicts):
                dispatch_for_incident(inc)
            purge_expired()
        except Exception as exc:  # never let the watcher die
            print(f"[geo-alerts] watcher error: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.load_all()
    video_processor.start_all()
    chatbot.start_llm_probe()
    watcher = asyncio.create_task(_alert_watcher())
    try:
        yield
    finally:
        watcher.cancel()
        video_processor.stop_all()


app = FastAPI(
    title="Public Safety CV Backend",
    description="Real-time CV, risk, incidents, verification, evidence, advisories.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # prototype: Flutter dev + localhost React
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the camera videos to both frontends over HTTP (no local paths).
app.mount("/videos", StaticFiles(directory=str(video_processor.VIDEO_DIR)), name="videos")

app.include_router(incidents.router)
app.include_router(verification.router)
app.include_router(evidence.router)
app.include_router(advisories.router)
app.include_router(chatbot.router)
app.include_router(route.router)
app.include_router(news_feed.router)
app.include_router(geo_router)  # resilient geo-alert sync + SMS/push fallback
app.include_router(broadcast.router)

@app.get("/health")
def health() -> Dict:
    processors = video_processor.PROCESSORS
    cv_ok = bool(processors) and any(
        p.status in ("running", "starting", "fallback_seeded_metrics") for p in processors.values()
    )
    cv_backend = None
    cv_model = None
    for processor in processors.values():
        if processor.detector is not None:
            cv_backend = processor.detector.backend
            cv_model = processor.detector.model_name
            break
    news_providers = news.provider_status()
    llm_providers = llm.provider_status()
    return {
        "status": "ok",
        "services": {
            "api": True,
            "cv": cv_ok,
            "cv_backend": cv_backend,
            "cv_model": cv_model,
            # True only when the provider actually answered the startup probe.
            "gemini": llm_providers["gemini"],
            "grok": llm_providers["grok"],
            "serpapi": news_providers["serpapi"],
            "newsapi": news_providers["newsapi"],
        },
        # Multi-model fallback chain: configured keys, model counts and the
        # model each provider last answered with. Model names only, never keys.
        "llm": llm.health(),
    }


@app.get("/cameras")
def cameras() -> Dict:
    return {
        "cameras": video_processor.camera_status(),
        "observations": store.get_camera_observations(),
    }


@app.get("/")
def root() -> Dict:
    return {
        "service": "Public Safety CV Backend",
        "status": "ok",
        "docs": "/docs",
        "endpoints": [
            "GET /health",
            "GET /incidents",
            "GET /incidents/{incident_id}",
            "GET /cameras",
            "POST /verify",
            "GET /evidence/{incident_id}",
            "POST /incidents/{incident_id}/evidence",
            "GET /incidents/{incident_id}/evidence",
            "GET /evidence/item/{evidence_id}",
            "GET /sources/{incident_id}",
            "POST /validation",
            "POST /advisories",
            "GET /advisories",
            "POST /chat",
            "POST /route",
            "GET /news",
            "GET /videos/{file}",
            "POST /citizens/sync",
            "DELETE /citizens/{user_id}",
            "GET /sync/snapshot",
            "POST /reports/batch",
            "GET /alerts/outbox",
            "POST /alerts/simulate",
        ],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)