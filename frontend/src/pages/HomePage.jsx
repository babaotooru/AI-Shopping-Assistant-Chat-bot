import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { healthService, orderService } from '../services';
import { useAuthStore } from '../store';
import {
    BellIcon,
    BoltIcon,
    HeartIcon,
    MagnifyingGlassIcon,
    ShoppingBagIcon,
    UserCircleIcon,
} from '@heroicons/react/24/outline';

const HERO_SLIDES = [
    {
        title: 'Discover products with AI Shopping Assistant',
        subtitle: 'Browse a live catalog, compare items, and open any product page instantly.',
        badge: 'Smart Catalog',
        cta: 'Browse Catalog',
    },
    {
        title: 'Ask the chatbot for the right product',
        subtitle: 'Use chat to get recommendations, comparisons, and shopping help from catalog data.',
        badge: 'AI Chat',
        cta: 'Open Chat',
    },
    {
        title: 'Compare featured products quickly',
        subtitle: 'Filter by category, price, rating, and reviews to find the best match.',
        badge: 'Compare Mode',
        cta: 'Compare Now',
    },
];

function priceValue(value) {
    const normalized = String(value || '').replace(/[^0-9.]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function ProductCard({ product, onOpen, onQuickAction }) {
    return (
        <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="relative bg-gradient-to-br from-slate-50 to-white p-4">
                <button
                    type="button"
                    onClick={() => onQuickAction('Wishlist')}
                    className="absolute right-3 top-3 rounded-full bg-white p-2 text-slate-400 shadow-sm transition hover:text-rose-500"
                >
                    <HeartIcon className="h-4 w-4" />
                </button>

                {Number(product.discount_percentage || 0) > 0 && (
                    <span className="absolute left-3 top-3 rounded-full bg-slate-900 px-2 py-1 text-[10px] font-bold text-white">
                        -{Math.round(product.discount_percentage)}%
                    </span>
                )}

                <button type="button" onClick={onOpen} className="block w-full">
                    <img
                        src={product.image_link || 'https://via.placeholder.com/640x480?text=No+Image'}
                        alt={product.name}
                        className="h-44 w-full object-contain transition duration-300 group-hover:scale-105"
                        onError={(event) => {
                            event.currentTarget.src = 'https://via.placeholder.com/640x480?text=No+Image';
                        }}
                    />
                </button>
            </div>

            <div className="space-y-2 p-4">
                <button type="button" onClick={onOpen} className="line-clamp-2 text-left text-sm font-medium text-slate-800 hover:text-orange-600">
                    {product.name}
                </button>
                <p className="text-xs text-indigo-600">{product.category || 'General'}</p>
                <div className="flex items-center gap-2 text-xs text-amber-500">
                    <span>{'★'.repeat(Math.max(1, Math.round(Number(product.rating || 4))))}</span>
                    <span className="text-slate-400">({Number(product.total_reviews || 0).toLocaleString()} Reviews)</span>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-900">{product.price || '$0.00'}</p>
                        <p className="text-[11px] text-slate-400 line-through">{product.original_price || '$1500.00'}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onQuickAction('Cart')}
                        className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600 transition hover:bg-orange-100"
                    >
                        Add to Cart
                    </button>
                </div>
            </div>
        </article>
    );
}

export function HomePage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const productGridRef = useRef(null);
    const [apiStatus, setApiStatus] = useState(null);
    const [products, setProducts] = useState([]);
    const [categoryCatalog, setCategoryCatalog] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [heroSlide, setHeroSlide] = useState(0);
    const [message, setMessage] = useState('Browse categories, search products, and open any section from the header.');

    const userDisplayName = user?.full_name || user?.username || user?.email || 'Guest User';
    const userEmail = user?.email || 'No email available';
    const userAuth = user?.auth_provider ? `${String(user.auth_provider).toUpperCase()} account` : 'Local account';
    const userInitials = userDisplayName
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    useEffect(() => {
        const loadHome = async () => {
            try {
                const [health, catalog, categoryData] = await Promise.all([
                    healthService.check(),
                    orderService.getAllOrders(null, 0, 48),
                    orderService.getCategories(),
                ]);
                setApiStatus(health);
                setProducts(Array.isArray(catalog.orders) ? catalog.orders : []);
                setCategoryCatalog(Array.isArray(categoryData?.categories) ? categoryData.categories : []);
            } catch (error) {
                setApiStatus({ status: 'error', message: error.message });
                setProducts([]);
                setCategoryCatalog([]);
            } finally {
                setLoadingProducts(false);
            }
        };

        loadHome();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setHeroSlide((prev) => (prev + 1) % HERO_SLIDES.length);
        }, 4500);

        return () => clearInterval(timer);
    }, []);

    const categories = useMemo(() => {
        const derived = [...new Set(products.map((item) => item.category).filter(Boolean))];
        const source = categoryCatalog.length ? categoryCatalog : derived;
        return ['All Categories', ...source].slice(0, 16);
    }, [products, categoryCatalog]);

    const topLinks = useMemo(() => {
        const dynamicCategories = categories.slice(1, 8).map((category) => ({
            label: category,
            path: '/orders',
        }));

        return [
            { label: 'Home', path: '/' },
            ...dynamicCategories,
            { label: "Today's Offer", path: '/orders' },
        ];
    }, [categories]);

    const filteredProducts = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return products.filter((product) => {
            const categoryMatch = selectedCategory === 'All Categories' || selectedCategory === 'All' || (product.category || '').toLowerCase().includes(selectedCategory.toLowerCase());
            const searchMatch = !term || [product.name, product.category, product.brand]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(term));
            return categoryMatch && searchMatch;
        });
    }, [products, searchTerm, selectedCategory]);

    const featured = useMemo(() => {
        return [...filteredProducts]
            .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
            .slice(0, 6);
    }, [filteredProducts]);

    const bestSelling = useMemo(() => {
        return [...filteredProducts]
            .sort((a, b) => Number(b.total_reviews || 0) - Number(a.total_reviews || 0))
            .slice(0, 3);
    }, [filteredProducts]);

    const hero = HERO_SLIDES[heroSlide];

    const openProduct = (productId) => {
        if (!productId) return;
        navigate(`/products/${encodeURIComponent(productId)}`);
    };

    const handleQuickAction = (action, productId) => {
        if (action === 'Cart') {
            setMessage('Added product to cart.');
            return;
        }

        if (action === 'Wishlist') {
            setMessage('Added product to wishlist.');
            return;
        }

        if (action === 'Search') {
            setMessage(`Searching for ${searchTerm || 'products'}.`);
            return;
        }

        if (action === 'Catalog') {
            setSelectedCategory('All Categories');
            setMessage('Showing all categories.');
            return;
        }

        if (productId) {
            openProduct(productId);
        }
    };

    const handleTopNav = (path, label) => {
        const isDataCategory = categories.slice(1).includes(label);

        if (isDataCategory) {
            setSelectedCategory(label);
            setMessage(`${label} category selected.`);
            requestAnimationFrame(() => {
                productGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            return;
        }

        if (label === "Today's Offer") {
            setSelectedCategory('All Categories');
            setMessage("Today's Offer opened. Showing full catalog.");
            navigate('/orders');
            return;
        }

        setMessage(`${label} section opened.`);
        navigate(path);
    };

    return (
        <div className="space-y-6 pb-10">
            <div className="rounded-2xl bg-[#1f1f1f] px-4 py-2 text-xs text-white/90 shadow-sm sm:px-6">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
                    <p>Welcome to AI Shopping Assistant!</p>
                    <div className="flex flex-wrap items-center gap-3 text-white/80">
                        <button type="button" onClick={() => setMessage('Language menu opened.')} className="hover:text-white">English ▼</button>
                        <button type="button" onClick={() => setMessage('Currency menu opened.')} className="hover:text-white">USD ▼</button>
                        <button type="button" onClick={() => setMessage('Helpline opened.')} className="hover:text-white">Helpline: +2201828247483</button>
                    </div>
                </div>
            </div>

            <header className="rounded-2xl bg-[#111] px-4 py-4 text-white shadow-sm sm:px-6">
                <div className="mx-auto max-w-7xl space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-2xl font-black">
                            <span className="rounded-lg bg-white px-2 py-1 text-[#111]">🛍</span>
                            AI Shopping Assistant
                        </button>

                        <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-lg bg-white text-slate-800 shadow-sm">
                            <button type="button" onClick={() => setMessage('Category dropdown opened.')} className="flex items-center gap-2 border-r border-slate-200 px-3 py-3 text-sm font-medium text-slate-600 sm:px-4">
                                Categories ▼
                            </button>
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Search here..."
                                className="min-w-0 flex-1 px-3 py-3 text-sm outline-none"
                            />
                            <button type="button" onClick={() => handleQuickAction('Search')} className="bg-orange-500 px-4 py-3 text-white transition hover:bg-orange-600"><MagnifyingGlassIcon className="h-5 w-5" /></button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setMessage('Quick action: highlight clicked.')} className="rounded-lg bg-white/10 px-3 py-2 transition hover:bg-white/20"><BoltIcon className="h-5 w-5" /></button>
                            <button type="button" onClick={() => setMessage('Favorites opened.')} className="rounded-lg bg-white/10 px-3 py-2 transition hover:bg-white/20"><HeartIcon className="h-5 w-5" /></button>
                            <button type="button" onClick={() => handleTopNav('/orders', 'Cart')} className="rounded-lg bg-white/10 px-3 py-2 transition hover:bg-white/20"><ShoppingBagIcon className="h-5 w-5" /></button>
                            <button type="button" onClick={() => navigate('/profile')} className="rounded-lg bg-white/10 px-3 py-2 transition hover:bg-white/20"><UserCircleIcon className="h-5 w-5" /></button>
                        </div>
                    </div>

                    <nav className="hidden flex-wrap items-center gap-2 rounded-xl bg-white p-1 text-sm text-slate-700 shadow-sm lg:flex">
                        {topLinks.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                onClick={() => handleTopNav(item.path, item.label)}
                                className="rounded-lg px-4 py-2 font-medium transition hover:bg-slate-100"
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </header>

            <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <aside className="space-y-4">
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <button type="button" onClick={() => handleQuickAction('Catalog')} className="flex w-full items-center justify-between bg-orange-500 px-4 py-3 text-left text-sm font-bold text-white">
                                <span>All Categories</span>
                                <span>▼</span>
                            </button>
                            <div className="divide-y divide-slate-100">
                                {categories.slice(1).map((category) => (
                                    <button
                                        key={category}
                                        type="button"
                                        onClick={() => {
                                            setSelectedCategory(category);
                                            setMessage(`${category} selected.`);
                                        }}
                                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                    >
                                        <span>{category}</span>
                                        <span className="text-slate-400">›</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="font-semibold text-slate-900">Hot Deals</h3>
                                <div className="flex gap-1 text-xs text-slate-400"><span>◀</span><span>▶</span></div>
                            </div>

                            {bestSelling.slice(0, 1).map((product) => (
                                <div key={product.product_id} className="space-y-3">
                                    <button type="button" onClick={() => openProduct(product.product_id)} className="block w-full">
                                        <img
                                            src={product.image_link || 'https://via.placeholder.com/400x400?text=No+Image'}
                                            alt={product.name}
                                            className="mx-auto h-40 w-full rounded-xl object-contain bg-slate-50 p-4"
                                        />
                                    </button>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{product.name}</p>
                                        <p className="text-xs text-slate-500">{product.category}</p>
                                        <div className="mt-2 flex items-center gap-2 text-xs text-amber-500">
                                            <span>{'★'.repeat(Math.max(1, Math.round(Number(product.rating || 4))))}</span>
                                            <span className="text-slate-400">({Number(product.total_reviews || 0).toLocaleString()})</span>
                                        </div>
                                        <p className="mt-2 text-base font-bold text-orange-600">{product.price || '$0.00'}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleQuickAction('Cart')}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
                                    >
                                        Add to Cart
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate('/profile')}
                            className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            {user?.avatar_url ? (
                                <img
                                    src={user.avatar_url}
                                    alt={userDisplayName}
                                    className="mx-auto h-24 w-24 rounded-full object-cover"
                                    onError={(event) => {
                                        event.currentTarget.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-600">
                                    {userInitials || 'U'}
                                </div>
                            )}
                            <p className="mt-3 text-sm text-slate-500">
                                Logged-in user profile details for this session.
                            </p>
                            <h4 className="mt-3 font-semibold text-slate-800">{userDisplayName}</h4>
                            <p className="text-xs text-slate-500">{userEmail}</p>
                            <p className="mt-1 text-xs text-slate-400">{userAuth}</p>
                        </button>
                    </aside>

                    <main className="space-y-6">
                        <section className="grid gap-4 xl:grid-cols-[1fr_280px]">
                            <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#bb21ff,#6f4df5,#39a8ff)] p-6 text-white shadow-sm sm:p-8">
                                <span className="inline-flex rounded-md bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">Black Friday Sale</span>
                                <h1 className="mt-4 max-w-xl text-3xl font-black leading-tight sm:text-5xl">{hero.title}</h1>
                                <p className="mt-4 max-w-lg text-sm text-white/90 sm:text-base">{hero.subtitle}</p>
                                <div className="mt-6 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/orders')}
                                        className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
                                    >
                                        {hero.cta}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/chat')}
                                        className="rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                                    >
                                        Watch Video
                                    </button>
                                </div>
                                <div className="mt-6 flex items-center gap-2">
                                    {HERO_SLIDES.map((_, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => setHeroSlide(index)}
                                            className={`h-2 rounded-full transition ${heroSlide === index ? 'w-8 bg-white' : 'w-2 bg-white/60'}`}
                                        />
                                    ))}
                                </div>
                                <img
                                    src={products[0]?.image_link || 'https://via.placeholder.com/400x400?text=Featured+Item'}
                                    alt="Featured product"
                                    className="absolute right-6 top-1/2 hidden h-64 -translate-y-1/2 object-contain drop-shadow-2xl xl:block"
                                />
                            </div>

                            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-900">Latest Article</h3>
                                    <div className="flex gap-1 text-xs text-slate-400"><span>◀</span><span>▶</span></div>
                                </div>
                                <div className="space-y-4">
                                    {featured.slice(0, 3).map((product, index) => (
                                        <button
                                            key={product.product_id}
                                            type="button"
                                            onClick={() => openProduct(product.product_id)}
                                            className="flex gap-3 rounded-2xl border border-slate-100 p-2 text-left transition hover:bg-slate-50"
                                        >
                                            <img
                                                src={product.image_link || 'https://via.placeholder.com/160x120?text=Article'}
                                                alt={product.name}
                                                className="h-20 w-20 rounded-xl object-cover"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-[11px] text-slate-400">{index === 0 ? 'April 23, 2024' : index === 1 ? 'June 13, 2024' : 'May 23, 2023'} • 5 mins</p>
                                                <p className="line-clamp-2 text-sm font-semibold text-slate-800">{product.name}</p>
                                                <span className="mt-2 inline-block text-xs text-slate-600 underline">See Details</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section ref={productGridRef} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-slate-900">New Arrival</h2>
                                <div className="flex gap-3 text-sm text-slate-500">
                                    {['All', 'Clothing', 'Electronic', 'Shoes'].map((item) => (
                                        <button key={item} type="button" onClick={() => setMessage(`${item} filter opened.`)} className="transition hover:text-orange-600">
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {message && <div className="rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-700">{message}</div>}

                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                {filteredProducts.slice(0, 4).map((product) => (
                                    <ProductCard
                                        key={product.product_id}
                                        product={product}
                                        onOpen={() => openProduct(product.product_id)}
                                        onQuickAction={(action) => handleQuickAction(action, product.product_id)}
                                    />
                                ))}
                            </div>
                        </section>

                        <section className="grid gap-4 lg:grid-cols-2">
                            <button type="button" onClick={() => navigate('/orders')} className="overflow-hidden rounded-3xl bg-gradient-to-r from-yellow-100 to-amber-200 p-5 text-left shadow-sm transition hover:scale-[1.01]">
                                <p className="text-xs font-semibold uppercase text-amber-700">Realme</p>
                                <h3 className="mt-2 text-2xl font-black text-slate-900">Up to 80% OFF</h3>
                                <div className="mt-3 flex items-center justify-between">
                                    <span className="text-sm text-slate-700 underline">Shop Now</span>
                                    <img src={products[1]?.image_link || products[0]?.image_link || 'https://via.placeholder.com/200x120?text=Promo'} alt="Promo" className="h-24 object-contain" />
                                </div>
                            </button>
                            <button type="button" onClick={() => navigate('/orders')} className="overflow-hidden rounded-3xl bg-gradient-to-r from-orange-100 to-amber-100 p-5 text-left shadow-sm transition hover:scale-[1.01]">
                                <p className="text-xs font-semibold uppercase text-orange-700">Xiaomi</p>
                                <h3 className="mt-2 text-2xl font-black text-slate-900">Up to 80% OFF</h3>
                                <div className="mt-3 flex items-center justify-between">
                                    <span className="text-sm text-slate-700 underline">Shop Now</span>
                                    <img src={products[2]?.image_link || products[0]?.image_link || 'https://via.placeholder.com/200x120?text=Promo'} alt="Promo" className="h-24 object-contain" />
                                </div>
                            </button>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-slate-900">Featured Products</h2>
                                <div className="flex gap-1 text-xs text-slate-400"><span>◀</span><span>▶</span></div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {featured.map((product) => (
                                    <ProductCard
                                        key={product.product_id}
                                        product={product}
                                        onOpen={() => openProduct(product.product_id)}
                                        onQuickAction={(action) => handleQuickAction(action, product.product_id)}
                                    />
                                ))}
                            </div>
                        </section>

                        <section className="rounded-3xl bg-[linear-gradient(90deg,#7dd3fc,#a78bfa,#f59e0b)] p-6 text-white shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">20% Offer</p>
                            <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h2 className="text-2xl font-black sm:text-3xl">Upgrade Your Everyday: Discover the Power of Smart Watch!</h2>
                                    <button type="button" onClick={() => navigate('/orders')} className="mt-3 text-sm font-semibold underline underline-offset-4">Shop Now</button>
                                </div>
                                <img src={products[0]?.image_link || 'https://via.placeholder.com/220x140?text=Watch'} alt="Offer" className="h-28 object-contain lg:h-36" />
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-slate-900">Best Selling Product</h2>
                                <div className="flex gap-1 text-xs text-slate-400"><span>◀</span><span>▶</span></div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {bestSelling.map((product) => (
                                    <ProductCard
                                        key={product.product_id}
                                        product={product}
                                        onOpen={() => openProduct(product.product_id)}
                                        onQuickAction={(action) => handleQuickAction(action, product.product_id)}
                                    />
                                ))}
                            </div>
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="mb-4 text-lg font-semibold text-slate-900">Our Services</h2>
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                {[
                                    { icon: '📦', title: 'Order Product', text: 'Easy and seamless order process.' },
                                    { icon: '🚚', title: 'Received Product', text: '100% guaranteed on fastest delivery.' },
                                    { icon: '💳', title: 'Make Payment', text: 'Cash on delivery or when received.' },
                                    { icon: '💬', title: 'Friendly Services', text: '30 days satisfaction guarantee.' },
                                ].map((item) => (
                                    <div key={item.title} className="rounded-2xl bg-slate-50 p-4 text-center">
                                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl shadow-sm">{item.icon}</div>
                                        <h3 className="mt-3 font-semibold text-slate-900">{item.title}</h3>
                                        <p className="mt-1 text-sm text-slate-500">{item.text}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">API Status</h2>
                                    <p className="text-sm text-slate-500">Your product backend connection status.</p>
                                </div>
                                <button type="button" onClick={() => navigate('/orders')} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                                    Browse Orders
                                </button>
                            </div>
                            {apiStatus ? (
                                <div className={`mt-4 rounded-2xl p-4 text-sm ${apiStatus.status === 'healthy' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                    {apiStatus.status === 'healthy' ? '✅ API is Running' : '❌ API Error'} - {apiStatus.message || 'All systems operational'}
                                </div>
                            ) : (
                                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Checking API status...</div>
                            )}
                        </section>
                    </main>
                </div>
            </div>

            <footer className="bg-[#111] text-white">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                    <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                            <h3 className="text-xl font-black">AI Shopping Assistant</h3>
                            <p className="mt-3 text-sm text-white/70">We have clothes that suits your style and which you need to try out.</p>
                            <button type="button" onClick={() => navigate('/orders')} className="mt-4 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900">Download App</button>
                        </div>
                        <div>
                            <h4 className="font-semibold">My Account</h4>
                            <div className="mt-3 space-y-2 text-sm text-white/70">
                                <button type="button" onClick={() => navigate('/profile')} className="block hover:text-white">Product Support</button>
                                <button type="button" onClick={() => navigate('/orders')} className="block hover:text-white">Checkout</button>
                                <button type="button" onClick={() => navigate('/orders')} className="block hover:text-white">Shopping Cart</button>
                                <button type="button" onClick={() => navigate('/profile')} className="block hover:text-white">Wishlist</button>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold">Customer Care</h4>
                            <div className="mt-3 space-y-2 text-sm text-white/70">
                                <button type="button" onClick={() => setMessage('New customer help opened.')} className="block hover:text-white">New Customers</button>
                                <button type="button" onClick={() => navigate('/chat')} className="block hover:text-white">How to Use Account</button>
                                <button type="button" onClick={() => navigate('/orders')} className="block hover:text-white">Placing an Order</button>
                                <button type="button" onClick={() => navigate('/chat')} className="block hover:text-white">Payment Methods</button>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold">Sign up to Newsletter</h4>
                            <p className="mt-3 text-sm text-white/70">Join 60000+ subscriptions and get a new discount on every Friday.</p>
                            <div className="mt-4 flex overflow-hidden rounded-lg bg-white">
                                <input type="email" placeholder="Enter your email" className="min-w-0 flex-1 px-3 py-2 text-sm text-slate-900 outline-none" />
                                <button type="button" onClick={() => setMessage('Footer newsletter submitted.')} className="bg-orange-500 px-4 py-2 text-sm font-semibold text-white">Subscribe</button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 border-t border-white/10 pt-4 text-center text-xs text-white/60">
                        <div className="mb-2 flex flex-wrap justify-center gap-4">
                            <button type="button" onClick={() => setMessage('About Us opened.')} className="hover:text-white">About Us</button>
                            <button type="button" onClick={() => setMessage('Delivery & Returns opened.')} className="hover:text-white">Delivery & Returns</button>
                            <button type="button" onClick={() => setMessage('Privacy Policy opened.')} className="hover:text-white">Privacy Policy</button>
                            <button type="button" onClick={() => setMessage('Help opened.')} className="hover:text-white">Help</button>
                            <button type="button" onClick={() => setMessage('Order Tracking opened.')} className="hover:text-white">Order Tracking</button>
                        </div>
                        <p>© 2026 all rights reserved. Powered by AI Shopping Assistant</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
