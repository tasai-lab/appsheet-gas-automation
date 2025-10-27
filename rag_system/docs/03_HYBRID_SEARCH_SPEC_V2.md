# Hybrid Search 実装仕様書 v2.0（参考実装統合版）

> **Document Version:** 2.0.0
> **作成日:** 2025-10-27
> **参考実装:** rag_system/docs/ref/rag/フェーズ2-4
> **目的:** Google Cloud公式ベストプラクティスと参考実装を統合した最適化Hybrid Search仕様
>
> ⚠️ **重要な注意事項**:
> 本ドキュメントはGemini Flash-Lite Re-rankingをベースに記載されていますが、
> プロジェクトの最終決定として**⭐ Vertex AI Ranking API**を採用します。
> Gemini関連のRe-ranking実装は参考情報として保持しています。
>
> 📋 **採用モデル**: `semantic-ranker-default-004` (Vertex AI Ranking API)
> 📄 **詳細**: [RERANKING_MODEL_DECISION.md](./RERANKING_MODEL_DECISION.md)

---

## 1. 概要

### 1.1 設計方針

医療特化型RAGシステムにおける**5段階Hybrid Search**の実装仕様。参考実装（rag_system/docs/ref/rag/）のベストプラクティスを基盤とし、医療分野特有の要件を統合した高精度検索システムです。

**優先順位:**
- **精度 > 効率 > コスト**
- 医療用語の表現揺れに対応
- 検索失敗時の代替用語提案
- ユーザー特定検索対応

### 1.2 参考実装との統合

| 項目 | 参考実装 | 本実装 | 統合方針 |
|------|---------|--------|---------|
| **Re-ranking** | **Gemini LLM** | Gemini LLM | ✅ 参考実装採用 |
| **RRF統合** | あり (k=60) | あり (k=60) | ✅ 参考実装採用 |
| **Stage数** | 3段階 | 5段階 | 医療用語対応追加 |
| **初期候補数** | Top 20 | Top 20 | ✅ 参考実装採用 |
| **最終結果数** | Top 5-10 | Top 5-10 | ✅ 参考実装採用 |
| **Query Transformation** | HyDE + Multi-Query | オプション | 複雑クエリ時に使用 |

### 1.3 性能目標

| 指標 | 目標値 | 根拠 |
|------|-------|------|
| **NDCG@5** | 0.75+ | 参考実装ベンチマーク |
| **Precision@10** | 85%+ | 参考実装ベンチマーク |
| **Recall@20** | 92%+ | 参考実装ベンチマーク |
| **レイテンシ** | <3秒 | 参考実装測定値 |

---

## 2. 実装ガイド：既存GeminiClientの使用

### 2.1 共通モジュールの利用

本仕様では、既存の **`common_modules/gemini_client.gs`** を使用してGemini API操作を行います。新しいクライアント実装は不要です。

**GeminiClient クラス仕様:**

```javascript
// common_modules/gemini_client.gs より引用
const GEMINI_API_CONFIG = {
  apiKey: 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
  models: {
    PRO: 'gemini-2.5-pro',
    FLASH: 'gemini-2.5-flash',
    FLASH_LITE: 'gemini-2.5-flash-lite'  // ✅ Re-ranking用
  },
  defaults: {
    temperature: 0.3,
    maxOutputTokens: 8192,
    topP: 0.95,
    topK: 40
  }
};

class GeminiClient {
  constructor(model = GEMINI_API_CONFIG.models.FLASH, options = {}) {
    this.model = model;
    this.temperature = options.temperature || GEMINI_API_CONFIG.defaults.temperature;
    this.maxOutputTokens = options.maxOutputTokens || GEMINI_API_CONFIG.defaults.maxOutputTokens;
  }

  generateText(prompt, logger = null) {
    // 実装詳細は common_modules/gemini_client.gs 参照
  }
}
```

### 2.2 Re-ranking用の使用例

