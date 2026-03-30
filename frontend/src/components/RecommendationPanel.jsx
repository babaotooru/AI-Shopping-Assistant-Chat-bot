import { useState } from 'react';
import { chatService } from '../services';

export function RecommendationPanel() {
    const [product, setProduct] = useState('');
    const [recommendations, setRecommendations] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleGetRecommendations = async () => {
        if (!product.trim()) return;

        try {
            setLoading(true);
            setError(null);
            const response = await chatService.getRecommendations(product, 5);
            setRecommendations(response.recommendations?.[0]?.text || 'No recommendations found');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-2xl font-bold mb-4">🔮 Get Recommendations</h2>

            <div className="space-y-3 mb-6">
                <input
                    type="text"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleGetRecommendations()}
                    placeholder="Enter a product name (e.g., iPhone 15)"
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded px-4 py-2"
                />
                <button
                    onClick={handleGetRecommendations}
                    disabled={loading || !product.trim()}
                    className="w-full bg-purple-500 text-white py-2 rounded hover:bg-purple-600 disabled:opacity-50"
                >
                    {loading ? 'Generating...' : 'Get Recommendations'}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-100 text-red-700 rounded mb-4">
                    Error: {error}
                </div>
            )}

            {recommendations && (
                <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold mb-3">Recommendations for: {product}</h3>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                        {recommendations}
                    </div>
                </div>
            )}
        </div>
    );
}
