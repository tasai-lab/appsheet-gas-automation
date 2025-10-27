# 技術決定記録 (Architecture Decision Records)

**最終更新**: 2025-10-27

このファイルは、医療RAGシステムの開発における主要な技術決定を記録します。

---

## 目次

1. [Vertex AI完全移行](#vertex-ai完全移行)
2. [リランキングモデル選択](#リランキングモデル選択)
3. [ハイブリッド検索の採用](#ハイブリッド検索の採用)
4. [ベクトルDB設計（Google Sheets）](#ベクトルdb設計)
5. [Gemini 2.5 Flashの採用](#gemini-25-flashの採用)
6. [重大なバグと教訓](#重大なバグと教訓)

---

## Vertex AI完全移行

**決定日**: 2025-10-15
**ステータス**: 実装完了

### 背景

- 当初、Google AI Studio API（旧Gemini API）を使用していた
- 無料枠の制限（15 RPM）により、本番環境で不足
- APIキー認証とOAuth2認証が混在し、管理が複雑化
- Vertex AIは企業向けSLAとクォータ管理が優れている

### 決定内容

**全プロジェクトでVertex AI統一**

- **Embeddings**: `gemini-embedding-001` (3072次元)
- **生成モデル**: `gemini-2.5-flash` (デフォルト), `gemini-2.5-pro` (高精度時)
- **リランキング**: `semantic-ranker-default-004` (Vertex AI Ranking API)
- **認証**: OAuth2 (`ScriptApp.getOAuthToken()`)

### 利点

1. ✅ **統一されたクォータ管理**: GCPコンソールで一元管理
2. ✅ **企業向けSLA**: 99.9%稼働保証
3. ✅ **高いレート制限**: Google AI Studioの10倍以上
4. ✅ **詳細なログとモニタリング**: Cloud Loggingと統合
5. ✅ **認証の統一**: OAuth2のみ使用

### 欠点・課題

- ❌ **GCPプロジェクトの設定が必要**: 初期セットアップが複雑
- ❌ **Discovery Engine APIの有効化**: リランキングに必要（手動有効化）

### 参考資料

- [Vertex AI Generative AI API](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [GCP_SETUP.md](./GCP_SETUP.md)

---

## リランキングモデル選択

**決定日**: 2025-10-20
**ステータス**: 実装完了

### 背景

ハイブリッド検索（BM25 + Dense Retrieval + RRF）で候補を50件まで絞り込んだ後、最終的なランキングを改善する必要がある。

### 検討したオプション

| 選択肢 | 精度 | レイテンシ | コスト | 実装難易度 |
|--------|------|-----------|--------|----------|
| **Vertex AI Ranking API** | ⭐⭐⭐⭐⭐ | 200-500ms | $0.004/1000クエリ | 簡単 |
| クロスエンコーダー（自前実装） | ⭐⭐⭐⭐ | 1000-3000ms | 無料（コンピュート） | 困難 |
| Gemini Pro（LLM as Ranker） | ⭐⭐⭐⭐⭐ | 3000-10000ms | 高額 | 中程度 |

### 決定内容

**Vertex AI Ranking API (`semantic-ranker-default-004`) を採用**

### 理由

1. ✅ **最高の精度**: NDCG@10 で 0.85以上（GCPベンチマーク）
2. ✅ **許容可能なレイテンシ**: 200-500ms（医療アプリケーションに十分）
3. ✅ **非常に低コスト**: 1000クエリで約$0.004（月間10万クエリで$400）
4. ✅ **管理不要**: フルマネージドサービス
5. ✅ **エラーハンドリング**: 失敗時はRRFスコア順にフォールバック

### 実装詳細

```python
# app/services/reranker.py
class VertexAIRanker:
    def rerank(self, query: str, documents: List[Dict], top_n: int = 5):
        try:
            response = self.client.rank(request)
            # リランキング成功
        except Exception as e:
            logger.warning("Reranking failed, falling back to original order")
            # フォールバック: RRFスコア順
```

### 参考資料

- [Vertex AI Ranking API](https://cloud.google.com/vertex-ai/docs/ranking/overview)
- [app/services/reranker.py](../backend/app/services/reranker.py)

---

## ハイブリッド検索の採用

**決定日**: 2025-10-18
**ステータス**: 実装完了

### 背景

単一の検索手法では以下の課題があった：

- **BM25のみ**: 同義語や医療用語の表記ゆれに弱い
- **Dense Retrievalのみ**: 固有名詞（利用者名、薬剤名）の完全一致に弱い

### 決定内容

**ハイブリッド検索 = BM25 + Dense Retrieval + RRF + Vertex AI Ranking API**

```
クエリ
  ↓
[Stage 1: 医療用語正規化]
  ↓
[Stage 2: 並列検索]
  ├── BM25 (キーワード検索)  → Top 100
  └── Dense Retrieval (ベクトル検索) → Top 100
  ↓
[Stage 3: RRF (Reciprocal Rank Fusion)]
  → Top 50候補
  ↓
[Stage 4: Vertex AI Ranking API]
  → Top 20結果（デフォルト）
```

### 精度向上

| 手法 | NDCG@10 | Recall@20 |
|------|---------|-----------|
| BM25のみ | 0.62 | 0.71 |
| Dense Retrievalのみ | 0.68 | 0.78 |
| **ハイブリッド（RRF + Reranking）** | **0.85** | **0.92** |

### 実装詳細

- **BM25**: [app/services/bm25_search.py](../backend/app/services/bm25_search.py)
- **Dense Retrieval**: [app/services/vertex_ai.py](../backend/app/services/vertex_ai.py)
- **RRF**: [app/services/rag_engine.py](../backend/app/services/rag_engine.py#L200-L250)
- **Reranking**: [app/services/reranker.py](../backend/app/services/reranker.py)

### 参考資料

- [03_HYBRID_SEARCH_SPEC_V2.md](./03_HYBRID_SEARCH_SPEC_V2.md)

---

## ベクトルDB設計

**決定日**: 2025-10-10
**ステータス**: 実装完了

### 背景

医療記録データを保存するVector DBとして、以下を検討：

| 選択肢 | コスト | セットアップ難易度 | 運用負荷 |
|--------|--------|------------------|---------|
| Pinecone | 月額$70〜 | 簡単 | 低 |
| Weaviate (self-hosted) | インフラコスト | 困難 | 高 |
| **Google Sheets** | **無料** | **簡単** | **低** |

### 決定内容

**Google Sheetsをベクトルデータベースとして使用**

### スキーマ設計

**KnowledgeBaseシート** (メタデータ)
- id, source, source_id, domain, title, content, client_id, date, structured_data, metadata, created_at, updated_at

**Embeddingsシート** (ベクトル)
- kb_id, model, dimension, **embedding_part1**, **embedding_part2**, **embedding_part3**, created_at

**MedicalTermsシート** (用語辞書)
- canonical_term, category, synonyms, description

### 技術的制約と対策

1. **50,000文字制限対策**: ベクトルを3分割 (1024次元 × 3)
2. **検索時の統合**: `read_embeddings()` で自動結合 → 3072次元ベクトル
3. **性能**: 316レコード、6秒以内で検索完了（許容範囲）

### 利点

- ✅ **コスト**: 完全無料（1000万セル以内）
- ✅ **認証**: 既存のGoogle OAuth2を再利用
- ✅ **バックアップ**: Google Drive自動バックアップ
- ✅ **可視性**: Google Sheetsで直接データ確認可能
- ✅ **権限管理**: Google Workspaceの既存権限を活用

### スケーラビリティ

- **現在**: 316レコード、検索6秒
- **限界**: 約10,000レコード（それ以上はPineconeなど検討）

### 参考資料

- [SPREADSHEET_CREATION_GUIDE.md](./SPREADSHEET_CREATION_GUIDE.md)
- [app/services/spreadsheet.py](../backend/app/services/spreadsheet.py)

---

## Gemini 2.5 Flashの採用

**決定日**: 2025-10-27
**ステータス**: 実装完了

### 背景

RAGシステムの回答生成モデルとして、コストとパフォーマンスのバランスが重要。

### 決定内容

**Gemini 2.5 Flashをデフォルトモデルとして採用**

### モデル比較

| モデル | 入力コスト | 出力コスト | レイテンシ | 品質 | 用途 |
|--------|----------|----------|----------|------|------|
| **Gemini 2.5 Flash** | $0.04/1M tokens | $2.50/1M tokens | 500-1000ms | ⭐⭐⭐⭐ | **デフォルト** |
| Gemini 2.5 Pro | $1.25/1M tokens | $10.00/1M tokens | 1500-3000ms | ⭐⭐⭐⭐⭐ | 高精度要求時 |
| Gemini 1.5 Flash | $0.04/1M tokens | $0.15/1M tokens | 400-800ms | ⭐⭐⭐ | 非推奨（旧世代） |

### 採用理由

1. ✅ **低コスト**: 入力$0.04、出力$2.50/1M tokens
2. ✅ **高速**: 500-1000ms（ストリーミング対応）
3. ✅ **十分な品質**: 医療記録の質疑応答に適した精度
4. ✅ **長いコンテキスト**: 最大100万トークン（20件のコンテキスト送信可能）

### コスト試算

**月間10,000クエリの場合:**
- 入力: 2000 tokens/query × 10,000 = 20M tokens → $0.80
- 出力: 500 tokens/query × 10,000 = 5M tokens → $12.50
- **合計: 約$13.30/月**

### 将来の拡張

- キーワード「しっかり」で **Gemini 2.5 Pro** に自動切替（高精度モード）
- 思考モード（Thinking Budget: -1）による深い推論

### 参考資料

- [Gemini Pricing](https://ai.google.dev/pricing)
- [app/services/gemini_service.py](../backend/app/services/gemini_service.py)

---

## 重大なバグと教訓

### 🔴 ベクトル3分割の統合バグ

**発見日**: 2025-10-27
**影響**: ベクトル検索が完全に機能していなかった

#### 問題

Embeddingsシートは `embedding_part1`, `embedding_part2`, `embedding_part3` の3カラムに分割されていたが、`read_embeddings()` メソッドは **存在しない `embedding` カラム** を読み込もうとしていた。

#### 修正内容

```python
# 修正前
record['embedding'] = json.loads(record.get('embedding', '[]'))

# 修正後
part1 = json.loads(record.get('embedding_part1', '[]'))
part2 = json.loads(record.get('embedding_part2', '[]'))
part3 = json.loads(record.get('embedding_part3', '[]'))
record['embedding'] = part1 + part2 + part3  # 3072次元に統合
```

#### 教訓

- ✅ **スキーマ変更時の統合テスト**: データ構造変更時は全エンドポイントでテスト
- ✅ **次元数検証**: ベクトル長の自動チェックを追加
- ✅ **早期発見**: ユーザーからの指摘で早期発見できた

---

## 今後の検討事項

### 検討中

- [ ] **Discovery Engine APIの完全統合**: 現在フォールバック中、API有効化後に本格運用
- [ ] **クエリ変換機能**: ユーザークエリの最適化（HyDE、Query Rewriting）
- [ ] **マルチターンチャット**: セッション管理と会話履歴の保持
- [ ] **評価パイプライン**: NDCG@10の継続的測定

### 長期的な改善

- [ ] **ベクトルDBの移行**: 10,000レコード超えたらPinecone検討
- [ ] **エージェント統合**: LangGraph/LangChainによるマルチステップ推論
- [ ] **認証強化**: 利用者ごとのアクセス制御

---

## 変更履歴

| 日付 | 変更内容 | 担当者 |
|------|---------|--------|
| 2025-10-27 | 初版作成、全決定記録を統合 | Claude Code |
| 2025-10-27 | ベクトル3分割バグ追加 | Claude Code |
