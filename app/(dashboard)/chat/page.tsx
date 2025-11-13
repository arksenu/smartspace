import { requireAuth } from "@/lib/auth/require-auth";
import { ChatInterface } from "@/components/chat/chat-interface";

export default async function ChatPage() {
  await requireAuth();

  return (
    <div className="container mx-auto p-6 h-full">
      <h1 className="text-3xl font-bold mb-6">Chat</h1>
      <ChatInterface />
    </div>
  );
}

