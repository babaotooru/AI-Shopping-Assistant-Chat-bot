"""
Chat/Query Schema Models
"""
from pydantic import BaseModel
from pydantic import Field
from typing import Optional

class ChatQuery(BaseModel):
    """Chat Query Request"""
    question: str
    context: Optional[str] = None


class ChatAskRequest(BaseModel):
    """Chat message request for per-user conversation."""
    question: str
    user_id: Optional[str] = None
    context: Optional[str] = None


class VisitorSummary(BaseModel):
    """Visitor/user card item for chat sidebar."""
    id: str
    name: str
    email: str = ""
    avatar_url: str = ""
    last_message: str = ""
    last_message_at: str = ""


class ChatMessage(BaseModel):
    """Chat history message."""
    role: str
    content: str
    created_at: str


class CartItem(BaseModel):
    """Shopping cart item summary from product/order dataset."""
    product_id: str = ""
    name: str
    category: str = ""
    price: str = "N/A"
    image_link: str = ""
    quantity: int = 1


class ChatDashboardData(BaseModel):
    """Combined dashboard payload for chat page."""
    current_user_id: str
    selected_user_id: str
    visitors: list[VisitorSummary]
    messages: list[ChatMessage]
    cart_items: list[CartItem]
    suggested_questions: list[str]

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
    compared_products: list[dict] = Field(default_factory=list)
