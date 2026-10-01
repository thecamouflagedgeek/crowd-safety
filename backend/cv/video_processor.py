"""Continuous multi-camera computer-vision pipeline.

Each camera runs in its own daemon thread:
    read frame -> OpenCV detection -> density / motion / velocity
    -> normalize -> push signals to the store -> incident risk is re-derived.

If a video file is missing it is generated once with OpenCV (a deterministic
synthetic crowd). If a video cannot be opened at all, the processor degrades to
seeded demo metrics and keeps the server alive.

Multiple cameras can feed the same incident; the store averages their signals,
so camera_02 "confirms" the congestion seen by camera_01.
"""

from __future__ import annotations

import json
import os
import threading
import time
from collections import deque
from pathlib import Path
from typing import Dict, List, Optional

import cv2
import numpy as np

import store
from cv.detector import Detector


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent

VIDEO_DIR = PROJECT_ROOT / "videos"
VIDEO_DIR.mkdir(parents=True, exist_ok=True)

BASE_DIR = BACKEND_DIR
ASSET_DIR = BASE_DIR / "assets"

PROCESS_FPS = float(os.getenv("CV_PROCESS_FPS", "10"))
LOOP_VIDEO = os.getenv("CV_LOOP_VIDEO", "1") == "1"
START_AT = float(os.getenv("CV_START_AT", "0.55"))

FRAME_W, FRAME_H, VIDEO_FPS = 640, 360, 20
# Frames fed through the detector at startup (no publishing) to train MOG2.
WARMUP_FRAMES = 45
# Foreground ratio (share of frame pixels) that maps to density 1.0.
FG_REF = 0.24

# Camera -> incident mapping (config lives here to avoid import cycles).
CAMERA_CONFIG: List[Dict] = [
    {
        "id": "camera_01",
        "label": "CCTV Camera 01",
        "video": "camera_01.mp4",
        "zone_id": "zone_gate_3",
        "location": "Gate 3",
        "incident_id": "INC001",
        "confirms": ["INC001"],
        "person_capacity": 46,     # person count that maps to density 1.0
    },
    {
        "id": "camera_02",
        "label": "CCTV Camera 02",
        "video": "camera_02.mp4",
        "zone_id": "zone_gate_3",
        "location": "Gate 3",
        "incident_id": "INC001",
        "confirms": ["INC001", "INC002"],
        "person_capacity": 42,
    },
]

# ----------------------------------------------------------------------------- story
# (progress, person_count, speed_scale). Deterministic synthetic crowd script.
STORY_CAMERA_01 = [
    (0.00, 6, 1.00),
    (0.15, 8, 1.00),
    (0.30, 16, 0.80),
    (0.45, 26, 0.50),
    (0.60, 36, 0.22),
    (0.78, 42, 0.15),
    (0.90, 40, 0.18),
    (1.00, 37, 0.20),
]
STORY_CAMERA_02 = [
    (0.00, 4, 1.00),
    (0.20, 7, 1.00),
    (0.35, 13, 0.85),
    (0.55, 24, 0.55),
    (0.72, 33, 0.25),
    (0.88, 36, 0.18),
    (1.00, 30, 0.30),
]


def _interp_story(story, progress: float):
    progress = max(0.0, min(1.0, progress))
    for (p0, c0, s0), (p1, c1, s1) in zip(story, story[1:]):
        if p0 <= progress <= p1:
            span = (p1 - p0) or 1.0
            t = (progress - p0) / span
            return int(round(c0 + (c1 - c0) * t)), s0 + (s1 - s0) * t
    return int(story[-1][1]), story[-1][2]


ASSET_DIR = BASE_DIR / "assets"
_SPRITE_CACHE = None


def load_person_sprites():
    """Load alpha-matted person cut-outs (real figures) for the demo crowd."""
    global _SPRITE_CACHE
    if _SPRITE_CACHE is not None:
        return _SPRITE_CACHE
    sprites = []
    try:
        sheet_path = ASSET_DIR / "person_sprites.png"
        meta_path = ASSET_DIR / "person_sprites.json"
        if sheet_path.exists() and meta_path.exists():
            sheet = cv2.imread(str(sheet_path), cv2.IMREAD_UNCHANGED)
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            for box in meta.get("sprites", []):
                x, y, w, h = box["x"], box["y"], box["w"], box["h"]
                crop = sheet[y : y + h, x : x + w]
                if crop.shape[2] == 4:
                    sprites.append(crop)
    except Exception:
        sprites = []
    _SPRITE_CACHE = sprites
    return sprites


