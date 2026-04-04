"""
Startup and initialization utilities for RAG chatbot.
Handles vector DB indexing and system bootstrap.
"""
import asyncio
from app.services.order_service import order_service
from app.services.rag_service import rag_chatbot_service
from app.services.vector_db_service import vector_db_service
import logging

logger = logging.getLogger(__name__)


async def initialize_rag_system():
    """
    Initialize RAG system on application startup.
    
    This function:
    1. Checks if products are already indexed
    2. If not, fetches products and creates embeddings
    3. Validates vector DB connectivity
    """
    try:
        logger.info("🚀 Initializing RAG chatbot system...")
        
        # Check if index exists
        stats = vector_db_service.get_index_stats()
        indexed_count = stats.get("total_products", 0)
        
        if indexed_count == 0:
            logger.info("⏳ No indexed products found. Starting indexing...")
            products = order_service.get_all_orders()
            
            if products:
                success = rag_chatbot_service.index_products(products)
                if success:
                    new_stats = vector_db_service.get_index_stats()
                    logger.info(f"✅ RAG system initialized with {new_stats.get('total_products', 0)} products")
                else:
                    logger.warning("⚠️ Failed to index products, RAG may not work optimally")
            else:
                logger.warning("⚠️ No products available for indexing")
        else:
            logger.info(f"✅ RAG system ready with {indexed_count} indexed products")
            
        return True
        
    except Exception as e:
        logger.error(f"❌ RAG system initialization error: {str(e)}")
        logger.warning("Application will continue but RAG features may be limited")
        return False


def initialize_redis():
    """
    Initialize Redis connection for conversation memory.
    Logs connection status and prepares fallback mode if needed.
    """
    try:
        from app.services.redis_memory_service import redis_memory_service
        
        if redis_memory_service.redis_client:
            logger.info("✅ Redis memory backend initialized")
            return True
        else:
            logger.warning("⚠️ Redis not available, falling back to in-memory storage")
            return False
            
    except Exception as e:
        logger.error(f"Redis initialization error: {str(e)}")
        return False


async def startup_event():
    """
    Combined startup event - initializes all RAG components.
    Call this from FastAPI app.add_event_handler("startup", startup_event)
    """
    logger.info("=" * 60)
    logger.info("AI Shopping Assistant - RAG Chatbot Starting")
    logger.info("=" * 60)
    
    # Initialize Redis
    initialize_redis()
    
    # Initialize RAG system in background so API becomes responsive immediately.
    asyncio.create_task(initialize_rag_system())
    
    logger.info("=" * 60)
    logger.info("✅ Application startup complete")
    logger.info("=" * 60)


def shutdown_event():
    """
    Cleanup event called on application shutdown.
    Currently a placeholder for future resource cleanup.
    """
    logger.info("🛑 Application shutting down...")