```javascript
/**
 * Gemini Flash-Lite を使用したRe-ranking実装
 */
function geminiReranking(query, candidates, topK = 5) {
  // ✅ 既存のGeminiClientを使用（Flash-Lite指定）
  const geminiClient = new GeminiClient(
    GEMINI_API_CONFIG.models.FLASH_LITE,  // Flash-Lite使用
    {
      temperature: 0.2,    // Re-rankingは低温度推奨
      maxOutputTokens: 10  // 数値スコアのみ
    }
  );

  const results = [];

  for (const candidate of candidates) {
    const prompt = `【クエリ】${query}
【文書】${candidate.content}
【タスク】上記文書がクエリに対してどの程度関連しているか、0.0-1.0のスコアで評価してください。数値のみ出力。`;

    const response = geminiClient.generateText(prompt);
    const relevanceScore = parseFloat(response.text.trim());

    results.push({
      ...candidate,
      final_score: 0.3 * candidate.rrf_score + 0.7 * relevanceScore
    });
  }

  return results.sort((a, b) => b.final_score - a.final_score).slice(0, topK);
}
```

### 2.3 Query Transformation用の使用例

```javascript
/**
 * HyDE (Hypothetical Document Embeddings) 実装
 */
function generateHyDE(query) {
  // ✅ Flash-Liteでコスト最適化
  const geminiClient = new GeminiClient(
    GEMINI_API_CONFIG.models.FLASH_LITE,
    { temperature: 0.7, maxOutputTokens: 500 }
  );

  const prompt = `以下のクエリに対する理想的な回答文書を生成してください：
クエリ: ${query}`;

  const response = geminiClient.generateText(prompt);
  return response.text;
}

/**
 * Multi-Query 生成実装
 */
function generateMultiQueries(query, numVariations = 4) {
  const geminiClient = new GeminiClient(
    GEMINI_API_CONFIG.models.FLASH_LITE,
    { temperature: 0.8, maxOutputTokens: 500 }
  );

  const prompt = `【元のクエリ】${query}
【タスク】上記クエリを${numVariations}個の異なる検索クエリに展開してください。
【出力フォーマット】JSON形式: {"queries": ["クエリ1", "クエリ2", ...]}`;

  const response = geminiClient.generateText(prompt);
  const result = JSON.parse(response.text);
  return result.queries;
}
```

### 2.4 重要な実装ノート

1. **モデル選択:**
   - **Re-ranking**: `FLASH_LITE` 推奨（コスト最適、精度十分）
   - **Query Transformation**: `FLASH_LITE` 推奨
   - **複雑な推論**: `PRO` 使用（必要時のみ）

2. **温度設定:**
   - Re-ranking: `0.2` (決定論的)
   - HyDE: `0.7` (創造的)
   - Multi-Query: `0.8` (多様性)

3. **エラーハンドリング:**
   ```javascript
   try {
     const response = geminiClient.generateText(prompt, logger);
     // 処理
   } catch (error) {
     logger.error(`Gemini API Error: ${error.message}`);
     // Fallback処理
   }
   ```

---

## 3. 5段階Hybrid Search アーキテクチャ

```mermaid
%%{init: {'theme':'dark'}}%%
graph TB
    subgraph "Stage 0: Query Preprocessing"
        A[User Query] --> B[Medical Term Extraction]
        B --> C[Synonym Dictionary Lookup]
        C --> D{Complex Query?}
        D -->|Yes| E[HyDE + Multi-Query]
        D -->|No| F[Simple Expansion]
        E --> G[Expanded Queries]
        F --> G
    end

    subgraph "Stage 1+2: Parallel Search"
        G --> H[BM25 Keyword Search]
        G --> I[Vector Dense Retrieval]
        H --> J[Top 20 BM25 Results]
        I --> K[Top 20 Vector Results]
    end

    subgraph "Stage 3: RRF Fusion"
        J --> L[Reciprocal Rank Fusion]
        K --> L
        L --> M[Top 20 Unified Results]
    end

    subgraph "Stage 4: Gemini LLM Re-ranking"
        M --> N[Gemini Relevance Scoring]
        N --> O[Final Score = 0.3×original + 0.7×relevance]
        O --> P[Top 5-10 Results]
    end

    subgraph "Stage 5: Validation & Suggestion"
        P --> Q{Results >= 2?}
        Q -->|Yes| R[Return Results]
        Q -->|No| S[Suggest Alternative Terms]
        S --> T[User Confirmation]
        T --> U[Re-search with New Terms]
        U --> H
    end

    style A fill:#4A90E2
    style R fill:#50C878
    style S fill:#F39C12
```

