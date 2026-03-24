import os
from typing import Dict, Any, Optional
from loguru import logger
from app.core.config import settings

# Attempt to import MLflow
try:
    import mlflow
    HAS_MLFLOW = True
except ImportError:
    HAS_MLFLOW = False
    logger.warning("MLflow not installed. Tracking disabled.")

class ModelTracker:
    """
    MLflow tracking wrapper for experiment management.
    Uses context managers for automatic run cleanup.
    """
    def __init__(self, experiment_name: str = "VisionDetection"):
        self.experiment_name = experiment_name
        
        if HAS_MLFLOW:
            # Connect to MLflow server
            mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000"))
            try:
                mlflow.set_experiment(experiment_name)
                logger.info(f"MLflow connected to experiment: {experiment_name}")
            except Exception as e:
                logger.error(f"MLflow connection failed: {e}")
                
    def log_run(self, params: Dict[str, Any], metrics: Dict[str, float], artifacts: Optional[List[str]] = None):
        """
        Log a model run with parameters and metrics.
        Implements the 'with mlflow.start_run()' pattern.
        """
        if not HAS_MLFLOW:
            logger.debug(f"MOCK MLFLOW: Params={params}, Metrics={metrics}")
            return

        with mlflow.start_run():
            # Log params (e.g., confidence_threshold, model_version)
            for key, val in params.items():
                mlflow.log_param(key, val)
            
            # Log metrics (e.g., mAP, inference_latency, PSI)
            for key, val in metrics.items():
                mlflow.log_metric(key, val)
            
            # Log artifacts (e.g., model weights, plots) if provided
            if artifacts:
                for path in artifacts:
                    if os.path.exists(path):
                        mlflow.log_artifact(path)
            
            logger.info("MLflow: Run recorded successfully.")

    def register_model(self, model_uri: str, model_name: str):
        """Register a specific model version in the registry."""
        if HAS_MLFLOW:
            mlflow.register_model(model_uri, model_name)
            logger.debug(f"Registered model {model_name} at {model_uri}")
