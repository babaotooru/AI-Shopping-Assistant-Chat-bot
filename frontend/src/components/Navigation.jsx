import {
    Bars3BottomLeftIcon,
    ChatBubbleLeftRightIcon,
    HomeIcon,
    ScaleIcon,
    LightBulbIcon,
    UserCircleIcon,
    MoonIcon,
    SunIcon,
    ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store';

export function Navigation({ theme, onToggleTheme }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuthStore();

    const navItems = [
        { label: 'Home', path: '/', icon: HomeIcon },
        { label: 'Catalog', path: '/orders', icon: ShoppingBagIcon },
        { label: 'Chat', path: '/chat', icon: ChatBubbleLeftRightIcon },
        { label: 'Recommendations', path: '/recommendations', icon: LightBulbIcon },
        { label: 'Compare', path: '/compare', icon: ScaleIcon },
        { label: 'Profile', path: '/profile', icon: UserCircleIcon },
    ];

    const handleLogout = async () => {
        try {
            if (supabase) {
                await supabase.auth.signOut();
            }
        } finally {
            logout();
            navigate('/login');
        }
    };

    return (
        <nav className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-14 sm:h-16">
                    <Link to="/" className="flex items-center space-x-2 font-bold text-lg sm:text-xl min-w-0">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Bars3BottomLeftIcon className="h-5 w-5" /></span>
                        <span className="truncate">AI Shopping Assistant</span>
                    </Link>

                    <div className="md:hidden flex items-center gap-2">
                        {isAuthenticated && (
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="rounded-md bg-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/30 transition"
                            >
                                Logout
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onToggleTheme}
                            className="rounded-md bg-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/30 transition"
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                        </button>
                    </div>

                    <div className="hidden md:flex items-center gap-2">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition ${location.pathname === item.path
                                    ? 'bg-white/25'
                                    : 'hover:bg-white/15'
                                    }`}
                            >
                                <item.icon className="mr-1 inline h-4 w-4" />
                                {item.label}
                            </Link>
                        ))}

                        {isAuthenticated && (
                            <span className="ml-2 text-xs max-w-[180px] truncate text-white/90">
                                {user?.full_name || user?.email || 'Signed in'}
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={onToggleTheme}
                            className="ml-2 rounded-md bg-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/30 transition"
                            aria-label="Toggle theme"
                        >
                            <span className="inline-flex items-center gap-1">{theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />} {theme === 'dark' ? 'Light' : 'Dark'}</span>
                        </button>

                        {isAuthenticated && (
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="rounded-md bg-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/30 transition"
                            >
                                Logout
                            </button>
                        )}
                    </div>
                </div>

                <div className="md:hidden -mx-4 px-4 pb-3 overflow-x-auto">
                    <div className="flex items-center gap-2 min-w-max">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${location.pathname === item.path
                                    ? 'bg-white/30'
                                    : 'bg-white/10 hover:bg-white/20'
                                    }`}
                            >
                                <item.icon className="mr-1 inline h-4 w-4" />
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </nav>
    );
}
