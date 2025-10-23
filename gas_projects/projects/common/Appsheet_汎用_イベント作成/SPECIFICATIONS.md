# Appsheet_汎用_イベント作成 - 技術仕様書

## 概要

Googleカレンダーイベントと不在イベント（Out of Office）を作成・削除する汎用GASプロジェクト。OAuth2なりすまし認証を使用して指定ユーザーのカレンダーにイベントを作成・削除できます。

## システムアーキテクチャ

### コンポーネント構成

```
┌─────────────────────────────────────────────┐
│    外部システム / AppSheet / GASエディタ      │
│    - createGenericEvent()                   │
│    - deleteGenericEvent()                   │
│    - createOutOfOfficeEvent()               │
│    - createDailyOutOfOfficeEvent()          │
│    - doPost()                               │
└─────────────────────────────────────────────┘
                     │
                     ▼ 関数呼び出し
┌─────────────────────────────────────────────┐
│         main.js: メイン処理ロジック          │
│         - パラメータ検証                     │
│         - イベントリソース構築               │
│         - API呼び出し                        │
│         - 実行ログ記録                       │
└─────────────────────────────────────────────┘
                     │
       ┌─────────────┴─────────────┐
       │                           │
       ▼                           ▼
┌─────────────────┐   ┌─────────────────────────┐
│  AuthService    │   │  Google Calendar API    │
│  - OAuth2認証   │   │  - events.insert        │
│  - なりすまし   │   │  - events.delete        │
│  - トークン管理 │   │  - 不在イベント作成     │
└─────────────────┘   └─────────────────────────┘
       │                           │
       ▼                           ▼
┌─────────────────┐   ┌─────────────────────────┐
│ Script          │   │  Googleカレンダー       │
│ Properties      │   │  - primary              │
│ - サービス      │   │  - イベント             │
│   アカウント    │   │  - 不在イベント         │
│   JSON          │   │                         │
└─────────────────┘   └─────────────────────────┘
       │
       ▼
┌─────────────────┐
│ 実行ログ        │
│ スプレッドシート│
│ (共有ドライブ)  │
└─────────────────┘
```

## 処理モード

### 1. 通常イベント作成（CREATE）

**関数:** `createGenericEvent(title, description, ownerEmail, attendees, colorId, startDateTime, endDateTime, location, timeZone, sendUpdates, recurrence, reminders)`

- 通常のカレンダーイベントを作成
- 開始・終了日時を指定
- 参加者、場所、繰り返しルールなどをサポート

**処理フロー:**
1. パラメータ検証（title必須）
2. デフォルト値設定
3. イベントリソース構築
4. OAuth2認証トークン取得
5. Calendar API呼び出し（events.insert）
6. 実行ログ記録

### 2. 通常イベント削除（DELETE）

**関数:** `deleteGenericEvent(ownerEmail, eventId, sendUpdates)`

- 既存のカレンダーイベントを削除
- イベントIDで削除対象を指定

**処理フロー:**
1. パラメータ検証（ownerEmail, eventId必須）
2. OAuth2認証トークン取得
3. Calendar API呼び出し（events.delete）
4. 実行ログ記録

### 3. 不在イベント作成（CREATE_OOO）

**関数:** `createOutOfOfficeEvent(title, reason, ownerEmail, startDate, endDate, declineMessage, sendUpdates, timeZone, allDay)`

- Out of Officeイベントを作成
- 終日または時間指定の不在期間を設定
- 自動辞退メッセージを設定可能

**処理フロー:**
1. パラメータ検証（title, startDate, endDate必須）
2. デフォルト値設定
3. 不在イベントリソース構築（eventType: 'outOfOffice'）
4. OAuth2認証トークン取得
5. Calendar API呼び出し（events.insert）
6. 実行ログ記録

### 4. 不在イベント削除（DELETE_OOO）

**関数:** `deleteOutOfOfficeEvent(ownerEmail, eventId, sendUpdates)`

- 既存の不在イベントを削除
- 内部的には`deleteGenericEvent()`を呼び出し

### 5. 簡易版不在イベント作成（CREATE_DAILY_OOO）

**関数:** `createDailyOutOfOfficeEvent(date, ownerEmail, title, declineMessage, reason, sendUpdates)`

- 指定日を終日不在にする
- 日付とメールアドレスだけで設定可能
- 内部的には`createOutOfOfficeEvent()`を呼び出し

