# Vertex AI Gemini Models Research - 2025-01-28

## 🎯 調査目的

利用者_質疑応答プロジェクトの2段階AI処理で使用する適切なモデルを特定し、正確な価格とthinkingConfigの正しい設定方法を確定する。

---

## 🔴 重大な発見：実装の誤り

### 1. 価格の過小評価（4〜8倍）

**実装していた価格（誤り）**:
```javascript
'gemini-2.5-flash': {
  text: { inputPer1M: 0.075, outputPer1M: 0.30 },  // ❌ 完全に誤り
}
```

**正しい価格（公式確認済み）**:
```javascript
'gemini-2.5-flash': {
  text: { inputPer1M: 0.30, outputPer1M: 2.50 },  // ✅ 正解
}
```

**誤差の影響**:

- 入力コスト: **4倍の過小評価**（$0.075 → $0.30）
- 出力コスト: **8.3倍の過小評価**（$0.30 → $2.50）
- 実際のコストは記録値の**約4〜8倍**であった可能性

### 2. thinkingConfigの配置誤り

**誤った実装**:
```javascript
const requestBody = {
  contents: [{...}],
  generationConfig: config.THINKING_GENERATION_CONFIG,
  thinkingConfig: config.THINKING_CONFIG  // ❌ トップレベルに配置（誤り）
};
```

**正しい実装**:
```javascript
const requestBody = {
  contents: [{...}],
  generationConfig: {
    temperature: 1.0,
    responseMimeType: "application/json",
    thinkingConfig: {  // ✅ generationConfig内に配置
      thinkingBudget: -1,
      includeThoughts: true
    }
  }
};
```

**重要**: `thinkingConfig`は`generationConfig`の**内部**に配置する必要があります！

---

## 📊 正確な価格表（2025年1月時点）

### Gemini 2.5 Flash

| 項目 | 価格（USD/1M tokens） | 日本円換算（150円/USD） |
|------|---------------------|-------------------|
| テキスト/画像/動画 入力 | $0.30 | 45円 |
| 音声入力 | $1.00 | 150円 |
| テキスト出力 | $2.50 | 375円 |
| 画像出力 | $30.00 | 4,500円 |
| キャッシュ入力（90%割引） | $0.030 | 4.5円 |

**特徴**:

- コンテキスト: 1,048,576トークン（約100万）
- 最大出力: 65,535トークン
- 思考モード対応

### Gemini 2.5 Flash-Lite

| 項目 | 価格（USD/1M tokens） | 日本円換算（150円/USD） |
|------|---------------------|-------------------|
| テキスト入力 | $0.10 | 15円 |
| 音声入力 | $0.30 | 45円 |
| テキスト出力 | $0.40 | 60円 |

**特徴**:

- コンテキスト: 1,048,576トークン
- 最大出力: 8,192トークン
- 低レイテンシ向けに最適化
- 思考モード対応

### Gemini 2.5 Pro

| 項目 | 価格（USD/1M tokens） | 日本円換算（150円/USD） |
|------|---------------------|-------------------|
| テキスト入力（≤200K） | $1.25 | 187.5円 |
| テキスト入力（>200K） | $2.50 | 375円 |
| テキスト出力（≤200K） | $10.00 | 1,500円 |
| テキスト出力（>200K） | $15.00 | 2,250円 |

**特徴**:

- 最高性能
- 思考モード常時有効（無効化不可）

**公式ソース**: <https://cloud.google.com/vertex-ai/generative-ai/pricing>

---

## 🧠 思考モード（Thinking Mode）の正しい設定

### thinking_budgetパラメータ

| モデル | 最小値 | 最大値 | デフォルト | 無効化 |
|--------|--------|--------|-----------|--------|
| Flash | 1 | 24,576 | 自動（上限8,192） | 0で無効化可能 |
| Flash-Lite | 512 | 24,576 | 自動 | 0で無効化可能 |
| Pro | 128 | 32,768 | 自動 | 無効化不可 |

**値の意味**:

- `-1`: モデルが自動で思考のタイミングと量を決定（**推奨**）
- `0`: 思考モードを無効化（Flash/Flash-Liteのみ）
- `正の整数`: 思考トークン数の上限を手動設定

### include_thoughtsパラメータ

- `true`: 思考の要約（thought summaries）をレスポンスに含める
- `false`: 思考の要約を含めない（デフォルト）

### 正しいAPI設定方法

```javascript
// config.gsの設定
THINKING_GENERATION_CONFIG: {
  "temperature": 1.0,
  "responseMimeType": "application/json",
  "thinkingConfig": {  // ✅ generationConfig内に配置
    "thinkingBudget": -1,
    "includeThoughts": true
  }
}

// vertex_ai_client.gsでの使用
const requestBody = {
  contents: [{
    role: "user",
    parts: [{ text: prompt }]
  }],
  generationConfig: config.THINKING_GENERATION_CONFIG  // thinkingConfigは内部に含まれている
};
```

