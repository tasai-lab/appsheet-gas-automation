# Appsheet_利用者_質疑応答 - ファイル構成

## プロジェクト概要
利用者データと質問を元に、Vertex AI Gemini 2.5 Flashを使用して回答と要約を生成するGASプロジェクト。非同期タスクキュー方式を採用し、AppSheet Webhookの6分制限に対応。

## ファイル構成（役割別）

### 1. 設定管理
- **config.gs** - 設定定数の一元管理
  - CONFIG.GEMINI - Vertex AI設定（プロジェクトID、リージョン、モデル名）
  - CONFIG.APPSHEET - AppSheet API設定（アプリID、アクセスキー、テーブル名）
  - CONFIG.ASYNC_CONFIG - 非同期タスクキュー設定
  - CONFIG.RETRY_SETTINGS - リトライ設定
  - STATUS - ステータス定数
  - EXCHANGE_RATE_USD_TO_JPY - 為替レート（150円/ドル）

### 2. Webhookエントリーポイント
- **webhook.gs** - AppSheetからのWebhookリクエスト受付
  - `doPost(e)` - Webhookエントリーポイント
  - `processRequest(params, startTime)` - リクエスト処理（冪等性チェック、タスクスケジューリング）
  - `validateParameters(params)` - パラメータ検証

### 3. 非同期タスク管理
- **task_queue.gs** - タスクキューの管理とスケジューリング
  - `scheduleAsyncTask(analysisId, params)` - タスクをキューに追加
  - `requestWorkerStart()` - ワーカー起動リクエスト
  - `getNextTaskFromQueue()` - キューから次のタスクを取得
  - `getTaskData(analysisId)` - タスクデータ取得
  - `cleanupTask(analysisId)` - タスククリーンアップ

- **task_worker.gs** - バックグラウンドワーカー
  - `processTaskQueueWorker()` - タスクキューワーカーのメインループ
  - `executeTask(analysisId, params)` - タスク実行（Gemini API呼び出し、AppSheet更新、ログ記録）

### 4. AI統合
- **vertex_ai_client.gs** - Vertex AI Gemini 2.5 Flash統合
  - `generateAnswerAndSummaryWithGemini(documentText, promptText)` - 回答と要約生成
  - `createGeminiPrompt(documentText, promptText)` - プロンプト生成
  - `parseGeminiResponse(responseText)` - レスポンスパース
  - `extractUsageMetadata(jsonResponse)` - API使用量情報抽出（トークン数、料金計算）
  - **価格設定**: Input $0.075/1M tokens, Output $0.30/1M tokens

### 5. AppSheet統合
- **appsheet_client.gs** - AppSheet APIクライアント
  - `updateOnSuccess(analysisId, answer, summary)` - 成功時のAppSheet更新
  - `updateOnError(analysisId, errorMessage)` - エラー時のAppSheet更新
  - `callAppSheetApi(payload)` - AppSheet API呼び出し

### 6. ユーティリティ
- **utilities.gs** - 汎用ヘルパー関数
  - `acquireIdempotencyLock(analysisId)` - 冪等性ロック取得
  - `releaseIdempotencyLock(analysisId)` - 冪等性ロック解除
  - `fetchWithRetry(url, options, apiName)` - リトライ機能付きHTTPリクエスト
  - `sleepWithJitter(delayMs)` - ジッター付きスリープ
  - `createJsonResponse(data)` - JSONレスポンス生成
  - `ApiError` - カスタムAPIエラークラス

### 7. 重複防止（共通モジュール）
- **duplication_prevention.gs** - Webhook重複実行防止ライブラリ
  - レコードIDベースの重複チェック
  - Webhookフィンガープリントによる重複検知
  - LockServiceを使用した排他制御
  - エラー時の自動クリーンアップ
  - *注: このプロジェクトでは主にutilities.gsの簡易冪等性機能を使用*

### 8. ログ記録（共通モジュール）
- **logger.gs** - 統合実行ログ記録
  - 一元化されたスプレッドシート（16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA）にログ記録
  - API使用量情報（トークン数、料金）の記録
  - `createLogger(scriptName)` - ロガーインスタンス生成
  - `logger.setUsageMetadata(metadata)` - API使用量情報設定
  - `logger.saveToSpreadsheet(status, recordId)` - スプレッドシート保存

### 9. Geminiクライアント（共通モジュール）
- **gemini_client.gs** - Gemini APIクライアント（共通モジュール）
  - *注: このプロジェクトではvertex_ai_client.gsを優先使用*
  - Google AI Studio API対応（レガシー）

### 10. テスト関数
- **test_functions.gs** - テスト用関数
  - `testVertexAIWithLog()` - Vertex AI基本テスト
  - `testVertexAIWithCustomData(documentText, promptText)` - カスタムデータテスト
  - `openExecutionLog()` - 実行ログスプレッドシートを開く

### 11. レガシーファイル
- **コード.gs** - 元の統合ファイル（843行）
  - *用途: 参照用として保持、新規開発では使用しない*
  - バックアップ: コード_backup_20251020.gs（.claspignoreで除外）

## ファイル依存関係

