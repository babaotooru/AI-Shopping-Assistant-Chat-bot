import os
import json
import streamlit as st
from streamlit_lottie import st_lottie
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.documents import Document
from langchain_groq import ChatGroq
import groq
from streamlit_option_menu import option_menu
import requests

# ✅ Load API keys securely from environment
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GOOGLE_API_KEY or not GROQ_API_KEY:
    st.error("🚨 Missing API keys. Please set GOOGLE_API_KEY and GROQ_API_KEY in your environment.")
    st.stop()

# Set environment vars for SDKs
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY
os.environ["GROQ_API_KEY"] = GROQ_API_KEY

client = groq.Groq(api_key=GROQ_API_KEY)

# 🛍️ Load orders data
ORDERS = open("orders.json", encoding="utf-8").read() if os.path.exists("orders.json") else "[]"

# 🎞️ Helper to load Lottie animations
def load_lottie_url(url: str):
    r = requests.get(url)
    if r.status_code != 200:
        return None
    return r.json()

# Lottie Animations
lottie_order = load_lottie_url("https://assets3.lottiefiles.com/packages/lf20_qh5z2fdq.json")
lottie_chat = load_lottie_url("https://assets10.lottiefiles.com/packages/lf20_u4yrau.json")
lottie_recommend = load_lottie_url("https://assets2.lottiefiles.com/packages/lf20_touohxv0.json")
lottie_compare = load_lottie_url("https://assets9.lottiefiles.com/private_files/lf30_LOw4AL.json")

# --- Embeddings + Vector creation ---
def create_documents_from_text(text):
    return [Document(page_content=text)]

def vector_embeddings(text):
    st.session_state.embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
    st.session_state.docs = create_documents_from_text(text)
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    st.session_state.final_documents = text_splitter.split_documents(st.session_state.docs)
    st.session_state.vectors = FAISS.from_documents(st.session_state.final_documents, st.session_state.embeddings)

# --- My Orders Page ---
def my_orders():
    st.title("📦 My Orders")
    st_lottie(lottie_order, height=200)
    orders_list = json.loads(ORDERS)
    for order in orders_list:
        with st.container():
            cols = st.columns([1, 3])
            with cols[0]:
                try:
                    st.image(order["image_link"], width=150)
                except:
                    st.warning("Image not loaded.")
            with cols[1]:
                st.markdown(f"### {order['name']}")
                st.markdown(f"**Order ID:** {order['product_id']}")
                st.markdown(f"**Category:** {order['category']}")
                st.markdown(f"**Order Date:** {order['order_placed_date']}")
                st.markdown(f"**Expected Delivery:** {order['expected_delivery_date']}")
                st.markdown(f"**Rating:** {order['rating']} ⭐")
                st.markdown(f"**Price:** {order['price']}")
        st.markdown("---")

# --- Order Assistant ---
def order_assistant():
    st.title("🤖 Order Assistant")
    st_lottie(lottie_chat, height=200)
    llm = ChatGroq(groq_api_key=GROQ_API_KEY, model_name="llama3-70b-8192")
    prompt = ChatPromptTemplate.from_template('''
        You are an Order Assistant AI. Based on the user's orders, answer queries related to placed orders.
        If the query is not covered in the orders data, respond appropriately.
        <content>=={context}</content>
        Question: {input}
    ''')

    if st.button("🧠 Process Orders"):
        vector_embeddings(ORDERS)
        st.success("Orders processed successfully.")

    question = st.text_input("Ask anything about your orders:")
    if question:
        if "vectors" not in st.session_state:
            st.warning("Please process orders first.")
        else:
            try:
                document_chain = create_stuff_documents_chain(llm, prompt)
                retriever = st.session_state.vectors.as_retriever()
                retrieval_chain = create_retrieval_chain(retriever, document_chain)
                response = retrieval_chain.invoke({"input": question})
                st.markdown(f"**Answer:** {response['answer']}")
            except Exception as e:
                st.error(f"Error: {str(e)}")

# --- Recommendations ---
def recommendations(product: str) -> str:
    prompt = f"""
    Suggest 5 products similar to {product} with:
    - Name
    - Description
    - Price range
    - Key features
    Format as a bulleted list.
    """
    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama3-70b-8192",
            temperature=0.5,
            max_tokens=2000
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        return f"Error generating recommendations: {str(e)}"

# --- Comparison ---
def price_comparator(model1: str, model2: str) -> str:
    if not model1 or not model2:
        return "Please enter both product names."
    prompt = f"""
    Compare {model1} vs {model2} based on:
    - Price
    - Features
    - Performance
    - Pros & Cons
    - Value for money
    Conclude with a recommendation.
    """
    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama3-70b-8192",
            temperature=0.5,
            max_tokens=2000
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        return f"Error: {str(e)}"

# --- Main ---
def main():
    st.set_page_config(page_title="E-Commerce AI Assistant", layout="wide")
    with st.sidebar:
        choice = option_menu(
            "Navigation",
            ["Home", "My Orders", "Recommendations", "Comparison"],
            icons=["house-door-fill", "box-seam-fill", "stars", "bar-chart-steps"],
            menu_icon="cast",
            default_index=0,
            styles={
                "container": {"background-color": "#1c1e26", "border-radius": "10px"},
                "icon": {"color": "#c4b5fd", "font-size": "18px"},
                "nav-link-selected": {"background-color": "#2c2f3a", "color": "white"},
            },
        )
    if choice == "Home":
        order_assistant()
    elif choice == "My Orders":
        my_orders()
    elif choice == "Recommendations":
        st.title("🔮 Recommendations")
        st_lottie(lottie_recommend, height=180)
        product = st.text_input("Enter a product name:")
        if product:
            with st.spinner("Generating recommendations..."):
                st.markdown(recommendations(product))
    elif choice == "Comparison":
        st.title("⚖️ Product Comparison")
        st_lottie(lottie_compare, height=180)
        col1, col2 = st.columns(2)
        with col1:
            model1 = st.text_input("Enter product 1")
        with col2:
            model2 = st.text_input("Enter product 2")
        if model1 and model2:
            with st.spinner("Comparing products..."):
                st.markdown(price_comparator(model1, model2))

if __name__ == "__main__":
    main()
