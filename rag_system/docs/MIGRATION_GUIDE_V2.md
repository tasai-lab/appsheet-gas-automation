# 移行ガイド: v1.0 → v2.0

**作成日**: 2025-10-28
**対象**: RAGシステム アーキテクチャ大幅変更

---

## 📋 変更概要

### v1.0 アーキテクチャ（旧）
```
Next.js → FastAPI → Google Spreadsheet → Vertex AI
                   ↓
                 Firestore (3,151 records)
```

### v2.0 アーキテクチャ（新）
```
Next.js → FastAPI (7段階処理フロー) → Cloud SQL MySQL → Vertex AI
                                     ↓
                            Vertex AI Vector Search (3072次元)
```

---

## 🎯 主要な変更点

### 1. データベース: Firestore → Cloud SQL MySQL

| 項目 | v1.0 | v2.0 |
|------|------|------|
| **Primary DB** | Firestore + Spreadsheet | Cloud SQL MySQL 8.0 |
| **Vector Storage** | Spreadsheet (PCA 2048次元) | Vertex AI Vector Search (3072次元) |
| **Fulltext Search** | JavaScript BM25実装 | MySQL FULLTEXT INDEX |
| **接続方式** | Firebase Admin SDK | aiomysql (async) |

**理由**:
- ✅ MySQL FULLTEXT INDEXによる高速BM25検索
- ✅ Vertex AI Vector Searchの3072次元ネイティブサポート
- ✅ GCPサービス統合の簡素化
- ✅ スケーラビリティの向上

---

### 2. ベクトル検索: Spreadsheet → Vertex AI Vector Search

| 項目 | v1.0 | v2.0 |
|------|------|------|
| **Vector DB** | Google Spreadsheet | Vertex AI Vector Search |
| **次元数** | 2048 (PCA圧縮) | 3072 (DEFAULT) |
| **検索アルゴリズム** | NumPy Cosine Similarity | Tree-AH (ANN) |
| **検索速度** | ~2000ms (Python) | ~500ms (Managed Service) |

**理由**:
- ✅ PCA圧縮による情報損失を回避（2048→3072次元）
- ✅ Approximate Nearest Neighbor (ANN)による高速化
- ✅ マネージドサービスによる運用負荷軽減

---

### 3. 処理フロー: 3段階 → 7段階

| Stage | v1.0 | v2.0 |
|-------|------|------|
| **Stage 1** | - | ★ Prompt Optimization (gemini-2.5-flash-lite) |
| **Stage 2** | Query Embedding | Query Embedding (3072次元) |
| **Stage 3** | BM25 + Dense Retrieval | ★ Hybrid Vector Search (MySQL + Vertex AI) |
| **Stage 4** | - | ★ RRF Fusion (Top 20) |
| **Stage 5** | Reranking | Reranking (Top 10) |
| **Stage 6** | LLM Generation | ★ LLM Generation (Thinking Mode) |
| **Stage 7** | - | ★ Streaming Display with Progress |

**理由**:
- ✅ Prompt Optimizationによる検索精度向上
- ✅ RRF Fusionによる複数検索結果の統合
- ✅ Thinking Modeによる推論品質向上
- ✅ 進捗表示によるUX改善

---

### 4. Frontend: 静的表示 → 進捗バー付きストリーミング

| 項目 | v1.0 | v2.0 |
|------|------|------|
| **Progress Bar** | なし | ★ 7段階進捗バー（下部ポップアップ） |
| **Streaming** | チャンクのみ | ★ Progress + Chunk 同時表示 |
| **UX** | 待機時間不明 | リアルタイム進捗表示 |

**理由**:
- ✅ ユーザーが処理状況を把握可能
- ✅ 長時間処理でも安心感の提供
- ✅ エラー発生箇所の特定が容易

---

## 📦 データ移行

### Phase 1: Firestore → MySQL 移行

**対象データ**: 3,151 records

**移行対象コレクション**:
1. `knowledge_base` → `knowledge_base` テーブル
2. `clients` → `clients` テーブル
3. `vectors` → `embedding_id` 列（Vertex AI Vector Search ID）

