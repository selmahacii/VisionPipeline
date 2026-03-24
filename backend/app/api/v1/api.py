from fastapi import APIRouter
from app.api.v1.endpoints import (
    streams, 
    detections, 
    metrics
)

api_router = APIRouter()

# Include all endpoint modules with appropriate prefixes/tags
api_router.include_router(streams.router, prefix="/streams", tags=["streams"])
api_router.include_router(detections.router, prefix="/detections", tags=["detections"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["monitoring"])

# Placeholder for additional endpoints (models, alerts)
# api_router.include_router(models.router, prefix="/models", tags=["models"])
# api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
