# システムアーキテクチャ設計書

## 1. アーキテクチャ概要

```
┌────────────────────────────────────────────────────────────────────┐
│                          User Layer                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Next.js Frontend (Vercel)                       │  │
│  │  - Chat Interface - User Selector                           │  │
│  │  - Term Suggestion Modal - Streaming Display                │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS / SSE
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │            FastAPI Backend (Cloud Run)                       │  │
│  │  - /chat/stream (SSE) - /search (REST)                      │  │
│  │  - Hybrid Search Engine - Medical Terms Service             │  │
│  │  - Reranker - Vertex AI Client                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│   Vector DB Layer            │  │   Vertex AI Layer            │
│  ┌────────────────────────┐  │  │  ┌────────────────────────┐  │
│  │ Google Spreadsheet     │  │  │  │ gemini-embedding-001   │  │
│  │ ─────────────────────  │  │  │  │ - 3072 dimensions      │  │
│  │ - KnowledgeBase       │  │  │  │ - RETRIEVAL_DOCUMENT   │  │
│  │ - Embeddings          │  │  │  │ - RETRIEVAL_QUERY      │  │
│  │ - MedicalTerms        │  │  │  └────────────────────────┘  │
│  │ - ChatHistory         │  │  │  ┌────────────────────────┐  │
│  └────────────────────────┘  │  │  │ Gemini 2.5 Flash/Pro   │  │
└──────────────────────────────┘  │  │ - Thinking Mode        │  │
                                  │  │ - Streaming Response   │  │
                                  │  └────────────────────────┘  │
                                  └──────────────────────────────┘
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│   Data Source Layer          │  │   Monitoring Layer           │
│  ┌────────────────────────┐  │  │  ┌────────────────────────┐  │
│  │ 15 GAS Projects        │  │  │  │ Cloud Logging          │  │
│  │ ─────────────────────  │  │  │  │ Cloud Monitoring       │  │
│  │ - Nursing (5)          │  │  │  │ Error Reporting        │  │
│  │ - Clients (4)          │  │  │  │ Application Insights   │  │
│  │ - Calls (3)            │  │  │  └────────────────────────┘  │
│  │ - Sales (2)            │  │  └──────────────────────────────┘
│  │ - Automation (1)       │  │
│  │                        │  │
│  │ → syncToVectorDB()    │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

## 2. コンポーネント詳細

### 2.1 Frontend (Next.js on Vercel)

**技術スタック:**
- Framework: Next.js 14 (App Router)
- Language: TypeScript 5+
- UI: Tailwind CSS + shadcn/ui
- State: React Hooks (useState, useEffect)
- Streaming: EventSource API (SSE)

**主要コンポーネント:**

```typescript
frontend/
├── app/
│   ├── layout.tsx               # Root Layout
│   ├── page.tsx                 # Home Page
│   └── chat/
│       └── page.tsx             # Chat Page
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── UserSelector.tsx         # 利用者選択ドロップダウン
│   ├── ChatInterface.tsx        # メインチャットUI
│   ├── MessageList.tsx          # メッセージ一覧表示
│   ├── MessageInput.tsx         # メッセージ入力フォーム
│   ├── TermSuggestionModal.tsx  # 用語提案モーダル
│   └── ContextSources.tsx       # 検索元表示
├── hooks/
│   ├── useStreamingChat.ts      # SSEストリーミング
│   ├── useMedicalTerms.ts       # 用語確認・紐付け
│   └── useSearch.ts             # 検索API
├── lib/
│   ├── api-client.ts            # Backend APIクライアント
│   └── utils.ts                 # ユーティリティ
└── types/
    └── index.ts                 # TypeScript型定義
