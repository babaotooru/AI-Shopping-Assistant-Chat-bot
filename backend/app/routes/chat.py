"""
AI Chat and Query Routes
"""
from fastapi import APIRouter, HTTPException
from app.schemas.chat import (
    ChatQuery, ChatResponse, RecommendationRequest, 
    RecommendationResponse, ComparisonRequest, ComparisonResponse
)
from app.services.ai_service import ai_service
from app.services.order_service import order_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/query", response_model=ChatResponse)
async def query_orders(chat_query: ChatQuery) -> ChatResponse:
    """
    Query orders using AI assistant
    
    Body Parameters:
    - question: User question about orders
    - context: Optional context for the question
    """
    try:
        orders_data = order_service.get_orders_as_json_string()
        if not orders_data or orders_data == "[]":
            raise HTTPException(status_code=400, detail="No orders available")
        
        answer = ai_service.answer_order_query(chat_query.question, orders_data)
        
        return ChatResponse(
            question=chat_query.question,
            answer=answer,
            confidence=0.85
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing query")

@router.post("/recommend", response_model=RecommendationResponse)
async def get_recommendations(req: RecommendationRequest) -> RecommendationResponse:
    """
    Get product recommendations
    
    Body Parameters:
    - product_name: Name of product to get recommendations for
    - count: Number of recommendations (default: 5)
    """
    try:
        recommendations = ai_service.get_recommendations(
            product=req.product_name,
            count=req.count
        )
        
        return RecommendationResponse(
            product_name=req.product_name,
            recommendations=[{
                "text": recommendations
            }]
        )
    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail="Error generating recommendations")

@router.post("/compare", response_model=ComparisonResponse)
async def compare_products(req: ComparisonRequest) -> ComparisonResponse:
    """
    Compare two products
    
    Body Parameters:
    - product1: First product name
    - product2: Second product name
    """
    try:
        if not req.product1 or not req.product2:
            raise HTTPException(status_code=400, detail="Both products are required")
        
        comparison = ai_service.compare_products(req.product1, req.product2)
        
        return ComparisonResponse(
            product1=req.product1,
            product2=req.product2,
            comparison=comparison
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing products: {str(e)}")
        raise HTTPException(status_code=500, detail="Error comparing products")

@router.post("/process-orders")
async def process_orders() -> dict:
    """
    Process and index orders for AI assistant
    This creates vector embeddings for semantic search
    """
    try:
        orders_data = order_service.get_orders_as_json_string()
        if not orders_data or orders_data == "[]":
            raise HTTPException(status_code=400, detail="No orders available to process")
        
        ai_service.create_vector_embeddings(orders_data)
        
        return {
            "status": "success",
            "message": "Orders processed successfully",
            "orders_count": len(order_service.get_all_orders())
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing orders: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing orders")