def _paste_sprite(frame, sprite, cx: int, ground_y: int, target_h: int, brightness: float) -> None:
    """Alpha-composite one sprite with its feet on ground_y."""
    h, w = sprite.shape[:2]
    scale = target_h / float(h)
    new_w, new_h = max(2, int(w * scale)), max(2, int(h * scale))
    resized = cv2.resize(sprite, (new_w, new_h), interpolation=cv2.INTER_AREA)
    if brightness != 1.0:
        bgr = resized[:, :, :3].astype(np.float32) * brightness
        resized = np.dstack([np.clip(bgr, 0, 255).astype(np.uint8), resized[:, :, 3]])

    x0 = int(cx - new_w / 2)
    y0 = int(ground_y - new_h)
    fx0, fy0 = max(0, x0), max(0, y0)
    fx1, fy1 = min(FRAME_W, x0 + new_w), min(FRAME_H, y0 + new_h)
    if fx1 <= fx0 or fy1 <= fy0:
        return
    sx0, sy0 = fx0 - x0, fy0 - y0
    patch = resized[sy0 : sy0 + (fy1 - fy0), sx0 : sx0 + (fx1 - fx0)]
    alpha = (patch[:, :, 3:4].astype(np.float32)) / 255.0
    roi = frame[fy0:fy1, fx0:fx1].astype(np.float32)
    frame[fy0:fy1, fx0:fx1] = (patch[:, :, :3].astype(np.float32) * alpha + roi * (1 - alpha)).astype(np.uint8)


