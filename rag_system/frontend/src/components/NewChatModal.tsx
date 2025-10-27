"use client";

import { useState } from "react";
import ClientAutocomplete from "./ClientAutocomplete";
import type { ClientInfo } from "@/lib/api";

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (clientId: string | null, clientName: string | null) => void;
  clients: ClientInfo[];
  loading: boolean;
}

export default function NewChatModal({
  isOpen,
  onClose,
  onConfirm,
  clients,
  loading,
}: NewChatModalProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedClientId, selectedClientName);
    setSelectedClientId(null);
    setSelectedClientName(null);
  };

  const handleAllClients = () => {
    onConfirm(null, null);
    setSelectedClientId(null);
    setSelectedClientName(null);
  };

  const handleClientSelect = (clientId: string | null) => {
    setSelectedClientId(clientId);
    if (clientId) {
      const client = clients.find((c) => c.id === clientId);
      setSelectedClientName(client?.name || null);
    } else {
      setSelectedClientName(null);
    }
  };

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all duration-200 scale-100">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            新しいチャットを開始
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* 説明 */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          検索対象を選択してください。選択後、このチャットでは選択した対象のみが検索されます。
        </p>

        {/* 全ての利用者ボタン */}
        <button
          onClick={handleAllClients}
          className="w-full py-3 px-4 mb-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
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
          全ての利用者を検索対象にする
        </button>

        {/* 区切り線 */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              または
            </span>
          </div>
        </div>

        {/* 利用者選択 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            特定の利用者を選択
          </label>
          <ClientAutocomplete
            clients={clients}
            selectedClientId={selectedClientId}
            onSelect={handleClientSelect}
            loading={loading}
            placeholder="利用者名を入力してください（カナ・漢字可）"
          />
          {!loading && clients.length === 0 && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              利用者データの取得に失敗しました
            </p>
          )}
        </div>

        {/* 確認ボタン（利用者選択時のみ） */}
        {selectedClientId && (
          <button
            onClick={handleConfirm}
            className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
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
            {selectedClientName} でチャットを開始
          </button>
        )}

        {/* キャンセルボタン */}
        <button
          onClick={onClose}
          className="w-full py-2 px-4 mt-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
