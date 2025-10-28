# システムアーキテクチャ設計書 v2.0

**最終更新**: 2025-10-28
**バージョン**: 2.0.0
**変更内容**: Cloud SQL MySQL + Vertex AI Vector Search + 7段階処理フロー

---

## 1. アーキテクチャ概要

```
┌────────────────────────────────────────────────────────────────────┐
│                          User Layer                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Next.js Frontend (Firebase Hosting)             │  │
│  │  - Chat Interface                                            │  │
│  │  - User Selector                                             │  │
│  │  - ★ SSE Progress Bar (7 Stages)                            │  │
│  │  - Streaming Message Display                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS / SSE
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │            FastAPI Backend (Cloud Run)                       │  │
│  │  ★ 7段階処理フロー:                                          │  │
│  │    Stage 1: Prompt Optimization (gemini-2.5-flash-lite)      │  │
│  │    Stage 2: Query Embedding (gemini-embedding-001 3072次元)  │  │
│  │    Stage 3: Vector Search (MySQL Fulltext + Vertex AI)       │  │
│  │    Stage 4: Top 20 Extraction (RRF Fusion)                   │  │
│  │    Stage 5: Reranking (Vertex AI Ranking API)                │  │
│  │    Stage 6: LLM Generation (gemini-2.5-flash thinking)       │  │
│  │    Stage 7: Streaming Display                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│   ★ Database Layer (NEW)     │  │   Vertex AI Layer            │
│  ┌────────────────────────┐  │  │  ┌────────────────────────┐  │
│  │ Cloud SQL MySQL 8.0    │  │  │  │ gemini-embedding-001   │  │
│  │ ─────────────────────  │  │  │  │ - ★ 3072次元(DEFAULT)  │  │
│  │ - knowledge_base      │  │  │  │ - RETRIEVAL_DOCUMENT   │  │
│  │ - clients             │  │  │  │ - RETRIEVAL_QUERY      │  │
│  │ - chat_history        │  │  │  └────────────────────────┘  │
│  │ - vector_search_stats │  │  │  ┌────────────────────────┐  │
│  │                       │  │  │  │ gemini-2.5-flash-lite  │  │
│  │ ★ FULLTEXT INDEX     │  │  │  │ - Prompt Optimization  │  │
│  └────────────────────────┘  │  │  └────────────────────────┘  │
└──────────────────────────────┘  │  ┌────────────────────────┐  │
                                  │  │ gemini-2.5-flash       │  │
┌──────────────────────────────┐  │  │ - ★ Thinking Mode     │  │
│   ★ Vector Search (NEW)      │  │  │ - Streaming Response   │  │
│  ┌────────────────────────┐  │  │  └────────────────────────┘  │
│  │ Vertex AI Vector Search│  │  │  ┌────────────────────────┐  │
│  │ ─────────────────────  │  │  │  │ Vertex AI Ranking API  │  │
│  │ - ★ 3072次元サポート   │  │  │  │ - Reranking            │  │
│  │ - COSINE距離           │  │  │  │ - semantic-ranker      │  │
│  │ - Tree-AH Index        │  │  │  │   -default-004         │  │
│  │ - ~20,000 vectors     │  │  │  └────────────────────────┘  │
│  └────────────────────────┘  │  └──────────────────────────────┘
└──────────────────────────────┘
```

---

## 2. 7段階処理フロー詳細

### Stage 1: Prompt Optimization

**目的**: ユーザーの曖昧なプロンプトを、検索に最適化された明確なプロンプトに変換

**使用モデル**: gemini-2.5-flash-lite
**処理時間**: ~500ms

**変換例**:
```
[入力] "直近の変化を教えて"
[出力] "利用者ID CL-00001（山田太郎）の2025年10月21日から2025年10月28日での状態変化を教えて"
```

**処理内容**:
1. 利用者情報（client_id, client_name）の組み込み
2. 時間表現の具体化（「直近」→「1週間前〜現在」）
3. 曖昧な表現の明確化（「変化」→「状態変化」）

**実装**: `backend/app/services/prompt_optimizer.py`

---