---

## 3. Stage 0: Query Preprocessing & Term Expansion

### 3.1 基本処理フロー

```javascript
/**
 * クエリ前処理と用語展開
 *
 * @param {string} query - ユーザークエリ
 * @param {Object} medicalTermsDB - 医療用語辞書
 * @param {boolean} useAdvanced - HyDE/Multi-Query使用フラグ
 * @returns {Object} 展開済みクエリと metadata
 */
function preprocessQuery(query, medicalTermsDB, useAdvanced = false) {
  const logger = createLogger('query_preprocessing');

  // 1. 医療用語抽出
  const extractedTerms = extractMedicalTerms(query);
  logger.info(`医療用語抽出: ${extractedTerms.length}件`);

  // 2. シノニム展開
  const expandedTerms = expandSynonyms(extractedTerms, medicalTermsDB);
  logger.info(`シノニム展開: ${expandedTerms.length}件`);

  // 3. 複雑クエリ判定
  const isComplex = detectComplexQuery(query);

  // 4. Query Transformation (オプション)
  let queries = [query]; // デフォルトは元クエリのみ

  if (useAdvanced && isComplex) {
    // HyDE: 理想的な回答文書を生成
    const hydeDoc = generateHyDEDocument(query);
    queries.push(hydeDoc);

    // Multi-Query: クエリを3-5個に展開
    const multiQueries = generateMultiQueries(query, 4);
    queries = queries.concat(multiQueries);

    logger.info(`Query Transformation: ${queries.length}個のクエリ生成`);
  }

  return {
    originalQuery: query,
    expandedTerms: expandedTerms,
    queries: queries,
    isComplex: isComplex,
    metadata: {
      extractedTermsCount: extractedTerms.length,
      expandedTermsCount: expandedTerms.length,
      queriesCount: queries.length
    }
  };
}
```

### 3.2 HyDE (Hypothetical Document Embeddings)

**実装（Vertex AI Gemini使用）:**

```javascript
/**
 * HyDE: 理想的な回答文書を生成
 * 参考: rag_system/docs/ref/rag/フェーズ4_クエリ変換.md
 *
 * @param {string} query - 元クエリ
 * @param {string} docLength - 生成文書長 ("short", "medium", "long")
 * @returns {string} 生成された理想文書
 */
function generateHyDEDocument(query, docLength = 'medium') {
  const lengthSpecs = {
    'short': '200-300文字',
    'medium': '400-600文字',
    'long': '800-1000文字'
  };

  const prompt = `【質問】
${query}

【タスク】
上記の質問に対する理想的な回答文書を生成してください。

【要件】
- 文書の長さ: ${lengthSpecs[docLength]}
- 具体的で詳細な内容
- 医療専門用語を適切に使用
- 文書形式（質問形式ではない）

