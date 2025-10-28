# 実装サマリー: RAG System v2.0 - 2025-10-28

**実装日**: 2025-10-28
**セッション**: Architecture Redesign Phase
**ステータス**: Phase A〜C 一部完了

---

## 📊 実装進捗

### ✅ 完了タスク

| Phase | タスク | ステータス | 成果物 |
|-------|--------|-----------|--------|
| **Phase A** | MySQLスキーマ設計 | ✅ 完了 | `backend/sql/schema.sql` |
| **Phase A** | Firestore→MySQL移行スクリプト | ✅ 完了 | `scripts/migrate_firestore_to_mysql.py` |
| **Phase C1** | Prompt Optimizer Service実装 | ✅ 完了 | `backend/app/services/prompt_optimizer.py` |
| **ドキュメント** | アーキテクチャv2.0設計書 | ✅ 完了 | `docs/02_ARCHITECTURE_V2.md` |
| **ドキュメント** | 移行ガイド | ✅ 完了 | `docs/MIGRATION_GUIDE_V2.md` |
| **ドキュメント** | 技術調査レポート | ✅ 完了 | `docs/ARCHITECTURE_V2_RESEARCH.md` |

### 🔄 進行中タスク

| Phase | タスク | ステータス | 備考 |
|-------|--------|-----------|------|
| **Phase A** | Cloud SQLインスタンス作成 | 🔄 実行中 | PENDING_CREATE (5-10分) |
| **Phase A** | データベース・テーブル作成 | ⏳ 待機中 | インスタンス作成完了後 |
| **Phase C2** | MySQL Client実装 | 🔄 計画中 | aiomysql使用 |

### ⏳ 未着手タスク

| Phase | タスク | 優先度 | 依存関係 |
|-------|--------|-------|---------|
| **Phase B** | Vertex AI Vector Search インデックス作成 | 高 | Phase A完了 |
| **Phase C2** | MySQL Client実装 | 高 | Phase A完了 |
| **Phase C3** | RAG Engine v2.0改修 | 高 | Phase B, C1, C2完了 |
| **Phase D** | Frontend Progress Bar実装 | 中 | Phase C完了 |
| **Phase E** | 統合テスト・デプロイ | 高 | 全Phase完了 |

---

## 📁 作成・変更ファイル一覧

### 新規作成ファイル

#### Backend

| ファイルパス | 行数 | 説明 |
|-------------|------|------|
| `backend/sql/schema.sql` | 70行 | MySQL 8.0 スキーマ定義 (3テーブル + インデックス) |
| `backend/app/services/prompt_optimizer.py` | 185行 | gemini-2.5-flash-lite によるプロンプト最適化サービス |

#### Scripts

| ファイルパス | 行数 | 説明 |
|-------------|------|------|
| `scripts/migrate_firestore_to_mysql.py` | 380行 | Firestore → MySQL データ移行スクリプト (aiomysql使用) |

#### ドキュメント

| ファイルパス | 行数 | 説明 |
|-------------|------|------|
| `docs/02_ARCHITECTURE_V2.md` | 460行 | アーキテクチャ設計書 v2.0 (7段階処理フロー) |
| `docs/MIGRATION_GUIDE_V2.md` | 470行 | v1.0→v2.0 移行ガイド (データ移行・デプロイ手順) |
| `docs/ARCHITECTURE_V2_RESEARCH.md` | 550行 | 技術調査レポート (3072次元サポート検証) |
| `docs/IMPLEMENTATION_SUMMARY_V2_2025-10-28.md` | 本ファイル | 実装サマリー |

**合計**: 約2,115行の新規コード・ドキュメント

---

## 🔧 技術スタック変更

### データベース層

| 項目 | v1.0 | v2.0 |
|------|------|------|
| **Primary DB** | Firestore | ⭐ Cloud SQL MySQL 8.0 |
| **接続ライブラリ** | Firebase Admin SDK | ⭐ aiomysql (async) |
| **Fulltext検索** | JavaScript実装 | ⭐ MySQL FULLTEXT INDEX |
| **データ件数** | 3,151件 | 3,151件 (移行予定) |

### ベクトル検索層

| 項目 | v1.0 | v2.0 |
|------|------|------|
| **Vector DB** | Google Spreadsheet | ⭐ Vertex AI Vector Search |
| **次元数** | 2048 (PCA圧縮) | ⭐ 3072 (DEFAULT, 圧縮なし) |
| **検索速度** | ~2000ms | ~500ms (見込み) |
| **インデックス** | なし | ⭐ Tree-AH (ANN) |

### 処理フロー層

| Stage | v1.0 | v2.0 |
|-------|------|------|
| **Stage 1** | - | ⭐ Prompt Optimization (gemini-2.5-flash-lite) |
| **Stage 2** | Query Embedding | Query Embedding (3072次元) |
| **Stage 3** | BM25 + Dense Retrieval | ⭐ Hybrid Search (MySQL + Vertex AI) |
| **Stage 4** | - | ⭐ RRF Fusion (Top 20) |
| **Stage 5** | Reranking | Reranking (Top 10) |
| **Stage 6** | LLM Generation | ⭐ LLM Generation (Thinking Mode) |
| **Stage 7** | - | ⭐ Streaming Display with Progress |

