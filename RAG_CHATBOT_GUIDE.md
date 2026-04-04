# RAG (Retrieval-Augmented Generation) Chatbot System

## Overview

The chatbot now uses a production-grade RAG architecture combining:

- **FastAPI** - Backend framework
- **LangChain** - LLM orchestration and prompt management
- **FAISS (Facebook AI Similarity Search)** - Vector database for semantic search
- **Sentence-Transformers** - Embedding model for product contextualization
- **Redis** - In-memory store for conversation history and caching
- **Groq API** - Fast LLM inference
- **Supabase** - User auth and profile storage

## Architecture

```
User Query
    ↓
[RAG Pipeline]
    ├─→ Vector DB Search (FAISS) → 5 most relevant products
    ├─→ Redis Memory → Recent conversation context
    ├─→ LangChain Prompt Builder → Structured system + user prompts
    └─→ Groq LLM (llama3-70b-8192) → Generate ChatGPT-like response
        ↓
[Redis Memory]
    ├─→ Save user message
    └─→ Save assistant response
        ↓
    Return to Frontend
```

## Installation & Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This installs:
- `redis` - Redis client
- `faiss-cpu` - Vector search
- `sentence-transformers` - Embeddings
- `langchain` + `langchain-groq` - LLM orchestration

### 2. Configure Environment

Update `.env` file with:

```env
# LLM
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama3-70b-8192

# Vector DB
VECTOR_DB_TYPE=faiss  # or pinecone
VECTOR_DB_PATH=./data/vector_store
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Redis (for conversation memory)
REDIS_URL=redis://localhost:6379/0
```

### 3. Start Redis Server

```bash
# Using Docker (recommended)
docker run -d -p 6379:6379 redis:latest

# Or using Redis CLI directly if installed locally
redis-server
```

### 4. Run Backend

```bash
cd backend
python main.py
```

On startup, the system will:
1. Connect to Redis
2. Load all products from your catalog
3. Create embeddings for semantic search
4. Initialize FAISS index
5. Be ready to serve queries

## Chat Endpoints

### 1. **Get Chat Dashboard** (Fetch UI state)
```
GET /api/v1/chat/dashboard?selected_user_id=optional
Headers: Authorization: Bearer {token}
```

Returns:
- Current user info
- List of other visitors/users
- Selected user's conversation history
- Personalized shopping cart
- Suggested questions

### 2. **Ask Question (Non-streaming)**
```
POST /api/v1/chat/ask
Headers: Authorization: Bearer {token}
Body: {
    "question": "Show me the best budget earbuds under INR 5000",
    "user_id": "optional_target_user"
}
```

Returns:
- `answer` - ChatGPT-style response
- `confidence` - 0.85 (factual product recommendations)

### 3. **Ask Question (Streaming)**
```
POST /api/v1/chat/ask-stream
Headers: Authorization: Bearer {token}
Body: {
    "question": "Compare Samsung and iPhone prices"
}
```

Returns: Server-Sent Events (SSE) stream of response chunks

### 4. **Initialize Vector DB**
```
POST /api/v1/chat/index-products
```

Manually trigger product indexing. Called automatically on startup.

Returns:
```json
{
    "status": "success",
    "stats": {
        "total_products": 500,
        "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
        "index_type": "FAISS"
    }
}
```

### 5. **Get System Stats**
```
GET /api/v1/chat/stats
```

Returns detailed RAG system state, vector DB stats, memory backend info.

### 6. **Clear Conversation**
```
POST /api/v1/chat/clear-conversation
Headers: Authorization: Bearer {token}
Body: {
    "user_id": "optional"
}
```

Clears conversation history from Redis for a user.

### 7. **Public Query (No Auth)**
```
POST /api/v1/chat/query
Body: {
    "question": "What are the best products?"
}
```

Uses vector search, returns product list.

### 8. **Get Recommendations**
```
POST /api/v1/chat/recommend
Body: {
    "product_name": "Optional product for similarity",
    "count": 5
}
```

### 9. **Compare Products**
```
POST /api/v1/chat/compare
Body: {
    "product1": "iPhone 15",
    "product2": "Samsung Galaxy S24"
}
```

## How It Works

### Query → Semantic Search

When a user asks "Show me budget earbuds":

1. **Embedding** - Question embedded using Sentence-Transformers
2. **FAISS Search** - Compare embedding against all product embeddings
3. **Top-K Retrieval** - Get 5 most relevant products (cosine similarity)
4. **Fallback Hybrid Search** - If no semantic matches, combine keyword + semantic

### Context Building

```
[System Prompt]
You are an intelligent AI Shopping Assistant...
- Recommend ONLY from provided products
- Never invent prices/specs
- Compare clearly, rank by relevance
...

[Conversation History] (from Redis, last 5 turns)
USER: Previous question 1
ASSISTANT: Previous answer 1
USER: Previous question 2
ASSISTANT: Previous answer 2

[Product Context]
Available Products:
1. Budget Earbuds Pro - $49 ⭐4.8 (1200 reviews)
2. Wireless Earbuds Elite - $79 ⭐4.6 (850 reviews)
...

[Current Question]
USER: Show me budget options

[Response Task]
Answer ONLY using provided products...
```

