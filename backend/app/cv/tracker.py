from typing import List, Dict, Any, Optional
import time
import random
from loguru import logger

# Tracking engine configuration
try:
    from deep_sort_realtime.deepsort_tracker import DeepSort
    TRACK_ENGINE_AVAILABLE = True
except ImportError:
    TRACK_ENGINE_AVAILABLE = False
    logger.warning("DeepSORT engine unavailable. Using CPU simulator.")

class ObjectTracker:
    def __init__(self, max_age: int = 30):
        self.max_age = max_age
        self.tracker = None
        
        if TRACK_ENGINE_AVAILABLE:
            try:
                self.tracker = DeepSort(
                    max_age=max_age, 
                    n_init=3, 
                    nms_max_overlap=1.0, 
                    max_cosine_distance=0.2
                )
                logger.debug("ObjectTracker engine initialized")
            except Exception as e:
                logger.error(f"Tracker initialization failed: {e}")
                self.tracker = None
        else:
            logger.info("ObjectTracker initialized in simulation mode")
            self.virtual_tracks = {}

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
            # Virtual ID assignment
            # Simple persistence simulation
            tracked_results = []
            for i, d in enumerate(detections):
                tracked_results.append({
                    **d,
                    "track_id": i + 1 
                })
            
            return tracked_results
