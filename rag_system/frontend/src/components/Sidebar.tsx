"use client";

import { useState } from "react";
import type { ChatSession } from "@/types/chat";
import { useTheme } from "@/contexts/ThemeContext";
import { useClients } from "@/contexts/ClientsContext";
import ClientAutocomplete from "./ClientAutocomplete";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionSelect: (sessionId: string) => void;
  currentSessionId: string | null;
}

type TabType = "history" | "test";

export default function Sidebar({
  isOpen,
  onClose,
  onSessionSelect,
  currentSessionId,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [displayCount, setDisplayCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("history");

  // ClientsContextから利用者データを取得
  const { clients, loading: clientsLoading } = useClients();

  // テストタブ用の状態
  const [testClientId, setTestClientId] = useState<string | null>(null);
  const [testQuery, setTestQuery] = useState("");
  const [testStreaming, setTestStreaming] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string>("");

  // 仮のセッションデータ（実際はAPIから取得）
  // 注: サーバー/クライアント間でハイドレーションエラーを防ぐため、決定的なデータを使用
  const mockSessions: ChatSession[] = Array.from({ length: 25 }, (_, i) => ({
    id: `session-${i + 1}`,
    title: `チャット ${i + 1}`,
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
    updated_at: new Date(Date.now() - i * 86400000).toISOString(),
    message_count: (i % 10) + 5, // 決定的な値（5-14の範囲）
    preview: `サンプルメッセージ ${i + 1}の内容です...`,
    client_id: i % 3 === 0 ? null : `client-${i % 5 + 1}`, // 3つに1つは全利用者、それ以外は特定利用者
    client_name: i % 3 === 0 ? undefined : `利用者${i % 5 + 1}`,
  }));

  const displayedSessions = mockSessions.slice(0, displayCount);
  const hasMore = displayCount < mockSessions.length;

  const loadMore = () => {
    setLoading(true);
    setTimeout(() => {
      setDisplayCount((prev) => Math.min(prev + 5, mockSessions.length));
      setLoading(false);
    }, 300);
  };

  // テスト実行
  const runTest = async () => {
    if (!testQuery.trim()) {
      alert("検索クエリを入力してください");
      return;
    }

    setTestLoading(true);
    setTestResult("");

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const endpoint = testStreaming ? "/chat/stream" : "/chat";
      const url = `${API_URL}${endpoint}`;

      const requestBody = {
        message: testQuery,
        client_id: testClientId || undefined,
        context_size: 5,
        stream: testStreaming,
      };

      if (testStreaming) {
        // ストリーミング処理
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === "text" && data.content) {
                    fullText += data.content;
                    setTestResult(fullText);
                  } else if (data.type === "context") {
                    fullText += `\n[コンテキスト: ${data.context?.length || 0}件]\n\n`;
                    setTestResult(fullText);
                  } else if (data.type === "done") {
                    fullText += `\n\n[完了]`;
                    setTestResult(fullText);
                  }
                } catch (e) {
                  // JSON解析エラーは無視
                }
              }
            }
          }
        }
      } else {
        // 非ストリーミング処理
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const resultText = `[コンテキスト: ${data.context?.length || 0}件]\n\n${data.message?.content || ""}\n\n[完了]`;
        setTestResult(resultText);
      }
    } catch (error) {
      console.error("テスト実行エラー:", error);
      setTestResult(`エラー: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <>
      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static flex flex-col`}
      >
        {/* ヘッダー: ロゴと説明 */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 relative">
          {/* 閉じるボタン（モバイルのみ・右上） */}
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          >
            ✕
          </button>

          {/* ロゴ（中央配置） */}
          <div className="flex flex-col items-center gap-3">
            <img
              src="/f-assistant.png"
              alt="F Assistant"
              className="h-16 w-auto object-contain dark:invert"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              フラクタルのRAG検索ツール
            </p>
          </div>
        </div>

        {/* タブ切り替え */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            チャット履歴
          </button>
          <button
            onClick={() => setActiveTab("test")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "test"
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            APIテスト
          </button>
        </div>

        {/* コンテンツエリア */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* チャット履歴タブ */}
          {activeTab === "history" && (
            <>
              {displayedSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSessionSelect(session.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    currentSessionId === session.id
                      ? "bg-blue-100 dark:bg-blue-900/30 border-blue-500"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800 border-transparent"
                  } border`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white truncate">
                    {session.title}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {session.preview}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {new Date(session.created_at).toLocaleDateString("ja-JP")} · {session.message_count}件
                  </div>
                </button>
              ))}

              {/* もっと読み込むボタン */}
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {loading ? "読み込み中..." : "さらに5件読み込む"}
                </button>
              )}
            </>
          )}

          {/* APIテストタブ */}
          {activeTab === "test" && (
            <div className="space-y-4">
              {/* 利用者選択 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  検索対象利用者
                </label>
                <ClientAutocomplete
                  clients={clients}
                  selectedClientId={testClientId}
                  onSelect={(clientId) => {
                    console.log("[Sidebar] 利用者選択変更:", clientId);
                    setTestClientId(clientId);
                  }}
                  loading={clientsLoading}
                  placeholder="利用者名を入力（カナ・漢字可）"
                  className="text-sm"
                />
                {!clientsLoading && clients.length === 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    利用者データの取得に失敗しました
                  </p>
                )}
              </div>

              {/* 検索クエリ */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  検索クエリ
                </label>
                <textarea
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="質問を入力してください..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* ストリーミング切り替え */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="test-streaming"
                  checked={testStreaming}
                  onChange={(e) => setTestStreaming(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="test-streaming" className="text-sm text-gray-700 dark:text-gray-300">
                  ストリーミング有効
                </label>
              </div>

              {/* 実行ボタン */}
              <button
                onClick={runTest}
                disabled={testLoading}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testLoading ? "実行中..." : "テスト実行"}
              </button>

              {/* 結果表示 */}
              {testResult && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    実行結果
                  </label>
                  <div className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {testResult}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター: 新しいチャット + ユーザー情報 + テーマ切り替え */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* 新しいチャットボタン */}
          <div className="p-4 pb-3">
            <button
              onClick={() => onSessionSelect("new")}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              ＋ 新しいチャット
            </button>
          </div>

          {/* ユーザー情報とテーマ切り替え */}
          <div className="px-4 pb-4 flex items-center justify-between">
            {/* ユーザー情報 */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                U
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  ユーザー
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  user@example.com
                </p>
              </div>
            </div>

            {/* テーマ切り替えボタン */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
              title={theme === "light" ? "ダークモードに切り替え" : "ライトモードに切り替え"}
            >
              {theme === "light" ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
