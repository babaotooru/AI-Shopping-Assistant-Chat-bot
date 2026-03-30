# AI Shopping Assistant - Setup & Installation Guide

## 🎯 Quick Start

This is a professional full-stack e-commerce application. Follow these steps:

### Option 1: Complete Setup (Recommended)

#### Backend Setup
```bash
# 1. Navigate to backend
cd backend

# 2. Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run server
python main.py
```
✅ Backend running at: `http://localhost:8000`
📚 API Docs: `http://localhost:8000/api/docs`

#### Frontend Setup
```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev
```
✅ Frontend running at: `http://localhost:5173`

### Option 2: Run Only Backend (Current Setup)

Backend is already running at port 8000 with all features enabled.

## 🔑 Required API Keys

Make sure these are set in the .env file:
- ✅ GROQ_API_KEY
- ✅ GOOGLE_API_KEY

## 📍 Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Backend API | http://localhost:8000 | REST API server |
| API Documentation | http://localhost:8000/api/docs | Interactive API docs |
| Frontend | http://localhost:5173 | React web app |

## 🚀 Available Endpoints

### Health & Status
```
GET /api/v1/health        - API health check
GET /api/v1/              - Root endpoint
```

### Orders Management
```
GET    /api/v1/orders              - Get all orders
GET    /api/v1/orders/{id}         - Get specific order
POST   /api/v1/orders              - Create order
PUT    /api/v1/orders/{id}         - Update order
DELETE /api/v1/orders/{id}         - Delete order
GET    /api/v1/orders/categories   - Get categories
```

### AI Chat Features
```
POST /api/v1/chat/query        - Ask about orders
POST /api/v1/chat/recommend    - Get recommendations
POST /api/v1/chat/compare      - Compare products
POST /api/v1/chat/process-orders - Index orders for AI
```

## 📊 Project Features

✅ **Order Management**
- View all orders with images
- Filter by category
- Pagination support

✅ **AI Assistant**
- Natural language queries
- Semantic search via vector embeddings
- Powered by Groq Llama 3.3

✅ **Product Recommendations**
- AI-generated suggestions
- Customizable count

✅ **Product Comparison**
- Side-by-side analysis
- AI insights

## 🛠️ Tech Stack

**Backend**: FastAPI, Python, LangChain, Groq, PostgreSQL  
**Frontend**: React, Vite, Tailwind CSS, Zustand  
**Database**: Supabase (PostgreSQL)  
**AI/ML**: LangChain, FAISS, Google Generative AI

## 📁 Project Structure

```
.
├── backend/           # FastAPI server
├── frontend/          # React web app
├── orders.json        # Sample data
├── .env              # Configuration
└── FULL_STACK_README.md
```

## 🔍 Testing the API

Using curl:
```bash
# Health check
curl http://localhost:8000/api/v1/health

# Get all orders
curl http://localhost:8000/api/v1/orders

# Ask AI a question
curl -X POST http://localhost:8000/api/v1/chat/query \
  -H "Content-Type: application/json" \
  -d '{"question":"What is my most expensive order?"}'
```

## 🐛 Troubleshooting

**Issue**: `ModuleNotFoundError` in backend
**Fix**: Ensure virtual environment is activated and dependencies installed
```bash
pip install -r backend/requirements.txt
```

**Issue**: Frontend can't connect to API
**Fix**: Check VITE_API_URL in frontend/.env
```
VITE_API_URL=http://localhost:8000/api/v1
```

**Issue**: Missing API keys
**Fix**: Add to .env file
```
GROQ_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
```

## 📈 Next Steps

1. **Frontend**: Run `cd frontend && npm install && npm run dev`
2. **Testing**: Visit API docs at http://localhost:8000/api/docs
3. **Deployment**: Follow deployment section in FULL_STACK_README.md

## 💡 Pro Tips

- Use Swagger UI at `/api/docs` to test all endpoints
- Monitor logs in the terminal for debugging
- Backend auto-reloads on code changes
- Frontend uses hot module replacement (HMR)

---

**Status**: ✅ Production-Ready  
**Version**: 1.0.0
