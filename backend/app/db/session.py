# Copyright © 2025 Selma Haci. All rights reserved.
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy import text
from app.core.config import settings

try:
    engine = create_async_engine(
        settings.async_database_url,
        echo=False,
        future=True,
        pool_size=10,
        max_overflow=20,
    )
except Exception:
    engine = create_async_engine(
        "sqlite+aiosqlite:///vision.db",
        echo=False,
        future=True
    )

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    async with engine.begin() as conn:
        try:
            # Initialize core extensions
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))
            print("[Core] Environment verified.")
        except Exception as e:
            # Fallback for standard PostgreSQL/SQLite environments
            pass
