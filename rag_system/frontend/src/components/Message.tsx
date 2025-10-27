import type { ChatMessage } from "@/types/chat";

interface MessageProps {
  message: ChatMessage;
}

export default function Message({ message }: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[70%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        }`}
      >
        <div className="text-sm font-semibold mb-1">
          {isUser ? "あなた" : "アシスタント"}
        </div>
        <div className="whitespace-pre-wrap break-words">
          {message.content}
        </div>
        <div className="text-xs opacity-70 mt-2">
          {new Date(message.timestamp).toLocaleTimeString("ja-JP")}
        </div>
      </div>
    </div>
  );
}
