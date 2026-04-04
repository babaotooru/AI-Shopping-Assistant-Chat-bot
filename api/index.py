from fastapi import APIRouter, FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from functools import lru_cache
from pathlib import Path
from datetime import datetime, timedelta, timezone
import csv
import os
import re
import uuid
import jwt
import requests
import bcrypt

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
    query: Optional[str] = None
    question: Optional[str] = None

    def get_query(self) -> str:
        return (self.query or self.question or "").strip()


class CompareRequest(BaseModel):
    product1: Optional[str] = None
    product2: Optional[str] = None

    def get_product1(self) -> str:
        return (self.product1 or "").strip()

    def get_product2(self) -> str:
        return (self.product2 or "").strip()


class RecommendRequest(BaseModel):
    product: Optional[str] = None
    product_name: Optional[str] = None

    def get_product(self) -> str:
        return (self.product or self.product_name or "").strip()


class SessionSyncRequest(BaseModel):
    access_token: str


class ResolveIdentifierRequest(BaseModel):
    identifier: str


class EmailSignupRequest(BaseModel):
    email: str
    password: str
    username: str


class EmailLoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    bio: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    preferred_category: Optional[str] = None
    notification_email: Optional[bool] = None
    notification_sms: Optional[bool] = None


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


def _jwt_secret() -> str:
    return os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")


def _jwt_algorithm() -> str:
    return os.getenv("JWT_ALGORITHM", "HS256")


def _create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRY_MINUTES", "120")))
    return jwt.encode(payload, _jwt_secret(), algorithm=_jwt_algorithm())


def _decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=[_jwt_algorithm()])
    except Exception:
        return None


def _sync_profile_best_effort(user_payload: dict) -> None:
    supabase_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    profile_table = os.getenv("SUPABASE_PROFILE_TABLE", "profiles")
    audit_table = os.getenv("SUPABASE_LOGIN_AUDIT_TABLE", "login_audit")

    if not supabase_url or not service_key:
        return

    metadata = user_payload.get("user_metadata") or {}
    email = user_payload.get("email") or ""
    username = (
        metadata.get("preferred_username")
        or metadata.get("user_name")
        or metadata.get("username")
        or str(email).split("@", 1)[0]
    )
    profile_row = {
        "id": user_payload.get("id"),
        "email": email,
        "username": username,
        "full_name": metadata.get("full_name") or metadata.get("name") or "",
        "avatar_url": metadata.get("avatar_url") or metadata.get("picture") or "",
        "phone": user_payload.get("phone") or "",
        "email_confirmed_at": user_payload.get("email_confirmed_at"),
        "last_sign_in_at": user_payload.get("last_sign_in_at"),
        "auth_provider": (user_payload.get("app_metadata") or {}).get("provider") or "google",
        "user_metadata": metadata,
        "app_metadata": user_payload.get("app_metadata") or {},
        "provider": "google",
        "last_login_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }

    try:
        requests.post(
            f"{supabase_url}/rest/v1/{profile_table}",
            headers={**headers, "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=profile_row,
            timeout=10,
        )
    except Exception:
        pass


def _resolve_email_for_identifier(identifier: str) -> Optional[str]:
    value = (identifier or "").strip()
    if not value:
        return None

    if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value):
        return value

    supabase_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    profile_table = os.getenv("SUPABASE_PROFILE_TABLE", "profiles")
    if not supabase_url or not service_key:
        return None

    try:
        response = requests.get(
            f"{supabase_url}/rest/v1/{profile_table}",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
            },
            params={
                "select": "email,username,full_name",
                "or": f"username.eq.{value},full_name.eq.{value}",
                "limit": 1,
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list) and data and data[0].get("email"):
            return str(data[0]["email"])
        return None
    except Exception:
        return None


def _fetch_local_profile_by_id(profile_id: str) -> Optional[dict]:
    supabase_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    profile_table = os.getenv("SUPABASE_PROFILE_TABLE", "profiles")
    if not supabase_url or not service_key:
        return None

    try:
        response = requests.get(
            f"{supabase_url}/rest/v1/{profile_table}",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
            },
            params={"select": "*", "id": f"eq.{profile_id}", "limit": 1},
            timeout=10,
        )
        if response.status_code >= 400:
            return None
        data = response.json()
        if isinstance(data, list) and data:
            return data[0]
    except Exception:
        return None
    return None