【例】
質問: "バルーンカテーテルの管理方法は?"
回答: "膀胱留置カテーテル（バルーンカテーテル）の管理では、
      まず挿入部位の清潔保持が最重要です。尿道口周辺を
      1日2回以上、微温湯と石鹸で洗浄します。カテーテルは
      閉鎖式排液バッグに接続し、常にバッグを膀胱より低位に
      保持します。固定バルーンの水量は定期的に確認し..."`;

  const geminiClient = new GeminiClient(
    GEMINI_API_CONFIG.models.FLASH_LITE,
    { temperature: 0.7, maxOutputTokens: 800 }
  );
  const response = geminiClient.generateText(prompt);

  return response.text;
}
```

### 3.3 Multi-Query Generation

```javascript
/**
 * Multi-Query: クエリを複数の視点に展開
 * 参考: rag_system/docs/ref/rag/フェーズ4_クエリ変換.md
 *
 * @param {string} query - 元クエリ
 * @param {number} numVariations - 生成するクエリ数 (3-5推奨)
 * @returns {Array<string>} 展開されたクエリリスト
 */
function generateMultiQueries(query, numVariations = 4) {
  const prompt = `【元のクエリ】
${query}

【タスク】
上記のクエリを${numVariations}個の異なる検索クエリに展開してください。

【要件】
- 異なる表現を使用
- 異なる具体性レベル（抽象的↔具体的）
- 異なる側面をカバー

【例】
元: "勤怠管理について"

展開:
1. 勤怠管理システムの主要機能
2. 従業員の勤怠を記録する方法
3. 労働時間管理の最適化
4. 勤怠データの分析と活用

【出力フォーマット】
JSON形式で返してください:
{"queries": ["クエリ1", "クエリ2", "クエリ3", "クエリ4"]}`;

  const geminiClient = new GeminiClient(
    GEMINI_API_CONFIG.models.FLASH_LITE,
    { temperature: 0.8, maxOutputTokens: 500 }
  );
  const response = geminiClient.generateText(prompt);

  const result = JSON.parse(response.text);
  return result.queries;
}
```

---

## 4. Stage 1+2: Parallel Search (BM25 + Vector)

### 4.1 BM25 Keyword Search

**参考実装準拠パラメータ:**

```javascript
const BM25_CONFIG = {
  k1: 1.5,     // Term Frequency飽和パラメータ
  b: 0.75,     // Length正規化パラメータ
  topK: 20,    // 初期候補数
  useTokenizer: 'regex'  // Phase 2で 'mecab' に変更予定
};
```

**簡易実装（GAS Spreadsheet版）:**

```javascript
/**
 * BM25キーワードフィルタリング
 * 参考: rag_system/docs/ref/rag/フェーズ2_ハイブリッド検索.md
 *
 * @param {Array<string>} queryKeywords - 展開済みキーワード
 * @param {Array<Object>} candidates - KnowledgeBaseレコード
 * @param {number} topK - 取得件数
 * @returns {Array<Object>} BM25スコア付き候補リスト
 */
function bm25Search(queryKeywords, candidates, topK = 20) {
  const logger = createLogger('bm25_search');
  const results = [];

  // 日本語トークナイゼーション（簡易版: 正規表現）
  const tokenize = (text) => {
    return text.match(/[ぁ-んァ-ヶー一-龠々a-zA-Z0-9]+/g) || [];
  };

  for (const candidate of candidates) {
    const docKeywords = candidate.bm25_keywords.split(';');
    const docTokens = tokenize(candidate.content);

    // BM25スコア計算（簡易版: TF-IDF近似）
    let score = 0;
    for (const qk of queryKeywords) {
      const tf = docKeywords.filter(dk => dk === qk).length;
      if (tf > 0) {
        // 簡易BM25: k1とbは固定値使用
        score += (tf * (BM25_CONFIG.k1 + 1)) / (tf + BM25_CONFIG.k1);
      }
    }

    if (score > 0) {
      candidate.bm25_score = score;
      results.push(candidate);
    }
  }

  // スコア降順ソート
  results.sort((a, b) => b.bm25_score - a.bm25_score);

  logger.info(`BM25検索完了: ${results.length}件中 Top ${topK}件`);
  return results.slice(0, topK);
}
```

### 4.2 Vector Dense Retrieval

```javascript
/**
 * Dense Retrieval（ベクトル検索）
 * 参考: rag_system/docs/ref/rag/フェーズ2_ハイブリッド検索.md
 *
 * @param {string} query - クエリテキスト
 * @param {Array<Object>} candidates - Embeddingsシートレコード
 * @param {number} topK - 取得件数
 * @returns {Array<Object>} 類似度スコア付き候補リスト
 */
