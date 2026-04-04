import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { authService } from '../services';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store';

export function SignupPage() {
    const navigate = useNavigate();
    const { setUser, setToken, isAuthenticated } = useAuthStore();
    const appBasePath = import.meta.env.BASE_URL || '/';
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const configuredAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');

    const getOAuthRedirectUrl = () => {
        const safeBasePath = String(appBasePath || '/');
        const prefersConfiguredUrl = configuredAppUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredAppUrl);
        const appOrigin = prefersConfiguredUrl ? configuredAppUrl : window.location.origin;
        return new URL(safeBasePath, `${appOrigin}/`).toString();
    };

    const sanitizeOAuthCode = (code) => {
        const raw = String(code || '').trim();
        if (!raw) return null;
        return raw.split('http://')[0].split('https://')[0].trim() || null;
    };

    const getParamFromUrl = (name) => {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = window.location.href.match(new RegExp(`[?#&]${escapedName}=([^&#]+)`));
        return match ? decodeURIComponent(match[1]) : null;
    };

    const getAuthCodeFromUrl = () => {
        const searchCode = new URLSearchParams(window.location.search).get('code');
        if (searchCode) {
            return sanitizeOAuthCode(searchCode);
        }

        const hash = window.location.hash || '';
        const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
        if (!hashQuery) {
            return null;
        }
        return sanitizeOAuthCode(new URLSearchParams(hashQuery).get('code'));
    };

    const applySessionFallbackLogin = async (session) => {
        if (!session?.access_token) return;

        const fallbackUser = {
            id: session.user?.id,
            email: session.user?.email,
            username: session.user?.user_metadata?.preferred_username || session.user?.user_metadata?.user_name || session.user?.user_metadata?.username || '',
            full_name: session.user?.user_metadata?.full_name || session.user?.user_metadata?.name || '',
            avatar_url: session.user?.user_metadata?.avatar_url || session.user?.user_metadata?.picture || '',
            auth_provider: 'google',
        };

        setToken(session.access_token);
        setUser(fallbackUser);
        const cleanHash = window.location.hash || '#/';
        window.history.replaceState({}, document.title, `${window.location.pathname}${cleanHash}`);
        navigate('/');
    };

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/');
            return;
        }

        if (!supabase) return;

        const syncCurrentSession = async () => {
            const accessTokenFromUrl = getParamFromUrl('access_token');
            const refreshTokenFromUrl = getParamFromUrl('refresh_token');
            const authCode = getAuthCodeFromUrl();

            if (accessTokenFromUrl && refreshTokenFromUrl) {
                const { error: setSessionError } = await supabase.auth.setSession({
                    access_token: accessTokenFromUrl,
                    refresh_token: refreshTokenFromUrl,
                });
                if (setSessionError) {
                    setError(setSessionError.message || 'Unable to restore Google session');
                    return;
                }
            }

            if (authCode) {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
                if (exchangeError) {
                    setError(exchangeError.message || 'Unable to complete Google sign-up callback');
                    return;
                }
            }

            const { data } = await supabase.auth.getSession();
            if (data?.session?.access_token) {
                try {
                    const response = await authService.syncGoogleSession(data.session.access_token);
                    setToken(response.access_token);
                    setUser(response.user);

                    const cleanHash = window.location.hash || '#/';
                    window.history.replaceState({}, document.title, `${window.location.pathname}${cleanHash}`);
                    navigate('/');
                } catch (err) {
                    await applySessionFallbackLogin(data.session);
                    setError('Signed in with Google session fallback. Some profile sync details may update shortly.');
                }
            }
        };

        syncCurrentSession();
    }, [isAuthenticated, navigate]);

    const handleGoogleSignup = async () => {
        if (!supabase) {
            setError('Supabase is not configured.');
            return;
        }

        try {
            setLoading(true);
            setError('');
            const redirectTo = getOAuthRedirectUrl();
            const { error: signInError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    queryParams: { prompt: 'select_account' },
                },
            });
            if (signInError) throw signInError;
        } catch (err) {
            setError(
                err?.message ||
                'Google sign up failed. If you see redirect_uri_mismatch, add https://ivlmvggpswfwtjzvbave.supabase.co/auth/v1/callback to Google Cloud Console Authorized redirect URIs.'
            );
            setLoading(false);
        }
    };

    const handleSignup = async () => {
        if (!username.trim() || !email.trim() || !password.trim()) {
            setError('Please fill in username, email, and password.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        try {
            setLoading(true);
            setError('');
            setSuccess('');

            const response = await authService.createEmailAccount(email.trim(), password, username.trim());
            setToken(response.access_token);
            setUser(response.user);
            navigate('/');
        } catch (err) {
            setError(err?.response?.data?.detail || err?.message || 'Sign up failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell
            eyebrow="Start your journey"
            title="Create your AI Shopping Assistant account"
            description="Create your account with email and password, then log in and start using shopping recommendations, comparisons, and chat. Google is available as the second option."
            primaryActionLabel={loading ? 'Creating account...' : 'Sign Up'}
            primaryActionLoadingLabel="Creating account..."
            primaryActionBusy={loading}
            primaryAction={handleSignup}
            secondaryLinkLabel="Already have an account? Sign in"
            secondaryLinkTo="/login"
            footerText="Have an account?"
            footerLinkLabel="Sign in"
            footerLinkTo="/login"
            error={error}
            onGoogle={handleGoogleSignup}
            googleLoading={loading}
        >
            <div className="space-y-5">
                <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Choose a username"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">E-mail</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@email.com"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a password"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Confirm Password</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat your password"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                </div>

                {success ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {success}
                    </div>
                ) : null}
            </div>
        </AuthShell>
    );
}