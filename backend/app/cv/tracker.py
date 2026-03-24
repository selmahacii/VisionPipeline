from typing import List, Dict, Any, Optional
import time
import random
from loguru import logger

# Attempt to import deep-sort-realtime
try:
    from deep_sort_realtime.deepsort_tracker import DeepSort
    HAS_DEEPSORT = True
except ImportError:
    HAS_DEEPSORT = False
    logger.warning("DeepSORT not installed. Falling back to Mock Tracker.")

class ObjectTracker:
    def __init__(self, max_age: int = 30):
        self.max_age = max_age
        self.tracker = None
        
        if HAS_DEEPSORT:
            try:
                self.tracker = DeepSort(
                    max_age=max_age, 
                    n_init=3, 
                    nms_max_overlap=1.0, 
                    max_cosine_distance=0.2, 
                    nn_budget=None, 
                    override_track_class=None, 
                    clock=None, 
                    today=None
                )
                logger.info("DeepSORT tracker initialized.")
            except Exception as e:
                logger.error(f"Failed to intialize DeepSORT: {e}. Switching to Mock.")
                self.tracker = None
        else:
            logger.info("ObjectTracker initialized in MOCK mode.")
            self.mock_tracks = {} # {id: last_updated_time}

    def update(self, detections: List[Dict[str, Any]], frame: Any) -> List[Dict[str, Any]]:
        """
        Update tracker with new detections and return current tracks.
        """
        if self.tracker:
            # REAL TRACKING
            # Convert to [ [x, y, w, h], confidence, class_name ]
            ds_detections = []
            for d in detections:
                bbox = d["bbox"]
                w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
                ds_detections.append(([bbox[0], bbox[1], w, h], d["confidence"], d["class_name"]))
            
            tracks = self.tracker.update_tracks(ds_detections, frame=frame)
            
            tracked_results = []
            for track in tracks:
                if not track.is_confirmed():
                    continue
                
                track_id = track.track_id
                # Track original detector info if possible, or use current
                tracked_results.append({
                    "track_id": int(track_id) if str(track_id).isdigit() else track_id,
                    "bbox": track.to_ltrb().tolist(),
                    "class_name": track.get_det_class() or "unknown",
                    "confidence": track.get_det_conf() or 0.0
                })
            
            return tracked_results
        
        else:
            # MOCK TRACKING (Persistent ID Simulation)
            # We assign track IDs to detections if we don't have a real tracker.
            # Simple heuristic: try to match by proximity if we really wanted to, 
            # but for a mock, we'll just assign IDs (1, 2, 3...) that persist.
            
            tracked_results = []
            for i, d in enumerate(detections):
                # Fake persistence for demo:
                # Assign ID based on order, simulate it's a 'tracked' object.
                # In a real mock, we would use IOU matching.
                tracked_results.append({
                    **d,
                    "track_id": i + 1 # simplistic but works for mock testing
                })
            
            return tracked_results
