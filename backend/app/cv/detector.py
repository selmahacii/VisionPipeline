import random
import time
from typing import List, Dict, Any, Optional
from loguru import logger
from app.core.config import settings

# Attempt to import ultralytics for YOLOv8
try:
    from ultralytics import YOLO
    import torch
    HAS_ULTRALYTICS = True
except ImportError:
    HAS_ULTRALYTICS = False
    logger.warning("Ultralytics not installed. Falling back to Mock Detector.")

class YOLODetector:
    def __init__(self, model_path: str = "yolov8n.pt"):
        self.model_path = model_path
        self.model = None
        
        if HAS_ULTRALYTICS:
            try:
                # Use CPU if GPU not available or disabled in settings
                device = "cuda" if settings.USE_GPU and torch.cuda.is_available() else "cpu"
                self.model = YOLO(model_path).to(device)
                logger.info(f"YOLOv8 model loaded on {device}: {model_path}")
            except Exception as e:
                logger.error(f"Failed to load YOLO model: {e}. Switching to Mock.")
                self.model = None
        else:
            logger.info("YOLODetector initialized in MOCK mode.")

    async def detect(self, frame_data: Any) -> List[Dict[str, Any]]:
        """
        Run detection on a single frame.
        Mock implementation generates random detections if the real model is missing.
        """
        start_time = time.perf_counter()
        
        if self.model:
            # REAL DETECTION
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
            # MOCK DETECTION (Fallback)
            # Simulate processing time
            time.sleep(0.01) # 10ms
            inference_ms = (time.perf_counter() - start_time) * 1000
            
            # Generate 1-5 random detections (e.g., people, cars)
            mock_classes = {0: "person", 2: "car", 3: "motorcycle", 5: "bus"}
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
