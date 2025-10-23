# Appsheet_訪問看護_計画書問題点_評価 - 詳細仕様書

## 目的

このスクリプトは、訪問看護の看護計画の問題点に対する評価文を自動生成するシステムです。AppSheetアプリケーションと連携し、看護計画と最新の看護記録を比較・分析してAIによる評価を生成し、AppSheetテーブルに書き込みます。

## システム構成

### コンポーネント

1. **Webhook受信ハンドラ** (`doPost`)
   - AppSheetからのPOSTリクエストを受信
   - JSONペイロードをパース
   - 共通Webhookハンドラー経由で処理実行

2. **重複防止モジュール** (`DuplicationPrevention`)
   - レコードIDベースの重複検出
   - LockServiceによる排他制御
   - CacheServiceとScriptPropertiesによる処理状態管理
   - 有効/無効の切り替え可能

3. **実行ログモジュール** (`GASLogger`)
   - すべての処理結果を統合コスト管理シートに記録
   - タイムスタンプ、ステータス、エラー詳細、API使用量を保存
   - 90日間のログ保持期間

4. **Gemini APIクライアント** (`GeminiClient`)
   - Vertex AI Gemini 2.5 Proを使用
   - OAuth2認証（ScriptApp.getOAuthToken()）
   - JSON形式での構造化レスポンス生成
   - コスト追跡機能

5. **ビジネスロジック**
   - 看護計画の評価文生成（50文字未満）
   - AppSheet VN_Plan_Problemsテーブルへの結果書き込み

## 主要関数一覧

### エントリーポイント

- `doPost(e)` - AppSheet Webhookエントリーポイント
- `processRequest(problemId, planText, latestRecords, statusToSet, staffId)` - メイン処理関数
- `testProcessRequest()` - テスト用関数

### AI処理関数

- `generateEvaluationWithGemini(planText, latestRecords)` - Gemini APIを使用して評価文を生成

### AppSheet連携関数

- `updateEvaluationInAppSheet(problemId, evaluationText, status, staffId)` - AppSheetテーブルを更新

### 共通モジュール関数

#### ロガー (logger.gs)
- `createLogger(scriptName)` - ロガーインスタンス作成
- `logger.info(message, details)` - INFOレベルログ
- `logger.success(message, details)` - SUCCESSレベルログ
- `logger.warning(message, details)` - WARNINGレベルログ
- `logger.error(message, details)` - ERRORレベルログ
- `logger.setUsageMetadata(usageMetadata)` - API使用量情報設定
- `logger.saveToSpreadsheet(status, recordId)` - スプレッドシートに保存

#### 重複防止 (duplication_prevention.gs)
- `createDuplicationPrevention(scriptName)` - インスタンス作成
- `isAlreadyProcessed(recordId)` - 処理済みチェック
- `markAsProcessing(recordId, timeout)` - 処理開始マーク
- `markAsCompleted(recordId, success)` - 処理完了マーク
- `executeWithRetry(recordId, processFunction, logger)` - リトライ実行

#### Gemini APIクライアント (gemini_client.gs)
- `createGeminiProClient(options)` - PROモデルクライアント作成
- `createGeminiFlashClient(options)` - FLASHモデルクライアント作成
- `client.generateText(prompt, logger)` - テキスト生成
- `client.generateJSON(prompt, logger)` - JSON生成

#### スクリプトプロパティ管理 (script_properties_manager.gs)
- `setScriptProperty(key, value)` - プロパティ設定
- `getScriptProperty(key, defaultValue)` - プロパティ取得
- `enableDuplicationPrevention()` - 重複防止有効化
- `disableDuplicationPrevention()` - 重複防止無効化

#### Webhook重複防止ユーティリティ (utils_duplicationPrevention.gs)
- `checkDuplicateRequest(recordId, webhookParams)` - 重複チェック
- `markAsProcessingWithLock(recordId, metadata)` - 処理中フラグ設定
- `markAsCompleted(recordId, result)` - 処理完了フラグ設定
- `markAsFailed(recordId, error)` - 処理失敗フラグ設定
- `clearProcessingFlag(recordId)` - 処理フラグクリア
- `executeWebhookWithDuplicationPrevention(e, processingFunction, options)` - 統合実行ラッパー

## データフロー