```

**環境変数:**
```env
NEXT_PUBLIC_API_URL=https://rag-backend-xxx.run.app
NEXT_PUBLIC_APP_NAME=医療RAGシステム
```

### 2.2 Backend (FastAPI on Cloud Run)

**技術スタック:**
- Framework: FastAPI 0.104+
- Language: Python 3.11
- ASGI Server: Uvicorn
- Vector Search: NumPy + Google Sheets API
- Reranking: ⭐ Vertex AI Ranking API (semantic-ranker-default-004)
- Streaming: SSE (Server-Sent Events)

**ディレクトリ構造:**

```python
backend/
├── app/
│   ├── main.py                  # FastAPI アプリケーション
│   ├── config.py                # 設定管理
│   ├── services/
│   │   ├── rag_engine.py        # Hybrid Search
│   │   ├── medical_terms.py     # 医療用語シノニム処理
│   │   ├── reranker.py          # ⭐ Vertex AI Ranking API Reranking
│   │   ├── vertex_ai.py         # Vertex AI クライアント
│   │   └── spreadsheet.py       # Vector DB (Spreadsheet) 接続
│   ├── routers/
│   │   ├── chat.py              # /chat/stream エンドポイント
│   │   ├── search.py            # /search エンドポイント
│   │   └── health.py            # /health エンドポイント
│   ├── models/
│   │   ├── request.py           # リクエストモデル
│   │   └── response.py          # レスポンスモデル
│   └── utils/
│       ├── cosine.py            # コサイン類似度計算
│       ├── bm25.py              # BM25スコアリング
│       └── logger.py            # ロギング
├── requirements.txt
├── Dockerfile
└── README.md
```

**環境変数:**
```env
GCP_PROJECT_ID=fractal-ecosystem
GCP_LOCATION=us-central1
VECTOR_DB_SPREADSHEET_ID=【SpreadsheetID】
GEMINI_MODEL=gemini-2.5-flash
RERANKER_TYPE=vertex_ai_ranking_api
RERANKER_MODEL=semantic-ranker-default-004
LOG_LEVEL=INFO
```

### 2.3 Vector DB (Google Spreadsheet)

**シート構成:**

| シート名 | 行数見込み | 主キー | インデックス |
|---------|-----------|--------|------------|
| KnowledgeBase | 13,500 → 20,000 | id | domain, user_id, date |
| Embeddings | 13,500 → 20,000 | kb_id | - |
| MedicalTerms | 100 → 500 | term_id | canonical |
| ChatHistory | 5,000 → 10,000 | session_id | user_id, timestamp |

**アクセスパターン:**

1. **Hybrid Search時:**
   - KnowledgeBase: bm25_keywords列でフィルタ (500件取得)
   - Embeddings: kb_id連結でベクトル取得 (500件)
   - コサイン類似度計算 → Top 50
   - Reranking → Top 10

2. **用語展開時:**
   - MedicalTerms: canonical/synonyms列で検索

3. **履歴記録時:**
   - ChatHistory: 新規行追加

**パフォーマンス最適化:**
- Google Sheets API v4 使用
- バッチ読み込み (batchGet)
- 結果キャッシング (5分TTL)

### 2.4 Vertex AI

**Embeddings API:**
```python
# エンドポイント
POST https://us-central1-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/gemini-embedding-001:predict

# リクエスト
{
  "instances": [{
    "task_type": "RETRIEVAL_DOCUMENT",  # or "RETRIEVAL_QUERY"
    "content": "訪問時、利用者は..."
  }],
  "parameters": {
    "outputDimensionality": 3072
  }
}

# レスポンス
{
  "predictions": [{
    "embeddings": {
      "values": [0.123, -0.456, ...]  # 3072次元
    }
  }]
}
```

**Generation API (Streaming):**
```python
# エンドポイント
POST https://us-central1-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/gemini-2.5-flash:streamGenerateContent

# リクエスト
{
  "contents": [{
    "role": "user",
    "parts": [{"text": "以下の情報を元に回答してください:\n\n..."}]
  }],
  "generation_config": {
    "temperature": 0.3,
    "max_output_tokens": 2048
  }
}

# レスポンス (SSE)
data: {"candidates": [{"content": {"parts": [{"text": "回答: "}]}}]}
data: {"candidates": [{"content": {"parts": [{"text": "バルーン"}]}}]}
...
```

### 2.5 GAS Projects (Data Source)

**共通モジュール統合:**

各プロジェクトの `main.gs` に以下を追加:

```javascript
function doPost(e) {
  const logger = createLogger('プロジェクト名');

  try {
    // 既存処理
    const result = processRequest(params);
    updateAppSheet(result);

    // ★新規: Vector DB同期
    syncToVectorDB({
      domain: 'nursing',  // clients, calls, sales
      sourceType: 'care_record',
      sourceTable: 'Care_Records',
      sourceId: params.recordId,
      userId: params.userId,
      title: `${params.date} 記録`,
      content: buildFullText(result),
      structuredData: result,
      metadata: {},
      tags: extractTags(result),
      date: params.date
    }, logger);

    logger.success('処理完了 (RAG同期含む)');
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    logger.error(`処理エラー: ${error.toString()}`);
    return ContentService.createTextOutput('ERROR').setMimeType(ContentService.MimeType.TEXT);
  }
}
```

## 3. データフロー

### 3.1 データ登録フロー

```
AppSheet Webhook
    ↓
GAS doPost()
    ↓
processRequest() (既存処理)
    ↓
updateAppSheet() (既存処理)
    ↓
syncToVectorDB() (新規)
    ├─ createEmbedding() (Vertex AI)
    │    ↓
    ├─ KnowledgeBase.appendRow()
    │    ↓
    └─ Embeddings.appendRow()
```

### 3.2 検索フロー (Hybrid Search)

```
Frontend: ユーザークエリ入力
    ↓
