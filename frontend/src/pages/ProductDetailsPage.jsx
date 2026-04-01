import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderService } from '../services';

export function ProductDetailsPage() {
    const { productId } = useParams();
    const [product, setProduct] = useState(null);
    const [allProducts, setAllProducts] = useState([]);
    const [relatedCategory, setRelatedCategory] = useState('All');
    const [relatedPage, setRelatedPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const relatedPageSize = 6;

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await orderService.getOrder(productId);
                setProduct(data);

                const catalog = await orderService.getAllOrders(null, 0, 500);
                setAllProducts(Array.isArray(catalog.orders) ? catalog.orders : []);
            } catch (err) {
                setError(err.message || 'Failed to load product details');
            } finally {
                setLoading(false);
            }
        };

        if (productId) {
            fetchProduct();
        }
    }, [productId]);

    if (loading) {
        return <div className="text-center py-8 text-slate-700 dark:text-slate-300">Loading product details...</div>;
    }

    if (error || !product) {
        return (
            <div className="space-y-4">
                <Link to="/orders" className="text-blue-600 hover:underline">Back to products</Link>
                <div className="p-4 rounded border border-red-300 bg-red-50 text-red-700">
                    Error: {error || 'Product not found'}
                </div>
            </div>
        );
    }

    const relatedByCategory = allProducts.filter((item) => {
        if (!item || item.product_id === product.product_id) return false;
        if (relatedCategory === 'All') {
            return item.category === product.category;
        }
        return item.category === relatedCategory;
    });

    const sortedRelated = [...relatedByCategory].sort((a, b) => {
        const aScore = Number(a.rating || 0) * 1000 + Number(a.total_reviews || 0);
        const bScore = Number(b.rating || 0) * 1000 + Number(b.total_reviews || 0);
        return bScore - aScore;
    });

    const relatedTotalPages = Math.max(1, Math.ceil(sortedRelated.length / relatedPageSize));
    const normalizedRelatedPage = Math.min(relatedPage, relatedTotalPages);
    const pagedRelated = sortedRelated.slice((normalizedRelatedPage - 1) * relatedPageSize, normalizedRelatedPage * relatedPageSize);
    const relatedCategoryOptions = ['All', ...new Set(allProducts.map((p) => p.category).filter(Boolean))];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold">Product Details</h1>
                    <p className="text-slate-600 dark:text-slate-300">Complete Amazon sales data view for this product.</p>
                </div>
                <Link to="/orders" className="px-4 py-2 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
                    Back to products
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                        {product.image_link ? (
                            <img
                                src={product.image_link}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.src = 'https://via.placeholder.com/500x500?text=No+Image';
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>
                        )}
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                        {product.product_page_url && (
                            <a
                                href={product.product_page_url}
                                target="_blank"
                                rel="noreferrer"
                                className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg"
                            >
                                Open on Amazon
                            </a>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
                    <div>
                        <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">{product.category}</p>
                        <h2 className="text-2xl font-bold mt-1">{product.name}</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded border border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-500">Rating</p>
                            <p className="text-xl font-bold text-yellow-500">{product.rating} ★</p>
                        </div>
                        <div className="p-3 rounded border border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-500">Price</p>
                            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{product.price}</p>
                        </div>
                        <div className="p-3 rounded border border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-500">Reviews</p>
                            <p className="text-xl font-bold">{product.total_reviews ? Number(product.total_reviews).toLocaleString() : 'N/A'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <DetailRow label="Product ID" value={product.product_id} />
                        <DetailRow label="Order Placed" value={product.order_placed_date} />
                        <DetailRow label="Expected Delivery" value={product.expected_delivery_date} />
                        <DetailRow label="Original Price" value={product.original_price || 'N/A'} />
                        <DetailRow label="Discount %" value={product.discount_percentage ?? 'N/A'} />
                        <DetailRow label="Purchased Last Month" value={product.purchased_last_month ? Number(product.purchased_last_month).toLocaleString() : 'N/A'} />
                        <DetailRow label="Best Seller" value={product.is_best_seller || 'N/A'} />
                        <DetailRow label="Sponsored" value={product.is_sponsored || 'N/A'} />
                        <DetailRow label="Coupon" value={product.has_coupon || 'N/A'} />
                        <DetailRow label="Buy Box" value={product.buy_box_availability || 'N/A'} />
                        <DetailRow label="Sustainability" value={product.sustainability_tags || 'N/A'} />
                        <DetailRow label="Category" value={product.category || 'N/A'} />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h3 className="text-xl font-bold">Related Products</h3>
                    <p className="text-xs text-slate-500">{sortedRelated.length} products</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {relatedCategoryOptions.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => {
                                setRelatedCategory(cat);
                                setRelatedPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${relatedCategory === cat
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {pagedRelated.length > 0 ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pagedRelated.map((item) => (
                                <Link
                                    key={item.product_id}
                                    to={`/products/${encodeURIComponent(item.product_id)}`}
                                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:shadow-md transition"
                                >
                                    <p className="text-xs uppercase text-slate-500">{item.category}</p>
                                    <p className="font-semibold text-sm line-clamp-2 mt-1">{item.name}</p>
                                    <p className="text-xs mt-2 text-yellow-600">{item.rating} ★</p>
                                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">{item.price}</p>
                                    <p className="text-xs text-slate-500">{item.total_reviews ? Number(item.total_reviews).toLocaleString() : '0'} reviews</p>
                                </Link>
                            ))}
                        </div>

                        <div className="flex items-center justify-center gap-2">
                            <button
                                onClick={() => setRelatedPage((p) => Math.max(1, p - 1))}
                                disabled={normalizedRelatedPage === 1}
                                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                Page {normalizedRelatedPage} / {relatedTotalPages}
                            </span>
                            <button
                                onClick={() => setRelatedPage((p) => Math.min(relatedTotalPages, p + 1))}
                                disabled={normalizedRelatedPage >= relatedTotalPages}
                                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">No related products found for this filter.</p>
                )}
            </div>
        </div>
    );
}

function DetailRow({ label, value }) {
    return (
        <div className="p-3 rounded border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="font-semibold break-words">{String(value ?? 'N/A')}</p>
        </div>
    );
}
