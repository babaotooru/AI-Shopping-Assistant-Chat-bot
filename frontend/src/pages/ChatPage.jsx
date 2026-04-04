import { ChatBox } from '../components/ChatBox';

export function ChatPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">Live Support Chat</h1>
                <p className="text-slate-600 dark:text-slate-300">Manage visitor chats, order questions, and quick replies in one workspace</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="h-[78vh] min-h-[620px]">
                    <ChatBox />
                </div>
            </div>
        </div>
    );
}
