"""
RAG (Retrieval-Augmented Generation) Service using LangChain.
Integrates vector search, LLM generation, and memory management for intelligent chatbot.
"""
import json
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from langchain_groq import ChatGroq
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from config import settings
from app.services.vector_db_service import vector_db_service
from app.services.redis_memory_service import redis_memory_service
from app.services.order_service import order_service
import logging

logger = logging.getLogger(__name__)

# Catalog system prompt - the rules for the chatbot
SYSTEM_PROMPT = """You are an intelligent AI Shopping Assistant for an e-commerce platform.

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
- Conversational
- Clear and concise"""


class RAGChatbotService:
    """
    RAG-based chatbot service combining:
    - LangChain for orchestration
    - FAISS vector DB for semantic search
    - Redis for multi-turn conversation memory
    - Groq LLM for generation
    """

    def __init__(self):
        """Initialize RAG components."""
        try:
            # Initialize LLM with Groq
            self.llm = ChatGroq(
                api_key=settings.GROQ_API_KEY,
                model_name=settings.GROQ_MODEL or "llama3-70b-8192",
                temperature=0.4,  # Low temperature for factual answers
                max_tokens=2048,
            )
            logger.info("✅ RAG Chatbot initialized with Groq LLM")

        except Exception as e:
            logger.error(f"❌ RAG initialization failed: {str(e)}")
            self.llm = None

    def _build_context_from_products(self, products: List[Dict[str, Any]]) -> str:
        """Format product list into LLM context."""
        if not products:
            return "No matching products found in the catalog."

        context_lines = ["Available Products:"]
        for i, product in enumerate(products[:10], 1):  # Limit to 10 for token efficiency
            name = product.get("name", "Unknown")
            category = product.get("category", "")
            rating = product.get("rating", 0)
            price = product.get("price", "N/A")
            reviews = product.get("total_reviews", 0)

            context_lines.append(
                f"{i}. {name} (Category: {category})\n"
                f"   Price: {price} | Rating: {rating}⭐ ({reviews} reviews)"
            )

        return "\n".join(context_lines)

    def _get_conversation_context(
        self,
        user_id: str,
        conversation_id: str
    ) -> List[BaseMessage]:
        """
        Build conversation history as LangChain messages.
        
        Returns:
            List of HumanMessage/AIMessage objects for context
        """
        messages = redis_memory_service.get_conversation_history(
            user_id, conversation_id, limit=10
        )

        lang_messages = []
        for msg in messages:
            role = msg.get("role", "assistant").lower()
            content = msg.get("content", "")

            if role == "user":
                lang_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                lang_messages.append(AIMessage(content=content))

        return lang_messages

    async def answer_question(
        self,
        user_id: str,
        conversation_id: str,
        query: str,
        context_window: int = 10
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Answer a user question using RAG pipeline.
        
        Process:
        1. Retrieve relevant products using semantic search
        2. Get conversation history from Redis
        3. Generate contextual answer using LLM
        4. Save to memory
        
        Args:
            user_id: User identifier
            conversation_id: Conversation session ID
            query: User question
            context_window: Number of previous messages to include
        
        Returns:
            Tuple of (answer_text, retrieved_products)
        """
        try:
            if not self.llm:
                return "Service temporarily unavailable", []

            # Step 1: Semantic search for relevant products
            all_products = order_service.get_all_orders()
            relevant_products, scores = vector_db_service.search(query, top_k=5, threshold=0.2)

            # If vector search finds few results, do hybrid search
            if len(relevant_products) < 3:
                relevant_products = vector_db_service.search_hybrid(
                    query, all_products, top_k=5
                )

            # Step 2: Build product context
            product_context = self._build_context_from_products(relevant_products)

            # Step 3: Get conversation history
            history_messages = self._get_conversation_context(user_id, conversation_id)

            # Step 4: Build full prompt with system + history + current query
            conversation_context = ""
            if history_messages:
                history_text = "\n".join(
                    [f"{type(m).__name__}: {m.content}" for m in history_messages[-5:]]
                )
                conversation_context = f"\nRecent conversation context:\n{history_text}\n"

            user_message_content = f"""{conversation_context}
{product_context}

Customer Query:
{query}

Task:
Answer the customer based on the available products. Be conversational and always recommend from the catalog provided.

Response Requirements:
- Address the customer's specific request
- Mention relevant product names, prices, and ratings
- Explain why a product is a good fit
- If comparing products, be clear and practical
- Never mention products not in the provided list"""

            # Step 5: Generate response
            messages = [
                SystemMessage(content=SYSTEM_PROMPT),
                *history_messages[-5:],  # Include recent context
                HumanMessage(content=user_message_content),
            ]

            response = self.llm.invoke(messages)
            answer = response.content

            # Step 6: Save to Redis memory
            redis_memory_service.append_message(
                user_id,
                conversation_id,
                "user",
                query,
                {"timestamp": datetime.utcnow().isoformat()}
            )
            redis_memory_service.append_message(
                user_id,
                conversation_id,
                "assistant",
                answer,
                {
                    "timestamp": datetime.utcnow().isoformat(),
                    "retrieved_products": len(relevant_products),
                    "model": settings.GROQ_MODEL,
                }
            )

            logger.info(
                f"Generated answer for {user_id}|{conversation_id} "
                f"(retrieved {len(relevant_products)} products)"
            )

            return answer, relevant_products

        except Exception as e:
            logger.error(f"Error in answer_question: {str(e)}")
            return f"Error generating response: {str(e)}", []

    async def stream_answer(
        self,
        user_id: str,
        conversation_id: str,
        query: str
    ):
        """
        Stream answer in chunks for real-time UI updates.
        
        Yields:
            Text chunks as they're generated
        """
        try:
            if not self.llm:
                yield "Service temporarily unavailable"
                return

            # Perform full RAG pipeline
            answer, products = await self.answer_question(
                user_id, conversation_id, query
            )

            # Stream answer word by word
            words = answer.split()
            buffer = []

            for word in words:
                buffer.append(word)
                if len(buffer) >= 4:  # Yield every 4 words
                    yield " ".join(buffer) + " "
                    buffer = []

            if buffer:
                yield " ".join(buffer)

        except Exception as e:
            logger.error(f"Error in stream_answer: {str(e)}")
            yield f"Error: {str(e)}"

    def get_recommendations(
        self,
        user_id: str,
        conversation_id: str,
        product_id: Optional[str] = None,
        category: Optional[str] = None,
        count: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Get product recommendations based on preference.
        
        Args:
            user_id: User ID
            conversation_id: Conversation ID
            product_id: Similar to this product
            category: From this category
            count: Number of recommendations
        
        Returns:
            List of recommended products
        """
        try:
            if product_id:
                # Get similar products
                return vector_db_service.get_similar_products(product_id, top_k=count)

            elif category:
                # Get products in category
                all_products = order_service.get_all_orders()
                category_products = [
                    p for p in all_products
                    if str(p.get("category", "")).lower() == str(category).lower()
                ]
                # Sort by rating
                sorted_products = sorted(
                    category_products,
                    key=lambda x: (float(x.get("rating", 0)), int(x.get("total_reviews", 0))),
                    reverse=True
                )
                return sorted_products[:count]

            else:
                # Trending products (high rating + reviews)
                all_products = order_service.get_all_orders()
                sorted_products = sorted(
                    all_products,
                    key=lambda x: (float(x.get("rating", 0)), int(x.get("total_reviews", 0))),
                    reverse=True
                )
                return sorted_products[:count]

        except Exception as e:
            logger.error(f"Error getting recommendations: {str(e)}")
            return []

    def index_products(self, products: Optional[List[Dict[str, Any]]] = None) -> bool:
        """
        Index products for vector search.
        
        Args:
            products: Products to index (if None, uses all orders)
        
        Returns:
            Success status
        """
        try:
            if products is None:
                products = order_service.get_all_orders()

            if not products:
                logger.warning("No products to index")
                return False

            success = vector_db_service.index_products(products)

            if success:
                stats = vector_db_service.get_index_stats()
                logger.info(f"✅ Indexed {stats['total_products']} products")

            return success

        except Exception as e:
            logger.error(f"Error indexing products: {str(e)}")
            return False

    def get_chatbot_stats(self) -> Dict[str, Any]:
        """Get chatbot and system statistics."""
        try:
            vector_stats = vector_db_service.get_index_stats() if vector_db_service else {}
            return {
                "model": settings.GROQ_MODEL,
                "temperature": 0.4,
                "vector_db": vector_stats,
                "memory_backend": "Redis" if redis_memory_service.redis_client else "In-Memory",
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error getting stats: {str(e)}")
            return {}


# Singleton instance
rag_chatbot_service = RAGChatbotService()
