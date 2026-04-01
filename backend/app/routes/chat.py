"""
AI Chat and Query Routes
"""
from fastapi import APIRouter, HTTPException
import json
import re
from app.schemas.chat import (
    ChatQuery, ChatResponse, RecommendationRequest, 
    RecommendationResponse, ComparisonRequest, ComparisonResponse
)
from app.services.ai_service import ai_service
from app.services.order_service import order_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def _extract_usd_amount(price_text: str) -> float:
    if not price_text:
        return 0.0
    match = re.search(r"\d+(?:\.\d+)?", str(price_text).replace(",", ""))
    if not match:
        return 0.0
    try:
        return float(match.group(0))
    except (TypeError, ValueError):
        return 0.0


def _format_inr(price_text: str, rate: float = 83.0) -> str:
    usd = _extract_usd_amount(price_text)
    if usd <= 0:
        return "N/A"
    return f"INR {usd * rate:,.0f}"


def _has_name_match(query: str, candidate_name: str) -> bool:
    terms = [t.lower() for t in re.split(r"\W+", (query or "")) if t and len(t) > 1]
    candidate_lower = str(candidate_name or "").lower()
    return any(term in candidate_lower for term in terms)


def _build_product_entry(order: dict, match_type: str = "related") -> dict:
    return {
        "product_id": order.get("product_id", ""),
        "name": order.get("name", "Unknown Product"),
        "category": order.get("category", "N/A"),
        "rating": float(order.get("rating", 0) or 0),
        "price": _format_inr(str(order.get("price", ""))),
        "price_usd": order.get("price", "N/A"),
        "image_link": order.get("image_link", ""),
        "product_page_url": order.get("product_page_url", ""),
        "match_type": match_type,
        "details": {
            "reviews": order.get("total_reviews"),
            "discount_percentage": order.get("discount_percentage"),
            "is_best_seller": order.get("is_best_seller"),
            "is_sponsored": order.get("is_sponsored"),
            "has_coupon": order.get("has_coupon"),
            "buy_box_availability": order.get("buy_box_availability"),
            "expected_delivery_date": order.get("expected_delivery_date"),
            "purchased_last_month": order.get("purchased_last_month"),
            "sustainability_tags": order.get("sustainability_tags"),
            "order_placed_date": order.get("order_placed_date"),
            "original_price": order.get("original_price"),
        },
    }


def _rank_orders_for_product(product_name: str, orders: list[dict], limit: int = 5) -> list[dict]:
    """Improved product ranking with better semantic matching"""
    terms = [t for t in re.split(r"\W+", (product_name or "").lower()) if t and len(t) > 1]
    
    scored: list[tuple[int, dict]] = []
    for order in orders:
        name_lower = str(order.get('name', '')).lower()
        category_lower = str(order.get('category', '')).lower()
        combined = f"{name_lower} {category_lower}"
        
        score = 0
        for t in terms:
            # Prioritize product name matches
            if t in name_lower:
                score += 5
            elif t in category_lower:
                score += 2
            elif t in combined:
                score += 1
        
        if score > 0:
            scored.append((score, order))
    
    # Sort by relevance score
    scored.sort(key=lambda item: item[0], reverse=True)
    matched = [order for _, order in scored]
    
    # If we found relevant matches, return them
    if matched:
        return matched[:limit]
    
    # Fallback: return products with highest ratings + reviews
    orders_by_quality = sorted(
        orders,
        key=lambda x: (float(x.get('rating', 0)), float(x.get('total_reviews', 0))),
        reverse=True
    )
    return orders_by_quality[:limit]

@router.post("/query", response_model=ChatResponse)
async def query_orders(chat_query: ChatQuery) -> ChatResponse:
    """
    Query orders using AI assistant
    
    Body Parameters:
    - question: User question about orders
    - context: Optional context for the question
    """
    try:
        orders = order_service.get_all_orders()
        if not orders:
            raise HTTPException(status_code=400, detail="No orders available")

        relevant_orders = ai_service._rank_orders(chat_query.question, orders, limit=25)
        orders_data = order_service.get_orders_as_json_string() if not relevant_orders else json.dumps(relevant_orders, ensure_ascii=False)
        
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
        orders = order_service.get_all_orders()
        if not orders:
            raise HTTPException(status_code=400, detail="No product data available")

        ranked = _rank_orders_for_product(req.product_name, orders, limit=max(req.count, 5) + 1)

        # Check if we found good matches by comparing search term with product names
        search_terms = [t.lower() for t in re.split(r"\W+", (req.product_name or "")) if t and len(t) > 1]
        has_good_matches = False
        if ranked and search_terms:
            has_good_matches = any(
                term in str(ranked[0].get("name", "")).lower() for term in search_terms
            )

        searched_product = None
        recommendations_data = []

        for idx, order in enumerate(ranked):
            entry = _build_product_entry(
                order,
                match_type="exact" if idx == 0 and has_good_matches else "related"
            )

            if idx == 0:
                searched_product = entry
            else:
                recommendations_data.append(entry)

        llm_text = ""
        # Skip LLM call - focus on product card display instead
        # try:
        #     llm_text = ai_service.get_recommendations(product=req.product_name, count=req.count)
        # except Exception as llm_error:
        #     logger.warning(f"LLM recommendation fallback used: {llm_error}")

        payload = []
        if searched_product:
            payload.append({"searched_product": searched_product})

        payload.extend(recommendations_data[:req.count])

        if llm_text:
            payload.append({"text": llm_text})
        
        return RecommendationResponse(
            product_name=req.product_name,
            recommendations=payload
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

        orders = order_service.get_all_orders()
        first_ranked = _rank_orders_for_product(req.product1, orders, limit=1)
        second_ranked = _rank_orders_for_product(req.product2, orders, limit=1)

        compared_products: list[dict] = []
        if first_ranked:
            compared_products.append(
                _build_product_entry(
                    first_ranked[0],
                    match_type="exact" if _has_name_match(req.product1, first_ranked[0].get("name", "")) else "related"
                )
            )
        if second_ranked:
            compared_products.append(
                _build_product_entry(
                    second_ranked[0],
                    match_type="exact" if _has_name_match(req.product2, second_ranked[0].get("name", "")) else "related"
                )
            )
        
        return ComparisonResponse(
            product1=req.product1,
            product2=req.product2,
            comparison=comparison,
            compared_products=compared_products
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