**移行スクリプト**:
```bash
# Dry Run (検証)
cd /Users/t.asai/code/appsheet-gas-automation/rag_system
python scripts/migrate_firestore_to_mysql.py \
  --project fractal-ecosystem \
  --instance rag-mysql \
  --dry-run

# 本番移行
python scripts/migrate_firestore_to_mysql.py \
  --project fractal-ecosystem \
  --instance rag-mysql \
  --batch-size 100
```

**所要時間**: 約5-10分

---

### Phase 2: ベクトルデータ移行

**対象**: 3,151 embeddings (3072次元)

**手順**:

1. **Firestoreからエクスポート**:
```bash
python scripts/export_vectors_to_gcs.py \
  --project fractal-ecosystem \
  --bucket fractal-ecosystem-vectors \
  --output embeddings/
```

2. **Vertex AI Vector Search インデックス作成**:
```bash
gcloud ai indexes create \
  --display-name="rag-knowledge-base-3072" \
  --metadata-file=config/index_metadata.json \
  --region=us-central1 \
  --project=fractal-ecosystem
```

3. **ベクトルアップロード**:
```bash
gcloud ai indexes update INDEX_ID \
  --metadata-file=config/index_update.json \
  --region=us-central1 \
  --project=fractal-ecosystem
```

**所要時間**: 約30分〜1時間

---

## 🔧 Backend 変更点

### 新規サービス

| ファイル | 説明 |
|---------|------|
| `app/services/prompt_optimizer.py` | Stage 1: Prompt Optimization |
| `app/services/mysql_client.py` | MySQL非同期クライアント (aiomysql) |
| `app/services/vertex_vector_search.py` | Vertex AI Vector Search Client |
| `app/services/rrf_fusion.py` | Stage 4: RRF Fusion |
| `app/services/rag_engine_v2.py` | 統合RAGエンジン v2.0 |

### 変更されるサービス

| ファイル | 変更内容 |
|---------|---------|
| `app/main.py` | MySQL接続プール初期化追加 |
| `app/routers/chat.py` | 7段階進捗SSE実装 |
| `app/services/embeddings_service.py` | 3072次元出力に変更 |

### 廃止されるサービス

| ファイル | 理由 |
|---------|------|
| `app/services/firestore_service.py` | MySQL移行により不要 |
| `app/services/spreadsheet.py` (Vector DB用) | Vertex AI Vector Search移行により不要 |

---

## 🎨 Frontend 変更点

### 新規コンポーネント

```typescript
frontend/src/components/
├── ProgressBar.tsx          # 7段階進捗バー
├── ProgressPopup.tsx        # 下部ポップアップ
└── StreamingMessage.tsx     # ストリーミング表示
```

### 変更されるコンポーネント

```typescript
frontend/src/
├── hooks/useStreamingChat.ts    # SSE Progress対応
└── components/ChatContainer.tsx # ProgressPopup統合
```

---

## 🚀 デプロイ手順

### 1. Backend環境変数更新

```bash
# .env.production に追加
CLOUD_SQL_INSTANCE_CONNECTION_NAME=fractal-ecosystem:us-central1:rag-mysql
CLOUD_SQL_DATABASE_NAME=rag_system
CLOUD_SQL_USER=root
CLOUD_SQL_PASSWORD=【Secret Manager】

VECTOR_SEARCH_INDEX_ID=【作成後に設定】
VECTOR_SEARCH_INDEX_ENDPOINT=【作成後に設定】
VECTOR_SEARCH_DIMENSIONS=3072

USE_CLOUD_SQL=True
USE_VERTEX_VECTOR_SEARCH=True
USE_PROMPT_OPTIMIZER=True
```

### 2. Backend デプロイ

```bash
cd backend

# Dockerイメージビルド
gcloud builds submit --tag gcr.io/fractal-ecosystem/rag-backend:v2.0

# Cloud Runデプロイ
gcloud run deploy rag-backend \
  --image gcr.io/fractal-ecosystem/rag-backend:v2.0 \
  --region us-central1 \
  --platform managed \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --set-env-vars USE_CLOUD_SQL=True,USE_VERTEX_VECTOR_SEARCH=True \
  --set-secrets CLOUD_SQL_PASSWORD=rag-mysql-password:latest
```

