"""Real OpenCV detection layer.

Backends, tried in order:
  1. Ultralytics YOLO (only if CV_USE_YOLO=1 and a local model loads)
  2. OpenCV HOG people detector (bundled with opencv-python, no download)
  3. MOG2 background-subtraction blob counting (always available)

Everything fails soft: if a backend cannot load we move to the next one, and the
server still starts. Motion numbers are always computed with OpenCV.
"""

from __future__ import annotations

import os
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

# Detection is run on a downscaled copy of the frame so it stays cheap on CPU.
DETECT_WIDTH = 480
MIN_BLOB_AREA = 120
YOLO_CONF = 0.25


class Detector:
    def __init__(self, use_yolo: Optional[bool] = None) -> None:
        self.backend = "blob"
        self._yolo = None
        self.model_name: Optional[str] = None
        self._hog: Optional[cv2.HOGDescriptor] = None

        if use_yolo is None:
            # YOLO is the primary detector by default; set CV_USE_YOLO=0 to force
            # the OpenCV-native HOG/MOG2 path.
            use_yolo = os.getenv("CV_USE_YOLO", "1") == "1"

        if use_yolo:
            self._try_load_yolo()
        if self.backend == "blob":
            self._try_load_hog()

        # Background subtractor for motion + blob counting (always on).
        self._mog = cv2.createBackgroundSubtractorMOG2(
            history=300, varThreshold=24, detectShadows=False
        )
        # -1 lets MOG2 adapt automatically; 0 freezes the learned background.
        self._learning_rate = -1.0

    def freeze_background(self) -> None:
        """Stop background adaptation so a slow-moving crowd is not absorbed."""
        self._learning_rate = 0.0

    def warm_background(self, frame: np.ndarray) -> None:
        """Train only the background model (no YOLO/HOG inference) - cheap warmup."""
        small = self._downscale(frame)
        self._mog.apply(small, learningRate=self._learning_rate)

    # ------------------------------------------------------------------ loaders
    def _try_load_yolo(self) -> None:
        primary = os.getenv("YOLO_MODEL", "yolo26n.pt")
        candidates = [primary, "yolo26n.pt", "yolo11n.pt", "yolov8n.pt"]
        seen = set()
        for model_path in candidates:
            if not model_path or model_path in seen:
                continue
            seen.add(model_path)
            try:
                from ultralytics import YOLO  # type: ignore

                model = YOLO(model_path)
                # Warm up so the first real frames are not slow.
                model.predict(np.zeros((320, 320, 3), dtype=np.uint8), verbose=False, classes=[0])
                self._yolo = model
                self.backend = "yolo"
                self.model_name = model_path
                return
            except Exception:
                continue
        self._yolo = None
        self.model_name = None

    def _try_load_hog(self) -> None:
        try:
            hog = cv2.HOGDescriptor()
            hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
            self._hog = hog
            self.backend = "hog"
        except Exception:
            self._hog = None
            self.backend = "blob"

    # ------------------------------------------------------------------ detect
    def detect(self, frame: np.ndarray) -> Dict:
        """Return per-frame detection metrics for one frame."""
        small = self._downscale(frame)
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

        # Cheap, always-available signal.
        fg = self._mog.apply(small, learningRate=self._learning_rate)
        _, fg = cv2.threshold(fg, 200, 255, cv2.THRESH_BINARY)
        fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))

        blob_count, centroids = self._blob_stats(fg)
        foreground_ratio = float(np.count_nonzero(fg)) / float(fg.size) if fg.size else 0.0

        person_count = blob_count
        detections: List[Tuple[int, int, int, int]] = []
        avg_confidence = 0.0

        if self.backend == "yolo" and self._yolo is not None:
            try:
                result = self._yolo.predict(small, verbose=False, classes=[0], conf=YOLO_CONF)
                boxes = result[0].boxes
                if boxes is not None:
                    xyxy = boxes.xyxy.cpu().numpy()
                    confs = boxes.conf.cpu().numpy()
                    detections = [tuple(int(v) for v in b) for b in xyxy]
                    person_count = len(detections)
                    avg_confidence = float(np.mean(confs)) if len(confs) else 0.0
                    # Detections give a reliable density signal; keep the larger of
                    # YOLO and the blob counter only when YOLO clearly under-counts.
                    if person_count == 0 and blob_count > 0:
                        person_count = blob_count
            except Exception:
                person_count = blob_count
                avg_confidence = 0.0
        elif self.backend == "hog" and self._hog is not None:
            try:
                rects, weights = self._hog.detectMultiScale(
                    small, winStride=(8, 8), padding=(8, 8), scale=1.05
                )
                detections = [tuple(int(v) for v in r) for r in rects]
                if len(weights):
                    avg_confidence = float(np.mean(weights))
                # HOG can double-count; keep it but blend with blobs for stability.
                person_count = max(len(detections), blob_count) if rects else blob_count
            except Exception:
                person_count = blob_count

        return {
            "person_count": int(person_count),
            "blob_count": int(blob_count),
            "foreground_ratio": round(foreground_ratio, 4),
            "avg_confidence": round(avg_confidence, 3),
            "centroids": centroids,
            "detections": detections,
            "backend": self.backend,
            "gray": gray,  # reused by the processor for frame differencing
        }

    # ------------------------------------------------------------------ helpers
    @staticmethod
    def _downscale(frame: np.ndarray) -> np.ndarray:
        h, w = frame.shape[:2]
        if w <= DETECT_WIDTH:
            return frame
        scale = DETECT_WIDTH / float(w)
        return cv2.resize(frame, (DETECT_WIDTH, int(h * scale)), interpolation=cv2.INTER_AREA)

    @staticmethod
    def _blob_stats(fg: np.ndarray) -> Tuple[int, List[Tuple[float, float]]]:
        contours, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        centroids: List[Tuple[float, float]] = []
        for contour in contours:
            if cv2.contourArea(contour) < MIN_BLOB_AREA:
                continue
            moments = cv2.moments(contour)
            if moments["m00"] == 0:
                continue
            centroids.append((moments["m10"] / moments["m00"], moments["m01"] / moments["m00"]))
        return len(centroids), centroids
