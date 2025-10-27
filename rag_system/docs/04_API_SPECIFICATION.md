# API仕様書

## 1. ベースURL

| 環境 | URL |
|-----|-----|
| 開発 | http://localhost:8000 |
| 本番 | https://rag-backend-xxx.run.app |

## 2. 認証

**方式**: Bearer Token (OAuth2 ID Token)

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6...
```

## 3. エンドポイント一覧

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| POST | /search | Hybrid Search検索 | 必須 |
| POST | /chat/stream | ストリーミングチャット | 必須 |
| POST | /terms/suggest | 代替用語提案 | 必須 |
| POST | /terms/confirm | 用語確認・紐付け | 必須 |
| GET | /health | ヘルスチェック | 不要 |
| GET | /docs | API ドキュメント (Swagger UI) | 不要 |

---

## 4. POST /search

Hybrid Searchによる検索

### Request

**Headers:**
```http
Content-Type: application/json
Authorization: Bearer {token}
```

**Body:**
```json
{
  "query": "バルーンの使用状況を教えて",
  "user_id": "user_001",  // オプション: 特定利用者に絞る
  "top_k": 10,            // オプション: 取得件数 (default: 10)
  "domain": "nursing"     // オプション: ドメイン絞り込み
}
```

**Parameters:**

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| query | string | ✓ | 検索クエリ (1-500文字) |
| user_id | string | - | 利用者ID (指定時はそのユーザーのデータのみ検索) |
| top_k | integer | - | 取得件数 (1-50、default: 10) |
| domain | string | - | ドメイン絞り込み ("nursing", "clients", "calls", "sales") |

### Response

**Status**: 200 OK

```json
{
  "query": "バルーンの使用状況を教えて",
  "results": [
    {
      "kb_id": "KB_nursing_20251020_00145",
      "domain": "nursing",
      "source_type": "care_record",
      "user_id": "user_001",
      "title": "2025-10-20 訪問看護記録",
      "content": "膀胱留置カテーテル交換実施。フォーリー14Fr使用...",
      "structured_data": {
        "vital_signs": {...}
      },
      "date": "2025-10-20",
      "scores": {
        "bm25": 3,
        "dense": 0.8521,
        "rerank": 0.9521
      },
      "highlights": [
        "膀胱留置<mark>カテーテル</mark>交換実施",
        "<mark>バルーン</mark>の状態良好"
      ]
    },
    // ... 9件
  ],
  "total": 145,           // 全候補数 (Stage 1)
  "filtered": 50,         // Stage 2通過数
  "returned": 10,         // 返却数
  "expanded_query": "バルーン;膀胱留置カテーテル;尿道カテーテル;使用状況",
  "processing_time_ms": 1842
}
```

### Error Responses

**400 Bad Request:**
```json
{
  "error": "Bad Request",
  "detail": "queryが空です"
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "detail": "認証トークンが無効です"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal Server Error",
  "detail": "検索処理中にエラーが発生しました"
}
```

---

## 5. POST /chat/stream

ストリーミングチャット (SSE)

### Request

**Headers:**
```http
Content-Type: application/json
Authorization: Bearer {token}
Accept: text/event-stream
```

**Body:**
```json
{
  "message": "最近の訪問時の状態変化は？",
  "user_id": "user_001",     // オプション
  "session_id": "sess_123",  // オプション
  "context_limit": 10        // オプション: コンテキスト件数
}
```

**Parameters:**

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| message | string | ✓ | ユーザーメッセージ (1-1000文字) |
| user_id | string | - | 利用者ID |
| session_id | string | - | セッションID (継続会話用) |
| context_limit | integer | - | コンテキスト件数 (1-20、default: 10) |

### Response (SSE)

**Content-Type**: `text/event-stream`

**Event Types:**

1. **context** - 検索コンテキスト
2. **suggestion** - 用語提案
3. **content** - 生成テキストチャンク
4. **done** - 完了

**Example Stream:**

```
event: context
data: {"type": "context", "data": [{"kb_id": "KB_nursing_20251020_00145", "title": "2025-10-20 訪問看護記録", "score": 0.95}]}

event: content
data: {"type": "content", "data": "最近の"}

event: content
data: {"type": "content", "data": "訪問では"}

event: content
data: {"type": "content", "data": "、利用者の状態に"}

event: content
data: {"type": "content", "data": "大きな変化は"}

event: content
data: {"type": "content", "data": "見られません"}

event: content
data: {"type": "content", "data": "でした。"}

