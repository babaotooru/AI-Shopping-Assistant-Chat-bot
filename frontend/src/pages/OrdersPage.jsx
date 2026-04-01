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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                    <OrderList onOrderSelect={setSelectedOrder} />
                </div>

                <div className="lg:col-span-1">
                    {selectedOrder && (
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden h-fit sticky top-20 shadow-lg">
                            {/* Product Image */}
                            <div className="relative bg-slate-100 dark:bg-slate-800 p-4">
                                {selectedOrder.image_link && (
                                    <img
                                        src={selectedOrder.image_link}
                                        alt={selectedOrder.name}
                                        className="w-full h-auto rounded-lg"
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://via.placeholder.com/400x400?text=No+Image';
                                        }}
                                    />
                                )}
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Category Badge */}
                                <div>
                                    <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-xs font-bold uppercase">
                                        {selectedOrder.category}
                                    </span>
                                </div>

                                {/* Title */}
                                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                    {selectedOrder.name}
                                </h2>

                                {/* Rating & Reviews */}
                                <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-1">
                                        <span className="text-2xl font-bold text-yellow-500">{selectedOrder.rating}</span>
                                        <span className="text-yellow-400 text-lg">★</span>
                                    </div>
                                    {selectedOrder.total_reviews && (
                                        <span className="text-sm text-slate-600 dark:text-slate-400">
                                            {Number(selectedOrder.total_reviews).toLocaleString()} reviews
                                        </span>
                                    )}
                                </div>

                                {/* Price Section */}
                                <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-slate-800 dark:to-slate-800 p-4 rounded-lg">
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Price</p>
                                    <div className="flex items-baseline gap-3">
                                        <p className="text-3xl font-bold text-orange-600 dark:text-orange-500">{selectedOrder.price}</p>
                                        {selectedOrder.original_price && selectedOrder.original_price !== selectedOrder.price && (
                                            <p className="text-lg line-through text-slate-500">{selectedOrder.original_price}</p>
                                        )}
                                    </div>
                                    {selectedOrder.discount_percentage && selectedOrder.discount_percentage > 0 && (
                                        <p className="text-sm text-green-700 dark:text-green-400 font-bold mt-2">Save {selectedOrder.discount_percentage}%</p>
                                    )}
                                </div>

                                {/* Delivery Info */}
                                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                                        ✓ Delivery by {selectedOrder.expected_delivery_date}
                                    </p>
                                </div>

                                {/* Details Grid */}
                                <div className="space-y-3 text-sm border-t border-b border-slate-200 dark:border-slate-700 py-4">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Product ID</span>
                                        <span className="font-mono text-slate-900 dark:text-slate-100">{selectedOrder.product_id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Order Date</span>
                                        <span className="text-slate-900 dark:text-slate-100">{selectedOrder.order_placed_date}</span>
                                    </div>
                                    {selectedOrder.purchased_last_month && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">Purchased Last Month</span>
                                            <span className="text-slate-900 dark:text-slate-100 font-bold text-green-700 dark:text-green-400">
                                                {Number(selectedOrder.purchased_last_month).toLocaleString()}+
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Badges & Coupons */}
                                <div className="space-y-2 text-sm">
                                    {selectedOrder.is_best_seller === 'Yes' && (
                                        <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 p-2 rounded flex items-center gap-2">
                                            <span>⭐</span>
                                            <span className="font-bold">Amazon's Choice - Best Seller</span>
                                        </div>
                                    )}
                                    {selectedOrder.has_coupon && selectedOrder.has_coupon !== 'No Coupon' && (
                                        <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 p-2 rounded flex items-center gap-2">
                                            <span>🏷️</span>
                                            <span className="font-bold">{selectedOrder.has_coupon}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-2 pt-3">
                                    {selectedOrder.product_page_url && (
                                        <a
                                            href={selectedOrder.product_page_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-center"
                                        >
                                            Buy Now on Amazon
                                        </a>
                                    )}
                                    <button className="w-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-bold py-2 px-4 rounded-lg transition-colors">
                                        ♥ Add to Wishlist
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
