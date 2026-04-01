"""Order Service for ecommerce data operations."""

from typing import Optional, List
import csv
import json
import logging
from pathlib import Path
import os
import re
import requests

from config import settings

logger = logging.getLogger(__name__)

class OrderService:
    """Order Service for managing orders"""
    
    def __init__(self):
        """Initialize Order Service"""
        # Resolve data files from project root regardless of working directory.
        project_root = Path(__file__).resolve().parents[3]
        self.orders_file = os.getenv("ORDERS_FILE", str(project_root / "orders.json"))
        self.orders_csv_file = os.getenv("ORDERS_CSV_FILE", str(project_root / "orders.csv"))
        self.categories_csv_file = os.getenv("CATEGORIES_CSV_FILE", str(project_root / "amazon_categories.csv"))

        self.supabase_url = settings.SUPABASE_URL.strip()
        self.supabase_key = settings.SUPABASE_KEY.strip() or settings.SUPABASE_ANON_KEY.strip()
        self.supabase_table = settings.SUPABASE_TABLE
        self.use_supabase = bool(settings.USE_SUPABASE and self.supabase_url and self.supabase_key)

        if self.use_supabase:
            logger.info("OrderService: Supabase mode enabled")
        else:
            logger.info("OrderService: Using local CSV/JSON orders files")

        self.orders_cache = self._load_orders()

    def _supabase_headers(self, write: bool = False) -> dict:
        """Build headers for Supabase REST API calls."""
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
        }
        if write:
            headers["Content-Type"] = "application/json"
            headers["Prefer"] = "return=representation"
        return headers

    def _supabase_endpoint(self) -> str:
        """Get Supabase REST endpoint for orders table."""
        return f"{self.supabase_url}/rest/v1/{self.supabase_table}"

    def _normalize_order(self, order: dict) -> dict:
        """Normalize order shape from CSV/JSON/Supabase sources."""
        normalized = {}
        for key, value in dict(order).items():
            clean_key = str(key).replace("\ufeff", "").strip().strip('"').strip("'")
            normalized[clean_key] = value

        # Map alternative data source keys to the API schema keys.
        normalized["name"] = str(
            normalized.get("name")
            or normalized.get("product_title")
            or normalized.get("title")
            or ""
        ).strip()

        normalized["category"] = str(
            normalized.get("category")
            or normalized.get("product_category")
            or "Other Electronics"
        ).strip()

        normalized["image_link"] = str(
            normalized.get("image_link")
            or normalized.get("product_image_url")
            or normalized.get("image_url")
            or ""
        ).strip()

        product_page_url = str(
            normalized.get("product_page_url")
            or normalized.get("product_url")
            or ""
        ).strip()
        if product_page_url and product_page_url.startswith("/"):
            product_page_url = f"https://www.amazon.com{product_page_url}"
        normalized["product_page_url"] = product_page_url

        product_id = str(normalized.get("product_id") or "").strip()
        if not product_id:
            match = re.search(r"/dp/([A-Z0-9]{8,14})", product_page_url)
            if match:
                product_id = f"AMZ-{match.group(1)}"
            else:
                slug = re.sub(r"[^a-z0-9]+", "-", normalized["name"].lower()).strip("-")
                product_id = f"AMZ-{slug[:18]}"
        normalized["product_id"] = product_id

        price_value = (
            normalized.get("price")
            or normalized.get("discounted_price")
            or normalized.get("current/discounted_price")
            or normalized.get("original_price")
            or normalized.get("listed_price")
            or normalized.get("price_on_variant")
            or "N/A"
        )
        normalized["price"] = f"${price_value}" if self._is_number(price_value) else str(price_value)

        order_date = self._to_date_str(
            normalized.get("order_placed_date")
            or normalized.get("data_collected_at")
            or normalized.get("collected_at")
        )
        delivery_date = self._to_date_str(
            normalized.get("expected_delivery_date")
            or normalized.get("delivery_date")
            or normalized.get("delivery_details")
        )
        normalized["order_placed_date"] = order_date or "2026-03-30"
        normalized["expected_delivery_date"] = delivery_date or normalized["order_placed_date"]

        rating = normalized.get("rating")
        if rating in (None, ""):
            rating = normalized.get("product_rating")
        try:
            if rating is not None and rating != "":
                rating_match = re.search(r"\d+(?:\.\d+)?", str(rating))
                normalized["rating"] = float(rating_match.group(0)) if rating_match else 0.0
            else:
                normalized["rating"] = 0.0
        except (TypeError, ValueError):
            normalized["rating"] = 0.0

        normalized["discount_percentage"] = self._to_optional_float(
            normalized.get("discount_percentage")
        )
        normalized["total_reviews"] = self._to_optional_float(
            normalized.get("total_reviews") or normalized.get("number_of_reviews")
        )
        normalized["purchased_last_month"] = self._to_optional_float(
            normalized.get("purchased_last_month") or normalized.get("bought_in_last_month")
        )
        return normalized

    def _is_number(self, value: object) -> bool:
        """Return True when value can be represented as a numeric value."""
        try:
            float(str(value).replace(",", "").strip())
            return True
        except (TypeError, ValueError):
            return False

    def _to_optional_float(self, value: object) -> Optional[float]:
        """Convert mixed numeric text values to float, otherwise return None."""
        if value is None:
            return None

        text = str(value).strip()
        if not text:
            return None

        match = re.search(r"\d+(?:\.\d+)?", text.replace(",", ""))
        if not match:
            return None

        try:
            return float(match.group(0))
        except (TypeError, ValueError):
            return None

    def _to_date_str(self, value: object) -> str:
        """Convert known date formats to yyyy-mm-dd."""
        if value is None:
            return ""

        text = str(value).strip()
        if not text:
            return ""

        match = re.search(r"\d{4}-\d{2}-\d{2}", text)
        if match:
            return match.group(0)
        return text

    def _load_orders_from_csv(self) -> Optional[List[dict]]:
        """Load orders from CSV file. Returns None when file does not exist."""
        if not os.path.exists(self.orders_csv_file):
            return None

        try:
            with open(self.orders_csv_file, "r", encoding="utf-8", newline="") as f:
                reader = csv.DictReader(f)
                return [self._normalize_order(row) for row in reader]
        except Exception as e:
            logger.error(f"Error loading orders CSV: {str(e)}")
            return []

    def _save_orders_csv(self) -> bool:
        """Save in-memory orders to CSV file."""
        try:
            if not self.orders_cache:
                return True

            base_fieldnames = [
                "name",
                "product_id",
                "category",
                "order_placed_date",
                "expected_delivery_date",
                "price",
                "rating",
                "image_link",
            ]
            extra_fieldnames = []
            for order in self.orders_cache:
                for key in order.keys():
                    if key not in base_fieldnames and key not in extra_fieldnames:
                        extra_fieldnames.append(key)
            fieldnames = base_fieldnames + extra_fieldnames

            with open(self.orders_csv_file, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for order in self.orders_cache:
                    row = {k: order.get(k, "") for k in fieldnames}
                    writer.writerow(row)
            return True
        except Exception as e:
            logger.error(f"Error saving orders CSV: {str(e)}")
            return False

    def _load_orders_from_supabase(self) -> Optional[List[dict]]:
        """Load orders from Supabase. Returns None on failure."""
        if not self.use_supabase:
            return None

        try:
            response = requests.get(
                self._supabase_endpoint(),
                headers=self._supabase_headers(),
                params={"select": "*"},
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, list):
                return [self._normalize_order(item) for item in data]
            return []
        except Exception as e:
            logger.warning(f"Supabase read failed, falling back to local CSV/JSON: {str(e)}")
            return None
    
    def _load_orders(self) -> List[dict]:
        """Load orders with priority: Supabase -> CSV -> JSON."""
        remote_orders = self._load_orders_from_supabase()
        if remote_orders is not None:
            return remote_orders

        csv_orders = self._load_orders_from_csv()
        if csv_orders is not None:
            return csv_orders

        try:
            if os.path.exists(self.orders_file):
                with open(self.orders_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        return [self._normalize_order(item) for item in data]
            return []
        except Exception as e:
            logger.error(f"Error loading orders: {str(e)}")
            return []
    
    def _save_orders(self) -> bool:
        """Save orders to CSV and JSON files."""
        try:
            self._save_orders_csv()
            with open(self.orders_file, 'w', encoding='utf-8') as f:
                json.dump(self.orders_cache, f, indent=2)
            return True
        except Exception as e:
            logger.error(f"Error saving orders: {str(e)}")
            return False
    
    def get_all_orders(self) -> List[dict]:
        """Get all orders"""
        if self.use_supabase:
            remote_orders = self._load_orders_from_supabase()
            if remote_orders is not None:
                self.orders_cache = remote_orders
                return self.orders_cache

        # Keep local cache fresh when using file-based mode.
        self.orders_cache = self._load_orders()
        return self.orders_cache
    
    def get_orders_as_json_string(self) -> str:
        """Get all orders as JSON string"""
        return json.dumps(self.orders_cache, indent=2)
    
    def get_order_by_id(self, product_id: str) -> Optional[dict]:
        """Get order by product ID"""
        self.get_all_orders()
        for order in self.orders_cache:
            if order.get('product_id') == product_id:
                return order
        return None
    
    def get_orders_by_category(self, category: str) -> List[dict]:
        """Get orders by category"""
        self.get_all_orders()
        return [o for o in self.orders_cache if o.get('category', '').lower() == category.lower()]

    def get_category_catalog(self) -> List[str]:
        """Load ecommerce categories from categories CSV if available."""
        if os.path.exists(self.categories_csv_file):
            try:
                with open(self.categories_csv_file, "r", encoding="utf-8", newline="") as f:
                    reader = csv.DictReader(f)
                    categories = [row.get("category_name", "").strip() for row in reader]
                    categories = [c for c in categories if c]
                    if categories:
                        return sorted(set(categories))
            except Exception as e:
                logger.warning(f"Error reading categories CSV: {str(e)}")

        orders = self.get_all_orders()
        return sorted(set(o.get('category', 'Unknown') for o in orders if o.get('category')))
    
    def add_order(self, order: dict) -> bool:
        """Add new order"""
        try:
            if self.use_supabase:
                response = requests.post(
                    self._supabase_endpoint(),
                    headers=self._supabase_headers(write=True),
                    json=order,
                    timeout=10,
                )
                response.raise_for_status()
                self.orders_cache = self._load_orders()
                return True

            self.orders_cache.append(self._normalize_order(order))
            return self._save_orders()
        except Exception as e:
            logger.error(f"Error adding order: {str(e)}")
            return False
    
    def update_order(self, product_id: str, order_data: dict) -> bool:
        """Update existing order"""
        try:
            if self.use_supabase:
                response = requests.patch(
                    self._supabase_endpoint(),
                    headers=self._supabase_headers(write=True),
                    params={"product_id": f"eq.{product_id}"},
                    json=order_data,
                    timeout=10,
                )
                response.raise_for_status()
                self.orders_cache = self._load_orders()
                return True

            for i, order in enumerate(self.orders_cache):
                if order.get('product_id') == product_id:
                    self.orders_cache[i].update(order_data)
                    self.orders_cache[i] = self._normalize_order(self.orders_cache[i])
                    return self._save_orders()
            return False
        except Exception as e:
            logger.error(f"Error updating order: {str(e)}")
            return False
    
    def delete_order(self, product_id: str) -> bool:
        """Delete order"""
        try:
            if self.use_supabase:
                response = requests.delete(
                    self._supabase_endpoint(),
                    headers=self._supabase_headers(write=True),
                    params={"product_id": f"eq.{product_id}"},
                    timeout=10,
                )
                response.raise_for_status()
                self.orders_cache = self._load_orders()
                return True

            self.orders_cache = [o for o in self.orders_cache if o.get('product_id') != product_id]
            return self._save_orders()
        except Exception as e:
            logger.error(f"Error deleting order: {str(e)}")
            return False

order_service = OrderService()
