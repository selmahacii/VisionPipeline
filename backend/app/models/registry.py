from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Float, Boolean, DateTime, func, JSON, Integer
from datetime import datetime
from app.db.session import Base

class MlModel(Base):
    """
    Registry for computer vision models (versions, configurations, framework).
    """
    __tablename__ = "ml_models"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    version: Mapped[str] = mapped_column(String(50))
    framework: Mapped[str] = mapped_column(String(50))  # e.g., 'PyTorch', 'ONNX', 'TensorRT'
    artifact_path: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    parameters: Mapped[dict] = mapped_column(JSON, default={})
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class DriftReport(Base):
    """
    History of model performance drift (PSI scores).
    """
    __tablename__ = "drift_reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    stream_id: Mapped[str] = mapped_column(String(50), index=True)
    model_id: Mapped[int] = mapped_column(Integer, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Population Stability Index (PSI) score
    psi_score: Mapped[float] = mapped_column(Float)
    
    # Details for specific buckets if available
    details: Mapped[dict] = mapped_column(JSON, nullable=True)
    
    drift_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    recommendation: Mapped[str] = mapped_column(String(255), nullable=True)
