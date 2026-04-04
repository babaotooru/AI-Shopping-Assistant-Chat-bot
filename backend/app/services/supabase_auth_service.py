"""Supabase authentication and profile persistence service."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
import logging
import re
import uuid
import requests
import bcrypt
from fastapi import HTTPException

from config import settings

logger = logging.getLogger(__name__)


class SupabaseAuthService:
    """Service for validating Supabase access tokens and persisting user profile data."""

    def __init__(self) -> None:
        self.supabase_url = settings.SUPABASE_URL.rstrip("/")
        self.supabase_anon_key = settings.SUPABASE_ANON_KEY or settings.SUPABASE_KEY
        self.supabase_service_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
        self.profile_table = settings.SUPABASE_PROFILE_TABLE
        self.login_audit_table = settings.SUPABASE_LOGIN_AUDIT_TABLE

    def _auth_headers(self, access_token: str) -> Dict[str, str]:
        return {
            "apikey": self.supabase_anon_key,
            "Authorization": f"Bearer {access_token}",
        }

    def _service_headers(self) -> Dict[str, str]:
        return {
            "apikey": self.supabase_service_key,
            "Authorization": f"Bearer {self.supabase_service_key}",
            "Content-Type": "application/json",
        }

    def _write_headers(self, access_token: Optional[str] = None) -> Dict[str, str]:
        if access_token:
            return {
                **self._auth_headers(access_token),
                "Content-Type": "application/json",
            }

        return self._service_headers()

    def _fetch_profile_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        if not self.supabase_url or not self.supabase_service_key:
            return None

        response = requests.get(
            f"{self.supabase_url}/rest/v1/{self.profile_table}",
            headers=self._service_headers(),
            params={"select": "*", "email": f"eq.{email.strip().lower()}", "limit": 1},
            timeout=10,
        )
        if response.status_code >= 400:
            return None

        data = response.json()
        if isinstance(data, list) and data:
            return data[0]
        return None

    def _fetch_profile_by_id(self, profile_id: str) -> Optional[Dict[str, Any]]:
        if not self.supabase_url or not self.supabase_service_key:
            return None

        response = requests.get(
            f"{self.supabase_url}/rest/v1/{self.profile_table}",
            headers=self._service_headers(),
            params={"select": "*", "id": f"eq.{profile_id}", "limit": 1},
            timeout=10,
        )
        if response.status_code >= 400:
            return None

        data = response.json()
        if isinstance(data, list) and data:
            return data[0]
        return None

    def _sanitize_profile_updates(self, updates: Dict[str, Any]) -> Dict[str, Any]:
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

        sanitized: Dict[str, Any] = {}
        for key, value in updates.items():
            if key not in allowed_fields or value is None:
                continue

            if isinstance(value, str):
                value = value.strip()

            # Supabase date columns cannot accept empty string.
            if key == "date_of_birth" and value == "":
                continue

            sanitized[key] = value

        return sanitized

    def _update_profile(self, profile_id: str, updates: Dict[str, Any]) -> None:
        if not self.supabase_url or not self.supabase_service_key:
            return

        requests.patch(
            f"{self.supabase_url}/rest/v1/{self.profile_table}",
            headers={**self._service_headers(), "Prefer": "return=minimal"},
            params={"id": f"eq.{profile_id}"},
            json=updates,
            timeout=10,
        )

    def get_profile_for_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        return self._fetch_profile_by_id(user_id)

    def update_profile_for_user(self, user_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        if not self.supabase_url or not self.supabase_service_key:
            raise HTTPException(
                status_code=500,
                detail="Supabase service-role key is missing. Set SUPABASE_SERVICE_ROLE_KEY in backend .env.",
            )

        existing_profile = self._fetch_profile_by_id(user_id) or {"id": user_id}
        sanitized_updates = self._sanitize_profile_updates(updates)
        now = datetime.now(timezone.utc).isoformat()

        merged_profile = {
            **existing_profile,
            **sanitized_updates,
            "id": user_id,
            "email": sanitized_updates.get("email") or existing_profile.get("email") or "",
            "username": sanitized_updates.get("username") or existing_profile.get("username") or "",
            "full_name": sanitized_updates.get("full_name") or existing_profile.get("full_name") or "",
            "avatar_url": sanitized_updates.get("avatar_url") or existing_profile.get("avatar_url") or "",
            "phone": sanitized_updates.get("phone") or existing_profile.get("phone") or "",
            "date_of_birth": sanitized_updates.get("date_of_birth") or existing_profile.get("date_of_birth") or "",
            "bio": sanitized_updates.get("bio") or existing_profile.get("bio") or "",
            "address_line_1": sanitized_updates.get("address_line_1") or existing_profile.get("address_line_1") or "",
            "address_line_2": sanitized_updates.get("address_line_2") or existing_profile.get("address_line_2") or "",
            "city": sanitized_updates.get("city") or existing_profile.get("city") or "",
            "state": sanitized_updates.get("state") or existing_profile.get("state") or "",
            "postal_code": sanitized_updates.get("postal_code") or existing_profile.get("postal_code") or "",
            "country": sanitized_updates.get("country") or existing_profile.get("country") or "",
            "preferred_category": sanitized_updates.get("preferred_category") or existing_profile.get("preferred_category") or "",
            "notification_email": sanitized_updates.get("notification_email")
            if "notification_email" in sanitized_updates
            else existing_profile.get("notification_email", True),
            "notification_sms": sanitized_updates.get("notification_sms")
            if "notification_sms" in sanitized_updates
            else existing_profile.get("notification_sms", False),
            "updated_at": now,
            "last_login_at": existing_profile.get("last_login_at") or now,
        }

        response = requests.post(
            f"{self.supabase_url}/rest/v1/{self.profile_table}",
            headers={**self._service_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
            json=merged_profile,
            timeout=15,
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=f"Profile update failed: {response.text}")

        data = response.json()
        if isinstance(data, list) and data:
            return data[0]
        return merged_profile

    def create_local_email_account(self, email: str, password: str, username: str) -> Dict[str, Any]:
        if not self.supabase_url or not self.supabase_service_key:
            raise HTTPException(
                status_code=500,
                detail="Supabase service-role key is missing. Set SUPABASE_SERVICE_ROLE_KEY in backend .env.",
            )

        normalized_email = email.strip().lower()
        existing = self._fetch_profile_by_email(normalized_email)
        if existing:
            raise HTTPException(status_code=409, detail="An account with this email already exists")

        now = datetime.now(timezone.utc).isoformat()
        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
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
            "raw_user_payload": {
                "email": normalized_email,
                "username": username.strip(),
                "provider": "email",
            },
            "provider": "email",
            "password_hash": password_hash,
            "updated_at": now,
            "last_login_at": now,
        }

        response = requests.post(
            f"{self.supabase_url}/rest/v1/{self.profile_table}",
            headers={**self._service_headers(), "Prefer": "return=representation"},
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
        if isinstance(data, list) and data:
            profile_row = data[0]

        self.record_local_login_event(profile_row)
        return profile_row

    def authenticate_local_email_account(self, email: str, password: str) -> Dict[str, Any]:
        profile = self._fetch_profile_by_email(email)
        if not profile:
            raise HTTPException(status_code=404, detail="Account not found")

        password_hash = profile.get("password_hash")
        if not password_hash:
            raise HTTPException(status_code=400, detail="This account does not use email/password login")

        if not bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8")):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        now = datetime.now(timezone.utc).isoformat()
        self._update_profile(profile["id"], {"last_sign_in_at": now, "last_login_at": now})
        profile["last_sign_in_at"] = now
        profile["last_login_at"] = now
        self.record_local_login_event(profile)
        return profile

    def record_local_login_event(self, profile: Dict[str, Any]) -> None:
        if not self.supabase_url or not self.supabase_service_key:
            return

        payload = {
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
        }

        requests.post(
            f"{self.supabase_url}/rest/v1/{self.login_audit_table}",
            headers={**self._service_headers(), "Prefer": "return=minimal"},
            json=payload,
            timeout=10,
        )

    def validate_google_session(self, access_token: str) -> Dict[str, Any]:
        """Validate Supabase access token and return authenticated user payload."""
        if not self.supabase_url or not self.supabase_anon_key:
            raise ValueError("Supabase auth config missing: set SUPABASE_URL and SUPABASE_ANON_KEY")

        response = requests.get(
            f"{self.supabase_url}/auth/v1/user",
            headers=self._auth_headers(access_token),
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict) or not payload.get("id"):
            raise ValueError("Invalid Supabase session payload")
        return payload

    def create_confirmed_email_user(
        self,
        email: str,
        password: str,
        user_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a Supabase auth user with email confirmation already satisfied."""
        if not self.supabase_url or not self.supabase_service_key:
            raise HTTPException(
                status_code=500,
                detail="Supabase service-role key is missing. Set SUPABASE_SERVICE_ROLE_KEY in backend .env.",
            )

        payload = {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": user_metadata or {},
        }

        response = requests.post(
            f"{self.supabase_url}/auth/v1/admin/users",
            headers={
                "apikey": self.supabase_service_key,
                "Authorization": f"Bearer {self.supabase_service_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )

        if response.status_code >= 400:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Supabase user creation failed: {response.text}",
            )

        data = response.json()
        user_payload = data.get("user") if isinstance(data, dict) and isinstance(data.get("user"), dict) else data
        if not isinstance(user_payload, dict) or not user_payload.get("id"):
            raise ValueError("Failed to create Supabase user")
        return user_payload

    def upsert_profile(self, user_payload: Dict[str, Any], access_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Upsert profile record in Supabase profiles table."""
        if not self.supabase_url or not self.supabase_service_key:
            logger.warning("Supabase service key not configured, profile upsert skipped")
            return None

        user_id = user_payload.get("id")
        email = user_payload.get("email")
        metadata = user_payload.get("user_metadata") or {}
        app_metadata = user_payload.get("app_metadata") or {}
        identities = user_payload.get("identities") or []
        email_local = str(email or "").split("@", 1)[0]
        username = (
            metadata.get("preferred_username")
            or metadata.get("user_name")
            or metadata.get("username")
            or email_local
            or ""
        )
        profile_row = {
            "id": user_id,
            "email": email,
            "username": username,
            "full_name": metadata.get("full_name") or metadata.get("name") or "",
            "avatar_url": metadata.get("avatar_url") or metadata.get("picture") or "",
            "phone": user_payload.get("phone") or "",
            "email_confirmed_at": user_payload.get("email_confirmed_at"),
            "last_sign_in_at": user_payload.get("last_sign_in_at"),
            "auth_provider": app_metadata.get("provider") or "google",
            "user_metadata": metadata,
            "app_metadata": app_metadata,
            "identities": identities,
            "raw_user_payload": user_payload,
            "provider": app_metadata.get("provider") or "google",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_login_at": datetime.now(timezone.utc).isoformat(),
        }

        request_headers = {
            **self._write_headers(access_token),
            "Prefer": "resolution=merge-duplicates,return=representation",
        }

        try:
            response = requests.post(
                f"{self.supabase_url}/rest/v1/{self.profile_table}",
                headers=request_headers,
                json=profile_row,
                timeout=15,
            )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, list) and data:
                return data[0]
            return profile_row
        except Exception as primary_exc:
            logger.warning("Profile upsert with access token failed, retrying with service role: %s", primary_exc)

        try:
            service_headers = {
                **self._service_headers(),
                "Prefer": "resolution=merge-duplicates,return=representation",
            }
            response = requests.post(
                f"{self.supabase_url}/rest/v1/{self.profile_table}",
                headers=service_headers,
                json=profile_row,
                timeout=15,
            )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, list) and data:
                return data[0]
            return profile_row
        except Exception as service_exc:
            logger.warning("Profile upsert failed (table may be missing): %s", service_exc)
            return profile_row

    def record_login_event(self, user_payload: Dict[str, Any], access_token: Optional[str] = None) -> None:
        """Record login event for multi-login tracking; best-effort only."""
        if not self.supabase_url or not self.supabase_service_key:
            return

        user_id = user_payload.get("id")
        email = user_payload.get("email")
        metadata = user_payload.get("user_metadata") or {}
        app_metadata = user_payload.get("app_metadata") or {}

        payload = {
            "user_id": user_id,
            "email": email,
            "provider": app_metadata.get("provider") or "google",
            "full_name": metadata.get("full_name") or metadata.get("name") or "",
            "username": metadata.get("preferred_username")
            or metadata.get("user_name")
            or metadata.get("username")
            or str(email or "").split("@", 1)[0],
            "avatar_url": metadata.get("avatar_url") or metadata.get("picture") or "",
            "phone": user_payload.get("phone") or "",
            "email_confirmed_at": user_payload.get("email_confirmed_at"),
            "last_sign_in_at": user_payload.get("last_sign_in_at"),
            "auth_provider": app_metadata.get("provider") or "google",
            "user_metadata": metadata,
            "app_metadata": app_metadata,
            "raw_login_payload": user_payload,
            "logged_in_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            response = requests.post(
                f"{self.supabase_url}/rest/v1/{self.login_audit_table}",
                headers={
                    **self._write_headers(access_token),
                    "Prefer": "return=minimal",
                },
                json=payload,
                timeout=10,
            )
            response.raise_for_status()
            return
        except Exception as primary_exc:
            logger.warning("Login audit insert with access token failed, retrying with service role: %s", primary_exc)

        try:
            response = requests.post(
                f"{self.supabase_url}/rest/v1/{self.login_audit_table}",
                headers={
                    **self._service_headers(),
                    "Prefer": "return=minimal",
                },
                json=payload,
                timeout=10,
            )
            response.raise_for_status()
        except Exception as service_exc:
            logger.warning("Login audit insert failed (table may be missing): %s", service_exc)

    def resolve_email_for_identifier(self, identifier: str) -> Optional[str]:
        """Resolve an email address for username/email identifier."""
        value = (identifier or "").strip()
        if not value:
            return None

        if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value):
            return value

        if not self.supabase_url or not self.supabase_service_key:
            return None

        params = {
            "select": "email,username,full_name",
            "or": f"username.eq.{value},full_name.eq.{value}",
            "limit": 1,
        }

        try:
            response = requests.get(
                f"{self.supabase_url}/rest/v1/{self.profile_table}",
                headers=self._service_headers(),
                params=params,
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, list) and data and data[0].get("email"):
                return str(data[0]["email"])
            return None
        except Exception as exc:
            logger.warning("Identifier lookup failed: %s", exc)
            return None

    def list_profiles(self, limit: int = 50) -> list[Dict[str, Any]]:
        """List recent user profiles for visitor/chat dashboards."""
        if not self.supabase_url or not self.supabase_service_key:
            return []

        params = {
            "select": "id,email,username,full_name,avatar_url,last_sign_in_at,updated_at",
            "order": "last_sign_in_at.desc.nullslast",
            "limit": max(1, min(limit, 200)),
        }

        try:
            response = requests.get(
                f"{self.supabase_url}/rest/v1/{self.profile_table}",
                headers=self._service_headers(),
                params=params,
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, list):
                return data
            return []
        except Exception as exc:
            logger.warning("Profile listing failed: %s", exc)
            return []


supabase_auth_service = SupabaseAuthService()
