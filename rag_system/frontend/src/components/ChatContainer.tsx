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
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSendMessage = async (messageText: string) => {
    // ユーザーメッセージを追加
    const userMessage: ChatMessage = {
      role: "user",
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    // AbortControllerを作成
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

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
      }, abortController.signal);

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

      // 中止された場合
      if (error instanceof Error && error.name === "AbortError") {
        setMessages((prev) => {
          const newMessages = [...prev];
          const index = streamingMessageIndexRef.current;
          if (index !== null && newMessages[index]) {
            newMessages[index] = {
              ...newMessages[index],
              content: "処理を中止しました。",
            };
          }
          return newMessages;
        });
      } else {
        // その他のエラー
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
      }
    } finally {
      setLoading(false);
      streamingMessageIndexRef.current = null;
      abortControllerRef.current = null;
    }
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
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
      <div className="flex flex-col flex-1 max-w-6xl mx-auto w-full bg-white dark:bg-gray-900 relative">
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
            aria-label="チャット履歴を開く"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            {/* FRACTALロゴ */}
            <img
              src="/fractal-logo.png"
              alt="FRACTAL"
              className="h-10 w-auto dark:invert"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                F Assistant
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                フラクタルのRAG検索ツール
              </p>
            </div>
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

        {/* ローディング表示と中止ボタン（チャットエリア中央に配置） */}
        {loading && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-10">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>応答を生成中...</span>
            </div>
            <button
              onClick={handleAbort}
              className="px-3 py-1 bg-white text-blue-600 rounded-full hover:bg-gray-100 transition-colors font-medium text-sm"
              aria-label="処理を中止"
            >
              中止
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