**処理フロー:**
1. パラメータ検証（date, ownerEmail必須）
2. 日付妥当性チェック
3. 開始日・終了日を同じ日に設定
4. `createOutOfOfficeEvent()`を呼び出し

## API仕様

### 関数シグネチャ

#### createGenericEvent

```javascript
/**
 * 汎用イベント作成関数（個別引数で直接実行可能）
 *
 * @param {string} title - イベントタイトル（必須）
 * @param {string} description - イベントの説明（デフォルト: ''）
 * @param {string} ownerEmail - イベント保有者のメールアドレス（デフォルト: Session.getActiveUser().getEmail()）
 * @param {string} attendees - 同行者のメールアドレス（カンマ区切り、デフォルト: ''）
 * @param {string} colorId - イベントカラーID（1-11、デフォルト: '9'=ブルー）
 * @param {Date|string} startDateTime - 開始日時（デフォルト: 現在時刻+1時間）
 * @param {Date|string} endDateTime - 終了日時（デフォルト: 開始時刻+1時間）
 * @param {string} location - 場所（デフォルト: ''）
 * @param {string} timeZone - タイムゾーン（デフォルト: 'Asia/Tokyo'）
 * @param {boolean} sendUpdates - 参加者への通知（デフォルト: true）
 * @param {Array<string>} recurrence - 繰り返しルール（RRULE形式、デフォルト: なし）
 * @param {Object} reminders - リマインダー設定（デフォルト: デフォルトのリマインダー使用）
 *
 * @returns {{id: string, url: string}} イベントIDとURL
 */
function createGenericEvent(title, description, ownerEmail, attendees, colorId, startDateTime, endDateTime, location, timeZone, sendUpdates, recurrence, reminders)
```

#### createOutOfOfficeEvent

```javascript
/**
 * 不在イベント作成関数（個別引数で直接実行可能）
 *
 * @param {string} title - 不在イベントタイトル（必須）
 * @param {string} reason - 不在理由（デフォルト: 'OTHER'）
 *                          利用可能な値: 'VACATION', 'SICK_LEAVE', 'MATERNITY_LEAVE', 'PATERNITY_LEAVE', 'OTHER'
 * @param {string} ownerEmail - イベント保有者のメールアドレス（デフォルト: Session.getActiveUser().getEmail()）
 * @param {Date|string} startDate - 開始日（必須）
 * @param {Date|string} endDate - 終了日（必須）
 * @param {string} declineMessage - 自動辞退時のメッセージ（デフォルト: ''）
 * @param {boolean} sendUpdates - 参加者への通知（デフォルト: true）
 * @param {string} timeZone - タイムゾーン（デフォルト: 'Asia/Tokyo'）
 * @param {boolean} allDay - 終日イベントとして設定（デフォルト: true）
 *
 * @returns {{id: string, url: string}} イベントIDとURL
 */
function createOutOfOfficeEvent(title, reason, ownerEmail, startDate, endDate, declineMessage, sendUpdates, timeZone, allDay)
```

#### createDailyOutOfOfficeEvent

```javascript
/**
 * 簡易版不在イベント作成関数（指定日の00:00～23:59を不在にする）
 *
 * @param {Date|string} date - 不在にする日付（必須）
 * @param {string} ownerEmail - イベント保有者のメールアドレス（必須）
 * @param {string} title - 不在イベントタイトル（デフォルト: '不在'）
 * @param {string} declineMessage - 自動辞退時のメッセージ（デフォルト: '本日は不在です。'）
 * @param {string} reason - 不在理由（デフォルト: 'OTHER'）
 * @param {boolean} sendUpdates - 参加者への通知（デフォルト: false）
 *
 * @returns {{id: string, url: string}} イベントIDとURL
 */
function createDailyOutOfOfficeEvent(date, ownerEmail, title, declineMessage, reason, sendUpdates)
```

#### deleteGenericEvent

```javascript
/**
 * イベント削除関数（個別引数で直接実行可能）
 *
 * @param {string} ownerEmail - イベント保有者のメールアドレス（必須）
 * @param {string} eventId - 削除するイベントID（必須）
 * @param {boolean} sendUpdates - 参加者への通知（デフォルト: true）
 *
 * @returns {{success: boolean, message: string}} 削除結果
 */
function deleteGenericEvent(ownerEmail, eventId, sendUpdates)
```

