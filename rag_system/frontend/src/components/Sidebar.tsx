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
        {/* ヘッダー: タイトル、説明、ロゴ */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            {/* ロゴとタイトル */}
            <div className="flex items-center gap-3 flex-1">
              <img
                src="/f-assistant.png"
                alt="F Assistant"
                className="h-12 w-auto dark:invert"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  F Assistant
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  フラクタルのRAG検索ツール
                </p>
              </div>
            </div>
            {/* テーマ切り替えと閉じるボタン */}
            <div className="flex gap-1">
              {/* テーマ切り替えボタン */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                title={theme === "light" ? "ダークモードに切り替え" : "ライトモードに切り替え"}
              >
                {theme === "light" ? "🌙" : "☀️"}
              </button>
              {/* 閉じるボタン（モバイルのみ） */}
              <button
                onClick={onClose}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
              >
                ✕
              </button>
            </div>
          </div>
          {/* チャット履歴セクションタイトル */}
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
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

        {/* フッター */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => onSessionSelect("new")}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ＋ 新しいチャット
          </button>
        </div>
      </aside>
    </>
  );
}
