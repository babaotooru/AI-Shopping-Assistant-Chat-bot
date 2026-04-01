# AI Shopping Assistant (FastAPI + React)

Production-style full-stack shopping assistant with:
- FastAPI backend APIs
- React frontend (Vite + Tailwind)
- Groq-powered assistant for order chat, recommendations, and comparison

## Project Structure
- backend: FastAPI app, routes, services, schemas
- frontend: React UI and API integration
- orders.json: sample order dataset

## Run Backend
```bash
cd backend
pip install -r requirements.txt
python run.py
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
- App: http://localhost:5173

## Environment Variables
Create a .env file in project root and set at least:
- GROQ_API_KEY
- GOOGLE_API_KEY (optional for current simplified flow)
- GROQ_MODEL (default: llama-3.3-70b-versatile)

Optional:
- ORDERS_FILE (absolute path override for orders dataset)
