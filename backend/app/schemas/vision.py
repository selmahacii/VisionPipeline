from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- STREAM SCHEMAS ---
class StreamBase(BaseModel):
    stream_id: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    source_url: str = Field(..., max_length=255)
    is_active: Optional[bool] = True

class StreamCreate(StreamBase):
    pass

class StreamUpdate(BaseModel):
    name: Optional[str] = None
    source_url: Optional[str] = None
    is_active: Optional[bool] = None

class StreamRead(StreamBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- DETECTION SCHEMAS ---
class DetectionBase(BaseModel):
    stream_id: str
    frame_number: int
    class_id: int
    class_name: str
    confidence: float
    bbox: List[float] = Field(..., min_items=4, max_items=4)
    track_id: Optional[int] = None
    inference_ms: float
    extra_info: Optional[Dict[str, Any]] = None

class DetectionCreate(DetectionBase):
    pass

class DetectionRead(DetectionBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

class DetectionFilter(BaseModel):
    stream_id: Optional[str] = None
    class_name: Optional[str] = None
    min_confidence: float = 0.5
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    limit: int = 100
    offset: int = 0
