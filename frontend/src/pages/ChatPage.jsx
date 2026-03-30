import { ChatBox } from '../components/ChatBox';

export function ChatPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-4xl font-bold mb-2">🤖 Order Assistant</h1>
                <p className="text-slate-600 dark:text-slate-300">Ask questions about your orders and get instant answers</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="h-96 lg:h-screen lg:max-h-96">
                    <ChatBox />
                </div>
            </div>
        </div>
    );
}
