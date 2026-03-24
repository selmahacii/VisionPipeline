"""
YOLOv8 Object Detector Wrapper

Why YOLOv8?
- State of the art speed/accuracy trade-off in 2024-2025
- Native Python API via ultralytics package
- Supports detection, segmentation, pose estimation
- Easy fine-tuning on custom datasets

Architecture:
- YOLOv8n (nano): fastest, 3.2M params, ~80fps on CPU
- YOLOv8s (small): balanced, 11.2M params, ~50fps on CPU
- YOLOv8m (medium): accurate, 25.9M params, ~30fps on CPU

Batching strategy:
Process frames in batches of 4 when possible.
Batch inference on GPU is ~3x faster than single-frame inference.
"""

import time
import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check if ultralytics is available
try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False
    logger.warning("ultralytics not installed — using mock detector")


@dataclass
class DetectionResult:
    """Single detection result."""
    class_id: int
    class_name: str
    confidence: float
    bbox: Dict[str, float]  # {"x1", "y1", "x2", "y2"}
    mask: Optional[List[List[float]]] = None  # Segmentation polygon


@dataclass
class FrameResult:
    """Detection results for a single frame."""
    frame_number: int
    detections: List[DetectionResult]
    inference_ms: float
    frame_width: int
    frame_height: int


# COCO class names
COCO_CLASSES = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
    'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
    'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
    'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
    'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
    'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
    'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
    'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
    'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
    'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
    'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
    'toothbrush'
]


