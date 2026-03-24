from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Float, Integer, DateTime, func, JSON
from datetime import datetime
from app.db.session import Base

class DetectionEvent(Base):
    """
    Core detection event for computer vision pipeline.
    This table is designed for TimescaleDB partitioning (hypertable).
    Partitioned by 'timestamp'.
    """
    __tablename__ = "detection_events"

    # Primary key is required for SQLAlchemy, though Timescale hypertables 
    # usually use a composite key if unique. 
    # For now, we'll use a simple id for dev.
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    stream_id: Mapped[str] = mapped_column(String(50), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    frame_number: Mapped[int] = mapped_column(Integer)
    class_id: Mapped[int] = mapped_column(Integer)
    class_name: Mapped[str] = mapped_column(String(50), index=True)
    confidence: Mapped[float] = mapped_column(Float)
    
    # Bounding box as JSON or separate columns
    # [x1, y1, x2, y2]
    bbox: Mapped[dict] = mapped_column(JSON)
    
    track_id: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    inference_ms: Mapped[float] = mapped_column(Float)
    
    # Extra data for potential drill-down
    extra_info: Mapped[dict] = mapped_column(JSON, nullable=True)
