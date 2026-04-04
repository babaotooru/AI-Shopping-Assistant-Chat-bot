"""Authentication routes for Google + Supabase session sync."""

from typing import Optional
import logging
import jwt

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from app.services.supabase_auth_service import supabase_auth_service
from app.utils.auth import create_access_token, decode_access_token

logger = logging.getLogger(__name__)
router = APIRouter()


def _decode_supabase_access_token(access_token: str) -> Optional[dict]:
    """Best-effort decode for Supabase JWT when user endpoint validation fails."""
    try:
        payload = jwt.decode(
            access_token,
            options={"verify_signature": False, "verify_aud": False},
            algorithms=["HS256", "RS256"],
        )
        if not isinstance(payload, dict):
            return None
        return payload
    except Exception:
        return None


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


@router.post("/sync-google-session")
async def sync_google_session(payload: SessionSyncRequest) -> dict:
    """Validate Google/Supabase session token and create app session token."""
    try:
        try:
            user_payload = supabase_auth_service.validate_google_session(payload.access_token)
        except Exception as validation_error:
            logger.warning("Primary Supabase user validation failed, trying JWT fallback: %s", validation_error)
            decoded = _decode_supabase_access_token(payload.access_token)
            if not decoded:
                raise HTTPException(status_code=401, detail="Invalid or expired Google session")

            user_payload = {
                "id": decoded.get("sub"),
                "email": decoded.get("email"),
                "phone": decoded.get("phone"),
                "email_confirmed_at": decoded.get("email_confirmed_at"),
                "last_sign_in_at": decoded.get("iat"),
                "user_metadata": decoded.get("user_metadata") or {},
                "app_metadata": decoded.get("app_metadata") or {"provider": "google"},
                "identities": decoded.get("identities") or [],
            }

            if not user_payload.get("id") or not user_payload.get("email"):
                raise HTTPException(status_code=401, detail="Invalid or expired Google session")

        profile = supabase_auth_service.upsert_profile(user_payload, payload.access_token)
        persisted_profile = supabase_auth_service.get_profile_for_user(str(user_payload.get("id")))
        supabase_auth_service.record_login_event(user_payload, payload.access_token)

        user_metadata = user_payload.get("user_metadata") or {}
        app_metadata = user_payload.get("app_metadata") or {}

        app_token = create_access_token(
            {
                "sub": user_payload.get("id"),
                "email": user_payload.get("email"),
                "name": user_metadata.get("full_name")
                or user_metadata.get("name")
                or "",
            }
        )

        return {
            "access_token": app_token,
            "token_type": "bearer",
            "user": {
                "id": user_payload.get("id"),
                "email": user_payload.get("email"),
                "username": user_metadata.get("preferred_username")
                or user_metadata.get("user_name")
                or user_metadata.get("username")
                or "",
                "full_name": user_metadata.get("full_name")
                or user_metadata.get("name")
                or "",
                "avatar_url": user_metadata.get("avatar_url")
                or user_metadata.get("picture")
                or "",
                "phone": user_payload.get("phone") or "",
                "email_confirmed_at": user_payload.get("email_confirmed_at"),
                "last_sign_in_at": user_payload.get("last_sign_in_at"),
                "auth_provider": app_metadata.get("provider") or "google",
                "user_metadata": user_metadata,
                "app_metadata": app_metadata,
                "identities": user_payload.get("identities") or [],
            },
            "profile": persisted_profile or profile,
            "message": "Google login successful",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to sync Google session: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired Google session")


@router.get("/me")
async def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    """Return current authenticated app user from JWT."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = authorization.split(" ", 1)[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    return {
        "id": payload.get("sub"),
        "email": payload.get("email"),
        "full_name": payload.get("name", ""),
    }


@router.get("/profile")
async def get_profile(authorization: Optional[str] = Header(default=None)) -> dict:
    """Return the persisted profile for the current authenticated user."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = authorization.split(" ", 1)[1]
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid token")

    profile = supabase_auth_service.get_profile_for_user(str(payload.get("sub")))
    return {
        "profile": profile or {},
        "message": "Profile loaded successfully",
    }


@router.put("/profile")
async def update_profile(payload: ProfileUpdateRequest, authorization: Optional[str] = Header(default=None)) -> dict:
    """Persist editable profile sections to Supabase profiles table."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = authorization.split(" ", 1)[1]
    current_user = decode_access_token(token)
    if not current_user or not current_user.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid token")

    profile = supabase_auth_service.update_profile_for_user(str(current_user.get("sub")), payload.model_dump(exclude_none=True))
    return {
        "message": "Profile saved successfully",
        "profile": profile,
    }


@router.post("/resolve-identifier")
async def resolve_identifier(payload: ResolveIdentifierRequest) -> dict:
    """Resolve username/email identifier to email for password sign-in."""
    email = supabase_auth_service.resolve_email_for_identifier(payload.identifier)
    if not email:
        raise HTTPException(status_code=404, detail="User not found")
    return {"email": email}


@router.post("/create-email-account")
async def create_email_account(payload: EmailSignupRequest) -> dict:
    """Create a local email/password account without sending confirmation mail."""
    try:
        profile = supabase_auth_service.create_local_email_account(
            payload.email,
            payload.password,
            payload.username,
        )

        app_token = create_access_token(
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
                "username": profile.get("username") or payload.username.strip(),
                "full_name": profile.get("full_name") or payload.username.strip(),
                "email_confirmed_at": profile.get("email_confirmed_at"),
            },
            "profile": profile,
            "access_token": app_token,
            "token_type": "bearer",
        }
    except Exception as exc:
        logger.error("Failed to create email account: %s", exc)
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=400, detail=str(exc) or "Unable to create account")


@router.post("/email-login")
async def email_login(payload: EmailLoginRequest) -> dict:
    """Authenticate a local email/password account without Supabase confirmation flow."""
    try:
        profile = supabase_auth_service.authenticate_local_email_account(payload.email, payload.password)
        app_token = create_access_token(
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
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to login email account: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc) or "Unable to login")
