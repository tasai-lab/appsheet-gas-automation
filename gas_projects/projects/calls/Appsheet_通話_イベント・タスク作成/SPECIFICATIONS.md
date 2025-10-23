# Appsheet_通話_イベント・タスク作成 - 技術仕様書

## 概要

通話アクションに基づいて、Googleカレンダーイベントまたは Googleタスクを作成する統合GASプロジェクト。actionTypeパラメータで自動判別し、OAuth2なりすまし認証を使用して指定ユーザーのカレンダー/タスクにアイテムを作成します。

## システムアーキテクチャ

### コンポーネント構成

```
┌─────────────────────────────────────────────┐
│    AppSheet Webhook                         │
│    - Call_Actionsテーブルからトリガー       │
│    - action_type: 'イベント'/'タスク'        │
└─────────────────────────────────────────────┘
                     │
                     ▼ JSON Webhook
┌─────────────────────────────────────────────┐
│         webhook.gs: Webhookハンドラー        │
│         - doPost()                          │
│         - processRequestDirect()            │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│    action_processor.gs: アクション分岐       │
│    - processRequest()                       │
│    - actionType正規化                       │
│    - イベント/タスク判定                     │
└─────────────────────────────────────────────┘
       │                           │
       ▼                           ▼
┌─────────────────┐   ┌─────────────────────────┐
│ google_service  │   │  oauth_service.gs       │
│ - createGoogle  │   │  - createOAuth2Service  │
│   CalendarEvent │   │    ForUser              │
│ - createGoogle  │   │  - getAccessToken       │
│   Task          │   │                         │
└─────────────────┘   └─────────────────────────┘
       │                           │
       ▼                           ▼
┌─────────────────┐   ┌─────────────────────────┐
│ Calendar API    │   │  Tasks API              │
│ - events.insert │   │  - tasks.insert         │
└─────────────────┘   └─────────────────────────┘
       │                           │
       ▼                           ▼
┌─────────────────────────────────────────────┐
│    appsheet_api.gs: AppSheet更新            │
│    - updateActionOnSuccess()                │
│    - updateActionOnError()                  │
│    - Call_Actionsテーブル更新               │
└─────────────────────────────────────────────┘
```

### スクリプトファイル構成（v2以降）

```
scripts/
├── webhook.gs                   # Webhookエントリーポイント
│   ├── doPost()                 # POST受信
│   └── processRequestDirect()   # 直接実行用
├── action_processor.gs          # メイン処理・アクション分岐
│   └── processRequest()         # イベント/タスク判定
├── google_service.gs            # Google API連携
│   ├── createGoogleCalendarEvent()
│   └── createGoogleTask()
├── oauth_service.gs             # OAuth2認証サービス
│   ├── createOAuth2ServiceForUser()
│   └── getAccessToken()
├── appsheet_api.gs              # AppSheet API連携
│   ├── updateActionOnSuccess()
│   └── updateActionOnError()
├── gemini_client.gs             # Gemini APIクライアント（共通モジュール）
├── logger.gs                    # 実行ログ記録
├── duplication_prevention.gs    # 重複防止機能
├── script_properties_manager.gs # スクリプトプロパティ管理
└── test_functions.gs            # テスト関数
```

## API仕様

### 関数シグネチャ

#### processRequest（メイン処理関数）

```javascript
/**
 * メイン処理関数（統合版）
 * actionTypeによりイベント作成またはタスク作成に分岐
 *
 * @param {string} actionId - アクションID
 * @param {string} actionType - アクションタイプ（'event'/'イベント' または 'task'/'タスク'）
 * @param {string} title - タイトル
 * @param {string} details - 詳細
 * @param {string} startDateTime - 開始日時（イベント用、日本時間JST ISO形式）
 * @param {string} endDateTime - 終了日時（イベント用、日本時間JST ISO形式）
 * @param {string} dueDateTime - 期限日時（タスク用、日本時間JST ISO形式）
 * @param {string} assigneeEmail - 担当者メールアドレス
 * @param {string} rowUrl - AppSheet行URL
 * @return {Object} 処理結果
 */
function processRequest(actionId, actionType, title, details, startDateTime, endDateTime, dueDateTime, assigneeEmail, rowUrl)
```

#### createGoogleCalendarEvent（イベント作成）

```javascript
/**
 * Googleカレンダーにイベントを作成
 *
 * @param {Object} params - イベント作成パラメータ
 * @param {string} params.title - イベントタイトル
 * @param {string} params.details - イベント詳細
 * @param {string} params.startDateTime - 開始日時（ISO形式、日本時間）
 * @param {string} params.endDateTime - 終了日時（ISO形式、日本時間）
 * @param {string} params.assigneeEmail - 担当者メールアドレス
 * @param {string} params.rowUrl - AppSheet行URL
 * @return {Object} 処理結果 {status, externalId, externalUrl, errorMessage}
 */
function createGoogleCalendarEvent(params)
```