---

## 💰 思考モードのコスト

**重要**: 思考トークンは**出力トークン**としてカウントされます。

- **Flash思考モード出力**: $2.50/1M tokens（通常出力と同じ）
- **Flash-Lite思考モード出力**: $0.40/1M tokens（通常出力と同じ）
- **Pro思考モード出力**: $10.00/1M tokens（通常出力と同じ）

### コスト例

**Flashモデルで質問に1000トークンで回答する場合**:

| モード | 出力トークン | コスト |
|--------|-------------|--------|
| 思考モードOFF | 1,000 | $0.0025 |
| 思考モードON | 3,000（思考2,000 + 回答1,000） | $0.0075 |

**コスト増加**: 約3倍

`response.usage_metadata.thoughts_token_count`で思考に使用されたトークン数を確認できます。

---

## 🔧 推奨実装（利用者_質疑応答プロジェクト）

### 第1段階: プロンプト最適化

**モデル**: `gemini-2.5-flash-lite`

**用途**: 提供情報を使って思考モデル用の最適化されたプロンプトを生成

**アプローチ**:

Flash-Liteは単なる情報抽出ではなく、思考モデルが最適に推論できるように：

1. 質問に関連する重要情報を特定
2. 冗長情報・無関係情報を削除
3. 日付、数値、状態変化を明確化
4. 論理的な構造で情報を整理
5. 思考モデルに渡すプロンプトを直接生成

**選定理由**:

- 最速（low latency）でプロンプト最適化に十分な性能
- **コスト効率が良い**（Flash比: 入力1/3、出力1/6）
- 大量の生データから本質的な情報を抽出

**設定**:

```javascript
EXTRACTOR_MODEL_NAME: 'gemini-2.5-flash-lite',

GENERATION_CONFIG: {
  "temperature": 0.2  // プロンプト最適化なので低めの温度
}
```

### 第2段階: Proモデルによる高品質な回答生成

**モデル**: `gemini-2.5-pro`（思考モード常時有効）

**用途**: 最適化されたプロンプトを使用して深い推論により最高品質の回答を生成

**アプローチ**:

Flash-Liteで最適化されたプロンプトを受け取り：

1. Proの強力な推論能力で情報を深く分析
2. 時系列変化や因果関係を論理的に推論
3. 統合された洞察を提供
4. 詳細で正確な回答と簡潔な要約を生成

**選定理由**:

- **最高品質の推論と回答**: Proモデルは全モデル中で最高性能
- 思考モードが常時有効で無効化不可（より深い推論）
- 最適化されたプロンプトで効率的に推論
- **JSON生成の正確性が高い**: パースエラーが少ない

**設定**:

```javascript
THINKING_MODEL_NAME: 'gemini-2.5-pro',

THINKING_GENERATION_CONFIG: {
  "temperature": 1.0,  // Pro推奨設定
  "responseMimeType": "application/json",
  "thinkingConfig": {
    "thinkingBudget": -1,  // モデルが自動制御（推奨）
    "includeThoughts": true  // 思考の要約を含める
  }
}
```

**コスト**:
- 入力: $1.25/1M tokens (≤200K)、$2.50/1M tokens (>200K)
- 出力: $10.00/1M tokens (≤200K)、$15.00/1M tokens (>200K)
- Flash比: 入力4-8倍、出力4-6倍のコストだが、品質で大きく上回る

### 2段階処理の利点

このアーキテクチャの利点：

1. **効率的なトークン使用**: Flash-Liteが冗長情報を削減（低コスト）
2. **最高品質の推論**: Proモデルで最も正確で深い分析
3. **処理の分離**: プロンプト最適化と推論を明確に分離
4. **コストと品質のバランス**: 第1段階で低コスト、第2段階で高品質
5. **JSON生成の信頼性**: Proモデルでパースエラーが大幅に減少

---

## 📝 モデル名の確認

### Flash モデル名

**安定版（GA）**: `gemini-2.5-flash`

- リリース日: 2025年6月17日
- 推奨使用

**プレビュー版**: `gemini-2.5-flash-preview-09-2025`

- リリース日: 2025年9月25日
- チューニング機能なし
- プロダクション使用は非推奨

### Flash-Lite モデル名

**安定版（GA）**: `gemini-2.5-flash-lite`

- リリース日: 2025年7月22日
- 推奨使用

**プレビュー版**: `gemini-2.5-flash-lite-preview-09-2025`

- リリース日: 2025年9月25日
- プロダクション使用は非推奨

---

## ❌ 誤った実装例

### 間違い1: 実験版モデル名の使用

```javascript
// ❌ 間違い
THINKING_MODEL_NAME: 'gemini-2.5-flash-thinking-exp-01-21'
```

**問題点**:

- これは実験版のモデル名で、GA版ではない
- 思考モードは**モデル名ではなくthinkingConfigで制御**するのが正しい

