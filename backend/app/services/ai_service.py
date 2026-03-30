"""
AI/LLM Service for order assistant and recommendations
"""
import os
from langchain_groq import ChatGroq
from config import settings
import logging

logger = logging.getLogger(__name__)

class AIService:
    """AI Service for LLM operations"""
    
    def __init__(self):
        """Initialize AI Service"""
        os.environ["GOOGLE_API_KEY"] = settings.GOOGLE_API_KEY
        os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY
        
        self.llm = ChatGroq(
            groq_api_key=settings.GROQ_API_KEY,
            model_name=settings.GROQ_MODEL
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
    
    def answer_order_query(self, question: str, orders_data: str) -> str:
        """Answer questions about orders"""
        try:
            if not self.vectors:
                self.create_vector_embeddings(orders_data)
            
            # Create prompt with order context
            prompt_text = f"""You are an Order Assistant AI. Based on the user's orders provided below, answer queries related to placed orders.
If the query is not covered in the orders data, respond appropriately but be helpful.

Orders Data:
{orders_data}

Question: {question}

Provide a helpful and accurate answer based on the orders information provided."""
            
            response = self.llm.invoke(prompt_text)
            
            if hasattr(response, 'content'):
                return response.content
            else:
                return str(response)
        except Exception as e:
            logger.error(f"Error answering order query: {str(e)}")
            raise
    
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
