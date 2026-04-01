import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderService } from '../services';
import { useOrderStore } from '../store';

export function OrderList({ onOrderSelect }) {
    const navigate = useNavigate();
    const { orders, loading, error, setOrders, setLoading, setError } = useOrderStore();
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        fetchOrders();
    }, [selectedCategory]);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const data = await orderService.getCategories();
            setCategories(data.categories || []);
        } catch (_err) {
            // Keep UI functional even if category endpoint fails.
            setCategories([]);
        }
    };

    const fetchOrders = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await orderService.getAllOrders(selectedCategory);
            setOrders(data.orders || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center py-8 text-slate-700 dark:text-slate-300">Loading orders...</div>;
    if (error) return <div className="text-red-600 py-8">Error: {error}</div>;

    return (
        <div className="space-y-4">
            <div className="flex gap-2 mb-4 flex-wrap">
                <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-4 py-2 rounded border transition ${!selectedCategory
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800'
                        }`}
                >
                    All
                </button>
                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded border transition ${selectedCategory === cat
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {orders.map((order) => (
                    <div
                        key={order.product_id}
                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden hover:shadow-2xl transition-all cursor-pointer transform hover:-translate-y-1 duration-300"
                        onClick={() => onOrderSelect?.(order)}
                    >
                        {/* Image Container */}
                        <div className="relative overflow-hidden bg-slate-100 dark:bg-slate-800 h-56">
                            {order.image_link && (
                                <img
                                    src={order.image_link}
                                    alt={order.name}
                                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                                    loading="lazy"
                                    onError={(e) => {
                                        e.currentTarget.src = 'https://via.placeholder.com/640x480?text=No+Image';
                                    }}
                                />
                            )}
                            {/* Discount Badge */}
                            {order.discount_percentage && order.discount_percentage > 0 && (
                                <div className="absolute top-3 right-3 bg-orange-500 text-white px-3 py-1 rounded-md font-bold text-sm">
                                    -{order.discount_percentage}%
                                </div>
                            )}
                            {/* Best Seller Badge */}
                            {order.is_best_seller === 'Yes' && (
                                <div className="absolute top-3 left-3 bg-amber-400 text-amber-900 px-2 py-1 rounded text-xs font-bold">
                                    ⭐ BESTSELLER
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="p-4">
                            {/* Category */}
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                {order.category}
                            </p>

                            {/* Title */}
                            <h3 className="font-semibold text-sm leading-5 text-slate-900 dark:text-slate-100 mb-3 line-clamp-2 h-10">
                                {order.name}
                            </h3>

                            {/* Rating Section */}
                            <div className="flex items-center gap-2 mb-3">
                                <div className="flex items-center">
                                    <span className="text-yellow-400 font-bold">{order.rating}</span>
                                    <span className="text-yellow-400 ml-1">★</span>
                                </div>
                                {order.total_reviews && (
                                    <span className="text-xs text-slate-600 dark:text-slate-400">({Number(order.total_reviews).toLocaleString()})</span>
                                )}
                            </div>

                            {/* Price Section */}
                            <div className="mb-3">
                                <div className="flex items-baseline gap-2">
                                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-500">{order.price}</p>
                                    {order.original_price && order.original_price !== order.price && (
                                        <p className="text-sm line-through text-slate-500">{order.original_price}</p>
                                    )}
                                </div>
                            </div>

                            {/* Delivery Info */}
                            <p className="text-xs text-green-700 dark:text-green-400 font-semibold mb-3">
                                ✓ Delivery by {order.expected_delivery_date}
                            </p>

                            {/* CTA Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (order.product_id) {
                                        navigate(`/products/${encodeURIComponent(order.product_id)}`);
                                    }
                                }}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                            >
                                View Details
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {orders.length === 0 && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">No orders found</div>
            )}
        </div>
    );
}
