# Google Gemini モデル名リファレンス

**最終更新日**: 2025-10-16

## 最新のGemini 2.5シリーズ

Google Gemini APIの最新モデル（2025年時点）:

### 1. Gemini 2.5 Pro
- **モデルID**: `gemini-2.5-pro` または `google.gemini-2.5-pro`
- **用途**: 複雑な問題解決に最適
  - コード生成・デバッグ
  - 数学・データ分析
  - 長文の理解・生成
  - 複雑な推論タスク
- **特徴**: 
  - 大きなコンテキストウィンドウ
  - 最も高度な理解力と推論能力
  - マルチモーダル対応（テキスト、コード、画像、音声、動画）

### 2. Gemini 2.5 Flash
- **モデルID**: `gemini-2.5-flash` または `google.gemini-2.5-flash`
- **用途**: 大規模処理タスク
  - 高速処理が必要なタスク
  - 大量データ処理
  - リアルタイム応答
- **特徴**:
  - 速度と性能のバランス
  - コスト効率が高い
  - マルチモーダル対応

### 3. Gemini 2.5 Flash-Lite
- **モデルID**: `gemini-2.5-flash-lite`
- **用途**: 高スループット処理
  - 最もコスト効率重視
  - 軽量タスク
  - バッチ処理
- **特徴**:
  - 最速
  - 最も低コスト

### 4. Gemini 2.5 Computer Use
- **モデルID**: `gemini-2.5-computer-use`
- **用途**: Web自動化
  - ブラウザ操作
  - UI操作
  - Webスクレイピング
- **特徴**:
  - 人間のようなWeb操作能力
  - AIエージェント向け

## 旧モデル（非推奨）

### Gemini 1.5 シリーズ
- `gemini-1.5-pro`: → **gemini-2.5-pro** に移行推奨
- `gemini-1.5-flash`: → **gemini-2.5-flash** に移行推奨
- `gemini-1.5-flash-8b`: → **gemini-2.5-flash-lite** に移行推奨

### Gemini 1.0 シリーズ
- `gemini-pro`: 廃止予定
- `gemini-flash`: 廃止予定

## 使用推奨

### 本プロジェクトでの使い分け

#### 🔵 gemini-2.5-pro を使用すべきケース:

1. **通話要約生成**
   - 音声→テキスト→構造化要約
   - 複数話者の理解
   - 文脈把握

2. **看護記録作成**
   - 医療専門用語の理解
   - 正確な記録生成
   - デリケートな内容の処理

3. **精神科記録**
   - 繊細な内容理解
   - 専門的判断
   - 詳細な記録生成

4. **質疑応答**
   - 文脈理解
   - 複雑な推論
   - 適切な回答生成

5. **レポート生成**
   - 複数情報の統合
   - 分析と洞察
   - 構造化された出力

6. **新規依頼作成**
   - 要件理解
   - 判断と分類
   - データ構造化

#### ⚡ gemini-2.5-flash を使用すべきケース:

1. **OCR処理**
   - 画像→テキスト抽出
   - 高速処理

2. **書類仕分け**
   - 分類タスク
   - パターン認識

3. **名刺取り込み**
   - 定型情報抽出
   - データ整形

4. **データ更新・反映**
   - 単純変換
   - データ同期

5. **基本情報作成**
   - テンプレート処理
   - 定型フォーマット

## API仕様

### Gemini API (ai.google.dev)

```javascript
// Apps Scriptでの使用例
const apiKey = 'YOUR_API_KEY';
const model = 'gemini-2.5-pro'; // または gemini-2.5-flash

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
```

### Vertex AI (cloud.google.com)

```javascript
// Vertex AI経由での使用
const model = 'google.gemini-2.5-pro'; // プレフィックス付き
const location = 'asia-northeast1'; // 日本リージョン

const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
```

## 料金（2025年時点）

| モデル | 入力 | 出力 | 相対コスト |
|--------|------|------|-----------|
| gemini-2.5-pro | $0.00025/1K文字 | $0.0005/1K文字 | 100% |
| gemini-2.5-flash | $0.000075/1K文字 | $0.00015/1K文字 | 30% (70%削減) |
| gemini-2.5-flash-lite | 未公開 | 未公開 | さらに低コスト |

## パフォーマンス

| モデル | レスポンスタイム | スループット | 品質 |
|--------|----------------|--------------|------|
| gemini-2.5-pro | 1.5-3.0秒 | 低 | 最高 |
| gemini-2.5-flash | 0.5-1.0秒 | 高 | 高 |
| gemini-2.5-flash-lite | 0.3-0.7秒 | 最高 | 中 |

## リファレンス

- **公式ドキュメント**: https://ai.google.dev/gemini-api/docs/models
- **Vertex AI**: https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-pro
- **料金**: https://ai.google.dev/pricing

## 変更履歴

- **2025-10-16**: 初版作成、Gemini 2.5シリーズ情報追加
- **確認情報源**: Google AI公式ドキュメント、Vertex AIドキュメント

---

**注意**: モデル名は必ず公式ドキュメントで最新情報を確認してください。
