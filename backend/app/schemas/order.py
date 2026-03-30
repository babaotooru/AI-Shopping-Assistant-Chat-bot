"""
Order Schema Models
"""
from pydantic import BaseModel
from typing import Optional

class OrderBase(BaseModel):
    """Base Order Schema"""
    name: str
    product_id: str
    category: str
    order_placed_date: str
    expected_delivery_date: str
    price: str
    rating: float
    image_link: Optional[str] = None

class OrderCreate(OrderBase):
    """Order Creation Schema"""
    pass

class OrderUpdate(BaseModel):
    """Order Update Schema"""
    name: Optional[str] = None
    category: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    price: Optional[str] = None
    rating: Optional[float] = None
    image_link: Optional[str] = None

class OrderResponse(OrderBase):
    """Order Response Schema"""
    id: Optional[int] = None
    user_id: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    class Config:
        from_attributes = True

class OrderListResponse(BaseModel):
    """Order List Response"""
    total: int
    orders: list[OrderResponse]
