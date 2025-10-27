# AI Models Specifications（公式仕様書）

> **Document Version:** 1.0
> **作成日:** 2025年10月9日
> **最終更新:** 2025年10月9日
> **目的:** プロジェクトで使用する全AIモデルの公式仕様を一元管理

## 【重要】仕様の信頼性

このドキュメントの全情報は以下の公式ソースから取得:
- Google Cloud公式ドキュメント
- Vertex AI公式API仕様
- 各モデルプロバイダーの公式ドキュメント
- 2025年10月時点の最新情報

---

## 1. Gemini 2.5 Flash

### 基本情報

| 項目 | 値 |
|------|-----|
| **公式モデル名** | `gemini-2.5-flash` |
| **プレビュー版** | `gemini-2.5-flash-preview-09-2025` |
| **エイリアス** | `gemini-2.5-flash-latest` |
| **プロバイダー** | Google (Vertex AI / Gemini API) |
| **リリース日** | 2025年4月17日 |
| **ステータス** | Stable（本番利用可） |

### 技術仕様

| 項目 | 値 |
|------|-----|
| **コンテキストウィンドウ** | 1,048,576 tokens（1M） |
| **知識カットオフ** | 2025年1月1日 |
| **思考機能** | ✅ あり（thinking capabilities） |
| **マルチモーダル** | ✅ テキスト、画像、音声 |
| **関数呼び出し** | ✅ サポート |
| **JSONモード** | ✅ サポート |
| **ストリーミング** | ✅ サポート |

### パフォーマンス

| 指標 | 値 |
|------|-----|
| **平均出力速度** | 179.4 tokens/sec |
| **TTFT（初回トークン）** | 0.33秒 |
| **SWE-Bench Verified** | 54%（2025年9月改善版） |

### 価格（Vertex AI）

| タイプ | 価格 |
|--------|------|
| **入力トークン** | $0.15 / 1M tokens |
| **出力トークン** | $0.60 / 1M tokens |
| **キャッシュ入力** | $0.0375 / 1M tokens（75%削減） |

### 2025年9月の改善点

1. **Agentic Tool Use強化**
   - SWE-Bench Verified: 48.9% → 54%（+5%向上）
   - 複雑なマルチステップアプリケーションの性能向上

2. **出力トークン削減**
   - 24%のトークン削減（コスト効率向上）
   - 冗長性削減、命令追従性向上

3. **マルチモーダル能力強化**
   - 音声文字起こし精度向上
   - 画像理解能力向上

### 公式ドキュメント

