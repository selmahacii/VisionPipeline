from prometheus_client import Counter, Histogram, Gauge, Summary, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST
from typing import List, Dict, Any, Optional
from loguru import logger

# --- MODULE LEVEL REGISTRATION (AS REQUESTED) ---
# Global prometheus metrics registry
# Note: These are initialized once at import time.

# Total frames processed across all streams
frames_total = Counter(
    'vision_frames_processed_total', 
    'Total number of video frames processed',
    ['stream_id']
)

# Inference latency in seconds
inference_latency = Histogram(
    'vision_inference_latency_seconds',
    'Model inference latency (YOLOv8 + DeepSORT)',
    ['stream_id'],
    buckets=(0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0)
)

# Total detections by object class
detections_total = Counter(
    'vision_detections_total',
    'Total object detections by class',
    ['stream_id', 'class_name']
)

# Current Population Stability Index (PSI) drift score
drift_psi_score = Gauge(
    'vision_drift_psi_score',
    'Population Stability Index (PSI) drift score',
    ['stream_id']
)

# Track memory/CPU metrics if needed
active_streams = Gauge(
    'vision_active_streams_count',
    'Number of currently active processing streams'
)

def record_detection_metrics(stream_id: str, inference_ms: float, class_names: List[str]):
    """
    Standard helper to record metrics after each frame.
    """
    # Increment global frame counter
    frames_total.labels(stream_id=stream_id).inc()
    
    # Observe latency (convert to seconds)
    inference_latency.labels(stream_id=stream_id).observe(inference_ms / 1000.0)
    
    # Counter for every detected class in the frame
    for cls in class_names:
        detections_total.labels(stream_id=stream_id, class_name=cls).inc()

def record_drift_metric(stream_id: str, psi_score: float):
    """Update the drift score gauge."""
    drift_psi_score.labels(stream_id=stream_id).set(psi_score)

def get_prometheus_metrics():
    """Return latest metrics in Prometheus text format."""
    return generate_latest(), CONTENT_TYPE_LATEST
