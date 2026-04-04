# AI Shopping Assistant (FastAPI + React)

Production-style full-stack shopping assistant with:
- FastAPI backend APIs
- React frontend (Vite + Tailwind)
- Groq-powered RAG assistant for order chat, recommendations, and comparison
- FAISS vector search + sentence-transformer embeddings
- Redis conversation memory (with in-memory fallback)

## Project Structure
- backend: FastAPI app, routes, services, schemas
- frontend: React UI and API integration
- orders.json: sample order dataset

## Run Redis (Required for persistent chat memory)
```bash
docker run -d --name redis-container -p 6379:6379 redis:latest redis-server
```

If the container already exists:
```bash
docker start redis-container
```

## Run Backend
```bash
cd backend
pip install -r requirements.txt
python run.py
```

Alternative from project root:
```bash
e:/Desktop/AI-Shopping-Assistant-Chat-bot/.venv/Scripts/python.exe backend/main.py
```

Backend URLs:
- API: http://localhost:8000
- Swagger: http://localhost:8000/api/docs

## Run Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend URL:
- App: http://localhost:5173 (or next available Vite port like 5174)

## Environment Variables
Create a `.env` file in project root with backend settings:
- JWT_SECRET_KEY
- JWT_ALGORITHM (default: HS256)
- ACCESS_TOKEN_EXPIRY_MINUTES (default: 120)
- GROQ_API_KEY (optional if Ollama is enabled)
- GROQ_MODEL (default: llama3-70b-8192)
- USE_OLLAMA (default: true)
- OLLAMA_BASE_URL (default: http://127.0.0.1:11434)
- OLLAMA_MODEL (default: llama3.1:8b)
- VECTOR_DB_TYPE (default: faiss)
- VECTOR_DB_PATH (default: ./data/vector_store)
- EMBEDDING_MODEL (default: sentence-transformers/all-MiniLM-L6-v2)
- REDIS_URL (default: redis://localhost:6379/0)
- SUPABASE_URL
- SUPABASE_ANON_KEY (publishable key)
- SUPABASE_SERVICE_ROLE_KEY (required for direct confirmed email signup and reliable profile/audit writes)
- USE_SUPABASE=true

Create a `frontend/.env` file with frontend settings:
- VITE_API_URL=http://localhost:8000/api/v1
- VITE_SUPABASE_URL=<your-supabase-project-url>
- VITE_SUPABASE_ANON_KEY=<your-supabase-publishable-key>

Google login setup:
- In Supabase dashboard, enable Google provider under Authentication -> Providers.
- In Google Cloud Console, add this Authorized redirect URI exactly: `https://ivlmvggpswfwtjzvbave.supabase.co/auth/v1/callback`
- This app uses hash routing under the `/frontend/` base, so your app redirect URLs should look like `http://localhost:5173/frontend/#/login` and `http://localhost:5173/frontend/#/signup` in local development (also add 5174 if Vite starts there).
- If you deploy to Vercel or another host, add the matching `/frontend/#/login` and `/frontend/#/signup` URLs there too.

Google login troubleshooting (PKCE):
- If you see "Code verifier expired", click Continue with Google again to restart a fresh PKCE flow.
- Avoid opening the OAuth popup in one browser profile and returning in another, because PKCE verifier storage is browser-local.
- Ensure frontend uses the same exact origin for login and callback (for example both on `http://localhost:5173` or both on `http://localhost:5174`).

Email signup setup:
- Set `SUPABASE_SERVICE_ROLE_KEY` to your Supabase service-role key in the backend `.env`.
- The email signup flow stores the password hash in the `profiles` table and logs the user in immediately, so no confirmation mail is sent.
- Run `SUPABASE_AUTH_SETUP.sql` in Supabase so it adds `password_hash` and drops legacy `profiles_id_fkey` if it exists.

Optional:
- ORDERS_FILE (absolute path override for orders dataset)