event: done
data: {"type": "done", "data": {"session_id": "sess_123", "message_id": "msg_456"}}
```

**用語提案時:**

```
event: suggestion
data: {"type": "suggestion", "data": {"suggestions": [{"original": "バルーン", "canonical": "膀胱留置カテーテル", "alternatives": ["尿道カテーテル", "Foley"], "category": "医療機器"}]}}
```

### Error in Stream

```
event: error
data: {"type": "error", "data": {"error": "Vertex AI API Error", "detail": "..."}}
```

---

## 6. POST /terms/suggest

代替用語提案取得

### Request

```json
{
  "query": "バルーンの使用状況",
  "search_results": [...]  // /searchの結果
}
```

### Response

**Status**: 200 OK

```json
{
  "has_suggestions": true,
  "suggestions": [
    {
      "original": "バルーン",
      "canonical": "膀胱留置カテーテル",
      "alternatives": [
        "尿道カテーテル",
        "Foley",
        "膀胱カテーテル"
      ],
      "category": "医療機器",
      "frequency": 42
    }
  ]
}
```

**No Suggestions:**
```json
{
  "has_suggestions": false,
  "suggestions": []
}
```

---

## 7. POST /terms/confirm

用語確認・紐付け + 再検索

### Request

```json
{
  "original_query": "バルーンの使用状況を教えて",
  "session_id": "sess_123",
  "user_selections": {
    "バルーン": "膀胱留置カテーテル"
  }
}
```

### Response

**Status**: 200 OK

```json
{
  "new_query": "膀胱留置カテーテルの使用状況を教えて",
  "results": [
    // /searchと同じ形式
  ],
  "term_feedback_saved": true,
  "frequency_updated": true
}
```

---

## 8. GET /health

ヘルスチェック

### Response

**Status**: 200 OK

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-10-27T10:00:00Z",
  "services": {
    "vector_db": "healthy",
    "vertex_ai": "healthy",
    "reranker": "healthy"
  }
}
```

**Unhealthy:**
```json
{
  "status": "unhealthy",
  "version": "1.0.0",
  "timestamp": "2025-10-27T10:00:00Z",
  "services": {
    "vector_db": "unhealthy",
    "vertex_ai": "healthy",
    "reranker": "degraded"
  },
  "errors": [
    "Vector DB connection timeout"
  ]
}
```

---

## 9. レート制限

| エンドポイント | 制限 |
|--------------|------|
| /search | 100リクエスト/分/ユーザー |
| /chat/stream | 20リクエスト/分/ユーザー |
| /terms/* | 50リクエスト/分/ユーザー |

**超過時:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "error": "Rate Limit Exceeded",
  "detail": "1分後に再試行してください"
}
```

---

## 10. CORS設定

**Allowed Origins:**
- `http://localhost:3000` (開発)
- `https://rag-frontend-xxx.vercel.app` (本番)

**Allowed Methods:**
- GET, POST, OPTIONS

**Allowed Headers:**
- Content-Type, Authorization

---

## 11. Webhook (GAS → Backend)

### POST /webhook/sync

GASからのVector DB同期通知 (将来実装)

**Request:**
```json
{
  "event": "record_created",
  "kb_id": "KB_nursing_20251027_00150",
  "domain": "nursing",
  "timestamp": "2025-10-27T10:00:00Z"
}
```

**Response:**
```json
{
  "acknowledged": true,
  "message": "同期通知を受信しました"
}
```

---

## 12. SDKサンプル

### Python

```python
import requests

class RAGClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.token = token

    def search(self, query: str, user_id: str = None, top_k: int = 10):
        url = f"{self.base_url}/search"
        headers = {"Authorization": f"Bearer {self.token}"}
        payload = {"query": query, "user_id": user_id, "top_k": top_k}

        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()

# 使用例
client = RAGClient("https://rag-backend-xxx.run.app", "your_token")
results = client.search("バルーンの使用状況", user_id="user_001")
```

### TypeScript

```typescript
export class RAGClient {
  constructor(
    private baseUrl: string,
    private token: string
  ) {}

  async search(query: string, userId?: string, topK: number = 10) {
    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ query, user_id: userId, top_k: topK })
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    return response.json();
  }

  streamChat(message: string, onChunk: (chunk: any) => void) {
    const eventSource = new EventSource(
      `${this.baseUrl}/chat/stream?message=${encodeURIComponent(message)}`,
      { headers: { 'Authorization': `Bearer ${this.token}` } }
    );

    eventSource.addEventListener('content', (event) => {
      const data = JSON.parse(event.data);
      onChunk(data);
    });

    eventSource.addEventListener('done', () => {
      eventSource.close();
    });
  }
}
```

---

**最終更新**: 2025-10-27
**バージョン**: 1.0.0
