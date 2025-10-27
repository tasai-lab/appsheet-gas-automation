import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
        <div className="break-words">
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none
                prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-bold
                prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                prose-p:my-2 prose-p:leading-relaxed
                prose-ul:my-2 prose-ul:list-disc prose-ul:pl-6
                prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-6
                prose-li:my-1
                prose-strong:font-bold prose-strong:text-gray-900 dark:prose-strong:text-gray-100
                prose-code:bg-gray-200 dark:prose-code:bg-gray-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                prose-pre:bg-gray-200 dark:prose-pre:bg-gray-700 prose-pre:p-3 prose-pre:rounded-lg prose-pre:overflow-x-auto
                prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600 prose-blockquote:pl-4 prose-blockquote:italic
                prose-table:border-collapse prose-table:w-full
                prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-th:p-2 prose-th:bg-gray-100 dark:prose-th:bg-gray-800
                prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-td:p-2
                prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <div className="text-xs opacity-70 mt-2">
          {new Date(message.timestamp).toLocaleTimeString("ja-JP")}
        </div>
      </div>
    </div>
  );
}