### 3. Frontend デプロイ

```bash
cd frontend

# 環境変数更新
echo "NEXT_PUBLIC_API_URL=https://rag-backend-xxx.run.app" > .env.production

# Firebase Hosting デプロイ
npm run build
firebase deploy --only hosting
```

---

## 📊 パフォーマンス比較

### 検索レイテンシ

| 指標 | v1.0 | v2.0 | 改善率 |
|------|------|------|-------|
| **BM25検索** | ~1500ms (Python) | ~300ms (MySQL FULLTEXT) | **80%削減** |
| **ベクトル検索** | ~2000ms (NumPy) | ~500ms (Vertex AI) | **75%削減** |
| **合計 (TTFB)** | ~5秒 | ~3.7秒 | **26%削減** |

### コスト比較

| 項目 | v1.0 | v2.0 | 差分 |
|------|------|------|------|
| **Vector DB** | 無料 (Spreadsheet) | $40/月 (Vertex AI) | +$40 |
| **Database** | 無料 (Firestore) | $10/月 (Cloud SQL) | +$10 |
| **Prompt Optimization** | なし | $0.08/月 | +$0.08 |
| **合計** | ~$5/月 | ~$55/月 | **+$50/月** |

**注**: パフォーマンス向上とスケーラビリティを考慮すると、コスト増加は許容範囲

---

## ⚠️ 互換性注意事項

### 破壊的変更

1. **環境変数名変更**:
   - `USE_FIRESTORE_VECTOR_SEARCH` → `USE_VERTEX_VECTOR_SEARCH`
   - 新規: `USE_CLOUD_SQL`, `USE_PROMPT_OPTIMIZER`

2. **APIレスポンス形式変更**:
   - 進捗イベント追加: `{"type":"progress","stage":1,...}`
   - メタデータ追加: `{"stage_timings":{...}}`

3. **データベーススキーマ変更**:
   - Firestore → MySQL移行により、直接DBアクセスコードは動作しない

### 後方互換性維持

1. **APIエンドポイント**:
   - `/chat/stream` - 変更なし（SSEイベント追加のみ）
   - `/search` - 変更なし

2. **レスポンス形式**:
   - 既存の`chunk`イベントは互換性維持
   - 新規`progress`イベントは既存クライアントでは無視される

---

## 🧪 テスト計画

### Unit Tests

```bash
# Backend
cd backend
pytest tests/services/test_prompt_optimizer.py
pytest tests/services/test_mysql_client.py
pytest tests/services/test_vertex_vector_search.py
pytest tests/services/test_rrf_fusion.py
```

### Integration Tests

```bash
# E2E テスト
cd backend
pytest tests/integration/test_7stage_flow.py
```

### Performance Tests

```bash
# 負荷テスト
cd scripts
python performance_test_v2.py \
  --concurrent-users 10 \
  --requests-per-user 10
```

---

## 📝 ロールバック手順

v2.0で問題が発生した場合の緊急ロールバック:

### 1. Backend ロールバック

```bash
gcloud run deploy rag-backend \
  --image gcr.io/fractal-ecosystem/rag-backend:v1.0 \
  --region us-central1
```

### 2. Frontend ロールバック

```bash
cd frontend
git checkout v1.0
npm run build
firebase deploy --only hosting
```

### 3. 環境変数復元

```bash
# .env.production
USE_FIRESTORE_VECTOR_SEARCH=True
USE_CLOUD_SQL=False
USE_VERTEX_VECTOR_SEARCH=False
USE_PROMPT_OPTIMIZER=False
```

### 4. データ整合性確認

Firestore v1.0データは保持されているため、即座に復元可能。
MySQL v2.0データは別途保存されているため、再移行も可能。

---

## 🔗 関連ドキュメント

- [アーキテクチャ設計書 v2.0](./02_ARCHITECTURE_V2.md)
- [技術調査レポート](./ARCHITECTURE_V2_RESEARCH.md)
- [MySQLスキーマ定義](../backend/sql/schema.sql)
- [移行スクリプト](../scripts/migrate_firestore_to_mysql.py)

---

**最終更新**: 2025-10-28
**レビュー担当**: Architecture Team
