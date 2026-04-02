import { useEffect, useState } from 'react';
import { healthService } from '../services';

export function HomePage() {
    const [apiStatus, setApiStatus] = useState(null);

    useEffect(() => {
        checkApiHealth();
    }, []);

    const checkApiHealth = async () => {
        try {
            const data = await healthService.check();
            setApiStatus(data);
        } catch (err) {
            setApiStatus({ status: 'error', message: err.message });
        }
    };

    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <section className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg p-5 sm:p-8 md:p-12 text-center shadow-sm">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Welcome to AI Shopping Assistant</h1>
                <p className="text-sm sm:text-lg md:text-xl mb-6 sm:mb-8">
                    Your intelligent companion for managing orders, getting recommendations, and comparing products
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
                    <a href="/orders" className="bg-white text-blue-700 px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-semibold hover:bg-slate-100">
                        View Orders
                    </a>
                    <a href="/chat" className="bg-white text-blue-700 px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg font-semibold hover:bg-slate-100">
                        Chat with AI
                    </a>
                </div>
            </section>

            {/* Features Section */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 hover:shadow-lg transition">
                    <div className="text-4xl mb-3">📦</div>
                    <h3 className="font-bold text-lg mb-2">View Orders</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">Manage and track all your orders in one place</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 hover:shadow-lg transition">
                    <div className="text-4xl mb-3">🤖</div>
                    <h3 className="font-bold text-lg mb-2">AI Assistant</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">Chat with AI to answer questions about your orders</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 hover:shadow-lg transition">
                    <div className="text-4xl mb-3">💡</div>
                    <h3 className="font-bold text-lg mb-2">Get Recommendations</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">Discover similar products based on your interests</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 hover:shadow-lg transition">
                    <div className="text-4xl mb-3">⚖️</div>
                    <h3 className="font-bold text-lg mb-2">Compare Products</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">Make informed decisions by comparing two products</p>
                </div>
            </section>

            {/* API Status */}
            <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
                <h2 className="text-xl sm:text-2xl font-bold mb-4">API Status</h2>
                {apiStatus ? (
                    <div className={`p-4 rounded ${apiStatus.status === 'healthy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        <p className="font-semibold">{apiStatus.status === 'healthy' ? '✅ API is Running' : '❌ API Error'}</p>
                        <p className="text-sm mt-1">{apiStatus.message || 'All systems operational'}</p>
                    </div>
                ) : (
                    <p>Checking API status...</p>
                )}
            </section>
        </div>
    );
}
