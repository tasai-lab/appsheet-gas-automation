# Appsheet_通話_要約生成 - 詳細仕様書

## 目的

このスクリプトは、AppSheetアプリケーションと連携し、データ処理、API呼び出し、スプレッドシート操作などの自動化タスクを実行します。

## システム構成

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

- `updateCallLog` (core_appsheet)
- `addCallActions` (core_appsheet)
- `callAppSheetAPI` (core_appsheet)
- `recordError` (core_appsheet)
- `getConfig` (core_config)
- `setupScriptProperties` (core_config)
- `showCurrentConfig` (core_config)
- `clearScriptProperties` (core_config)
- `validateConfig` (core_config)
- `sendSuccessNotification` (core_notification)
- `sendErrorNotification` (core_notification)
- `sendTestNotification` (core_notification)
- `analyzeAudioWithVertexAI` (core_vertexai)
- `getAudioFile` (core_vertexai)
- `determineMimeType` (core_vertexai)
- `generatePrompt` (core_vertexai)
- `uploadToCloudStorage` (core_vertexai)
- `deleteFromCloudStorage` (core_vertexai)
- `callVertexAIAPIWithStorage` (core_vertexai)
- `callVertexAIAPI` (core_vertexai)
- `extractAndValidateJSON` (core_vertexai)
- `extractJSONFromText` (core_vertexai)
- `doPost` (core_webhook)
- `parseRequest` (core_webhook)
- `validateRequiredParams` (core_webhook)
- `validateAnalysisResult` (core_webhook)
- `createSuccessResponse` (core_webhook)
- `createErrorResponse` (core_webhook)
- `createDuplicateResponse` (core_webhook)
- `isDuplicateRequest` (core_webhook)
- `markAsProcessing` (core_webhook)
- `markAsCompleted` (core_webhook)
- `clearProcessingState` (core_webhook)
- `doPost` (core_webhook_v3)
- `processCallSummary` (core_webhook_v3)
- `validateRequiredParams` (core_webhook_v3)
- `validateAnalysisResult` (core_webhook_v3)
- `parseRequest` (core_webhook_v3)
- `isDuplicateRequest` (core_webhook_v3)
- `markAsProcessing` (core_webhook_v3)
- `createSuccessResponse` (core_webhook_v3)
- `createErrorResponse_old` (core_webhook_v3)
- `createDuplicateResponse_old` (core_webhook_v3)
- `logExecution` (ExecutionLogger)
- `getOrCreateLogSpreadsheet` (ExecutionLogger)
- `acquireLock` (ExecutionLogger)
- `releaseLock` (ExecutionLogger)
- `isDuplicateRequest` (ExecutionLogger)
- `formatError` (ExecutionLogger)
- `getFileIdFromPath` (utils_drive)
- `getSharedDriveFileInfo` (utils_drive)
- `testFilePathResolution` (utils_drive)
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
- `testConfig` (utils_test)
- `testVertexAI` (utils_test)
- `testCloudStorage` (utils_test)
- `testWebhook` (utils_test)
- `testDuplicateRequestPrevention` (utils_test)
- `runAllTests` (utils_test)

## データフロー

```
AppSheet Webhook
    ↓
doPost(e)
    ↓
重複チェック (DuplicationPrevention)
    ↓
処理実行 (ビジネスロジック)
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

### 単体テスト

```javascript
function testDoPost() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        // Test data here
      })
    }
  };
  
  const result = doPost(testData);
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
