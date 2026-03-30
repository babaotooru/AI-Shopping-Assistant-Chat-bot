"""
Routes initialization
"""
from fastapi import APIRouter
from app.routes import orders, chat, health

def include_routes(app) -> None:
    """Include all routes in the application"""
    router = APIRouter(prefix="/api/v1")
    
    # Health check route
    router.include_router(health.router, tags=["health"])
    
    # Orders routes
    router.include_router(orders.router, prefix="/orders", tags=["orders"])
    
    # Chat/AI routes
    router.include_router(chat.router, prefix="/chat", tags=["chat"])
    
    app.include_router(router)
