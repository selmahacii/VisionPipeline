import json
import math
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
from loguru import logger
from app.cv.detector import YOLODetector
from app.cv.tracker import ObjectTracker
from app.db.session import AsyncSessionLocal
from app.models.detection import DetectionEvent

class MedallionPipeline:
    """
    Production-grade Data Engineering Pipeline for Computer Vision.
    Transformation Flow:
    BRONZE (Raw) -> SILVER (Cleaned/Enriched) -> GOLD (Aggregated/Metrics)
    """

    def __init__(self, stream_id: str):
        self.stream_id = stream_id
        self.detector = YOLODetector()
        self.tracker = ObjectTracker()
        
        # PSI (Population Stability Index) state
        # Initial expected distribution (from training/prior)
        self.expected_distribution = {0.1: 0.1, 0.3: 0.2, 0.5: 0.3, 0.7: 0.2, 0.9: 0.2}
        self.actual_counts = {k: 0 for k in self.expected_distribution.keys()}
        self.total_scanned = 0

    async def process_bronze(self, raw_frame_bytes: bytes) -> Dict[str, Any]:
        """
        LAYER 1: BRONZE (RAW)
        Goal: Capture the source of truth as quickly as possible.
        Metadata is appended for downstream traceability.
        """
        message = {
            "stream_id": self.stream_id,
            "timestamp": datetime.now().isoformat(),
            "raw_data_size": len(raw_frame_bytes),
            "frame_type": "jpeg",
            "layer": "BRONZE"
        }
        # In production: Produce to Kafka topic 'vision_bronze'
        logger.debug(f"[Pipeline] Bronze Ingested: {len(raw_frame_bytes)} bytes")
        return message

    async def process_silver(self, bronze_data: Dict[str, Any], frame_img: Any) -> List[Dict[str, Any]]:
        """
        LAYER 2: SILVER (CLEANED & ENRICHED)
        Goal: Run CV models and normalize results.
        Filters by confidence and attaches IDs via Tracking.
        """
        # 1. Detection
        detections = await self.detector.detect(frame_img)
        
        # 2. Tracking
        tracks = self.tracker.update(detections, frame_img)
        
        # 3. Enrichment & Normalization
        enriched_data = []
        for t in tracks:
            enriched_data.append({
                "stream_id": self.stream_id,
                "timestamp": datetime.now().isoformat(),
                "track_id": t["track_id"],
                "class_name": t["class_name"],
                "confidence": t["confidence"],
                "bbox": t["bbox"],
                "layer": "SILVER"
            })
            
            # Update drift metrics (streaming update)
            self._update_drift_distribution(t["confidence"])
            
        logger.debug(f"[Pipeline] Silver Processed: {len(enriched_data)} tracks")
        return enriched_data

    async def compute_gold(self) -> Dict[str, Any]:
        """
        LAYER 3: GOLD (AGGREGATED & MONITORING)
        Goal: Pre-compute KPIs, drift scores (PSI), and report status.
        Final destination: TimescaleDB and Prometheus dashboards.
        """
        psi_score = self._calculate_psi()
        
        gold_metrics = {
            "stream_id": self.stream_id,
            "window_end": datetime.now().isoformat(),
            "psi_score": psi_score,
            "drift_detected": psi_score > 0.4,
            "recommendation": "Retrain immediately" if psi_score > 0.4 else "Healthy",
            "layer": "GOLD"
        }
        
        logger.info(f"[Pipeline] Gold Computed: PSI={psi_score:.4f}")
        
        # Reset drift window after reporting (optional, can be rolling)
        # self._reset_drift_window()
        
        return gold_metrics

    def _update_drift_distribution(self, confidence: float):
        """Streaming update of the confidence distribution for PSI."""
        # Bucketing
        for bucket in sorted(self.expected_distribution.keys(), reverse=True):
            if confidence >= bucket:
                self.actual_counts[bucket] += 1
                break
        self.total_scanned += 1

    def _calculate_psi(self) -> float:
        """
        PSI Formula implementation:
        PSI = Σ (actual % - expected %) * ln(actual % / expected %)
        """
        if self.total_scanned == 0:
            return 0.0

        psi = 0.0
        for bucket, expected_pct in self.expected_distribution.items():
            actual_pct = (self.actual_counts[bucket] / self.total_scanned) or 0.0001
            # Smoothing (prevent division by zero or log zero)
            exp_pct = expected_pct or 0.0001
            
            # Formula step
            psi += (actual_pct - exp_pct) * math.log(actual_pct / exp_pct)
            
        return psi

    def _reset_drift_window(self):
        self.actual_counts = {k: 0 for k in self.expected_distribution.keys()}
        self.total_scanned = 0
