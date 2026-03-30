"""
Order Service for database operations
"""
from typing import Optional, List
import json
import logging
from pathlib import Path
import os

logger = logging.getLogger(__name__)

class OrderService:
    """Order Service for managing orders"""
    
    def __init__(self):
        """Initialize Order Service"""
        # Resolve orders.json from project root regardless of working directory.
        project_root = Path(__file__).resolve().parents[3]
        self.orders_file = os.getenv("ORDERS_FILE", str(project_root / "orders.json"))
        self.orders_cache = self._load_orders()
    
    def _load_orders(self) -> List[dict]:
        """Load orders from JSON file"""
        try:
            if os.path.exists(self.orders_file):
                with open(self.orders_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return []
        except Exception as e:
            logger.error(f"Error loading orders: {str(e)}")
            return []
    
    def _save_orders(self) -> bool:
        """Save orders to JSON file"""
        try:
            with open(self.orders_file, 'w', encoding='utf-8') as f:
                json.dump(self.orders_cache, f, indent=2)
            return True
        except Exception as e:
            logger.error(f"Error saving orders: {str(e)}")
            return False
    
    def get_all_orders(self) -> List[dict]:
        """Get all orders"""
        return self.orders_cache
    
    def get_orders_as_json_string(self) -> str:
        """Get all orders as JSON string"""
        return json.dumps(self.orders_cache, indent=2)
    
    def get_order_by_id(self, product_id: str) -> Optional[dict]:
        """Get order by product ID"""
        for order in self.orders_cache:
            if order.get('product_id') == product_id:
                return order
        return None
    
    def get_orders_by_category(self, category: str) -> List[dict]:
        """Get orders by category"""
        return [o for o in self.orders_cache if o.get('category', '').lower() == category.lower()]
    
    def add_order(self, order: dict) -> bool:
        """Add new order"""
        try:
            self.orders_cache.append(order)
            return self._save_orders()
        except Exception as e:
            logger.error(f"Error adding order: {str(e)}")
            return False
    
    def update_order(self, product_id: str, order_data: dict) -> bool:
        """Update existing order"""
        try:
            for i, order in enumerate(self.orders_cache):
                if order.get('product_id') == product_id:
                    self.orders_cache[i].update(order_data)
                    return self._save_orders()
            return False
        except Exception as e:
            logger.error(f"Error updating order: {str(e)}")
            return False
    
    def delete_order(self, product_id: str) -> bool:
        """Delete order"""
        try:
            self.orders_cache = [o for o in self.orders_cache if o.get('product_id') != product_id]
            return self._save_orders()
        except Exception as e:
            logger.error(f"Error deleting order: {str(e)}")
            return False

order_service = OrderService()