def _sanitize_profile_updates(updates: dict) -> dict:
    allowed_fields = {
        "full_name",
        "username",
        "email",
        "avatar_url",
        "phone",
        "date_of_birth",
        "bio",
        "address_line_1",
        "address_line_2",
        "city",
        "state",
        "postal_code",
        "country",
        "preferred_category",
        "notification_email",
        "notification_sms",
    }
    return {key: value for key, value in updates.items() if key in allowed_fields and value is not None}


def _update_profile_for_user(profile_id: str, updates: dict) -> dict:
    supabase_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    profile_table = os.getenv("SUPABASE_PROFILE_TABLE", "profiles")
    if not supabase_url or not service_key:
        raise HTTPException(status_code=500, detail="Supabase service-role key is missing")

    existing = _fetch_local_profile_by_id(profile_id) or {"id": profile_id}
    sanitized = _sanitize_profile_updates(updates)
    now = datetime.now(timezone.utc).isoformat()
    merged = {
        **existing,
        **sanitized,
        "id": profile_id,
        "email": sanitized.get("email") or existing.get("email") or "",
        "username": sanitized.get("username") or existing.get("username") or "",
        "full_name": sanitized.get("full_name") or existing.get("full_name") or "",
        "avatar_url": sanitized.get("avatar_url") or existing.get("avatar_url") or "",
        "phone": sanitized.get("phone") or existing.get("phone") or "",
        "date_of_birth": sanitized.get("date_of_birth") or existing.get("date_of_birth") or "",
        "bio": sanitized.get("bio") or existing.get("bio") or "",
        "address_line_1": sanitized.get("address_line_1") or existing.get("address_line_1") or "",
        "address_line_2": sanitized.get("address_line_2") or existing.get("address_line_2") or "",
        "city": sanitized.get("city") or existing.get("city") or "",
        "state": sanitized.get("state") or existing.get("state") or "",
        "postal_code": sanitized.get("postal_code") or existing.get("postal_code") or "",
        "country": sanitized.get("country") or existing.get("country") or "",
        "preferred_category": sanitized.get("preferred_category") or existing.get("preferred_category") or "",
        "notification_email": sanitized.get("notification_email") if "notification_email" in sanitized else existing.get("notification_email", True),
        "notification_sms": sanitized.get("notification_sms") if "notification_sms" in sanitized else existing.get("notification_sms", False),
        "updated_at": now,
        "last_login_at": existing.get("last_login_at") or now,
    }

    response = requests.post(
        f"{supabase_url}/rest/v1/{profile_table}",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
        },
        json=merged,
        timeout=15,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=f"Profile update failed: {response.text}")

    data = response.json()
    return data[0] if isinstance(data, list) and data else merged


def _fetch_local_profile_by_email(email: str) -> Optional[dict]:
    supabase_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    profile_table = os.getenv("SUPABASE_PROFILE_TABLE", "profiles")
    if not supabase_url or not service_key:
        return None

    try:
        response = requests.get(
            f"{supabase_url}/rest/v1/{profile_table}",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
            },
            params={"select": "*", "email": f"eq.{email.strip().lower()}", "limit": 1},
            timeout=10,
        )
        if response.status_code >= 400:
            return None
        data = response.json()
        if isinstance(data, list) and data:
            return data[0]
    except Exception:
        return None
    return None


def _record_local_login_event(profile: dict) -> None:
    supabase_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    audit_table = os.getenv("SUPABASE_LOGIN_AUDIT_TABLE", "login_audit")
    if not supabase_url or not service_key:
        return

    try:
        requests.post(
            f"{supabase_url}/rest/v1/{audit_table}",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={
                "user_id": profile.get("id"),
                "email": profile.get("email"),
                "provider": profile.get("auth_provider") or "email",
                "full_name": profile.get("full_name") or "",
                "username": profile.get("username") or "",
                "avatar_url": profile.get("avatar_url") or "",
                "phone": profile.get("phone") or "",
                "email_confirmed_at": profile.get("email_confirmed_at"),
                "last_sign_in_at": profile.get("last_sign_in_at"),
                "auth_provider": profile.get("auth_provider") or "email",
                "user_metadata": profile.get("user_metadata") or {},
                "app_metadata": profile.get("app_metadata") or {},
                "raw_login_payload": profile,
                "logged_in_at": datetime.now(timezone.utc).isoformat(),
            },
            timeout=10,
        )
    except Exception:
        pass


