from fastapi import FastAPI
from pydantic import BaseModel
from functools import lru_cache
from pathlib import Path
import csv
import re

INR_RATE = 83.0

app = FastAPI()


@app.get("/")
def home():
	return {"message": "AI Shopping Assistant Backend Running!"}


@app.get("/health")
def health():
	return {"status": "ok"}


# ---------------------------
# Request Models
# ---------------------------
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

	with open(csv_path, "r", encoding="utf-8", newline="") as f:
		reader = csv.DictReader(f)
		for row in reader:
			products.append(
				{
					"name": row.get("product_title", "Unknown Product"),
					"category": row.get("product_category", "N/A"),
					"rating": _to_float(row.get("product_rating")),
					"reviews": int(_to_float(row.get("total_reviews"))),
					"purchased_last_month": int(_to_float(row.get("purchased_last_month"))),
					"price_usd": _to_float(row.get("discounted_price")),
					"price": _to_inr_label(row.get("discounted_price")),
					"original_price": _to_inr_label(row.get("original_price")),
					"discount_percentage": _to_float(row.get("discount_percentage")),
					"product_page_url": row.get("product_page_url", ""),
				}
			)

	return products


def _rank_products(query: str, products: list[dict], limit: int = 5) -> list[dict]:
	terms = [t for t in re.split(r"\W+", query.lower()) if t and len(t) > 1]

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

	ranked.sort(key=lambda x: x[0], reverse=True)
	return [p for _, p in ranked[:limit]]


# ---------------------------
# Chatbot API
# ---------------------------
@app.post("/chat")
def chat(req: ChatRequest):
	products = _load_products()
	ranked = _rank_products(req.query, products, limit=3)

	if not ranked:
		return {
			"user_query": req.query,
			"response": "No matching products found in catalog. Try a category or product keyword.",
			"matches": [],
		}

	lines = []
	for item in ranked:
		lines.append(
			f"{item['name']} | {item['category']} | Rating {item['rating']} | {item['price']}"
		)

	return {
		"user_query": req.query,
		"response": "Top matches from your product sales data:",
		"matches": lines,
	}


# ---------------------------
# Recommendation API
# ---------------------------
@app.post("/recommend")
def recommend(req: RecommendRequest):
	products = _load_products()
	ranked = _rank_products(req.product, products, limit=6)

	if not ranked:
		return {
			"product": req.product,
			"recommendation": "No recommendations found.",
			"items": [],
		}

	searched = ranked[0]
	recs = ranked[1:6]

	return {
		"product": req.product,
		"recommendation": f"Best match: {searched['name']}",
		"searched_product": searched,
		"items": recs,
	}


# ---------------------------
# Comparison API
# ---------------------------
@app.post("/compare")
def compare(req: CompareRequest):
	products = _load_products()
	first_list = _rank_products(req.product1, products, limit=1)
	second_list = _rank_products(req.product2, products, limit=1)

	if not first_list or not second_list:
		return {
			"product1": req.product1,
			"product2": req.product2,
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
		"product1": req.product1,
		"product2": req.product2,
		"result": "Comparison generated from sales dataset.",
		"winner_rating": winner_rating,
		"winner_price": winner_price,
		"details": {
			"product1": first,
			"product2": second,
		},
	}
