# AI Shopping Assistant - Full Stack Application

## 📋 Project Overview

AI Shopping Assistant is an enterprise-level, full-stack e-commerce application featuring:
- **Backend API**: FastAPI with Python LLM integration
- **Frontend**: Modern React with Tailwind CSS
- **AI Features**: Order assistant, product recommendations, product comparison
- **Database**: Supabase (PostgreSQL)
- **LLM**: Groq API (Llama 3.3) + Google Generative AI

## 🏗️ Project Structure

```
AI-Shopping-Assistant-Chat-bot/
├── backend/
│   ├── app/
│   │   ├── routes/              # API endpoints
│   │   │   ├── __init__.py
│   │   │   ├── health.py       # Health check endpoint
│   │   │   ├── orders.py       # Order management endpoints
│   │   │   └── chat.py         # AI chat endpoints
│   │   ├── services/            # Business logic
│   │   │   ├── ai_service.py   # LLM operations
│   │   │   └── order_service.py # Order management
│   │   ├── schemas/             # Pydantic models
│   │   │   ├── order.py
│   │   │   ├── chat.py
│   │   │   └── user.py
│   │   ├── models/              # Database models
│   │   └── utils/               # Utilities
│   │       └── auth.py         # JWT authentication
│   ├── config.py               # Configuration management
│   ├── main.py                 # FastAPI application
│   ├── requirements.txt        # Python dependencies
│   └── .env                    # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── Navigation.jsx
│   │   │   ├── OrderList.jsx
│   │   │   ├── ChatBox.jsx
│   │   │   ├── RecommendationPanel.jsx
│   │   │   └── ComparisonPanel.jsx
│   │   ├── pages/              # Page components
│   │   │   ├── HomePage.jsx
│   │   │   ├── OrdersPage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   ├── RecommendationsPage.jsx
│   │   │   └── ComparePage.jsx
│   │   ├── services/           # API integration
│   │   │   ├── api.js
│   │   │   └── index.js
│   │   ├── store/              # State management (Zustand)
│   │   │   └── index.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── App.css
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── index.html
│
├── orders.json                 # Sample data
├── users.json                  # Sample users
├── .env                        # Environment variables
├── .gitignore
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 16+
- npm or yarn
- API Keys: Groq, Google Generative AI

### Backend Setup

1. **Navigate to backend**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**
   ```bash
   cp ../.env .env
   # Update .env with your API keys
   ```

5. **Run backend server**
   ```bash
   python main.py
   # OR with uvicorn
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   Backend will be available at `http://localhost:8000`
   API Documentation: `http://localhost:8000/api/docs`

### Frontend Setup

1. **Navigate to frontend**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env.local
   # Configure VITE_API_URL if needed
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

   Frontend will be available at `http://localhost:5173`

## 📚 API Endpoints

### Health Check
- `GET /api/v1/health` - Check API status

### Orders
- `GET /api/v1/orders` - Get all orders (with pagination and filtering)
- `GET /api/v1/orders/{product_id}` - Get specific order
- `POST /api/v1/orders` - Create new order
- `PUT /api/v1/orders/{product_id}` - Update order
- `DELETE /api/v1/orders/{product_id}` - Delete order
- `GET /api/v1/orders/categories/list` - Get all categories

### Chat/AI
- `POST /api/v1/chat/query` - Query about orders
- `POST /api/v1/chat/recommend` - Get product recommendations
- `POST /api/v1/chat/compare` - Compare two products
- `POST /api/v1/chat/process-orders` - Process orders for AI

## 🔑 Environment Variables

Create a `.env` file in the project root:

```env
# App Configuration
APP_NAME=AI Shopping Assistant
APP_ENV=development

# LLM APIs
GROQ_API_KEY=your_groq_api_key
GOOGLE_API_KEY=your_google_api_key
GROQ_MODEL=llama-3.3-70b-versatile

# Database (Supabase)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_DB_URL=your_database_url

# Security
JWT_SECRET_KEY=your_jwt_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRY_MINUTES=120
```

## 📦 Core Features

### 1. Order Management
- View all orders with filtering and pagination
- Display order details with images
- Add, update, delete orders
- Filter by category

### 2. AI Order Assistant
- Natural language queries about orders
- Semantic search using vector embeddings
- Powered by Groq Llama 3.3 model

### 3. Product Recommendations
- Get AI-powered product suggestions
- Customizable number of recommendations
- Based on product characteristics

### 4. Product Comparison
- Compare two products side-by-side
- AI-generated analysis
- Pros, cons, and recommendations

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│        - Navigation                                      │
│        - Order Management UI                             │
│        - Chat Interface                                  │
│        - Recommendations & Comparison                    │
└────────────────────┬────────────────────────────────────┘
                     │ (HTTP/REST API)
┌────────────────────▼────────────────────────────────────┐
│              Backend (FastAPI)                           │
│   ┌─────────────────────────────────────────────────┐   │
│   │              API Routes                         │   │
│   │  - /orders (CRUD operations)                   │   │
│   │  - /chat (AI queries)                          │   │
│   │  - /health (status check)                      │   │
│   └─────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────┐   │
│   │           Business Logic (Services)             │   │
│   │  - AIService (LLM operations)                  │   │
│   │  - OrderService (data management)              │   │
│   └─────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────┐   │
│   │          External Integrations                  │   │
│   │  - Groq API (LLM)                              │   │
│   │  - Google Generative AI (Embeddings)           │   │
│   │  - FAISS (Vector Store)                        │   │
│   │  - Supabase (Database)                         │   │
│   └─────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Data Layer                                  │
│  - orders.json (local storage)                          │
│  - Supabase PostgreSQL (future)                         │
└─────────────────────────────────────────────────────────┘
```

## 🔐 Security Features

- JWT-based authentication
- CORS middleware for API security
- Environment-based configuration
- Input validation with Pydantic
- Error handling and logging

## 📊 Technologies Used

**Backend:**
- FastAPI - Modern web framework
- Pydantic - Data validation
- LangChain - LLM framework
- Groq - LLM API
- Google Generative AI - Embeddings
- FAISS - Vector store
- JWT - Authentication

**Frontend:**
- React 18 - UI framework
- React Router - Navigation
- Zustand - State management
- Axios - HTTP client
- Tailwind CSS - Styling
- Vite - Build tool

**Database:**
- Supabase - PostgreSQL hosting

## 🚢 Deployment

### Backend Deployment (Heroku/Railway/Render)
```bash
# Create Procfile
echo "web: uvicorn main:app --host 0.0.0.0 --port $PORT" > Procfile

# Deploy
git push heroku main
```

### Frontend Deployment (Vercel/Netlify)
```bash
npm run build
# Deploy dist/ folder to Vercel or Netlify
```

## 📈 Scaling Considerations

1. **Database**: Migrate from JSON to Supabase
2. **Caching**: Add Redis for frequent queries
3. **Load Balancing**: Use reverse proxy (Nginx)
4. **Async Tasks**: Implement Celery for background jobs
5. **API Rate Limiting**: Add rate limiting middleware
6. **Monitoring**: Implement logging and monitoring

## 🧪 Testing

```bash
# Backend testing
pytest backend/tests/

# Frontend testing
npm run test
```

## 📝 API Documentation

Visit `http://localhost:8000/api/docs` for interactive Swagger documentation.

## 🤝 Contributing

1. Create feature branch
2. Commit changes
3. Push to branch
4. Create Pull Request

## 📄 License

MIT License

## 📞 Support

For issues or questions, please create an issue in the repository.

---

**Version**: 1.0.0  
**Last Updated**: March 2026