#### createGoogleTask（タスク作成）

```javascript
/**
 * Googleタスクを作成
 *
 * @param {Object} params - タスク作成パラメータ
 * @param {string} params.title - タスクタイトル
 * @param {string} params.details - タスク詳細
 * @param {string} params.dueDateTime - 期限日時（ISO形式、日本時間）
 * @param {string} params.assigneeEmail - 担当者メールアドレス
 * @return {Object} 処理結果 {status, externalId, externalUrl, errorMessage}
 */
function createGoogleTask(params)
```

### レスポンスフォーマット

#### 成功時

```json
{
  "success": true,
  "actionId": "ACT-001",
  "actionType": "event",
  "externalId": "abc123xyz",
  "externalUrl": "https://calendar.google.com/..."
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| success | Boolean | 成功フラグ |
| actionId | String | 処理対象のアクションID |
| actionType | String | 処理タイプ（event/task） |
| externalId | String | Calendar/TasksのイベントID |
| externalUrl | String | Calendar/Tasksのイベント/タスクURL |

#### 失敗時

```json
{
  "success": false,
  "actionId": "ACT-001",
  "error": "エラーメッセージ"
}
```

## データモデル

### Call_Actionsテーブル（AppSheet）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| action_id | String | アクションID（主キー） |
| action_type | String | アクションタイプ（'イベント'/'タスク'） |
| title | String | タイトル |
| details | String | 詳細説明 |
| start_datetime | String | 開始日時（イベント用、ISO形式JST） |
| end_datetime | String | 終了日時（イベント用、ISO形式JST） |
| due_datetime | String | 期限日時（タスク用、ISO形式JST） |
| assignee_email | String | 担当者メールアドレス |
| row_url | String | AppSheet行URL |
| status | String | ステータス（'未反映'/'反映済み'/'エラー'） |
| external_id | String | 外部ID（Calendar/TasksのID） |
| external_url | String | 外部URL |
| error_details | String | エラー詳細（エラー時） |

### Calendar API イベントリソース

```javascript
{
  "summary": "イベントタイトル",
  "description": "詳細説明\n\nAppSheetで詳細を確認:\nhttps://...",
  "start": {
    "dateTime": "2025-10-18T10:00:00.000Z",
    "timeZone": "Asia/Tokyo"
  },
  "end": {
    "dateTime": "2025-10-18T11:00:00.000Z",
    "timeZone": "Asia/Tokyo"
  }
}
```

### Tasks API タスクリソース

```javascript
{
  "title": "タスクタイトル",
  "notes": "タスク詳細説明",
  "due": "2025-10-25T17:00:00.000Z"
}
```

## OAuth2認証（なりすまし）

### 認証方式

**方式:** サービスアカウントによるドメイン全体の委任（Domain-Wide Delegation）

**スコープ:**
- Calendar: `https://www.googleapis.com/auth/calendar`
- Tasks: `https://www.googleapis.com/auth/tasks`

