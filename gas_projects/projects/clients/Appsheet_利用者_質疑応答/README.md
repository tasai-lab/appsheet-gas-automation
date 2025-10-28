# Appsheet_利用者_質疑応答

**Script ID:** 1ylxzHrg6eYAqienPOL65uxxUCMCB0bkT3BNNujMmqQg5iXypsaFo3Gvi

**Created:** 2025-07-31T07:37:21.746Z

**Modified:** 2025-10-20

**Current Version:** v1.2.0

**Owners:** Fractal Group

## 概要

利用者の情報（フェースシート、看護記録など）に対するユーザーの質問に、Vertex AI Gemini APIで自動回答を生成するGASプロジェクトです。
非同期タスクキュー方式により、長時間実行を安定して処理します。

**✨ v1.2.0 新機能**: 2段階AI処理による高度な質疑応答システム
- **モード1（参照資料ベース）**: 外部文章を参照した専門的な回答生成
- **モード2（通常の質疑応答）**: 利用者IDと基本情報・参考資料から関連情報を抽出し、思考モデルで深い分析と回答を生成

## 主な機能

### AI駆動の質疑応答システム

- ✅ **Vertex AI Gemini 2.5 Pro**: OAuth2認証による安全なAPI呼び出し
- ✅ **3つの処理モード**:
  - **モード1（参照資料ベース）**: 外部文章（利用者情報等）を参照した専門的な回答
  - **モード2（2段階AI処理）**: 
    - 第1段階: gemini-2.5-flashで利用者基本情報・参考資料から関連情報を抽出
    - 第2段階: gemini-2.5-flash-thinking-exp-01-21で深い分析と回答を生成
- ✅ **非同期タスクキュー**: 6分の実行制限を回避する自動ワーカー起動
- ✅ **コンテキスト理解**: 参照資料を深く分析し的確な回答を生成
- ✅ **回答+要約**: 詳細回答と簡潔な要約を同時生成

### システム機能

- ✅ **重複防止機能**: リクエストIDベースの冪等性保証
- ✅ **一元化ログ記録**: 全実行履歴を集中スプレッドシートに記録
- ✅ **エラーハンドリング**: AppSheetへのエラーステータス自動反映
- ✅ **API使用量追跡**: トークン数とコスト（日本円）を自動記録

## 技術仕様

### 使用モデル

#### モード1（参照資料ベース）

- **モデル**: Vertex AI Gemini 2.5 Pro
- **認証方式**: OAuth2（ScriptApp.getOAuthToken()）
- **Temperature**: 0.2（一貫性重視）
- **ResponseMimeType**: application/json

#### モード2（2段階AI処理）

**第1段階: 情報抽出**

- **モデル**: gemini-2.5-flash
- **役割**: 利用者基本情報と参考資料から質問に関連する情報を抽出
- **Temperature**: 0.2
- **ResponseMimeType**: application/json

**第2段階: 回答生成**

- **モデル**: gemini-2.5-flash-thinking-exp-01-21
- **役割**: 抽出された情報を用いて深い分析と回答を生成
- **Temperature**: 1.0（思考モデル推奨設定）
- **レスポンス**: テキスト形式（思考過程を含む）

### 処理モード

このシステムは2つの処理モードをサポートしています:

#### モード1: 参照資料ベースの回答

- 利用者情報などの外部文章を参照して回答を生成
- 専門的で具体的な回答が必要な場合に使用
- **必須パラメータ**: `promptText`, `documentText`

#### モード2: 通常の質疑応答（2段階AI処理）

- 利用者IDと基本情報・参考資料から関連情報を抽出し、思考モデルで回答生成
- 複雑な分析や深い洞察が必要な場合に使用
- **必須パラメータ**: `promptText`, `userId`, `userBasicInfo`, `referenceData`
- **処理フロー**:
  1. gemini-2.5-flashで関連情報を抽出
  2. 抽出された情報と質問をgemini-2.5-flash-thinkingに渡して回答生成

### 非同期タスクキュー

```javascript
ASYNC_CONFIG: {
  WORKER_FUNCTION_NAME: 'processTaskQueueWorker',
  WORKER_ACTION_KEY: 'start_worker_v1',
  QUEUE_KEY: 'TASK_QUEUE',
  CACHE_EXPIRATION_SECONDS: 600, // 10分
  MAX_EXECUTION_TIME_MS: 300000  // 5分
}
```

### レスポンス形式

```json
{
  "answer": "詳細な回答テキスト",
  "summary": "回答の簡潔な要約"
}
```

## Structure

