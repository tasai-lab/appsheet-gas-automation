import type { ChatRequest, ChatResponse, StreamChunk } from "@/types/chat";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * 利用者情報型
 */
export interface ClientInfo {
  id: string;
  name: string;
  name_kana: string;
}

export interface ClientListResponse {
  clients: ClientInfo[];
  total: number;
}

/**
 * チャットAPI（非ストリーミング）
 */
export async function sendChatMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * チャットAPI（SSEストリーミング）
 *
 * V2/V3エンドポイントを環境変数で切り替え可能
 */
export async function* streamChatMessage(
  request: ChatRequest,
  signal?: AbortSignal,
  token?: string | null
): AsyncGenerator<StreamChunk, void, unknown> {
  // V3エンドポイント使用フラグ（環境変数で制御）
  const useV3 = process.env.NEXT_PUBLIC_USE_V3_API === 'true';
  const endpoint = useV3 ? '/chat/v3/stream/v3' : '/chat/stream';

  console.log("[API] streamChatMessage 開始", {
    request,
    apiUrl: API_URL,
    endpoint,
    useV3,
    hasToken: !!token
  });

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // 認証トークンがあればAuthorizationヘッダーを追加
  if (token) {
    console.log("[API] Authorization header added");
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    console.warn("[API] ⚠️ No authentication token provided");
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...request, stream: true }),
    signal,
  });

  console.log("[API] Response status:", response.status, response.statusText);

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {
      // JSON parse error, use statusText
    }
    const errorMessage = `Stream API error (${response.status}): ${errorDetail}`;
    console.error("[API]", errorMessage);

    if (response.status === 401) {
      console.error("[API] ❌ 認証エラー: トークンが無効または期限切れです");
    }

    throw new Error(errorMessage);
  }

  if (!response.body) {
    const errorMessage = "Response body is null";
    console.error("[API]", errorMessage);
    throw new Error(errorMessage);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let chunkCount = 0;

  try {
    console.log("[API] ストリーム読み込み開始");
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log("[API] ストリーム完了", { totalChunks: chunkCount });
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // [DEBUG] Rawバッファデバッグログ
      console.log(`[API] [DEBUG] Raw buffer received: ${buffer.length} bytes`);

      // SSEメッセージを解析
      const messages = buffer.split("\n\n");
      console.log(`[API] [DEBUG] Split into ${messages.length} messages (before pop)`);

      buffer = messages.pop() || "";
      console.log(`[API] [DEBUG] Remaining buffer after pop: ${buffer.length} bytes`);

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        if (message.trim() === "") {
          console.log(`[API] [DEBUG] Message #${i} is empty, skipping`);
          continue;
        }

        console.log(`[API] [DEBUG] Processing message #${i} (length: ${message.length})`);
        console.log(`[API] [DEBUG] Message content:`, message.substring(0, 200));

        const lines = message.split("\n");
        let eventType = "message";
        let data = "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            data = line.slice(5).trim();
          }
        }

        if (data) {
          try {
            const chunk: StreamChunk = JSON.parse(data);
            chunkCount++;
            console.log(`[API] Chunk #${chunkCount}:`, chunk.type, chunk.status || "");
            yield chunk;
          } catch (e) {
            console.error("[API] Failed to parse SSE data:", e, "Raw data:", data.substring(0, 100));
          }
        } else {
          console.warn(`[API] [DEBUG] Message #${i} has no data field`);
        }
      }
    }
  } finally {
    reader.releaseLock();
    console.log("[API] Reader released");
  }
}

/**
 * ヘルスチェックAPI
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 利用者一覧取得API
 */
export async function fetchClients(): Promise<ClientListResponse> {
  const response = await fetch(`${API_URL}/clients`);

  if (!response.ok) {
    throw new Error(`Clients API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * チャットセッション型
 */
export interface ChatSessionItem {
  id: string;
  user_id: string;
  title?: string;           // セッションタイトル（最初のメッセージから生成）
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: string;
  preview?: string;         // プレビュー（最後のメッセージの一部）
}

export interface SessionsResponse {
  sessions: ChatSessionItem[];
  total: number;
}

/**
 * セッションメッセージ型
 */
export interface SessionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface SessionMessagesResponse {
  session_id: string;
  messages: SessionMessage[];
  total: number;
}

/**
 * チャットセッション一覧取得API
 */
export async function fetchChatSessions(
  token?: string | null,
  limit: number = 20
): Promise<SessionsResponse> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // 認証トークンがあればAuthorizationヘッダーを追加
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/chat/sessions?limit=${limit}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {
      // JSON parse error
    }
    throw new Error(`Sessions API error (${response.status}): ${errorDetail}`);
  }

  return response.json();
}

/**
 * セッションメッセージ取得API
 */
export async function fetchSessionMessages(
  sessionId: string,
  token?: string | null,
  limit: number = 100
): Promise<SessionMessagesResponse> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/chat/sessions/${sessionId}/messages?limit=${limit}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {
      // JSON parse error
    }
    throw new Error(`Session messages API error (${response.status}): ${errorDetail}`);
  }

  return response.json();
}
