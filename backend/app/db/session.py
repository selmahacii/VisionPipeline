from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy import text
from app.core.config import settings

# Create async engine for SQLAlchemy 2.0
engine = create_async_engine(
    settings.async_database_url,
    echo=False,
    future=True,
    pool_size=10,
    max_overflow=20,
)

# Async session factory
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
        # Initial schema creation (using SQLAlchemy models)
        # Note: In a production environment, use Alembic migrations instead
        # but the boilerplate creates tables directly for convenience.
        # await conn.run_sync(Base.metadata.create_all)
        
        # TimescaleDB hypertable creation check
        # We'll run the SQL explicitly as requested
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))
            
            # Example: Create detection_events hypertable if it exists in models
            # We'll do this in a later step when models are defined
            # await conn.execute(text("SELECT create_hypertable('detection_events', 'timestamp', if_not_exists => TRUE);"))
            
            print("[DB] Initialized TimescaleDB extensions.")
        except Exception as e:
            print(f"[DB] Optional TimescaleDB init skipped or failed: {str(e)}")
