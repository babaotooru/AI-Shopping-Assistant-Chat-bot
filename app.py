import os 
import streamlit as st
from langchain_groq import ChatGroq
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain.chains import create_retrieval_chain
import groq
from langchain_core.documents import Document
import json
from langchain.chains.combine_documents import create_stuff_documents_chain
from apikey import *
from typing import List



os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY
os.environ["GROQ_API_KEY"] = GROQ_API_KEY

client = groq.Groq(api_key=GROQ_API_KEY)
st.title("E-Commerce Chat Aisstant")

llm = ChatGroq(groq_Api_key=GROQ_API_KEY,model_name="llama3-70b-8192")

prompt = ChatPromptTemplate.from_template('''You are E Commerce Orders Manager.You were given a set of orders that are placed by an user.
                                          As a order assist manager you will assist user to whatever questions are asked that are related to the 
                                          orders that the user has placed. If the asked question is not preesent in the content of the order,say that 
                                          the order does not exist or reply that the information is not listed in the orders
                                          <content>
                                          {ORDERS}
                                          </content>
                                          Questions:{question}''')

def create_documents_from_text(text):
    return [Document(page_content=text)]

def vector_embeddings(text):
    st.session_state.embeddings = GoogleGenerativeAIEmbeddings(model="models/embwedding-001")

    st.session_state.docs = create_documents_from_text(text)

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )

    st.session_state.final_documents = text_splitter.split_documents(st.session_state.docs)

    st.session_state.vectors = FAISS.from_documents(
        st.session_state.final_documents,
        st.session_state.embeddings
    )



def price_comparator(model1:str,model2:str) -> List[List[str]]:
    prompt_template = "Prompt Template Here"
    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role":"user",
                "content":prompt_template
            }
        ],
        model="llama3-70b-8192",
        temperature=0.5,
        max_tokens=2000
    )
    response_text = chat_completion.choices[0].message.content

    return response_text
    