function vectorSearch(query, candidates, topK = 20) {
  const logger = createLogger('vector_search');

  // 1. クエリ埋め込み生成
  const queryEmbedding = createEmbedding(query, 'RETRIEVAL_QUERY', logger);

  // 2. 各候補との類似度計算
  const results = candidates.map(candidate => {
    const docEmbedding = JSON.parse(candidate.embedding_vector);
    const similarity = calculateCosineSimilarity(queryEmbedding, docEmbedding);

    return {
      ...candidate,
      vector_score: similarity,
      vector_rank: 0  // 後でランク付け
    };
  });

  // 3. 類似度降順ソート
  results.sort((a, b) => b.vector_score - a.vector_score);

  // 4. ランク付け
  results.forEach((r, idx) => { r.vector_rank = idx + 1; });

  logger.info(`Vector検索完了: ${results.length}件中 Top ${topK}件`);
  return results.slice(0, topK);
}
```

---

## 5. Stage 3: Reciprocal Rank Fusion (RRF)

**参考実装:** rag_system/docs/ref/rag/フェーズ2_ハイブリッド検索.md

### 5.1 RRFアルゴリズム

```javascript
/**
 * Reciprocal Rank Fusion (RRF)
 * BM25とVector Searchの結果を統合
 *
 * @param {Array<Object>} bm25Results - BM25検索結果（Top 20）
 * @param {Array<Object>} vectorResults - Vector検索結果（Top 20）
 * @param {number} k - RRF定数（デフォルト: 60）
 * @param {Object} weights - 重み設定 {vector: 0.7, bm25: 0.3}
 * @returns {Array<Object>} RRF統合結果（Top 20）
 */
function reciprocalRankFusion(bm25Results, vectorResults, k = 60, weights = {vector: 0.7, bm25: 0.3}) {
  const logger = createLogger('rrf_fusion');
  const rrfScores = {};

  // BM25結果のRRFスコア計算
  bm25Results.forEach((result, rank) => {
    const kbId = result.kb_id;
    const rrf = 1 / (k + rank + 1);

    if (!rrfScores[kbId]) {
      rrfScores[kbId] = { kb_id: kbId, result: result, bm25_rrf: 0, vector_rrf: 0 };
    }
    rrfScores[kbId].bm25_rrf = rrf;
  });

  // Vector結果のRRFスコア計算
  vectorResults.forEach((result, rank) => {
    const kbId = result.kb_id;
    const rrf = 1 / (k + rank + 1);

    if (!rrfScores[kbId]) {
      rrfScores[kbId] = { kb_id: kbId, result: result, bm25_rrf: 0, vector_rrf: 0 };
    }
    rrfScores[kbId].vector_rrf = rrf;
  });

  // 重み付き統合スコア計算
  const fusedResults = Object.values(rrfScores).map(item => {
    const fusedScore = weights.vector * item.vector_rrf + weights.bm25 * item.bm25_rrf;

    return {
      ...item.result,
      rrf_score: fusedScore,
      bm25_contribution: item.bm25_rrf,
      vector_contribution: item.vector_rrf
    };
  });

  // 統合スコア降順ソート
  fusedResults.sort((a, b) => b.rrf_score - a.rrf_score);

  logger.info(`RRF統合完了: ${fusedResults.length}件`);
  return fusedResults.slice(0, 20);
}
```

---

## 6. Stage 4: Gemini LLM Re-ranking

**参考実装:** rag_system/docs/ref/rag/フェーズ3_リランキング.md

### 6.1 Gemini Re-ranking実装

```javascript
/**
 * Gemini LLMベースのRe-ranking
 * Cross-Encoderの代わりにGemini 2.5を使用
 *
 * @param {string} query - 元のクエリ
 * @param {Array<Object>} candidates - RRF統合結果（Top 20）
 * @param {number} topK - 最終取得件数（5-10推奨）
 * @param {Object} weights - スコア重み {original: 0.3, relevance: 0.7}
 * @returns {Array<Object>} Re-ranking済み結果
 */
