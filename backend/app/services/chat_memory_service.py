"""Chat memory service for per-user conversation persistence."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List
import json
import logging
import requests

from config import settings

logger = logging.getLogger(__name__)


class ChatMemoryService:
    """Store and retrieve chat messages from Supabase with local fallback."""

    def __init__(self) -> None:
        project_root = Path(__file__).resolve().parents[3]
        self.local_file = project_root / "chat_history.json"

        self.supabase_url = settings.SUPABASE_URL.rstrip("/")
        self.supabase_service_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
        self.table = settings.SUPABASE_CHAT_MESSAGES_TABLE
        self.use_supabase = bool(settings.USE_SUPABASE and self.supabase_url and self.supabase_service_key)

    def _service_headers(self) -> Dict[str, str]:
        return {
            "apikey": self.supabase_service_key,
            "Authorization": f"Bearer {self.supabase_service_key}",
            "Content-Type": "application/json",
        }

    def _endpoint(self) -> str:
        return f"{self.supabase_url}/rest/v1/{self.table}"

    def _read_local(self) -> List[Dict[str, Any]]:
        if not self.local_file.exists():
            return []

        try:
            payload = json.loads(self.local_file.read_text(encoding="utf-8"))
            if isinstance(payload, list):
                return payload
            return []
        except Exception as exc:
            logger.warning("Unable to read local chat history: %s", exc)
            return []

    def _write_local(self, messages: List[Dict[str, Any]]) -> None:
        try:
            self.local_file.write_text(json.dumps(messages, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("Unable to write local chat history: %s", exc)

    def list_messages(self, user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        safe_limit = max(1, min(limit, 500))
        if self.use_supabase:
            try:
                response = requests.get(
                    self._endpoint(),
                    headers=self._service_headers(),
                    params={
                        "select": "*",
                        "user_id": f"eq.{user_id}",
                        "order": "created_at.asc",
                        "limit": safe_limit,
                    },
                    timeout=10,
                )
                response.raise_for_status()
                data = response.json()
                if isinstance(data, list):
                    return data
            except Exception as exc:
                logger.warning("Supabase chat read failed, using local fallback: %s", exc)

        messages = [m for m in self._read_local() if str(m.get("user_id")) == str(user_id)]
        messages.sort(key=lambda item: str(item.get("created_at", "")))
        return messages[:safe_limit]

    def append_message(self, user_id: str, role: str, content: str) -> Dict[str, Any]:
        item = {
            "user_id": user_id,
            "role": role,
            "content": content,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if self.use_supabase:
            try:
                response = requests.post(
                    self._endpoint(),
                    headers={**self._service_headers(), "Prefer": "return=representation"},
                    json=item,
                    timeout=10,
                )
                response.raise_for_status()
                data = response.json()
                if isinstance(data, list) and data:
                    return data[0]
            except Exception as exc:
                logger.warning("Supabase chat insert failed, using local fallback: %s", exc)

        messages = self._read_local()
        messages.append(item)
        self._write_local(messages)
        return item


chat_memory_service = ChatMemoryService()
