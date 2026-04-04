import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderService } from '../services';

const PAGE_SIZE = 12;

function parsePrice(value) {
    if (typeof value === 'number') return value;
    const normalized = String(value || '').replace(/[^0-9.]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function OrdersPage() {
    const navigate = useNavigate();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedBrands, setSelectedBrands] = useState([]);
    const [sortBy, setSortBy] = useState('popular');
    const [page, setPage] = useState(1);

    const [wishlist, setWishlist] = useState([]);
    const [cart, setCart] = useState([]);
    const [infoMessage, setInfoMessage] = useState('Explore products, use filters, and compare quickly.');

    const [minPrice, setMinPrice] = useState(0);
    const [maxPrice, setMaxPrice] = useState(600);

    useEffect(() => {
        const fetchCatalog = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await orderService.getAllOrders(null, 0, 500);
                setProducts(Array.isArray(data.orders) ? data.orders : []);
            } catch (err) {
                setError(err.message || 'Failed to load products');
            } finally {
                setLoading(false);
            }
        };

        fetchCatalog();
    }, []);

    const categories = useMemo(() => {
        const source = products.map((item) => item.category).filter(Boolean);
        return ['All', ...new Set(source)];
    }, [products]);

    const brands = useMemo(() => {
        const source = products
            .map((item) => item.brand || item.category || 'Generic')
            .filter(Boolean);
        return [...new Set(source)].slice(0, 12);
    }, [products]);

    const topSelling = useMemo(() => {
        return [...products]
            .sort((a, b) => Number(b.total_reviews || 0) - Number(a.total_reviews || 0))
            .slice(0, 5);
    }, [products]);

    const filteredProducts = useMemo(() => {
        let result = products.filter((item) => {
            const productCategory = item.category || 'Other';
            const productBrand = item.brand || item.category || 'Generic';
            const price = parsePrice(item.price);

            const categoryMatch = selectedCategory === 'All' || productCategory === selectedCategory;
            const brandMatch = selectedBrands.length === 0 || selectedBrands.includes(productBrand);
            const priceMatch = price >= minPrice && price <= maxPrice;

            return categoryMatch && brandMatch && priceMatch;
        });

        if (sortBy === 'price-low') {
            result = result.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
        } else if (sortBy === 'price-high') {
            result = result.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
        } else if (sortBy === 'rating') {
            result = result.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
        } else {
            result = result.sort((a, b) => Number(b.total_reviews || 0) - Number(a.total_reviews || 0));
        }

        return result;
    }, [products, selectedCategory, selectedBrands, minPrice, maxPrice, sortBy]);

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageProducts = filteredProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    useEffect(() => {
        setPage(1);
    }, [selectedCategory, selectedBrands, minPrice, maxPrice, sortBy]);

    const activeTags = [
        ...(selectedCategory !== 'All' ? [selectedCategory] : []),
        ...selectedBrands,
    ];

    const toggleBrand = (brand) => {
        setSelectedBrands((prev) => (prev.includes(brand) ? prev.filter((item) => item !== brand) : [...prev, brand]));
    };

    const clearFilters = () => {
        setSelectedCategory('All');
        setSelectedBrands([]);
        setMinPrice(0);
        setMaxPrice(600);
        setSortBy('popular');
        setInfoMessage('All filters cleared. Showing full catalog.');
    };

    const toggleWishlist = (productId) => {
        setWishlist((prev) => {
            if (prev.includes(productId)) {
                setInfoMessage('Removed from wishlist.');
                return prev.filter((id) => id !== productId);
            }
            setInfoMessage('Added to wishlist.');
            return [...prev, productId];
        });
    };

    const addToCart = (productId) => {
        setCart((prev) => {
            if (prev.includes(productId)) {
                setInfoMessage('Already in cart.');
                return prev;
            }
            setInfoMessage('Added to cart.');
            return [...prev, productId];
        });
    };

    if (loading) {
        return <div className="py-10 text-center text-slate-700">Loading catalog...</div>;
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
                Error loading catalog: {error}
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-5 pb-10">
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={() => setInfoMessage('About section loaded.')} className="transition hover:text-sky-600">About Us</button>
                        <button type="button" onClick={() => setInfoMessage('Privacy policy section loaded.')} className="transition hover:text-sky-600">Privacy Policy</button>
                        <button type="button" onClick={() => navigate('/profile')} className="transition hover:text-sky-600">Track Order</button>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500">
                        <button type="button" onClick={() => setInfoMessage('Share menu opened.')} className="transition hover:text-sky-600">Share</button>
                        <button type="button" onClick={() => setInfoMessage(`Wishlist has ${wishlist.length} items.`)} className="transition hover:text-sky-600">Wishlist {wishlist.length}</button>
                        <button type="button" onClick={() => setInfoMessage(`Cart has ${cart.length} items.`)} className="transition hover:text-sky-600">Cart {cart.length}</button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-700 to-cyan-400 text-white shadow-sm">
                            ES
                        </div>
                        <button type="button" onClick={() => navigate('/')} className="text-xl font-black tracking-wide text-sky-700">AI Shopping Assistant</button>
                        <button type="button" onClick={() => setSelectedCategory('All')} className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-50">All Categories</button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <button type="button" onClick={() => navigate('/')} className="rounded-full px-3 py-1 transition hover:bg-slate-100">Home</button>
                        <button type="button" onClick={() => setInfoMessage('Category menu opened.')} className="rounded-full px-3 py-1 transition hover:bg-slate-100">Category</button>
                        <button type="button" onClick={() => setInfoMessage('Brand list menu opened.')} className="rounded-full px-3 py-1 transition hover:bg-slate-100">Brand</button>
                        <button type="button" onClick={() => setInfoMessage('Search opened.')} className="rounded-full px-2 py-1 transition hover:bg-slate-100">⌕</button>
                        <button type="button" onClick={() => setInfoMessage('Favorites opened.')} className="rounded-full px-2 py-1 transition hover:bg-slate-100">♡</button>
                        <button type="button" onClick={() => setInfoMessage('Notifications opened.')} className="rounded-full px-2 py-1 transition hover:bg-slate-100">🔔</button>
                        <button type="button" onClick={() => navigate('/profile')} className="rounded-full px-2 py-1 transition hover:bg-slate-100">👤</button>
                    </div>
                </div>
            </div>

            <div className="rounded-xl bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),_transparent_28%),linear-gradient(90deg,#1e3a8a,#0284c7,#06b6d4)] px-5 py-6 text-white shadow-sm sm:px-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">AI Shopping Assistant</h1>
                        <p className="mt-1 text-sm text-blue-100">Product Catalog / Brands</p>
                    </div>
                    <div className="text-right text-sm text-blue-100">
                        <p>{filteredProducts.length} item results found</p>
                        <p>Most Popular</p>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    {categories.slice(1, 6).map((chip) => (
                        <button
                            key={chip}
                            type="button"
                            onClick={() => setSelectedCategory(chip)}
                            className="rounded-full border border-blue-200/60 bg-white/10 px-3 py-1 text-xs transition hover:bg-white/20"
                        >
                            {chip}
                        </button>
                    ))}
                </div>
            </div>

            <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-2 text-sm text-sky-800">{infoMessage}</div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
                <aside className="space-y-5">
                    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-700">Best Category In This Brand</h2>
                        <div className="space-y-2">
                            {categories.map((category) => (
                                <label key={category} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                                    <input
                                        type="radio"
                                        name="category"
                                        checked={selectedCategory === category}
                                        onChange={() => setSelectedCategory(category)}
                                        className="h-4 w-4 accent-sky-600"
                                    />
                                    {category}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-700">Price Range</h2>
                        <input
                            type="range"
                            min="0"
                            max="600"
                            value={minPrice}
                            onChange={(e) => setMinPrice(Math.min(Number(e.target.value), maxPrice - 1))}
                            className="w-full accent-sky-600"
                        />
                        <input
                            type="range"
                            min="0"
                            max="600"
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(Math.max(Number(e.target.value), minPrice + 1))}
                            className="w-full accent-sky-600"
                        />
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                            <span>Min: ${minPrice}</span>
                            <span>Max: ${maxPrice}</span>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-700">Top 05 Selling Product In This Brand</h2>
                        <div className="space-y-2">
                            {topSelling.map((item) => (
                                <button
                                    key={item.product_id}
                                    type="button"
                                    onClick={() => navigate(`/products/${encodeURIComponent(item.product_id)}`)}
                                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-slate-50"
                                >
                                    <img
                                        src={item.image_link || 'https://via.placeholder.com/64x64?text=Item'}
                                        alt={item.name}
                                        className="h-10 w-10 rounded object-cover"
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://via.placeholder.com/64x64?text=Item';
                                        }}
                                    />
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-slate-800">{item.name}</p>
                                        <p className="text-xs text-sky-700">{item.price}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-700">You May Also Like This Brand</h2>
                        <div className="space-y-2">
                            {brands.map((brand) => (
                                <label key={brand} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={selectedBrands.includes(brand)}
                                        onChange={() => toggleBrand(brand)}
                                        className="h-4 w-4 accent-sky-600"
                                    />
                                    {brand}
                                </label>
                            ))}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setSelectedCategory('All');
                            setInfoMessage('Promo activated: showing complete catalog.');
                        }}
                        className="w-full rounded-xl bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.25),_transparent_32%),linear-gradient(160deg,#2563eb,#0ea5e9)] p-4 text-left text-white shadow-sm transition hover:scale-[1.01]"
                    >
                        <p className="text-xs uppercase tracking-wide">Xiaomi Mobile Phone</p>
                        <p className="mt-1 text-2xl font-black">32% Discount</p>
                        <p className="text-xs text-blue-100">For all electronics products</p>
                        <span className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs">Shop now</span>
                    </button>
                </aside>

                <section>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Best Category In This Brand</p>
                            <span className="text-sm text-slate-600">{filteredProducts.length} item results found</span>
                            {activeTags.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => {
                                        if (tag === selectedCategory) {
                                            setSelectedCategory('All');
                                        } else {
                                            setSelectedBrands((prev) => prev.filter((item) => item !== tag));
                                        }
                                    }}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                                >
                                    {tag} x
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs text-orange-700 hover:bg-orange-100"
                            >
                                Clear all x
                            </button>
                        </div>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="popular">Most Popular</option>
                            <option value="rating">Highest Rating</option>
                            <option value="price-low">Price Low to High</option>
                            <option value="price-high">Price High to Low</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {pageProducts.map((item) => {
                            const productId = item.product_id;
                            const isWished = wishlist.includes(productId);
                            const inCart = cart.includes(productId);

                            return (
                                <article key={productId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
                                    <div className="relative bg-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => toggleWishlist(productId)}
                                            className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-2 py-1 text-sm text-slate-600 shadow-sm"
                                        >
                                            {isWished ? 'Saved' : 'Save'}
                                        </button>

                                        {Number(item.discount_percentage || 0) > 0 && (
                                            <span className="absolute left-3 top-3 z-10 rounded bg-orange-500 px-2 py-1 text-[10px] font-bold text-white">
                                                -{item.discount_percentage}%
                                            </span>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => navigate(`/products/${encodeURIComponent(productId)}`)}
                                            className="block w-full"
                                        >
                                            <img
                                                src={item.image_link || 'https://via.placeholder.com/640x480?text=No+Image'}
                                                alt={item.name}
                                                className="h-56 w-full object-contain p-4"
                                                onError={(e) => {
                                                    e.currentTarget.src = 'https://via.placeholder.com/640x480?text=No+Image';
                                                }}
                                            />
                                        </button>
                                    </div>

                                    <div className="space-y-2 p-4">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/products/${encodeURIComponent(productId)}`)}
                                            className="line-clamp-1 text-left text-lg font-semibold text-slate-800 hover:text-sky-700"
                                        >
                                            {item.name}
                                        </button>
                                        <p className="text-xs text-emerald-600">{item.brand || item.category || 'Apple'}</p>
                                        <p className="text-xs text-orange-500">Rating {item.rating || 0}</p>

                                        <div className="flex items-end justify-between">
                                            <div>
                                                <p className="text-2xl font-black text-sky-700">{item.price || '$0.00'}</p>
                                                <p className="text-xs text-slate-400 line-through">{item.original_price || '$1500.00'}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => addToCart(productId)}
                                                className={`rounded-full px-3 py-2 text-xs text-white shadow-sm transition ${inCart ? 'bg-emerald-600' : 'bg-sky-600 hover:bg-sky-700'}`}
                                            >
                                                {inCart ? 'In Cart' : 'Cart'}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    {filteredProducts.length === 0 && (
                        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                            No products found for the selected filters.
                        </div>
                    )}

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            disabled={safePage === 1}
                        >
                            Prev
                        </button>

                        {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
                            const number = idx + 1;
                            return (
                                <button
                                    key={number}
                                    type="button"
                                    onClick={() => setPage(number)}
                                    className={`h-9 w-9 rounded-full text-sm ${safePage === number ? 'bg-sky-700 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                                >
                                    {number}
                                </button>
                            );
                        })}

                        {totalPages > 5 && <span className="px-1 text-slate-500">...</span>}

                        <button
                            type="button"
                            onClick={() => setPage(totalPages)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                            {totalPages}
                        </button>

                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            disabled={safePage === totalPages}
                        >
                            Next
                        </button>
                    </div>
                </section>
            </div>

            <footer className="mt-8 rounded-xl bg-slate-200 px-6 py-8 text-slate-700">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="lg:col-span-2">
                        <button type="button" onClick={() => navigate('/')} className="text-2xl font-black text-sky-700">AI Shopping Assistant</button>
                        <p className="mt-3 text-sm">Premium catalog with filters, compare-ready data, and smooth account integration.</p>
                        <button
                            type="button"
                            onClick={() => setInfoMessage('Support line opened: (219) 555-0114')}
                            className="mt-3 rounded-full bg-white px-4 py-1 text-sm font-semibold text-sky-700"
                        >
                            (219) 555-0114
                        </button>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-extrabold uppercase">My Account</p>
                        <div className="space-y-1 text-sm">
                            <button type="button" onClick={() => navigate('/profile')} className="block hover:text-sky-700">My Account</button>
                            <button type="button" onClick={() => navigate('/orders')} className="block hover:text-sky-700">Order History</button>
                            <button type="button" onClick={() => setInfoMessage('Shopping cart opened.')} className="block hover:text-sky-700">Shopping Cart</button>
                            <button type="button" onClick={() => setInfoMessage('Wishlist opened.')} className="block hover:text-sky-700">Wishlist</button>
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-extrabold uppercase">Helps</p>
                        <div className="space-y-1 text-sm">
                            <button type="button" onClick={() => setInfoMessage('Contact form opened.')} className="block hover:text-sky-700">Contact</button>
                            <button type="button" onClick={() => setInfoMessage('FAQs opened.')} className="block hover:text-sky-700">FAQs</button>
                            <button type="button" onClick={() => setInfoMessage('Terms opened.')} className="block hover:text-sky-700">Terms and Condition</button>
                            <button type="button" onClick={() => setInfoMessage('Privacy policy opened.')} className="block hover:text-sky-700">Privacy Policy</button>
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-extrabold uppercase">Categories</p>
                        <div className="space-y-1 text-sm">
                            {categories.slice(1, 5).map((cat) => (
                                <button key={cat} type="button" onClick={() => setSelectedCategory(cat)} className="block hover:text-sky-700">
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
