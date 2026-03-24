import asyncio
import time
from loguru import logger
from typing import Dict, Any
from app.pipeline.processor import MedallionPipeline
from app.core.sockets import manager
from app.monitoring.metrics import record_detection_metrics, record_drift_metric

class StreamRunner:
    """
    Simulates a high-performance stream processing worker.
    In production, this would be a separate process (Celery) or a managed Kafka consumer.
    """
    def __init__(self, stream_id: str):
        self.stream_id = stream_id
        self.pipeline = MedallionPipeline(stream_id)
        self.is_running = False

    async def start(self):
        """Infinite loop for processing frames from the simulation/source."""
        self.is_running = True
        logger.info(f"Worker: Starting processing for stream {self.stream_id}")
        
        try:
            while self.is_running:
                # 1. Capture/Simulate Frame (BRONZE)
                # In production: Read from OpenCV or Kafka
                raw_data = b"MOCK_JPEG_BYTES"
                await self.pipeline.process_bronze(raw_data)
                
                # 2. Extract Detections & Tracking (SILVER)
                # For demo, passing 'None' as frame image (YOLO wrapper handles mock frame)
                results = await self.pipeline.process_silver({}, None)
                
                # 3. Aggregate & Monitor (GOLD)
                # Compute and record drift every ~50 frames
                if len(results) > 0:
                    gold_report = await self.pipeline.compute_gold()
                    
                    # Log Metrics to Prometheus
                    record_detection_metrics(
                        self.stream_id, 
                        results[0]["inference_ms"] if results else 0.0,
                        [r["class_name"] for r in results]
                    )
                    record_drift_metric(self.stream_id, gold_report["psi_score"])
                    
                    # 4. Push to WebSockets (Live Preview)
                    await manager.broadcast_to_stream(self.stream_id, {
                        "detections": results,
                        "gold": gold_report,
                        "timestamp": time.time()
                    })

                # Simulate ~15FPS for dev environment
                await asyncio.sleep(1/15)
                
        except asyncio.CancelledError:
            self.is_running = False
            logger.info(f"Worker: stream {self.stream_id} cancelled.")
        except Exception as e:
            logger.error(f"Worker: critical error in {self.stream_id}: {e}")
            self.is_running = False

    def stop(self):
        self.is_running = False

# Registry of current stream tasks
active_runners: Dict[str, asyncio.Task] = {}