#### doPost（Webhookエントリーポイント）

```javascript
/**
 * Webhookエントリーポイント
 * JSONペイロードを受け取り、actionに応じて処理を振り分ける
 *
 * @param {GoogleAppsScript.Events.DoPost} e - POSTリクエスト
 * @returns {GoogleAppsScript.Content.TextOutput} JSON形式のレスポンス
 */
function doPost(e)
```

### レスポンスフォーマット

#### イベント作成成功時

```json
{
  "id": "event_id_here",
  "url": "https://calendar.google.com/calendar/event?eid=..."
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | String | イベントID（Calendar APIから返却） |
| url | String | イベントのURL（ブラウザで開ける） |

#### イベント削除成功時

```json
{
  "success": true,
  "message": "イベントを削除しました"
}
```

#### 重複実行時

```json
{
  "duplicate": true
}
```

#### エラー時

```json
{
  "error": "エラーメッセージ"
}
```

## データモデル

### Calendar API イベントリソース（通常イベント）

```javascript
{
  "summary": "イベントタイトル",
  "description": "イベントの説明",
  "start": {
    "dateTime": "2025-10-22T10:00:00+09:00",
    "timeZone": "Asia/Tokyo"
  },
  "end": {
    "dateTime": "2025-10-22T11:00:00+09:00",
    "timeZone": "Asia/Tokyo"
  },
  "attendees": [
    { "email": "user1@example.com" },
    { "email": "user2@example.com" }
  ],
  "colorId": "11",
  "location": "会議室A",
  "recurrence": [
    "RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10"
  ],
  "reminders": {
    "useDefault": true
  }
}
```

### Calendar API 不在イベントリソース

```javascript
{
  "summary": "夏季休暇",
  "eventType": "outOfOffice",
  "start": {
    "date": "2025-08-01",
    "timeZone": "Asia/Tokyo"
  },
  "end": {
    "date": "2025-08-06", // 終了日の翌日を指定（Googleカレンダーの仕様）
    "timeZone": "Asia/Tokyo"
  },
  "outOfOfficeProperties": {
    "autoDeclineMode": "declineAllConflictingInvitations",
    "declineMessage": "この期間は休暇中です。緊急の場合は〇〇までご連絡ください。"
  }
}
```

## OAuth2認証（なりすまし）

### 認証方式

**方式:** サービスアカウントによるドメイン全体の委任（Domain-Wide Delegation）

**特徴:**
- ユーザーの同意画面なしで、指定ユーザーのリソースにアクセス可能
- サービスアカウントが複数ユーザーになりすまして操作可能
- Google Workspace管理者による事前設定が必要

### 必須スコープ

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}
```

### スクリプトプロパティ設定

| キー | 値 | 説明 |
|------|-----|------|
| SERVICE_ACCOUNT_JSON | JSONキー | サービスアカウントのJSONキー全体 |

**サービスアカウントJSON構造:**
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "service-account@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

### AuthService実装

**ファイル:** `AuthService.js`

```javascript
const AuthService = {
  getAccessTokenForUser(userEmail) {
    const service = this._createOAuth2ServiceForUser(userEmail);

    if (!service.hasAccess()) {
      Logger.info(`OAuth2: ${userEmail} のための初回認証またはトークンリフレッシュを実行します。`);
    }

    const accessToken = service.getAccessToken();

    if (!accessToken) {
      throw new Error(`OAuth2アクセストークン取得失敗: ${service.getLastError()}`);
    }

    return accessToken;
  },

  _createOAuth2ServiceForUser(userEmail) {
    const serviceAccountJsonString = PropertiesService.getScriptProperties().getProperty('SERVICE_ACCOUNT_JSON');
    const serviceAccountInfo = JSON.parse(serviceAccountJsonString);

    return OAuth2.createService(`CalendarImpersonation:${userEmail}`)
      .setTokenUrl('https://oauth2.googleapis.com/token')
      .setPrivateKey(serviceAccountInfo.private_key)
      .setIssuer(serviceAccountInfo.client_email)
      .setClientId(serviceAccountInfo.client_id)
      .setSubject(userEmail) // なりすまし対象ユーザー
      .setScope('https://www.googleapis.com/auth/calendar')
      .setPropertyStore(PropertiesService.getScriptProperties())
      .setCache(CacheService.getScriptCache())
      .setLock(LockService.getScriptLock());
  }
};
```

