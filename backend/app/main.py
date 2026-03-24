# Copyright © 2025 Selma Haci. All rights reserved.
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import init_db
from app.api.v1.api import api_router
import uvicorn

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.on_event("startup")
async def startup_event():
    from app.services.stream_runner import StreamRunner, active_runners
    import asyncio
    
    # Initial system sanity check
    try:
        await init_db()
        print("[API] App started and DB initialized.")
        
        # Start a default simulation stream workers
        default_stream_id = "SIM-001"
        runner = StreamRunner(default_stream_id)
        task = asyncio.create_task(runner.start())
        active_runners[default_stream_id] = task
        print(f"[API] Initialized streaming engine for {default_stream_id}")
        
    except Exception as e:
        print(f"[API] Startup sequence warning: {str(e)}")

@app.get("/")
def read_root():
    return {"status": "VisionPipeline API up and running", "version": "0.1.0"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