### Stage 2: Query Embedding

**目的**: 最適化されたプロンプトをベクトル化（3072次元）

**使用モデル**: gemini-embedding-001
**出力次元数**: 3072次元（DEFAULT）
**処理時間**: ~300ms

**API仕様**:
```python
POST https://us-central1-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/gemini-embedding-001:predict

{
  "instances": [{
    "task_type": "RETRIEVAL_QUERY",
    "content": "利用者ID CL-00001（山田太郎）の2025年10月21日から2025年10月28日での状態変化を教えて"
  }],
  "parameters": {
    "outputDimensionality": 3072
  }
}
```

**実装**: `backend/app/services/embeddings_service.py`

---

### Stage 3: Hybrid Vector Search

**目的**: MySQL Fulltext検索 + Vertex AI Vector Searchのハイブリッド検索

**処理時間**: ~1000ms

**検索戦略**:
1. **MySQL Fulltext検索** (BM25相当)
   - `knowledge_base`テーブルの`FULLTEXT INDEX ft_content (title, content)`を使用
   - Top 500候補を高速抽出

2. **Vertex AI Vector Search**
   - 3072次元ベクトルでコサイン類似度計算
   - Tree-AH Indexで高速検索
   - Top 100候補を取得

**実装**:
- MySQL: `backend/app/services/mysql_client.py`
- Vector Search: `backend/app/services/vertex_vector_search.py`

---

### Stage 4: RRF Fusion (Top 20 Extraction)

**目的**: BM25スコアとベクトル類似度スコアを統合してTop 20を抽出

**処理時間**: ~100ms

**Reciprocal Rank Fusion (RRF)アルゴリズム**:
```python
def rrf_score(bm25_rank: int, vector_rank: int, k: int = 60) -> float:
    """
    RRFスコア計算

    Args:
        bm25_rank: BM25検索での順位 (1-indexed)
        vector_rank: ベクトル検索での順位 (1-indexed)
        k: 定数 (デフォルト60)

    Returns:
        RRFスコア (高いほど良い)
    """
    return (1.0 / (k + bm25_rank)) + (1.0 / (k + vector_rank))
```

**実装**: `backend/app/services/rrf_fusion.py`

---

### Stage 5: Reranking (Top 10)

**目的**: Cross-Encoder方式でクエリとドキュメントの関連性を再評価

**使用サービス**: Vertex AI Ranking API
**モデル**: semantic-ranker-default-004
**処理時間**: ~800ms

**API仕様**:
```python
POST https://discoveryengine.googleapis.com/v1/projects/{project}/locations/{location}/rankingConfigs/default_ranking_config:rank

{
  "model": "semantic-ranker-default-004",
  "query": "利用者ID CL-00001（山田太郎）の2025年10月21日から2025年10月28日での状態変化を教えて",
  "records": [
    {"id": "kb_001", "title": "...", "content": "..."},
    {"id": "kb_002", "title": "...", "content": "..."},
    ...
  ]
}
```

**実装**: `backend/app/services/reranker.py`

---

### Stage 6: LLM Generation (Thinking Mode)

**目的**: 検索結果を元に高品質な回答を生成

**使用モデル**: gemini-2.5-flash
**Thinking Mode**: 有効（深い推論）
**処理時間**: ~2000ms (ストリーミング)

**プロンプト構造**:
```
以下の情報を元に質問に答えてください。

【検索結果】
[1] タイトル1
内容1

[2] タイトル2
内容2

...

【質問】
利用者ID CL-00001（山田太郎）の2025年10月21日から2025年10月28日での状態変化を教えて

【回答ルール】
- 検索結果に基づいて回答してください
- 推測や想像は避けてください
- 情報源を明記してください
```

**実装**: `backend/app/services/gemini_service.py`

---

### Stage 7: Streaming Display

**目的**: 生成された回答をリアルタイムでユーザーに表示

**プロトコル**: Server-Sent Events (SSE)
**処理時間**: リアルタイム

