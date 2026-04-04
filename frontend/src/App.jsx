import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { useAuthStore } from './store';
import './App.css';

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((module) => ({ default: module.OrdersPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then((module) => ({ default: module.ChatPage })));
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage').then((module) => ({ default: module.RecommendationsPage })));
const ComparePage = lazy(() => import('./pages/ComparePage').then((module) => ({ default: module.ComparePage })));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage').then((module) => ({ default: module.ProductDetailsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then((module) => ({ default: module.SignupPage })));

function PageFallback() {
    return (
        <div className="mx-auto flex min-h-[45vh] max-w-7xl items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 py-12 text-sm text-slate-500 shadow-sm">
            Loading page...
        </div>
    );
}

function ProtectedLayout({ theme, onToggleTheme }) {
    const location = useLocation();
    const { isAuthenticated } = useAuthStore();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
            <Navigation theme={theme} onToggleTheme={onToggleTheme} />
            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
                <Suspense fallback={<PageFallback />}>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/orders" element={<OrdersPage />} />
                        <Route path="/chat" element={<ChatPage />} />
                        <Route path="/recommendations" element={<RecommendationsPage />} />
                        <Route path="/compare" element={<ComparePage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/products/:productId" element={<ProductDetailsPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </main>
        </div>
    );
}

function App() {
    const [theme, setTheme] = useState('light');
    const { isAuthenticated } = useAuthStore();

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const initialTheme = savedTheme || preferredTheme;
        setTheme(initialTheme);
        document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    }, []);

    const toggleTheme = () => {
        setTheme((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', next);
            document.documentElement.classList.toggle('dark', next === 'dark');
            return next;
        });
    };

    return (
        <HashRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
            <Suspense fallback={<PageFallback />}>
                <Routes>
                    <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
                    <Route path="/signup" element={isAuthenticated ? <Navigate to="/" replace /> : <SignupPage />} />
                    <Route path="*" element={<ProtectedLayout theme={theme} onToggleTheme={toggleTheme} />} />
                </Routes>
            </Suspense>
        </HashRouter>
    );
}

export default App;
