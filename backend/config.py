"""
Application Configuration
"""
import os
from dotenv import load_dotenv
from functools import lru_cache
from typing import Optional

load_dotenv()

class Settings:
    """Application Settings"""
    
    # App Config
    APP_NAME: str = os.getenv("APP_NAME", "AI Shopping Assistant")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = APP_ENV == "development"
    
    # API Config
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "AI Shopping Assistant"
    
    # Security
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRY_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRY_MINUTES", "120"))
    
    # LLM APIs
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama3-70b-8192")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
    USE_OLLAMA: bool = os.getenv("USE_OLLAMA", "true").lower() == "true"
    
    # Vector DB & Embeddings
    VECTOR_DB_TYPE: str = os.getenv("VECTOR_DB_TYPE", "faiss")  # faiss or pinecone
    VECTOR_DB_PATH: str = os.getenv("VECTOR_DB_PATH", "./data/vector_store")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "")
    PINECONE_INDEX_NAME: str = os.getenv("PINECONE_INDEX_NAME", "shopping-assistant")
    
    # Redis Configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_USE_CONNECTION_POOL: bool = True
    
    # Database
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_DB_URL: str = os.getenv("SUPABASE_DB_URL", "")
    SUPABASE_TABLE: str = os.getenv("SUPABASE_TABLE", "orders")
    SUPABASE_PROFILE_TABLE: str = os.getenv("SUPABASE_PROFILE_TABLE", "profiles")
    SUPABASE_LOGIN_AUDIT_TABLE: str = os.getenv("SUPABASE_LOGIN_AUDIT_TABLE", "login_audit")
    SUPABASE_CHAT_MESSAGES_TABLE: str = os.getenv("SUPABASE_CHAT_MESSAGES_TABLE", "chat_messages")
    USE_SUPABASE: bool = os.getenv("USE_SUPABASE", "false").lower() == "true"
    
    # CORS
    CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:8000", "http://localhost:5173"]
    
    class Config:
        case_sensitive = True

@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings"""
    return Settings()

settings = get_settings()
