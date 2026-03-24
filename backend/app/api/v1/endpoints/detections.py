from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime
from app.db.session import get_db
from app.models.detection import DetectionEvent
from app.schemas.vision import DetectionRead, DetectionFilter

router = APIRouter()

@router.get("/", response_model=List[DetectionRead])
async def list_detections(
    stream_id: Optional[str] = None,
    class_name: Optional[str] = None,
    min_confidence: float = 0.5,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """
    Paginated detections with filtering.
    Optimized for TimescaleDB indexing on timestamp and stream_id.
    """
    stmt = select(DetectionEvent).where(DetectionEvent.confidence >= min_confidence)

    if stream_id:
        stmt = stmt.where(DetectionEvent.stream_id == stream_id)
    if class_name:
        stmt = stmt.where(DetectionEvent.class_name == class_name)
    if start_time:
        stmt = stmt.where(DetectionEvent.timestamp >= start_time)
    if end_time:
        stmt = stmt.where(DetectionEvent.timestamp <= end_time)

    stmt = stmt.order_by(DetectionEvent.timestamp.desc()).offset(offset).limit(limit)
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/summary")
async def get_summary(
    stream_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Return quick summary stats for a stream.
    Used for dashboard overview.
    """
    # Simple summary example: 
    # Return count of detections in the last hour
    # This would ideally be a Gold Layer query.
    return {"status": "implementing summary logic from Gold Layer"}
