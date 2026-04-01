import { ComparisonPanel } from '../components/ComparisonPanel';

export function ComparePage() {
    return (
        <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-r from-emerald-100 via-teal-100 to-cyan-100 dark:from-slate-900 dark:via-slate-900 dark:to-teal-950 p-6 md:p-8">
                <div className="absolute -top-12 -left-10 w-40 h-40 rounded-full bg-emerald-300/40 blur-2xl" />
                <div className="absolute -bottom-12 -right-8 w-36 h-36 rounded-full bg-cyan-300/30 blur-2xl" />
                <h1 className="relative text-3xl md:text-4xl font-black mb-2 tracking-tight">Compare Products Side By Side</h1>
                <p className="relative text-slate-700 dark:text-slate-300">Use exact or closest matches from the catalog and view strengths instantly.</p>
            </div>

            <ComparisonPanel />
        </div>
    );
}
