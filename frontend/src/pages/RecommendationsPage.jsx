import { RecommendationPanel } from '../components/RecommendationPanel';

export function RecommendationsPage() {
    return (
        <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl border border-sky-200/60 dark:border-sky-900/40 bg-gradient-to-r from-sky-100 via-cyan-100 to-blue-100 dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950 p-6 md:p-8">
                <div className="absolute -top-12 -right-10 w-40 h-40 rounded-full bg-cyan-300/40 blur-2xl" />
                <div className="absolute -bottom-12 -left-8 w-36 h-36 rounded-full bg-blue-300/30 blur-2xl" />
                <h1 className="relative text-3xl md:text-4xl font-black mb-2 tracking-tight">Recommendation Engine</h1>
                <p className="relative text-slate-700 dark:text-slate-300">Discover similar products from your sales dataset with precise, explainable matching.</p>
            </div>

            <RecommendationPanel />
        </div>
    );
}
