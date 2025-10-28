# Cloud SQL for MySQL - セットアップガイド

**バージョン**: V3.0.0
**作成日**: 2025-10-28
**対象**: Google Cloud SQL for MySQL 9.0

---

## 📋 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [データベース設計](#データベース設計)
4. [セットアップ手順](#セットアップ手順)
5. [RAGベストプラクティス](#ragベストプラクティス)
6. [パフォーマンス最適化](#パフォーマンス最適化)
7. [トラブルシューティング](#トラブルシューティング)

---

## 概要

RAGシステムV3では、**Cloud SQL for MySQL 9.0** を使用します。主な特徴:

- **VECTOR(2048)型**: MySQL 9.0ネイティブ対応（Firestore互換）
- **ScANNアルゴリズム**: Google Cloud専用の高速ベクトル検索
- **Hybrid Retrieval**: Dense（ベクトル）+ Sparse（全文検索）の組み合わせ
- **RAGベストプラクティス**: チャンク管理、メタデータ管理、品質スコアリング

### パフォーマンス目標

| 指標 | V2 (Firestore) | V3 (Cloud SQL) | 改善率 |
|------|----------------|----------------|--------|
| 検索速度 | 3-5秒 | 1-2秒 | **50-60%** ↑ |
| 検索結果数 | 10件 | 20件 | **100%** ↑ |
| 全体処理時間 | 10-15秒 | 5-8秒 | **50%** ↑ |

---

## 前提条件

### 必須

- Google Cloud SQL for MySQL 9.0 以上
- Cloud SQL Admin API 有効化
- プロジェクトの課金設定完了
- IAMロール: `roles/cloudsql.client`

### 推奨スペック

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| マシンタイプ | db-n1-standard-2 | vCPU 2、メモリ 7.5GB |
| ストレージ | 10GB SSD | 自動拡張有効化 |
| 可用性 | リージョナル（単一ゾーン） | 本番環境は高可用性推奨 |
| バックアップ | 自動バックアップ有効 | 7日間保持 |

---

## データベース設計

### テーブル一覧

| テーブル名 | 説明 | 主キー | レコード数（想定） |
|-----------|------|--------|------------------|
| `knowledge_base` | ナレッジベース（検索対象データ） | id | 3,151+ |
| `embeddings` | Embeddingベクトル（2048次元） | kb_id | 3,151+ |
| `clients` | 利用者マスタ | client_id | 100+ |
| `chat_sessions` | チャットセッション | session_id | 1,000+ |
| `chat_messages` | チャットメッセージ | message_id | 10,000+ |
| `vector_search_stats` | 検索統計（分析用） | id | 無制限 |

### 1. knowledge_base（ナレッジベース）

**用途**: 検索対象のテキストデータ管理

**主要カラム**:

```sql
-- 基本情報
id VARCHAR(255) PRIMARY KEY         -- ナレッジID
domain VARCHAR(50)                  -- ドメイン (nursing, clients, etc.)
source_type VARCHAR(50)             -- ソースタイプ
title VARCHAR(500)                  -- タイトル
content TEXT                        -- コンテンツ本文

-- 利用者情報
user_id VARCHAR(255)                -- 利用者ID (CL-00001等)
user_name VARCHAR(255)              -- 利用者名

-- RAGベストプラクティス: チャンク管理
chunk_id VARCHAR(255)               -- チャンクID
chunk_index INT DEFAULT 0           -- チャンクインデックス
total_chunks INT DEFAULT 1          -- 総チャンク数
parent_doc_id VARCHAR(255)          -- 親文書ID

-- RAGベストプラクティス: 文書分類
document_type VARCHAR(100)          -- 文書タイプ
language VARCHAR(10) DEFAULT 'ja'   -- 言語コード

-- RAGベストプラクティス: 品質管理
quality_score DECIMAL(5,4) DEFAULT 1.0      -- 品質スコア（0-1）
importance_weight DECIMAL(5,4) DEFAULT 1.0  -- 重要度重み

-- メタデータ
structured_data JSON                -- 構造化データ
metadata JSON                       -- メタデータ
tags VARCHAR(1000)                  -- タグ（カンマ区切り）
date DATE                           -- 記録日付
```

**インデックス**:

```sql
-- 標準検索用
INDEX idx_domain (domain)
INDEX idx_user_id (user_id)
INDEX idx_source (source_type, source_table)
INDEX idx_chunk (parent_doc_id, chunk_index)

-- Hybrid Retrieval: Full-text Search用（Sparse Retrieval）
FULLTEXT INDEX idx_content_fulltext (title, content, tags) WITH PARSER ngram
```

### 2. embeddings（ベクトルデータ）

**用途**: 2048次元ベクトルデータ管理（Dense Retrieval）

**主要カラム**:

```sql
kb_id VARCHAR(255) PRIMARY KEY                -- 外部キー（knowledge_base.id）
embedding VECTOR(2048) NOT NULL               -- Embeddingベクトル
embedding_model VARCHAR(100) DEFAULT 'gemini-embedding-001'
confidence_score DECIMAL(5,4) DEFAULT 1.0     -- 信頼度スコア
```

**Vector Index**:
- ⚠️ **CREATE TABLE内では作成不可**
- 別途 `migrations/002_create_vector_index.sql` を使用

### 3. clients（利用者マスタ）

**用途**: 利用者の基本情報と医療情報管理

### 4. chat_sessions / chat_messages

**用途**: チャットセッションとメッセージ履歴管理

### 5. vector_search_stats

**用途**: ベクトル検索のパフォーマンス統計（分析用）

---

## セットアップ手順

### Step 1: Cloud SQL インスタンス作成

```bash
# GCP コンソールまたはgcloudコマンドで実行
gcloud sql instances create rag-mysql-instance \
  --database-version=MYSQL_9_0 \
  --tier=db-n1-standard-2 \
  --region=us-central1 \
  --network=default \
  --enable-bin-log \
  --backup \
  --backup-start-time=03:00
```

### Step 2: データベースとユーザー作成

```sql
-- データベース作成
CREATE DATABASE rag_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ユーザー作成
CREATE USER 'rag_user'@'%' IDENTIFIED BY 'YOUR_SECURE_PASSWORD';

-- 権限付与
GRANT ALL PRIVILEGES ON rag_system.* TO 'rag_user'@'%';
FLUSH PRIVILEGES;
```

### Step 3: スキーマ作成

```bash
# schema.sqlを実行
mysql -h YOUR_CLOUD_SQL_IP -u rag_user -p rag_system < backend/sql/schema.sql
```

### Step 4: データロード

Firestoreからの移行スクリプトを実行:

```bash
cd backend
python scripts/migrate_to_mysql.py --batch-size 100 --verbose
```

### Step 5: Vector Index作成（⚠️ データロード完了後）

**重要**: Vector Indexは**最低1000件のデータ**ロード完了後に作成すること。

```bash
mysql -h YOUR_CLOUD_SQL_IP -u rag_user -p rag_system < backend/sql/migrations/002_create_vector_index.sql
```

### Step 6: 接続テスト

```bash
cd backend
python -c "
from app.database.connection import db_manager
import asyncio

async def test():
    await db_manager.initialize()
    health = await db_manager.health_check()
    print(health)
    await db_manager.close()

asyncio.run(test())
"
```

---

## RAGベストプラクティス

### 1. チャンク管理（Document Chunking）

**目的**: 長文を適切なサイズに分割して検索精度向上

**実装**:

```python
# 例: 1,000文字ごとに分割（オーバーラップ100文字）
chunk_size = 1000
overlap = 100

for i, chunk_text in enumerate(chunks):
    kb_record = {
        "id": f"{doc_id}_chunk_{i}",
        "chunk_id": f"{doc_id}_chunk_{i}",
        "chunk_index": i,
        "total_chunks": len(chunks),
        "parent_doc_id": doc_id,
        "content": chunk_text,
        # ...
    }
```

**ベストプラクティス**:
- 医療記録: 500-1,000文字/チャンク
- 利用者情報: 200-500文字/チャンク
- オーバーラップ: 10-20%（文脈維持）

### 2. メタデータ管理

**目的**: 検索結果のフィルタリング・ランキング向上

**実装**:

```sql
-- メタデータ例
INSERT INTO knowledge_base (
    id, domain, document_type, quality_score, importance_weight, ...
) VALUES (
    'kb-001',
    'nursing',                  -- ドメイン
    'daily_report',             -- 文書タイプ
    0.95,                       -- 品質スコア（高品質）
    1.2,                        -- 重要度重み（重要度高）
    ...
);
```

**推奨スコア設定**:
- quality_score: 0.0-1.0（手動レビュー済み=1.0、自動生成=0.8）
- importance_weight: 0.5-2.0（緊急記録=2.0、定期記録=1.0、メモ=0.5）

### 3. Hybrid Retrieval（ハイブリッド検索）

**Dense Retrieval（ベクトル検索）**:
```sql
-- Vector Index使用
SELECT kb_id, COSINE_DISTANCE(embedding, query_vector) AS score
FROM embeddings
ORDER BY score DESC
LIMIT 100;
```

**Sparse Retrieval（全文検索）**:
```sql
-- ngram Full-text Search使用
SELECT id, MATCH(title, content, tags) AGAINST('検索クエリ' IN NATURAL LANGUAGE MODE) AS score
FROM knowledge_base
WHERE MATCH(title, content, tags) AGAINST('検索クエリ' IN NATURAL LANGUAGE MODE)
ORDER BY score DESC
LIMIT 100;
```

**スコア統合**:
```python
# 正規化 + 加重和
dense_weight = 0.7
sparse_weight = 0.3

combined_score = (
    dense_weight * normalize(dense_score) +
    sparse_weight * normalize(sparse_score)
)
```

**参考**: 研究によるとHybrid Retrievalは単一手法より**18-22%精度向上**

---

## パフォーマンス最適化

### 1. Connection Pooling（接続プール管理）

**設定** (`.env` / `config.py`):

```env
# ベストプラクティス設定
MYSQL_POOL_SIZE=20                    # 最大接続数（推奨: 20-50）
MYSQL_POOL_MAX_OVERFLOW=10            # オーバーフロー接続数
MYSQL_POOL_TIMEOUT=30                 # プール待機タイムアウト（秒）
MYSQL_POOL_RECYCLE=1800              # 接続再利用時間（30分、Cloud SQL推奨）
MYSQL_POOL_PRE_PING=true              # 接続前ヘルスチェック（推奨）
MYSQL_ECHO_POOL=false                 # プールログ出力（開発時のみtrue）

# タイムアウト設定
MYSQL_CONNECT_TIMEOUT=10              # 接続タイムアウト（秒）
MYSQL_READ_TIMEOUT=30                 # 読み取りタイムアウト（秒）
MYSQL_WRITE_TIMEOUT=30                # 書き込みタイムアウト（秒）
```

**実装** (`backend/app/database/connection.py`):

```python
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import QueuePool

engine = create_async_engine(
    connection_url,
    echo=False,
    echo_pool=False,
    pool_size=20,
    max_overflow=10,
    pool_recycle=1800,
    pool_timeout=30,
    pool_pre_ping=True,
    poolclass=QueuePool,
    connect_args={
        "connect_timeout": 10,
        "read_timeout": 30,
        "write_timeout": 30,
    }
)
```

**監視**:

```python
# ヘルスチェック時にプール状態を取得
pool_size = engine.pool.size()
pool_checked_out = engine.pool.checkedout()
print(f"Pool: {pool_checked_out}/{pool_size}")
```

### 2. Vector Index最適化（ScANN）

**パラメータチューニング** (`migrations/002_create_vector_index.sql`):

```sql
CREATE VECTOR INDEX idx_embedding_cosine
ON embeddings(embedding)
DISTANCE_TYPE = 'COSINE'
OPTIONS(
    tree_ah_params = '{
        "num_leaves": 100,               -- データ量に応じて調整
        "num_leaves_to_search": 10,      -- 精度優先: 10-20、速度優先: 5-10
        "training_sample_size": 100000,  -- 全データの10%推奨
        "min_partition_size": 50,
        "max_top_neighbors": 1000
    }'
);
```

**データ量別推奨値**:

| データ件数 | num_leaves | num_leaves_to_search | training_sample_size |
|-----------|------------|----------------------|---------------------|
| < 10,000 | 50-100 | 10 | 1,000 |
| 10,000-100,000 | 100-500 | 10-15 | 10,000 |
| > 100,000 | 500-2000 | 10-20 | 100,000 |

### 3. クエリ最適化

**推奨パターン**:

```sql
-- ✅ 良い例: インデックス活用
SELECT kb.*, e.embedding
FROM knowledge_base kb
JOIN embeddings e ON kb.id = e.kb_id
WHERE kb.user_id = 'CL-00001'  -- INDEX idx_user_id使用
  AND kb.date >= '2025-01-01'  -- INDEX idx_date使用
LIMIT 100;

-- ❌ 悪い例: インデックス未使用
SELECT kb.*, e.embedding
FROM knowledge_base kb
JOIN embeddings e ON kb.id = e.kb_id
WHERE LOWER(kb.user_name) LIKE '%太郎%'  -- インデックス使えない
LIMIT 100;
```

### 4. Index再構築（メンテナンス）

大量のDML操作（INSERT/UPDATE/DELETE）後は、Indexを再構築:

```sql
-- Vector Index削除
DROP VECTOR INDEX idx_embedding_cosine ON embeddings;

-- Vector Index再作成（migrations/002_create_vector_index.sql を再実行）
```

**推奨タイミング**:
- 週次バッチ更新後
- データ量が2倍以上になった時
- 検索速度が著しく低下した時

---

## トラブルシューティング

### 問題1: Vector Index作成エラー

**エラー**:
```
ERROR: Cannot create vector index: insufficient data
```

**原因**: データ件数が不足（最低1000件必要）

**解決策**:
```bash
# データ件数確認
mysql> SELECT COUNT(*) FROM embeddings;

# 1000件以上になるまでデータをロード
python scripts/migrate_to_mysql.py
```

### 問題2: 接続プールエラー

**エラー**:
```
QueuePool limit of size 20 overflow 10 reached
```

**原因**: 同時接続数が `pool_size + max_overflow` を超過

**解決策**:
```env
# .env で接続数を増やす
MYSQL_POOL_SIZE=50
MYSQL_POOL_MAX_OVERFLOW=20
```

### 問題3: Vector検索が遅い

**症状**: 検索に5秒以上かかる

**診断**:
```sql
-- Index状態確認
SHOW INDEXES FROM embeddings WHERE Key_name = 'idx_embedding_cosine';

-- データ件数確認
SELECT COUNT(*) FROM embeddings;
```

**解決策**:
1. **num_leaves_to_search を減らす**: 10 → 5（速度優先）
2. **Index再構築**: DML操作後に再作成
3. **クエリ最適化**: 事前フィルタリングで候補を絞る

### 問題4: メモリ不足エラー

**エラー**:
```
ERROR: Out of memory (Needed XXXXX bytes)
```

**原因**: マシンスペック不足

**解決策**:
```bash
# Cloud SQL インスタンスをアップグレード
gcloud sql instances patch rag-mysql-instance \
  --tier=db-n1-standard-4  # メモリ 15GB
```

---

## 参考リソース

### 公式ドキュメント

- [Cloud SQL for MySQL](https://cloud.google.com/sql/docs/mysql)
- [MySQL 9.0 VECTOR Type](https://dev.mysql.com/doc/refman/9.0/en/vector.html)
- [Cloud SQL Vector Index](https://cloud.google.com/sql/docs/mysql/create-manage-vector-indexes)

### RAGベストプラクティス

- Hybrid Retrieval Survey (2025) - 18-22%精度向上
- Document Chunking Strategies - Pinecone
- Metadata Management for RAG - LlamaIndex

### SQLAlchemy

- [Async Engine](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [Connection Pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html)

---

**最終更新**: 2025-10-28
**メンテナンス担当**: Backend Lead
**次回レビュー**: M2達成時（2025-11-14）
