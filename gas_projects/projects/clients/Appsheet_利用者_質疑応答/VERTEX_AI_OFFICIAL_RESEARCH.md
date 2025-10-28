# Vertex AI Gemini 公式ドキュメント徹底調査 - 2025-01-28

## 🔴 重大な発見：価格の誤り

### 実装していた価格（誤り）

```javascript
'gemini-2.5-flash': {
  text: { inputPer1M: 0.075, outputPer1M: 0.30 },  // ❌ 完全に誤り
}
```

### 正しい価格（公式確認済み）

```javascript
'gemini-2.5-flash': {
  text: { inputPer1M: 0.30, outputPer1M: 2.50 },  // ✅ 正解
}
```

**誤差の影響**:
- 入力コスト: 4倍の過小評価（$0.075 → $0.30）
- 出力コスト: 8.3倍の過小評価（$0.30 → $2.50）

---

## 📊 正確な価格表（2025年1月時点）

### Gemini 2.5 Flash

| 項目 | 価格（USD/1M tokens） |
|------|----------------------|
| テキスト/画像/動画 入力（≤200K） | $0.30 |
| テキスト/画像/動画 入力（>200K） | $0.30 |
| 音声入力 | $1.00 |
| テキスト出力 | $2.50 |
| 画像出力 | $30.00 |
| キャッシュ入力（90%割引） | $0.030 |

### Gemini 2.5 Flash-Lite

| 項目 | 価格（USD/1M tokens） |
|------|----------------------|
| テキスト入力（≤200K） | $0.10 |
| テキスト入力（>200K） | $0.10 |
| 音声入力 | $0.30 |
| テキスト出力 | $0.40 |

### Gemini 2.5 Pro

| 項目 | 価格（USD/1M tokens） |
|------|----------------------|
| テキスト入力（≤200K） | $1.25 |
| テキスト入力（>200K） | $2.50 |
| テキスト出力（≤200K） | $10.00 |
| テキスト出力（>200K） | $15.00 |

**公式ソース**: https://cloud.google.com/vertex-ai/generative-ai/pricing

---

## 🧠 思考モード（Thinking Mode）の正しい設定

### 🔴 重大な誤り：thinkingConfigの配置

**誤った実装**:
```javascript
const requestBody = {
  contents: [{...}],
  generationConfig: config.THINKING_GENERATION_CONFIG,
  thinkingConfig: config.THINKING_CONFIG  // ❌ トップレベルに配置（誤り）
};
```

**正しい実装**:
```json
{
  "contents": [{...}],
  "generationConfig": {
    "temperature": 1.0,
    "responseMimeType": "application/json",
    "thinkingConfig": {
      "thinkingBudget": -1,
      "includeThoughts": true
    }
  }
}
```

**重要**: `thinkingConfig`は`generationConfig`の**内部**に配置する必要があります！

---

## 📝 モデル名の確認

### Gemini 2.5 Flash

**安定版（GA）**: `gemini-2.5-flash`
- リリース日: 2025年6月17日
- コンテキスト: 1,048,576トークン（約100万）
- 最大出力: 65,535トークン

**プレビュー版**: `gemini-2.5-flash-preview-09-2025`
- リリース日: 2025年9月25日
- チューニング機能なし

### Gemini 2.5 Flash-Lite

**安定版（GA）**: `gemini-2.5-flash-lite`
- リリース日: 2025年7月22日
- 低レイテンシ向けに最適化

**プレビュー版**: `gemini-2.5-flash-lite-preview-09-2025`
- リリース日: 2025年9月25日
- チューニングとバッチ予測機能なし

---

## 🎯 思考モードの設定詳細

### thinking_budgetパラメータ

| モデル | 最小値 | 最大値 | デフォルト | 無効化 |
|--------|--------|--------|-----------|--------|
| Flash | 1 | 24,576 | 自動（上限8,192） | 0で無効化可能 |
| Flash-Lite | 512 | 24,576 | 自動 | 0で無効化可能 |
| Pro | 128 | 32,768 | 自動 | 無効化不可 |

