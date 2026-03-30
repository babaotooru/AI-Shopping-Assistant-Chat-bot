import { OrderList } from '../components/OrderList';
import { useState } from 'react';

export function OrdersPage() {
    const [selectedOrder, setSelectedOrder] = useState(null);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold mb-2">📦 My Orders</h1>
                <p className="text-slate-600 dark:text-slate-300">Manage and track all your orders</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <OrderList onOrderSelect={setSelectedOrder} />
                </div>

                {selectedOrder && (
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 h-fit sticky top-20">
                        <h2 className="text-2xl font-bold mb-4">Order Details</h2>
                        <div className="space-y-4">
                            {selectedOrder.image_link && (
                                <img src={selectedOrder.image_link} alt={selectedOrder.name} className="w-full rounded" />
                            )}
                            <div>
                                <p className="text-slate-600 dark:text-slate-300 text-sm">Product Name</p>
                                <p className="font-bold text-lg">{selectedOrder.name}</p>
                            </div>
                            <div>
                                <p className="text-slate-600 dark:text-slate-300 text-sm">Product ID</p>
                                <p className="font-mono text-sm">{selectedOrder.product_id}</p>
                            </div>
                            <div>
                                <p className="text-slate-600 dark:text-slate-300 text-sm">Category</p>
                                <p className="font-medium">{selectedOrder.category}</p>
                            </div>
                            <div>
                                <p className="text-slate-600 dark:text-slate-300 text-sm">Price</p>
                                <p className="text-2xl font-bold text-blue-600">{selectedOrder.price}</p>
                            </div>
                            <div>
                                <p className="text-slate-600 dark:text-slate-300 text-sm">Rating</p>
                                <p className="text-lg">{selectedOrder.rating} ⭐</p>
                            </div>
                            <div>
                                <p className="text-slate-600 dark:text-slate-300 text-sm">Order Date</p>
                                <p>{selectedOrder.order_placed_date}</p>
                            </div>
                            <div>
                                <p className="text-slate-600 dark:text-slate-300 text-sm">Expected Delivery</p>
                                <p>{selectedOrder.expected_delivery_date}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
