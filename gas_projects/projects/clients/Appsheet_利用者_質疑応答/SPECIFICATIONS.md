# Appsheet_利用者_質疑応答 - 詳細仕様書

## 目的

このスクリプトは、AppSheetアプリケーションと連携し、AI駆動の質疑応答処理を実行します。

**処理モード**:

1. **モード1（参照資料ベース）**: 利用者情報などの外部文章を参照して専門的な回答を生成
2. **モード2（2段階AI処理）**: 利用者ID、基本情報、参考資料から関連情報を抽出し、思考モデルで深い分析と回答を生成

両方のモードで、Vertex AI Gemini APIを使用して詳細な回答と要約を生成します。

## システム構成

### 使用モデル

#### モード1（参照資料ベース）

- **モデル**: gemini-2.5-pro
- **用途**: 外部文章を参照した専門的な回答生成
- **Temperature**: 0.2
- **ResponseMimeType**: application/json

#### モード2（2段階AI処理）

**第1段階: 情報抽出**

- **モデル**: gemini-2.5-flash
- **用途**: 基本情報と参考資料から質問に関連する情報を抽出
- **Temperature**: 0.2
- **ResponseMimeType**: application/json

**第2段階: 回答生成**

- **モデル**: gemini-2.5-flash-thinking-exp-01-21
- **用途**: 抽出された情報を用いて深い分析と回答を生成
- **Temperature**: 1.0
- **レスポンス形式**: テキスト（思考過程を含む）

### コンポーネント

1. **Webhook受信ハンドラ** (`doPost`)
   - AppSheetからのPOSTリクエストを受信
   - JSONペイロードをパース
   - 重複チェックを実行

2. **重複防止モジュール** (`DuplicationPrevention`)
   - SHA-256ハッシュによるリクエスト識別
   - ScriptCacheによる処理済みマーク
   - LockServiceによる排他制御

3. **実行ログモジュール** (`ExecutionLogger`)
   - すべての処理結果を記録
   - タイムスタンプ、ステータス、エラー詳細を保存
   - スプレッドシートに集約

4. **ビジネスロジック**
   - プロジェクト固有の処理
   - 外部API呼び出し（Gemini APIなど）
   - データ変換と保存

## 関数一覧

- `logExecution` (ExecutionLogger)
- `getOrCreateLogSpreadsheet` (ExecutionLogger)
- `acquireLock` (ExecutionLogger)
- `releaseLock` (ExecutionLogger)
- `isDuplicateRequest` (ExecutionLogger)
- `formatError` (ExecutionLogger)
- `checkDuplicateRequest` (utils_duplicationPrevention)
- `markAsProcessingWithLock` (utils_duplicationPrevention)
- `markAsCompleted` (utils_duplicationPrevention)
- `markAsFailed` (utils_duplicationPrevention)
- `clearProcessingFlag` (utils_duplicationPrevention)
- `isProcessingOrCompleted` (utils_duplicationPrevention)
- `isDuplicateWebhookFingerprint` (utils_duplicationPrevention)
- `generateFingerprint` (utils_duplicationPrevention)
- `createSuccessResponse` (utils_duplicationPrevention)
- `createDuplicateResponse` (utils_duplicationPrevention)
- `createErrorResponse` (utils_duplicationPrevention)
- `doPost` (utils_duplicationPrevention)
- `processWebhook` (utils_duplicationPrevention)
- `executeWebhookWithDuplicationPrevention` (utils_duplicationPrevention)
- `checkRecordStatus` (utils_duplicationPrevention)
- `emergencyClearAllFlags` (utils_duplicationPrevention)
- `getDuplicationPreventionStats` (utils_duplicationPrevention)
- `doPost` (コード)
- `validateParameters` (コード)
- `scheduleAsyncTask` (コード)
- `requestWorkerStart` (コード)
- `getNextTaskFromQueue` (コード)
- `processTaskQueueWorker` (コード)
- `executeTask` (コード)
- `generateAnswerAndSummaryWithGemini` (コード)
- `createGeminiPrompt` (コード)
- `parseGeminiResponse` (コード)
- `updateOnSuccess` (コード)
- `updateOnError` (コード)
- `callAppSheetApi` (コード)
- `acquireIdempotencyLock` (コード)
- `releaseIdempotencyLock` (コード)
- `getTaskData` (コード)
- `cleanupTask` (コード)
- `fetchWithRetry` (コード)
- `sleepWithJitter` (コード)
- `createJsonResponse` (コード)