```
AppSheet Webhook
    ↓
doPost(e)
    ↓
CommonWebhook.handleDoPost() [共通ハンドラー]
    ↓
processRequest(problemId, planText, latestRecords, statusToSet, staffId)
    ↓
generateEvaluationWithGemini(planText, latestRecords) [Vertex AI呼び出し]
    ↓
updateEvaluationInAppSheet(problemId, evaluationText, status, staffId)
    ↓
logger.saveToSpreadsheet(status, recordId)
    ↓
レスポンス返却
```

## API仕様

### Webhook入力パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `problemId` | string | ✓ | 問題点レコードID |
| `planText` | string | ✓ | 看護計画のテキスト |
| `latestRecords` | string | ✓ | 最新の看護記録 |
| `statusToSet` | string | ✓ | 設定するステータス値 |
| `staffId` | string | ✓ | スタッフID |

**リクエスト例:**
```json
{
  "problemId": "PROB-001",
  "planText": "疼痛緩和のため鎮痛剤の定期投与を行う。状態観察を継続する。",
  "latestRecords": "2025-10-23: 疼痛スケール3/10に改善。鎮痛剤効果良好。",
  "statusToSet": "評価済み",
  "staffId": "STAFF-123"
}
```

### Gemini API仕様

**エンドポイント:**
```
https://us-central1-aiplatform.googleapis.com/v1/projects/macro-shadow-458705-v8/locations/us-central1/publishers/google/models/gemini-2.5-pro:generateContent
```

**認証:** OAuth2 (ScriptApp.getOAuthToken())

**モデル:** `gemini-2.5-pro`

**パラメータ:**
- `responseMimeType`: `application/json`
- `temperature`: 0.2

**プロンプト構造:**
```
あなたは経験豊富な訪問看護師です。
以下の#看護計画と#最新の看護記録を比較・分析し、計画に対する評価を生成してください。

# 指示
- 最新の看護記録に基づき、看護計画の目標がどの程度達成されたか、計画は適切であったかを評価してください。
- 評価文は**50文字未満**で、簡潔明瞭な記録様式の表現（常体）を厳守してください。
- 出力は必ず指定されたJSON形式に従ってください。

# 看護計画
{planText}

# 最新の看護記録
{latestRecords}

# 出力形式（JSON）
{
  "evaluationText": "（ここに50文字未満の評価文を記述）"
}
```

**レスポンス形式:**
```json
{
  "evaluationText": "鎮痛剤投与により疼痛スケール3/10に改善。計画は適切であった。"
}
```

### AppSheet API仕様

**エンドポイント:**
```
https://api.appsheet.com/api/v2/apps/f40c4b11-b140-4e31-a60c-600f3c9637c8/tables/VN_Plan_Problems/Action
```

**認証:** ApplicationAccessKey

**アクション:** Edit

**リクエストボディ:**
```json
{
  "Action": "Edit",
  "Properties": {
    "Locale": "ja-JP",
    "Timezone": "Asia/Tokyo"
  },
  "Rows": [
    {
      "problem_id": "PROB-001",
      "evaluation": "鎮痛剤投与により疼痛スケール3/10に改善。計画は適切であった。",
      "evaluation_date": "2025-10-23",
      "status": "評価済み",
      "updated_at": "2025-10-23 15:30:00",
      "updated_by": "STAFF-123"
    }
  ]
}
```

## データモデル

### VN_Plan_Problems テーブル

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `problem_id` | string | 問題点ID（主キー） |
| `evaluation` | string | 評価文（50文字未満） |
| `evaluation_date` | date | 評価日 |
| `status` | string | ステータス |
| `updated_at` | datetime | 更新日時 |
| `updated_by` | string | 更新者ID |

## エラーハンドリング

### エラーレベル

1. **SUCCESS**: 正常終了
2. **WARNING**: 警告（重複リクエストなど）
3. **ERROR**: エラー発生

### エラー記録

すべてのエラーは統合実行ログスプレッドシートに記録されます:
- エラーメッセージ
- スタックトレース
- 入力データ
- 実行時間
- API使用量

### エラー処理フロー

```javascript
try {
  // パラメータ検証
  if (!problemId || !planText || !latestRecords || !staffId) {
    throw new Error("必須パラメータが不足しています。");
  }

  // AI評価生成
  const evaluationResult = generateEvaluationWithGemini(planText, latestRecords);

  // AppSheet更新
  updateEvaluationInAppSheet(problemId, evaluationResult.evaluationText, statusToSet, staffId);

} catch (error) {
  logger.error(`エラーが発生しました: ${error.toString()}`);
  // エラーログを記録し、処理を終了
}
```

