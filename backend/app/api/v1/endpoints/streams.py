from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.db.session import get_db
from app.models.stream import Stream
from app.schemas.vision import StreamCreate, StreamRead, StreamUpdate

router = APIRouter()

@router.get("/", response_model=List[StreamRead])
async def list_streams(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Stream).offset(skip).limit(limit))
    return result.scalars().all()

@router.post("/", response_model=StreamRead)
async def create_stream(
    stream_in: StreamCreate,
    db: AsyncSession = Depends(get_db)
):
    # Check if stream_id already exists
    existing = await db.execute(select(Stream).filter(Stream.stream_id == stream_in.stream_id))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Stream ID already registered")
    
    db_obj = Stream(**stream_in.dict())
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.get("/{stream_id}", response_model=StreamRead)
async def get_stream(
    stream_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Stream).filter(Stream.stream_id == stream_id))
    db_obj = result.scalars().first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Stream not found")
    return db_obj

@router.patch("/{stream_id}", response_model=StreamRead)
async def update_stream(
    stream_id: str,
    stream_in: StreamUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Stream).filter(Stream.stream_id == stream_id))
    db_obj = result.scalars().first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    update_data = stream_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj
