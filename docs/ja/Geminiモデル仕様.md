# Gemini モデル仕様書

## 最新モデル情報（2025年1月時点）

### Gemini 2.5 Pro

- **モデル名**: `gemini-2.5-pro`
- **リリース日**: 2025年1月
- **用途**: 複雑な推論タスク、多段階思考が必要な処理
- **特徴**:
  - 高度な推論能力
  - 複雑な問題解決に最適
  - コード生成、分析、論理的思考に強い
- **推奨用途**:
  - 通話内容の要約生成
  - 看護記録の作成
  - 質疑応答システム
  - 複雑なデータ分析

### Gemini 2.5 Flash

- **モデル名**: `gemini-2.5-flash`
- **用途**: 高速処理、大量データの処理
- **特徴**:
  - 最高のコストパフォーマンス
  - 低レイテンシ
  - 高スループット
  - 軽量で高速
- **推奨用途**:
  - データ抽出
  - フォーマット変換
  - 単純な分類タスク
  - テキスト処理

### 旧モデル（非推奨）

- **Gemini 2.0系**: 実験的モデル（2.5系への移行を推奨）
- **Gemini 1.5系**: レガシーモデル（新規実装では使用しない）

## モデル選択ガイド

### 複雑な思考タスク → `gemini-2.5-pro`

#### 対象スクリプト
1. **Appsheet_通話_要約生成**
   - 通話内容の分析と要約
   - 重要ポイントの抽出
   - 構造化されたサマリー生成

2. **Appsheet_訪問看護_通常記録**
   - 看護記録の自動生成
   - 医療用語の適切な使用
   - 記録の構造化

3. **Appsheet_訪問看護_精神科記録**
   - 精神科特有の記録形式
   - 症状の詳細な記述
   - 専門的な評価

4. **Appsheet_利用者_質疑応答**
   - 質問の意図理解
   - 適切な回答生成
   - コンテキストの保持

5. **Appsheet_訪問看護_計画書問題点**
   - 問題点の分析
   - 解決策の提案
   - 優先順位付け

6. **Appsheet_訪問看護_計画書問題点_評価**
   - 計画の評価
   - 効果の分析
   - 改善提案

### シンプルなタスク → `gemini-2.5-flash`

#### 対象スクリプト（26プロジェクト）

1. **データ抽出系**
   - Appsheet_ALL_ファイルID
   - Appsheet_All_ファイル検索＋ID挿入
   - Appsheet_営業_ファイルID取得
   - Appsheet_通話_ファイルID取得

2. **フォーマット変換系**
   - Appsheet_名刺取り込み
   - Appsheet_訪問看護_書類OCR
   - Automation_レシート
   - Automation_請求書データ

3. **データ処理系**
   - Appsheet_ALL_Event
   - Appsheet_利用者_反映
   - Appsheet_利用者_基本情報上書き
   - Appsheet_利用者_家族情報作成

4. **通知・連携系**
   - Appsheet_ALL_スレッド投稿
   - Appsheet_ALL_スレッド更新
   - Appsheet_通話_スレッド投稿
   - Appsheet_通話_イベント作成
   - Appsheet_通話_タスク作成

5. **その他**
   - AppSheetSecureConnector
   - Appsheet_利用者_フェースシート
   - Appsheet_営業_音声記録
   - Appsheet_営業レポート
   - Appsheet_訪問看護_報告書
   - Appsheet_訪問看護_定期スケジュール
   - Appsheet_訪問看護_書類仕分け
   - Appsheet_訪問看護_訪問者自動
   - Appsheet_通話_クエリ
   - Appsheet_通話_新規依頼作成
   - Appsheet_関係機関_作成

## API仕様

### エンドポイント

```
https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent
```

### 認証方法

```javascript
const API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
```

### リクエスト形式

```javascript
const payload = {
  contents: [{
    parts: [{
      text: 'プロンプトテキスト'
    }]
  }],
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048
  }
};

const options = {
  method: 'post',
  contentType: 'application/json',
  payload: JSON.stringify(payload),
  muteHttpExceptions: true
};
```

### レスポンス形式

```javascript
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "生成されたテキスト"
      }]
    },
    "finishReason": "STOP",
    "safetyRatings": [...]
  }],
  "usageMetadata": {
    "promptTokenCount": 100,
    "candidatesTokenCount": 200,
    "totalTokenCount": 300
  }
}
```

## パラメータ調整ガイド

### Temperature（温度）

- **0.0 - 0.3**: 決定論的、一貫性重視
  - 使用例: データ抽出、フォーマット変換
  
- **0.4 - 0.7**: バランス型（推奨）
  - 使用例: 要約生成、記録作成
  
- **0.8 - 1.0**: 創造的、多様性重視
  - 使用例: 提案生成、アイデア出し

### Max Output Tokens

- **512**: 短い応答（データ抽出、分類）
- **1024**: 中程度の応答（要約、説明）
- **2048**: 長い応答（詳細な記録、レポート）
- **4096**: 非常に長い応答（包括的な分析）

### Top-K & Top-P

- **Top-K**: 40（推奨）
  - 上位40個のトークンから選択
  
- **Top-P**: 0.95（推奨）
  - 累積確率95%までのトークンから選択

## レート制限

### 無料枠
- **リクエスト数**: 15 RPM (Requests Per Minute)
- **トークン数**: 1,000,000 TPM (Tokens Per Minute)

### 有料プラン
- **リクエスト数**: 360 RPM
- **トークン数**: 4,000,000 TPM

### 推奨: レート制限対策

```javascript
function callGeminiWithRetry(prompt, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return callGeminiAPI(prompt);
    } catch (e) {
      if (e.message.includes('429') || e.message.includes('quota')) {
        // レート制限エラー
        const waitTime = Math.pow(2, i) * 1000; // 指数バックオフ
        Utilities.sleep(waitTime);
        continue;
      }
      throw e;
    }
  }
  throw new Error('Max retries exceeded');
}
```

## コスト最適化

### 推奨事項

1. **適切なモデル選択**
   - シンプルなタスクにはFlashを使用
   - 複雑なタスクのみThinkingを使用

2. **プロンプトの最適化**
   - 簡潔で明確な指示
   - 不要な情報を削除
   - Few-shot examplesは最小限に

3. **レスポンスの制限**
   - maxOutputTokensを適切に設定
   - 必要な情報のみ要求

4. **キャッシング活用**
   - 繰り返し使用するプロンプトをキャッシュ
   - システムプロンプトの再利用

## エラーハンドリング

### 主なエラーコード

```javascript
function handleGeminiError(error) {
  const errorMessage = error.message || JSON.stringify(error);
  
  if (errorMessage.includes('429')) {
    // レート制限エラー
    logToSheet('ERROR', 'Rate limit exceeded', errorMessage);
    Utilities.sleep(60000); // 1分待機
    return 'RETRY';
  }
  
  if (errorMessage.includes('400')) {
    // 不正なリクエスト
    logToSheet('ERROR', 'Invalid request', errorMessage);
    return 'INVALID_REQUEST';
  }
  
  if (errorMessage.includes('401') || errorMessage.includes('403')) {
    // 認証エラー
    logToSheet('ERROR', 'Authentication failed', errorMessage);
    return 'AUTH_ERROR';
  }
  
  if (errorMessage.includes('500')) {
    // サーバーエラー
    logToSheet('ERROR', 'Server error', errorMessage);
    return 'SERVER_ERROR';
  }
  
  // その他のエラー
  logToSheet('ERROR', 'Unknown error', errorMessage);
  return 'UNKNOWN_ERROR';
}
```

## Gemini API vs Vertex AI

### 現在の選択: Gemini API

#### 理由
1. **シンプルな実装**: APIキーのみで使用可能
2. **迅速な開発**: 複雑な認証設定不要
3. **コスト効率**: 無料枠が充実
4. **十分なセキュリティ**: 適切なキー管理で対応可能

### Vertex AIへの移行を検討すべき場合

1. **セキュリティ要件の強化**
   - 医療データの厳格な管理が必要
   - コンプライアンス要件
   - APIキー漏洩リスクの完全排除

2. **スケール拡大**
   - 大量のリクエスト処理
   - SLA保証が必要
   - 高いレート制限が必要

3. **エンタープライズ機能**
   - 詳細な監査ログ
   - データローカリティ制御
   - VPC-SC対応

詳細: [Gemini API vs Vertex AI 比較](../GEMINI_VS_VERTEX_COMPARISON.md)

## 参考リンク

- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Model Reference](https://ai.google.dev/gemini-api/docs/models)
- [Pricing](https://ai.google.dev/pricing)
- [Quota and Limits](https://ai.google.dev/gemini-api/docs/quota)

## 更新履歴

### 2025-10-17
- Gemini 2.5系への全面移行
- モデル名を gemini-2.5-pro と gemini-2.5-flash に統一

### 2025-01-21
- Gemini 2.0 Flash Thinking Experimentalの追加
- モデル選択ガイドの更新

### 2025-01-16
- 初版作成
- Gemini 2.0シリーズの情報整理

## 次のステップ

1. **モニタリング**: API使用量の監視
2. **最適化**: プロンプトとパラメータの継続的な改善
3. **評価**: モデル性能の定期的な評価
4. **更新**: 新モデルリリース時の検証と移行