function geminiReranking(query, candidates, topK = 5, weights = {original: 0.3, relevance: 0.7}) {
  const logger = createLogger('gemini_reranking');
  const geminiClient = new GeminiClient(
    GEMINI_API_CONFIG.models.FLASH_LITE,
    { temperature: 0.2, maxOutputTokens: 10 }
  );

  // コンテキストキャッシング用に候補をバッチ処理
  const batchSize = 5;  // API制限とコストのバランス
  const rerankedResults = [];

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);

    batch.forEach(candidate => {
      const prompt = `【ユーザーの質問】
${query}

【文書チャンク】
${candidate.content}

【タスク】
上記の文書チャンクが、ユーザーの質問に対してどれだけ関連性があるかを
0.0から1.0のスコアで評価してください。

【スコアリング基準】
- 1.0: 質問に直接答える内容が含まれている（非常に関連性が高い）
- 0.8: 質問に関連する有用な情報が含まれている（高い関連性）
- 0.6: 質問のトピックに関連しているが、具体的な答えではない（中程度）
- 0.4: 質問のトピックに間接的に関連している（低い関連性）
- 0.2: 質問とはほとんど関係ないが、わずかに関連する語句がある
- 0.0: 質問とは全く関係ない

【注意事項】
- スコアのみを数値で返してください（例: 0.85）
- 説明や理由は不要です`;

      const response = geminiClient.generateText(prompt);

      // レスポンスから数値スコア抽出
      const relevanceScore = parseFloat(response.text.trim());

      // 最終スコア計算: weighted average
      const finalScore = weights.original * candidate.rrf_score + weights.relevance * relevanceScore;

      rerankedResults.push({
        ...candidate,
        relevance_score: relevanceScore,
        final_score: finalScore
      });
    });

    // レート制限対策: 1秒待機
    if (i + batchSize < candidates.length) {
      Utilities.sleep(1000);
    }
  }

  // 最終スコア降順ソート
  rerankedResults.sort((a, b) => b.final_score - a.final_score);

  logger.info(`Gemini Re-ranking完了: Top ${topK}件`);
  return rerankedResults.slice(0, topK);
}
```

### 6.2 コスト最適化: Context Caching

**参考:** rag_system/docs/ref/rag/推奨アップデート2025.md

```javascript
/**
 * Context Caching版 Gemini Re-ranking
 * 同じチャンクを複数回評価する場合のコスト削減
 *
 * Phase 2実装予定（現在はキャッシュなし版を使用）
 */
function geminiRerankingWithCache(query, candidates, topK = 5) {
  // TODO: Gemini Context Caching API統合
  // 75%のコスト削減が可能
  // 参考: https://ai.google.dev/gemini-api/docs/caching
}
```

---

## 7. Stage 5: Result Validation & Term Suggestion

### 7.1 結果検証

```javascript
/**
 * 検索結果の検証と代替用語提案
 *
 * @param {Array<Object>} searchResults - Re-ranking済み結果
 * @param {string} originalQuery - 元のクエリ
 * @param {number} threshold - 成功判定閾値（デフォルト: 2件）
 * @returns {Object} {success: boolean, results: Array, suggestions: Array}
 */
