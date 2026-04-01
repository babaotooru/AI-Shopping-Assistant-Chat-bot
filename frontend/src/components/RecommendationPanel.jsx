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

export function RecommendationPanel() {
    const navigate = useNavigate();
    const [product, setProduct] = useState('');
    const [recommendations, setRecommendations] = useState([]);
    const [searchedProduct, setSearchedProduct] = useState(null);
    const [aiNarrative, setAiNarrative] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [totalProducts, setTotalProducts] = useState(0);
    const [matchedProducts, setMatchedProducts] = useState(0);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const [showRecommendationCards, setShowRecommendationCards] = useState(false);
    const [screenReaderNote, setScreenReaderNote] = useState('');
    const [reduceMotion, setReduceMotion] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);
    const previousFocusRef = useRef(null);
    const suppressFocusOpenRef = useRef(false);

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduceMotion(media.matches);

        const onChange = (event) => setReduceMotion(event.matches);
        media.addEventListener?.('change', onChange);
        return () => media.removeEventListener?.('change', onChange);
    }, []);

    useEffect(() => {
        if (showSuggestions) {
            previousFocusRef.current = document.activeElement;
            return;
        }

        if (previousFocusRef.current && inputRef.current) {
            suppressFocusOpenRef.current = true;
            inputRef.current.focus();
            previousFocusRef.current = null;
        }
    }, [showSuggestions]);

    useEffect(() => {
        if (!showSuggestions || suggestions.length === 0) {
            return;
        }

        const onTrapTab = (event) => {
            if (event.key !== 'Tab') {
                return;
            }
            event.preventDefault();
            setActiveSuggestionIndex((prev) => {
                if (event.shiftKey) {
                    return prev <= 0 ? suggestions.length - 1 : prev - 1;
                }
                return (prev + 1) % suggestions.length;
            });
        };

        document.addEventListener('keydown', onTrapTab);
        return () => document.removeEventListener('keydown', onTrapTab);
    }, [showSuggestions, suggestions.length]);

    const selectSuggestion = (item) => {
        setProduct(item?.name || '');
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
        if (item?.name) {
            setScreenReaderNote(`Selected suggestion ${item.name}`);
        }
    };

    useEffect(() => {
        const handler = setTimeout(async () => {
            try {
                const data = await orderService.getProductSuggestions(product.trim(), 8);
                setSuggestions(data.suggestions || []);
                setTotalProducts(data.total_products || 0);
                setMatchedProducts(data.matched_products || 0);
            } catch (_err) {
                setSuggestions([]);
                setTotalProducts(0);
                setMatchedProducts(0);
            }
        }, 220);

        return () => clearTimeout(handler);
    }, [product]);

    useEffect(() => {
        if (!showSuggestions || suggestions.length === 0) {
            setActiveSuggestionIndex(-1);
            return;
        }
        if (activeSuggestionIndex >= suggestions.length) {
            setActiveSuggestionIndex(0);
        }
    }, [showSuggestions, suggestions, activeSuggestionIndex]);

    useEffect(() => {
        if (!showSuggestions || activeSuggestionIndex < 0 || !suggestions[activeSuggestionIndex]) {
            return;
        }

        const item = suggestions[activeSuggestionIndex];
        setScreenReaderNote(`Highlighted ${item.name}. Rating ${item.rating ?? 'N/A'}. Category ${item.category ?? 'N/A'}.`);
    }, [activeSuggestionIndex, showSuggestions, suggestions]);

    const handleGetRecommendations = async () => {
        if (!product.trim()) return;

        try {
            setLoading(true);
            setError(null);
            setSearchedProduct(null);
            setAiNarrative('');
            setShowRecommendationCards(false);
            const response = await chatService.getRecommendations(product, 5);

            const payload = Array.isArray(response.recommendations) ? response.recommendations : [];
            const searched = payload.find((item) => item.searched_product)?.searched_product || null;
            const narrative = payload.find((item) => item.text)?.text || '';
            const cards = payload.filter((item) => item.name);

            setSearchedProduct(searched);
            setAiNarrative(narrative);
            setRecommendations(cards);
            setScreenReaderNote(`Loaded ${cards.length} recommendation cards for ${product}`);
            requestAnimationFrame(() => setShowRecommendationCards(true));
        } catch (err) {
            setError(err.message);
            setScreenReaderNote('Failed to load recommendations');
        } finally {
            setLoading(false);
        }
    };

    const suggestionAssistText = showSuggestions
        ? `${suggestions.length} suggestions available. Use arrow keys to navigate, Enter to select, Home or End to jump.`
        : 'Suggestion list closed.';

    return (
        <div className="relative overflow-visible rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50/70 dark:from-slate-900 dark:to-slate-900/60 p-6 md:p-8 shadow-xl shadow-slate-200/40 dark:shadow-slate-950/40" aria-busy={loading}>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Smart Product Recommendations</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">Search your sales catalog and get relevant alternatives instantly.</p>
            <p id="recommendation-keyboard-help" className="sr-only">Use arrow keys to move between suggestions, Enter to select, and Escape to close suggestions.</p>
            <div id="recommendation-live-status" className="sr-only" aria-live="polite" aria-atomic="true">{screenReaderNote || suggestionAssistText}</div>

            <div className="space-y-3 mb-6">
                <div className="flex items-center justify-end">
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
                        id="recommendation-product-input"
                        ref={inputRef}
                        type="text"
                        value={product}
                        onChange={(e) => {
                            setProduct(e.target.value);
                            setShowSuggestions(true);
                            setActiveSuggestionIndex(-1);
                        }}
                        onFocus={() => {
                            if (suppressFocusOpenRef.current) {
                                suppressFocusOpenRef.current = false;
                                return;
                            }
                            setShowSuggestions(true);
                        }}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 220)}
                        onKeyDown={(e) => {
                            if (!showSuggestions || suggestions.length === 0) {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleGetRecommendations();
                                }
                                return;
                            }

                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setActiveSuggestionIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
                            } else if (e.key === 'Home') {
                                e.preventDefault();
                                setActiveSuggestionIndex(0);
                            } else if (e.key === 'End') {
                                e.preventDefault();
                                setActiveSuggestionIndex(suggestions.length - 1);
                            } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
                                    selectSuggestion(suggestions[activeSuggestionIndex]);
                                } else {
                                    handleGetRecommendations();
                                }
                            } else if (e.key === 'Tab') {
                                e.preventDefault();
                                setActiveSuggestionIndex((prev) => {
                                    if (e.shiftKey) {
                                        return prev <= 0 ? suggestions.length - 1 : prev - 1;
                                    }
                                    return (prev + 1) % suggestions.length;
                                });
                            } else if (e.key === 'Escape') {
                                setShowSuggestions(false);
                                setActiveSuggestionIndex(-1);
                            }
                        }}
                        placeholder="Search product name from sales data (e.g., AirPods, iPad, Roku)"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={showSuggestions && suggestions.length > 0}
                        aria-controls="recommendation-suggestion-listbox"
                        aria-activedescendant={activeSuggestionIndex >= 0 ? `recommendation-suggestion-${activeSuggestionIndex}` : undefined}
                        aria-describedby="recommendation-keyboard-help recommendation-meta-note"
                        aria-label="Search products for recommendations"
                        className="w-full border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900 rounded-xl px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                        <div
                            id="recommendation-suggestion-listbox"
                            role="listbox"
                            aria-label="Recommendation product suggestions"
                            className="absolute z-40 left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-72 overflow-auto"
                        >
                            {suggestions.map((item, idx) => (
                                <button
                                    id={`recommendation-suggestion-${idx}`}
                                    key={item.product_id || item.name}
                                    type="button"
                                    role="option"
                                    aria-selected={idx === activeSuggestionIndex}
                                    onClick={() => selectSuggestion(item)}
                                    onMouseDown={(e) => {
                                        // Keep focus from leaving input before click is processed.
                                        e.preventDefault();
                                        selectSuggestion(item);
                                    }}
                                    onMouseEnter={() => setActiveSuggestionIndex(idx)}
                                    className={`w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${idx === activeSuggestionIndex
                                        ? 'bg-slate-200 dark:bg-slate-700'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <p className="text-sm font-semibold line-clamp-1">{item.name}</p>
                                    <p className="text-xs text-slate-500">
                                        {item.category} | Rating {item.rating ?? 'N/A'} | {item.total_reviews ? `${Number(item.total_reviews).toLocaleString()} reviews` : 'No reviews'}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                    Sales dataset products: {Number(totalProducts).toLocaleString()} | Matches for current search: {Number(matchedProducts).toLocaleString()}
                </p>
                <p id="recommendation-meta-note" className="sr-only">Dataset contains {Number(totalProducts).toLocaleString()} products and currently matches {Number(matchedProducts).toLocaleString()} products.</p>
                <button
                    onClick={handleGetRecommendations}
                    disabled={loading || !product.trim()}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-2.5 rounded-xl hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50 font-semibold"
                >
                    {loading ? 'Generating...' : 'Get Recommendations'}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-100 text-red-700 rounded mb-4">
                    Error: {error}
                </div>
            )}

            {searchedProduct && (
                <div className={`mb-4 p-4 rounded border ${searchedProduct.match_type === 'exact'
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                    }`}>
                    <h3 className="font-bold mb-2">Searched Product Details</h3>
                    {searchedProduct.match_type !== 'exact' && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                            ⚠️ Exact match for "{product}" not found. Showing similar/related products based on availability.
                        </p>
                    )}
                    <p className="text-sm font-semibold">{searchedProduct.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Category: {searchedProduct.category}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Rating: {searchedProduct.rating} ⭐</p>
                    <p className="text-sm text-green-700 dark:text-green-300">Price (INR): {toInrLabel(searchedProduct.price, searchedProduct.price_usd)}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Reviews: {searchedProduct.details?.reviews ? Number(searchedProduct.details.reviews).toLocaleString() : 'N/A'}</p>
                    {searchedProduct.product_id && (
                        <button
                            onClick={() => navigate(`/products/${encodeURIComponent(searchedProduct.product_id)}`)}
                            className="mt-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold px-3 py-1 rounded"
                        >
                            View Full Details
                        </button>
                    )}
                </div>
            )}

            {recommendations.length > 0 && (
                <div role="region" aria-label="Recommendation results" aria-live="polite">
                    <h3 className="font-bold text-lg mb-4">📦 Related Recommendations</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {recommendations.map((item, idx) => (
                            <div
                                key={`${item.name}-${idx}`}
                                className={`bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg ${reduceMotion ? '' : 'transition-all duration-500'} ${showRecommendationCards ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                                style={{ transitionDelay: reduceMotion ? '0ms' : `${idx * 80}ms` }}
                            >
                                {/* Product Image */}
                                <div className="relative bg-slate-100 dark:bg-slate-700 h-40">
                                    {item.image_link ? (
                                        <img
                                            src={item.image_link}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/300x200?text=No+Image'}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400">📸 No Image</div>
                                    )}
                                    {item.details?.discount_percentage > 0 && (
                                        <div className="absolute top-2 right-2 bg-orange-500 text-white px-2 py-1 rounded text-xs font-bold">
                                            -{item.details.discount_percentage}%
                                        </div>
                                    )}
                                </div>

                                {/* Product Info */}
                                <div className="p-4 space-y-3">
                                    {/* Category Badge */}
                                    <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs font-bold">
                                        {item.category}
                                    </span>

                                    {/* Name */}
                                    <h4 className="font-bold text-sm line-clamp-2 text-slate-900 dark:text-slate-100">
                                        {item.name}
                                    </h4>

                                    {/* Rating */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-yellow-500 text-lg">★</span>
                                        <span className="font-bold text-slate-900 dark:text-slate-100">{item.rating.toFixed(1)}</span>
                                        {item.details?.reviews && (
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                ({Number(item.details.reviews).toLocaleString()})
                                            </span>
                                        )}
                                    </div>

                                    {/* Price */}
                                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-slate-700 dark:to-slate-700 p-3 rounded">
                                        <p className="text-xs text-slate-600 dark:text-slate-300">Price</p>
                                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                            {toInrLabel(item.price, item.price_usd)}
                                        </p>
                                    </div>

                                    {/* Badges */}
                                    <div className="space-y-2">
                                        {item.details?.is_best_seller === 'Yes' && (
                                            <div className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 p-2 rounded flex items-center gap-1">
                                                <span>⭐</span> Amazon's Choice
                                            </div>
                                        )}
                                        {item.details?.has_coupon && item.details.has_coupon !== 'No Coupon' && (
                                            <div className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 p-2 rounded">
                                                🏷️ {item.details.has_coupon}
                                            </div>
                                        )}
                                        {item.details?.purchased_last_month && (
                                            <div className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 p-2 rounded">
                                                Bought last month: {Number(item.details.purchased_last_month).toLocaleString()}+
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        {item.product_id && (
                                            <button
                                                onClick={() => navigate(`/products/${encodeURIComponent(item.product_id)}`)}
                                                className="w-full bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold py-2 px-3 rounded transition-colors text-xs"
                                            >
                                                View Details
                                            </button>
                                        )}
                                        {item.product_page_url && (
                                            <a
                                                href={item.product_page_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-3 rounded transition-colors text-center text-xs"
                                            >
                                                Amazon Page
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {aiNarrative && (
                <div className="mt-4 bg-slate-50 dark:bg-slate-800/70 p-4 rounded border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold mb-3">AI Notes</h3>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                        {aiNarrative}
                    </div>
                </div>
            )}
        </div>
    );
}
