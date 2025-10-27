// チャットメッセージの型定義
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// ナレッジアイテムの型定義
export interface KnowledgeItem {
  id: string;
  domain: string;
  source_type?: string;
  source_table?: string;
  source_id?: string;
  title: string;
  content: string;
  score: number;
  date?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// チャットレスポンスの型定義
export interface ChatResponse {
  session_id: string;
  message: ChatMessage;
  context: KnowledgeItem[];
  suggested_terms?: string[];
  processing_time_ms: number;
}

// ストリームチャンクの型定義
export interface StreamChunk {
  type: "text" | "context" | "done" | "error" | "status";
  content?: string;
  context?: KnowledgeItem[];
  suggested_terms?: string[];
  error?: string;
  status?: "searching" | "reranking" | "generating";
  metadata?: {
    message?: string;
    search_time_ms?: number;
    generation_time_ms?: number;
    total_time_ms?: number;
  };
}

// 検索リクエストの型定義
export interface SearchRequest {
  query: string;
  domain?: string;
  user_id?: string;
  top_k?: number;
  include_embeddings?: boolean;
}

// チャットリクエストの型定義
export interface ChatRequest {
  message: string;
  session_id?: string;
  user_id?: string;
  client_id?: string;
  domain?: string;
  context_ids?: string[];
  context_size?: number;
  stream?: boolean;
}

// チャット履歴セッションの型定義
export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string;
  client_id: string | null; // null = 全ての利用者
  client_name?: string; // 利用者名（表示用）
}

// チャット履歴リストの型定義
export interface ChatHistoryList {
  sessions: ChatSession[];
  total_count: number;
  has_more: boolean;
}
