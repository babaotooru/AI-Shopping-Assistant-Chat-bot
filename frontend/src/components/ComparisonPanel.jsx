import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatService, orderService } from '../services';

const INR_RATE = 83;

function toInrLabel(value, usdFallback = null) {
    const text = String(value ?? '').trim();
    if (text.toUpperCase().startsWith('INR')) {
        return text;
    }
    const base = usdFallback ?? text;
    const match = String(base).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    if (!match) {
        return text || 'N/A';
    }
    const usd = Number(match[0]);
    if (!Number.isFinite(usd) || usd <= 0) {
        return text || 'N/A';
    }
    return `INR ${Math.round(usd * INR_RATE).toLocaleString()}`;
}

function extractNumericPrice(value, usdFallback = null) {
    const base = String(usdFallback ?? value ?? '').replace(/,/g, '');
    const match = base.match(/\d+(?:\.\d+)?/);
    if (!match) {
        return Number.POSITIVE_INFINITY;
    }
    const amount = Number(match[0]);
    if (!Number.isFinite(amount)) {
        return Number.POSITIVE_INFINITY;
    }
    return String(value ?? '').toUpperCase().startsWith('INR') ? amount : amount * INR_RATE;
}

function pickDetail(item, key, fallback = 'N/A') {
    const value = item?.details?.[key] ?? item?.[key];
    if (value === null || value === undefined || value === '') {
        return fallback;
    }
    return value;
}

