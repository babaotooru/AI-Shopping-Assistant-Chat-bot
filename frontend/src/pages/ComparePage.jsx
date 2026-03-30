import { ComparisonPanel } from '../components/ComparisonPanel';

export function ComparePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-4xl font-bold mb-2">⚖️ Product Comparison</h1>
                <p className="text-slate-600 dark:text-slate-300">Compare two products side by side with AI insights</p>
            </div>

            <ComparisonPanel />
        </div>
    );
}