def _background() -> np.ndarray:
    """A simple plaza/gate scene (sky gradient, ground, perspective lines, gate)."""
    frame = np.zeros((FRAME_H, FRAME_W, 3), dtype=np.uint8)
    for y in range(FRAME_H):
        ratio = y / FRAME_H
        frame[y, :] = (46 + int(18 * ratio), 48 + int(16 * ratio), 54 + int(14 * ratio))
    horizon = int(FRAME_H * 0.30)
    cv2.rectangle(frame, (0, horizon), (FRAME_W, FRAME_H), (54, 52, 50), -1)
    # Perspective ground lines converging on the gate.
    for i in range(-6, 7):
        x = FRAME_W // 2 + i * 90
        cv2.line(frame, (x, FRAME_H), (FRAME_W // 2 + i * 22, horizon), (66, 64, 62), 1)
    for j in range(1, 6):
        y = horizon + int((FRAME_H - horizon) * (j / 6.0) ** 1.6)
        cv2.line(frame, (0, y), (FRAME_W, y), (66, 64, 62), 1)
    # Gate structure.
    cv2.rectangle(frame, (FRAME_W // 2 - 95, horizon - 46), (FRAME_W // 2 + 95, horizon + 6), (78, 78, 82), -1)
    cv2.rectangle(frame, (FRAME_W // 2 - 55, horizon - 34), (FRAME_W // 2 + 55, horizon + 6), (30, 32, 36), -1)
    cv2.putText(frame, "ENTRY", (FRAME_W // 2 - 26, horizon - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)
    return frame


def generate_synthetic_video(path: Path, story, seed: int) -> bool:
    """Write a deterministic crowd video (real person sprites) so YOLO has real targets."""
    try:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(path), fourcc, VIDEO_FPS, (FRAME_W, FRAME_H))
        if not writer.isOpened():
            return False

        rng = np.random.default_rng(seed)
        total = int(VIDEO_FPS * 16)  # ~16 seconds
        max_people = max(point[1] for point in story)
        sprites = load_person_sprites()
        horizon = int(FRAME_H * 0.30)

        people = []
        for index in range(max_people):
            # Higher on screen = further away = smaller.
            depth = float(rng.uniform(0.0, 1.0))
            people.append(
                {
                    "sprite": index % len(sprites) if sprites else 0,
                    "x": float(rng.uniform(30, FRAME_W - 30)),
                    "y": float(rng.uniform(horizon + 24, FRAME_H - 6)),
                    "angle": float(rng.uniform(-np.pi, np.pi)),
                    "scale": 0.62 + 0.55 * depth + float(rng.uniform(-0.06, 0.06)),
                    "brightness": float(rng.uniform(0.78, 1.18)),
                    "r": float(rng.uniform(7, 11)),
                }
            )

        for frame_index in range(total):
            progress = frame_index / float(total)
            target_count, speed = _interp_story(story, progress)
            frame = _background()

            active = people[:target_count]
            for person in active:
                step = 2.6 * speed
                person["x"] += float(np.cos(person["angle"])) * step
                person["y"] += float(np.sin(person["angle"])) * step * 0.35
                if person["x"] < 24 or person["x"] > FRAME_W - 24:
                    person["angle"] = np.pi - person["angle"]
                if person["y"] < horizon + 20 or person["y"] > FRAME_H - 6:
                    person["angle"] = -person["angle"]
                person["x"] = float(np.clip(person["x"], 24, FRAME_W - 24))
                person["y"] = float(np.clip(person["y"], horizon + 20, FRAME_H - 6))

            # Painter's algorithm: draw the furthest (lowest y) first.
            for person in sorted(active, key=lambda p: p["y"]):
                height = 96.0 * person["scale"]
                if sprites:
                    _paste_sprite(
                        frame,
                        sprites[person["sprite"]],
                        int(person["x"]),
                        int(person["y"]),
                        int(height),
                        person["brightness"],
                    )
                else:
                    radius = int(6 + 6 * person["scale"])
                    cv2.circle(frame, (int(person["x"]), int(person["y"])), radius, (198, 202, 208), -1)
                    cv2.circle(frame, (int(person["x"]), int(person["y"])), radius, (120, 128, 138), 2)

            writer.write(frame)

        writer.release()
        return True
    except Exception:
        return False


def ensure_video(path: Path, story, seed: int) -> bool:
    if path.exists() and path.stat().st_size > 0:
        return True
    return generate_synthetic_video(path, story, seed)


# ------------------------------------------------------------------- processor
class CameraProcessor(threading.Thread):
    def __init__(self, config: Dict, story) -> None:
        super().__init__(daemon=True, name=f"cv-{config['id']}")
        self.config = config
        self.story = story
        # Detector is built inside the thread so a slow/absent YOLO model never
        # delays FastAPI startup (the API serves seeded data immediately).
        self.detector: Optional[Detector] = None
        self.video_path = VIDEO_DIR / config["video"]
        self.status = "starting"
        self.running = True
        self.last_metrics: Dict = {}
        self._prev_gray: Optional[np.ndarray] = None
        self._prev_centroid = None
        self._motion_ref = 0.0030
        self._velocity_ref = 0.15
        self._motion_ema = None
        self._shift_ema = None
        self._density_ema = None
        self._density_history = deque(maxlen=30)

    # ------------------------------------------------------------------ helpers
    def _signals(self, detection: Dict, raw_motion: float, centroid_shift: float) -> Dict:
        count = detection["person_count"]
        fg_ratio = detection["foreground_ratio"]
        person_capacity = float(self.config["person_capacity"])

        count_score = min(1.0, count / person_capacity)
        fg_score = min(1.0, fg_ratio / FG_REF)
        density_raw = max(0.0, min(1.0, 0.6 * count_score + 0.4 * fg_score))
        # EMA smooths brief detection drop-outs (e.g. across loop restarts).
        self._density_ema = (
            density_raw
            if self._density_ema is None
            else 0.7 * self._density_ema + 0.3 * density_raw
        )
        density = self._density_ema

        # Smooth raw signals so single noisy frames do not swing the score.
        self._motion_ema = (
            raw_motion if self._motion_ema is None else 0.8 * self._motion_ema + 0.2 * raw_motion
        )
        self._shift_ema = (
            centroid_shift
            if self._shift_ema is None
            else 0.8 * self._shift_ema + 0.2 * centroid_shift
        )

        # References are the maximum seen (free-flowing movement).
        self._motion_ref = max(self._motion_ref, self._motion_ema)
        self._velocity_ref = max(self._velocity_ref, self._shift_ema)

        still = 1.0 - 0.7 * (self._motion_ema / (self._motion_ref + 1e-6))
        slow = 1.0 - 0.8 * (self._shift_ema / (self._velocity_ref + 1e-6))
        motion_anomaly = max(0.0, min(1.0, 0.65 * still + 0.35 * slow))

        velocity = min(1.0, self._shift_ema / (self._velocity_ref + 1e-6))

        self._density_history.append(density)
        persistence = sum(1 for value in self._density_history if value >= 0.4) / max(
            1, len(self._density_history)
        )

        return {
            "density": round(density, 3),
            "motion_anomaly": round(motion_anomaly, 3),
            "persistence": round(persistence, 3),
            "velocity": round(velocity, 3),
            "raw": {
                "person_count": count,
                "blob_count": detection["blob_count"],
                "foreground_ratio": fg_ratio,
                "motion_magnitude": round(raw_motion, 4),
                "centroid_shift": round(centroid_shift, 3),
                "avg_confidence": detection.get("avg_confidence", 0.0),
                "camera_id": self.config["id"],
                "zone_id": self.config["zone_id"],
                "location": self.config["location"],
                "timestamp": time.strftime("%H:%M:%S"),
                "backend": detection["backend"],
                "model": self.detector.model_name if self.detector else None,
            },
        }

    def _open_capture(self) -> Optional[cv2.VideoCapture]:
        if not ensure_video(self.video_path, self.story, hash(self.config["id"]) % 1000):
            return None
        capture = cv2.VideoCapture(str(self.video_path))
        if not capture.isOpened():
            capture.release()
            return None
        return capture

    @staticmethod
    def _seek_start(capture: cv2.VideoCapture) -> None:
        total = capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0
        if total > 0 and START_AT > 0:
            capture.set(cv2.CAP_PROP_POS_FRAMES, int(total * START_AT))

    # -------------------------------------------------------------------- loop
    def run(self) -> None:
        if self.detector is None:
            try:
                self.detector = Detector()
            except Exception:
                self.status = "fallback_seeded_metrics"
                self._run_fallback()
                return
        capture = self._open_capture()
        if capture is None:
            self.status = "fallback_seeded_metrics"
            self._run_fallback()
            return

        # Warm up on the sparse opening frames (near-empty background), then
        # freeze it and seek into the congested section. This keeps the crowd
        # as foreground instead of being absorbed into the background model.
        for _ in range(WARMUP_FRAMES):
            ok, frame = capture.read()
            if not ok:
                break
            self.detector.warm_background(frame)
        self.detector.freeze_background()
        self._seek_start(capture)
        self._prev_gray = None
        self._prev_centroid = None

        self.status = "running"
        interval = 1.0 / max(1.0, PROCESS_FPS)
        processed = 0
        try:
            while self.running:
                loop_start = time.time()
                ok, frame = capture.read()
                if not ok or frame is None:
                    if not LOOP_VIDEO:
                        break
                    capture.release()
                    capture = self._open_capture()
                    if capture is None:
                        self.status = "fallback_seeded_metrics"
                        self._run_fallback()
                        return
                    self._seek_start(capture)
                    self._prev_gray = None
                    self._prev_centroid = None
                    continue

                detection = self.detector.detect(frame)
                gray = detection.pop("gray")
                gray = cv2.resize(gray, (160, 90))

                raw_motion = 0.0
                centroid_shift = 0.0
                if self._prev_gray is not None:
                    diff = cv2.absdiff(gray, self._prev_gray)
                    raw_motion = float(np.mean(diff)) / 255.0
                centroids = detection.get("centroids") or []
                if centroids:
                    cx = sum(c[0] for c in centroids) / len(centroids)
                    cy = sum(c[1] for c in centroids) / len(centroids)
                    if getattr(self, "_prev_centroid", None) is not None:
                        px, py = self._prev_centroid
                        centroid_shift = ((cx - px) ** 2 + (cy - py) ** 2) ** 0.5 / 160.0
                    self._prev_centroid = (cx, cy)

                signals = self._signals(detection, raw_motion, centroid_shift)
                self.last_metrics = signals["raw"]

                store.apply_camera_signals(
                    self.config["id"], self.config["incident_id"], signals, signals["raw"]
                )

                self._prev_gray = gray
                processed += 1

                elapsed = time.time() - loop_start
                if elapsed < interval:
                    time.sleep(interval - elapsed)
        except Exception:
            self.status = "error_degraded"
        finally:
            try:
                capture.release()
            except Exception:
                pass

    def _run_fallback(self) -> None:
        """Seeded metrics keep the incident alive if video/OpenCV fails."""
        while self.running:
            incident = store.get_incident(self.config["incident_id"]) or {}
            seed_density = incident.get("density", 70) / 100.0
            signals = {
                "density": seed_density,
                "motion_anomaly": 0.7,
                "persistence": 0.8,
                "velocity": 0.25,
                "raw": {"person_count": 0, "backend": "seeded", "fallback": True},
            }
            store.apply_camera_signals(
                self.config["id"], self.config["incident_id"], signals, signals["raw"]
            )
            time.sleep(2.0)


PROCESSORS: Dict[str, CameraProcessor] = {}


def start_all() -> None:
    for config, story in zip(CAMERA_CONFIG, (STORY_CAMERA_01, STORY_CAMERA_02)):
        processor = CameraProcessor(config, story)
        PROCESSORS[config["id"]] = processor
        processor.start()


def stop_all() -> None:
    for processor in PROCESSORS.values():
        processor.running = False


def camera_status() -> List[Dict]:
    result = []
    for config in CAMERA_CONFIG:
        processor = PROCESSORS.get(config["id"])
        result.append(
            {
                "id": config["id"],
                "label": config["label"],
                "location": config["location"],
                "zone_id": config["zone_id"],
                "incident_id": config["incident_id"],
                "confirms": config.get("confirms", []),
                "video_url": f"/videos/{config['video']}",
                "status": processor.status if processor else "stopped",
                "backend": processor.detector.backend if processor and processor.detector else None,
                "model": processor.detector.model_name if processor and processor.detector else None,
                "metrics": processor.last_metrics if processor else {},
            }
        )
    return result