**特記事項**:
- `-1`: モデルが自動で思考のタイミングと量を決定（推奨）
- `0`: 思考モードを無効化（Flash/Flash-Liteのみ）
- `正の整数`: 思考トークン数の上限を手動設定

### include_thoughtsパラメータ

- `true`: 思考の要約（thought summaries）をレスポンスに含める
- `false`: 思考の要約を含めない（デフォルト）

---

## 💰 思考モードのコスト

**重要**: 思考トークンは**出力トークン**としてカウントされます。

公式ドキュメントには思考モード専用の追加料金は**明記されていません**。つまり：

- **Flash思考モード出力**: $2.50/1M tokens（通常出力と同じ）
- **Flash-Lite思考モード出力**: $0.40/1M tokens（通常出力と同じ）

`response.usage_metadata.thoughts_token_count`で思考に使用されたトークン数を確認できます。

---

## 📋 サポートされる機能

### Gemini 2.5 Flash（GA版）

✅ サポート:
- Grounding with Google Search
- Code execution
- Tuning
- Batch prediction
- System instructions
- Function calling
- Structured output
- **Thinking mode**
- Vertex AI RAG Engine
- OpenAI compatibility

### Gemini 2.5 Flash-Lite（GA版）

✅ サポート:
- Grounding with Google Search
- Code execution
- System instructions
- Function calling
- Structured output
- **Thinking mode**
- Vertex AI RAG Engine
- Tuning
- Batch prediction

❌ 非サポート:
- Image generation
- Chat completions
- Fixed quota

---

## 🔧 推奨される実装（利用者_質疑応答プロジェクト）

### 第1段階: 情報抽出

**モデル**: `gemini-2.5-flash-lite`

**理由**:
- 最速（low latency）
- 情報抽出タスクに十分な性能
- コスト効率が良い（$0.10入力/$0.40出力）

**設定**:
```javascript
{
  "generationConfig": {
    "temperature": 0.2,
    "responseMimeType": "text/plain"
  }
}
```

### 第2段階: 回答生成（思考モード）

**モデル**: `gemini-2.5-flash`

**理由**:
- 思考モードによる深い分析が可能
- Flash-Liteより高性能
- Proより圧倒的に低コスト（Flash: $2.50出力 vs Pro: $10出力）

**設定**:
```javascript
{
  "generationConfig": {
    "temperature": 1.0,
    "responseMimeType": "application/json",
    "thinkingConfig": {
      "thinkingBudget": -1,  // モデルが自動制御（推奨）
      "includeThoughts": true
    }
  }
}
```

---

## ⚠️ 注意事項

### 1. 思考モードのコスト

思考トークンも出力トークンとしてカウントされるため、通常より出力トークン数が増加します：

**例**: 質問に1000トークンで回答する場合
- 思考モードOFF: 1000出力トークン × $2.50/1M = $0.0025
- 思考モードON: (思考2000 + 回答1000) = 3000出力トークン × $2.50/1M = $0.0075

**コスト増加**: 約3倍

### 2. レイテンシ

思考モードは推論時間を増加させます：
- 思考プロセスに時間がかかる
- 複雑な質問ほど思考時間が長くなる

### 3. Flash vs Flash-Lite

| 項目 | Flash | Flash-Lite |
|------|-------|-----------|
| 速度 | 高速 | 最速 |
| 性能 | 高性能 | 十分 |
| 入力コスト | $0.30/1M | $0.10/1M |
| 出力コスト | $2.50/1M | $0.40/1M |
| コスト差 | - | 1/3〜1/6 |

**推奨**: 情報抽出など単純なタスクはFlash-Lite、複雑な推論が必要なタスクはFlash

---

## 📚 公式ドキュメントリンク

- [Gemini 2.5 Flash](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash)
- [Gemini 2.5 Flash-Lite](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-lite)
- [Thinking Mode](https://cloud.google.com/vertex-ai/generative-ai/docs/thinking)
- [Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- [API Reference](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/gemini)

---

## 更新履歴

- 2025-01-28: 公式ドキュメント徹底調査、価格の誤りを発見、thinkingConfigの配置誤りを発見