- [Gemini 2.5 Flash - Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini Models Overview](https://ai.google.dev/gemini-api/docs/models)

---

## 2. Gemini 2.5 Flash-Lite

### 基本情報

| 項目 | 値 |
|------|-----|
| **公式モデル名** | `gemini-2.5-flash-lite` |
| **プレビュー版** | `gemini-2.5-flash-lite-preview-09-2025` |
| **プロバイダー** | Google (Vertex AI / Gemini API) |
| **ステータス** | Stable（本番利用可、2025年9月GA） |

### 技術仕様

| 項目 | 値 |
|------|-----|
| **コンテキストウィンドウ** | 1,048,576 tokens（1M） |
| **思考機能** | ✅ あり（Flash 2.5から） |
| **マルチモーダル** | ✅ テキスト、画像、音声 |
| **関数呼び出し** | ✅ サポート |
| **ストリーミング** | ✅ サポート |

### パフォーマンス

| 指標 | 値 |
|------|-----|
| **平均出力速度** | ~200 tokens/sec（推定） |
| **用途** | 高速・低コストタスク |

### 価格（Vertex AI）

| タイプ | 価格 |
|--------|------|
| **入力トークン** | $0.10 / 1M tokens |
| **出力トークン** | $0.40 / 1M tokens |

**コスト比較:**
- Flash比: -33%（入力）、-33%（出力）
- Pro比: -92%（入力）、-92%（出力）

### 2025年9月の改善点

1. **出力トークン50%削減**
   - Flashより大幅な削減
   - コスト効率さらに向上

2. **命令追従性向上**
   - より正確な応答生成
   - 冗長性削減

### 公式ドキュメント

- [Gemini 2.5 Flash-Lite - Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-lite)
- [Flash-Lite GA Announcement](https://developers.googleblog.com/en/gemini-25-flash-lite-is-now-stable-and-generally-available/)

---

## 3. gemini-embedding-001

### 基本情報

| 項目 | 値 |
|------|-----|
| **公式モデル名** | `gemini-embedding-001` |
| **プロバイダー** | Google (Vertex AI / Gemini API) |
| **ステータス** | Generally Available |
| **用途** | テキストベクトル化（RAG、セマンティック検索） |

### 技術仕様

| 項目 | 値 |
|------|-----|
| **デフォルト次元数** | **3072次元** |
| **推奨次元数** | 768, 1536, 3072 |
| **最大入力トークン** | 2048 tokens |
| **対応言語** | 100言語以上 |
| **正規化** | 3072次元は自動正規化済み |
| **技術** | Matryoshka Representation Learning (MRL) |

### Matryoshka Representation Learning (MRL)

MRL技術により、デフォルト3072次元から小さい次元にスケールダウン可能:

```python
# output_dimensionalityパラメータで次元数を指定
embeddings = model.get_embeddings(
    texts=["sample text"],
    output_dimensionality=768  # 768, 1536, または 3072
)
```

**次元数の選択:**
- **3072次元:** 最高品質、自動正規化済み
- **1536次元:** 品質とストレージのバランス、手動正規化必要
- **768次元:** 最小ストレージ、手動正規化必要

### パフォーマンス

| 指標 | 値 |
|------|-----|
| **MTEBベンチマーク** | トップランキング（多言語） |
| **対応タスク** | 検索、分類、クラスタリング、セマンティック類似度 |

### 価格

| API | 価格 |
|-----|------|
| **Gemini API** | 無料 |
| **Vertex AI** | （価格情報要確認） |

### 正規化の注意点

**重要:** 768次元と1536次元を使用する場合、手動で正規化が必要:

```python
import numpy as np

def normalize_embeddings(embeddings):
    """ベクトルを正規化（L2ノルム）"""
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    return embeddings / norms

# 3072次元以外は正規化必要
if output_dimensionality != 3072:
    embeddings = normalize_embeddings(embeddings)
```

### 公式ドキュメント

- [Embeddings - Gemini API](https://ai.google.dev/gemini-api/docs/embeddings)
- [Get Text Embeddings - Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings)
- [Text Embeddings API Reference](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings-api)

---

## 4. DeepSeek V3.2-Exp

### 基本情報

| 項目 | 値 |
|------|-----|
| **公式モデル名** | `deepseek-chat` |
| **推論モード** | `deepseek-reasoner`（思考モード） |
| **プロバイダー** | DeepSeek |
| **ステータス** | Experimental |
| **API互換性** | OpenAI互換 |

### 技術仕様

| 項目 | 値 |
|------|-----|
| **パラメータ数（総計）** | 671B parameters |
| **アクティブパラメータ** | 37B per token |
| **MTPモジュール** | 14B parameters |
| **コンテキストウィンドウ** | 128K tokens |
| **最大出力トークン** | 8,000 tokens |
| **アーキテクチャ** | Mixture of Experts (MoE) |

### 技術的特徴

1. **DeepSeek Sparse Attention (DSA)**
   - 長コンテキストの高速処理
   - 効率的な学習・推論

2. **Multi-Token Prediction (MTP)**
   - 14Bパラメータの専用モジュール
   - 予測精度向上

### パフォーマンス

| ベンチマーク | スコア |
|------------|--------|
| **Context Window** | 128Kまで高性能維持 |

### 価格

| タイプ | 価格 |
|--------|------|
| **入力トークン** | $0.28 / 1M tokens |
| **出力トークン** | $0.42 / 1M tokens |

### API使用例（OpenAI互換）

```python
from openai import AsyncOpenAI

client = AsyncOpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)

response = await client.chat.completions.create(
    model="deepseek-chat",  # or "deepseek-reasoner"
    messages=[{"role": "user", "content": "Hello"}]
)
```

### 公式ドキュメント

- [DeepSeek API Documentation](https://api-docs.deepseek.com/)
- [DeepSeek V3.2-Exp Announcement](https://api-docs.deepseek.com/news/news250929)
- [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing)

---

## 5. Groq Llama 3.1 8B

### 基本情報

| 項目 | 値 |
|------|-----|
| **公式モデル名** | `llama-3.1-8b-instant` |
| **プロバイダー** | Groq (Meta Llama 3.1) |
| **ステータス** | Production Ready |

### 技術仕様

| 項目 | 値 |
|------|-----|
| **パラメータ数** | 8B parameters |
| **コンテキストウィンドウ** | 128K tokens |
| **関数呼び出し** | ✅ Native support |
| **JSONモード** | ✅ サポート |
| **アーキテクチャ** | Grouped-Query Attention (GQA) |

### パフォーマンス

| 指標 | 値 |
|------|-----|
| **平均出力速度** | 179.4 tokens/sec |
| **TTFT（初回トークン）** | 0.33秒 |
| **レイテンシ** | 超低遅延（Groq LPUチップ） |

### 価格

| タイプ | 価格 |
|--------|------|
| **入力トークン** | $0.05 / 1M tokens |
| **出力トークン** | $0.08 / 1M tokens |

**コスト優位性:**
- プロジェクト内で最安価
- Gemini Flash比: -67%（入力）、-87%（出力）

### 技術的特徴

1. **Grouped-Query Attention (GQA)**
   - 推論スケーラビリティ向上
   - 効率的な処理

2. **Groq LPU (Language Processing Unit)**
   - 専用ハードウェア最適化
   - 超高速推論（300+ tok/s報告あり）

### 公式ドキュメント

- [Llama 3.1 8B - GroqDocs](https://console.groq.com/docs/model/llama-3.1-8b-instant)
- [Supported Models - Groq](https://console.groq.com/docs/models)

---

## 6. Vertex AI Vector Search

### 基本情報

| 項目 | 値 |
|------|-----|
| **サービス名** | Vertex AI Vector Search |
| **旧称** | Vertex AI Matching Engine |
| **プロバイダー** | Google Cloud Platform |

### 技術仕様

| 項目 | 値 |
|------|-----|
| **距離メトリック** | DOT_PRODUCT_DISTANCE, COSINE, EUCLIDEAN |
| **推奨メトリック** | DOT_PRODUCT_DISTANCE（正規化済みベクトル用） |
| **対応次元数** | 最大3072次元（gemini-embedding-001対応） |
| **インデックスタイプ** | Tree-AH, Brute Force |

### gemini-embedding-001との統合

**推奨構成:**
```python
# インデックス作成時の設定
index_config = {
    "dimensions": 3072,  # gemini-embedding-001のデフォルト
    "distance_measure_type": "DOT_PRODUCT_DISTANCE",
    "shard_size": "SHARD_SIZE_SMALL"  # データサイズに応じて調整
}
```

**次元数の選択肢:**
- **3072次元:** 最高精度、自動正規化済み
- **1536次元:** 品質と速度のバランス
- **768次元:** 高速検索、ストレージ削減

### パフォーマンス特性

| 指標 | 特徴 |
|------|------|
| **検索速度** | サブセカンド（数百万ベクトル） |
| **スケーラビリティ** | 数十億ベクトル対応 |
| **レイテンシ** | <50ms（最適化時） |

### 価格

| リソース | 価格 |
|---------|------|
| **インデックスストレージ** | $0.32 / GB / 月 |
| **クエリ実行** | $0.0001 / 1000クエリ |

### 公式ドキュメント

- [Vector Search Overview](https://cloud.google.com/vertex-ai/docs/vector-search/overview)
- [Create Vector Search Index](https://cloud.google.com/vertex-ai/docs/vector-search/create-manage-index)

---

## 7. Document AI

### 基本情報

| 項目 | 値 |
|------|-----|
| **サービス名** | Document AI |
| **プロバイダー** | Google Cloud Platform |
| **用途** | PDF/画像からのテキスト抽出（OCR） |

### 技術仕様

| 項目 | 値 |
|------|-----|
| **対応フォーマット** | PDF, TIFF, GIF, JPEG, PNG, BMP, WEBP |
| **OCR精度** | 高精度（医療文書対応） |
| **native_pdf_parsing** | ✅ サポート |
| **レイアウト検出** | ✅ テーブル、フォーム認識 |

### 推奨プロセッサー

| プロセッサー | 用途 |
|------------|------|
| **Document OCR** | 一般的なOCR |
| **Form Parser** | フォーム構造化抽出 |
| **Invoice Parser** | 請求書解析 |
| **Custom Extractor** | カスタム抽出（訓練可） |

### 価格（Document OCR）

| タイプ | 価格 |
|--------|------|
| **0-1,000ページ/月** | $1.50 / 1,000ページ |
| **1,001-1M ページ/月** | $0.60 / 1,000ページ |
| **1M+ ページ/月** | $0.30 / 1,000ページ |

### 公式ドキュメント

- [Document AI Overview](https://cloud.google.com/document-ai/docs/overview)
- [Document AI Pricing](https://cloud.google.com/document-ai/pricing)

---

## 8. コスト試算（100クエリ/月）

### Phase 7: マルチLLMアンサンブル構成

**前提:**
- クエリ数: 100/月
- 各クエリの平均トークン数:
  - 入力: 10K tokens（質問 + RAG検索結果）
  - 各モデル出力: 500 tokens
  - 統合入力: 30K tokens（3モデル × 10K）
  - 統合出力: 1.5K tokens

### コスト内訳

| モデル | 用途 | 入力 | 出力 | 合計/クエリ | 100クエリ |
|--------|------|------|------|-----------|----------|
| **Flash-Lite** | 提案者1 | $0.001 | $0.0002 | $0.0012 | $0.12 |
| **DeepSeek V3.2** | 提案者2 | $0.0028 | $0.0021 | $0.0049 | $0.49 |
| **Groq Llama 8B** | 提案者3 | $0.0005 | $0.00004 | $0.00054 | $0.054 |
| **Flash-Lite** | 統合 | $0.003 | $0.0006 | $0.0036 | $0.36 |
| **合計** | - | - | - | **$0.00924** | **$0.924** |

### 月間コスト試算

| クエリ数 | 月間コスト | 年間コスト |
|---------|-----------|-----------|
| 100 | $0.92 | $11.04 |
| 500 | $4.62 | $55.44 |
| 1,000 | $9.24 | $110.88 |
| 5,000 | $46.20 | $554.40 |

**予算達成: ✅** すべて$500/月以内

### Flash-Liteフォールバック発生時（10%想定）

| クエリ数 | Flash-Lite | Flashフォールバック | 合計 |
|---------|-----------|------------------|------|
| 100 | $0.83 | $0.16 | $0.99 |
| 500 | $4.16 | $0.80 | $4.96 |

---

## 9. モデル選定サマリー

### 用途別推奨モデル

| 用途 | 推奨モデル | 理由 |
|------|----------|------|
| **RAG回答生成（提案者）** | Flash-Lite, DeepSeek, Groq Llama | 多様性・コスト効率 |
| **回答統合** | Flash-Lite → Flash（フォールバック） | コスト最適化・品質保証 |
| **Embedding** | gemini-embedding-001（3072次元） | 最高精度・多言語対応 |
| **Vector Search** | Vertex AI Vector Search | GCPネイティブ・高速 |
| **OCR** | Document AI | 医療文書対応・高精度 |

---

## 10. 更新履歴

| 日付 | 更新内容 | 担当 |
|------|---------|------|
| 2025/10/09 | 初版作成、全モデル仕様調査・検証 | Claude |
| 2025/10/09 | gemini-embedding-001次元数修正（768→3072） | Claude |
| 2025/10/09 | Flash-Liteフォールバック戦略追加 | Claude |

---

## 11. 参考文献

### Google Cloud / Gemini API
1. [Gemini 2.5 Flash - Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash)
2. [Gemini 2.5 Flash-Lite - Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-lite)
3. [Embeddings - Gemini API](https://ai.google.dev/gemini-api/docs/embeddings)
4. [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
5. [Vertex AI Vector Search](https://cloud.google.com/vertex-ai/docs/vector-search/overview)

### DeepSeek
6. [DeepSeek API Documentation](https://api-docs.deepseek.com/)
7. [DeepSeek V3.2-Exp Announcement](https://api-docs.deepseek.com/news/news250929)

### Groq
8. [Llama 3.1 8B - GroqDocs](https://console.groq.com/docs/model/llama-3.1-8b-instant)
9. [Supported Models - Groq](https://console.groq.com/docs/models)

---

**最終検証日:** 2025年10月9日
**次回検証予定:** 2025年11月9日（月次）
