"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { fetchClients, type ClientInfo } from "@/lib/api";

interface ClientsContextType {
  clients: ClientInfo[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const ClientsContext = createContext<ClientsContextType | undefined>(undefined);

export function ClientsProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("[ClientsContext] 利用者一覧を取得中...");
      const response = await fetchClients();
      console.log(`[ClientsContext] 利用者一覧取得成功: ${response.clients.length}件`);
      setClients(response.clients);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[ClientsContext] 利用者一覧の取得に失敗しました:", error);
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  // 初回マウント時のみ読み込み
  useEffect(() => {
    loadClients();
  }, []); // 空の依存配列 = マウント時のみ実行

  const refetch = async () => {
    await loadClients();
  };

  return (
    <ClientsContext.Provider value={{ clients, loading, error, refetch }}>
      {children}
    </ClientsContext.Provider>
  );
}

export function useClients() {
  const context = useContext(ClientsContext);
  if (context === undefined) {
    throw new Error("useClients must be used within a ClientsProvider");
  }
  return context;
}