Backend: POST /search
    ↓
Stage 0: Query Preprocessing
    ├─ 医療用語抽出
    └─ シノニム展開 (MedicalTerms照合)
    ↓
Stage 1: BM25 Filtering
    ├─ KnowledgeBase.bm25_keywords検索
    └─ Top 500候補取得
    ↓
Stage 2: Dense Retrieval
    ├─ createEmbedding(query, RETRIEVAL_QUERY)
    ├─ Embeddings.embedding取得 (500件)
    ├─ コサイン類似度計算
    └─ Top 50選択
    ↓
Stage 3: Cross-Encoder Reranking
    ├─ Reranker.predict(query, doc pairs)
    └─ Top 10選択
    ↓
Result Validation
    ├─ 結果数 >= 2 → 成功
    └─ 結果数 < 2 → 用語提案
    ↓
Frontend: 結果表示 or 用語提案モーダル
```

### 3.3 ストリーミングチャットフロー

```
Frontend: POST /chat/stream
    ↓
Backend: Hybrid Search実行
    ↓
Context取得 (Top 10)
    ↓
Prompt構築
    context_text = "\n\n".join([f"[{i+1}] {c['title']}\n{c['content']}" for i, c in contexts])
    prompt = f"以下の情報を元に質問に答えてください:\n\n{context_text}\n\n質問: {query}"
    ↓
Vertex AI Streaming
    async for chunk in vertex_ai.stream_generate(prompt):
        yield f"data: {json.dumps(chunk)}\n\n"
    ↓
Frontend: EventSource.onmessage
    setMessages(prev => appendChunk(prev, chunk))
```

## 4. スケーラビリティ

### 4.1 現状の制約

| リソース | 制約 | 対応可能規模 |
|---------|------|------------|
| Spreadsheet | 500万セル | ~20,000行 (15列想定) |
| Cloud Run | メモリ8GB | 同時接続50ユーザー |
| Vertex AI Embeddings | 600リクエスト/分 | 月間200新規文書 |
| Vertex AI Generation | 500リクエスト/分 | 月間1,000検索 |

### 4.2 スケールアウト戦略

**短期 (6ヶ月以内):**
- Spreadsheetアーカイブ機能 (古いデータを別シートへ)
- Cloud Runインスタンス数増加 (max_instances: 10)

**中期 (1年以内):**
- Pinecone/Weaviate等の専用Vector DB移行
- BigQueryへのデータレイク構築
- Cloud CDN導入

**長期 (2年以内):**
- マイクロサービス化 (Search Service, Term Service, Chat Service分離)
- Kubernetes移行 (GKE)
- マルチリージョン対応

## 5. セキュリティアーキテクチャ

### 5.1 認証・認可

```
Frontend (Vercel)
    ↓ OAuth2 (Google Sign-In)
    ↓
Identity Platform
    ↓ ID Token
    ↓
Backend (Cloud Run)
    ↓ Service Account
    ↓
Vertex AI / Spreadsheet
```

### 5.2 ネットワークセキュリティ

- Frontend → Backend: HTTPS
- Backend → Vertex AI: Private Service Connect
- Backend → Spreadsheet: Google Sheets API (OAuth2)

## 6. 障害対策

### 6.1 可用性設計

| コンポーネント | SLA | 対策 |
|--------------|-----|------|
| Frontend (Vercel) | 99.99% | Edgeキャッシング、自動フェイルオーバー |
| Backend (Cloud Run) | 99.5% | 複数インスタンス、ヘルスチェック |
| Vertex AI | 99.5% | リトライ (指数バックオフ)、Flash→Pro切替 |
| Spreadsheet | 99.9% | 読み取りキャッシング、バッチ書き込み |

### 6.2 エラーハンドリング

**Backend:**
```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "detail": str(exc)}
    )
```

**Frontend:**
```typescript
const handleError = (error: Error) => {
  console.error('Chat error:', error);
  toast.error('エラーが発生しました。もう一度お試しください。');
};
```

## 7. 監視・ロギング

### 7.1 Cloud Logging

- リクエスト/レスポンスログ
- エラーログ (ERROR, CRITICAL)
- パフォーマンスメトリクス

### 7.2 Cloud Monitoring

- API レイテンシ (p50, p95, p99)
- エラー率
- CPU/メモリ使用率
- Vertex AI API呼び出し数

### 7.3 アラート設定

| メトリクス | 閾値 | アクション |
|-----------|------|-----------|
| エラー率 | > 5% | Slack通知 + メール |
| API レイテンシ (p95) | > 5秒 | Slack通知 |
| Vector DB行数 | > 18,000 | アーカイブ警告 |

---

**最終更新**: 2025-10-27
**バージョン**: 1.0.0
