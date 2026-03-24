from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os

class Settings(BaseSettings):
    # Core API Settings
    PROJECT_NAME: str = "VisionPipeline"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "DEVELOPMENT_SECRET_KEY_REPLACE_IN_PROD")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database Settings
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "visionpipeline")
    DATABASE_URL: Optional[str] = None

    @property
    def async_database_url(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"

    # Redis Settings
    REDIS_HOST: str = "127.0.0.1"
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # MLOps Settings
    MLFLOW_TRACKING_URI: str = "http://127.0.0.1:5000"
    
    # Kafka Settings
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    
    # Computer Vision Settings
    USE_GPU: bool = os.getenv("USE_GPU", "true").lower() == "true"
    DEFAULT_CONFIDENCE: float = 0.5
    
    # Medallion Pipeline Config
    BRONZE_RETENTION_DAYS: int = 30
    SILVER_RETENTION_DAYS: int = 90
    
    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

settings = Settings()
