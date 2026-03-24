"""
DeepSORT Multi-Object Tracker

What is DeepSORT?
SORT (Simple Online and Realtime Tracking) uses Kalman filter to predict
object positions between frames. DeepSORT adds a re-identification (ReID)
network that extracts visual features from each detection — this allows
re-associating the same person/car even after occlusion.

Why tracking matters:
Detection alone gives you "there's a person at (x,y) in frame 42".
Tracking gives you "person ID#7 has been in view for 3.2 seconds,
entered from the left, and is now moving toward the exit".
This enables business logic: counting, zone analytics, dwell time.

Track lifecycle:
  New detection → Tentative (1-3 frames) → Confirmed → Lost → Deleted
  Track is only reported when Confirmed (reduces false positive IDs)
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Dict, Tuple
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check if deep_sort_realtime is available
try:
    from deep_sort_realtime.deepsort_tracker import DeepSort
    DEEPSORT_AVAILABLE = True
except ImportError:
    DEEPSORT_AVAILABLE = False
    logger.warning("deep_sort_realtime not installed — using simple tracker")


@dataclass
class TrackedObject:
    """A tracked object with persistent identity."""
    track_id: int
    class_id: int
    class_name: str
    confidence: float
    bbox: Dict[str, float]  # {"x1", "y1", "x2", "y2"}
    age: int  # Frames since first detection
    hits: int  # Total confirmed detections
    is_confirmed: bool


class DeepSORTTracker:
    """
    Multi-object tracker using DeepSORT algorithm.

    Each call to update():
    1. Receives new detections from YOLO
    2. Kalman filter predicts where existing tracks moved
    3. Hungarian algorithm matches predictions to new detections
    4. ReID features resolve ambiguous matches (occlusion recovery)
    5. Returns confirmed tracks with stable IDs
    """

    def __init__(
        self,
        max_age: int = 30,  # Frames before track is deleted
        min_hits: int = 3,  # Detections before track is confirmed
        max_cosine_distance: float = 0.4,  # ReID similarity threshold
    ):
        self.max_age = max_age
        self.min_hits = min_hits

        if DEEPSORT_AVAILABLE:
            self.tracker = DeepSort(
                max_age=max_age,
                n_init=min_hits,
                max_cosine_distance=max_cosine_distance,
            )
            logger.info("DeepSORT tracker initialized")
        else:
            self.tracker = None
            self._track_history: Dict[int, Dict] = {}
            self._next_id = 1
            logger.info("Simple mock tracker initialized")

    def update(
        self,
        detections: List,  # List of DetectionResult from detector
        frame: np.ndarray,
    ) -> List[TrackedObject]:
        """
        Update tracker with new detections.
        
        Args:
            detections: List of DetectionResult objects
            frame: BGR numpy array for ReID feature extraction
            
        Returns:
            List of all currently active tracked objects
        """
        if not detections:
            if self.tracker:
                self.tracker.update_tracks([], frame=frame)
            return []

        if self.tracker is None:
            return self._mock_update(detections)

        # Convert to DeepSORT format: [[x1,y1,w,h], confidence, class_id]
        raw_detections = []
        for det in detections:
            b = det.bbox
            x1, y1, x2, y2 = b["x1"], b["y1"], b["x2"], b["y2"]
            w, h = x2 - x1, y2 - y1
            raw_detections.append(
                ([x1, y1, w, h], det.confidence, det.class_id)
            )

        tracks = self.tracker.update_tracks(raw_detections, frame=frame)

        result = []
        for track in tracks:
            if not track.is_confirmed():
                continue

            ltrb = track.to_ltrb()
            result.append(TrackedObject(
                track_id=track.track_id,
                class_id=int(track.det_class) if track.det_class else 0,
                class_name=str(track.det_class) if track.det_class else "unknown",
                confidence=float(track.det_conf) if track.det_conf else 0.0,
                bbox={
                    "x1": float(ltrb[0]), "y1": float(ltrb[1]),
                    "x2": float(ltrb[2]), "y2": float(ltrb[3]),
                },
                age=track.age,
                hits=track.hits,
                is_confirmed=True,
            ))
        return result

    def _mock_update(self, detections: List) -> List[TrackedObject]:
        """Simple mock tracker for testing — assigns sequential IDs."""
        result = []
        for det in detections:
            # Use detection confidence to determine track ID
            # This creates consistent IDs for similar detections
            track_id = hash((det.class_id, int(det.bbox["x1"] / 50), int(det.bbox["y1"] / 50))) % 1000
            
            result.append(TrackedObject(
                track_id=track_id,
                class_id=det.class_id,
                class_name=det.class_name,
                confidence=det.confidence,
                bbox=det.bbox,
                age=1,
                hits=1,
                is_confirmed=True,
            ))
        return result


class SimpleTracker:
    """
    Simple centroid-based tracker for fallback when DeepSORT is unavailable.
    Uses IoU matching to associate detections across frames.
    """

    def __init__(
        self,
        max_age: int = 30,
        min_hits: int = 3,
        iou_threshold: float = 0.3,
    ):
        self.max_age = max_age
        self.min_hits = min_hits
        self.iou_threshold = iou_threshold
        self.tracks: Dict[int, Dict] = {}
        self._next_id = 1

    def _compute_iou(self, box1: Dict, box2: Dict) -> float:
        """Compute IoU between two boxes."""
        x1 = max(box1["x1"], box2["x1"])
        y1 = max(box1["y1"], box2["y1"])
        x2 = min(box1["x2"], box2["x2"])
        y2 = min(box1["y2"], box2["y2"])

        inter_area = max(0, x2 - x1) * max(0, y2 - y1)
        box1_area = (box1["x2"] - box1["x1"]) * (box1["y2"] - box1["y1"])
        box2_area = (box2["x2"] - box2["x1"]) * (box2["y2"] - box2["y1"])

        union_area = box1_area + box2_area - inter_area
        return inter_area / union_area if union_area > 0 else 0

    def update(
        self,
        detections: List,
        frame: Optional[np.ndarray] = None,
    ) -> List[TrackedObject]:
        """Update tracks with new detections using IoU matching."""
        # Match detections to existing tracks
        matched = set()
        updated_tracks = {}

        for det in detections:
            best_iou = 0
            best_track_id = None

            for track_id, track in self.tracks.items():
                if track_id in matched:
                    continue
                iou = self._compute_iou(det.bbox, track["bbox"])
                if iou > best_iou and iou > self.iou_threshold:
                    best_iou = iou
                    best_track_id = track_id

            if best_track_id is not None:
                # Update existing track
                track = self.tracks[best_track_id]
                track["bbox"] = det.bbox
                track["class_id"] = det.class_id
                track["class_name"] = det.class_name
                track["confidence"] = det.confidence
                track["hits"] += 1
                track["age"] = 0
                track["lost"] = 0
                matched.add(best_track_id)
                updated_tracks[best_track_id] = track
            else:
                # Create new track
                track_id = self._next_id
                self._next_id += 1
                updated_tracks[track_id] = {
                    "bbox": det.bbox,
                    "class_id": det.class_id,
                    "class_name": det.class_name,
                    "confidence": det.confidence,
                    "hits": 1,
                    "age": 0,
                    "lost": 0,
                }
                matched.add(track_id)

        # Age out unmatched tracks
        for track_id, track in self.tracks.items():
            if track_id not in matched:
                track["lost"] += 1
                if track["lost"] < self.max_age:
                    updated_tracks[track_id] = track

        self.tracks = updated_tracks

        # Return confirmed tracks
        result = []
        for track_id, track in self.tracks.items():
            if track["hits"] >= self.min_hits and track["lost"] == 0:
                result.append(TrackedObject(
                    track_id=track_id,
                    class_id=track["class_id"],
                    class_name=track["class_name"],
                    confidence=track["confidence"],
                    bbox=track["bbox"],
                    age=track["age"],
                    hits=track["hits"],
                    is_confirmed=True,
                ))
        return result


def get_tracker(
    use_deepsort: bool = True,
    max_age: int = 30,
    min_hits: int = 3,
) -> DeepSORTTracker:
    """Get tracker instance."""
    if use_deepsort and DEEPSORT_AVAILABLE:
        return DeepSORTTracker(max_age=max_age, min_hits=min_hits)
    else:
        return SimpleTracker(max_age=max_age, min_hits=min_hits)


if __name__ == "__main__":
    # Test the tracker
    tracker = get_tracker()
    print(f"Tracker initialized: {type(tracker).__name__}")
    
    # Create mock detections
    from detector import DetectionResult
    
    mock_detections = [
        DetectionResult(
            class_id=0,
            class_name="person",
            confidence=0.85,
            bbox={"x1": 100, "y1": 50, "x2": 200, "y2": 300},
        ),
        DetectionResult(
            class_id=2,
            class_name="car",
            confidence=0.92,
            bbox={"x1": 300, "y1": 200, "x2": 500, "y2": 350},
        ),
    ]
    
    tracks = tracker.update(mock_detections, None)
    print(f"Tracking {len(tracks)} objects")
    for track in tracks:
        print(f"  - ID={track.track_id} {track.class_name}: {track.confidence:.2f}")