ORDERS = json.loads('''[
  {
    "name": "Apple iPhone 15 Pro",
    "product_id": "AIP15P123",
    "category": "Electronics",
    "order_placed_date": "2025-02-20",
    "image_link": "https://example.com/iphone15pro.jpg",
    "expected_delivery_date": "2025-02-25",
    "rating": 4.8,
    "price": "$999"
  },
  {
    "name": "Samsung Galaxy S24 Ultra",
    "product_id": "SGS24U456",
    "category": "Electronics",
    "order_placed_date": "2025-02-18",
    "image_link": "https://example.com/galaxyS24Ultra.jpg",
    "expected_delivery_date": "2025-02-24",
    "rating": 4.7,
    "price": "$1199"
  },
  {
    "name": "Sony WH-1000XM5 Headphones",
    "product_id": "SWH1000XM5",
    "category": "Accessories",
    "order_placed_date": "2025-02-15",
    "image_link": "https://example.com/sonywh1000xm5.jpg",
    "expected_delivery_date": "2025-02-22",
    "rating": 4.6,
    "price": "$349"
  },
  {
    "name": "Dell XPS 15 Laptop",
    "product_id": "DXPS15L789",
    "category": "Computers",
    "order_placed_date": "2025-02-17",
    "image_link": "https://example.com/dellxps15.jpg",
    "expected_delivery_date": "2025-02-26",
    "rating": 4.7,
    "price": "$1499"
  },
  {
    "name": "Apple Watch Series 9",
    "product_id": "AW9S789",
    "category": "Wearables",
    "order_placed_date": "2025-02-21",
    "image_link": "https://example.com/applewatch9.jpg",
    "expected_delivery_date": "2025-02-27",
    "rating": 4.5,
    "price": "$399"
  },
  {
    "name": "Bose SoundLink Revolve+",
    "product_id": "BSR123",
    "category": "Audio",
    "order_placed_date": "2025-02-19",
    "image_link": "https://example.com/bosesoundlink.jpg",
    "expected_delivery_date": "2025-02-25",
    "rating": 4.6,
    "price": "$299"
  },
  {
    "name": "Nikon Z7 II Camera",
    "product_id": "NZ7II555",
    "category": "Cameras",
    "order_placed_date": "2025-02-16",
    "image_link": "https://example.com/nikonz7.jpg",
    "expected_delivery_date": "2025-02-23",
    "rating": 4.8,
    "price": "$2699"
  },
  {
    "name": "Sony PlayStation 5",
    "product_id": "PS5G999",
    "category": "Gaming",
    "order_placed_date": "2025-02-14",
    "image_link": "https://example.com/ps5.jpg",
    "expected_delivery_date": "2025-02-21",
    "rating": 4.9,
    "price": "$499"
  },
  {
    "name": "GoPro Hero 12 Black",
    "product_id": "GPH12B",
    "category": "Cameras",
    "order_placed_date": "2025-02-18",
    "image_link": "https://example.com/gopro12.jpg",
    "expected_delivery_date": "2025-02-24",
    "rating": 4.7,
    "price": "$399"
  },
  {
    "name": "Microsoft Surface Pro 9",
    "product_id": "MSP9L777",
    "category": "Computers",
    "order_placed_date": "2025-02-13",
    "image_link": "https://example.com/surfacepro9.jpg",
    "expected_delivery_date": "2025-02-22",
    "rating": 4.6,
    "price": "$1299"
  },
  {
    "name": "Logitech MX Master 3S Mouse",
    "product_id": "LMM3S",
    "category": "Accessories",
    "order_placed_date": "2025-02-20",
    "image_link": "https://example.com/mxmaster3.jpg",
    "expected_delivery_date": "2025-02-26",
    "rating": 4.7,
    "price": "$99"
  },
  {
    "name": "Samsung 49-Inch Odyssey G9 Monitor",
    "product_id": "SOG9M",
    "category": "Computers",
    "order_placed_date": "2025-02-12",
    "image_link": "https://example.com/samsungodyssey.jpg",
    "expected_delivery_date": "2025-02-20",
    "rating": 4.8,
    "price": "$1299"
  },
  {
    "name": "Kindle Paperwhite",
    "product_id": "KPW2025",
    "category": "Tablets",
    "order_placed_date": "2025-02-15",
    "image_link": "https://example.com/kindlepaperwhite.jpg",
    "expected_delivery_date": "2025-02-21",
    "rating": 4.7,
    "price": "$139"
  },
  {
    "name": "Razer BlackWidow V4 Pro Keyboard",
    "product_id": "RBV4P",
    "category": "Accessories",
    "order_placed_date": "2025-02-19",
    "image_link": "https://example.com/razerblackwidow.jpg",
    "expected_delivery_date": "2025-02-25",
    "rating": 4.5,
    "price": "$229"
  },
  {
    "name": "Fitbit Charge 6",
    "product_id": "FBC6",
    "category": "Wearables",
    "order_placed_date": "2025-02-18",
    "image_link": "https://example.com/fitbitcharge6.jpg",
    "expected_delivery_date": "2025-02-24",
    "rating": 4.6,
    "price": "$159"
  },
  {
    "name": "Anker Soundcore Liberty 4 Earbuds",
    "product_id": "ASL4E",
    "category": "Audio",
    "order_placed_date": "2025-02-14",
    "image_link": "https://example.com/ankersoundcore.jpg",
    "expected_delivery_date": "2025-02-20",
    "rating": 4.6,
    "price": "$149"
  },
  {
    "name": "LG C3 OLED 55-Inch TV",
    "product_id": "LGC3TV",
    "category": "Home Entertainment",
    "order_placed_date": "2025-02-10",
    "image_link": "https://example.com/lgc3oled.jpg",
    "expected_delivery_date": "2025-02-18",
    "rating": 4.9,
    "price": "$1499"
  },
  {
    "name": "Dyson V15 Detect Vacuum Cleaner",
    "product_id": "DV15D",
    "category": "Home Appliances",
    "order_placed_date": "2025-02-16",
    "image_link": "https://example.com/dysonv15.jpg",
    "expected_delivery_date": "2025-02-23",
    "rating": 4.8,
    "price": "$699"
  },
  {
    "name": "Instant Pot Duo 7-in-1",
    "product_id": "IPD7",
    "category": "Kitchen Appliances",
    "order_placed_date": "2025-02-17",
    "image_link": "https://example.com/instantpot.jpg",
    "expected_delivery_date": "2025-02-24",
    "rating": 4.7,
    "price": "$89"
  },
  {
    "name": "Eufy Security Cam 2 Pro",
    "product_id": "ESCP2",
    "category": "Smart Home",
    "order_placed_date": "2025-02-12",
    "image_link": "https://example.com/eufycam.jpg",
    "expected_delivery_date": "2025-02-19",
    "rating": 4.6,
    "price": "$199"
  }
]''')

def my_orders():
    st.title("My Orders")
    for order in ORDERS:
        st.image(order["image_link"], width=150)
        st.write(f"**{order['name']}**")
        st.write(f"Order ID: {order['product_id']}")
        st.write(f"Category: {order['category']}")
        st.write(f"Order Placed: {order['order_placed_date']}")
        st.write(f"Expected Delivery: {order['expected_delivery_date']}")
        st.write(f"Rating: {order['rating']} ⭐")
        st.write(f"Price: {order['price']}")
        st.markdown("---")
def order_assistant():
    if st.button("Process Orders"):
        vector_embeddings(ORDERS)
        if "vectors" in st.session_state:
            st.success("Orders processed Successfully")
    question = st.text_input("Ask your query regarding your orders")
    if question:
        if "vectors" not in st.session_state:
            st.warning("Please process the orders first")
        else:
            try:
                document_chain = create_stuff_documents_chain(llm,prompt)
                retriever = st.session_state.vectors.as_retriever()
                retrieval_chain = create_retrieval_chain(retriever,document_chain)

                response = retrieval_chain.invoke({'input':question})
                st.write(response["answer"]) 

            except Exception as e:
                st.error(str(e))

def recommedations(product:str) -> List[List[str]]:
    prompt_template = "Prompt Template"
    chat_completion = client.chat.completions.create(
        messages=[{
            "role":"user",
            "content":prompt_template
             }
        ],
        model = "llama3-70b-8192",
        temperature=0.5,
        max_tokens=2000
    )

    response = chat_completion.choices[0].message.content 

    return response

def main():
    pass