---

## 🎯 主要実装詳細

### 1. MySQL スキーマ設計 (`backend/sql/schema.sql`)

**テーブル構成**:

```sql
-- knowledge_base (ナレッジベース)
CREATE TABLE knowledge_base (
  id VARCHAR(255) PRIMARY KEY,
  domain VARCHAR(100) NOT NULL,           -- nursing, clients, calls
  source_id VARCHAR(255),
  source_type VARCHAR(50),
  title TEXT,
  content TEXT NOT NULL,
  user_id VARCHAR(100),                   -- CL-00001
  user_name VARCHAR(255),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  metadata JSON,
  embedding_id VARCHAR(255),              -- Vertex AI Vector Search ID

  INDEX idx_domain (domain),
  INDEX idx_user_id (user_id),
  FULLTEXT INDEX ft_content (title, content)  -- ★ BM25検索用
) ENGINE=InnoDB;
```

**特徴**:
- ✅ MySQL FULLTEXT INDEXによる高速BM25検索
- ✅ JSON型メタデータ列
- ✅ Vertex AI Vector Search IDとの紐付け (`embedding_id`)

---

### 2. Firestore → MySQL 移行スクリプト (`scripts/migrate_firestore_to_mysql.py`)

**主要機能**:

```python
class FirestoreToMySQLMigrator:
    """Firestore → MySQL 移行クラス"""

    async def migrate_knowledge_base(self, batch_size: int = 100):
        """knowledge_base コレクション移行"""
        # Firestoreから読み取り
        docs = self.db.collection('knowledge_base').stream()

        # MySQLへバッチ挿入
        await self._insert_knowledge_base_batch(cursor, batch, conn)

    async def migrate_clients(self, batch_size: int = 100):
        """clients コレクション移行"""
        ...

    async def extract_vector_embeddings_metadata(self):
        """embedding_id紐付け"""
        ...
```

**実行方法**:
```bash
# Dry Run
python scripts/migrate_firestore_to_mysql.py \
  --project fractal-ecosystem \
  --instance rag-mysql \
  --dry-run

# 本番移行
python scripts/migrate_firestore_to_mysql.py \
  --project fractal-ecosystem \
  --instance rag-mysql
```

**特徴**:
- ✅ aiomysql非同期処理
- ✅ バッチ処理 (100件単位)
- ✅ Dry Runモード
- ✅ エラーハンドリング + ロールバック

---

### 3. Prompt Optimizer Service (`backend/app/services/prompt_optimizer.py`)

**主要機能**:

```python
class PromptOptimizer:
    """プロンプト最適化サービス"""

    async def optimize_prompt(
        self,
        raw_prompt: str,
        client_id: Optional[str] = None,
        client_name: Optional[str] = None
    ) -> str:
        """
        プロンプト最適化

        Example:
            Input: "直近の変化を教えて"
            Output: "利用者ID CL-00001（山田太郎）の2025年10月21日から
                    2025年10月28日での状態変化を教えて"
        """
        # gemini-2.5-flash-lite 呼び出し
        response = self.model.generate_content(
            full_prompt,
            generation_config=self.generation_config
        )

        return optimized
```

**使用モデル**: gemini-2.5-flash-lite
- 軽量・高速（~500ms）
- temperature=0.2（安定出力）
- max_output_tokens=200

**変換ロジック**:
1. 利用者情報組み込み (client_id, client_name)
2. 時間表現の具体化 ("直近" → "2025-10-21〜2025-10-28")
3. 曖昧表現の明確化 ("変化" → "状態変化")

**フォールバック機能**:
- API失敗時は最低限の補完を実施
- システムダウンを防ぐ

---

## 🔬 技術調査結果（重要）

### gemini-embedding-001 の 3072次元サポート確認

**Web調査結果**:
- ✅ **デフォルト次元数**: **3072次元**
- ✅ **サポート範囲**: 128〜3072次元
- ✅ **推奨次元数**: 768, 1536, **3072**
- ✅ **技術**: Matryoshka Representation Learning (MRL)

**Google公式ドキュメント引用**:
> "For the highest quality results, we recommend using 3072, 1536, or 768 output dimensions."
> "The gemini-embedding-001 model produces vectors with 3072 dimensions."

### Vertex AI Vector Search の 3072次元サポート確認

**Web調査結果**:
- ✅ **完全サポート**: 3072次元
- ✅ **推奨次元数**: 768, 1536, **3072** (Google公式推奨)
- ✅ **インデックスタイプ**: Tree-AH (Approximate Nearest Neighbor)
- ✅ **距離測定**: COSINE, DOT_PRODUCT, L2

**結論**: 当初計画通り、MySQL + Vertex AI + 3072次元で実装可能

---

## ⚙️ Cloud SQL インスタンス設定

**インスタンス名**: `rag-mysql`