### スクリプトファイル構成

#### エントリーポイント
- `webhook.gs`: Webhookリクエスト受信・タスクキュー登録

#### コアモジュール
- `task_queue.gs`: タスクキュー管理（ScriptProperties使用）
- `task_worker.gs`: 非同期ワーカー処理
- `vertex_ai_client.gs`: Vertex AI Gemini APIクライアント
- `appsheet_client.gs`: AppSheet API連携（Client_Analyticsテーブル更新）
- `duplication_prevention.gs`: 重複実行防止
- `logger.gs`: 実行ログ記録

#### ユーティリティ
- `config.gs`: 設定管理
- `utilities.gs`: 共通ユーティリティ関数
- `test_functions.gs`: テスト関数

### その他
- `appsscript.json`: プロジェクトマニフェスト
- `project_metadata.json`: プロジェクトメタデータ
- `spreadsheets/`: 参照スプレッドシートメタデータ
- `FILE_STRUCTURE.md`: ファイル構造詳細

## Referenced Spreadsheets

- **GAS実行ログ** (ID: 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)

## デプロイ

```bash
# 統合デプロイスクリプトを使用（推奨）
python deploy_unified.py Appsheet_利用者_質疑応答 "v1.x: 説明"
```

詳細は [DEPLOY_GUIDE.md](../../DEPLOY_GUIDE.md) を参照してください。

## 設定

### CONFIG設定（config.gs）

```javascript
const CONFIG = {
  GEMINI: {
    MODEL_NAME: 'gemini-2.5-flash',
    GCP_PROJECT_ID: 'macro-shadow-458705-v8',
    GCP_LOCATION: 'us-central1',
    GENERATION_CONFIG: {
      "responseMimeType": "application/json",
      "temperature": 0.2
    }
  },
  APPSHEET: {
    APP_ID: 'f40c4b11-b140-4e31-a60c-600f3c9637c8',
    ACCESS_KEY: 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY',
    TABLE_NAME: 'Client_Analytics'
  }
};
```

## テスト

### GASエディタでのテスト実行

#### 参照資料ベースの質疑応答をテスト

```javascript
// testProcessClientQA() を実行
function testProcessClientQA() {
  const result = processClientQA(
    '転倒リスクを減らすために、どのような対策が必要ですか？',
    `# 利用者基本情報
氏名: 田中花子
年齢: 82歳
要介護度: 要介護3

# 現在の状態
・独居
・歩行が不安定
・血圧が高め（150/90）`
  );
  
  Logger.log('回答: ' + result.answer);
  Logger.log('要約: ' + result.summary);
}
```

#### 通常の質疑応答をテスト（新機能: モード2）

```javascript
// testNormalQAWithTwoStage() を実行
function testNormalQAWithTwoStage() {
  // サンプルの利用者データで2段階AI処理をテスト
  // 結果には以下が含まれます:
  // - answer: 最終回答
  // - summary: 要約
  // - extractedInfo: 抽出された関連情報
  Logger.log(result.extractedInfo);  // 第1段階の抽出結果を確認
}

// カスタムデータでテスト
testNormalQAWithTwoStageCustom(
  '今後の支援について提案してください',
  'USER001',
  '氏名: 山田花子\n年齢: 82歳\n要介護度: 要介護3',
  '訪問記録: 歩行が不安定、転倒リスクあり'
);
```

### その他のテスト関数

#### モード1（参照資料ベース）のテスト

- `testVertexAIWithLog()` - 参照資料ベースのVertex AIテスト
- `testProcessClientQAWithAppSheet()` - AppSheet更新込みのテスト
- `testProcessClientQAErrorHandling()` - エラーハンドリングのテスト

#### モード2（2段階AI処理）のテスト

```javascript
// testNormalQAWithTwoStage() を実行
function testNormalQAWithTwoStage() {
  // 利用者ID、基本情報、参考資料を使った2段階AI処理のテスト
  // 抽出された関連情報と最終回答を確認できます
}

// カスタムデータでテスト
function testNormalQAWithTwoStageCustom(promptText, userId, userBasicInfo, referenceData) {
  // 任意のデータで2段階AI処理をテスト
}
```

詳細は `scripts/test_functions.gs` を参照してください。

## ドキュメント

- **[SPECIFICATIONS.md](./SPECIFICATIONS.md)** - 技術仕様書
- **[FLOW.md](./FLOW.md)** - フロー図
- **[FILE_STRUCTURE.md](./FILE_STRUCTURE.md)** - ファイル構造詳細
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - バージョン移行ガイド
