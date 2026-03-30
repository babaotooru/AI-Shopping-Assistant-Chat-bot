"""
Order Management Routes
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from app.services.order_service import order_service
from app.schemas.order import OrderResponse, OrderListResponse, OrderCreate, OrderUpdate
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("", response_model=OrderListResponse)
async def get_all_orders(
    category: Optional[str] = Query(None, description="Filter by category"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100)
) -> OrderListResponse:
    """
    Get all orders with optional filtering and pagination
    
    Query Parameters:
    - category: Optional category filter
    - skip: Number of records to skip (default: 0)
    - limit: Number of records to return (default: 10, max: 100)
    """
    try:
        orders = order_service.get_all_orders()
        
        if category:
            orders = [o for o in orders if o.get('category', '').lower() == category.lower()]
        
        orders_paginated = orders[skip:skip + limit]
        
        return OrderListResponse(
            total=len(orders),
            orders=orders_paginated
        )
    except Exception as e:
        logger.error(f"Error fetching orders: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching orders")

@router.get("/categories/list")
async def get_categories() -> dict:
    """Get all unique categories"""
    try:
        orders = order_service.get_all_orders()
        categories = list(set(o.get('category', 'Unknown') for o in orders))
        return {"categories": sorted(categories)}
    except Exception as e:
        logger.error(f"Error fetching categories: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching categories")

@router.get("/{product_id}", response_model=OrderResponse)
async def get_order(product_id: str) -> OrderResponse:
    """
    Get specific order by product ID
    
    Path Parameters:
    - product_id: Product ID to fetch
    """
    try:
        order = order_service.get_order_by_id(product_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return order
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching order: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching order")

@router.post("", response_model=dict)
async def create_order(order: OrderCreate) -> dict:
    """
    Create a new order
    
    Body Parameters:
    - order: OrderCreate schema with order details
    """
    try:
        order_dict = order.model_dump()
        if order_service.add_order(order_dict):
            return {"message": "Order created successfully", "order": order_dict}
        else:
            raise HTTPException(status_code=500, detail="Error creating order")
    except Exception as e:
        logger.error(f"Error creating order: {str(e)}")
        raise HTTPException(status_code=500, detail="Error creating order")

@router.put("/{product_id}")
async def update_order(product_id: str, order: OrderUpdate) -> dict:
    """
    Update existing order
    
    Path Parameters:
    - product_id: Product ID to update
    
    Body Parameters:
    - order: OrderUpdate schema with fields to update
    """
    try:
        order_data = {k: v for k, v in order.model_dump().items() if v is not None}
        if order_service.update_order(product_id, order_data):
            return {"message": "Order updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Order not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating order: {str(e)}")
        raise HTTPException(status_code=500, detail="Error updating order")

@router.delete("/{product_id}")
async def delete_order(product_id: str) -> dict:
    """
    Delete order by product ID
    
    Path Parameters:
    - product_id: Product ID to delete
    """
    try:
        if order_service.delete_order(product_id):
            return {"message": "Order deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Order not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting order: {str(e)}")
        raise HTTPException(status_code=500, detail="Error deleting order")

