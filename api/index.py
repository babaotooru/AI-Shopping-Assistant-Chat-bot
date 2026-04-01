from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


@app.get("/")
def home():
	return {"message": "AI Shopping Assistant Backend Running!"}


@app.get("/health")
def health():
	return {"status": "ok"}


# ---------------------------
# Request Models
# ---------------------------
class ChatRequest(BaseModel):
	query: str


class CompareRequest(BaseModel):
	product1: str
	product2: str


class RecommendRequest(BaseModel):
	product: str


# ---------------------------
# Chatbot API
# ---------------------------
@app.post("/chat")
def chat(req: ChatRequest):
	return {
		"user_query": req.query,
		"response": f"You asked: {req.query}. AI chatbot response will come here."
	}


# ---------------------------
# Recommendation API
# ---------------------------
@app.post("/recommend")
def recommend(req: RecommendRequest):
	return {
		"product": req.product,
		"recommendation": f"Recommended details for {req.product} will come here."
	}


# ---------------------------
# Comparison API
# ---------------------------
@app.post("/compare")
def compare(req: CompareRequest):
	return {
		"product1": req.product1,
		"product2": req.product2,
		"result": f"Comparison between {req.product1} and {req.product2} will come here."
	}
