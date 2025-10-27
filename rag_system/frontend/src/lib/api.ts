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
 */
export async function* streamChatMessage(
  request: ChatRequest,
  signal?: AbortSignal,
  token?: string | null
): AsyncGenerator<StreamChunk, void, unknown> {
  console.log("[API] streamChatMessage 開始", { request, apiUrl: API_URL, hasToken: !!token });

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

  const response = await fetch(`${API_URL}/chat/stream`, {
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
      if (buffer.length > 0) {
        console.log(`[API] [DEBUG] Raw buffer content (first 300 chars):`, buffer.substring(0, 300));
      }

      // SSEメッセージを解析
      const messages = buffer.split("\n\n");
      buffer = messages.pop() || "";

      for (const message of messages) {
        if (message.trim() === "") continue;

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
            console.error("[API] Failed to parse SSE data:", e, "Raw data:", data);
          }
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
