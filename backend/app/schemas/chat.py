"""
Chat/Query Schema Models
"""
from pydantic import BaseModel
from typing import Optional

class ChatQuery(BaseModel):
    """Chat Query Request"""
    question: str
    context: Optional[str] = None

class ChatResponse(BaseModel):
    """Chat Response"""
    question: str
    answer: str
    confidence: Optional[float] = None

class RecommendationRequest(BaseModel):
    """Product Recommendation Request"""
    product_name: str
    count: int = 5

class RecommendationResponse(BaseModel):
    """Product Recommendation Response"""
    product_name: str
    recommendations: list[dict]

class ComparisonRequest(BaseModel):
    """Product Comparison Request"""
    product1: str
    product2: str

class ComparisonResponse(BaseModel):
    """Product Comparison Response"""
    product1: str
    product2: str
    comparison: str
