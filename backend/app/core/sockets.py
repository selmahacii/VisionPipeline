from fastapi import WebSocket
from typing import List, Dict, Set
import json
from loguru import logger

class ConnectionManager:
    """
    Manages active WebSocket connections for real-time visualization.
    Supports broadcasting to specific 'rooms' (stream IDs).
    """
    def __init__(self):
        # active_connections: { stream_id: { websocket1, websocket2 } }
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, stream_id: str):
        """Accept connection and add to stream-specific room."""
        await websocket.accept()
        if stream_id not in self.active_connections:
            self.active_connections[stream_id] = set()
        self.active_connections[stream_id].add(websocket)
        logger.debug(f"WS: Client connected to stream {stream_id}. Total: {len(self.active_connections[stream_id])}")

    def disconnect(self, websocket: WebSocket, stream_id: str):
        """Handle client disconnect and cleanup."""
        if stream_id in self.active_connections:
            self.active_connections[stream_id].remove(websocket)
            if not self.active_connections[stream_id]:
                del self.active_connections[stream_id]
        logger.debug(f"WS: Client disconnected from stream {stream_id}")

    async def broadcast_to_stream(self, stream_id: str, message: Dict):
        """Broadcast data (detections/metrics) to all clients watching a specific stream."""
        if stream_id not in self.active_connections:
            return

        dead_connections = set()
        data = json.dumps(message)
        
        for websocket in self.active_connections[stream_id]:
            try:
                await websocket.send_text(data)
            except Exception as e:
                logger.error(f"WS: Broadcast failed for a client: {e}")
                dead_connections.add(websocket)
        
        # Cleanup failed connections
        for dead in dead_connections:
            self.disconnect(dead, stream_id)

# Global manager instance
manager = ConnectionManager()