```
webhook.gs
  ├─ config.gs (設定)
  ├─ task_queue.gs (タスクスケジューリング)
  │   ├─ config.gs
  │   └─ utilities.gs (冪等性ロック)
  └─ utilities.gs (冪等性、レスポンス生成)

task_worker.gs
  ├─ config.gs
  ├─ task_queue.gs (タスク取得、クリーンアップ)
  ├─ vertex_ai_client.gs (AI処理)
  │   ├─ config.gs
  │   └─ utilities.gs (fetchWithRetry)
  ├─ appsheet_client.gs (AppSheet更新)
  │   ├─ config.gs
  │   └─ utilities.gs (fetchWithRetry)
  └─ logger.gs (ログ記録)

test_functions.gs
  ├─ vertex_ai_client.gs
  └─ logger.gs
```

## 処理フロー

### 1. Webhook受信（webhook.gs）
```
AppSheet → doPost()
  ↓
  validateParameters() ← config.gs
  ↓
  acquireIdempotencyLock() ← utilities.gs
  ↓
  scheduleAsyncTask() ← task_queue.gs
  ↓
  requestWorkerStart() ← task_queue.gs
  ↓
  応答返却（200ms以内）
```

### 2. 非同期処理（task_worker.gs）
```
processTaskQueueWorker()
  ↓
  getNextTaskFromQueue() ← task_queue.gs
  ↓
  executeTask()
    ├─ generateAnswerAndSummaryWithGemini() ← vertex_ai_client.gs
    │   ├─ Vertex AI API呼び出し
    │   └─ extractUsageMetadata() (料金計算)
    ├─ logger.setUsageMetadata() ← logger.gs
    ├─ updateOnSuccess() ← appsheet_client.gs
    └─ logger.saveToSpreadsheet() ← logger.gs
  ↓
  cleanupTask() ← task_queue.gs
```

## API使用量トラッキング

### 記録項目
- **Model**: vertex-ai-gemini-2.5-flash
- **Input Tokens**: promptTokenCount
- **Output Tokens**: candidatesTokenCount
- **Input Cost (JPY)**: (tokens / 1,000,000) × $0.075 × 150円
- **Output Cost (JPY)**: (tokens / 1,000,000) × $0.30 × 150円
- **Total Cost (JPY)**: Input + Output

### 実装箇所
1. **vertex_ai_client.gs**: `extractUsageMetadata()` で料金計算
2. **task_worker.gs**: `executeTask()` で `logger.setUsageMetadata()` 呼び出し
3. **logger.gs**: スプレッドシートにトークン数と料金を記録

## デプロイ設定

### .clasp.json
```json
{
  "rootDir": "./scripts",
  "scriptId": "1ylxzHrg6eYAqienPOL65uxxUCMCB0bkT3BNNujMmqQg5iXypsaFo3Gvi"
}
```

### .claspignore
バックアップファイルと開発ファイルを除外:
- `*_backup*.gs`
- `*_v[0-9]*.gs`
- `_backup/`
- `*.md`

### デプロイコマンド
```bash
cd /Users/t.asai/code/appsheet-gas-automation/gas_projects/projects/clients/Appsheet_利用者_質疑応答
clasp push
```

## テスト方法

### 1. Vertex AI基本テスト
```javascript
// GASエディタで実行
testVertexAIWithLog()
```

### 2. カスタムデータテスト
```javascript
const documentText = "利用者情報...";
const promptText = "質問内容...";
testVertexAIWithCustomData(documentText, promptText)
```

### 3. 実行ログ確認
```javascript
openExecutionLog()
// または直接アクセス:
// https://docs.google.com/spreadsheets/d/16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA
```

## 移行履歴

### 2025-10-20: ファイル構造最適化
- **変更内容**: モノリシックなコード.gs（843行）を役割別に11ファイルに分割
- **新規ファイル**:
  - config.gs - 設定管理
  - webhook.gs - エントリーポイント
  - task_queue.gs - タスクキュー管理
  - task_worker.gs - ワーカー処理
  - vertex_ai_client.gs - AI統合
  - appsheet_client.gs - AppSheet統合
  - utilities.gs - ユーティリティ
- **リネーム**: utils_duplicationPrevention.gs → duplication_prevention.gs
- **メリット**:
  - コードの可読性向上
  - モジュール単位でのテストが容易
  - 責任の明確化
  - メンテナンス性の向上

## 注意事項

1. **OAuth2スコープ**: Vertex AI使用のため `https://www.googleapis.com/auth/cloud-platform` が必要
2. **非同期処理**: AppSheet Webhookの6分制限に対応するため、タスクキュー方式を採用
3. **API料金**: Gemini 2.5 Flashは低コスト（Input $0.075/1M, Output $0.30/1M tokens）で効率的
4. **冪等性**: 重複実行防止のため、CacheServiceで冪等性を保証
5. **ログ記録**: 全実行ログは統合スプレッドシートに記録（16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA）

## 関連ドキュメント
- [SPECIFICATIONS.md](./SPECIFICATIONS.md) - 技術仕様
- [FLOW.md](./FLOW.md) - フロー図
- [README.md](./README.md) - ユーザーガイド
