#!/usr/bin/env python
"""
Backend startup script
"""
import sys
import os

# Add backend directory to Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

# Change to backend directory
os.chdir(backend_dir)

if __name__ == "__main__":
    import uvicorn
    from config import settings
    
    print(f"Starting {settings.PROJECT_NAME}...")
    print(f"Environment: {settings.APP_ENV}")
    print(f"API Documentation: http://localhost:8000/api/docs")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )
