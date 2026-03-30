import { useState } from 'react';
import { chatService } from '../services';

export function ComparisonPanel() {
    const [product1, setProduct1] = useState('');
    const [product2, setProduct2] = useState('');
    const [comparison, setComparison] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleCompare = async () => {
        if (!product1.trim() || !product2.trim()) return;

        try {
            setLoading(true);
            setError(null);
            const response = await chatService.compareProducts(product1, product2);
            setComparison(response.comparison);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-2xl font-bold mb-4">⚖️ Product Comparison</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <input
                    type="text"
                    value={product1}
                    onChange={(e) => setProduct1(e.target.value)}
                    placeholder="Product 1 (e.g., iPhone 15)"
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded px-4 py-2"
                />
                <input
                    type="text"
                    value={product2}
                    onChange={(e) => setProduct2(e.target.value)}
                    placeholder="Product 2 (e.g., Samsung S24)"
                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded px-4 py-2"
                />
            </div>

            <button
                onClick={handleCompare}
                disabled={loading || !product1.trim() || !product2.trim()}
                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50 mb-6"
            >
                {loading ? 'Comparing...' : 'Compare Products'}
            </button>

            {error && (
                <div className="p-4 bg-red-100 text-red-700 rounded mb-4">
                    Error: {error}
                </div>
            )}

            {comparison && (
                <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold mb-3">{product1} vs {product2}</h3>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                        {comparison}
                    </div>
                </div>
            )}
        </div>
    );
}