def _create_local_email_account(email: str, password: str, username: str) -> dict:
    supabase_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    profile_table = os.getenv("SUPABASE_PROFILE_TABLE", "profiles")
    if not supabase_url or not service_key:
        raise HTTPException(status_code=500, detail="Supabase service-role key is missing")

    normalized_email = email.strip().lower()
    if _fetch_local_profile_by_email(normalized_email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    now = datetime.now(timezone.utc).isoformat()
    profile_row = {
        "id": str(uuid.uuid4()),
        "email": normalized_email,
        "username": username.strip(),
        "full_name": username.strip(),
        "avatar_url": "",
        "phone": "",
        "email_confirmed_at": now,
        "last_sign_in_at": now,
        "auth_provider": "email",
        "user_metadata": {"username": username.strip(), "full_name": username.strip()},
        "app_metadata": {"provider": "email"},
        "identities": [],
        "raw_user_payload": {"email": normalized_email, "username": username.strip(), "provider": "email"},
        "provider": "email",
        "password_hash": bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
        "updated_at": now,
        "last_login_at": now,
    }

    response = requests.post(
        f"{supabase_url}/rest/v1/{profile_table}",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        json=profile_row,
        timeout=15,
    )
    if response.status_code >= 400:
        response_text = response.text or ""
        if "profiles_id_fkey" in response_text or '"code":"23503"' in response_text:
            raise HTTPException(
                status_code=400,
                detail="Profiles table still has profiles_id_fkey. Run SUPABASE_AUTH_SETUP.sql to drop that constraint.",
            )
        raise HTTPException(status_code=response.status_code, detail=f"Profile create failed: {response.text}")

    data = response.json()
    profile = data[0] if isinstance(data, list) and data else profile_row
    _record_local_login_event(profile)
    return profile


def _authenticate_local_email_account(email: str, password: str) -> dict:
    profile = _fetch_local_profile_by_email(email)
    if not profile:
        raise HTTPException(status_code=404, detail="Account not found")

    password_hash = profile.get("password_hash")
    if not password_hash:
        raise HTTPException(status_code=400, detail="This account does not use email/password login")

    if not bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    supabase_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    profile_table = os.getenv("SUPABASE_PROFILE_TABLE", "profiles")
    now = datetime.now(timezone.utc).isoformat()
    if supabase_url and service_key:
        try:
            requests.patch(
                f"{supabase_url}/rest/v1/{profile_table}",
                headers={
                    "apikey": service_key,
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                params={"id": f"eq.{profile['id']}"},
                json={"last_sign_in_at": now, "last_login_at": now},
                timeout=10,
            )
        except Exception:
            pass

    profile["last_sign_in_at"] = now
    profile["last_login_at"] = now
    _record_local_login_event(profile)
    return profile

    try:
        requests.post(
            f"{supabase_url}/rest/v1/{audit_table}",
            headers={**headers, "Prefer": "return=minimal"},
            json={
                "user_id": user_payload.get("id"),
                "email": user_payload.get("email"),
                "provider": "google",
                "logged_in_at": datetime.now(timezone.utc).isoformat(),
            },
            timeout=10,
        )
    except Exception:
        pass


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
            "question": query,
            "user_query": query,
            "answer": "No matching products found in catalog. Try a category or product keyword.",
            "response": "No matching products found in catalog. Try a category or product keyword.",
            "matches": [],
            "confidence": 0.8,
        }

    lines = []
    for item in ranked:
        lines.append(f"{item['name']} | {item['category']} | Rating {item['rating']} | {item['price']}")

    return {
        "question": query,
        "user_query": query,
        "answer": "Top matches from your product sales data:\n" + "\n".join(lines),
        "response": "Top matches from your product sales data:",
        "matches": lines,
        "confidence": 0.85,
    }


def _build_recommend_response(product_name: str) -> dict:
    normalized_name = (product_name or "").strip()
    if not normalized_name:
        return {
            "product_name": "",
            "product": "",
            "recommendations": [],
            "items": [],
            "recommendation": "No recommendations found.",
        }

    products = _load_products()
    ranked = _rank_products(normalized_name, products, limit=6)

    if not ranked:
        return {
            "product_name": normalized_name,
            "product": normalized_name,
            "recommendation": "No recommendations found.",
            "recommendations": [],
            "items": [],
        }

    searched = ranked[0]
    searched_entry = {
        **searched,
        "details": {
            "reviews": searched.get("reviews"),
            "discount_percentage": searched.get("discount_percentage"),
            "purchased_last_month": searched.get("purchased_last_month"),
        },
        "match_type": "exact",
    }

    recs = []
    for item in ranked[1:6]:
        recs.append(
            {
                **item,
                "details": {
                    "reviews": item.get("reviews"),
                    "discount_percentage": item.get("discount_percentage"),
                    "purchased_last_month": item.get("purchased_last_month"),
                },
            }
        )

    recommendations_payload = [{"searched_product": searched_entry}, *recs]

    return {
        "product_name": normalized_name,
        "product": normalized_name,
        "recommendation": f"Best match: {searched['name']}",
        "recommendations": recommendations_payload,
        "searched_product": searched_entry,
        "items": recs,
    }


def _build_compare_response(product1: str, product2: str) -> dict:
    left_query = (product1 or "").strip()
    right_query = (product2 or "").strip()
    if not left_query or not right_query:
        return {
            "product1": left_query,
            "product2": right_query,
            "comparison": "Both products are required.",
            "compared_products": [],
            "result": "One or both products were not found.",
            "winner_rating": "N/A",
            "winner_price": "N/A",
        }

    products = _load_products()
    first_list = _rank_products(left_query, products, limit=1)
    second_list = _rank_products(right_query, products, limit=1)

    if not first_list or not second_list:
        return {
            "product1": left_query,
            "product2": right_query,
            "comparison": "One or both products were not found.",
            "compared_products": [],
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

    first_reviews = int(first.get("reviews", 0) or 0)
    second_reviews = int(second.get("reviews", 0) or 0)
    review_winner = first["name"] if first_reviews > second_reviews else second["name"]
    if first_reviews == second_reviews:
        review_winner = "Tie"

    first_discount = float(first.get("discount_percentage", 0) or 0)
    second_discount = float(second.get("discount_percentage", 0) or 0)
    discount_winner = first["name"] if first_discount > second_discount else second["name"]
    if first_discount == second_discount:
        discount_winner = "Tie"

    value_score_first = (float(first.get("rating", 0) or 0) * 20.0) - (first_price / 10.0)
    value_score_second = (float(second.get("rating", 0) or 0) * 20.0) - (second_price / 10.0)
    value_winner = first["name"] if value_score_first > value_score_second else second["name"]
    if abs(value_score_first - value_score_second) < 0.001:
        value_winner = "Tie"

    comparison_text = "\n".join(
        [
            f"Compared Product A: {first['name']}",
            f"Compared Product B: {second['name']}",
            "",
            f"Price (INR): {first.get('price', 'N/A')} vs {second.get('price', 'N/A')}",
            f"Rating: {first.get('rating', 0)} vs {second.get('rating', 0)}",
            f"Reviews: {first_reviews:,} vs {second_reviews:,}",
            f"Discount: {first_discount:.2f}% vs {second_discount:.2f}%",
            f"Purchased Last Month: {int(first.get('purchased_last_month', 0) or 0):,} vs {int(second.get('purchased_last_month', 0) or 0):,}",
            "",
            f"Winner by Rating: {winner_rating}",
            f"Winner by Price: {winner_price}",
            f"Winner by Reviews: {review_winner}",
            f"Winner by Discount: {discount_winner}",
            f"Best Overall Value: {value_winner}",
        ]
    )

    compared_products = [
        {
            **first,
            "match_type": "exact",
            "details": {
                "reviews": first.get("reviews"),
                "discount_percentage": first.get("discount_percentage"),
                "purchased_last_month": first.get("purchased_last_month"),
                "is_best_seller": first.get("is_best_seller"),
                "is_sponsored": first.get("is_sponsored"),
                "has_coupon": first.get("has_coupon"),
                "buy_box_availability": first.get("buy_box_availability"),
                "sustainability_tags": first.get("sustainability_tags"),
                "expected_delivery_date": first.get("expected_delivery_date"),
                "order_placed_date": first.get("order_placed_date"),
                "original_price": first.get("original_price"),
            },
        },
        {
            **second,
            "match_type": "exact",
            "details": {
                "reviews": second.get("reviews"),
                "discount_percentage": second.get("discount_percentage"),
                "purchased_last_month": second.get("purchased_last_month"),
                "is_best_seller": second.get("is_best_seller"),
                "is_sponsored": second.get("is_sponsored"),
                "has_coupon": second.get("has_coupon"),
                "buy_box_availability": second.get("buy_box_availability"),
                "sustainability_tags": second.get("sustainability_tags"),
                "expected_delivery_date": second.get("expected_delivery_date"),
                "order_placed_date": second.get("order_placed_date"),
                "original_price": second.get("original_price"),
            },
        },
    ]

    return {
        "product1": left_query,
        "product2": right_query,
        "comparison": comparison_text,
        "compared_products": compared_products,
        "result": "Comparison generated from sales dataset.",
        "winner_rating": winner_rating,
        "winner_price": winner_price,
        "winner_reviews": review_winner,
        "winner_discount": discount_winner,
        "winner_value": value_winner,
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

    @router.post(f"{prefix}/auth/sync-google-session")
    def sync_google_session(payload: SessionSyncRequest):
        supabase_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
        anon_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
        if not supabase_url or not anon_key:
            raise HTTPException(status_code=500, detail="Supabase auth is not configured")

        response = requests.get(
            f"{supabase_url}/auth/v1/user",
            headers={
                "apikey": anon_key,
                "Authorization": f"Bearer {payload.access_token}",
            },
            timeout=15,
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=401, detail="Invalid or expired Google session")

        user_payload = response.json()
        _sync_profile_best_effort(user_payload)

        metadata = user_payload.get("user_metadata") or {}
        app_token = _create_access_token(
            {
                "sub": user_payload.get("id"),
                "email": user_payload.get("email"),
                "name": metadata.get("full_name") or metadata.get("name") or "",
            }
        )

        return {
            "access_token": app_token,
            "token_type": "bearer",
            "user": {
                "id": user_payload.get("id"),
                "email": user_payload.get("email"),
                "full_name": metadata.get("full_name") or metadata.get("name") or "",
                "avatar_url": metadata.get("avatar_url") or metadata.get("picture") or "",
            },
            "message": "Google login successful",
        }

    @router.get(f"{prefix}/auth/me")
    def auth_me(authorization: Optional[str] = Header(default=None)):
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization header")
        token = authorization.split(" ", 1)[1]
        payload = _decode_access_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {
            "id": payload.get("sub"),
            "email": payload.get("email"),
            "full_name": payload.get("name", ""),
        }

    @router.get(f"{prefix}/auth/profile")
    def auth_profile(authorization: Optional[str] = Header(default=None)):
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization header")
        token = authorization.split(" ", 1)[1]
        payload = _decode_access_token(token)
        if not payload or not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token")
        profile = _fetch_local_profile_by_id(str(payload.get("sub")))
        return {"profile": profile or {}, "message": "Profile loaded successfully"}

    @router.put(f"{prefix}/auth/profile")
    def update_auth_profile(payload: ProfileUpdateRequest, authorization: Optional[str] = Header(default=None)):
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization header")
        token = authorization.split(" ", 1)[1]
        current_user = _decode_access_token(token)
        if not current_user or not current_user.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token")
        profile = _update_profile_for_user(str(current_user.get("sub")), payload.model_dump(exclude_none=True))
        return {"message": "Profile saved successfully", "profile": profile}

    @router.post(f"{prefix}/auth/resolve-identifier")
    def resolve_identifier(payload: ResolveIdentifierRequest):
        email = _resolve_email_for_identifier(payload.identifier)
        if not email:
            raise HTTPException(status_code=404, detail="User not found")
        return {"email": email}

    @router.post(f"{prefix}/auth/create-email-account")
    def create_email_account(payload: EmailSignupRequest):
        profile = _create_local_email_account(payload.email, payload.password, payload.username)
        app_token = _create_access_token(
            {
                "sub": profile.get("id"),
                "email": profile.get("email"),
                "name": profile.get("full_name") or profile.get("username") or "",
            }
        )
        return {
            "message": "Account created without confirmation email",
            "user": {
                "id": profile.get("id"),
                "email": profile.get("email"),
                "username": profile.get("username") or "",
                "full_name": profile.get("full_name") or "",
                "email_confirmed_at": profile.get("email_confirmed_at"),
            },
            "profile": profile,
            "access_token": app_token,
            "token_type": "bearer",
        }

    @router.post(f"{prefix}/auth/email-login")
    def email_login(payload: EmailLoginRequest):
        profile = _authenticate_local_email_account(payload.email, payload.password)
        app_token = _create_access_token(
            {
                "sub": profile.get("id"),
                "email": profile.get("email"),
                "name": profile.get("full_name") or profile.get("username") or "",
            }
        )
        return {
            "access_token": app_token,
            "token_type": "bearer",
            "user": {
                "id": profile.get("id"),
                "email": profile.get("email"),
                "username": profile.get("username") or "",
                "full_name": profile.get("full_name") or "",
                "avatar_url": profile.get("avatar_url") or "",
                "email_confirmed_at": profile.get("email_confirmed_at"),
                "last_sign_in_at": profile.get("last_sign_in_at"),
                "auth_provider": profile.get("auth_provider") or "email",
            },
            "profile": profile,
        }

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
        return _build_chat_response(req.get_query())

    @router.post(f"{prefix}/chat/query")
    def chat_query(req: ChatRequest):
        return _build_chat_response(req.get_query())

    @router.get(f"{prefix}/chat/dashboard")
    def chat_dashboard(selected_user_id: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
        user_id = "guest"
        if authorization and authorization.lower().startswith("bearer "):
            payload = _decode_access_token(authorization.split(" ", 1)[1])
            if payload and payload.get("sub"):
                user_id = str(payload.get("sub"))

        active_user_id = str(selected_user_id or user_id)
        return {
            "current_user_id": user_id,
            "selected_user_id": active_user_id,
            "visitors": [
                {
                    "id": user_id,
                    "name": "You",
                    "email": "",
                    "avatar_url": "",
                    "last_message": "",
                    "last_message_at": "",
                }
            ],
            "messages": [],
            "cart_items": [],
            "suggested_questions": [
                "Show me the best budget wireless earbuds under INR 5000.",
                "Recommend top-rated products in Electronics with strong reviews.",
                "Find alternatives similar to iPhone with lower price.",
            ],
        }

    @router.post(f"{prefix}/chat/ask")
    def chat_ask(req: ChatRequest):
        query = req.get_query()
        payload = _build_chat_response(query)
        return {
            "question": query,
            "answer": payload.get("answer") or payload.get("response") or "No response",
            "confidence": payload.get("confidence", 0.8),
        }

    @router.post(f"{prefix}/chat/ask-stream")
    def chat_ask_stream(req: ChatRequest):
        query = req.get_query()
        payload = _build_chat_response(query)
        answer_text = payload.get("answer") or payload.get("response") or "No response"

        async def _streamer():
            yield answer_text

        return StreamingResponse(_streamer(), media_type="text/plain; charset=utf-8")

    @router.post(f"{prefix}/recommend")
    def recommend(req: RecommendRequest):
        return _build_recommend_response(req.get_product())

    @router.post(f"{prefix}/chat/recommend")
    def chat_recommend(req: RecommendRequest):
        return _build_recommend_response(req.get_product())

    @router.post(f"{prefix}/compare")
    def compare(req: CompareRequest):
        return _build_compare_response(req.get_product1(), req.get_product2())

    @router.post(f"{prefix}/chat/compare")
    def chat_compare(req: CompareRequest):
        return _build_compare_response(req.get_product1(), req.get_product2())

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
