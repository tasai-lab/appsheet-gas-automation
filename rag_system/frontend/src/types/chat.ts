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
  type: "text" | "context" | "done" | "error";
  content?: string;
  context?: KnowledgeItem[];
  suggested_terms?: string[];
  error?: string;
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
  domain?: string;
  context_ids?: string[];
  context_size?: number;
  stream?: boolean;
}