## パフォーマンス考慮事項

### キャッシュ戦略

- **有効期限**: 6時間 (21600秒) - 処理完了フラグ
- **用途**: 重複リクエストの検出

### ロック戦略

- **タイムアウト**: 5分 (300,000ミリ秒)
- **スコープ**: スクリプトレベル

### API呼び出し

- **Vertex AI呼び出し回数**: 1回/リクエスト
- **AppSheet API呼び出し**: 1回/リクエスト
- **合計処理時間**: 通常5-10秒

## セキュリティ

### 認証

- **Vertex AI**: OAuth2認証（`ScriptApp.getOAuthToken()`）
- **AppSheet API**: ApplicationAccessKey認証
- **Webhook**: 公開URL（認証なし）

### データ保護

- APIキーはスクリプト内でハードコード（本番環境では推奨されない）
- 実行ログには機密情報を含めない
- GCPプロジェクトIDは固定値として設定

### OAuth スコープ

**必須スコープ (appsscript.json):**
```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/cloud-platform"
  ]
}
```

## 制限事項

### Google Apps Script制限

- **実行時間**: 最大6分
- **URL Fetchサイズ**: 50MB
- **同時実行**: ユーザーあたり30

### Vertex AI制限

- **モデル**: Gemini 2.5 Pro
- **最大トークン数**: 20,000（出力）
- **レート制限**: GCPプロジェクトのクォータに依存

### 推奨事項

- 長時間実行が必要な場合はタイムアウト対策を実装
- 評価文は50文字未満に制限
- エラー時のリトライは最大3回まで

## テスト

### 単体テスト

```javascript
function testProcessRequest() {
  const testParams = {
    problemId: 'TEST-001',
    planText: '疼痛緩和のため鎮痛剤の定期投与を行う。状態観察を継続する。',
    latestRecords: '2025-10-23: 疼痛スケール3/10に改善。鎮痛剤効果良好。',
    statusToSet: '評価済み',
    staffId: 'STAFF-TEST'
  };

  return CommonTest.runTest(
    (params) => processRequest(params.problemId, params.planText, params.latestRecords, params.statusToSet, params.staffId),
    testParams,
    'Appsheet_訪問看護_計画書問題点_評価'
  );
}
```

### 統合テスト

AppSheetから実際のWebhookを送信してテストします。

## 保守

### ログ確認

定期的に統合実行ログスプレッドシートを確認:
- エラー率
- 実行時間の傾向
- API使用量とコスト
- 重複リクエストの頻度

### アップデート手順

1. スクリプトを更新
2. バージョン作成
3. デプロイメント更新（`deploy_unified.py`使用）
4. テスト実行
5. ログで動作確認

### コスト管理

**Vertex AI Gemini 2.5 Pro 価格 (2025年1月):**
- 入力: $1.25/1M tokens
- 出力: $10.0/1M tokens（テキスト出力: 回答+推論）

**月間100回実行時の想定コスト:**
- 平均トークン: 2,000入力 + 500出力
- コスト: 約$0.75/月（約¥112.5/月、為替150円換算）

## 付録

### 設定値

| 項目 | 値 |
|------|-----|
| スクリプトID | 1C8V2GnM7yQD9TuIxeoW02tLezsxnmZUOABZZreZcnHZZJvGkEhadNZCK |
| 統合実行ログスプレッドシートID | 16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA |
| AppSheetアプリID | f40c4b11-b140-4e31-a60c-600f3c9637c8 |
| GCPプロジェクトID | macro-shadow-458705-v8 |
| GCPロケーション | us-central1 |
| Vertex AIモデル | gemini-2.5-pro |
| Temperature | 0.2 |
| キャッシュ有効期限 | 21600秒（6時間） |
| ロックタイムアウト | 300000ミリ秒（5分） |
| ログ保持期間 | 90日 |

### 関連リソース

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [AppSheet Automation](https://help.appsheet.com/en/collections/1885643-automation)
- [Vertex AI Gemini API](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Gemini API Pricing](https://ai.google.dev/pricing)

### バージョン履歴

- **v1.0.0** (2025-08-26): 初回リリース
- **v2.0.0** (2025-10-16): 共通モジュール統合、Vertex AI移行
- **v2.1.0** (2025-10-18): Google AI Studio API削除、Vertex AI専用化

---

**最終更新**: 2025-10-23
**ステータス**: Production Ready
