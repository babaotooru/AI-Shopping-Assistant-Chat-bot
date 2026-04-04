"""
Redis-backed conversation memory management for multi-turn chat sessions.
Stores conversation history with TTL and fast retrieval.
"""
import redis
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from config import settings
import logging

logger = logging.getLogger(__name__)


class RedisMemoryService:
    """
    Redis-backed memory service for conversation history.
    Key structure: chat:session:{user_id}:{conversation_id}
    """

    def __init__(self):
        """Initialize Redis connection pool."""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                health_check_interval=30
            )
            # Test connection
            self.redis_client.ping()
            logger.info("✅ Redis connection established")
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {str(e)}")
            logger.warning("Falling back to in-memory conversation storage")
            self.redis_client = None
            self._in_memory_storage: Dict[str, List[Dict[str, Any]]] = {}

    def _get_key(self, user_id: str, conversation_id: str) -> str:
        """Generate Redis key for conversation."""
        return f"chat:session:{user_id}:{conversation_id}"

    def append_message(
        self,
        user_id: str,
        conversation_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Append a message to conversation history.
        
        Args:
            user_id: User identifier
            conversation_id: Conversation/session ID
            role: Message role (user/assistant/system)
            content: Message content
            metadata: Optional metadata (tokens, model, etc)
        
        Returns:
            Success status
        """
        try:
            key = self._get_key(user_id, conversation_id)
            message = {
                "role": role,
                "content": content,
                "timestamp": datetime.utcnow().isoformat(),
                "metadata": metadata or {}
            }

            if self.redis_client:
                # Push to list and set expiry (7 days)
                self.redis_client.lpush(key, json.dumps(message))
                self.redis_client.expire(key, 7 * 24 * 60 * 60)
            else:
                # Fallback: in-memory storage
                if key not in self._in_memory_storage:
                    self._in_memory_storage[key] = []
                self._in_memory_storage[key].insert(0, message)

            return True
        except Exception as e:
            logger.error(f"Error appending message: {str(e)}")
            return False

    def get_conversation_history(
        self,
        user_id: str,
        conversation_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get conversation history in chronological order (oldest first).
        
        Args:
            user_id: User identifier
            conversation_id: Conversation/session ID
            limit: Maximum number of messages to retrieve
        
        Returns:
            List of messages [oldest...newest]
        """
        try:
            key = self._get_key(user_id, conversation_id)

            if self.redis_client:
                # Redis stores newest first, so reverse to get chronological order
                raw_messages = self.redis_client.lrange(key, 0, limit - 1)
                messages = [json.loads(msg) for msg in raw_messages]
                return list(reversed(messages))
            else:
                # In-memory fallback
                if key not in self._in_memory_storage:
                    return []
                messages = self._in_memory_storage[key][:limit]
                return list(reversed(messages))

        except Exception as e:
            logger.error(f"Error retrieving conversation: {str(e)}")
            return []

    def get_recent_context(
        self,
        user_id: str,
        conversation_id: str,
        window: int = 10
    ) -> str:
        """
        Get recent conversation context as formatted string for LLM context.
        
        Args:
            user_id: User identifier
            conversation_id: Conversation ID
            window: Number of recent messages to include
        
        Returns:
            Formatted conversation history string
        """
        messages = self.get_conversation_history(user_id, conversation_id, limit=window)
        if not messages:
            return ""

        context_lines = []
        for msg in messages:
            role = msg.get("role", "").upper()
            content = msg.get("content", "")
            context_lines.append(f"{role}: {content}")

        return "\n".join(context_lines)

    def clear_conversation(
        self,
        user_id: str,
        conversation_id: str
    ) -> bool:
        """
        Clear a conversation history.
        
        Args:
            user_id: User identifier
            conversation_id: Conversation ID
        
        Returns:
            Success status
        """
        try:
            key = self._get_key(user_id, conversation_id)

            if self.redis_client:
                self.redis_client.delete(key)
            else:
                if key in self._in_memory_storage:
                    del self._in_memory_storage[key]

            return True
        except Exception as e:
            logger.error(f"Error clearing conversation: {str(e)}")
            return False

    def get_user_conversations(
        self,
        user_id: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get all conversation IDs and metadata for a user.
        
        Args:
            user_id: User identifier
            limit: Maximum number of conversations
        
        Returns:
            List of conversation summaries
        """
        try:
            if self.redis_client:
                pattern = f"chat:session:{user_id}:*"
                keys = self.redis_client.keys(pattern)[:limit]
                conversations = []

                for key in keys:
                    conv_id = key.split(f"chat:session:{user_id}:")[-1]
                    messages = self.get_conversation_history(user_id, conv_id, limit=1)

                    if messages:
                        last_msg = messages[-1]
                        conversations.append({
                            "conversation_id": conv_id,
                            "last_message": last_msg.get("content", "")[:50],
                            "last_updated": last_msg.get("timestamp", ""),
                            "message_count": self.redis_client.llen(key)
                        })

                return sorted(conversations, key=lambda x: x["last_updated"], reverse=True)
            else:
                # In-memory fallback
                conversations = []
                for key in self._in_memory_storage:
                    if f"chat:session:{user_id}:" in key:
                        conv_id = key.split(f"chat:session:{user_id}:")[-1]
                        messages = self._in_memory_storage[key]
                        if messages:
                            conversations.append({
                                "conversation_id": conv_id,
                                "last_message": messages[-1].get("content", "")[:50],
                                "last_updated": messages[-1].get("timestamp", ""),
                                "message_count": len(messages)
                            })

                return sorted(conversations, key=lambda x: x["last_updated"], reverse=True)[:limit]

        except Exception as e:
            logger.error(f"Error getting user conversations: {str(e)}")
            return []


# Singleton instance
redis_memory_service = RedisMemoryService()
