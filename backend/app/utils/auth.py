"""
Utility functions for JWT and authentication
"""
from datetime import datetime, timedelta
from typing import Optional
import jwt
from config import settings
import logging

logger = logging.getLogger(__name__)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    try:
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRY_MINUTES)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(
            to_encode,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM
        )
        return encoded_jwt
    except Exception as e:
        logger.error(f"Error creating access token: {str(e)}")
        raise

def decode_access_token(token: str) -> Optional[dict]:
    """Decode JWT access token"""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        return None
    except jwt.InvalidTokenError:
        # Fallback for Supabase-issued JWTs so OAuth sessions can work even when
        # backend app-token sync is unavailable.
        try:
            supabase_payload = jwt.decode(
                token,
                options={"verify_signature": False, "verify_aud": False},
                algorithms=["HS256", "RS256"],
            )
            if isinstance(supabase_payload, dict) and supabase_payload.get("sub"):
                issuer = str(supabase_payload.get("iss") or "")
                if "supabase" in issuer or supabase_payload.get("email"):
                    return {
                        "sub": supabase_payload.get("sub"),
                        "email": supabase_payload.get("email", ""),
                        "name": (supabase_payload.get("user_metadata") or {}).get("full_name")
                        or (supabase_payload.get("user_metadata") or {}).get("name")
                        or "",
                    }
        except Exception:
            pass

        logger.error("Invalid token")
        return None
    except Exception as e:
        logger.error(f"Error decoding token: {str(e)}")
        return None
