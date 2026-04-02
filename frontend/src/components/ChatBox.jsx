import { useState } from 'react';
import { chatService } from '../services';
import { useChatStore } from '../store';

export function ChatBox() {
    const { messages, loading, addMessage, setLoading, error, setError } = useChatStore();
    const [input, setInput] = useState('');
    const [processedOrders, setProcessedOrders] = useState(false);

    const handleProcessOrders = async () => {
        try {
            setLoading(true);
            await chatService.processOrders();
            setProcessedOrders(true);
            addMessage('bot', 'Orders processed successfully! You can now ask questions about your orders.');
        } catch (err) {
            setError(err.message);
            addMessage('bot', 'Error processing orders. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!input.trim()) return;
        if (!processedOrders) {
            alert('Please process orders first by clicking the button below');
            return;
        }

        addMessage('user', input);
        setInput('');

        try {
            setLoading(true);
            const response = await chatService.queryOrders(input);
            const reply =
                response?.answer ||
                response?.response ||
                (Array.isArray(response?.matches) && response.matches.length > 0
                    ? response.matches.join('\n')
                    : 'I found your request but could not format a detailed answer.');
            addMessage('bot', reply);
        } catch (err) {
            setError(err.message);
            addMessage('bot', 'Error processing your request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-xl font-bold">Order Assistant</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">Ask questions about your orders</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-slate-500 dark:text-slate-400 py-8">
                        <p>No messages yet. Start by processing your orders!</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.role === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                                }`}
                        >
                            <p className="text-sm">{msg.content}</p>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg">
                            <p className="text-sm">Typing...</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                {!processedOrders && (
                    <button
                        onClick={handleProcessOrders}
                        disabled={loading}
                        className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : '🧠 Process Orders'}
                    </button>
                )}

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Ask about your orders..."
                        disabled={!processedOrders || loading}
                        className="flex-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded px-3 py-2 disabled:opacity-50"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!processedOrders || loading || !input.trim()}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                        Send
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-100 text-red-700 text-sm">
                    Error: {error}
                </div>
            )}
        </div>
    );
}
