"use client";

import React from "react";

/**
 * ProgressBar Props
 */
interface ProgressBarProps {
  status: "optimizing" | "searching" | "reranking" | "generating" | null;
  progress: number; // 0-100
  message?: string;
  metadata?: {
    search_time_ms?: number;
    generation_time_ms?: number;
    total_time_ms?: number;
  };
  elapsedTime?: number; // ミリ秒
  onCancel?: () => void;
}

/**
 * Stage Props
 */
interface StageProps {
  label: string;
  icon?: string;
  active: boolean;
  done: boolean;
}

/**
 * ステータスメッセージを取得
 */
function getStatusMessage(status: string | null, customMessage?: string): string {
  if (customMessage) return customMessage;

  const messages: Record<string, string> = {
    optimizing: "プロンプトを最適化中...",
    searching: "情報を検索中...",
    reranking: "結果を最適化中...",
    generating: "回答を生成中...",
  };

  return messages[status || ""] || "処理中...";
}

/**
 * ステージコンポーネント
 */
const Stage: React.FC<StageProps> = ({ label, icon, active, done }) => {
  return (
    <div
      className={`flex flex-col items-center gap-1 ${
        active ? "scale-110" : "scale-100"
      } transition-transform duration-300`}
    >
      {/* アイコン */}
      <div
        className={`
        w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
        ${active ? "bg-blue-600 dark:bg-blue-500 text-white scale-110 shadow-lg" : ""}
        ${done ? "bg-green-500 dark:bg-green-600 text-white" : ""}
        ${!active && !done ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500" : ""}
        transition-all duration-300
      `}
      >
        {done ? "✓" : icon || label.charAt(0)}
      </div>

      {/* ラベル */}
      <span
        className={`text-xs font-medium ${
          active
            ? "text-blue-600 dark:text-blue-400"
            : done
            ? "text-green-600 dark:text-green-400"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
};

/**
 * 進捗バーコンポーネント（V3対応）
 *
 * SSEステータス同期のポップアップ進捗バーを表示します。
 *
 * @param props - ProgressBarProps
 *
 * @example
 * ```tsx
 * <ProgressBar
 *   status="searching"
 *   progress={30}
 *   message="情報を検索中..."
 *   elapsedTime={1500}
 *   onCancel={handleCancel}
 * />
 * ```
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  status,
  progress,
  message,
  metadata,
  elapsedTime,
  onCancel,
}) => {
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-[90%] sm:w-[400px] md:w-[450px]">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
        {/* ヘッダー: ステータスメッセージ + 進捗% */}
        <div className="flex items-center justify-between mb-3">
          {/* 左: アイコン + メッセージ */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 dark:border-blue-400 border-t-transparent" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {getStatusMessage(status, message)}
            </span>
          </div>

          {/* 右: 進捗% */}
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400 ml-2">
            {progress}%
          </span>
        </div>

        {/* 進捗バー */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 h-2 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ステージインジケーター */}
        <div className="flex items-center gap-2 mb-3">
          <Stage
            label="最適化"
            icon="✨"
            active={status === "optimizing"}
            done={["searching", "reranking", "generating"].includes(status || "")}
          />
          <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600" />
          <Stage
            label="検索"
            icon="🔍"
            active={status === "searching"}
            done={["reranking", "generating"].includes(status || "")}
          />
          <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600" />
          <Stage
            label="最適化"
            icon="⚡"
            active={status === "reranking"}
            done={status === "generating"}
          />
          <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600" />
          <Stage
            label="生成"
            icon="✍️"
            active={status === "generating"}
            done={false}
          />
        </div>

        {/* フッター: 経過時間 + 中止ボタン */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          {/* 左: 経過時間 */}
          <div className="text-xs text-gray-500 dark:text-gray-400 space-x-2">
            {elapsedTime !== undefined && (
              <span>経過時間: {(elapsedTime / 1000).toFixed(1)}秒</span>
            )}
            {metadata?.search_time_ms && (
              <span className="hidden sm:inline">
                （検索: {(metadata.search_time_ms / 1000).toFixed(2)}秒）
              </span>
            )}
          </div>

          {/* 右: 中止ボタン */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              中止
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
