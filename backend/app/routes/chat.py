"""
AI Chat and Query Routes - Powered by RAG (Retrieval-Augmented Generation)

This module provides intelligent chatbot endpoints using:
- FAISS vector database for semantic search
- LangChain for LLM orchestration
- Redis for conversation memory
- Groq for high-speed LLM inference
"""
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import StreamingResponse
import asyncio
import json
import re
from typing import Optional
from uuid import uuid4
from app.schemas.chat import (
    ChatQuery,
    ChatResponse,
    RecommendationRequest,
    RecommendationResponse,
    ComparisonRequest,
    ComparisonResponse,
    ChatAskRequest,
    ChatDashboardData,
    VisitorSummary,
    ChatMessage,
    CartItem,
)
from app.services.rag_service import rag_chatbot_service
from app.services.order_service import order_service
from app.services.chat_memory_service import chat_memory_service
from app.services.redis_memory_service import redis_memory_service
from app.services.vector_db_service import vector_db_service
from app.services.supabase_auth_service import supabase_auth_service
from app.utils.auth import decode_access_token
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def _decode_current_user(authorization: Optional[str]) -> dict:
    """Decode and validate JWT token from Authorization header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = authorization.split(" ", 1)[1]
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload


def _suggested_questions() -> list[str]:
    """Return curated list of suggested questions for the chatbot."""
    return [
        "Show me the best budget wireless earbuds under INR 5000.",
        "Compare two smartwatches for battery life and display quality.",
        "Recommend top-rated products in Electronics with strong reviews.",
        "Which product gives the best value for money right now?",
        "Find alternatives similar to iPhone with lower price.",
        "What are the trending products in your catalog right now?",
    ]


def _build_cart_items_for_user(user_id: str, limit: int = 3) -> list[dict]:
    orders = order_service.get_all_orders()
    if not orders:
        return []

    safe_limit = max(1, min(limit, 10))
    seed = sum(ord(ch) for ch in str(user_id))
    start_index = seed % len(orders)

    selected: list[dict] = []
    used_indices: set[int] = set()
    idx = start_index
    while len(selected) < safe_limit and len(used_indices) < len(orders):
        idx = idx % len(orders)
        if idx not in used_indices:
            order = orders[idx]
            selected.append(
                {
                    "product_id": str(order.get("product_id") or ""),
                    "name": str(order.get("name") or "Unknown Product"),
                    "category": str(order.get("category") or ""),
                    "price": str(order.get("price") or "N/A"),
                    "image_link": str(order.get("image_link") or ""),
                    "quantity": (idx % 2) + 1,
                }
            )
            used_indices.add(idx)
        idx += 1

    return selected


def _build_visitors(current_user: dict) -> list[dict]:
    profiles = supabase_auth_service.list_profiles(limit=50)
    visitors: list[dict] = []
    seen_ids: set[str] = set()

    current_id = str(current_user.get("sub") or "")
    current_name = str(current_user.get("name") or "").strip() or str(current_user.get("email") or "").split("@", 1)[0] or "You"
    current_email = str(current_user.get("email") or "")

    visitors.append(
        {
            "id": current_id,
            "name": current_name,
            "email": current_email,
            "avatar_url": "",
            "last_message": "",
            "last_message_at": "",
        }
    )
    seen_ids.add(current_id)

    for profile in profiles:
        profile_id = str(profile.get("id") or "")
        if not profile_id or profile_id in seen_ids:
            continue

        visitors.append(
            {
                "id": profile_id,
                "name": str(profile.get("full_name") or profile.get("username") or profile.get("email") or "User"),
                "email": str(profile.get("email") or ""),
                "avatar_url": str(profile.get("avatar_url") or ""),
                "last_message": "",
                "last_message_at": str(profile.get("last_sign_in_at") or profile.get("updated_at") or ""),
            }
        )
        seen_ids.add(profile_id)

    return visitors


def _messages_for_user(user_id: str, limit: int = 100) -> list[dict]:
    """Fetch chat messages for a user from Redis memory."""
    rows = redis_memory_service.get_conversation_history(
        user_id=user_id,
        conversation_id="default",  # Default conversation
        limit=limit
    )
    return [
        {
            "role": str(row.get("role") or "assistant"),
            "content": str(row.get("content") or ""),
            "created_at": str(row.get("timestamp") or ""),
        }
        for row in rows
    ]


@router.get("/dashboard", response_model=ChatDashboardData)
async def get_chat_dashboard(
    selected_user_id: Optional[str] = Query(None, description="Selected visitor/user id"),
    authorization: Optional[str] = Header(default=None),
) -> ChatDashboardData:
    """
    Get chat dashboard data with visitors, conversation history, cart items, and suggested prompts.
    
    This endpoint provides the complete chat UI state including:
    - Current user and list of other visitors
    - Selected user's conversation history from Redis
    - Personalized shopping cart
    - Suggested questions for the chatbot
    """
    current_user = _decode_current_user(authorization)
    current_user_id = str(current_user.get("sub"))
    visitors = _build_visitors(current_user)

    selected_id = selected_user_id or current_user_id
    if not any(v.get("id") == selected_id for v in visitors):
        selected_id = current_user_id

    messages = _messages_for_user(selected_id, limit=120)
    cart_items = _build_cart_items_for_user(selected_id, limit=3)

    if visitors:
        for visitor in visitors:
            history = _messages_for_user(visitor.get("id", ""), limit=1)
            if history:
                visitor["last_message"] = history[-1]["content"][:50]
                visitor["last_message_at"] = history[-1]["created_at"]

    return ChatDashboardData(
        current_user_id=current_user_id,
        selected_user_id=selected_id,
        visitors=[VisitorSummary(**visitor) for visitor in visitors],
        messages=[ChatMessage(**message) for message in messages],
        cart_items=[CartItem(**item) for item in cart_items],
        suggested_questions=_suggested_questions(),
    )


@router.post("/ask", response_model=ChatResponse)
async def ask_chatbot(payload: ChatAskRequest, authorization: Optional[str] = Header(default=None)) -> ChatResponse:
    """
    Ask a single question to the RAG chatbot.
    
    The chatbot:
    1. Searches for relevant products using semantic similarity
    2. Retrieves conversation context from Redis
    3. Generates a contextual answer using LangChain + Groq
    4. Saves the interaction to memory
    
    This does NOT use streaming - returns complete answer.
    """
    try:
        current_user = _decode_current_user(authorization)
        user_id = payload.user_id or str(current_user.get("sub"))
        conversation_id = "default"  # Use default conversation

        # Call RAG service
        answer, retrieved_products = await rag_chatbot_service.answer_question(
            user_id=user_id,
            conversation_id=conversation_id,
            query=payload.question
        )

        return ChatResponse(
            question=payload.question,
            answer=answer,
            confidence=0.85,
        )

    except Exception as e:
        logger.error(f"Error in ask_chatbot: {str(e)}")
        raise HTTPException(status_code=500, detail="Error generating response")


@router.post("/ask-stream")
async def ask_chatbot_stream(payload: ChatAskRequest, authorization: Optional[str] = Header(default=None)) -> StreamingResponse:
    """
    Stream a chatbot response in real-time for better UX.
    
    The response is generated using RAG and streamed back as chunks,
    creating a ChatGPT-like typing effect in the UI.
    """
    current_user = _decode_current_user(authorization)

    async def response_stream():
        try:
            user_id = payload.user_id or str(current_user.get("sub"))
            conversation_id = "default"

            # Get RAG answer (full response)
            answer, _ = await rag_chatbot_service.answer_question(
                user_id=user_id,
                conversation_id=conversation_id,
                query=payload.question
            )

            # Stream the answer word-by-word
            words = answer.split()
            buffer: list[str] = []

            for word in words:
                buffer.append(word)
                if len(buffer) >= 3:  # Stream every 3 words
                    yield " ".join(buffer) + " "
                    buffer = []
                    await asyncio.sleep(0.05)

            if buffer:
                yield " ".join(buffer)

        except Exception as e:
            logger.error(f"Stream error: {str(e)}")
            yield f"Error: {str(e)}"

    return StreamingResponse(response_stream(), media_type="text/plain; charset=utf-8")


@router.post("/query", response_model=ChatResponse)
async def query_orders(chat_query: ChatQuery) -> ChatResponse:
    """
    Query products without user authentication (public endpoint).
    Uses RAG for intelligent product search.
    """
    try:
        products = order_service.get_all_orders()
        if not products:
            raise HTTPException(status_code=400, detail="No products available")

        # Use vector DB for semantic search
        relevant_products, scores = vector_db_service.search(
            chat_query.question, top_k=5, threshold=0.2
        )

        if not relevant_products:
            # Fallback to hybrid search
            relevant_products = vector_db_service.search_hybrid(
                chat_query.question, products, top_k=5
            )

        # Build product context
        context = "Available Products:\n"
        for i, prod in enumerate(relevant_products[:5], 1):
            context += f"{i}. {prod.get('name')} - {prod.get('price')} (⭐{prod.get('rating')})\n"

        answer = f"Found {len(relevant_products)} matching products:\n\n{context}"

        return ChatResponse(
            question=chat_query.question,
            answer=answer,
            confidence=0.8
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in query_orders: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing query")

@router.post("/recommend", response_model=RecommendationResponse)
async def get_recommendations(req: RecommendationRequest) -> RecommendationResponse:
    """
    Get product recommendations using RAG service.
    
    Can recommend by:
    - Product similarity (similar to a given product)
    - Category (products in a category)
    - Trending (best rated products overall)
    """
    try:
        products = order_service.get_all_orders()
        if not products:
            raise HTTPException(status_code=400, detail="No products available")

        # Use RAG recommendations
        recommendations = rag_chatbot_service.get_recommendations(
            user_id="system",
            conversation_id="recommendations",
            product_id=None,  # Can pass product_id for similarity
            category=None,
            count=req.count or 5
        )

        payload = []
        for idx, product in enumerate(recommendations[:req.count]):
            entry = {
                "product_id": product.get("product_id", ""),
                "name": product.get("name", "Unknown"),
                "category": product.get("category", ""),
                "rating": float(product.get("rating", 0)),
                "price": str(product.get("price", "N/A")),
                "image_link": product.get("image_link", ""),
                "match_type": "top_pick" if idx == 0 else "recommended",
            }
            payload.append(entry)

        return RecommendationResponse(
            product_name=req.product_name or "General Recommendations",
            recommendations=payload
        )

    except Exception as e:
        logger.error(f"Error in get_recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail="Error generating recommendations")

@router.post("/compare", response_model=ComparisonResponse)
async def compare_products(req: ComparisonRequest) -> ComparisonResponse:
    """
    Compare two products using RAG semantic analysis.
    
    The chatbot searches for both products and generates a detailed comparison
    highlighting differences in price, features, rating, etc.
    """
    try:
        if not req.product1 or not req.product2:
            raise HTTPException(status_code=400, detail="Both products required")

        products = order_service.get_all_orders()
        if not products:
            raise HTTPException(status_code=400, detail="No products available")

        # Find both products
        search1, scores1 = vector_db_service.search(req.product1, top_k=1)
        search2, scores2 = vector_db_service.search(req.product2, top_k=1)

        comparison_text = ""
        if search1 and search2:
            prod1 = search1[0]
            prod2 = search2[0]

            comparison_text = f"""