### Response Generation

LangChain sends the complete context to Groq:

- **Model**: `llama3-70b-8192`
- **Temperature**: 0.4 (factual, not creative)
- **Max Tokens**: 2048

Groq returns response in milliseconds → streamed to frontend.

### Memory Storage

Every exchange saved to Redis:

```
Key: chat:session:{user_id}:default
Value: [
    {
        "role": "user",
        "content": "budget earbuds",
        "timestamp": "2026-04-04T10:30:00"
    },
    {
        "role": "assistant",
        "content": "I found 3 budget options...",
        "timestamp": "2026-04-04T10:30:05",
        "metadata": {
            "retrieved_products": 5,
            "model": "llama3-70b-8192"
        }
    }
]
```

Conversation history expires after 7 days.

## Performance

- **Semantic Search**: ~50ms (in-memory FAISS)
- **LLM Response**: ~1-3 seconds (Groq inference)
- **Streaming**: Live updates every 50ms
- **Memory**: ~500MB for FAISS index (50K products)
- **Cache**: Redis in-memory, fallback to file-based JSON

## Fallback Modes

### Redis Unavailable
If Redis not running, uses in-memory dict storage:
- Conversation history keeps in RAM only
- Lost on restart
- All other features work normally

### FAISS Issues
Falls back to keyword search using product name/category matching:
- Slower but still functional
- No semantic understanding
- Old AI service integration available

### Groq API Down
Falls back to structured answer generation:
- Uses product ratings/price/reviews
- Builds comparison tables
- No LLM inference needed

## Customization

### Change Embedding Model

Edit `.env`:
```env
EMBEDDING_MODEL=sentence-transformers/all-mpnet-base-v2  # Slower, more accurate
EMBEDDING_MODEL=sentence-transformers/all-minilm-l12-v2  # Faster
```

Requires re-indexing:
```bash
curl -X POST http://localhost:8000/api/v1/chat/index-products
```

### Use Pinecone Instead of FAISS

```env
VECTOR_DB_TYPE=pinecone
PINECONE_API_KEY=your_api_key
PINECONE_INDEX_NAME=shopping-assistant
```

### Adjust Temperature

Edit [`backend/app/services/rag_service.py`](backend/app/services/rag_service.py#L57):

```python
ChatGroq(..., temperature=0.2)  # More factual (0.0-0.4)
ChatGroq(..., temperature=0.7)  # More creative (0.5-1.0)
```

### Change Streaming Delay

Edit [`backend/app/routes/chat.py`](backend/app/routes/chat.py#L244):

```python
await asyncio.sleep(0.05)  # Slower: 0.1, Faster: 0.01
```

## Monitoring

View logs to monitor RAG system:

```bash
# Watch initializaton
tail -f logs/app.log | grep -i "rag\|indexing\|redis"

# Check vector DB stats
curl http://localhost:8000/api/v1/chat/stats | jq .

# Monitor chat requests
curl -H "Authorization: Bearer $TOKEN" \
     -X GET "http://localhost:8000/api/v1/chat/dashboard"
```

## Troubleshooting

### "Vector DB not initialized"
- Check if products exist in database
- Run: `POST /api/v1/chat/index-products`
- Verify VECTOR_DB_PATH directory is writable

### "Redis connection failed"
- Ensure Redis is running: `redis-cli ping`
- Check REDIS_URL in .env
- App will fallback to in-memory (non-persistent)

### "Embedding model download slow"
- First inference downloads full model (~400MB)
- Subsequent calls use cached model
- Can pre-download: `python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"`

### "LLM response slow"
- Groq API latency (check status page)
- Network issues to groq.com
- Try: `curl -X GET https://api.groq.com/openai/v1/models`

###  "Responses don't match products"
- Verify products are indexed: `GET /api/v1/chat/stats`
- Check embedding threshold in search: edit rag_service.py threshold parameter
- Clear old index: `rm ./data/vector_store/*`

## Production Checklist

- [ ] Redis running on persistent server
- [ ] FAISS index backed up daily
- [ ] GROQ_API_KEY never in source code
- [ ] Conversation memory TTL appropriate (7 days)
- [ ] Log aggregation set up (ELK/CloudWatch)
- [ ] Rate limiting on chat endpoints
- [ ] Monitoring for OOM (FAISS can be large)
- [ ] Backup/restore procedure tested

## Next Steps

- [x] Vector DB (FAISS) implementation
- [x] Redis conversation memory
- [x] LangChain orchestration
- [ ] Pinecone cloud integration
- [ ] Multi-user conversation threading
- [ ] Fine-tuning on domain products
- [ ] Streaming @ browser WebSocket
- [ ] Analytics & usage tracking