### 必須スコープ（appsscript.json）

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}
```

### スクリプトプロパティ設定

| キー | 説明 |
|------|------|
| SERVICE_ACCOUNT_JSON | サービスアカウントのJSONキー全体 |

### oauth_service.gs実装

```javascript
function createOAuth2ServiceForUser(userEmail, scopes, servicePrefix) {
  const serviceAccountJsonString = PropertiesService.getScriptProperties().getProperty('SERVICE_ACCOUNT_JSON');
  const serviceAccountInfo = JSON.parse(serviceAccountJsonString);

  return OAuth2.createService(`${servicePrefix}:${userEmail}`)
    .setTokenUrl('https://oauth2.googleapis.com/token')
    .setPrivateKey(serviceAccountInfo.private_key)
    .setIssuer(serviceAccountInfo.client_email)
    .setClientId(serviceAccountInfo.client_id)
    .setSubject(userEmail)  // なりすまし対象ユーザー
    .setScope(scopes.join(' '))
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setCache(CacheService.getScriptCache())
    .setLock(LockService.getScriptLock());
}
```

## API統合

### Calendar API

**エンドポイント:**
```
POST https://www.googleapis.com/calendar/v3/calendars/primary/events
```

**ヘッダー:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**レスポンス:**
```json
{
  "id": "event_id_here",
  "htmlLink": "https://calendar.google.com/calendar/event?eid=...",
  "summary": "イベントタイトル",
  ...
}
```

### Tasks API

**エンドポイント:**
```
POST https://tasks.googleapis.com/tasks/v1/lists/@default/tasks
```

**ヘッダー:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**レスポンス:**
```json
{
  "id": "task_id_here",
  "selfLink": "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/task_id_here",
  "title": "タスクタイトル",
  ...
}
```

## AppSheet API統合

### 設定

```javascript
const APP_ID = '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f';
const ACCESS_KEY = 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT';
const ACTIONS_TABLE_NAME = 'Call_Actions';
```

### 成功時の更新

```javascript
{
  "Action": "Edit",
  "Properties": {"Locale": "ja-JP", "Timezone": "Asia/Tokyo"},
  "Rows": [{
    "action_id": "ACT-001",
    "external_id": "abc123xyz",
    "external_url": "https://...",
    "status": "反映済み"
  }]
}
```

### エラー時の更新

```javascript
{
  "Action": "Edit",
  "Properties": {"Locale": "ja-JP", "Timezone": "Asia/Tokyo"},
  "Rows": [{
    "action_id": "ACT-001",
    "status": "エラー",
    "error_details": "GAS Script Error: ..."
  }]
}
```

## エラーハンドリング

### エラータイプ

1. **パラメータエラー**: 必須パラメータ不足
2. **OAuth2認証エラー**: アクセストークン取得失敗
3. **Calendar/Tasks APIエラー**: イベント/タスク作成失敗
4. **AppSheet APIエラー**: ステータス更新失敗

### エラー時の動作

- エラーログを記録
- AppSheetのCall_Actionsテーブルに「エラー」ステータスを記録
- エラーレスポンスを返却

## パフォーマンス

### 実行時間

| 処理 | 平均実行時間 | 備考 |
|------|------------|------|
| イベント作成 | 2〜4秒 | OAuth2 + Calendar API + AppSheet更新 |
| タスク作成 | 2〜4秒 | OAuth2 + Tasks API + AppSheet更新 |

### 制限事項

1. **GAS実行時間**: 最大6分
2. **Calendar APIクォータ**: 100/秒（ユーザーあたり）
3. **Tasks APIクォータ**: 50,000リクエスト/日
4. **AppSheet APIクォータ**: 無料プラン 1,200リクエスト/月

## セキュリティ

### アクセス制御

- サービスアカウントによるドメイン全体の委任
- OAuth2スコープによる権限管理
- スクリプトプロパティで認証情報を暗号化保存

### データ保護

- 通信はHTTPS暗号化
- ログスプレッドシートへのアクセス制限推奨

## テスト

### 手動テスト（GASエディタ）

```javascript
// イベント作成テスト
function testProcessRequestEvent() {
  const result = processRequest(
    "ACT-TEST-001",
    "event",
    "テストイベント",
    "これはテストイベントです",
    "2025-10-18T10:00:00+09:00",
    "2025-10-18T11:00:00+09:00",
    null,
    "user@example.com",
    "https://appsheet.com/row/123"
  );

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// タスク作成テスト
function testProcessRequestTask() {
  const result = processRequest(
    "ACT-TEST-002",
    "task",
    "テストタスク",
    "これはテストタスクです",
    null,
    null,
    "2025-10-25T17:00:00+09:00",
    "user@example.com",
    null
  );

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
```

## デプロイ

```bash
cd "gas_projects/projects/calls/Appsheet_通話_イベント・タスク作成"
clasp push --force
```

## トラブルシューティング

### よくある問題

#### 問題1: "OAuth2アクセストークン取得失敗"

**原因:** サービスアカウント設定不備

**対処:**
1. SERVICE_ACCOUNT_JSONを確認
2. ドメイン全体の委任が有効か確認
3. カレンダー/タスクスコープが付与されているか確認

#### 問題2: "未対応のアクションタイプ"

**原因:** actionTypeパラメータが不正

**対処:**
- 'event'/'イベント' または 'task'/'タスク' を指定
- 大文字小文字は自動正規化される

#### 問題3: "必須パラメータ不足"

**原因:** イベント作成時にstartDateTime/endDateTimeが未指定

**対処:**
- イベント作成: startDateTime, endDateTime必須
- タスク作成: dueDateTime必須
- 日時はISO形式（日本時間JST）で指定

## バージョン履歴

### v2.0 (2025-10-17)
- スクリプト役割別分割実施
- コードの保守性向上

### v1.1 (2025-10-17)
- 日本語パラメータ対応（'イベント'/'タスク'）

### v1.0 (2025-10-17)
- 初回リリース（イベント作成・タスク作成統合）

## 関連ドキュメント

- [README.md](./README.md) - ユーザー向けドキュメント
- [FLOW.md](./FLOW.md) - 処理フロー図
- [SCRIPT_ARCHITECTURE.md](./SCRIPT_ARCHITECTURE.md) - スクリプトアーキテクチャ

## 技術スタック

- **言語**: JavaScript（Google Apps Script）
- **ランタイム**: V8 Engine
- **API**:
  - Google Calendar API v3
  - Google Tasks API v1
  - AppSheet API v2
  - OAuth2 for Apps Script
- **認証**: OAuth2（サービスアカウント・ドメイン全体の委任）
- **デプロイ**: Clasp
- **バージョン管理**: Git

## ライセンス

Fractal Group Internal Use Only
