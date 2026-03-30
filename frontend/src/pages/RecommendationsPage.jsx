import { RecommendationPanel } from '../components/RecommendationPanel';

export function RecommendationsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-4xl font-bold mb-2">💡 Product Recommendations</h1>
                <p className="text-slate-600 dark:text-slate-300">Get AI-powered product recommendations</p>
            </div>

            <RecommendationPanel />
        </div>
    );
}