**SSE イベント形式**:
```json
// Progress イベント (Stages 1-6)
data: {"type":"progress","stage":1,"message":"Prompt Optimization","value":14}

// Chunk イベント (Stage 6)
data: {"type":"chunk","content":"利用者"}

// Complete イベント
data: {"type":"complete","usage":{"input_tokens":1000,"output_tokens":500}}

// Error イベント
data: {"type":"error","message":"エラーメッセージ"}
```

**実装**:
- Backend: `backend/app/routers/chat.py` (SSE endpoint)
- Frontend: `frontend/src/hooks/useStreamingChat.ts` (EventSource)

---

## 3. コンポーネント詳細

### 3.1 Frontend (Next.js on Firebase Hosting)

**変更点 (v2.0)**:
- ✅ SSE Progress Bar コンポーネント追加
- ✅ ストリーミング表示の改善
- ✅ 7段階進捗表示

**新規コンポーネント**:
```typescript
frontend/
├── components/
│   ├── ProgressBar.tsx          # ★ 7段階進捗バー
│   ├── ProgressPopup.tsx        # ★ 下部ポップアップ
│   └── StreamingMessage.tsx     # ★ ストリーミング表示
└── hooks/
    └── useStreamingChat.ts      # ★ SSE接続・進捗管理
```

**環境変数 (追加)**:
```env
NEXT_PUBLIC_API_URL=https://rag-backend-xxx.run.app
NEXT_PUBLIC_ENABLE_PROGRESS_BAR=true
```

---

### 3.2 Backend (FastAPI on Cloud Run)

**技術スタック (v2.0)**:
- Framework: FastAPI 0.104+
- Language: Python 3.11
- Database: ★ Cloud SQL MySQL 8.0 + aiomysql (async)
- Vector Search: ★ Vertex AI Vector Search (3072次元)
- Reranking: Vertex AI Ranking API (semantic-ranker-default-004)
- Streaming: SSE (Server-Sent Events)

**新規サービス**:
```python
backend/app/services/
├── prompt_optimizer.py      # ★ Stage 1: Prompt Optimization
├── mysql_client.py          # ★ MySQL非同期クライアント
├── vertex_vector_search.py  # ★ Stage 3: Vector Search
├── rrf_fusion.py            # ★ Stage 4: RRF Fusion
└── rag_engine_v2.py         # ★ 統合RAGエンジン v2.0
```

**環境変数 (追加)**:
```env
# Cloud SQL MySQL
CLOUD_SQL_INSTANCE_CONNECTION_NAME=fractal-ecosystem:us-central1:rag-mysql
CLOUD_SQL_DATABASE_NAME=rag_system
CLOUD_SQL_USER=root
CLOUD_SQL_PASSWORD=【Secret Manager】

# Vertex AI Vector Search
VECTOR_SEARCH_INDEX_ID=【作成後に設定】
VECTOR_SEARCH_INDEX_ENDPOINT=【作成後に設定】
VECTOR_SEARCH_DIMENSIONS=3072

# Feature Flags
USE_CLOUD_SQL=True
USE_VERTEX_VECTOR_SEARCH=True
USE_PROMPT_OPTIMIZER=True
```

---

### 3.3 Database (Cloud SQL MySQL 8.0)

**インスタンス仕様**:
- インスタンス名: `rag-mysql`
- バージョン: MySQL 8.0
- Tier: db-f1-micro (開発) → db-n1-standard-1 (本番)
- リージョン: us-central1
- ストレージ: 10GB (自動拡張有効)

**テーブル設計**:

