"use client";

import { useState } from "react";
import type { ChatSession } from "@/types/chat";
import { useTheme } from "@/contexts/ThemeContext";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionSelect: (sessionId: string) => void;
  currentSessionId: string | null;
}

export default function Sidebar({
  isOpen,
  onClose,
  onSessionSelect,
  currentSessionId,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [displayCount, setDisplayCount] = useState(10);
  const [loading, setLoading] = useState(false);

  // 仮のセッションデータ（実際はAPIから取得）
  // 注: サーバー/クライアント間でハイドレーションエラーを防ぐため、決定的なデータを使用
  const mockSessions: ChatSession[] = Array.from({ length: 25 }, (_, i) => ({
    id: `session-${i + 1}`,
    title: `チャット ${i + 1}`,
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
    updated_at: new Date(Date.now() - i * 86400000).toISOString(),
    message_count: (i % 10) + 5, // 決定的な値（5-14の範囲）
    preview: `サンプルメッセージ ${i + 1}の内容です...`,
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

        {/* チャット履歴セクションタイトル */}
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            チャット履歴
          </h2>
        </div>

        {/* セッションリスト */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
