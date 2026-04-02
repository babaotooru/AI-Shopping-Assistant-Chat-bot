from fastapi import APIRouter, FastAPI
from pydantic import BaseModel
from functools import lru_cache
from pathlib import Path
import csv
import re

INR_RATE = 83.0

app = FastAPI()
router = APIRouter()


@app.get("/")
def home():
    return {"message": "AI Shopping Assistant Backend Running!"}


@app.get("/health")
def health():
    return {"status": "healthy", "message": "All systems operational"}


def _build_product_id(product: dict) -> str:
    product_id = str(product.get("product_id") or "").strip()
    if product_id:
        return product_id

    product_page_url = str(product.get("product_page_url") or "").strip()
    match = re.search(r"/dp/([A-Z0-9]{8,14})", product_page_url)
    if match:
        return f"AMZ-{match.group(1)}"

    title = str(product.get("name") or product.get("product_title") or "product").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", title).strip("-")
    return f"AMZ-{slug[:18] or 'product'}"


def _normalize_order(product: dict) -> dict:
    product_id = _build_product_id(product)
    return {
        "name": str(product.get("name") or product.get("product_title") or "Unknown Product").strip(),
        "product_id": product_id,
        "category": str(product.get("category") or product.get("product_category") or "N/A").strip(),
        "order_placed_date": product.get("order_placed_date") or product.get("data_collected_at") or "2026-04-01",
        "expected_delivery_date": product.get("expected_delivery_date") or product.get("delivery_date") or product.get("order_placed_date") or "2026-04-01",
        "price": product.get("price") or _to_inr_label(product.get("discounted_price") or product.get("original_price")),
        "rating": float(product.get("rating") or product.get("product_rating") or 0.0),
        "image_link": product.get("image_link", ""),
        "original_price": product.get("original_price") or _to_inr_label(product.get("original_price")),
        "discount_percentage": product.get("discount_percentage", 0.0),
        "total_reviews": product.get("reviews", product.get("total_reviews", 0)),
        "purchased_last_month": product.get("purchased_last_month", 0),
        "is_best_seller": product.get("is_best_seller", "No Badge"),
        "is_sponsored": product.get("is_sponsored", "Organic"),
        "has_coupon": product.get("has_coupon", "No Coupon"),
        "buy_box_availability": product.get("buy_box_availability", "Add to cart"),
        "sustainability_tags": product.get("sustainability_tags", ""),
        "product_page_url": product.get("product_page_url", ""),
    }


class ChatRequest(BaseModel):
    query: str


class CompareRequest(BaseModel):
    product1: str
    product2: str


class RecommendRequest(BaseModel):
    product: str


def _to_float(value: str | None) -> float:
    if value is None:
        return 0.0
    match = re.search(r"\d+(?:\.\d+)?", str(value).replace(",", ""))
    if not match:
        return 0.0
    return float(match.group(0))


def _to_inr_label(value: str | None) -> str:
    usd = _to_float(value)
    if usd <= 0:
        return "N/A"
    return f"INR {usd * INR_RATE:,.0f}"


@lru_cache(maxsize=1)
def _load_products() -> list[dict]:
    project_root = Path(__file__).resolve().parents[1]
    csv_path = project_root / "amazon_products_sales_data_cleaned.csv"
    products: list[dict] = []

    if not csv_path.exists():
        return products

    with open(csv_path, "r", encoding="utf-8", newline="") as file_handle:
        reader = csv.DictReader(file_handle)
        for row in reader:
            product_page_url = row.get("product_page_url", "")
            name = row.get("product_title", "Unknown Product")
            products.append(
                {
                    "name": name,
                    "product_id": _build_product_id({"name": name, "product_page_url": product_page_url}),
                    "category": row.get("product_category", "N/A"),
                    "rating": _to_float(row.get("product_rating")),
                    "reviews": int(_to_float(row.get("total_reviews"))),
                    "purchased_last_month": int(_to_float(row.get("purchased_last_month"))),
                    "price_usd": _to_float(row.get("discounted_price")),
                    "price": _to_inr_label(row.get("discounted_price")),
                    "original_price": _to_inr_label(row.get("original_price")),
                    "discount_percentage": _to_float(row.get("discount_percentage")),
                    "image_link": row.get("product_image_url", ""),
                    "order_placed_date": row.get("data_collected_at", "2026-04-01"),
                    "expected_delivery_date": row.get("delivery_date", row.get("data_collected_at", "2026-04-01")),
                    "is_best_seller": row.get("is_best_seller", "No Badge"),
                    "is_sponsored": row.get("is_sponsored", "Organic"),
                    "has_coupon": row.get("has_coupon", "No Coupon"),
                    "buy_box_availability": row.get("buy_box_availability", "Add to cart"),
                    "sustainability_tags": row.get("sustainability_tags", ""),
                    "product_page_url": product_page_url,
                }
            )

    return products


def _rank_products(query: str, products: list[dict], limit: int = 5) -> list[dict]:
    terms = [term for term in re.split(r"\W+", query.lower()) if term and len(term) > 1]
    ranked: list[tuple[float, dict]] = []

    for product in products:
        name = str(product.get("name", "")).lower()
        category = str(product.get("category", "")).lower()
        score = 0.0

        for term in terms:
            if term in name:
                score += 6
            if term in category:
                score += 3

        score += float(product.get("rating", 0))
        score += min(float(product.get("reviews", 0)) / 100000.0, 5.0)

        if score > 0:
            ranked.append((score, product))

    ranked.sort(key=lambda item: item[0], reverse=True)
    return [product for _, product in ranked[:limit]]


