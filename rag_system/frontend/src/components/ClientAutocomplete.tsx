"use client";

import { useState, useRef, useEffect } from "react";
import type { ClientInfo } from "@/lib/api";

interface ClientAutocompleteProps {
  clients: ClientInfo[];
  selectedClientId: string | null;
  onSelect: (clientId: string | null) => void;
  loading?: boolean;
  placeholder?: string;
  className?: string;
}

export default function ClientAutocomplete({
  clients,
  selectedClientId,
  onSelect,
  loading = false,
  placeholder = "利用者名を入力...",
  className = "",
}: ClientAutocompleteProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredClients, setFilteredClients] = useState<ClientInfo[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // 選択されたクライアントの名前を表示
  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find((c) => c.id === selectedClientId);
      if (client) {
        setInputValue(`${client.name}（${client.name_kana}）`);
      }
    } else {
      setInputValue("");
    }
  }, [selectedClientId, clients]);

  // 入力値が変わったときにフィルタリング
  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredClients(clients);
      return;
    }

    const searchTerm = inputValue.toLowerCase();
    const filtered = clients.filter((client) => {
      const nameMatch = client.name.toLowerCase().includes(searchTerm);
      const kanaMatch = client.name_kana.toLowerCase().includes(searchTerm);
      return nameMatch || kanaMatch;
    });

    setFilteredClients(filtered);
    setHighlightedIndex(-1);
  }, [inputValue, clients]);

  // クリック外を検出してサジェストを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowSuggestions(true);

    // 入力がクリアされたら選択をクリア
    if (!e.target.value.trim()) {
      onSelect(null);
    }
  };

  const handleSelectClient = (client: ClientInfo | null) => {
    if (client) {
      setInputValue(`${client.name}（${client.name_kana}）`);
      onSelect(client.id);
    } else {
      setInputValue("");
      onSelect(null);
    }
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredClients.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredClients.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredClients.length) {
          handleSelectClient(filteredClients[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        disabled={loading}
        placeholder={loading ? "読み込み中..." : placeholder}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {/* サジェストリスト */}
      {showSuggestions && !loading && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {/* すべての利用者オプション */}
          <button
            onClick={() => handleSelectClient(null)}
            className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              highlightedIndex === -1 && !selectedClientId
                ? "bg-blue-100 dark:bg-blue-900/30"
                : ""
            }`}
          >
            <span className="text-gray-900 dark:text-white font-medium">
              すべての利用者
            </span>
          </button>

          {/* フィルタされた利用者リスト */}
          {filteredClients.length > 0 ? (
            filteredClients.map((client, index) => (
              <button
                key={client.id}
                onClick={() => handleSelectClient(client)}
                className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  highlightedIndex === index || selectedClientId === client.id
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : ""
                }`}
              >
                <div className="text-gray-900 dark:text-white">
                  {client.name}
                  <span className="text-gray-500 dark:text-gray-400 ml-2">
                    （{client.name_kana}）
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {client.id}
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-gray-500 dark:text-gray-400 text-sm">
              該当する利用者が見つかりません
            </div>
          )}
        </div>
      )}
    </div>
  );
}
