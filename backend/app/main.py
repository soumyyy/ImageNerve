from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.api_router import apiRouter
from app.auth import get_current_user_id
from app.utils.logger import setup_logging, get_logger, log_api_request
import time
import os

# Initialize logging
log_level = os.getenv("LOG_LEVEL", "INFO")
setup_logging(log_level=log_level, log_file=True)

logger = get_logger("imagenerve.main")
logger.info("🚀 Starting ImageNerve Backend Application")

app = FastAPI(title="ImageNerve API", version="1.0.0")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "ImageNerve API is running", "status": "healthy"}

# Middleware to log all API requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Resolve user for logging (query, X-User-Id header, or test user)
    user_id = get_current_user_id(request)
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    log_api_request(
        method=request.method,
        endpoint=str(request.url.path),
        user_id=user_id,
        status_code=response.status_code,
        duration=duration
    )
    
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(apiRouter) 