export function ComparisonPanel() {
    const navigate = useNavigate();
    const [product1, setProduct1] = useState('');
    const [product2, setProduct2] = useState('');
    const [comparison, setComparison] = useState(null);
    const [comparedProducts, setComparedProducts] = useState([]);
    const [suggestions1, setSuggestions1] = useState([]);
    const [suggestions2, setSuggestions2] = useState([]);
    const [totalProducts, setTotalProducts] = useState(0);
    const [showSuggest1, setShowSuggest1] = useState(false);
    const [showSuggest2, setShowSuggest2] = useState(false);
    const [activeSuggest1, setActiveSuggest1] = useState(-1);
    const [activeSuggest2, setActiveSuggest2] = useState(-1);
    const [showComparedCards, setShowComparedCards] = useState(false);
    const [screenReaderNote, setScreenReaderNote] = useState('');
    const [reduceMotion, setReduceMotion] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const inputOneRef = useRef(null);
    const inputTwoRef = useRef(null);
    const previousFocusRef = useRef(null);
    const suppressFocusOneRef = useRef(false);
    const suppressFocusTwoRef = useRef(false);

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduceMotion(media.matches);

        const onChange = (event) => setReduceMotion(event.matches);
        media.addEventListener?.('change', onChange);
        return () => media.removeEventListener?.('change', onChange);
    }, []);

    useEffect(() => {
        if (showSuggest1 || showSuggest2) {
            previousFocusRef.current = document.activeElement;
            return;
        }

        if (previousFocusRef.current) {
            if (document.activeElement === document.body) {
                suppressFocusOneRef.current = true;
                suppressFocusTwoRef.current = true;
                (inputOneRef.current || inputTwoRef.current)?.focus();
            }
            previousFocusRef.current = null;
        }
    }, [showSuggest1, showSuggest2]);

    useEffect(() => {
        if (!(showSuggest1 || showSuggest2)) {
            return;
        }

        const onTrapTab = (event) => {
            if (event.key !== 'Tab') {
                return;
            }

            if (showSuggest1 && suggestions1.length > 0) {
                event.preventDefault();
                setActiveSuggest1((prev) => {
                    if (event.shiftKey) {
                        return prev <= 0 ? suggestions1.length - 1 : prev - 1;
                    }
                    return (prev + 1) % suggestions1.length;
                });
                return;
            }

            if (showSuggest2 && suggestions2.length > 0) {
                event.preventDefault();
                setActiveSuggest2((prev) => {
                    if (event.shiftKey) {
                        return prev <= 0 ? suggestions2.length - 1 : prev - 1;
                    }
                    return (prev + 1) % suggestions2.length;
                });
            }
        };

        document.addEventListener('keydown', onTrapTab);
        return () => document.removeEventListener('keydown', onTrapTab);
    }, [showSuggest1, showSuggest2, suggestions1.length, suggestions2.length]);

    useEffect(() => {
        if (showSuggest1 && activeSuggest1 >= 0 && suggestions1[activeSuggest1]) {
            const item = suggestions1[activeSuggest1];
            setScreenReaderNote(`First product highlighted ${item.name}. Rating ${item.rating ?? 'N/A'}.`);
        }
    }, [activeSuggest1, showSuggest1, suggestions1]);

    useEffect(() => {
        if (showSuggest2 && activeSuggest2 >= 0 && suggestions2[activeSuggest2]) {
            const item = suggestions2[activeSuggest2];
            setScreenReaderNote(`Second product highlighted ${item.name}. Rating ${item.rating ?? 'N/A'}.`);
        }
    }, [activeSuggest2, showSuggest2, suggestions2]);

    const selectSuggestion1 = (item) => {
        setProduct1(item?.name || '');
        setShowSuggest1(false);
        setActiveSuggest1(-1);
        if (item?.name) {
            setScreenReaderNote(`Selected first product ${item.name}`);
        }
    };

    const selectSuggestion2 = (item) => {
        setProduct2(item?.name || '');
        setShowSuggest2(false);
        setActiveSuggest2(-1);
        if (item?.name) {
            setScreenReaderNote(`Selected second product ${item.name}`);
        }
    };

    useEffect(() => {
        const handler = setTimeout(async () => {
            try {
                const data = await orderService.getProductSuggestions(product1.trim(), 6);
                setSuggestions1(data.suggestions || []);
                setTotalProducts(data.total_products || 0);
            } catch (_err) {
                setSuggestions1([]);
            }
        }, 220);
        return () => clearTimeout(handler);
    }, [product1]);

    useEffect(() => {
        const handler = setTimeout(async () => {
            try {
                const data = await orderService.getProductSuggestions(product2.trim(), 6);
                setSuggestions2(data.suggestions || []);
                if (!totalProducts) {
                    setTotalProducts(data.total_products || 0);
                }
            } catch (_err) {
                setSuggestions2([]);
            }
        }, 220);
        return () => clearTimeout(handler);
    }, [product2, totalProducts]);

    const handleCompare = async () => {
        if (!product1.trim() || !product2.trim()) return;

        try {
            setLoading(true);
            setError(null);
            setShowComparedCards(false);
            const response = await chatService.compareProducts(product1, product2);
            setComparison(response.comparison);
            setComparedProducts(Array.isArray(response.compared_products) ? response.compared_products : []);
            setScreenReaderNote(`Comparison loaded for ${product1} and ${product2}`);
            requestAnimationFrame(() => setShowComparedCards(true));
        } catch (err) {
            setError(err.message);
            setScreenReaderNote('Comparison failed to load');
        } finally {
            setLoading(false);
        }
    };

    const ratingWinner = comparedProducts.length === 2
        ? (Number(comparedProducts[0].rating || 0) === Number(comparedProducts[1].rating || 0)
            ? 'Tie'
            : Number(comparedProducts[0].rating || 0) > Number(comparedProducts[1].rating || 0)
                ? comparedProducts[0].name
                : comparedProducts[1].name)
        : 'N/A';

    const priceWinner = comparedProducts.length === 2
        ? (() => {
            const first = extractNumericPrice(comparedProducts[0].price, comparedProducts[0].price_usd);
            const second = extractNumericPrice(comparedProducts[1].price, comparedProducts[1].price_usd);
            if (!Number.isFinite(first) || !Number.isFinite(second) || first === second) {
                return 'Tie';
            }
            return first < second ? comparedProducts[0].name : comparedProducts[1].name;
        })()
        : 'N/A';

    const compareSuggestStatus = [
        showSuggest1 ? `${suggestions1.length} suggestions for first product.` : 'First product suggestions closed.',
        showSuggest2 ? `${suggestions2.length} suggestions for second product.` : 'Second product suggestions closed.'
    ].join(' ');

    return (
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-900/60 p-6 md:p-8 shadow-xl shadow-slate-200/40 dark:shadow-slate-950/40" aria-busy={loading}>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Product Comparison Studio</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">Pick two products from your dataset and compare with AI and sales metrics.</p>
            <p id="compare-keyboard-help" className="sr-only">Use arrow keys to navigate suggestions, Enter to pick, Home or End to jump, Escape to close.</p>
            <div id="compare-live-status" className="sr-only" aria-live="polite" aria-atomic="true">{screenReaderNote || compareSuggestStatus}</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div className="md:col-span-2 flex items-center justify-end">
                    <label className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={reduceMotion}
                            onChange={(e) => setReduceMotion(e.target.checked)}
                            className="rounded border-slate-300"
                        />
                        Reduce motion
                    </label>
                </div>
                <div className="relative">
                    <input
                        id="compare-product-1-input"
                        ref={inputOneRef}
                        type="text"
                        value={product1}
                        onChange={(e) => {
                            setProduct1(e.target.value);
                            setShowSuggest1(true);
                            setActiveSuggest1(-1);
                        }}
                        onFocus={() => {
                            if (suppressFocusOneRef.current) {
                                suppressFocusOneRef.current = false;
                                return;
                            }
                            setShowSuggest1(true);
                        }}
                        onBlur={() => setTimeout(() => setShowSuggest1(false), 220)}
                        onKeyDown={(e) => {
                            if (!showSuggest1 || suggestions1.length === 0) {
                                return;
                            }
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setActiveSuggest1((prev) => (prev + 1) % suggestions1.length);
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setActiveSuggest1((prev) => (prev <= 0 ? suggestions1.length - 1 : prev - 1));
                            } else if (e.key === 'Home') {
                                e.preventDefault();
                                setActiveSuggest1(0);
                            } else if (e.key === 'End') {
                                e.preventDefault();
                                setActiveSuggest1(suggestions1.length - 1);
                            } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (activeSuggest1 >= 0 && suggestions1[activeSuggest1]) {
                                    selectSuggestion1(suggestions1[activeSuggest1]);
                                }
                            } else if (e.key === 'Tab') {
                                e.preventDefault();
                                setActiveSuggest1((prev) => {
                                    if (e.shiftKey) {
                                        return prev <= 0 ? suggestions1.length - 1 : prev - 1;
                                    }
                                    return (prev + 1) % suggestions1.length;
                                });
                            } else if (e.key === 'Escape') {
                                setShowSuggest1(false);
                                setActiveSuggest1(-1);
                            }
                        }}
                        placeholder="Product 1 (e.g., AirPods Pro 2)"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={showSuggest1 && suggestions1.length > 0}
                        aria-controls="compare-product-1-listbox"
                        aria-activedescendant={activeSuggest1 >= 0 ? `compare-product-1-option-${activeSuggest1}` : undefined}
                        aria-describedby="compare-keyboard-help compare-meta-note"
                        aria-label="Select first product"
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    {showSuggest1 && suggestions1.length > 0 && (
                        <div
                            id="compare-product-1-listbox"
                            role="listbox"
                            aria-label="First product suggestions"
                            className="absolute z-40 left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-auto"
                        >
                            {suggestions1.map((item, idx) => (
                                <button
                                    id={`compare-product-1-option-${idx}`}
                                    key={`${item.product_id || item.name}-1`}
                                    type="button"
                                    role="option"
                                    aria-selected={idx === activeSuggest1}
                                    onClick={() => selectSuggestion1(item)}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        selectSuggestion1(item);
                                    }}
                                    onMouseEnter={() => setActiveSuggest1(idx)}
                                    className={`w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${idx === activeSuggest1
                                        ? 'bg-slate-200 dark:bg-slate-700'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <p className="text-sm font-semibold line-clamp-1">{item.name}</p>
                                    <p className="text-xs text-slate-500">{item.category} | Rating {item.rating ?? 'N/A'}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="relative">
                    <input
                        id="compare-product-2-input"
                        ref={inputTwoRef}
                        type="text"
                        value={product2}
                        onChange={(e) => {
                            setProduct2(e.target.value);
                            setShowSuggest2(true);
                            setActiveSuggest2(-1);
                        }}
                        onFocus={() => {
                            if (suppressFocusTwoRef.current) {
                                suppressFocusTwoRef.current = false;
                                return;
                            }
                            setShowSuggest2(true);
                        }}
                        onBlur={() => setTimeout(() => setShowSuggest2(false), 220)}
                        onKeyDown={(e) => {
                            if (!showSuggest2 || suggestions2.length === 0) {
                                return;
                            }
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setActiveSuggest2((prev) => (prev + 1) % suggestions2.length);
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setActiveSuggest2((prev) => (prev <= 0 ? suggestions2.length - 1 : prev - 1));
                            } else if (e.key === 'Home') {
                                e.preventDefault();
                                setActiveSuggest2(0);
                            } else if (e.key === 'End') {
                                e.preventDefault();
                                setActiveSuggest2(suggestions2.length - 1);
                            } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (activeSuggest2 >= 0 && suggestions2[activeSuggest2]) {
                                    selectSuggestion2(suggestions2[activeSuggest2]);
                                }
                            } else if (e.key === 'Tab') {
                                e.preventDefault();
                                setActiveSuggest2((prev) => {
                                    if (e.shiftKey) {
                                        return prev <= 0 ? suggestions2.length - 1 : prev - 1;
                                    }
                                    return (prev + 1) % suggestions2.length;
                                });
                            } else if (e.key === 'Escape') {
                                setShowSuggest2(false);
                                setActiveSuggest2(-1);
                            }
                        }}
                        placeholder="Product 2 (e.g., iPad 11-inch)"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={showSuggest2 && suggestions2.length > 0}
                        aria-controls="compare-product-2-listbox"
                        aria-activedescendant={activeSuggest2 >= 0 ? `compare-product-2-option-${activeSuggest2}` : undefined}
                        aria-describedby="compare-keyboard-help compare-meta-note"
                        aria-label="Select second product"
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    {showSuggest2 && suggestions2.length > 0 && (
                        <div
                            id="compare-product-2-listbox"
                            role="listbox"
                            aria-label="Second product suggestions"
                            className="absolute z-40 left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-auto"
                        >
                            {suggestions2.map((item, idx) => (
                                <button
                                    id={`compare-product-2-option-${idx}`}
                                    key={`${item.product_id || item.name}-2`}
                                    type="button"
                                    role="option"
                                    aria-selected={idx === activeSuggest2}
                                    onClick={() => selectSuggestion2(item)}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        selectSuggestion2(item);
                                    }}
                                    onMouseEnter={() => setActiveSuggest2(idx)}
                                    className={`w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${idx === activeSuggest2
                                        ? 'bg-slate-200 dark:bg-slate-700'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <p className="text-sm font-semibold line-clamp-1">{item.name}</p>
                                    <p className="text-xs text-slate-500">{item.category} | Rating {item.rating ?? 'N/A'}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6">
                Total products available in sales data: {Number(totalProducts).toLocaleString()}
            </p>
            <p id="compare-meta-note" className="sr-only">Total product count in dataset is {Number(totalProducts).toLocaleString()}.</p>

            <button
                onClick={handleCompare}
                disabled={loading || !product1.trim() || !product2.trim()}
                className="w-full bg-gradient-to-r from-teal-600 to-blue-600 text-white py-2.5 rounded-xl hover:from-teal-700 hover:to-blue-700 disabled:opacity-50 mb-6 font-semibold"
            >
                {loading ? 'Comparing...' : 'Compare Products'}
            </button>

            {error && (
                <div className="p-4 bg-red-100 text-red-700 rounded mb-4">
                    Error: {error}
                </div>
            )}

            {comparison && (
                <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold mb-3">{product1} vs {product2}</h3>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                        {comparison}
                    </div>
                </div>
            )}

            {comparedProducts.length === 2 && (
                <div className="sticky top-16 z-30 mt-4 rounded-xl border border-cyan-200 dark:border-cyan-900 bg-white/95 dark:bg-slate-900/95 backdrop-blur p-3 shadow-lg" role="status" aria-live="polite">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                        <span className="font-black text-cyan-700 dark:text-cyan-300">Quick Winner Summary</span>
                        <span className="px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-semibold">Best Rating: {ratingWinner}</span>
                        <span className="px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 font-semibold">Best Price (INR): {priceWinner}</span>
                    </div>
                </div>
            )}

            {comparedProducts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {comparedProducts.map((item, idx) => (
                        <div
                            key={`${item.product_id || item.name}`}
                            className={`bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3 ${reduceMotion ? '' : 'transition-all duration-500'} ${showComparedCards ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                            style={{ transitionDelay: reduceMotion ? '0ms' : `${idx * 100}ms` }}
                        >
                            {item.image_link && (
                                <div className="relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700 h-40">
                                    <img
                                        src={item.image_link}
                                        alt={item.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://via.placeholder.com/320x180?text=No+Image';
                                        }}
                                    />
                                </div>
                            )}

                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-xs uppercase font-semibold text-slate-500">{item.category}</p>
                                <span className={`text-xs px-3 py-1.5 rounded-full font-extrabold tracking-wide ${item.match_type === 'exact'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                    }`}>
                                    {item.match_type === 'exact' ? 'EXACT MATCH' : 'CLOSEST MATCH'}
                                </span>
                            </div>
                            <h4 className="font-bold line-clamp-2">{item.name}</h4>
                            <p className="text-sm">Rating: <span className="font-semibold text-yellow-500">{item.rating} ★</span></p>
                            <p className="text-sm">Price: <span className="font-semibold text-orange-500">{toInrLabel(item.price, item.price_usd)}</span></p>
                            <p className="text-sm">Original: <span className="font-semibold text-slate-600 dark:text-slate-200">{pickDetail(item, 'original_price', item.original_price || 'N/A')}</span></p>

                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300 border-t border-b border-slate-200 dark:border-slate-700 py-2">
                                <p>Reviews: <span className="font-semibold">{item.details?.reviews || item.reviews ? Number(item.details?.reviews || item.reviews).toLocaleString() : 'N/A'}</span></p>
                                <p>Discount: <span className="font-semibold">{item.details?.discount_percentage || item.discount_percentage ? `${item.details?.discount_percentage || item.discount_percentage}%` : '0%'}</span></p>
                                <p>Last Month: <span className="font-semibold">{item.details?.purchased_last_month || item.purchased_last_month ? Number(item.details?.purchased_last_month || item.purchased_last_month).toLocaleString() : 'N/A'}</span></p>
                                <p>Delivery: <span className="font-semibold">{item.details?.expected_delivery_date || item.expected_delivery_date || 'N/A'}</span></p>
                            </div>

                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/50">
                                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-2">Complete Product Details</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-300">
                                    <p>Product ID: <span className="font-semibold break-all">{pickDetail(item, 'product_id')}</span></p>
                                    <p>Category: <span className="font-semibold">{pickDetail(item, 'category')}</span></p>
                                    <p>Price (INR): <span className="font-semibold">{toInrLabel(item.price, item.price_usd)}</span></p>
                                    <p>Price (USD): <span className="font-semibold">{item.price_usd ?? 'N/A'}</span></p>
                                    <p>Rating: <span className="font-semibold">{pickDetail(item, 'rating')}</span></p>
                                    <p>Reviews: <span className="font-semibold">{item.details?.reviews || item.reviews ? Number(item.details?.reviews || item.reviews).toLocaleString() : 'N/A'}</span></p>
                                    <p>Discount: <span className="font-semibold">{item.details?.discount_percentage || item.discount_percentage ? `${item.details?.discount_percentage || item.discount_percentage}%` : '0%'}</span></p>
                                    <p>Purchased Last Month: <span className="font-semibold">{item.details?.purchased_last_month || item.purchased_last_month ? Number(item.details?.purchased_last_month || item.purchased_last_month).toLocaleString() : 'N/A'}</span></p>
                                    <p>Best Seller: <span className="font-semibold">{pickDetail(item, 'is_best_seller', 'No Badge')}</span></p>
                                    <p>Sponsored: <span className="font-semibold">{pickDetail(item, 'is_sponsored', 'Organic')}</span></p>
                                    <p>Coupon: <span className="font-semibold">{pickDetail(item, 'has_coupon', 'No Coupon')}</span></p>
                                    <p>Buy Box: <span className="font-semibold">{pickDetail(item, 'buy_box_availability')}</span></p>
                                    <p>Sustainability: <span className="font-semibold">{pickDetail(item, 'sustainability_tags')}</span></p>
                                    <p>Order Date: <span className="font-semibold">{pickDetail(item, 'order_placed_date')}</span></p>
                                    <p>Expected Delivery: <span className="font-semibold">{pickDetail(item, 'expected_delivery_date')}</span></p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {(item.details?.is_best_seller || item.is_best_seller) && String(item.details?.is_best_seller || item.is_best_seller).toLowerCase() !== 'no badge' && (
                                    <span className="text-[11px] px-2 py-1 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300 font-semibold">⭐ {(item.details?.is_best_seller || item.is_best_seller)}</span>
                                )}
                                {(item.details?.has_coupon || item.has_coupon) && String(item.details?.has_coupon || item.has_coupon).toLowerCase() !== 'no coupon' && (
                                    <span className="text-[11px] px-2 py-1 rounded bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300 font-semibold">🏷️ {(item.details?.has_coupon || item.has_coupon)}</span>
                                )}
                                {(item.details?.is_sponsored || item.is_sponsored) && String(item.details?.is_sponsored || item.is_sponsored).toLowerCase() !== 'organic' && (
                                    <span className="text-[11px] px-2 py-1 rounded bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 font-semibold">Sponsored</span>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {item.product_id && (
                                    <button
                                        onClick={() => navigate(`/products/${encodeURIComponent(item.product_id)}`)}
                                        className="w-full sm:flex-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold py-2 rounded text-sm"
                                    >
                                        View Details
                                    </button>
                                )}
                                {item.product_page_url && (
                                    <a
                                        href={item.product_page_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full sm:flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded text-sm text-center"
                                    >
                                        Amazon Page
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
