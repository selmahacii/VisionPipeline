"""
Model Registry - Runtime Model Management

What is model registry?
A centralized system for:
- Loading models at startup
- Switching between model versions
- Tracking model performance
- Managing model lifecycle (dev → staging → production)

In production, this integrates with:
- MLflow Model Registry
- BentoML Model Store
- Custom model serving infrastructure

Features:
- Hot-swap models without restart
- A/B testing between versions
- Rollback to previous versions
- Performance monitoring per model
"""

import os
import json
import time
from dataclasses import dataclass
from typing import Dict, Optional, Any, List
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ModelInfo:
    """Information about a registered model."""
    name: str
    version: str
    path: str
    stage: str  # development, staging, production, archived
    is_active: bool
    loaded_at: float
    metrics: Dict[str, float]


class ModelRegistry:
    """
    Model registry for managing CV models at runtime.
    
    Supports:
    - Multiple model versions
    - Stage transitions (dev → staging → production)
    - Hot-swapping active model
    - Model performance tracking
    """

    def __init__(self, registry_path: Optional[str] = None):
        self.registry_path = registry_path or os.environ.get(
            "MODEL_REGISTRY_PATH",
            "/tmp/visionpipeline/models"
        )
        self.models: Dict[str, ModelInfo] = {}
        self.active_model_id: Optional[str] = None
        self._detector_cache: Dict[str, Any] = {}

        # Create registry directory
        Path(self.registry_path).mkdir(parents=True, exist_ok=True)

        logger.info(f"ModelRegistry initialized at {self.registry_path}")

    def register(
        self,
        name: str,
        version: str,
        path: str,
        stage: str = "development",
        metrics: Optional[Dict[str, float]] = None,
    ) -> str:
        """
        Register a new model version.
        
        Args:
            name: Model name (e.g., "yolov8n", "yolov8s")
            version: Version string (e.g., "1.0.0")
            path: Path to model weights
            stage: Initial stage
            metrics: Performance metrics (mAP, latency, etc.)
            
        Returns:
            Model ID (name:version)
        """
        model_id = f"{name}:{version}"

        self.models[model_id] = ModelInfo(
            name=name,
            version=version,
            path=path,
            stage=stage,
            is_active=False,
            loaded_at=time.time(),
            metrics=metrics or {},
        )

        logger.info(f"Registered model: {model_id} (stage={stage})")
        self._save_registry()

        return model_id

    def activate(self, model_id: str) -> bool:
        """
        Activate a model for inference.
        
        Args:
            model_id: Model identifier (name:version)
            
        Returns:
            True if activation successful
        """
        if model_id not in self.models:
            logger.error(f"Model not found: {model_id}")
            return False

        # Deactivate current active model
        if self.active_model_id and self.active_model_id in self.models:
            self.models[self.active_model_id].is_active = False
            self.models[self.active_model_id].stage = "staging"

        # Activate new model
        self.models[model_id].is_active = True
        self.models[model_id].stage = "production"
        self.active_model_id = model_id

        # Clear detector cache to force reload
        self._detector_cache.clear()

        logger.info(f"Activated model: {model_id}")
        self._save_registry()

        return True

    def get_detector(self, model_id: Optional[str] = None, **kwargs):
        """
        Get detector instance for a model.
        
        Args:
            model_id: Specific model ID, or None for active model
            **kwargs: Additional arguments for detector initialization
            
        Returns:
            YOLODetector instance
        """
        if model_id is None:
            model_id = self.active_model_id

        if model_id is None:
            raise ValueError("No active model set")

        if model_id not in self.models:
            raise ValueError(f"Model not found: {model_id}")

        # Check cache
        if model_id in self._detector_cache:
            return self._detector_cache[model_id]

        # Load detector
        from detector import YOLODetector

        model_info = self.models[model_id]
        detector = YOLODetector(
            model_path=model_info.path,
            **kwargs
        )

        self._detector_cache[model_id] = detector
        logger.info(f"Loaded detector for {model_id}")

        return detector

    def list_models(
        self,
        stage: Optional[str] = None,
        name: Optional[str] = None,
    ) -> List[ModelInfo]:
        """
        List registered models.
        
        Args:
            stage: Filter by stage
            name: Filter by name
            
        Returns:
            List of ModelInfo objects
        """
        models = list(self.models.values())

        if stage:
            models = [m for m in models if m.stage == stage]
        if name:
            models = [m for m in models if m.name == name]

        return models

    def get_active_model(self) -> Optional[ModelInfo]:
        """Get currently active model."""
        if self.active_model_id:
            return self.models.get(self.active_model_id)
        return None

    def transition_stage(
        self,
        model_id: str,
        new_stage: str,
    ) -> bool:
        """
        Transition model to a new stage.
        
        Stages: development → staging → production → archived
        
        Args:
            model_id: Model identifier
            new_stage: Target stage
            
        Returns:
            True if successful
        """
        if model_id not in self.models:
            logger.error(f"Model not found: {model_id}")
            return False

        valid_stages = ["development", "staging", "production", "archived"]
        if new_stage not in valid_stages:
            logger.error(f"Invalid stage: {new_stage}")
            return False

        self.models[model_id].stage = new_stage
        logger.info(f"Transitioned {model_id} to {new_stage}")
        self._save_registry()

        return True

    def update_metrics(
        self,
        model_id: str,
        metrics: Dict[str, float],
    ) -> None:
        """Update performance metrics for a model."""
        if model_id in self.models:
            self.models[model_id].metrics.update(metrics)
            self._save_registry()

    def compare_models(
        self,
        model_id_1: str,
        model_id_2: str,
    ) -> Dict[str, Any]:
        """
        Compare two models.
        
        Returns:
            Comparison result with metrics difference
        """
        if model_id_1 not in self.models or model_id_2 not in self.models:
            raise ValueError("One or both models not found")

        m1 = self.models[model_id_1]
        m2 = self.models[model_id_2]

        comparison = {
            "model_1": {
                "id": model_id_1,
                "stage": m1.stage,
                "metrics": m1.metrics,
            },
            "model_2": {
                "id": model_id_2,
                "stage": m2.stage,
                "metrics": m2.metrics,
            },
            "metrics_diff": {},
        }

        # Calculate metric differences
        all_metrics = set(m1.metrics.keys()) | set(m2.metrics.keys())
        for metric in all_metrics:
            v1 = m1.metrics.get(metric, 0)
            v2 = m2.metrics.get(metric, 0)
            comparison["metrics_diff"][metric] = {
                "model_1": v1,
                "model_2": v2,
                "diff": v2 - v1,
            }

        return comparison

    def _save_registry(self) -> None:
        """Save registry state to disk."""
        registry_file = Path(self.registry_path) / "registry.json"
        
        data = {
            "models": {
                k: {
                    "name": v.name,
                    "version": v.version,
                    "path": v.path,
                    "stage": v.stage,
                    "is_active": v.is_active,
                    "loaded_at": v.loaded_at,
                    "metrics": v.metrics,
                }
                for k, v in self.models.items()
            },
            "active_model_id": self.active_model_id,
        }

        with open(registry_file, 'w') as f:
            json.dump(data, f, indent=2)

    def _load_registry(self) -> None:
        """Load registry state from disk."""
        registry_file = Path(self.registry_path) / "registry.json"
        
        if not registry_file.exists():
            return

        with open(registry_file, 'r') as f:
            data = json.load(f)

        for k, v in data.get("models", {}).items():
            self.models[k] = ModelInfo(**v)

        self.active_model_id = data.get("active_model_id")


# Singleton instance
_registry_instance: Optional[ModelRegistry] = None


def get_registry(registry_path: Optional[str] = None) -> ModelRegistry:
    """Get model registry singleton."""
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = ModelRegistry(registry_path)
        _registry_instance._load_registry()
    return _registry_instance


if __name__ == "__main__":
    # Test the registry
    registry = get_registry()
    
    # Register some models
    registry.register("yolov8n", "1.0.0", "yolov8n.pt", stage="production")
    registry.register("yolov8s", "1.0.0", "yolov8s.pt", stage="staging")
    
    # Activate a model
    registry.activate("yolov8n:1.0.0")
    
    # List models
    print("Registered models:")
    for m in registry.list_models():
        print(f"  - {m.name}:{m.version} (stage={m.stage}, active={m.is_active})")
    
    # Get active model
    active = registry.get_active_model()
    print(f"\nActive model: {active.name if active else 'None'}")