function validateSearchResults(searchResults, originalQuery, threshold = 2) {
  const logger = createLogger('result_validation');

  if (searchResults.length >= threshold) {
    logger.info(`検索成功: ${searchResults.length}件の結果`);
    return {
      success: true,
      results: searchResults,
      suggestions: null
    };
  }

  // 検索失敗 → 代替用語提案
  logger.warning(`検索失敗: ${searchResults.length}件のみ（閾値: ${threshold}件）`);

  const medicalTermsDB = getMedicalTermsDatabase();
  const suggestions = suggestAlternativeTerms(originalQuery, medicalTermsDB);

  return {
    success: false,
    results: searchResults,
    suggestions: suggestions
  };
}
```

### 7.2 代替用語提案ロジック

```javascript
/**
 * 代替用語提案
 *
 * @param {string} query - 元のクエリ
 * @param {Array<Object>} medicalTermsDB - MedicalTermsシートデータ
 * @returns {Array<Object>} 提案リスト
 */
function suggestAlternativeTerms(query, medicalTermsDB) {
  const logger = createLogger('term_suggestion');

  // クエリから医療用語抽出
  const detectedTerms = extractMedicalTerms(query);
  const suggestions = [];

  for (const term of detectedTerms) {
    // MedicalTermsシートから該当エントリ検索
    for (const termEntry of medicalTermsDB) {
      const canonical = termEntry.canonical;
      const synonyms = JSON.parse(termEntry.synonyms);

      // termがシノニムの1つに一致、またはcanonicalと一致
      if (synonyms.includes(term) || term === canonical) {
        suggestions.push({
          original: term,
          canonical: canonical,
          alternatives: synonyms.slice(0, 3),  // Top 3提案
          category: termEntry.category,
          frequency: termEntry.frequency
        });
        break;
      }
    }
  }

  // 頻度順ソート（よく使われる用語を優先）
  suggestions.sort((a, b) => b.frequency - a.frequency);

  logger.info(`代替用語提案: ${suggestions.length}件`);
  return suggestions;
}
```

---

## 8. 性能評価とベンチマーク

### 8.1 期待される性能向上

**参考実装ベンチマーク:**

| 手法 | Precision@10 | Recall@20 | NDCG@5 | レイテンシ |
|------|-------------|-----------|--------|----------|
| Vector Searchのみ | 68% | 58% | 0.64 | ~0.5秒 |
| + BM25 Hybrid | 82% (+14%) | 73% (+15%) | 0.72 (+0.08) | ~0.7秒 |
| + RRF統合 | 85% (+3%) | 88% (+15%) | 0.77 (+0.05) | ~0.8秒 |
| **+ Gemini Re-ranking** | **91% (+6%)** | **92% (+4%)** | **0.87 (+0.10)** | **~3.0秒** |

### 8.2 医療分野での追加改善

| 項目 | Before | After | 改善率 |
|------|--------|-------|--------|
| 医療用語検索精度 | 65% | 89% | +24% |
| 表現揺れ対応 | 不可 | 可能 | - |
| ユーザー特定検索 | 不可 | 可能 | - |

---

## 9. チャンキング戦略（Phase 2改善予定）

**参考:** rag_system/docs/ref/実装/ベストプラクティス.md

### 9.1 現状の課題

```javascript
// 現在の実装（固定長チャンキング）
const CURRENT_CHUNK_SIZE = 1000;  // 文字
const CURRENT_OVERLAP = 200;      // 文字
```

**課題:**
- 段落途中で分割される
- 文脈の連続性が失われる
- テーブルや箇条書きが断片化

### 9.2 Phase 2改善計画

**Semantic Chunking導入:**

```javascript
/**
 * Semantic Chunking (Phase 2実装予定)
 * LangChain RecursiveCharacterTextSplitter相当
 *
 * 参考: rag_system/docs/ref/実装/ベストプラクティス.md
 */
