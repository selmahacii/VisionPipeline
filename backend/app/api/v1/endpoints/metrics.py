from fastapi import APIRouter, Response
from app.monitoring.metrics import get_prometheus_metrics

router = APIRouter()

@router.get("/")
async def metrics():
    # Fetch latest metrics in Prometheus text format
    content, content_type = get_prometheus_metrics()
    return Response(content=content, media_type=content_type)
