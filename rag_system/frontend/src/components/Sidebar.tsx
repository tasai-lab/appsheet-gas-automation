"use client";

import { useState } from "react";
import type { ChatSession } from "@/types/chat";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

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
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [displayCount, setDisplayCount] = useState(10);
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  // TODO: チャット履歴はバックエンドAPIから取得する実装を追加予定
  // 現在はチャット履歴をSpreadsheetに保存しているが、表示機能は未実装
  const sessions: ChatSession[] = [];

  const displayedSessions = sessions.slice(0, displayCount);
  const hasMore = displayCount < sessions.length;

  const loadMore = () => {
    setLoading(true);
    setTimeout(() => {
      setDisplayCount((prev) => Math.min(prev + 5, sessions.length));
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

        {/* タブ切り替え */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="py-3 px-4 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 text-center">
            チャット履歴
          </div>
        </div>

        {/* コンテンツエリア */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* チャット履歴 */}
          <>
            {displayedSessions.length > 0 ? (
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
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  チャット履歴はありません
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                  新しいチャットを開始してください
                </p>
              </div>
            )}
          </>
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
            {user ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user.displayName || 'ユーザー'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user.email}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  title="ログアウト"
                >
                  ログアウト
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center font-semibold text-sm">
                  ?
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    未ログイン
                  </p>
                  <button
                    onClick={() => router.push('/login')}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    ログイン
                  </button>
                </div>
              </div>
            )}

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