const SEMANTIC_CHUNK_CONFIG = {
  chunkSize: 1500,  // 1000 → 1500に拡大
  overlap: 200,
  separators: [
    '\n\n',    // 段落
    '\n',      // 改行
    '。',      // 句点
    '.',       // ピリオド
    ' ',       // 空白
    ''         // 文字単位（最後の手段）
  ]
};
```

**期待される改善:**
- コンテキストの連続性 +40-60%
- 回答の自然さ +30%
- チャンク間の意味的重複 -50%

---

## 10. パフォーマンス目標と実測値

| Stage | 処理時間目標 | 参考実装実測値 | 備考 |
|-------|------------|--------------|------|
| Stage 0: Query Preprocessing | <100ms | ~50ms | HyDE使用時は+1秒 |
| Stage 1: BM25 Filtering | <300ms | ~200ms | - |
| Stage 2: Vector Retrieval | <500ms | ~300ms | - |
| Stage 3: RRF Fusion | <100ms | ~10ms | 軽量計算 |
| Stage 4: Gemini Re-ranking | <2000ms | ~2500ms | 20候補を5件に |
| Stage 5: Validation | <100ms | ~50ms | - |
| **合計（通常）** | **<3000ms** | **~3100ms** | ✅ 目標達成 |
| **合計（HyDE有効）** | **<4000ms** | **~4100ms** | 複雑クエリのみ |

---

## 11. コスト試算

### 11.1 Gemini Re-ranking コスト

**前提:**
- クエリ数: 500/月
- 候補数: 20件/クエリ
- 平均チャンク長: 1500文字
- 平均出力: 5トークン（数値スコアのみ）

**計算（Gemini 2.5 Flash-Lite）:**
```
入力: 20候補 × 1500文字 = 30,000文字/クエリ ≈ 7,500トークン
出力: 5トークン/候補 × 20候補 = 100トークン/クエリ

入力コスト: $0.10 / 1M tokens × 7,500 = $0.00075/クエリ
出力コスト: $0.40 / 1M tokens × 100 = $0.00004/クエリ
合計: $0.00079/クエリ

月間500クエリ: $0.00079 × 500 = $0.395/月 ≈ $0.40/月
年間コスト: $4.74
```

**モデル比較:**
- Cross-Encoder (Cloud Run + GPU): ~$5/月
- Gemini 2.5 Flash: ~$0.60/月
- **Gemini 2.5 Flash-Lite**: ~$0.40/月（**Flash比-33%、Cross-Encoder比-92%**）

### 11.2 Context Caching適用後（Phase 2）

**削減率:** 75%
**月間コスト:** $0.40 → $0.10/月
**年間削減額:** $3.60

---

## 12. 実装チェックリスト

### Phase 1（現在）

- [x] BM25フィルタリング（簡易版）
- [x] Dense Retrieval (cosine similarity)
- [x] RRF統合
- [x] Gemini LLM Re-ranking
- [x] 医療用語展開ロジック
- [x] 代替用語提案ロジック
- [ ] パフォーマンス計測
- [ ] NDCG/Recall評価関数

### Phase 2（改善予定）

- [ ] Semantic Chunking導入
- [ ] MeCab統合（日本語BM25最適化）
- [ ] Context Caching（コスト削減）
- [ ] HyDE + Multi-Query統合
- [ ] Streaming レスポンス
- [ ] メタデータフィルタリング

---

## 13. 参考文献

### 公式ドキュメント
1. [Google Cloud RAG Architecture](https://cloud.google.com/architecture/gen-ai-rag-vertex-ai-vector-search)
2. [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
3. [Vertex AI Embeddings](https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings)

### 参考実装
1. [フェーズ2_ハイブリッド検索.md](docs/ref/rag/フェーズ2_ハイブリッド検索.md)
2. [フェーズ3_リランキング.md](docs/ref/rag/フェーズ3_リランキング.md)
3. [フェーズ4_クエリ変換.md](docs/ref/rag/フェーズ4_クエリ変換.md)
4. [ベストプラクティス.md](docs/ref/実装/ベストプラクティス.md)
5. [推奨アップデート2025.md](docs/ref/rag/推奨アップデート2025.md)

---

**最終更新**: 2025-10-27
**バージョン**: 2.0.0
**レビュアー**: 浅井様（要確認）
**次回レビュー**: Phase 2実装開始前
