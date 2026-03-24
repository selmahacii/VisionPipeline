from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from loguru import logger
from app.core.sockets import manager

router = APIRouter()

@router.websocket("/{stream_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    stream_id: str
):
    """
    WebSocket endpoint for real-time video stream detections.
    Connect to: ws://localhost:8000/api/v1/ws/{stream_id}
    """
    await manager.connect(websocket, stream_id)
    
    try:
        # Keep connection open and listen for client commands (e.g., ping/pong or filter changes)
        while True:
            # We don't expect much data from client, but keeping the loop
            # for heartbeats and the 'with' to detect disconnect.
            data = await websocket.receive_text()
            # Handle client-specific commands if any (JSON based)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, stream_id)
        logger.info(f"WebSocket client disconnected from stream: {stream_id}")
    except Exception as e:
        logger.error(f"WebSocket error in {stream_id}: {e}")
        manager.disconnect(websocket, stream_id)
