"""
AI/LLM Service with deep search and ChatGPT-like intelligent responses
"""
import os
import json
import re
from typing import List, Dict, Any, Optional
from langchain_groq import ChatGroq
from config import settings
import logging

logger = logging.getLogger(__name__)

class AIService:
    """AI Service for LLM operations with deep search and structured answers"""
    
    def __init__(self):
        """Initialize AI Service with llama-3.3-70b-versatile"""
        GROQ_API_KEY = settings.GROQ_API_KEY

        os.environ["GOOGLE_API_KEY"] = settings.GOOGLE_API_KEY
        os.environ["GROQ_API_KEY"] = GROQ_API_KEY
        
        # Using llama-3.3-70b-versatile as specified
        self.llm = ChatGroq(
            groq_api_key=GROQ_API_KEY,
            model_name="llama-3.3-70b-versatile"
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
            
            # Enhanced prompt for ChatGPT-like intelligent responses
            prompt_text = f"""You are an expert shopping assistant AI (like ChatGPT) specialized in product intelligence and recommendations.

Analyze the user's query deeply and provide:
1. Smart product matches with detailed insights
2. Price and value analysis
3. Quality assessment based on ratings and reviews
4. Personalized recommendations
5. Comparison insights if multiple products match
6. Always use Indian Rupees (INR) for all prices (1 USD = 83 INR)
7. Be conversational, informative, and helpful - not just listing data
8. Format with clear sections, emojis, and markdown for readability

Available Products (curated from your orders):
{json.dumps(relevant_products, ensure_ascii=False)}

User Query: {question}

Provide an intelligent, structured response that helps the user make informed decisions based on the product data. Focus on relevance and actionable insights."""
            
            response = self.llm.invoke(prompt_text)
            
            answer = response.content if hasattr(response, 'content') else str(response)
            # Fallback to structured answer if LLM response is empty
            return answer if answer and len(answer) > 30 else self._generate_structured_answer(question, relevant_products)
            
        except Exception as e:
            logger.error(f"Error answering query: {str(e)}")
            # Use fallback structured answer on any error
            return self._generate_structured_answer(question, self._deep_search_products(question, orders_list, limit=20))
    
    def get_recommendations(self, product: str, count: int = 5) -> str:
        """Get product recommendations"""
        try:
            prompt = f"""
            Suggest {count} products similar to '{product}' with:
            - Product Name
            - Description (2-3 lines)
            - Estimated Price Range
            - Key Features (3-4 bullet points)
            
            Format as a structured list with clear separations.
            Make suggestions realistic and relevant.
            """
            
            response = self.llm.invoke(prompt)
            return response.content if hasattr(response, 'content') else str(response)
        except Exception as e:
            logger.error(f"Error generating recommendations: {str(e)}")
            raise
    
    def compare_products(self, product1: str, product2: str) -> str:
        """Compare two products"""
        try:
            prompt = f"""
            Compare '{product1}' vs '{product2}' based on:
            - Price Range
            - Key Features
            - Performance/Quality
            - Pros & Cons (for each)
            - Which is better for different use cases
            - Overall Recommendation
            
            Provide a detailed, structured comparison that helps users make a decision.
            """
            
            response = self.llm.invoke(prompt)
            return response.content if hasattr(response, 'content') else str(response)
        except Exception as e:
            logger.error(f"Error comparing products: {str(e)}")
            raise

# Create singleton instance
ai_service = AIService()
