"""
Person Re-Identification (ReID)

What is ReID?
Re-identification matches a person detected in one camera to the same
person detected in another camera (or after occlusion in the same camera).

Uses deep feature embeddings:
- OSNet, ResNet-based architectures trained on person ReID datasets
- Output: 128/256/512 dimensional feature vector
- Match using cosine similarity or Euclidean distance

Use cases in VisionPipeline:
- Cross-camera tracking
- Person search across streams
- Dwell time analytics (same person re-entering)
- Customer journey analysis
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Dict, Tuple
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check for ReID libraries
TORCHREID_AVAILABLE = False
try:
    import torch
    import torchreid
    TORCHREID_AVAILABLE = True
except ImportError:
    pass

GLOAT_AVAILABLE = False
try:
    import gdown
    import torch
    GLOAT_AVAILABLE = True
except ImportError:
    pass


@dataclass
class ReIDFeature:
    """ReID feature vector for a person crop."""
    track_id: int
    feature_vector: np.ndarray  # Normalized embedding
    confidence: float
    timestamp: float
    bbox: Dict[str, float]


@dataclass
class ReIDMatch:
    """Match result between two ReID features."""
    query_id: int
    gallery_id: int
    distance: float
    similarity: float
    is_match: bool


class OSNetReID:
    """
    OSNet-based person re-identification.
    
    OSNet (Omni-Scale Network) is a lightweight but accurate ReID model.
    Feature extraction:
    1. Crop person from frame using bounding box
    2. Resize to 256x128 (standard ReID input)
    3. Forward pass through OSNet
    4. L2-normalize output feature vector
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        feature_dim: int = 512,
        device: Optional[str] = None,
    ):
        self.feature_dim = feature_dim

        # Auto-select device
        if device is None:
            try:
                import torch
                self.device = "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                self.device = "cpu"
        else:
            self.device = device

        self.model = None
        
        if TORCHREID_AVAILABLE:
            try:
                # Try to load OSNet via torchreid
                self.model = torchreid.models.build_model(
                    name='osnet_x1_0',
                    num_classes=1000,
                    pretrained=True,
                )
                self.model.to(self.device)
                self.model.eval()
                logger.info(f"OSNet ReID loaded on {self.device}")
            except Exception as e:
                logger.warning(f"Failed to load OSNet: {e}")
                self.model = None

        if self.model is None:
            logger.info("Using mock ReID feature extractor")

    def extract_features(
        self,
        crops: List[np.ndarray],
        track_ids: Optional[List[int]] = None,
    ) -> List[ReIDFeature]:
        """
        Extract ReID features from person crops.
        
        Args:
            crops: List of BGR person crop images
            track_ids: Optional track IDs for each crop
            
        Returns:
            List of ReIDFeature objects
        """
        import time
        
        if track_ids is None:
            track_ids = list(range(len(crops)))

        results = []
        
        for i, (crop, track_id) in enumerate(zip(crops, track_ids)):
            if self.model is not None:
                feature = self._extract_real_feature(crop)
            else:
                feature = self._extract_mock_feature(crop, track_id)

            results.append(ReIDFeature(
                track_id=track_id,
                feature_vector=feature,
                confidence=0.9,
                timestamp=time.time(),
                bbox={},  # To be filled by caller
            ))

        return results

    def _extract_real_feature(self, crop: np.ndarray) -> np.ndarray:
        """Extract features using the actual model."""
        try:
            import torch
            from torchvision.transforms import functional as F

            # Preprocess
            crop_rgb = crop[:, :, ::-1]  # BGR to RGB
            crop_resized = F.resize(crop_rgb, (256, 128))
            crop_tensor = F.to_tensor(crop_resized).unsqueeze(0).to(self.device)

            with torch.no_grad():
                feature = self.model(crop_tensor)

            # L2 normalize
            feature = feature.cpu().numpy().flatten()
            feature = feature / (np.linalg.norm(feature) + 1e-8)

            return feature

        except Exception as e:
            logger.error(f"Feature extraction error: {e}")
            return self._extract_mock_feature(crop, 0)

    def _extract_mock_feature(self, crop: np.ndarray, seed: int) -> np.ndarray:
        """Generate mock feature vector based on image statistics."""
        np.random.seed(seed)
        
        # Use image statistics to create deterministic features
        if crop.size > 0:
            # Color histogram features
            mean_color = crop.mean(axis=(0, 1))
            std_color = crop.std(axis=(0, 1))
            
            # Combine with random features for dimensionality
            feature = np.random.randn(self.feature_dim).astype(np.float32)
            feature[:3] = mean_color / 255.0
            feature[3:6] = std_color / 255.0
        else:
            feature = np.random.randn(self.feature_dim).astype(np.float32)

        # L2 normalize
        feature = feature / (np.linalg.norm(feature) + 1e-8)
        return feature

    def compute_similarity(
        self,
        feature1: np.ndarray,
        feature2: np.ndarray,
    ) -> Tuple[float, float]:
        """
        Compute similarity between two feature vectors.
        
        Returns:
            (distance, similarity) tuple
        """
        # Euclidean distance
        distance = np.linalg.norm(feature1 - feature2)
        
        # Cosine similarity
        similarity = np.dot(feature1, feature2)
        
        return float(distance), float(similarity)

    def match(
        self,
        query: ReIDFeature,
        gallery: List[ReIDFeature],
        threshold: float = 0.7,
    ) -> List[ReIDMatch]:
        """
        Match a query feature against a gallery.
        
        Args:
            query: Query ReID feature
            gallery: List of gallery ReID features
            threshold: Similarity threshold for matching
            
        Returns:
            List of ReIDMatch objects sorted by similarity
        """
        matches = []

        for gallery_item in gallery:
            if gallery_item.track_id == query.track_id:
                continue  # Skip same track

            distance, similarity = self.compute_similarity(
                query.feature_vector,
                gallery_item.feature_vector,
            )

            matches.append(ReIDMatch(
                query_id=query.track_id,
                gallery_id=gallery_item.track_id,
                distance=distance,
                similarity=similarity,
                is_match=similarity > threshold,
            ))

        # Sort by similarity descending
        matches.sort(key=lambda x: x.similarity, reverse=True)
        return matches


