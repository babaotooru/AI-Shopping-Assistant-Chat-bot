import { Link } from 'react-router-dom';

function GoogleLogo() {
    return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path fill="#4285F4" d="M21.35 11.1H12v3.9h5.37c-.23 1.3-.96 2.4-2.06 3.14v2.61h3.32c1.94-1.79 3.06-4.44 3.06-7.58 0-.73-.07-1.42-.18-2.07z" />
            <path fill="#34A853" d="M12 22c2.76 0 5.07-.91 6.76-2.46l-3.32-2.61c-.92.62-2.1.99-3.44.99-2.64 0-4.88-1.78-5.68-4.18H2.89v2.69A10 10 0 0 0 12 22z" />
            <path fill="#FBBC05" d="M6.32 13.74A6 6 0 0 1 6 12c0-.61.1-1.2.27-1.74V7.57H2.89A10 10 0 0 0 2 12c0 1.61.38 3.13 1 4.43l3.32-2.69z" />
            <path fill="#EA4335" d="M12 5.98c1.5 0 2.84.52 3.9 1.53l2.92-2.92C17.05 2.91 14.76 2 12 2A10 10 0 0 0 2.89 7.57l3.43 2.69C7.12 7.76 9.36 5.98 12 5.98z" />
        </svg>
    );
}

function SocialButton({ label, children, onClick, className = '', disabled = false }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            aria-label={label}
        >
            {children}
        </button>
    );
}

export function AuthShell({
    eyebrow,
    title,
    description,
    primaryActionLabel,
    primaryActionLoadingLabel,
    primaryActionBusy = false,
    primaryAction,
    secondaryLinkLabel,
    secondaryLinkTo,
    footerText,
    footerLinkLabel,
    footerLinkTo,
    children,
    error,
    onGoogle,
    googleLoading,
}) {
    return (
        <div className="min-h-screen bg-[#f5f8ff] text-slate-900">
            <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <section className="flex flex-col justify-between px-5 py-6 sm:px-8 lg:px-12 xl:px-16">
                    <div className="flex items-center gap-3 text-slate-900">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100">
                            <span className="text-lg font-black">B</span>
                        </div>
                        <div>
                            <div className="text-[22px] font-black tracking-tight">AI Shopping Assistant</div>
                            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Smart Shopping Assistant</div>
                        </div>
                    </div>

                    <div className="mx-auto w-full max-w-md py-8 sm:py-12 lg:py-16">
                        <div className="mb-10">
                            <p className="text-sm font-medium text-slate-500">{eyebrow}</p>
                            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
                            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
                        </div>

                        <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-7">
                            {children}

                            {error ? (
                                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {error}
                                </div>
                            ) : null}

                            <button
                                type="button"
                                onClick={primaryAction}
                                disabled={primaryActionBusy}
                                className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.3)] transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {primaryActionBusy ? primaryActionLoadingLabel || primaryActionLabel : primaryActionLabel}
                            </button>

                            {secondaryLinkLabel && secondaryLinkTo ? (
                                <Link
                                    to={secondaryLinkTo}
                                    className="mt-5 block text-center text-sm font-medium text-blue-600 transition hover:text-blue-700"
                                >
                                    {secondaryLinkLabel}
                                </Link>
                            ) : null}

                            <div className="relative my-7">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200" />
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="bg-white px-3 text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                                        or continue with
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
                                <SocialButton
                                    label="Continue with Google"
                                    onClick={onGoogle}
                                    disabled={googleLoading}
                                    className="h-12 w-full gap-3 px-4 sm:w-auto sm:min-w-[220px]"
                                >
                                    <GoogleLogo />
                                    <span className="text-sm font-semibold text-slate-700">Continue with Google</span>
                                </SocialButton>
                            </div>

                            {footerText && footerLinkLabel && footerLinkTo ? (
                                <p className="mt-8 text-center text-sm text-slate-500">
                                    {footerText} {' '}
                                    <Link to={footerLinkTo} className="font-semibold text-blue-600 hover:text-blue-700">
                                        {footerLinkLabel}
                                    </Link>
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <div className="text-xs text-slate-400">Built for order insights, comparisons, and fast shopping support.</div>
                </section>

                <aside className="relative hidden overflow-hidden bg-gradient-to-br from-sky-100 via-indigo-100 to-pink-100 lg:block">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.9),transparent_28%),radial-gradient(circle_at_75%_30%,rgba(255,255,255,0.7),transparent_24%),radial-gradient(circle_at_55%_70%,rgba(37,99,235,0.25),transparent_28%)]" />
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(59,130,246,0.16),rgba(236,72,153,0.14))]" />

                    <div className="relative flex h-full flex-col justify-between p-8 xl:p-12">
                        <div className="self-end rounded-full bg-white/35 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-700 backdrop-blur">
                            Order Intelligence
                        </div>

                        <div className="space-y-5">
                            <div className="max-w-md rounded-[32px] border border-white/50 bg-white/35 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Analyze faster</p>
                                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Track, compare, and chat like a product expert.</h2>
                                <p className="mt-4 text-sm leading-6 text-slate-700">
                                    Explore orders, get recommendations, and compare products with a clean experience that feels fast on desktop and mobile.
                                </p>
                            </div>

                            <div className="grid max-w-md grid-cols-3 gap-3">
                                {[
                                    { label: 'Insights', value: '24/7' },
                                    { label: 'Orders', value: 'Live' },
                                    { label: 'Compare', value: 'Smart' },
                                ].map((item) => (
                                    <div key={item.label} className="rounded-3xl border border-white/50 bg-white/40 p-4 text-center shadow-lg backdrop-blur">
                                        <div className="text-lg font-black text-slate-900">{item.value}</div>
                                        <div className="mt-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{item.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 self-start rounded-[28px] border border-white/40 bg-white/35 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.1)] backdrop-blur-xl">
                            <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600" />
                                <div>
                                    <div className="text-sm font-bold text-slate-900">Secure sign-in</div>
                                    <div className="text-xs text-slate-600">Supabase auth + profile sync</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                <span className="rounded-full bg-white/60 px-3 py-1">Google</span>
                                <span className="rounded-full bg-white/60 px-3 py-1">Email</span>
                                <span className="rounded-full bg-white/60 px-3 py-1">Profiles</span>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}