**正しい方法**:
```javascript
// ✅ 正しい
THINKING_MODEL_NAME: 'gemini-2.5-flash',
THINKING_GENERATION_CONFIG: {
  thinkingConfig: { thinkingBudget: -1, includeThoughts: true }
}
```

### 間違い2: thinkingConfigの配置

```javascript
// ❌ 間違い
const requestBody = {
  generationConfig: { temperature: 1.0 },
  thinkingConfig: { thinkingBudget: -1 }  // トップレベルに配置
};
```

**正しい方法**:
```javascript
// ✅ 正しい
const requestBody = {
  generationConfig: {
    temperature: 1.0,
    thinkingConfig: { thinkingBudget: -1 }  // generationConfig内に配置
  }
};
```

### 間違い3: 価格の過小評価

```javascript
// ❌ 間違い
'gemini-2.5-flash': {
  text: { inputPer1M: 0.075, outputPer1M: 0.30 }
}
```

**正しい価格**:
```javascript
// ✅ 正しい
'gemini-2.5-flash': {
  text: { inputPer1M: 0.30, outputPer1M: 2.50 }
}
```

---

## ⚠️ 注意事項

### 1. 思考モードのレイテンシ

思考モードは推論時間を増加させます：

- 思考プロセスに時間がかかる
- 複雑な質問ほど思考時間が長くなる
- GASの6分タイムアウト制限に注意

### 2. Flash vs Flash-Lite の比較

| 項目 | Flash | Flash-Lite | 差異 |
|------|-------|-----------|-----|
| 速度 | 高速 | 最速 | Lite +20-30%速い |
| 性能 | 高性能 | 十分 | Flash がやや高性能 |
| 入力コスト | $0.30/1M | $0.10/1M | Lite は 1/3 |
| 出力コスト | $2.50/1M | $0.40/1M | Lite は 1/6 |
| 最大出力 | 65,535 | 8,192 | Flash が 8倍 |

**推奨使い分け**:

- **情報抽出・分類・要約**: Flash-Lite
- **複雑な推論・長い回答生成**: Flash

### 3. コスト最適化のポイント

1. **抽出段階でFlash-Liteを使用**: 入力1/3、出力1/6のコスト削減
2. **思考モードは本当に必要な時だけ**: 通常より出力トークンが約3倍
3. **プロンプトの最適化**: 不要な情報を削減し、トークン数を削減

---

## 📚 公式ドキュメントリンク

- [Gemini 2.5 Flash](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash)
- [Gemini 2.5 Flash-Lite](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-lite)
- [Thinking Mode](https://cloud.google.com/vertex-ai/generative-ai/docs/thinking)
- [Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- [API Reference](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/gemini)
- [Flash-Lite GA発表](https://developers.googleblog.com/en/gemini-25-flash-lite-is-now-stable-and-generally-available/)

---

## 修正履歴

### v84: 2025-01-29

- 🚀 **第2段階をProモデルに変更**:
  - Flash思考モデル → Proモデルに変更
  - 最高品質の推論と回答生成を実現
  - JSON生成の正確性向上（パースエラー減少）
- 🔧 **設定変更**:
  - `THINKING_MODEL_NAME`: 'gemini-2.5-flash' → 'gemini-2.5-pro'
  - Proは思考モード常時有効（無効化不可）
- 📝 **ドキュメント更新**:
  - Proモデルの特性と利点を明記
  - コスト情報の更新
- ✅ **デプロイ完了**: v84としてデプロイ完了 (@84)

### v83: 2025-01-29

- 🚀 **2段階処理アーキテクチャ最適化**:
  - 第1段階を「情報抽出」から「プロンプト最適化」に変更
  - Flash-Liteが思考モデル用の最適化されたプロンプトを生成
- 🔧 **実装の改善**:
  - `_extractRelevantInfo` → `_optimizePromptWithFlashLite` に改名
  - 関数シグネチャ変更: `extractedText` → `optimizedPrompt`
  - プロンプト生成ロジックの最適化（構造化・論理化）
- 📝 **ドキュメント更新**:
  - 2段階処理の利点を明確化
  - 各段階のアプローチを詳細化
- ✅ **デプロイ完了**: v83としてデプロイ完了

### v82: 2025-01-28

- 🔴 **価格の誤り修正**: Flash入力4倍、出力8.3倍の過小評価を発見・修正
- 🔴 **thinkingConfig配置修正**: generationConfig内に配置する正しい方法に修正
- ✅ **公式ドキュメント徹底調査**: 5つの公式ページを直接確認
- ✅ **実装への適用**: config.gs、vertex_ai_client.gs を修正
- ✅ **デプロイ完了**: v82としてデプロイ完了

### 初回: 2025-01-28

- Gemini 2.5 Flash-Liteと思考モードの基本調査
- モデル名の特定
- 使用方法の初期調査（不完全）