#### knowledge_base
```sql
CREATE TABLE knowledge_base (
  id VARCHAR(255) PRIMARY KEY,
  domain VARCHAR(100) NOT NULL,           -- nursing, clients, calls
  source_id VARCHAR(255),                 -- ソースレコードID
  source_type VARCHAR(50),                -- spreadsheet, firestore
  title TEXT,
  content TEXT NOT NULL,
  user_id VARCHAR(100),                   -- CL-00001
  user_name VARCHAR(255),                 -- 山田太郎
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  metadata JSON,
  embedding_id VARCHAR(255),              -- Vertex AI Vector Search ID

  INDEX idx_domain (domain),
  INDEX idx_user_id (user_id),
  INDEX idx_source_id (source_id),
  INDEX idx_created_at (created_at),
  FULLTEXT INDEX ft_content (title, content)  -- ★ BM25検索用
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### clients
```sql
CREATE TABLE clients (
  client_id VARCHAR(100) PRIMARY KEY,     -- CL-00001
  client_name VARCHAR(255) NOT NULL,      -- 山田太郎
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  metadata JSON,

  INDEX idx_name (client_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### chat_history
```sql
CREATE TABLE chat_history (
  id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(100),
  role ENUM('user', 'assistant') NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,                          -- {optimized_prompt, stage_timings, ...}

  INDEX idx_session (session_id),
  INDEX idx_user (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 3.4 Vertex AI Vector Search

**インデックス仕様**:
- **次元数**: 3072次元 (gemini-embedding-001 DEFAULT)
- **距離測定**: COSINE (コサイン類似度)
- **インデックスタイプ**: Tree-AH (Approximate Nearest Neighbor)
- **シャード数**: 1 (開発) → 2-4 (本番)

**インデックス作成コマンド**:
```bash
gcloud ai indexes create \
  --display-name="rag-knowledge-base-3072" \
  --metadata-file=index_metadata.json \
  --region=us-central1 \
  --project=fractal-ecosystem
```

**index_metadata.json**:
```json
{
  "contentsDeltaUri": "gs://fractal-ecosystem-vectors/embeddings/",
  "config": {
    "dimensions": 3072,
    "approximateNeighborsCount": 100,
    "distanceMeasureType": "COSINE_DISTANCE",
    "algorithmConfig": {
      "treeAhConfig": {
        "leafNodeEmbeddingCount": 1000,
        "leafNodesToSearchPercent": 5
      }
    }
  }
}
```

---

## 4. データフロー

### 4.1 データ登録フロー (Firestore → MySQL 移行)

```
【フェーズ1: 初期移行】
Firestore (既存データ 3,151件)
    ↓
migrate_firestore_to_mysql.py
    ├─ knowledge_base 移行
    ├─ clients 移行
    └─ embedding_id 紐付け
    ↓
Cloud SQL MySQL

【フェーズ2: 新規データ同期】
AppSheet Webhook
    ↓
GAS doPost()
    ↓
processRequest() (既存処理)
    ↓
updateAppSheet() (既存処理)
    ↓
syncToMySQL() (新規)
    ├─ MySQL INSERT
    ├─ createEmbedding() (Vertex AI, 3072次元)
    └─ Vertex AI Vector Search UPDATE
```

---

### 4.2 検索フロー (7段階処理)

```
Frontend: ユーザークエリ入力
    ↓
Backend: POST /chat/stream (SSE)
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 1: Prompt Optimization (~500ms)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ├─ SSE: {"type":"progress","stage":1,"value":14}
    ├─ gemini-2.5-flash-lite呼び出し
    └─ 最適化プロンプト生成
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 2: Query Embedding (~300ms)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ├─ SSE: {"type":"progress","stage":2,"value":28}
    ├─ gemini-embedding-001呼び出し (3072次元)
    └─ クエリベクトル取得
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 3: Hybrid Vector Search (~1000ms)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ├─ SSE: {"type":"progress","stage":3,"value":42}
    ├─ MySQL Fulltext検索 (Top 500)
    ├─ Vertex AI Vector Search (Top 100)
    └─ 候補リスト統合
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 4: RRF Fusion (~100ms)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ├─ SSE: {"type":"progress","stage":4,"value":56}
    ├─ RRFスコア計算
    └─ Top 20抽出
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 5: Reranking (~800ms)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ├─ SSE: {"type":"progress","stage":5,"value":70}
    ├─ Vertex AI Ranking API呼び出し
    └─ Top 10選択
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 6: LLM Generation (~2000ms, streaming)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ├─ SSE: {"type":"progress","stage":6,"value":84}
    ├─ gemini-2.5-flash (Thinking Mode)
    ├─ プロンプト構築 (Top 10 context)
    └─ SSE: {"type":"chunk","content":"..."} (streaming)
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stage 7: Streaming Display (realtime)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ├─ SSE: {"type":"progress","stage":7,"value":100}
    ├─ Frontend: EventSource.onmessage
    └─ SSE: {"type":"complete",...}
    ↓
Frontend: 回答表示完了
```

---

## 5. パフォーマンス目標

### 5.1 レイテンシ目標

| Stage | 目標レイテンシ | 許容最大 |
|-------|---------------|---------|
| Stage 1: Prompt Optimization | 500ms | 1000ms |
| Stage 2: Query Embedding | 300ms | 500ms |
| Stage 3: Hybrid Search | 1000ms | 2000ms |
| Stage 4: RRF Fusion | 100ms | 200ms |
| Stage 5: Reranking | 800ms | 1500ms |
| Stage 6: LLM Generation (TTFB) | 1000ms | 2000ms |
| **合計 (TTFB)** | **3.7秒** | **7秒** |

### 5.2 スループット目標

| 指標 | 開発環境 | 本番環境 |
|------|---------|---------|
| 同時接続ユーザー | 5 | 50 |
| リクエスト/分 | 10 | 100 |
| ベクトル検索/分 | 10 | 100 |
| LLM生成/分 | 10 | 100 |

### 5.3 コスト目標

| API | 単価 | 月間見込み | 月額コスト見込み |
|-----|------|-----------|---------------|
| gemini-2.5-flash-lite (Prompt Opt) | $0.075/1M tokens | 1M tokens | $0.08 |
| gemini-embedding-001 (3072次元) | $0.025/1M tokens | 2M tokens | $0.05 |
| Vertex AI Vector Search | $40/月 (1シャード) | 1シャード | $40 |
| Vertex AI Ranking API | $3/1000 queries | 1000 queries | $3 |
| gemini-2.5-flash (Generation) | $0.30/1M tokens | 5M tokens | $1.50 |
| **合計** | - | - | **$44.63/月** |

---

## 6. 移行計画

### Phase A: Cloud SQL MySQL セットアップ ✅ 進行中

- [x] Cloud SQL Admin API有効化
- [x] MySQLインスタンス作成 (rag-mysql)
- [x] データベース・テーブル作成 (schema.sql)
- [ ] Firestore→MySQL移行スクリプト実行
- [ ] データ移行検証

### Phase B: Vertex AI Vector Search セットアップ

- [ ] Cloud Storage バケット作成
- [ ] embeddings エクスポート (GCS)
- [ ] Vector Searchインデックス作成 (3072次元)
- [ ] インデックスデプロイ
- [ ] クエリテスト

### Phase C: Backend v2.0実装 ✅ 進行中

- [x] Prompt Optimizer Service実装
- [ ] MySQL Client実装 (aiomysql)
- [ ] Vertex Vector Search Client実装
- [ ] RRF Fusion実装
- [ ] RAG Engine v2.0統合
- [ ] SSE Progress実装

### Phase D: Frontend Progress Bar実装

- [ ] ProgressBar コンポーネント
- [ ] ProgressPopup コンポーネント
- [ ] useStreamingChat Hooks更新
- [ ] 7段階進捗表示

### Phase E: 統合テスト・デプロイ

- [ ] ローカル統合テスト
- [ ] Cloud Run デプロイ
- [ ] Firebase Hosting デプロイ
- [ ] 本番検証

---

## 7. モニタリング・アラート

### 7.1 追加メトリクス (v2.0)

- Stage別レイテンシ (p50, p95, p99)
- Prompt Optimization成功率
- Vector Search精度 (Top 10 Recall@K)
- Reranking効果測定
- MySQL接続プール使用率

### 7.2 追加アラート

| メトリクス | 閾値 | アクション |
|-----------|------|-----------|
| Stage 1レイテンシ (p95) | > 1秒 | Slack通知 |
| MySQL接続エラー | > 5/分 | Slack通知 + メール |
| Vector Search タイムアウト | > 2秒 | Slack通知 |
| Prompt Optimizer エラー率 | > 10% | Slack通知 + メール |

---

**次回レビュー予定**: 2025-11-01
