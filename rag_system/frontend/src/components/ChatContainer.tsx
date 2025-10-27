"use client";

import { useState, useRef } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import Context from "./Context";
import Sidebar from "./Sidebar";
import type { ChatMessage, KnowledgeItem } from "@/types/chat";
import { streamChatMessage } from "@/lib/api";

export default function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [context, setContext] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const streamingMessageIndexRef = useRef<number | null>(null);

  const handleSendMessage = async (messageText: string) => {
    // ユーザーメッセージを追加
    const userMessage: ChatMessage = {
      role: "user",
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    // アシスタントメッセージのプレースホルダーを追加
    const assistantMessageIndex = messages.length + 1;
    streamingMessageIndexRef.current = assistantMessageIndex;

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // SSEストリーミングで実装
      const stream = streamChatMessage({
        message: messageText,
        session_id: sessionId || undefined,
        context_size: 5,
      });

      let accumulatedText = "";

      for await (const chunk of stream) {
        if (chunk.type === "context" && chunk.context) {
          // コンテキストを更新
          setContext(chunk.context);
        } else if (chunk.type === "text" && chunk.content) {
          // テキストを蓄積
          accumulatedText += chunk.content;

          // リアルタイムでメッセージを更新
          setMessages((prev) => {
            const newMessages = [...prev];
            const index = streamingMessageIndexRef.current;
            if (index !== null && newMessages[index]) {
              newMessages[index] = {
                ...newMessages[index],
                content: accumulatedText,
              };
            }
            return newMessages;
          });
        } else if (chunk.type === "done") {
          // ストリーミング完了
          if (chunk.suggested_terms) {
            console.log("Suggested terms:", chunk.suggested_terms);
          }
        } else if (chunk.type === "error") {
          console.error("Stream error:", chunk.error);
          throw new Error(chunk.error);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);

      // エラーメッセージで置き換え
      setMessages((prev) => {
        const newMessages = [...prev];
        const index = streamingMessageIndexRef.current;
        if (index !== null && newMessages[index]) {
          newMessages[index] = {
            ...newMessages[index],
            content: "申し訳ございません。エラーが発生しました。",
          };
        }
        return newMessages;
      });
    } finally {
      setLoading(false);
      streamingMessageIndexRef.current = null;
    }
  };

  const handleSessionSelect = (newSessionId: string) => {
    if (newSessionId === "new") {
      // 新しいチャットを開始
      setMessages([]);
      setContext([]);
      setSessionId(null);
    } else {
      // 既存のセッションを読み込む（仮実装）
      setSessionId(newSessionId);
      // TODO: バックエンドからメッセージを取得
    }
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* サイドバー */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSessionSelect={handleSessionSelect}
        currentSessionId={sessionId}
      />

      {/* メインコンテンツ */}
      <div className="flex flex-col flex-1 max-w-6xl mx-auto w-full bg-white dark:bg-gray-900">
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          >
            ☰
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              F Assistant
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              医療・看護記録検索 & チャットアシスタント
            </p>
          </div>
        </div>

        {/* コンテキスト */}
        {context.length > 0 && (
          <div className="p-4">
            <Context items={context} />
          </div>
        )}

        {/* メッセージリスト */}
        <MessageList messages={messages} />

        {/* メッセージ入力 */}
        <MessageInput onSend={handleSendMessage} disabled={loading} />

        {/* ローディング表示 */}
        {loading && (
          <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg">
            応答を生成中...
          </div>
        )}
      </div>
    </div>
  );
}