## Calendar API統合

### エンドポイント

#### イベント作成

```
POST https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all
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

#### イベント削除

```
DELETE https://www.googleapis.com/calendar/v3/calendars/primary/events/{eventId}?sendUpdates=all
```

**レスポンス:**
- 204 No Content: 削除成功
- 410 Gone / 404 Not Found: 既に削除済み

### エラーハンドリング

| HTTPステータス | 説明 | 対処 |
|--------------|------|------|
| 200 | 成功 | - |
| 204 | 削除成功 | - |
| 400 | 不正なリクエスト | パラメータを確認 |
| 401 | 認証エラー | OAuth2トークンを再取得 |
| 403 | 権限不足 | スコープ設定を確認 |
| 404 | リソース不存在 | イベントIDを確認 |
| 410 | 既に削除済み | 正常終了として処理 |
| 500 | サーバーエラー | リトライ |

## 重複防止機能

### 実装

**ファイル:** `duplication_prevention.js`

**仕組み:**
- リクエストペイロードのSHA-256ハッシュを一意IDとして使用
- ScriptPropertiesに24時間のTTLで保存
- ダブルチェックロックパターンで競合状態を防止

**使用例:**
```javascript
const dupPrevention = createDuplicationPrevention('Appsheet_汎用_イベント作成');
const result = dupPrevention.executeWithRetry(recordId, () => {
  return createGenericEvent(...);
}, logger);

if (result.isDuplicate) {
  return ContentService.createTextOutput(JSON.stringify({duplicate: true}));
}
```

## 実行ログ記録

### ログスプレッドシート設定

```javascript
const LOGGER_CONFIG = {
  logFolderId: '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX',
  logSpreadsheetName: 'GAS実行ログ',
  retentionDays: 90
};
```

### 記録項目

| カラム | 説明 |
|-------|------|
| 開始時刻 | 処理開始時刻 |
| 終了時刻 | 処理終了時刻 |
| 実行時間(秒) | 処理時間 |
| スクリプト名 | "Appsheet_汎用_イベント作成"固定 |
| ステータス | "成功"/"エラー"/"重複" |
| レコードID | イベントIDまたはタイトル |
| リクエストID | UUID |
| ログサマリー | 処理ログの要約 |
| エラー詳細 | エラー時のスタックトレース |

### ログ記録方法

```javascript
const logger = createLogger('Appsheet_汎用_イベント作成');
logger.info('イベント作成開始', {title, config});
logger.success('イベント作成成功', {eventId: result.id});
logger.error('イベント作成エラー', {stack: error.stack});
```

## エラーハンドリング

### エラータイプ

1. **パラメータエラー**
   - 原因: 必須パラメータが未指定
   - エラーメッセージ例: `"タイトルは必須です"`
   - 対処: パラメータを正しく指定

2. **OAuth2認証エラー**
   - 原因: サービスアカウント設定不備、トークン取得失敗
   - エラーメッセージ例: `"OAuth2アクセストークン取得失敗: ..."`
   - 対処: SERVICE_ACCOUNT_JSONを確認、ドメイン全体の委任を確認

3. **Calendar APIエラー**
   - 原因: API呼び出し失敗、権限不足
   - エラーメッセージ例: `"Calendar APIエラー: Status 403, Body: ..."`
   - 対処: スコープ設定、カレンダー権限を確認

4. **日付エラー**
   - 原因: 無効な日付形式
   - エラーメッセージ例: `"無効な日付形式です"`
   - 対処: 日付をISO形式またはDateオブジェクトで指定

### エラーログ記録

エラー時でも以下の情報を記録：
- エラーメッセージ
- スタックトレース
- 実行時間
- パラメータ情報（機密情報を除く）

## パフォーマンス

### 実行時間

| 処理 | 平均実行時間 | 備考 |
|------|------------|------|
| イベント作成 | 1〜3秒 | OAuth2: 0.5秒 + Calendar API: 0.5〜2秒 |
| イベント削除 | 1〜2秒 | OAuth2: 0.5秒 + Calendar API: 0.5〜1秒 |
| 不在イベント作成 | 1〜3秒 | 通常イベントと同様 |

### 制限事項

1. **GAS実行時間**: 最大6分（通常の処理では十分）
2. **Calendar APIクォータ**:
   - ユーザーあたりのクエリ数: 100/秒
   - プロジェクトあたりのクエリ数: 1,000/秒
3. **ScriptPropertiesサイズ**: 合計約9KB（重複防止機能が使用）

## セキュリティ

### アクセス制御

1. **GASの実行権限**
   - スクリプト実行ユーザー: スクリプトのオーナー
   - カレンダーアクセス: OAuth2なりすましで指定ユーザー

2. **OAuth Scope**
   - `https://www.googleapis.com/auth/calendar` - カレンダー操作
   - `https://www.googleapis.com/auth/script.external_request` - 外部API呼び出し
   - `https://www.googleapis.com/auth/spreadsheets` - ログ記録

