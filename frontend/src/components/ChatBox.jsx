import { useEffect, useMemo, useState } from 'react';
import { chatService } from '../services';

function formatTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '--:--';
    }

    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function initialsFromName(name) {
    const safe = String(name || '').trim();
    if (!safe) {
        return 'U';
    }

    return safe
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export function ChatBox() {
    const [messages, setMessages] = useState([]);
    const [visitors, setVisitors] = useState([]);
    const [cartItems, setCartItems] = useState([]);
    const [suggestedQuestions, setSuggestedQuestions] = useState([]);
    const [selectedVisitorId, setSelectedVisitorId] = useState('');
    const [currentUserId, setCurrentUserId] = useState('');
    const [loading, setLoading] = useState(false);
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [error, setError] = useState('');
    const [input, setInput] = useState('');
    const [processedOrders, setProcessedOrders] = useState(false);

    const loadDashboard = async (targetUserId = null) => {
        try {
            setDashboardLoading(true);
            const data = await chatService.getDashboard(targetUserId);
            setVisitors((data?.visitors || []).map((visitor) => ({ ...visitor, id: String(visitor.id) })));
            setMessages((data?.messages || []).map((message, index) => ({
                id: message.id || `history-${index}-${message.created_at || Date.now()}`,
                ...message,
            })));
            setCartItems(data?.cart_items || []);
            setSuggestedQuestions(data?.suggested_questions || []);
            setSelectedVisitorId(data?.selected_user_id || '');
            setCurrentUserId(data?.current_user_id || '');
            setError('');
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Unable to load chat dashboard.');
        } finally {
            setDashboardLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, []);

    const handleProcessOrders = async () => {
        try {
            setLoading(true);
            await chatService.processOrders();
            setProcessedOrders(true);
            setMessages((prev) => ([
                ...prev,
                {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: 'Orders processed successfully! You can now ask questions about your orders.',
                    created_at: new Date().toISOString(),
                },
            ]));
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Unable to process orders.');
        } finally {
            setLoading(false);
        }
    };

    const handleVisitorChange = async (visitorId) => {
        if (!visitorId || visitorId === selectedVisitorId) {
            return;
        }
        await loadDashboard(visitorId);
    };

    const handleSendMessage = async () => {
        if (!input.trim()) return;

        const question = input.trim();
        const assistantMessageId = `assistant-${Date.now()}`;
        setMessages((prev) => ([
            ...prev,
            {
                id: `user-${Date.now()}`,
                role: 'user',
                content: question,
                created_at: new Date().toISOString(),
            },
            {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                created_at: new Date().toISOString(),
            },
        ]));
        setInput('');

        try {
            setLoading(true);
            const response = await chatService.askChatbotStream(
                question,
                selectedVisitorId || currentUserId,
                null,
                (partialText) => {
                    setMessages((prev) => prev.map((message) => (
                        message.id === assistantMessageId
                            ? { ...message, content: partialText }
                            : message
                    )));
                },
            );

            setMessages((prev) => ([
                ...prev.map((message) => (
                    message.id === assistantMessageId
                        ? {
                            ...message,
                            content: response || 'I found your request but could not format a detailed answer.',
                        }
                        : message
                )),
            ]));

            setVisitors((prev) => prev.map((visitor) => (
                String(visitor.id) === String(selectedVisitorId || currentUserId)
                    ? {
                        ...visitor,
                        last_message: response || question,
                        last_message_at: new Date().toISOString(),
                    }
                    : visitor
            )));
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Error processing your request.');
        } finally {
            setLoading(false);
        }
    };

    const handleQuickReply = (text) => {
        setInput(text);
    };

    const activeVisitor = useMemo(
        () => visitors.find((visitor) => String(visitor.id) === String(selectedVisitorId)) || visitors[0] || null,
        [visitors, selectedVisitorId],
    );

    const subtotal = cartItems.reduce((sum, item) => {
        const priceNumber = Number(String(item?.price || '').replace(/[^\d.]/g, ''));
        return sum + (Number.isFinite(priceNumber) ? priceNumber : 0) * (item?.quantity || 1);
    }, 0);

    if (dashboardLoading) {
        return (
            <div className="flex h-full items-center justify-center rounded-[28px] bg-[#f4f1f8] text-sm text-slate-500">
                Loading chat workspace...
            </div>
        );
    }

    return (
        <div className="h-full rounded-[28px] bg-[#f4f1f8] p-3 sm:p-4">
            <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-[320px_1fr_320px]">
                <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#e8e3f1] bg-white">
                    <div className="border-b border-slate-100 px-4 py-4">
                        <h2 className="text-[28px] font-semibold tracking-tight text-slate-800">Your visitors</h2>
                        <p className="mt-1 text-xs text-slate-500">Logged-in users ({visitors.length})</p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 py-2">
                        {visitors.map((visitor) => {
                            const active = String(visitor.id) === String(selectedVisitorId);
                            const preview = visitor.last_message || 'No messages yet.';
                            const isCurrentUser = String(visitor.id) === String(currentUserId);
                            return (
                                <button
                                    key={visitor.id}
                                    type="button"
                                    onClick={() => handleVisitorChange(visitor.id)}
                                    className={`mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${active ? 'bg-[#f8f2ea]' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ede8ff] text-xs font-semibold text-[#5d52a8]">
                                        {initialsFromName(visitor.name)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-sm font-semibold text-slate-800">
                                                {visitor.name}
                                                {isCurrentUser ? <span className="ml-1 text-[11px] text-sky-600">(you)</span> : null}
                                            </p>
                                            <p className="shrink-0 text-[11px] text-slate-400">{visitor.last_message_at ? formatTime(visitor.last_message_at) : '--:--'}</p>
                                        </div>
                                        <p className="mt-1 truncate text-xs text-slate-500">{preview}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#e8e3f1] bg-white">
                    <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ede8ff] text-xs font-semibold text-[#5d52a8]">
                                {initialsFromName(activeVisitor?.name)}
                            </div>
                            <div>
                                <p className="text-xl font-semibold text-slate-800">{activeVisitor?.name || 'Visitor'}</p>
                                <p className="text-xs text-slate-500">Live conversation</p>
                            </div>
                        </div>
                        {!processedOrders ? (
                            <button
                                onClick={handleProcessOrders}
                                disabled={loading}
                                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                            >
                                {loading ? 'Processing...' : 'Process Orders'}
                            </button>
                        ) : (
                            <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Orders indexed</span>
                        )}
                    </header>

                    <div className="flex-1 overflow-y-auto bg-[#fbfafc] px-4 py-4">
                        {messages.length === 0 && (
                            <div className="mx-auto max-w-lg rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                                Start with "Process Orders" and ask a customer-style question.
                            </div>
                        )}

                        <div className="space-y-3">
                            {messages.map((msg, idx) => (
                                <div key={msg.id || idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[75%] rounded-xl px-4 py-3 text-sm ${msg.role === 'user'
                                            ? 'bg-[#e9f4ff] text-slate-800'
                                            : 'bg-white text-slate-700 ring-1 ring-slate-100'
                                            }`}
                                    >
                                        <p className="leading-relaxed">{msg.content}</p>
                                        <p className="mt-2 text-right text-[11px] text-slate-400">{formatTime(msg.created_at)}</p>
                                    </div>
                                </div>
                            ))}

                            {loading && (
                                <div className="flex justify-start">
                                    <div className="rounded-xl bg-white px-4 py-2 text-sm text-slate-500 ring-1 ring-slate-100">
                                        Typing...
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-slate-100 bg-white px-4 py-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Type your response and hit enter to send"
                                disabled={loading}
                                className="flex-1 rounded-lg border border-[#cfc5f2] bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#8e7bdf] disabled:opacity-50"
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={loading || !input.trim()}
                                className="rounded-lg bg-[#8e7bdf] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7a67ce] disabled:opacity-50"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </section>

                <aside className="flex h-full flex-col gap-3 overflow-y-auto">
                    <div className="rounded-2xl border border-[#e8e3f1] bg-white p-4">
                        <h3 className="text-sm font-semibold text-slate-800">Visitor details</h3>
                        <dl className="mt-3 space-y-2 text-xs">
                            <div className="flex items-start justify-between gap-2">
                                <dt className="text-slate-500">Geolocation</dt>
                                <dd className="font-medium text-slate-700">Santa Monica, CA</dd>
                            </div>
                            <div className="flex items-start justify-between gap-2">
                                <dt className="text-slate-500">Device</dt>
                                <dd className="font-medium text-slate-700">iPhone X, iOS 12</dd>
                            </div>
                            <div className="flex items-start justify-between gap-2">
                                <dt className="text-slate-500">Current page</dt>
                                <dd className="text-right text-[#5c7fe8]">/shopping-cart/item</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="rounded-2xl border border-[#e8e3f1] bg-white p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-800">Shopping cart items</h3>
                            <button type="button" className="rounded-md bg-[#f2f0ff] px-2 py-1 text-[11px] font-semibold text-[#6b5ab6]">Add items</button>
                        </div>
                        <div className="space-y-3">
                            {cartItems.map((item) => (
                                <article key={item.product_id || item.name} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2">
                                    <div className="h-10 w-10 overflow-hidden rounded-md bg-slate-100">
                                        {item.image_link ? <img src={item.image_link} alt={item.name} className="h-full w-full object-cover" /> : null}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-semibold text-slate-800">{item.name}</p>
                                        <p className="truncate text-[11px] text-slate-500">{item.category}</p>
                                        <p className="text-[11px] text-slate-400">Qty {item.quantity || 1}</p>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-800">{item.price}</p>
                                </article>
                            ))}
                        </div>
                        <p className="mt-3 text-right text-sm font-semibold text-slate-800">Subtotal ${subtotal.toFixed(2)}</p>
                    </div>

                    <div className="rounded-2xl border border-[#e8e3f1] bg-white p-4">
                        <h3 className="text-sm font-semibold text-slate-800">Suggested questions</h3>
                        <div className="mt-3 space-y-2">
                            {suggestedQuestions.map((answer) => (
                                <button
                                    key={answer}
                                    type="button"
                                    onClick={() => handleQuickReply(answer)}
                                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 hover:border-[#cfc5f2] hover:bg-[#f7f4ff]"
                                >
                                    {answer}
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
            {error ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Error: {error}
                </div>
            ) : null}
        </div>
    );
}