class ReIDGallery:
    """
    Gallery for storing and querying ReID features.
    Supports cross-camera tracking and person search.
    """

    def __init__(
        self,
        max_size: int = 10000,
        feature_dim: int = 512,
    ):
        self.max_size = max_size
        self.feature_dim = feature_dim
        self.gallery: Dict[int, ReIDFeature] = {}
        self._next_id = 0

    def add(self, feature: ReIDFeature) -> int:
        """Add feature to gallery."""
        if len(self.gallery) >= self.max_size:
            # Remove oldest
            oldest_id = min(self.gallery.keys(), key=lambda k: self.gallery[k].timestamp)
            del self.gallery[oldest_id]

        self.gallery[feature.track_id] = feature
        return feature.track_id

    def search(
        self,
        query_feature: np.ndarray,
        top_k: int = 10,
        threshold: float = 0.7,
    ) -> List[Tuple[int, float]]:
        """
        Search gallery for similar features.
        
        Returns:
            List of (track_id, similarity) tuples
        """
        results = []

        for track_id, feature in self.gallery.items():
            similarity = np.dot(query_feature, feature.feature_vector)
            if similarity > threshold:
                results.append((track_id, float(similarity)))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    def clear(self) -> None:
        """Clear the gallery."""
        self.gallery.clear()


def get_reid(
    model_path: Optional[str] = None,
    feature_dim: int = 512,
) -> OSNetReID:
    """Get ReID instance."""
    return OSNetReID(model_path=model_path, feature_dim=feature_dim)


if __name__ == "__main__":
    reid = OSNetReID()
    print(f"ReID initialized with {reid.feature_dim}-dim features")
    
    # Create mock crops
    mock_crops = [
        np.random.randint(0, 255, (256, 128, 3), dtype=np.uint8)
        for _ in range(3)
    ]
    
    features = reid.extract_features(mock_crops, track_ids=[1, 2, 3])
    print(f"Extracted {len(features)} features")
    
    # Match features
    matches = reid.match(features[0], features[1:])
    print(f"Matches for track 1:")
    for m in matches:
        print(f"  -> Track {m.gallery_id}: similarity={m.similarity:.3f}, match={m.is_match}")