Comparison: {prod1['name']} vs {prod2['name']}

Product 1: {prod1['name']}
- Price: {prod1['price']}
- Rating: {prod1['rating']}⭐ ({prod1['total_reviews']} reviews)
- Category: {prod1['category']}

Product 2: {prod2['name']}
- Price: {prod2['price']}
- Rating: {prod2['rating']}⭐ ({prod2['total_reviews']} reviews)
- Category: {prod2['category']}

Recommendation: Based on the ratings and reviews, {prod1['name'] if prod1['rating'] >= prod2['rating'] else prod2['name']} appears to be the better choice.
"""

        compared_products = []
        if search1:
            compared_products.append({
                "product_id": search1[0].get("product_id"),
                "name": search1[0].get("name"),
                "price": search1[0].get("price"),
                "rating": search1[0].get("rating"),
                "match_type": "exact",
            })
        if search2:
            compared_products.append({
                "product_id": search2[0].get("product_id"),
                "name": search2[0].get("name"),
                "price": search2[0].get("price"),
                "rating": search2[0].get("rating"),
                "match_type": "exact",
            })

        return ComparisonResponse(
            product1=req.product1,
            product2=req.product2,
            comparison=comparison_text,
            compared_products=compared_products
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in compare_products: {str(e)}")
        raise HTTPException(status_code=500, detail="Error comparing products")

@router.post("/index-products")
async def index_products() -> dict:
    """
    Initialize the vector database with products.
    
    This endpoint:
    1. Fetches all products from the order service
    2. Creates embeddings for semantic search
    3. Indexes them in FAISS for fast retrieval
    
    Call this once at startup or when products change significantly.
    """
    try:
        success = rag_chatbot_service.index_products()

        if success:
            stats = vector_db_service.get_index_stats()
            return {
                "status": "success",
                "message": "Products indexed successfully",
                "stats": stats
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to index products")

    except Exception as e:
        logger.error(f"Error in index_products: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error indexing products: {str(e)}")


@router.get("/stats")
async def get_chatbot_stats() -> dict:
    """Get chatbot system statistics including indexing and memory status."""
    try:
        stats = rag_chatbot_service.get_chatbot_stats()
        return stats
    except Exception as e:
        logger.error(f"Error getting stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Error getting statistics")


@router.post("/clear-conversation")
async def clear_conversation(
    user_id: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
) -> dict:
    """Clear conversation history for a user."""
    try:
        current_user = _decode_current_user(authorization)
        target_user_id = user_id or str(current_user.get("sub"))

        redis_memory_service.clear_conversation(target_user_id, "default")

        return {
            "status": "success",
            "message": "Conversation cleared"
        }

    except Exception as e:
        logger.error(f"Error clearing conversation: {str(e)}")
        raise HTTPException(status_code=500, detail="Error clearing conversation")
