"""
Vector Database service for semantic search using FAISS and sentence-transformers.
Handles product embeddings and similarity-based retrieval.
"""
import os
import json
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import faiss
from config import settings
import logging

logger = logging.getLogger(__name__)


class VectorDBService:
    """
    Vector database service using FAISS for semantic search.
    Manages product embeddings and retrieves relevant products by semantic similarity.
    """

    def __init__(self):
        """Initialize FAISS index; load embedding model lazily."""
        self.model_name = settings.EMBEDDING_MODEL
        self.db_path = Path(settings.VECTOR_DB_PATH)
        self.db_path.mkdir(parents=True, exist_ok=True)

        self.model = None
        self.embedding_dim = 384  # Default for all-MiniLM-L6-v2
        self.faiss_index = None
        self.products_metadata = []
        self.index_path = self.db_path / "products.index"
        self.metadata_path = self.db_path / "products_metadata.json"

        self._load_or_create_index()

    def _ensure_model(self) -> bool:
        """Load embedding model on first use."""
        if self.model is not None:
            return True

        try:
            logger.info(f"Loading embedding model: {self.model_name}")
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(self.model_name)
            self.embedding_dim = self.model.get_sentence_embedding_dimension()
            logger.info(f"✅ Embedding model loaded (dimension: {self.embedding_dim})")
            return True

        except Exception as e:
            logger.error(f"❌ Vector DB initialization failed: {str(e)}")
            self.model = None
            return False

    def _load_or_create_index(self) -> None:
        """Load existing FAISS index or create new one."""
        try:
            if self.index_path.exists() and self.metadata_path.exists():
                # Load existing index
                self.faiss_index = faiss.read_index(str(self.index_path))
                with open(self.metadata_path, 'r') as f:
                    self.products_metadata = json.load(f)
                logger.info(f"✅ Loaded existing FAISS index with {len(self.products_metadata)} products")
            else:
                # Create new index for cosine similarity
                self.faiss_index = faiss.IndexFlatIP(self.embedding_dim)
                self.products_metadata = []
                logger.info("✅ Created new FAISS index")
        except Exception as e:
            logger.error(f"Error loading/creating index: {str(e)}")
            raise

    def index_products(self, products: List[Dict[str, Any]]) -> bool:
        """
        Index products by creating embeddings and adding to FAISS.
        
        Args:
            products: List of product dictionaries with 'name', 'category', 'description'
        
        Returns:
            Success status
        """
        if not self._ensure_model() or not self.faiss_index:
            logger.error("Vector DB not initialized for indexing")
            return False

        try:
            logger.info(f"Indexing {len(products)} products...")

            # Create text representations for embedding
            product_texts = []
            for product in products:
                # Combine multiple fields for rich context
                name = str(product.get("name", "")).strip()
                category = str(product.get("category", "")).strip()
                rating = product.get("rating", 0)

                text = f"{name} {category} rating {rating}".strip()
                product_texts.append(text)

            # Generate embeddings (normalize for cosine similarity)
            embeddings = self.model.encode(product_texts, normalize_embeddings=True)
            embeddings = embeddings.astype("float32")

            # Add to FAISS index
            self.faiss_index.add(embeddings)

            # Store metadata
            self.products_metadata = [
                {
                    "product_id": prod.get("product_id", str(i)),
                    "name": prod.get("name", "Unknown"),
                    "category": prod.get("category", ""),
                    "rating": float(prod.get("rating", 0)),
                    "price": str(prod.get("price", "")),
                    "total_reviews": int(prod.get("total_reviews", 0)),
                    "image_link": prod.get("image_link", ""),
                    "product_page_url": prod.get("product_page_url", ""),
                }
                for i, prod in enumerate(products)
            ]

            # Save index and metadata
            faiss.write_index(self.faiss_index, str(self.index_path))
            with open(self.metadata_path, 'w') as f:
                json.dump(self.products_metadata, f, indent=2)

            logger.info(f"✅ Indexed {len(products)} products successfully")
            return True

        except Exception as e:
            logger.error(f"Error indexing products: {str(e)}")
            return False

    def search(
        self,
        query: str,
        top_k: int = 5,
        threshold: float = 0.3
    ) -> Tuple[List[Dict[str, Any]], List[float]]:
        """
        Semantic search for products similar to query.
        
        Args:
            query: User search query
            top_k: Number of results to return
            threshold: Minimum similarity score (0-1)
        
        Returns:
            Tuple of (products, similarity_scores)
        """
        if not self._ensure_model() or not self.faiss_index or not self.products_metadata:
            logger.warning("Vector DB not initialized for search")
            return [], []

        try:
            # Encode query (normalize for cosine similarity)
            query_embedding = self.model.encode(query, normalize_embeddings=True)
            query_embedding = np.array([query_embedding], dtype="float32")

            # Search FAISS index
            scores, indices = self.faiss_index.search(query_embedding, top_k)
            scores = scores[0]  # Get first result batch
            indices = indices[0]

            # Filter by threshold and format results
            results = []
            result_scores = []

            for score, idx in zip(scores, indices):
                if score >= threshold and 0 <= idx < len(self.products_metadata):
                    product = self.products_metadata[int(idx)].copy()
                    results.append(product)
                    result_scores.append(float(score))

            logger.info(f"Found {len(results)} products for query: '{query}'")
            return results, result_scores

        except Exception as e:
            logger.error(f"Error during semantic search: {str(e)}")
            return [], []

    def search_hybrid(
        self,
        query: str,
        all_products: List[Dict[str, Any]],
        semantic_weight: float = 0.6,
        keyword_weight: float = 0.4,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Hybrid search combining semantic + keyword matching.
        
        Args:
            query: Search query
            all_products: Complete product catalog for keyword fallback
            semantic_weight: Weight for semantic similarity (0-1)
            keyword_weight: Weight for keyword matching (0-1)
            top_k: Number of results
        
        Returns:
            Ranked list of products
        """
        try:
            # Semantic search
            semantic_results, semantic_scores = self.search(query, top_k=top_k * 2)
            semantic_map = {r["product_id"]: score for r, score in zip(semantic_results, semantic_scores)}

            # Keyword search
            query_terms = set(query.lower().split())
            keyword_scores = {}

            for product in all_products:
                product_id = product.get("product_id", "")
                name_lower = str(product.get("name", "")).lower()
                category_lower = str(product.get("category", "")).lower()

                # Calculate keyword match score
                score = 0
                for term in query_terms:
                    if term in name_lower:
                        score += 3
                    elif term in category_lower:
                        score += 1

                if score > 0:
                    keyword_scores[product_id] = score / (len(query_terms) * 3)

            # Combine scores
            combined_scores = {}
            all_ids = set(semantic_map.keys()) | set(keyword_scores.keys())

            for product_id in all_ids:
                sem_score = semantic_map.get(product_id, 0)
                kw_score = keyword_scores.get(product_id, 0)
                combined_scores[product_id] = (sem_score * semantic_weight) + (kw_score * keyword_weight)

            # Get top results by combined score
            sorted_ids = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]

            results = []
            for product_id, score in sorted_ids:
                # Find product in metadata or all_products
                product = next(
                    (p for p in (self.products_metadata + all_products) if p.get("product_id") == product_id),
                    None
                )
                if product:
                    product_copy = product.copy()
                    product_copy["relevance_score"] = float(score)
                    results.append(product_copy)

            return results[:top_k]

        except Exception as e:
            logger.error(f"Error in hybrid search: {str(e)}")
            return []

    def get_similar_products(
        self,
        product_id: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Find products similar to a given product.
        
        Args:
            product_id: Reference product ID
            top_k: Number of similar products
        
        Returns:
            List of similar products
        """
        try:
            # Find reference product
            ref_product = next(
                (p for p in self.products_metadata if p.get("product_id") == product_id),
                None
            )

            if not ref_product:
                logger.warning(f"Product {product_id} not found in index")
                return []

            # Search by product name to find similar items
            query = f"{ref_product['name']} {ref_product['category']}"
            results, scores = self.search(query, top_k=top_k + 1)

            # Filter out the reference product itself
            similar = [r for r in results if r.get("product_id") != product_id]

            return similar[:top_k]

        except Exception as e:
            logger.error(f"Error finding similar products: {str(e)}")
            return []

    def update_product_index(self, products: List[Dict[str, Any]]) -> bool:
        """
        Rebuild the product index with new data.
        
        Args:
            products: Updated product list
        
        Returns:
            Success status
        """
        try:
            # Clear existing index
            self.faiss_index = faiss.IndexFlatIP(self.embedding_dim)
            self.products_metadata = []

            # Re-index
            return self.index_products(products)
        except Exception as e:
            logger.error(f"Error updating index: {str(e)}")
            return False

    def get_index_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector index."""
        return {
            "total_products": len(self.products_metadata),
            "embedding_model": self.model_name,
            "embedding_dimension": self.embedding_dim,
            "index_type": "FAISS (IndexFlatIP - Cosine Similarity)",
            "index_size_mb": os.path.getsize(self.index_path) / (1024 * 1024) if self.index_path.exists() else 0,
        }


# Singleton instance
vector_db_service = VectorDBService()
