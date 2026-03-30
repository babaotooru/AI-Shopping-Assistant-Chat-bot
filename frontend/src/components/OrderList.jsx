import { useEffect, useState } from 'react';
import { orderService } from '../services';
import { useOrderStore } from '../store';

export function OrderList({ onOrderSelect }) {
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.map((order) => (
                    <div
                        key={order.product_id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:shadow-lg transition cursor-pointer"
                        onClick={() => onOrderSelect?.(order)}
                    >
                        {order.image_link && (
                            <img src={order.image_link} alt={order.name} className="w-full h-48 object-cover rounded mb-3" />
                        )}
                        <h3 className="font-semibold text-lg mb-2">{order.name}</h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm mb-2">ID: {order.product_id}</p>
                        <p className="text-sm mb-2 text-slate-700 dark:text-slate-200">Category: {order.category}</p>
                        <p className="text-lg font-bold text-blue-600">{order.price}</p>
                        <p className="text-yellow-500">Rating: {order.rating} ⭐</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Delivery: {order.expected_delivery_date}</p>
                    </div>
                ))}
            </div>

            {orders.length === 0 && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">No orders found</div>
            )}
        </div>
    );
}