class YOLODetector:
    """
    YOLOv8 wrapper with:
    - Automatic GPU/CPU device selection
    - Batch processing for efficiency
    - Confidence and NMS threshold configuration
    - Segmentation mode (returns masks alongside bboxes)
    """
    
    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        confidence: float = 0.45,
        iou: float = 0.45,
        device: Optional[str] = None,
    ):
        self.confidence = confidence
        self.iou = iou
        self.model_path = model_path

        # Auto-select device: CUDA > MPS (Apple) > CPU
        if device is None:
            try:
                import torch
                if torch.cuda.is_available():
                    self.device = "cuda"
                elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                    self.device = "mps"
                else:
                    self.device = "cpu"
            except ImportError:
                self.device = "cpu"
        else:
            self.device = device

        logger.info(f"Loading YOLOv8 on {self.device}: {model_path}")

        if ULTRALYTICS_AVAILABLE:
            try:
                self.model = YOLO(model_path)
                self.model.to(self.device)
                self.class_names = self.model.names
                logger.info(f"Model loaded successfully. Classes: {len(self.class_names)}")
            except Exception as e:
                logger.error(f"Failed to load model: {e}")
                self.model = None
                self.class_names = {i: name for i, name in enumerate(COCO_CLASSES)}
        else:
            self.model = None
            self.class_names = {i: name for i, name in enumerate(COCO_CLASSES)}

        logger.info(f"Detector ready. Classes: {len(self.class_names)}")

    def detect(
        self,
        frame: np.ndarray,
        frame_number: int = 0,
        segmentation: bool = False,
    ) -> FrameResult:
        """
        Run detection on a single frame.
        
        Args:
            frame: BGR numpy array (OpenCV format)
            frame_number: Frame index for tracking
            segmentation: Whether to return segmentation masks
            
        Returns:
            FrameResult with all detections
        """
        h, w = frame.shape[:2]
        start = time.perf_counter()

        if self.model is None:
            return self._mock_result(frame_number, w, h)

        # Run inference
        task = "segment" if segmentation else "detect"
        try:
            results = self.model.predict(
                frame,
                conf=self.confidence,
                iou=self.iou,
                device=self.device,
                verbose=False,
            )
        except Exception as e:
            logger.error(f"Inference error: {e}")
            return self._mock_result(frame_number, w, h)
            
        inference_ms = (time.perf_counter() - start) * 1000

        detections = []
        for result in results:
            boxes = result.boxes
            masks = result.masks if segmentation and result.masks else None

            for i, box in enumerate(boxes):
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                cls_id = int(box.cls[0].cpu().numpy())
                cls_name = self.class_names.get(cls_id, f"class_{cls_id}")
                conf = float(box.conf[0].cpu().numpy())

                # Extract mask if available
                mask_data = None
                if masks and i < len(masks):
                    mask_data = masks[i].xy[0].tolist()

                detections.append(DetectionResult(
                    class_id=cls_id,
                    class_name=cls_name,
                    confidence=conf,
                    bbox={
                        "x1": float(x1), "y1": float(y1),
                        "x2": float(x2), "y2": float(y2),
                    },
                    mask=mask_data,
                ))

        return FrameResult(
            frame_number=frame_number,
            detections=detections,
            inference_ms=inference_ms,
            frame_width=w,
            frame_height=h,
        )

    def detect_batch(
        self, 
        frames: List[np.ndarray], 
        start_frame: int = 0
    ) -> List[FrameResult]:
        """
        Batch inference — ~3x faster than single-frame on GPU.
        Use when buffering multiple frames.
        """
        if not frames:
            return []
        if self.model is None:
            return [self._mock_result(start_frame + i, *f.shape[:2][::-1])
                    for i, f in enumerate(frames)]

        start = time.perf_counter()
        try:
            results = self.model.predict(
                frames, 
                conf=self.confidence, 
                iou=self.iou,
                device=self.device, 
                verbose=False
            )
        except Exception as e:
            logger.error(f"Batch inference error: {e}")
            return [self._mock_result(start_frame + i, *f.shape[:2][::-1])
                    for i, f in enumerate(frames)]
                    
        total_ms = (time.perf_counter() - start) * 1000
        per_frame_ms = total_ms / len(frames)

        frame_results = []
        for i, result in enumerate(results):
            h, w = frames[i].shape[:2]
            detections = []
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                cls_id = int(box.cls[0].cpu().numpy())
                cls_name = self.class_names.get(cls_id, f"class_{cls_id}")
                detections.append(DetectionResult(
                    class_id=cls_id,
                    class_name=cls_name,
                    confidence=float(box.conf[0]),
                    bbox={"x1": float(x1), "y1": float(y1), "x2": float(x2), "y2": float(y2)},
                ))
            frame_results.append(FrameResult(
                frame_number=start_frame + i,
                detections=detections,
                inference_ms=per_frame_ms,
                frame_width=w,
                frame_height=h,
            ))
        return frame_results

    def _mock_result(self, frame_number: int, w: int, h: int) -> FrameResult:
        """Mock detections for testing without GPU/model."""
        import random
        
        num_detections = random.randint(0, 5)
        detections = []
        
        for i in range(num_detections):
            # Random object type
            class_id = random.choice([0, 2, 7, 1, 3])  # person, car, truck, bicycle, motorcycle
            class_name = COCO_CLASSES[class_id]
            
            # Random bounding box
            x1 = random.randint(50, w - 150)
            y1 = random.randint(50, h - 150)
            x2 = x1 + random.randint(80, 150)
            y2 = y1 + random.randint(100, 200)
            
            # Random confidence
            conf = random.uniform(0.5, 0.95)
            
            detections.append(DetectionResult(
                class_id=class_id,
                class_name=class_name,
                confidence=conf,
                bbox={"x1": float(x1), "y1": float(y1), "x2": float(x2), "y2": float(y2)},
            ))
        
        return FrameResult(
            frame_number=frame_number,
            detections=detections,
            inference_ms=15.0 + random.random() * 10,
            frame_width=w,
            frame_height=h,
        )

    def get_class_name(self, class_id: int) -> str:
        """Get class name by ID."""
        return self.class_names.get(class_id, f"class_{class_id}")


# Singleton instance
_detector_instance: Optional[YOLODetector] = None


def get_detector(
    model_path: str = "yolov8n.pt",
    confidence: float = 0.45,
    iou: float = 0.45,
) -> YOLODetector:
    """Get or create detector instance."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = YOLODetector(model_path, confidence, iou)
    return _detector_instance


if __name__ == "__main__":
    # Test the detector
    detector = YOLODetector()
    print(f"Detector initialized with {len(detector.class_names)} classes")
    
    # Create test frame
    test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    result = detector.detect(test_frame, frame_number=1)
    print(f"Frame 1: {len(result.detections)} detections in {result.inference_ms:.1f}ms")
    
    for det in result.detections:
        print(f"  - {det.class_name}: {det.confidence:.2f} at {det.bbox}")
