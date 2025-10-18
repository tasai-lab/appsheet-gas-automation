# Appsheet_訪問看護_通常記録 - 技術仕様書

**Document Version:** 2.1
**Last Updated:** 2025-10-18
**Script Version:** v2.1 (version 45)

## 目次

1. [システム概要](#システム概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [技術仕様](#技術仕様)
4. [API仕様](#api仕様)
5. [データモデル](#データモデル)
6. [処理ロジック](#処理ロジック)
7. [設定仕様](#設定仕様)
8. [セキュリティ](#セキュリティ)
9. [エラーハンドリング](#エラーハンドリング)
10. [パフォーマンス](#パフォーマンス)
11. [テスト仕様](#テスト仕様)
12. [デプロイメント](#デプロイメント)
13. [依存関係](#依存関係)

---

## システム概要

### 目的

訪問看護記録の自動生成システム。AppSheetからのWebhookリクエストを受け取り、Gemini 2.5-proを使用してテキスト・音声から構造化された看護記録を自動生成し、AppSheetデータベースに反映します。

### 対応記録タイプ

1. **通常記録** (`recordType: "通常"`)
   - 一般的な訪問看護記録
   - バイタルサイン、主観情報、利用者状態など

2. **精神科記録** (`recordType: "精神"`)
   - 精神科訪問看護記録
   - 精神状態観察、服薬遵守、社会機能など

### 主要機能

- マルチモーダル入力処理（テキスト + 音声）
- Vertex AI / Gemini API統合
- 自動フィールドマッピング
- エラーハンドリングと通知
- 構造化ログ記録

---

## アーキテクチャ

### システム構成図

```
┌─────────────────┐
│  AppSheet App   │
│  (Webhook送信)  │
└────────┬────────┘
         │ HTTPS POST
         ↓
┌─────────────────────────────────────┐
│    Google Apps Script               │
│  ┌──────────────────────────────┐  │
│  │  main.gs                     │  │
│  │  - doPost (Webhook受信)      │  │
│  │  - processRequest            │  │
│  └──────────┬───────────────────┘  │
│             │                       │
│             ↓                       │
│  ┌──────────────────────────────┐  │
│  │  Common Modules              │  │
│  │  - CommonWebhook             │  │
│  │  - CommonTest                │  │
│  └──────────┬───────────────────┘  │
│             │                       │
│             ↓                       │
│  ┌──────────────────────────────┐  │
│  │  Business Logic Modules      │  │
│  │  - modules_aiProcessor       │  │
│  │  - modules_dataAccess        │  │
│  │  - modules_fileHandler       │  │
│  │  - modules_appsheetClient    │  │
│  └──────────┬───────────────────┘  │
│             │                       │
└─────────────┼───────────────────────┘
              │
              ├──────────────┐
              │              │
              ↓              ↓
    ┌──────────────┐  ┌──────────────┐
    │  Vertex AI   │  │ Cloud Storage│
    │ (Gemini 2.5) │  │  (音声一時保存)│
    └──────────────┘  └──────────────┘
              │
              ↓
    ┌──────────────────┐
    │  AppSheet API    │
    │ (Care_Records更新)│
    └──────────────────┘
```

### モジュール構成

#### エントリーポイント

- **main.gs**
  - `doPost(e)`: Webhookエントリーポイント
  - `processRequest(...)`: メイン処理関数
  - `testNormalRecord()`: 通常記録テスト関数
  - `testPsychiatryRecord()`: 精神科記録テスト関数
  - `testCustomRecord()`: カスタムテスト関数

#### 共通モジュール

- **CommonWebhook**
  - `handleDoPost(e, callback)`: Webhook共通処理

- **CommonTest**
  - テスト支援機能

#### ビジネスロジックモジュール

- **modules_aiProcessor.gs**
  - `callVertexAIWithPrompt()`: Vertex AI呼び出し
  - `callGeminiAPIWithPrompt()`: Gemini API呼び出し
  - `buildNormalPrompt()`: 通常記録プロンプト構築
  - `buildPsychiatryPrompt()`: 精神科記録プロンプト構築
  - `parseGeneratedJSON()`: AI応答解析
  - `determineRecordType()`: 記録タイプ判定

- **modules_dataAccess.gs**
  - `getGuidanceMasterAsText()`: マスターデータ取得
  - `getGuidanceMasterCached()`: キャッシュ付きマスター取得

- **modules_fileHandler.gs**
  - `getFileIdFromPath()`: ファイルID取得
  - `getFileFromDrive()`: Driveファイル取得
  - `uploadToCloudStorage()`: Cloud Storageアップロード
  - `deleteFromCloudStorage()`: Cloud Storage削除

- **modules_appsheetClient.gs**
  - `callAppSheetApi()`: AppSheet API呼び出し
  - `updateRecordOnSuccess()`: 成功時レコード更新
  - `updateRecordOnError()`: エラー時レコード更新

#### ユーティリティモジュール

- **utils_constants.gs**: 定数定義（エラーコード、ステータス、マッピング）
- **utils_validators.gs**: バリデーション機能
- **utils_errorHandler.gs**: エラーハンドリング
- **utils_logger.gs**: 構造化ログ記録

---

## 技術仕様

### プラットフォーム

- **実行環境**: Google Apps Script (V8 Runtime)
- **言語**: JavaScript (ES6+)
- **GASバージョン**: Runtime V8

### 制約事項

| 項目 | 制約値 |
|------|--------|
| 最大実行時間 | 6分 |
| URL Fetchサイズ | 50MB |
| 同時実行数 | ユーザーあたり30 |
| スクリプトキャッシュ | 10MB / 100,000アイテム |
| プロパティストア | 500KB |
| 音声ファイルサイズ | 2GB |

### サポート音声形式

| 形式 | MIMEタイプ | 説明 |
|------|------------|------|
| m4a | audio/mp4 | Apple標準形式 |
| mp3 | audio/mpeg | 汎用圧縮形式 |
| wav | audio/wav | 非圧縮形式 |
| ogg | audio/ogg | Ogg Vorbis形式 |

---

## API仕様

### 1. Webhook API (入力)

#### エンドポイント

```
POST https://script.google.com/macros/s/{deploymentId}/exec
```

#### リクエストボディ

**共通パラメータ:**

```json
{
  "recordNoteId": "string (required)",
  "staffId": "string (required)",
  "recordText": "string (required)",
  "recordType": "string (optional, default: '通常')",
  "filePath": "string (optional)",
  "fileId": "string (optional)"
}
```

**パラメータ説明:**

| パラメータ | 型 | 必須 | 説明 | 例 |
|-----------|-----|------|------|-----|
| `recordNoteId` | string | ✓ | 記録ノートID | "RN-001" |
| `staffId` | string | ✓ | スタッフID | "staff@example.com" |
| `recordText` | string | ✓ | 記録テキスト | "利用者は元気..." |
| `recordType` | string | - | 記録タイプ | "通常" or "精神" |
| `filePath` | string | - | Driveファイルパス | "共有ドライブ/..." |
| `fileId` | string | - | DriveファイルID | "1AbCd..." |

#### レスポンス

**成功時 (200 OK):**

```json
{
  "status": "success",
  "message": "処理が完了しました",
  "recordNoteId": "RN-001"
}
```

**エラー時 (200 OK with error status):**

```json
{
  "status": "error",
  "message": "エラーメッセージ",
  "errorCode": "E1001",
  "recordNoteId": "RN-001"
}
```

### 2. Vertex AI API

#### エンドポイント

```
POST https://us-central1-aiplatform.googleapis.com/v1/projects/{projectId}/locations/us-central1/publishers/google/models/gemini-2.5-pro:generateContent
```

#### リクエストボディ

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "プロンプト文字列" },
        {
          "fileData": {
            "mimeType": "audio/mp4",
            "fileUri": "gs://bucket-name/file.m4a"
          }
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.2,
    "maxOutputTokens": 8192,
    "responseMimeType": "application/json"
  }
}
```

#### レスポンス

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "{\"processedAudioText\": \"...\", ...}"
          }
        ]
      },
      "finishReason": "STOP"
    }
  ]
}
```

### 3. Gemini API (フォールバック)

#### エンドポイント

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key={apiKey}
```

#### リクエストボディ

```json
{
  "contents": [
    {
      "parts": [
        { "text": "プロンプト文字列" },
        {
          "inlineData": {
            "mimeType": "audio/mp4",
            "data": "base64エンコードされた音声データ"
          }
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.3,
    "responseMimeType": "application/json"
  }
}
```

### 4. AppSheet API (出力)

#### エンドポイント

```
POST https://api.appsheet.com/api/v2/apps/{appId}/tables/Care_Records/Action
```

#### リクエストボディ

```json
{
  "Action": "Edit",
  "Properties": {
    "Locale": "ja-JP",
    "Timezone": "Asia/Tokyo"
  },
  "Rows": [
    {
      "record_note_id": "RN-001",
      "status": "編集中",
      "extracted_text": "...",
      "vital_signs": "...",
      "client_condition": "...",
      "updated_by": "staff@example.com"
    }
  ]
}
```

#### ヘッダー

```
ApplicationAccessKey: {accessKey}
Content-Type: application/json
```

---

## データモデル

### 通常記録 (Normal Record)

#### AI出力スキーマ

```json
{
  "processedAudioText": "string",
  "vitalSigns": {
    "bt": "string",
    "bp": "string",
    "hr": "string",
    "spo2": "string"
  },
  "subjectiveInformation": "string",
  "userCondition": "string",
  "guidanceAndAdvice": "string",
  "nursingAndRehabilitationItems": ["string"],
  "specialNotes": "string",
  "summaryForNextVisit": "string"
}
```

#### AppSheetフィールドマッピング

| AIフィールド | AppSheetフィールド | データ型 | 変換 |
|-------------|-------------------|---------|------|
| `processedAudioText` | `extracted_text` | string | そのまま |
| `vitalSigns` | `vital_signs` | string | JSON文字列化 |
| `subjectiveInformation` | `subjective_information` | string | そのまま |
| `userCondition` | `client_condition` | string | そのまま |
| `guidanceAndAdvice` | `guidance_and_advice` | string | そのまま |
| `nursingAndRehabilitationItems` | `care_provided` | string | カンマ区切り |
| `specialNotes` | `remarks` | string | そのまま |
| `summaryForNextVisit` | `summary_for_next_visit` | string | そのまま |

### 精神科記録 (Psychiatry Record)

#### AI出力スキーマ

```json
{
  "clientCondition": "string",
  "dailyLivingObservation": "string",
  "mentalStateObservation": "string",
  "medicationAdherence": "string",
  "socialFunctionalObservation": "string",
  "careProvided": ["string"],
  "guidanceAndAdvice": "string",
  "remarks": "string",
  "summaryForNextVisit": "string"
}
```

#### AppSheetフィールドマッピング

| AIフィールド | AppSheetフィールド | データ型 | 変換 |
|-------------|-------------------|---------|------|
| `clientCondition` | `client_condition` | string | そのまま |
| `dailyLivingObservation` | `daily_living_observation` | string | そのまま |
| `mentalStateObservation` | `mental_state_observation` | string | そのまま |
| `medicationAdherence` | `medication_adherence` | string | そのまま |
| `socialFunctionalObservation` | `social_functional_observation` | string | そのまま |
| `careProvided` | `care_provided` | string | カンマ区切り |
| `guidanceAndAdvice` | `guidance_and_advice` | string | そのまま |
| `remarks` | `remarks` | string | そのまま |
| `summaryForNextVisit` | `summary_for_next_visit` | string | そのまま |

---

## 処理ロジック

### メイン処理フロー

```javascript
function processRequest(recordNoteId, staffId, recordText, recordType, filePath, fileId) {
  // 1. パラメータ検証
  validateWebhookParams(recordNoteId, staffId, recordText);

  // 2. マスターデータ取得（1時間キャッシュ）
  const guidanceMasterText = getGuidanceMasterAsText();

  // 3. 記録タイプ判定
  const normalizedRecordType = determineRecordType(recordType);

  // 4. ファイル処理（音声がある場合）
  let gsUri = null, mimeType = null;
  if (filePath || fileId) {
    const fileData = getFileFromDrive(fileId || getFileIdFromPath(filePath));
    const uploadResult = uploadToCloudStorage(fileData.blob, bucketName, fileData.fileName);
    gsUri = uploadResult.gsUri;
    mimeType = fileData.mimeType;
  }

  // 5. AI処理
  let analysisResult;
  if (processingMode === 'vertex-ai' && gsUri) {
    const prompt = normalizedRecordType === 'psychiatry'
      ? buildPsychiatryPrompt(recordText, guidanceMasterText)
      : buildNormalPrompt(recordText, guidanceMasterText);
    analysisResult = callVertexAIWithPrompt(gsUri, mimeType, prompt, normalizedRecordType);
  } else {
    // Gemini APIフォールバック
    analysisResult = callGeminiAPIWithPrompt(fileData, prompt, normalizedRecordType);
  }

  // 6. フィールドマッピングとAppSheet更新
  updateRecordOnSuccess(recordNoteId, analysisResult, staffId, normalizedRecordType);

  // 7. クリーンアップ
  if (gsUri) {
    deleteFromCloudStorage(bucketName, fileName);
  }
}
```

### リトライロジック

Vertex AI呼び出しには自動リトライ機構があります。

```javascript
const maxRetries = 3;
const retryDelays = [30000, 60000, 120000]; // 30秒, 1分, 2分

for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    return callVertexAIWithPromptInternal(gsUri, mimeType, prompt, recordType);
  } catch (error) {
    if (error.message.includes('Service agents are being provisioned') && attempt < maxRetries) {
      Utilities.sleep(retryDelays[attempt - 1]);
      continue;
    }
    throw error;
  }
}
```

### キャッシュロジック

マスターデータは1時間キャッシュされます。

```javascript
function getGuidanceMasterCached() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'guidance_master_text';

  let cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const masterText = getGuidanceMasterAsText();
  cache.put(cacheKey, masterText, 3600); // 1時間
  return masterText;
}
```

---

## 設定仕様

### config_settings.gs

#### GCP_CONFIG

```javascript
const GCP_CONFIG = {
  projectId: 'macro-shadow-458705-v8',          // GCPプロジェクトID
  location: 'us-central1',                       // Vertex AIリージョン
  bucketName: 'nursing-records-audio-macro',     // Cloud Storageバケット
  vertexAI: {
    model: 'gemini-2.5-pro',                     // Vertex AIモデル
    temperature: 0.2,                            // 温度パラメータ
    maxOutputTokens: 8192                        // 最大出力トークン
  }
};
```

#### GEMINI_CONFIG

```javascript
const GEMINI_CONFIG = {
  apiKey: 'AIzaSyD...',                          // Gemini APIキー
  model: 'gemini-2.5-pro',                       // モデル名
  temperature: 0.3                               // 温度パラメータ
};
```

#### APPSHEET_CONFIG

```javascript
const APPSHEET_CONFIG = {
  appId: 'f40c4b11-b140-4e31-a60c-600f3c9637c8', // AppSheetアプリID
  accessKey: 'V2-s6fif-...',                     // AppSheetアクセスキー
  tableName: 'Care_Records'                      // テーブル名
};
```

#### SYSTEM_CONFIG

```javascript
const SYSTEM_CONFIG = {
  processingMode: 'vertex-ai',                   // 'vertex-ai' or 'fallback'
  debugMode: false,                              // デバッグモード
  timeout: {
    vertexAI: 120000,                            // Vertex AIタイムアウト (ms)
    geminiAPI: 60000,                            // Gemini APIタイムアウト (ms)
    appSheetAPI: 30000                           // AppSheet APIタイムアウト (ms)
  }
};
```

---

## セキュリティ

### 認証・認可

#### Google Cloud Platform

- **サービスアカウント**: GASの組み込みOAuth2トークン使用
- **必要な権限**:
  - Vertex AI User
  - Storage Object Admin
  - Cloud Run Invoker

#### AppSheet API

- **認証方式**: Application Access Key
- **キー管理**: config_settings.gsに直接記載（推奨: Script Properties使用）

#### Gemini API

- **認証方式**: APIキー
- **キー管理**: config_settings.gsに直接記載（推奨: Script Properties使用）

### データ保護

| データ種別 | 保護方法 |
|-----------|---------|
| 音声ファイル | Cloud Storageに一時保存、処理後即座に削除 |
| 患者情報 | AppSheetデータベース（暗号化） |
| APIキー | Script Properties推奨（現在はconfig直記載） |
| ログデータ | Google Sheets（アクセス制限付き） |

### セキュリティベストプラクティス

1. **APIキーの管理**
   - Script Propertiesへの移行を推奨
   - 定期的なローテーション

2. **音声ファイルの取り扱い**
   - 処理後即座に削除
   - バケットのライフサイクルポリシー設定

3. **ログの取り扱い**
   - 個人情報のマスキング
   - アクセス権限の最小化

---

## エラーハンドリング

### エラーコード体系

| コード範囲 | カテゴリ | 例 |
|-----------|---------|-----|
| E1xxx | 入力エラー | E1001: 必須パラメータ不足 |
| E2xxx | データ取得エラー | E2001: マスターデータ取得失敗 |
| E3xxx | AI処理エラー | E3001: Vertex AI処理エラー |
| E4xxx | 外部API エラー | E4001: AppSheet API エラー |
| E5xxx | システムエラー | E5001: 予期しないエラー |

### エラーコード一覧

```javascript
const ERROR_CODE = {
  // 入力エラー (1000番台)
  MISSING_REQUIRED_PARAMS: 'E1001',
  INVALID_FILE_PATH: 'E1002',
  INVALID_RECORD_TYPE: 'E1003',
  FILE_NOT_FOUND: 'E1004',
  FILE_SIZE_EXCEEDED: 'E1005',
  UNSUPPORTED_FORMAT: 'E1006',

  // データ取得エラー (2000番台)
  MASTER_DATA_FETCH_FAILED: 'E2001',
  FILE_FETCH_FAILED: 'E2002',
  DRIVE_ACCESS_FAILED: 'E2003',

  // AI処理エラー (3000番台)
  VERTEX_AI_ERROR: 'E3001',
  GEMINI_API_ERROR: 'E3002',
  JSON_PARSE_ERROR: 'E3003',
  RESPONSE_VALIDATION_ERROR: 'E3004',

  // 外部API エラー (4000番台)
  APPSHEET_API_ERROR: 'E4001',
  CLOUD_STORAGE_ERROR: 'E4002',

  // システムエラー (5000番台)
  UNEXPECTED_ERROR: 'E5001',
  TIMEOUT_ERROR: 'E5002',
  ASYNC_TRIGGER_ERROR: 'E5003'
};
```

### エラー処理フロー

```javascript
try {
  // メイン処理
  processRequest(...);
} catch (error) {
  // 1. エラーログ記録
  logError(recordNoteId, error, { params: params });

  // 2. AppSheetにエラーステータス記録
  if (recordNoteId) {
    updateRecordOnError(recordNoteId, error.toString());
  }

  // 3. エラーメール送信
  if (recordNoteId) {
    sendErrorEmail(recordNoteId, error.toString());
  }

  // 4. エラーレスポンス返却
  return createErrorResponse(error);
}
```

---

## パフォーマンス

### 処理時間の目標値

| 処理タイプ | 目標時間 | 実績時間 |
|-----------|---------|---------|
| テキストのみ（通常） | < 5秒 | 3-5秒 |
| テキストのみ（精神科） | < 5秒 | 3-5秒 |
| 音声あり（通常） | < 30秒 | 15-30秒 |
| 音声あり（精神科） | < 30秒 | 15-30秒 |

### 最適化手法

#### 1. マスターデータキャッシュ

```javascript
// 1時間キャッシュで高速化
function getGuidanceMasterCached() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'guidance_master_text';

  let cached = cache.get(cacheKey);
  if (cached) return cached;

  const masterText = getGuidanceMasterAsText();
  cache.put(cacheKey, masterText, 3600);
  return masterText;
}
```

#### 2. リトライ戦略

- Vertex AIエラー時の指数バックオフ
- 30秒 → 1分 → 2分の間隔でリトライ

#### 3. Cloud Storage自動クリーンアップ

```javascript
// 処理後即座に削除
if (gsUri) {
  const fileName = gsUri.split('/').pop();
  deleteFromCloudStorage(GCP_CONFIG.bucketName, fileName);
}
```

### パフォーマンス監視

構造化ログで以下を記録:

- 処理開始時刻
- 処理完了時刻
- 各ステップの処理時間
- API呼び出し時間

```javascript
const startTime = Date.now();
// ... 処理 ...
const duration = Date.now() - startTime;
logProcessingComplete(recordNoteId, duration);
```

---

## テスト仕様

### 単体テスト

#### 通常記録テスト

```javascript
function testNormalRecord(
  recordNoteId = "TEST-NORMAL-001",
  staffId = "test@fractal-group.co.jp",
  recordText = "利用者は元気そうでした。血圧130/80、体温36.5度。食事は良好。",
  filePath = null,
  fileId = null
) {
  return processRequest(recordNoteId, staffId, recordText, '通常', filePath, fileId);
}
```

#### 精神科記録テスト

```javascript
function testPsychiatryRecord(
  recordNoteId = "TEST-PSYCH-001",
  staffId = "test@fractal-group.co.jp",
  recordText = "利用者は落ち着いた様子。服薬確認済み。幻聴の訴えなし。",
  filePath = null,
  fileId = null
) {
  return processRequest(recordNoteId, staffId, recordText, '精神', filePath, fileId);
}
```

### 統合テスト

AppSheetから実際のWebhookを送信してテスト。

#### テストケース

| ケース | recordType | 音声 | 期待結果 |
|-------|-----------|------|---------|
| TC-001 | 通常 | なし | 正常処理 |
| TC-002 | 通常 | あり | 正常処理 |
| TC-003 | 精神 | なし | 正常処理 |
| TC-004 | 精神 | あり | 正常処理 |
| TC-005 | なし | なし | デフォルト通常 |
| TC-006 | 不正値 | なし | エラー |

---

## デプロイメント

### デプロイ手順

```bash
# プロジェクトルートに移動
cd /Users/t.asai/code/appsheet-gas-automation

# 統合デプロイスクリプト実行
python deployment/deploy_unified.py
```

### バージョン管理

デプロイメント情報は `deployment_versions.json` で管理:

```json
{
  "last_updated": "2025-10-18T06:22:44.398067",
  "projects": {
    "Appsheet_訪問看護_通常記録": {
      "script_id": "1YkRRcL3fBJ-gMiC3lCkScM3fe_IrawqXrmKoIIWmE-nQokw4rY6rATZa",
      "deployments": [
        {
          "version": 45,
          "description": "v2.1: テスト関数追加",
          "timestamp": "2025-10-18T06:24:15.000000",
          "status": "success"
        }
      ]
    }
  }
}
```

### ロールバック手順

1. GAS Editorでバージョン履歴を確認
2. 適切なバージョンを選択
3. デプロイメントを更新
4. テスト実行で動作確認

---

## 依存関係

### 外部サービス

| サービス | 用途 | バージョン/エンドポイント |
|---------|------|-------------------------|
| Vertex AI | AI記録生成 | gemini-2.5-pro |
| Gemini API | フォールバックAI | gemini-2.5-pro |
| AppSheet API | データベース更新 | v2 |
| Cloud Storage | 音声ファイル一時保存 | - |
| Google Drive | 音声ファイル取得 | - |
| Google Sheets | マスターデータ、ログ | - |

### Google Apps Script ライブラリ

- なし（すべて標準API使用）

### 共通モジュール

| モジュール | バージョン | リポジトリパス |
|----------|-----------|---------------|
| CommonWebhook | latest | `common_modules/CommonWebhook/` |
| CommonTest | latest | `common_modules/CommonTest/` |

---

## 付録

### 設定値一覧

| 項目 | 値 |
|------|-----|
| GCPプロジェクトID | macro-shadow-458705-v8 |
| Vertex AIリージョン | us-central1 |
| Cloud Storageバケット | nursing-records-audio-macro |
| AppSheetアプリID | f40c4b11-b140-4e31-a60c-600f3c9637c8 |
| AppSheetテーブル | Care_Records |
| マスタースプレッドシートID | 1EhLGOPKrxqMNl2b1_c0mA1M3w1tXiHN4PsnXWfWHSPw |
| ログスプレッドシートID | 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE |
| キャッシュ有効期限 | 3600秒 (1時間) |

### 関連リソース

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [AppSheet API Documentation](https://support.google.com/appsheet/answer/10105768)
- [FLOW.md](./FLOW.md) - 詳細フロー図
- [README.md](./README.md) - ユーザーガイド
