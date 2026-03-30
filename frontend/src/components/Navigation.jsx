import { Link, useLocation } from 'react-router-dom';

export function Navigation({ theme, onToggleTheme }) {
    const location = useLocation();

    const navItems = [
        { label: 'Home', path: '/', icon: '🏠' },
        { label: 'Orders', path: '/orders', icon: '📦' },
        { label: 'Chat', path: '/chat', icon: '🤖' },
        { label: 'Recommendations', path: '/recommendations', icon: '💡' },
        { label: 'Compare', path: '/compare', icon: '⚖️' },
    ];

    return (
        <nav className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link to="/" className="flex items-center space-x-2 font-bold text-xl">
                        <span className="text-2xl">🛍️</span>
                        <span>AI Shopping Assistant</span>
                    </Link>

                    <button
                        type="button"
                        onClick={onToggleTheme}
                        className="md:hidden rounded-md bg-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/30 transition"
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>

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
                                <span className="mr-1">{item.icon}</span>
                                {item.label}
                            </Link>
                        ))}

                        <button
                            type="button"
                            onClick={onToggleTheme}
                            className="ml-2 rounded-md bg-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/30 transition"
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
