"""PS 06 — Real-Time Computer Vision for Public Safety (backend prototype).

FastAPI backend that runs a real OpenCV pipeline over camera feeds, derives
explainable risk, manages incidents, verification, evidence, advisories, chat
and safe routing, and exposes stable JSON contracts for the citizen app and the
authority dashboard.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Dict

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()

import news  # noqa: E402
import store  # noqa: E402
from cv import video_processor  # noqa: E402
from routes import (  # noqa: E402
    advisories,
    chatbot,
    evidence,
    incidents,
    news_feed,
    route,
    verification,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.load_all()
    video_processor.start_all()
    chatbot.start_probe()
    try:
        yield
    finally:
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
    return {
        "status": "ok",
        "services": {
            "api": True,
            "cv": cv_ok,
            "cv_backend": cv_backend,
            "cv_model": cv_model,
            "gemini": chatbot.gemini_ok(),
            "serpapi": news_providers["serpapi"],
            "newsapi": news_providers["newsapi"],
        },
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
            "GET /sources/{incident_id}",
            "POST /validation",
            "POST /advisories",
            "GET /advisories",
            "POST /chat",
            "POST /route",
            "GET /news",
            "GET /videos/{file}",
        ],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
