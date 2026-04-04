"""
AI/LLM Service with deep search and ChatGPT-like intelligent responses
"""
import os
import json
import re
from typing import List, Dict, Any, Optional
import requests
from langchain_groq import ChatGroq
from config import settings
import logging

CATALOG_SYSTEM_PROMPT = """You are an intelligent AI Shopping Assistant for an e-commerce platform.

Your role is to help users discover, compare, and choose the best products based only on the provided product catalog.

Important behavior rules:
- Recommend only products found in the provided data.
- Never invent products, prices, ratings, discounts, or specifications.
- Give practical and useful shopping advice.
- If multiple products match, rank them by relevance, rating, review count, and value for money.
- If the user asks for the best product, recommend one top option first and explain why.
- If the user asks for cheap, budget, or affordable products, prioritize lower price and decent quality.
- If the user asks for premium or best quality, prioritize rating, reviews, and value.
- If the user asks for a comparison, compare clearly in simple terms.
- If no suitable product exists in the provided data, say so honestly.
- Always respond like a smart e-commerce assistant, not a general chatbot.
"""

logger = logging.getLogger(__name__)

class AIService:
    """AI Service for LLM operations with deep search and structured answers"""
    
    def __init__(self):
        """Initialize AI Service with Ollama-first and Groq fallback."""
        GROQ_API_KEY = settings.GROQ_API_KEY

        os.environ["GOOGLE_API_KEY"] = settings.GOOGLE_API_KEY
        os.environ["GROQ_API_KEY"] = GROQ_API_KEY

        self.use_ollama = bool(settings.USE_OLLAMA)
        self.ollama_base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.ollama_model = settings.OLLAMA_MODEL

        self.llm = None
        if GROQ_API_KEY:
            self.llm = ChatGroq(
                groq_api_key=GROQ_API_KEY,
                model_name=settings.GROQ_MODEL or "llama3-70b-8192",
                temperature=0.4,
            )

        self.embeddings = None
        self.vectors = None
    
    def create_vector_embeddings(self, text: str):
        """Create vector embeddings from text"""
        try:
            # Simplified version - just store the text for context
            self.vectors = {"text": text}
            return True
        except Exception as e:
            logger.error(f"Error creating vector embeddings: {str(e)}")
            raise

    def _invoke_llm(self, prompt_text: str) -> str:
        """Invoke Ollama first, then fallback to Groq if configured."""
        if self.use_ollama:
            try:
                response = requests.post(
                    f"{self.ollama_base_url}/api/generate",
                    json={
                        "model": self.ollama_model,
                        "prompt": prompt_text,
                        "stream": False,
                        "options": {"temperature": 0.4},
                    },
                    timeout=60,
                )
                response.raise_for_status()
                payload = response.json()
                answer = str(payload.get("response", "")).strip()
                if answer:
                    return answer
            except Exception as ollama_error:
                logger.warning(f"Ollama unavailable, falling back if possible: {ollama_error}")

        if self.llm is not None:
            response = self.llm.invoke(prompt_text)
            return response.content if hasattr(response, 'content') else str(response)

        return ""

    def _extract_price_usd(self, price_text: str) -> float:
        """Extract numeric USD amount from mixed price strings."""
        if not price_text:
            return 0.0
        match = re.search(r"\d+(?:\.\d+)?", str(price_text).replace(",", ""))
        if not match:
            return 0.0
        try:
            return float(match.group(0))
        except (TypeError, ValueError):
            return 0.0

    def _format_inr(self, usd_amount: float, rate: float = 83.0) -> str:
        """Convert USD amount to INR display text."""
        if usd_amount <= 0:
            return "N/A"
        inr_amount = usd_amount * rate
        return f"INR {inr_amount:,.0f}"

    def _rank_orders(self, query: str, orders: List[Dict[str, Any]], limit: int = 25) -> List[Dict[str, Any]]:
        """Rank orders by basic text relevance for prompt compaction and UI results."""
        terms = [t for t in re.split(r"\W+", (query or "").lower()) if t and len(t) > 1]
        if not terms:
            return orders[:limit]

        scored = []
        for order in orders:
            haystack = f"{order.get('name', '')} {order.get('category', '')}".lower()
            score = sum(2 if t in str(order.get('name', '')).lower() else 1 for t in terms if t in haystack)
            if score > 0:
                scored.append((score, order))

        scored.sort(key=lambda item: item[0], reverse=True)
        ranked = [order for _, order in scored]
        if not ranked:
            return orders[:limit]
        return ranked[:limit]

    def _build_fallback_answer(self, question: str, orders: List[Dict[str, Any]]) -> str:
        """Generate ChatGPT-style structured answer with analysis."""
        return self._generate_structured_answer(question, orders)

    def _deep_search_products(self, query: str, orders: List[Dict[str, Any]], limit: int = 30) -> List[Dict[str, Any]]:
        """Advanced semantic and keyword-based product search."""
        terms: List[str] = [t.lower() for t in re.split(r"\W+", (query or "")) if t and len(t) > 1]
        if not terms:
            return orders[:limit]

        scored: List[tuple[int, Dict[str, Any]]] = []
        for order in orders:
            score = 0
            name_lower = str(order.get("name", "")).lower()
            category_lower = str(order.get("category", "")).lower()
            combined = f"{name_lower} {category_lower}"

            for term in terms:
                if term in name_lower:
                    score += 5
                elif term in category_lower:
                    score += 2
                elif term in combined:
                    score += 1

            if score > 0:
                scored.append((score, order))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [order for _, order in scored[:limit]]

    def _generate_structured_answer(self, question: str, products: List[Dict[str, Any]]) -> str:
        """Generate intelligent, ChatGPT-style answers with deep analysis."""
        if not products:
            return "🔍 No products found matching your query. Try different keywords or browse by category."

        answer_parts = []

        # Detect search intent
        question_lower = question.lower()
        if any(w in question_lower for w in ["price", "cheap", "expensive", "cost", "afford", "budget"]):
            answer_parts.append("💰 **Price Analysis & Recommendations**\n")
        elif any(w in question_lower for w in ["best", "top", "recommend", "good", "excellent"]):
            answer_parts.append("⭐ **Top Recommendations**\n")
        elif any(w in question_lower for w in ["rating", "review", "quality", "reliable"]):
            answer_parts.append("⭐ **Quality & Reliability Report**\n")
        else:
            answer_parts.append("🔍 **Detailed Search Results**\n")

        # Header with match count
        answer_parts.append(f"Found **{len(products)}** products matching: *{question}*\n")

        # Detailed product listings
        for idx, product in enumerate(products[:5], 1):
            name = product.get("name", "Unknown")
            category = product.get("category", "N/A")
            rating = product.get("rating", 0)
            reviews = int(product.get("total_reviews", 0)) if product.get("total_reviews") else 0
            price_usd = self._extract_price_usd(str(product.get("price", "")))
            price_inr = self._format_inr(price_usd)
            discount = product.get("discount_percentage", 0)

            quality_indicator = "🟢 Excellent" if rating >= 4.5 else "🟡 Good" if rating >= 4.0 else "🟠 Fair"

            answer_parts.append(f"\n### {idx}. {name}")
            answer_parts.append(f"**Category:** {category}")
            answer_parts.append(f"**Rating:** {rating}⭐ ({reviews:,} reviews) {quality_indicator}")
            answer_parts.append(f"**Price:** {price_inr}")

            if discount and discount > 0:
                answer_parts.append(f"**🔥 Discount:** {discount}% OFF!")
            if product.get("is_best_seller") == "Yes":
                answer_parts.append(f"**✅ Amazon's Choice** - Best Seller")

        # Price insights
        if len(products) > 1:
            prices = [self._extract_price_usd(str(p.get("price", ""))) for p in products[:5] if self._extract_price_usd(str(p.get("price", ""))) > 0]
            if prices:
                answer_parts.append(f"\n### 💵 Price Range Summary")
                answer_parts.append(f"- **Lowest:** {self._format_inr(min(prices))}")
                answer_parts.append(f"- **Highest:** {self._format_inr(max(prices))}")
                answer_parts.append(f"- **Average:** {self._format_inr(sum(prices) / len(prices))}")

        # Top pick highlight
        best_product = max(products[:5], key=lambda x: (x.get("rating", 0), x.get("total_reviews", 0)))
        answer_parts.append(f"\n### 🏆 Best Overall")
        answer_parts.append(f"{best_product.get('name', 'N/A')} ({best_product.get('rating', 'N/A')}⭐ - {int(best_product.get('total_reviews', 0)):,} reviews)")

        # Tips
        answer_parts.append(f"\n💡 **Pro Tip:** You can refine your search by adding price range, specific features, or category in your query.")

        return "\n".join(answer_parts)

    def _build_catalog_user_prompt(self, customer_query: str, product_context: str) -> str:
        """Build the user prompt exactly in the catalog-constrained format."""
        return f"""
Customer Query:
{customer_query}

Available Matching Products:
{product_context}

Task:
Answer the customer using only the available matching products.

Response Requirements:
- Recommend the best matching product first.
- Mention why it is a good fit.
- If useful, include 2-3 alternative products.
- Mention price, rating, and value when relevant.
- If the user asks to compare, compare clearly and practically.
- Do not invent missing information.
"""
    
    def answer_order_query(self, question: str, orders_data: str) -> str:
        """Generate intelligent answers using deep search and LLM analysis."""
        orders_list: List[Dict[str, Any]] = []
        try:
            orders_list = json.loads(orders_data) if orders_data else []
            if isinstance(orders_list, dict):
                orders_list = [orders_list]
            if not isinstance(orders_list, list):
                orders_list = []

            # Use deep semantic search instead of simple ranking
            relevant_products = self._deep_search_products(question, orders_list, limit=30)

            if not self.vectors:
                self.create_vector_embeddings(json.dumps(relevant_products, ensure_ascii=False))
            
            product_context = json.dumps(relevant_products, ensure_ascii=False)

            user_prompt = self._build_catalog_user_prompt(question, product_context)
            prompt_text = f"""SYSTEM PROMPT:
{CATALOG_SYSTEM_PROMPT}

USER PROMPT:
{user_prompt}
"""
            
            answer = self._invoke_llm(prompt_text)
            # Fallback to structured answer if model response is empty
            return answer if answer and len(answer) > 30 else self._generate_structured_answer(question, relevant_products)
            
        except Exception as e:
            logger.error(f"Error answering query: {str(e)}")
            # Use fallback structured answer on any error
            return self._generate_structured_answer(question, self._deep_search_products(question, orders_list, limit=20))
    
    def get_recommendations(self, product: str, count: int = 5, available_products: Optional[List[Dict[str, Any]]] = None) -> str:
        """Get product recommendations from provided catalog context only."""
        try:
            candidates = available_products or []
            if not candidates:
                return "I could not find suitable products in the provided catalog for that request."

            prompt = f"""SYSTEM PROMPT:
You are an intelligent AI Shopping Assistant for an e-commerce platform.

Your role is to help users discover, compare, and choose the best products based only on the provided product catalog.

Important behavior rules:
- Recommend only products found in the provided data.
- Never invent products, prices, ratings, discounts, or specifications.
- Give practical and useful shopping advice.
- If multiple products match, rank them by relevance, rating, review count, and value for money.
- If the user asks for the best product, recommend one top option first and explain why.
- If the user asks for cheap, budget, or affordable products, prioritize lower price and decent quality.
- If the user asks for premium or best quality, prioritize rating, reviews, and value.
- If the user asks for a comparison, compare clearly in simple terms.
- If no suitable product exists in the provided data, say so honestly.
- Always respond like a smart e-commerce assistant, not a general chatbot.

Style:
- Human-like
- Helpful
- Shopping-focused
- Clear and concise

USER PROMPT TEMPLATE:
Customer Query:
Recommend {count} products similar to: {product}

Available Matching Products:
{json.dumps(candidates, ensure_ascii=False)}

Task:
Answer the customer using only the available matching products.

Response Requirements:
- Recommend the best matching product first.
- Mention why it is a good fit.
- If useful, include 2-3 alternative products.
- Mention price, rating, and value when relevant.
- If the user asks to compare, compare clearly and practically.
- Do not invent missing information.
"""

            answer = self._invoke_llm(prompt)
            return answer if answer else "Unable to generate recommendations right now."
        except Exception as e:
            logger.error(f"Error generating recommendations: {str(e)}")
            raise
    
    def compare_products(self, product1: str, product2: str, available_products: Optional[List[Dict[str, Any]]] = None) -> str:
        """Compare two products using only provided catalog context."""
        try:
            candidates = available_products or []
            if not candidates:
                return "I could not find enough matching products in the provided catalog to make a reliable comparison."

            prompt = f"""SYSTEM PROMPT:
You are an intelligent AI Shopping Assistant for an e-commerce platform.

Your role is to help users discover, compare, and choose the best products based only on the provided product catalog.

Important behavior rules:
- Recommend only products found in the provided data.
- Never invent products, prices, ratings, discounts, or specifications.
- Give practical and useful shopping advice.
- If multiple products match, rank them by relevance, rating, review count, and value for money.
- If the user asks for the best product, recommend one top option first and explain why.
- If the user asks for cheap, budget, or affordable products, prioritize lower price and decent quality.
- If the user asks for premium or best quality, prioritize rating, reviews, and value.
- If the user asks for a comparison, compare clearly in simple terms.
- If no suitable product exists in the provided data, say so honestly.
- Always respond like a smart e-commerce assistant, not a general chatbot.

Style:
- Human-like
- Helpful
- Shopping-focused
- Clear and concise

USER PROMPT TEMPLATE:
Customer Query:
Compare {product1} vs {product2}

Available Matching Products:
{json.dumps(candidates, ensure_ascii=False)}

Task:
Answer the customer using only the available matching products.

Response Requirements:
- Recommend the best matching product first.
- Mention why it is a good fit.
- If useful, include 2-3 alternative products.
- Mention price, rating, and value when relevant.
- If the user asks to compare, compare clearly and practically.
- Do not invent missing information.
"""

            answer = self._invoke_llm(prompt)
            return answer if answer else "Unable to generate comparison right now."
        except Exception as e:
            logger.error(f"Error comparing products: {str(e)}")
            raise

# Create singleton instance
ai_service = AIService()