3. **サービスアカウント認証**
   - プライベートキーはスクリプトプロパティで管理
   - ドメイン全体の委任による権限管理

### データ保護

- サービスアカウントJSONはスクリプトプロパティで暗号化保存
- ログスプレッドシートへのアクセス制限設定推奨
- Calendar APIへの通信はHTTPS暗号化

## テスト

### 手動テスト（GASエディタ）

#### イベント作成テスト

```javascript
function testCreateBasicEvent() {
  const result = createGenericEvent(
    'テストイベント',
    'これはテストイベントです',
    null, // ownerEmail - デフォルト使用
    'test@example.com',
    '11'
  );

  Logger.log('作成されたイベント:');
  Logger.log('ID: ' + result.id);
  Logger.log('URL: ' + result.url);

  return result;
}
```

#### 不在イベント作成テスト

```javascript
function testCreateOutOfOfficeEvent() {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 2);

  const result = createOutOfOfficeEvent(
    'テスト休暇',
    'VACATION',
    null,
    startDate,
    endDate,
    'テスト期間中は不在です。',
    false
  );

  Logger.log('作成された不在イベント:');
  Logger.log('ID: ' + result.id);
  Logger.log('URL: ' + result.url);

  return result;
}
```

## デプロイ

### 通常デプロイ

```bash
cd "gas_projects/projects/common/Appsheet_汎用_イベント作成"
clasp push --force
```

### 統合デプロイツール

```bash
cd gas_projects
python deploy_unified.py "Appsheet_汎用_イベント作成" "v2: 不在イベント機能追加"
```

## トラブルシューティング

### よくある問題

#### 問題1: "OAuth2アクセストークン取得失敗"

**原因:** サービスアカウント設定不備

**対処:**
1. GCPコンソールでサービスアカウントを確認
2. ドメイン全体の委任が有効か確認
3. クライアントIDが正しいか確認
4. スコープが付与されているか確認（https://www.googleapis.com/auth/calendar）

#### 問題2: "Calendar APIエラー (400): Invalid request"

**原因:** イベントリソースの形式が不正

**対処:**
1. 日時形式が正しいか確認（ISO形式またはDateオブジェクト）
2. タイムゾーンが正しいか確認
3. 必須フィールド（summary, start, end）が含まれているか確認

#### 問題3: 不在イベントが作成されない

**原因:** 不在イベントリソースの形式が不正

**対処:**
1. `eventType: 'outOfOffice'` が設定されているか確認
2. 終日イベントの場合、`start.date` と `end.date` を使用
3. 終了日は開始日の翌日を指定（Googleカレンダーの仕様）
4. `outOfOfficeProperties.autoDeclineMode` が設定されているか確認

## バージョン履歴

### v1.0.0 (2025-10-16)
- 初回リリース
- 通常イベント作成・削除機能
- 不在イベント作成・削除機能
- 簡易版不在イベント作成機能
- OAuth2なりすまし認証実装
- 重複防止機能実装
- 実行ログ記録実装

## 関連ドキュメント

- [README.md](./README.md) - ユーザー向けドキュメント
- [FLOW.md](./FLOW.md) - 処理フロー図
- [実行ログスプレッドシート](https://drive.google.com/drive/folders/16swPUizvdlyPxUjbDpVl9-VBDJZO91kX)

## 技術スタック

- **言語**: JavaScript（Google Apps Script）
- **ランタイム**: V8 Engine
- **API**:
  - Google Calendar API v3
  - OAuth2 for Apps Script
- **認証**: OAuth2（サービスアカウント・ドメイン全体の委任）
- **ログ**: Google Sheets API
- **デプロイ**: Clasp
- **バージョン管理**: Git

## ライセンス

Fractal Group Internal Use Only