## データフロー

### モード1: 参照資料ベース

```text
AppSheet Webhook
    ↓
doPost(e)
    ↓
重複チェック (DuplicationPrevention)
    ↓
processClientQA(promptText, documentText)
    ↓
generateAnswerAndSummaryWithGemini()
    ↓
Gemini 2.5 Pro API呼び出し
    ↓
結果記録 (ExecutionLogger)
    ↓
レスポンス返却
```

### モード2: 2段階AI処理

```text
AppSheet Webhook
    ↓
doPost(e)
    ↓
重複チェック (DuplicationPrevention)
    ↓
processClientQA(promptText, null, userId, userBasicInfo, referenceData)
    ↓
processNormalQAWithTwoStage()
    ↓
[第1段階] extractRelevantInfo()
    ↓
Gemini 2.5 Flash API呼び出し → 関連情報抽出
    ↓
[第2段階] generateAnswerWithThinkingModel()
    ↓
Gemini 2.5 Flash Thinking API呼び出し → 最終回答生成
    ↓
結果記録 (ExecutionLogger)
    ↓
レスポンス返却
```

## エラーハンドリング

### エラーレベル

1. **SUCCESS**: 正常終了
2. **WARNING**: 警告（重複リクエストなど）
3. **ERROR**: エラー発生

### エラー記録

すべてのエラーは実行ログスプレッドシートに記録されます:
- エラーメッセージ
- スタックトレース
- 入力データ
- 実行時間

## パフォーマンス考慮事項

### キャッシュ戦略

- **有効期限**: 1時間 (3600秒)
- **用途**: 重複リクエストの検出

### ロック戦略

- **タイムアウト**: 5分 (300,000ミリ秒)
- **スコープ**: スクリプトレベル

## セキュリティ

### 認証

- AppSheet Webhookからのリクエストは認証不要（公開URL）
- 必要に応じてシークレットトークンによる検証を追加可能

### データ保護

- APIキーはスクリプトプロパティで管理（推奨）
- 実行ログには機密情報を含めない

## 制限事項

### Google Apps Script制限

- **実行時間**: 最大6分
- **URL Fetchサイズ**: 50MB
- **同時実行**: ユーザーあたり30

### 推奨事項

- 大量データ処理は分割実行
- タイムアウト対策としてバックグラウンド処理を検討

## テスト

### processClientQA関数のテスト

#### 参照資料ベースの質疑応答

```javascript
function testProcessClientQA() {
  const result = processClientQA(
    '転倒リスクを減らすための対策は？',  // promptText
    `# 利用者情報
氏名: 田中花子、82歳
状態: 歩行不安定、血圧高め`  // documentText（参照資料）
  );
  
  Logger.log('回答: ' + result.answer);
  Logger.log('要約: ' + result.summary);
}
```

#### 通常の質疑応答（参照資料なし）

```javascript
function testProcessClientQANormal() {
  const result = processClientQA(
    'JavaScriptのクロージャとは何ですか？',  // promptText
    null  // documentTextをnullにすると通常の質疑応答
  );
  
  Logger.log('回答: ' + result.answer);
  Logger.log('要約: ' + result.summary);
}
```

### AppSheet更新込みのテスト

```javascript
function testProcessClientQAWithAppSheet() {
  const result = processClientQA(
    '血圧管理のポイントは？',
    '利用者: 佐藤一郎、78歳、高血圧',
    'TEST-' + new Date().getTime(),  // analysisId
    true  // AppSheet更新を実行
  );
  
  Logger.log(result);
}
```

### 統合テスト

AppSheetから実際のWebhookを送信してテストします。

## 保守

### ログ確認

定期的に実行ログスプレッドシートを確認:
- エラー率
- 実行時間の傾向
- 重複リクエストの頻度

### アップデート手順

1. スクリプトを更新
2. バージョン作成
3. デプロイメント更新
4. テスト実行
5. ログで動作確認

## 付録

### 設定値

| 項目 | 値 |
|------|-----|
| 実行ログスプレッドシートID | 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE |
| キャッシュ有効期限 | 3600秒 |
| ロックタイムアウト | 300000ミリ秒 |

### 関連リソース

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [AppSheet Automation](https://help.appsheet.com/en/collections/1885643-automation)
