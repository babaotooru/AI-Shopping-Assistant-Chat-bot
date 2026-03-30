"""
Health Check Routes
"""
from fastapi import APIRouter, Response
from datetime import datetime

router = APIRouter()

@router.get("/health")
async def health_check() -> dict:
    """
    Health check endpoint
    Returns: Status and timestamp
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "message": "AI Shopping Assistant API is running"
    }

@router.get("/")
async def root() -> dict:
    """Root endpoint"""
    return {
        "name": "AI Shopping Assistant",
        "version": "1.0.0",
        "status": "running"
    }