def _build_chat_response(query: str) -> dict:
    products = _load_products()
    ranked = _rank_products(query, products, limit=3)

    if not ranked:
        return {
            "user_query": query,
            "response": "No matching products found in catalog. Try a category or product keyword.",
            "matches": [],
        }

    lines = []
    for item in ranked:
        lines.append(f"{item['name']} | {item['category']} | Rating {item['rating']} | {item['price']}")

    return {
        "user_query": query,
        "response": "Top matches from your product sales data:",
        "matches": lines,
    }


def _build_recommend_response(product_name: str) -> dict:
    products = _load_products()
    ranked = _rank_products(product_name, products, limit=6)

    if not ranked:
        return {
            "product": product_name,
            "recommendation": "No recommendations found.",
            "items": [],
        }

    searched = ranked[0]
    recs = ranked[1:6]

    return {
        "product": product_name,
        "recommendation": f"Best match: {searched['name']}",
        "searched_product": searched,
        "items": recs,
    }


def _build_compare_response(product1: str, product2: str) -> dict:
    products = _load_products()
    first_list = _rank_products(product1, products, limit=1)
    second_list = _rank_products(product2, products, limit=1)

    if not first_list or not second_list:
        return {
            "product1": product1,
            "product2": product2,
            "result": "One or both products were not found.",
            "winner_rating": "N/A",
            "winner_price": "N/A",
        }

    first = first_list[0]
    second = second_list[0]

    winner_rating = first["name"] if first["rating"] > second["rating"] else second["name"]
    if first["rating"] == second["rating"]:
        winner_rating = "Tie"

    first_price = float(first.get("price_usd", 0))
    second_price = float(second.get("price_usd", 0))
    winner_price = first["name"] if first_price < second_price else second["name"]
    if first_price == second_price:
        winner_price = "Tie"

    return {
        "product1": product1,
        "product2": product2,
        "result": "Comparison generated from sales dataset.",
        "winner_rating": winner_rating,
        "winner_price": winner_price,
        "details": {
            "product1": first,
            "product2": second,
        },
    }


def _build_orders_response(category: str | None = None, skip: int = 0, limit: int = 100) -> dict:
    products = _load_products()
    if category:
        filtered = [product for product in products if str(product.get("category", "")).lower() == category.lower()]
    else:
        filtered = products

    orders = [_normalize_order(product) for product in filtered[skip: skip + limit]]
    return {
        "total": len(filtered),
        "orders": orders,
    }


def _build_order_by_id(product_id: str) -> dict | None:
    for product in _load_products():
        if product.get("product_id") == product_id:
            return _normalize_order(product)
    return None


def _build_categories() -> dict:
    products = _load_products()
    categories = sorted({str(product.get("category", "")).strip() for product in products if product.get("category")})
    return {"categories": categories}


def _build_suggestions(query: str = "", limit: int = 8) -> dict:
    products = _load_products()
    if query.strip():
        ranked = _rank_products(query, products, limit=limit)
    else:
        ranked = sorted(products, key=lambda product: (float(product.get("rating", 0)), float(product.get("reviews", 0))), reverse=True)[:limit]

    suggestions = []
    for product in ranked:
        suggestions.append(
            {
                "product_id": product.get("product_id"),
                "name": product.get("name"),
                "category": product.get("category"),
                "price": product.get("price"),
                "rating": product.get("rating"),
                "total_reviews": product.get("reviews"),
            }
        )

    return {
        "query": query,
        "total_products": len(products),
        "matched_products": len(ranked),
        "suggestions": suggestions,
    }


def _register_routes(prefix: str) -> None:
    @router.get(f"{prefix}/health")
    def prefixed_health():
        return {"status": "healthy", "message": "All systems operational"}

    @router.get(f"{prefix}/orders")
    def get_all_orders(category: str | None = None, skip: int = 0, limit: int = 100):
        return _build_orders_response(category=category, skip=skip, limit=limit)

    @router.get(f"{prefix}/orders/categories/list")
    def get_categories():
        return _build_categories()

    @router.get(f"{prefix}/orders/search/suggestions")
    def get_product_suggestions(q: str = "", limit: int = 8):
        return _build_suggestions(query=q, limit=limit)

    @router.get(f"{prefix}/orders/{{product_id}}")
    def get_order(product_id: str):
        order = _build_order_by_id(product_id)
        if not order:
            return {"detail": "Order not found"}
        return order

    @router.post(f"{prefix}/chat")
    def chat(req: ChatRequest):
        return _build_chat_response(req.query)

    @router.post(f"{prefix}/chat/query")
    def chat_query(req: ChatRequest):
        return _build_chat_response(req.query)

    @router.post(f"{prefix}/recommend")
    def recommend(req: RecommendRequest):
        return _build_recommend_response(req.product)

    @router.post(f"{prefix}/chat/recommend")
    def chat_recommend(req: RecommendRequest):
        return _build_recommend_response(req.product)

    @router.post(f"{prefix}/compare")
    def compare(req: CompareRequest):
        return _build_compare_response(req.product1, req.product2)

    @router.post(f"{prefix}/chat/compare")
    def chat_compare(req: CompareRequest):
        return _build_compare_response(req.product1, req.product2)

    @router.post(f"{prefix}/chat/process-orders")
    def process_orders():
        return {
            "status": "success",
            "message": "Orders processed successfully",
            "orders_count": len(_load_products()),
        }


_register_routes("")
_register_routes("/api")
_register_routes("/v1")
_register_routes("/api/v1")

app.include_router(router)
