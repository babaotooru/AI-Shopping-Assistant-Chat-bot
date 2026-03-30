"""
Backend Application Package
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings

def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="1.0.0",
        description="AI-Powered E-Commerce Shopping Assistant Backend API",
        openapi_url=f"{settings.API_V1_STR}/openapi.json"
    )
    
    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    return app
