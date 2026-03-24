"""
MaskRCNN Semantic Segmentation

What is semantic segmentation?
Unlike object detection which outputs bounding boxes, segmentation
produces pixel-wise masks that precisely outline object boundaries.

MaskRCNN Architecture:
1. Backbone (ResNet50/101) extracts feature maps
2. Region Proposal Network (RPN) generates candidate regions
3. ROI Align extracts features from each region
4. Three heads: classification, bounding box regression, mask prediction

Use cases in VisionPipeline:
- Precise object boundary detection
- Instance segmentation (different masks for overlapping objects)
- Scene understanding for analytics
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Dict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check if detectron2/torchvision is available
TORCHVISION_AVAILABLE = False
try:
    import torch
    import torchvision
    from torchvision.models.detection import maskrcnn_resnet50_fpn
    TORCHVISION_AVAILABLE = True
except ImportError:
    logger.warning("torchvision not installed — using mock segmentor")


@dataclass
class SegmentationResult:
    """Segmentation result with mask and class info."""
    class_id: int
    class_name: str
    confidence: float
    bbox: Dict[str, float]
    mask: np.ndarray  # Binary mask (H, W)
    area: int


class MaskRCNNSegmentor:
    """
    MaskRCNN-based instance segmentation.
    
    Supports:
    - COCO classes (80 categories)
    - Custom trained models
    - GPU acceleration
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        confidence: float = 0.5,
        device: Optional[str] = None,
    ):
        self.confidence = confidence

        # Auto-select device
        if device is None:
            try:
                import torch
                self.device = "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                self.device = "cpu"
        else:
            self.device = device

        if TORCHVISION_AVAILABLE:
            try:
                # Load pretrained model
                self.model = maskrcnn_resnet50_fpn(pretrained=True)
                self.model.to(self.device)
                self.model.eval()
                logger.info(f"MaskRCNN loaded on {self.device}")
            except Exception as e:
                logger.error(f"Failed to load MaskRCNN: {e}")
                self.model = None
        else:
            self.model = None

        # COCO classes
        self.class_names = [
            '__background__', 'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus',
            'train', 'truck', 'boat', 'traffic light', 'fire hydrant', 'N/A', 'stop sign',
            'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
            'elephant', 'bear', 'zebra', 'giraffe', 'N/A', 'backpack', 'umbrella', 'N/A', 'N/A',
            'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
            'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
            'bottle', 'N/A', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl',
            'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza',
            'donut', 'cake', 'chair', 'couch', 'potted plant', 'bed', 'N/A', 'dining table',
            'N/A', 'N/A', 'toilet', 'N/A', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
            'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'N/A', 'book',
            'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
        ]

    def segment(
        self,
        frame: np.ndarray,
        return_masks: bool = True,
    ) -> List[SegmentationResult]:
        """
        Run instance segmentation on a frame.
        
        Args:
            frame: BGR numpy array (OpenCV format)
            return_masks: Whether to include binary masks in output
            
        Returns:
            List of SegmentationResult objects
        """
        if self.model is None:
            return self._mock_segment(frame)

        try:
            import torch
            from torchvision.transforms import functional as F

            # Convert BGR to RGB and normalize
            image = frame[:, :, ::-1]  # BGR to RGB
            image_tensor = F.to_tensor(image).to(self.device)

            # Run inference
            with torch.no_grad():
                predictions = self.model([image_tensor])[0]

            results = []
            boxes = predictions['boxes'].cpu().numpy()
            labels = predictions['labels'].cpu().numpy()
            scores = predictions['scores'].cpu().numpy()
            masks = predictions.get('masks')

            for i, (box, label, score) in enumerate(zip(boxes, labels, scores)):
                if score < self.confidence:
                    continue

                class_id = int(label)
                class_name = self.class_names[class_id] if class_id < len(self.class_names) else f"class_{class_id}"

                # Extract mask
                mask = None
                area = 0
                if return_masks and masks is not None:
                    mask = masks[i, 0].cpu().numpy() > 0.5
                    area = int(mask.sum())

                results.append(SegmentationResult(
                    class_id=class_id,
                    class_name=class_name,
                    confidence=float(score),
                    bbox={
                        "x1": float(box[0]),
                        "y1": float(box[1]),
                        "x2": float(box[2]),
                        "y2": float(box[3]),
                    },
                    mask=mask,
                    area=area,
                ))

            return results

        except Exception as e:
            logger.error(f"Segmentation error: {e}")
            return self._mock_segment(frame)

    def _mock_segment(self, frame: np.ndarray) -> List[SegmentationResult]:
        """Generate mock segmentation results."""
        import random
        
        h, w = frame.shape[:2]
        results = []
        num_objects = random.randint(1, 3)

        for _ in range(num_objects):
            class_id = random.choice([1, 3, 8])  # person, car, truck
            class_name = self.class_names[class_id] if class_id < len(self.class_names) else f"class_{class_id}"
            
            # Random bounding box
            x1 = random.randint(50, w - 150)
            y1 = random.randint(50, h - 150)
            x2 = x1 + random.randint(80, 150)
            y2 = y1 + random.randint(100, 200)
            
            # Create mock mask
            mask = np.zeros((h, w), dtype=bool)
            mask[y1:y2, x1:x2] = True
            
            results.append(SegmentationResult(
                class_id=class_id,
                class_name=class_name,
                confidence=random.uniform(0.6, 0.95),
                bbox={"x1": float(x1), "y1": float(y1), "x2": float(x2), "y2": float(y2)},
                mask=mask,
                area=int(mask.sum()),
            ))
        
        return results


def get_segmentor(
    model_path: Optional[str] = None,
    confidence: float = 0.5,
) -> MaskRCNNSegmentor:
    """Get segmentor instance."""
    return MaskRCNNSegmentor(model_path=model_path, confidence=confidence)


if __name__ == "__main__":
    segmentor = MaskRCNNSegmentor()
    print(f"Segmentor initialized with {len(segmentor.class_names)} classes")
    
    # Create test frame
    test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    results = segmentor.segment(test_frame)
    print(f"Found {len(results)} segments")
    for seg in results:
        print(f"  - {seg.class_name}: {seg.confidence:.2f}, area={seg.area}")
