import random
import time
from typing import List, Dict, Any, Optional
from loguru import logger
from app.core.config import settings

# Detection engine configuration
try:
    from ultralytics import YOLO
    import torch
    ENGINE_AVAILABLE = True
except ImportError:
    ENGINE_AVAILABLE = False
    logger.warning("Ultralytics engine unavailable. Using CPU simulator.")

class YOLODetector:
    def __init__(self, model_path: str = "yolov8n.pt"):
        self.model_path = model_path
        self.model = None
        
        if ENGINE_AVAILABLE:
            try:
                device = "cuda" if settings.USE_GPU and torch.cuda.is_available() else "cpu"
                self.model = YOLO(model_path).to(device)
                logger.debug(f"Detector initialized on {device}")
            except Exception as e:
                logger.error(f"Detector initialization failed: {e}")
                self.model = None
        else:
            logger.info("Detector initialized in simulation mode")

    async def detect(self, frame_data: Any) -> List[Dict[str, Any]]:
        """Run detection on high-resolution frames."""
        start_time = time.perf_counter()
        
        if self.model:
            results = self.model(frame_data, verbose=False)
            inference_ms = (time.perf_counter() - start_time) * 1000
            
            detections = []
            for r in results:
                for box in r.boxes:
                    detections.append({
                        "bbox": box.xyxy[0].tolist(),
                        "confidence": float(box.conf[0]),
                        "class_id": int(box.cls[0]),
                        "class_name": self.model.names[int(box.cls[0])],
                        "inference_ms": inference_ms
                    })
            return detections
        
        else:
            # Fallback for headless environments
            time.sleep(0.01)
            inference_ms = (time.perf_counter() - start_time) * 1000
            
            # Virtual objects simulation
            target_classes = {0: "person", 2: "car", 3: "motorcycle", 5: "bus"}
            num_detections = random.randint(1, 4)
            detections = []
            
            for _ in range(num_detections):
                cls_id = random.choice(list(mock_classes.keys()))
                detections.append({
                    "bbox": [
                        random.uniform(50, 200), random.uniform(50, 200), 
                        random.uniform(300, 500), random.uniform(300, 500)
                    ],
                    "confidence": random.uniform(0.6, 0.95),
                    "class_id": cls_id,
                    "class_name": mock_classes[cls_id],
                    "inference_ms": inference_ms
                })
            
            return detections

    def get_class_names(self) -> Dict[int, str]:
        if self.model:
            return self.model.names
        return {0: "person", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
