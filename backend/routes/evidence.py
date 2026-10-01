"""Evidence reconstruction timeline and the source network graph."""

from __future__ import annotations

from typing import Dict, Optional
from datetime import datetime, timedelta
from pathlib import Path
import hashlib
import os
import threading
import uuid

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form

from cv.detector import Detector
from cv.video_processor import TemporalSignalAnalyzer, VIDEO_DIR

import news
import store

router = APIRouter(tags=["evidence"])
UPLOAD_DIR = VIDEO_DIR / "evidence"
MAX_ANALYSIS_SECONDS = 120
SAMPLE_FPS = 3

SOURCE_TYPE_MAP = {
    "CCTV": "cctv",
    "Citizen": "citizen",
    "News": "news",
    "Social": "social",
    "Official": "official",
}


@router.get("/evidence/{incident_id}")
def evidence(incident_id: str) -> Dict:
    incident = store.get_incident(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    sources = store.get_sources(incident_id)
    cameras = sorted({s.get("label") for s in sources if s.get("source") == "CCTV"})
    return {
        "incident_id": incident_id,
        "incident": incident,
        "timeline": store.get_evidence(incident_id),
        "uploaded_evidence": store.get_evidence_records(incident_id),
        "cameras": cameras,
        "sources": [
            {
                "id": s.get("id"),
                "source": s.get("source"),
                "label": s.get("label"),
                "status": s.get("status"),
                "timestamp": s.get("timestamp"),
            }
            for s in sources
        ],
        "metrics": {
            "density": incident.get("density"),
            "velocity": incident.get("velocity"),
            "confidence": incident.get("confidence"),
            "risk_score": incident.get("risk_score"),
        },
    }


def _analyze(evidence_id: str, path: Path) -> None:
    """Run the same Detector and temporal signal analyzer used by CCTV threads."""
    capture = None
    try:
        store.update_evidence_record(evidence_id, status="ANALYZING", stage="Analyzing frames")
        capture = cv2.VideoCapture(str(path))
        if not capture.isOpened():
            raise ValueError("Video codec unsupported or file could not be opened")
        fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        original_duration = frame_count / fps if frame_count else 0
        duration = min(original_duration, MAX_ANALYSIS_SECONDS)
        record = store.get_evidence_record(evidence_id) or {}
        store.update_evidence_record(evidence_id, duration_seconds=round(original_duration, 2), stage="Loading detector")
        detector = Detector()
        store.update_evidence_record(evidence_id, stage="Extracting signals")
        temporal = TemporalSignalAnalyzer(person_capacity=46)
        stride = max(1, int(round(fps / SAMPLE_FPS)))
        samples, prev_gray, prev_centroid = [], None, None
        warmed = 0
        frame_index = 0
        while frame_index < frame_count and frame_index / fps < MAX_ANALYSIS_SECONDS:
            ok, frame = capture.read()
            if not ok or frame is None:
                break
            if frame_index % stride:
                frame_index += 1
                continue
            if warmed < SAMPLE_FPS:
                detector.warm_background(frame)
                warmed += 1
                frame_index += 1
                continue
            detected = detector.detect(frame)
            gray = cv2.resize(detected.pop("gray"), (160, 90))
            motion = float(np.mean(cv2.absdiff(gray, prev_gray))) / 255.0 if prev_gray is not None else 0.0
            centers = detected.get("centroids") or []
            centroid_shift = 0.0
            if centers:
                cx = sum(c[0] for c in centers) / len(centers)
                cy = sum(c[1] for c in centers) / len(centers)
                if prev_centroid is not None:
                    centroid_shift = ((cx-prev_centroid[0])**2 + (cy-prev_centroid[1])**2)**0.5 / 160.0
                prev_centroid = (cx, cy)
            signals = temporal.update(detected, motion, centroid_shift)
            t = round(frame_index / fps, 2)
            samples.append({"time_seconds": t, **signals, "motion_energy": round(motion, 4),
                            "person_count": detected["person_count"], "foreground_ratio": detected["foreground_ratio"],
                            "confidence": detected["avg_confidence"], "detections": detected["detections"],
                            "backend": detected["backend"]})
            prev_gray = gray
            frame_index += 1
        capture.release()
        capture = None
        if not samples:
            raise ValueError("No decodable video frames were available")

        # Establish a clip-specific baseline from the first eight seconds.
        baseline = [s for s in samples if s["time_seconds"] <= 8] or samples[:min(8, len(samples))]
        motion_values = [s["motion_energy"] for s in baseline]
        density_values = [s["density"] for s in baseline]
        motion_threshold = float(np.mean(motion_values) + max(0.06, 2 * np.std(motion_values)))
        density_threshold = float(np.mean(density_values) + max(0.16, 2 * np.std(density_values)))
        candidates = [s for s in samples if s["time_seconds"] > (baseline[-1]["time_seconds"] if baseline else 0)
                      and (s["motion_energy"] > motion_threshold or s["density"] > density_threshold)]
        events = []
        if candidates:
            runs = []
            for sample in candidates:
                if not runs or sample["time_seconds"] - runs[-1][-1]["time_seconds"] > 1.1:
                    runs.append([sample])
                else:
                    runs[-1].append(sample)
            for run in runs:
                if len(run) < 3:
                    continue
                peak = max(run, key=lambda s: s["motion_energy"] + s["density"])
                elapsed = peak["time_seconds"]
                event_origin = record.get("timestamp") or record.get("uploaded_at") or datetime.now().isoformat(timespec="seconds")
                try:
                    uploaded_at = datetime.fromisoformat(event_origin.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    uploaded_at = datetime.fromisoformat(record.get("uploaded_at") or datetime.now().isoformat(timespec="seconds"))
                occurred_at = uploaded_at + timedelta(seconds=elapsed)
                event_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"
                event_type = "MOTION_ANOMALY" if peak["motion_energy"] > motion_threshold else "DENSITY_INCREASE"
                description = (f"Abnormal motion persisted for {len(run)/SAMPLE_FPS:.1f} seconds." if event_type == "MOTION_ANOMALY"
                               else "Crowd density increased above this clip's initial baseline.")
                events.append({"id": event_id, "event_id": event_id, "evidence_id": evidence_id,
                    "incident_id": record["incident_id"], "timestamp_seconds": elapsed,
                    "timestamp_label": f"{int(elapsed)//60:02d}:{int(elapsed)%60:02d}",
                    "occurred_at": occurred_at.isoformat(timespec="seconds"), "timestamp": occurred_at.isoformat(timespec="seconds"),
                    "time": occurred_at.strftime("%H:%M:%S"), "event": description, "description": description,
                    "type": event_type, "severity": "MEDIUM", "source": record.get("camera_name") or record.get("source"),
                    "sourceType": "AUTHORITY", "signals": {k: peak[k] for k in ("motion_energy", "density", "persistence", "velocity")}})

        store.update_evidence_record(evidence_id, stage="Merging timeline")
        incident_update = store.apply_camera_signals(
            f"evidence_{evidence_id}", record["incident_id"],
            {"density": float(np.mean([s["density"] for s in samples])),
             "motion_anomaly": max(s["motion_anomaly"] for s in samples),
             "persistence": max(s["persistence"] for s in samples),
             "velocity": float(np.mean([s["velocity"] for s in samples]))},
            {"camera_id": f"evidence_{evidence_id}", "evidence_id": evidence_id,
             "backend": detector.backend, "model": detector.model_name,
             "person_count": max(s["person_count"] for s in samples),
             "avg_confidence": float(np.mean([s["confidence"] for s in samples]))})
        timeline = store.merge_into_timeline(record["incident_id"], events)
        analysis = {"samples": samples, "events": events, "duration_seconds": round(duration, 2),
                   "analyzed_duration_seconds": round(duration, 2),
                   "backend": detector.backend, "model": detector.model_name,
                   "metrics": {"person_count": max(s["person_count"] for s in samples),
                       "density": max(s["density"] for s in samples), "motion": max(s["motion_energy"] for s in samples),
                       "persistence": max(s["persistence"] for s in samples),
                       "confidence": max(s["confidence"] for s in samples)},
                   "baseline": {"motion": round(motion_threshold, 4), "density": round(density_threshold, 3)},
                   "timeline": timeline, "incident_reassessment": incident_update,
                   "width": width, "height": height}
        store.update_evidence_record(evidence_id, status="ANALYZED", stage="Timeline merged", analysis=analysis, error=None)
    except Exception as exc:
        store.update_evidence_record(evidence_id, status="FAILED", stage="Analysis failed", error=str(exc),
                                     failure_message="Could not analyze evidence. Original file is preserved.")
    finally:
        if capture is not None:
            capture.release()


@router.post("/incidents/{incident_id}/evidence")
async def upload_evidence(incident_id: str, video: UploadFile = File(...), source: str = Form("Authority Upload"),
                          location: Optional[str] = Form(None), timestamp: Optional[str] = Form(None),
                          camera_name: Optional[str] = Form(None), description: Optional[str] = Form(None)) -> Dict:
    if not store.get_incident(incident_id):
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    evidence_id = store.next_evidence_id()
    folder = UPLOAD_DIR / evidence_id
    folder.mkdir(parents=True, exist_ok=True)
    suffix = Path(video.filename or "evidence.mp4").suffix.lower() or ".mp4"
    filename = Path(video.filename or f"{evidence_id}{suffix}").name
    target = folder / f"original{suffix}"
    digest = hashlib.sha256()
    size = 0
    try:
        with target.open("wb") as output:
            while chunk := await video.read(1024 * 1024):
                size += len(chunk)
                if size > 512 * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="Video exceeds 512 MB limit")
                digest.update(chunk)
                output.write(chunk)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    finally:
        await video.close()
    uploaded_at = datetime.now().isoformat(timespec="seconds")
    record = {"evidence_id": evidence_id, "incident_id": incident_id, "filename": filename,
        "source": source, "location": location, "timestamp": timestamp, "camera_name": camera_name,
        "description": description, "uploaded_at": uploaded_at, "status": "UPLOADED", "stage": "Hashing complete",
        "sha256": digest.hexdigest(), "size_bytes": size, "duration_seconds": None,
        "video_url": f"/videos/evidence/{evidence_id}/original{suffix}"}
    store.add_evidence_record(record)
    threading.Thread(target=_analyze, args=(evidence_id, target), daemon=True, name=f"evidence-{evidence_id}").start()
    return record


@router.get("/incidents/{incident_id}/evidence")
def incident_evidence(incident_id: str) -> Dict:
    if not store.get_incident(incident_id):
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return {"incident_id": incident_id, "evidence": store.get_evidence_records(incident_id)}


@router.get("/evidence/item/{evidence_id}")
def evidence_item(evidence_id: str) -> Dict:
    record = store.get_evidence_record(evidence_id)
    if not record:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return record


@router.get("/sources/{incident_id}")
def source_graph(incident_id: str, live: bool = Query(default=False)) -> Dict:
    incident = store.get_incident(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    sources = list(store.get_sources(incident_id))
    if live:
        # Optional live enrichment: attached as REPORTED news nodes.
        try:
            result = news.fetch_news(
                incident.get("location", ""), set(), incident.get("type", "")
            )
            known = {s.get("id") for s in sources}
            for item in result.get("items", []):
                if item["id"] not in known:
                    sources.append(item)
        except Exception:
            pass

    nodes = [
        {"id": incident_id, "label": incident.get("type", incident_id), "type": "incident"}
    ]
    edges = []
    for source in sources:
        node_type = SOURCE_TYPE_MAP.get(source.get("source"), "other")
        nodes.append(
            {
                "id": source["id"],
                "label": source.get("label", source["id"]),
                "type": node_type,
                "status": source.get("status"),
                "credibility": source.get("credibility"),
                "location": source.get("location"),
                "timestamp": source.get("timestamp"),
                "url": source.get("url"),
                "provider": source.get("provider"),
                "title": source.get("title"),
            }
        )
        edges.append(
            {
                "source": source["id"],
                "target": incident_id,
                "relation": source.get("status", "supports"),
                "weight": source.get("credibility", 0.5),
            }
        )

    return {"incident_id": incident_id, "nodes": nodes, "edges": edges}