**作成コマンド**:
```bash
gcloud sql instances create rag-mysql \
  --database-version=MYSQL_8_0 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password="RagSystem2025!" \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --storage-auto-increase \
  --project=fractal-ecosystem
```

**ステータス**: PENDING_CREATE (作成中)
**所要時間**: 5-10分見込み

**接続方法**:
```bash
# Unix socket 接続 (Cloud Run)
/cloudsql/fractal-ecosystem:us-central1:rag-mysql

# TCP接続 (ローカル)
gcloud sql connect rag-mysql --user=root
```

---

## 📈 パフォーマンス見込み

### レイテンシ比較

| 処理 | v1.0 | v2.0 | 改善率 |
|------|------|------|-------|
| **BM25検索** | ~1500ms (Python) | ~300ms (MySQL) | **80%削減** |
| **ベクトル検索** | ~2000ms (NumPy) | ~500ms (Vertex AI) | **75%削減** |
| **Prompt Optimization** | なし | ~500ms | 新規 |
| **合計 (TTFB)** | ~5秒 | ~3.7秒 | **26%削減** |

### コスト見込み

| 項目 | v1.0 | v2.0 | 差分 |
|------|------|------|------|
| **Vector DB** | $0 (Spreadsheet) | $40/月 (Vertex AI) | +$40 |
| **Database** | $0 (Firestore) | $10/月 (Cloud SQL) | +$10 |
| **Prompt Optimizer** | $0 | $0.08/月 | +$0.08 |
| **Embedding** | $0.05/月 | $0.05/月 (3072次元) | ±$0 |
| **合計** | ~$5/月 | ~$55/月 | **+$50/月** |

**コスト増加の正当性**:
- ✅ 検索速度26%向上
- ✅ PCA圧縮なし（情報損失回避）
- ✅ スケーラビリティ向上
- ✅ 運用負荷軽減（マネージドサービス）

---

## 🚧 次のステップ

### 即座に実施すべきタスク

1. **MySQL インスタンス作成完了確認** (5-10分後)
   ```bash
   gcloud sql instances describe rag-mysql --format="value(state)"
   ```

2. **MySQLスキーマデプロイ**
   ```bash
   gcloud sql connect rag-mysql --user=root
   source backend/sql/schema.sql
   ```

3. **Firestore→MySQL データ移行 (Dry Run)**
   ```bash
   python scripts/migrate_firestore_to_mysql.py --dry-run
   ```

### Phase B: Vertex AI Vector Search

1. Cloud Storage バケット作成
2. Embedding エクスポート (3,151件 × 3072次元)
3. Vector Search インデックス作成
4. インデックスデプロイ (~30分)

### Phase C2-C3: Backend 統合

1. MySQL Client実装 (`backend/app/services/mysql_client.py`)
2. Vertex Vector Search Client実装
3. RRF Fusion実装
4. RAG Engine v2.0統合

### Phase D: Frontend

1. ProgressBar コンポーネント
2. ProgressPopup コンポーネント
3. SSE Progress対応

---

## 📚 参考リソース

### 作成ドキュメント

- [アーキテクチャ設計書 v2.0](./02_ARCHITECTURE_V2.md)
- [移行ガイド v2.0](./MIGRATION_GUIDE_V2.md)
- [技術調査レポート](./ARCHITECTURE_V2_RESEARCH.md)

### 外部ドキュメント

- [Vertex AI Vector Search Documentation](https://cloud.google.com/vertex-ai/docs/vector-search)
- [gemini-embedding-001 API Reference](https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings)
- [Cloud SQL MySQL Documentation](https://cloud.google.com/sql/docs/mysql)

---

## ✅ チェックリスト

### Phase A (Cloud SQL Setup)

- [x] Cloud SQL Admin API有効化
- [x] MySQLインスタンス作成コマンド実行
- [x] schema.sql作成
- [x] migrate_firestore_to_mysql.py作成
- [ ] インスタンス作成完了確認
- [ ] スキーマデプロイ
- [ ] データ移行 (Dry Run)
- [ ] データ移行 (本番)

### Phase B (Vertex AI Vector Search)

- [ ] Cloud Storage バケット作成
- [ ] Embedding エクスポートスクリプト作成
- [ ] index_metadata.json作成
- [ ] Vector Search インデックス作成
- [ ] インデックスデプロイ

### Phase C (Backend Implementation)

- [x] Prompt Optimizer実装
- [ ] MySQL Client実装
- [ ] Vertex Vector Search Client実装
- [ ] RRF Fusion実装
- [ ] RAG Engine v2.0統合
- [ ] SSE Progress実装

### Phase D (Frontend Implementation)

- [ ] ProgressBar コンポーネント
- [ ] ProgressPopup コンポーネント
- [ ] useStreamingChat Hooks更新

### Phase E (Testing & Deployment)

- [ ] Unit Tests (Backend)
- [ ] Integration Tests
- [ ] Performance Tests
- [ ] Cloud Run デプロイ
- [ ] Firebase Hosting デプロイ

---

**最終更新**: 2025-10-28 14:15 JST
**次回レビュー**: MySQL インスタンス作成完了後
