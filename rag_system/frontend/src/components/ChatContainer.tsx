"use client";

import { useState, useRef, useEffect } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import Context from "./Context";
import Sidebar from "./Sidebar";
import NewChatModal from "./NewChatModal";
import type { ChatMessage, KnowledgeItem } from "@/types/chat";
import { streamChatMessage } from "@/lib/api";
import { useClients } from "@/contexts/ClientsContext";
import { useAuth } from "@/contexts/AuthContext";

export default function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [context, setContext] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(true); // 初回起動時にモーダル表示
  const [chatStarted, setChatStarted] = useState(false); // チャット開始フラグ
  const streamingMessageIndexRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ステータス表示用の状態
  const [currentStatus, setCurrentStatus] = useState<"searching" | "reranking" | "generating" | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusMetadata, setStatusMetadata] = useState<{ search_time_ms?: number; generation_time_ms?: number; total_time_ms?: number } | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // 認証コンテキストからトークン取得関数を取得
  const { getIdToken } = useAuth();

  // ClientsContextから利用者データを取得
  const { clients, loading: clientsLoading } = useClients();

  // currentStatus変更を監視（デバッグ用）
  useEffect(() => {
    console.log("[ChatContainer] 🔄 currentStatus変更検知:", currentStatus, "statusMessage:", statusMessage);
  }, [currentStatus, statusMessage]);

  // リアルタイム経過時間の更新
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (loading && processingStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - processingStartTime);
      }, 100); // 100msごとに更新
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading, processingStartTime]);

  const handleSendMessage = async (messageText: string) => {
    // 初回メッセージ送信時にチャット開始フラグを立てる
    if (!chatStarted) {
      setChatStarted(true);
    }

    // ユーザーメッセージを追加
    const userMessage: ChatMessage = {
      role: "user",
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    // ステータス初期化
    setCurrentStatus(null);
    setStatusMessage("");
    setStatusMetadata(null);
    setProcessingStartTime(Date.now());
    setElapsedTime(0);

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
      console.log("[ChatContainer] メッセージ送信開始", {
        messageText,
        sessionId,
        selectedClientId
      });

      // 認証トークン取得
      const token = await getIdToken();

      // SSEストリーミングで実装
      const stream = streamChatMessage({
        message: messageText,
        session_id: sessionId || undefined,
        context_size: 5,
        client_id: selectedClientId || undefined,
      }, abortController.signal, token);

      console.log("[ChatContainer] ストリーム取得完了、ループ開始");

      let accumulatedText = "";
      let chunkProcessedCount = 0;

      for await (const chunk of stream) {
        chunkProcessedCount++;
        console.log(`[ChatContainer] Chunk #${chunkProcessedCount} 処理:`, chunk.type);

        if (chunk.type === "status" && chunk.status) {
          // ステータス更新
          console.log("[ChatContainer] ===== ステータス更新受信 =====");
          console.log("[ChatContainer] chunk.status:", chunk.status);
          console.log("[ChatContainer] chunk.metadata:", chunk.metadata);
          console.log("[ChatContainer] 現在のcurrentStatus:", currentStatus);

          setCurrentStatus(chunk.status as "searching" | "reranking" | "generating");
          setStatusMessage(chunk.metadata?.message || "");

          console.log("[ChatContainer] setCurrentStatus 呼び出し完了:", chunk.status);

          if (chunk.metadata?.search_time_ms) {
            setStatusMetadata((prev) => ({
              ...prev,
              search_time_ms: chunk.metadata!.search_time_ms,
            }));
            console.log("[ChatContainer] search_time_ms 更新:", chunk.metadata.search_time_ms);
          }
        } else if (chunk.type === "context" && chunk.context) {
          // コンテキストを更新
          console.log("[ChatContainer] コンテキスト更新:", chunk.context.length, "件");
          setContext(chunk.context);
        } else if (chunk.type === "text" && chunk.content) {
          // テキストを蓄積
          accumulatedText += chunk.content;
          console.log("[ChatContainer] テキスト蓄積:", accumulatedText.length, "文字");

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
          console.log("[ChatContainer] ストリーミング完了", {
            totalChunksProcessed: chunkProcessedCount,
            finalTextLength: accumulatedText.length
          });
          if (chunk.suggested_terms) {
            console.log("Suggested terms:", chunk.suggested_terms);
          }
          if (chunk.metadata) {
            setStatusMetadata({
              search_time_ms: chunk.metadata.search_time_ms,
              generation_time_ms: chunk.metadata.generation_time_ms,
              total_time_ms: chunk.metadata.total_time_ms,
            });
          }
        } else if (chunk.type === "error") {
          console.error("[ChatContainer] ストリームエラー:", chunk.error);
          throw new Error(chunk.error);
        }
      }

      console.log("[ChatContainer] for-await ループ終了");
    } catch (error) {
      console.error("[ChatContainer] エラー発生:", error);

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
      // ステータスリセット
      setCurrentStatus(null);
      setStatusMessage("");
      setProcessingStartTime(null);
      setElapsedTime(0);
    }
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleSessionSelect = (newSessionId: string) => {
    if (newSessionId === "new") {
      // 新しいチャットを開始 - モーダルを表示
      setIsNewChatModalOpen(true);
    } else {
      // 既存のセッションを読み込む（仮実装）
      setSessionId(newSessionId);
      // TODO: バックエンドからメッセージとclient_idを取得
    }
    setSidebarOpen(false);
  };

  const handleNewChatConfirm = (clientId: string | null, clientName: string | null) => {
    // 新しいチャットを開始
    setMessages([]);
    setContext([]);
    setSessionId(null);
    setSelectedClientId(clientId);
    setSelectedClientName(clientName);
    setChatStarted(false);
    setIsNewChatModalOpen(false);
  };

  const handleNewChatCancel = () => {
    // モーダルを閉じる
    setIsNewChatModalOpen(false);
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
        {/* 新規チャット作成モーダル */}
        <NewChatModal
          isOpen={isNewChatModalOpen}
          onClose={handleNewChatCancel}
          onConfirm={handleNewChatConfirm}
          clients={clients}
          loading={clientsLoading}
        />
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-4">
            {/* メニューボタン（モバイルのみ） */}
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

            {/* 検索対象表示（固定） */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                検索対象 {chatStarted && "(固定)"}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg">
                  <div className="flex items-center gap-2">
                    {selectedClientId ? (
                      <>
                        <svg
                          className="w-4 h-4 text-blue-600 dark:text-blue-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {selectedClientName || selectedClientId}
                        </span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4 text-gray-600 dark:text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          全ての利用者
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {chatStarted && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <span>固定</span>
                  </div>
                )}
              </div>
              {chatStarted && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  別の利用者を検索するには、新しいチャットを作成してください
                </p>
              )}
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

        {/* ステータス表示と中止ボタン（下部中央） */}
        {loading && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-2xl shadow-2xl z-10 min-w-[400px]">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                {/* ステータスと経過時間 */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      {statusMessage || "処理中..."}
                      {/* デバッグ用 */}
                      <span className="text-xs opacity-75 ml-2">[{currentStatus || "null"}]</span>
                    </div>
                    <div className="text-xs opacity-90 mt-0.5">
                      経過時間: {(elapsedTime / 1000).toFixed(1)}秒
                    </div>
                  </div>
                </div>

                {/* 処理ステージインジケーター */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-1 flex-1">
                    {/* 検索 */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                      currentStatus === "searching"
                        ? "bg-white text-blue-600 font-semibold"
                        : currentStatus && ["reranking", "generating"].includes(currentStatus)
                        ? "bg-blue-500 text-white opacity-75"
                        : "bg-blue-500 text-white opacity-50"
                    }`}>
                      {currentStatus && ["reranking", "generating"].includes(currentStatus) ? "✓" : "1"}
                      <span className="hidden sm:inline">検索</span>
                    </div>
                    <div className="h-0.5 flex-1 bg-blue-400"></div>

                    {/* リランキング */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                      currentStatus === "reranking"
                        ? "bg-white text-blue-600 font-semibold"
                        : currentStatus === "generating"
                        ? "bg-blue-500 text-white opacity-75"
                        : "bg-blue-500 text-white opacity-50"
                    }`}>
                      {currentStatus === "generating" ? "✓" : "2"}
                      <span className="hidden sm:inline">最適化</span>
                    </div>
                    <div className="h-0.5 flex-1 bg-blue-400"></div>

                    {/* 生成 */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                      currentStatus === "generating"
                        ? "bg-white text-blue-600 font-semibold"
                        : "bg-blue-500 text-white opacity-50"
                    }`}>
                      3
                      <span className="hidden sm:inline">生成</span>
                    </div>
                  </div>
                </div>

                {/* タイミング情報 */}
                {statusMetadata && (statusMetadata.search_time_ms || statusMetadata.generation_time_ms) && (
                  <div className="text-xs opacity-75 mt-2 flex gap-3">
                    {statusMetadata.search_time_ms && (
                      <span>検索: {(statusMetadata.search_time_ms / 1000).toFixed(2)}秒</span>
                    )}
                    {statusMetadata.generation_time_ms && (
                      <span>生成: {(statusMetadata.generation_time_ms / 1000).toFixed(2)}秒</span>
                    )}
                  </div>
                )}
              </div>

              {/* 中止ボタン */}
              <button
                onClick={handleAbort}
                className="px-4 py-2 bg-white text-blue-600 rounded-full hover:bg-gray-100 transition-colors font-medium text-sm whitespace-nowrap shadow-md"
                aria-label="処理を中止"
              >
                中止
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
