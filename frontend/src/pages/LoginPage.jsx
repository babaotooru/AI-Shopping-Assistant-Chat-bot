import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { authService } from '../services';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store';

export function LoginPage() {
    const navigate = useNavigate();
    const { setUser, setToken, isAuthenticated } = useAuthStore();
    const appBasePath = import.meta.env.BASE_URL || '/';
    const [loading, setLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [error, setError] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const oauthRetryFlagKey = 'google-oauth-pkce-retry';

    const getParamFromUrl = (name) => {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = window.location.href.match(new RegExp(`[?#&]${escapedName}=([^&#]+)`));
        return match ? decodeURIComponent(match[1]) : null;
    };

    const getAuthCodeFromUrl = () => {
        const searchCode = new URLSearchParams(window.location.search).get('code');
        if (searchCode) {
            return searchCode;
        }

        const hash = window.location.hash || '';
        const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
        if (!hashQuery) {
            return null;
        }
        return new URLSearchParams(hashQuery).get('code');
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

    const clearPkceStorage = () => {
        // Clear PKCE code verifier if it exists
        try {
            localStorage.removeItem('sb-' + (import.meta.env.VITE_SUPABASE_URL?.split('.')[0] || 'supabase') + '-code-verifier');
            // Also try common PKCE storage keys
            Object.keys(localStorage).forEach((key) => {
                if (key.includes('code-verifier') || key.includes('pkce')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            // localStorage might not be available
        }
    };

    const hasPkceVerifier = () => {
        try {
            return Object.keys(localStorage).some((key) => key.includes('code-verifier') && !!localStorage.getItem(key));
        } catch (e) {
            return false;
        }
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

            // In HashRouter setups, explicitly exchange OAuth code before reading session.
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
                // If verifier is missing, OAuth callback cannot be exchanged. Retry once automatically.
                if (!hasPkceVerifier()) {
                    const alreadyRetried = sessionStorage.getItem(oauthRetryFlagKey) === '1';
                    if (!alreadyRetried) {
                        sessionStorage.setItem(oauthRetryFlagKey, '1');
                        const redirectTo = new URL(appBasePath, window.location.origin).toString();
                        await supabase.auth.signInWithOAuth({
                            provider: 'google',
                            options: {
                                redirectTo,
                                queryParams: { prompt: 'select_account' },
                            },
                        });
                        return;
                    }

                    sessionStorage.removeItem(oauthRetryFlagKey);
                    setError('Google login session expired. Please click Continue with Google once more.');
                    return;
                }

                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);

                // PKCE code verifier error handling
                if (exchangeError?.message?.includes('code verifier') || exchangeError?.message?.includes('PKCE')) {
                    console.warn('PKCE code verifier not found:', exchangeError.message);
                    clearPkceStorage();

                    // Try to recover - check if we already have a valid session from URL tokens
                    if (!accessTokenFromUrl) {
                        setError('Google login session expired. Please click Continue with Google once more.');
                        return;
                    }
                } else if (exchangeError && !accessTokenFromUrl) {
                    setError(exchangeError.message || 'Unable to complete Google login callback');
                    return;
                }
            }

            const { data, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                setError(sessionError.message || 'Unable to read current login session');
                return;
            }

            if (data?.session?.access_token) {
                sessionStorage.removeItem(oauthRetryFlagKey);
                try {
                    const response = await authService.syncGoogleSession(data.session.access_token);
                    setToken(response.access_token);
                    setUser(response.user);

                    // Remove OAuth query params after successful session sync.
                    const cleanHash = window.location.hash || '#/';
                    window.history.replaceState({}, document.title, `${window.location.pathname}${cleanHash}`);
                    navigate('/');
                } catch (err) {
                    await applySessionFallbackLogin(data.session);
                    setError('Logged in with Google session fallback. Some profile sync details may update shortly.');
                }
            }
        };

        syncCurrentSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!session?.access_token) return;
            try {
                const response = await authService.syncGoogleSession(session.access_token);
                setToken(response.access_token);
                setUser(response.user);
                navigate('/');
            } catch (err) {
                await applySessionFallbackLogin(session);
                setError('Logged in with Google session fallback. Some profile sync details may update shortly.');
            }
        });

        return () => subscription.unsubscribe();
    }, [isAuthenticated, navigate, setToken, setUser]);

    const handleGoogleLogin = async () => {
        if (!supabase) {
            setError('Supabase is not configured.');
            return;
        }

        // Clear any stale PKCE code verifiers before initiating fresh OAuth
        clearPkceStorage();
        sessionStorage.removeItem(oauthRetryFlagKey);

        try {
            setLoading(true);
            setError('');
            const redirectTo = new URL(appBasePath, window.location.origin).toString();

            // OAuth callbacks should return to the app base URL (without hash)
            // so Supabase can reliably parse query/hash auth params.
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
                'Google login failed. Ensure Google Cloud OAuth Authorized redirect URI contains https://ivlmvggpswfwtjzvbave.supabase.co/auth/v1/callback and Supabase Redirect URLs include your app URL.'
            );
            setLoading(false);
        }
    };

    const handlePasswordLogin = async () => {
        if (!identifier.trim() || !password.trim()) {
            setError('Please enter username/email and password.');
            return;
        }

        try {
            setPasswordLoading(true);
            setError('');

            let email = identifier.trim();
            if (!email.includes('@')) {
                const resolved = await authService.resolveIdentifier(identifier.trim());
                email = resolved.email;
            }

            const response = await authService.emailLogin(email, password);
            setToken(response.access_token);
            setUser(response.user);
            navigate('/');
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Username/password login failed');
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <AuthShell
            eyebrow="Welcome back"
            title="Sign in to AI Shopping Assistant"
            description="Use your username or email to sign in with password, or continue with Google to access your account instantly."
            primaryActionLabel={passwordLoading ? 'Signing in...' : 'Sign In'}
            primaryActionLoadingLabel="Signing in..."
            primaryActionBusy={passwordLoading}
            primaryAction={handlePasswordLogin}
            secondaryLinkLabel="Create a new account"
            secondaryLinkTo="/signup"
            footerText="Have an account?"
            footerLinkLabel="Sign up"
            footerLinkTo="/signup"
            error={error}
            onGoogle={handleGoogleLogin}
            googleLoading={loading}
        >
            <div className="space-y-5">
                <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Username or Email</label>
                    <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="example@email.com or username"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                </div>
            </div>
        </AuthShell>
    );
}
