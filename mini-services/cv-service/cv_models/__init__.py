"""
CV Models Package

Computer vision models for VisionPipeline:
- detector: YOLOv8 object detection
- tracker: DeepSORT multi-object tracking
- segmentor: MaskRCNN instance segmentation
- reid: Person re-identification
- model_registry: Model management
"""

from .detector import YOLODetector, get_detector, DetectionResult, FrameResult
from .tracker import DeepSORTTracker, SimpleTracker, TrackedObject, get_tracker
from .segmentor import MaskRCNNSegmentor, SegmentationResult, get_segmentor
from .reid import OSNetReID, ReIDGallery, ReIDFeature, ReIDMatch, get_reid
from .model_registry import ModelRegistry, ModelInfo, get_registry

__all__ = [
    'YOLODetector', 'get_detector', 'DetectionResult', 'FrameResult',
    'DeepSORTTracker', 'SimpleTracker', 'TrackedObject', 'get_tracker',
    'MaskRCNNSegmentor', 'SegmentationResult', 'get_segmentor',
    'OSNetReID', 'ReIDGallery', 'ReIDFeature', 'ReIDMatch', 'get_reid',
    'ModelRegistry', 'ModelInfo', 'get_registry',
]
