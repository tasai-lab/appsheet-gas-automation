# Appsheet_カレンダー同期 - 技術仕様書

**Version:** 1.0.0
**Last Updated:** 2025-10-27
**Author:** Fractal Group

---

## 概要

Googleカレンダーのイベント変更を自動検知し、AppSheet（Schedule_Plan）にリアルタイムで同期するシステムの技術仕様書。

---

## システムアーキテクチャ

### 1. トリガーベース同期

```
Googleカレンダー → Calendar Trigger → onCalendarChanged → syncCalendarEvents → processEventChanges → AppSheet API
```

### 2. ユーザー個別設定

各スタッフが自分のGoogleカレンダーに対してトリガーを設定。UserPropertiesに同期トークンを保存。

### 3. 監査ログ

全ての変更を`Event_Audit_Log`シートに記録し、AppSheet更新結果も追跡。

---

## データモデル

### スプレッドシート構成

#### 1. 訪問看護_スケジュール管理 (ID: `11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc`)

**Schedule_Plan シート:**

| 列名 | 型 | 説明 |
|------|------|------|
| plan_id | string | プランID（キー） |
| gcal_event_id | string | Googleカレンダーイベント ID |
| visit_date | date | 訪問日（yyyy/MM/dd） |
| day_of_week | number | 曜日（1=月曜、7=日曜） |
| start_time | time | 開始時刻（HH:mm:ss） |
| end_time | time | 終了時刻（HH:mm:ss） |
| duration_minutes | number | 所要時間（分） |
| gcal_start_time | datetime | カレンダー開始時刻（yyyy/MM/dd HH:mm:ss） |
| gcal_end_time | datetime | カレンダー終了時刻（yyyy/MM/dd HH:mm:ss） |
| updated_at | datetime | 更新日時 |
| updated_by | string | 更新者（スタッフID） |

**Event_Audit_Log シート:**

| 列名 | 型 | 説明 |
|------|------|------|
| log_timestamp | datetime | ログ記録時刻 |
| calendar_id | string | カレンダーID（メールアドレス） |
| event_id | string | イベントID |
| plan_id | string | プランID |
| change_type | string | 変更タイプ（CREATED/UPDATED/DELETED） |
| event_title | string | イベントタイトル |
| old_start_time | datetime | 旧開始時刻 |
| old_end_time | datetime | 旧終了時刻 |
| new_start_time | datetime | 新開始時刻 |
| new_end_time | datetime | 新終了時刻 |
| detected_by | string | 検知者（スタッフID） |
| api_updated_at | datetime | API更新時刻 |
| appsheet_sync_status | string | AppSheet同期ステータス |

#### 2. Staff_Members (ID: `1F8-HxdTtz4ljW9NVqdLFX3U4mEx3Ux1QOfYCMOBXBB4`)

| 列名 | 型 | 説明 |
|------|------|------|
| staff_id | string | スタッフID（キー） |
| email | string | メールアドレス |
| ... | ... | その他のスタッフ情報 |

#### 3. 統合GAS実行ログ (ID: `16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA`)

`コスト管理` シート: 37列の統合ログ（logger.gs参照）

---

## API仕様

### Calendar API (v3)

**エンドポイント:** `Calendar.Events.list(calendarId, options)`

**パラメータ:**
- `calendarId` (string): カレンダーID（メールアドレス）
- `options` (Object):
  - `maxResults` (number): 1000
  - `showDeleted` (boolean): true
  - `singleEvents` (boolean): true
  - `syncToken` (string): 同期トークン（2回目以降）
  - `pageToken` (string): ページネーション用トークン

**レスポンス:**
```javascript
{
  items: [/* イベント配列 */],
  nextPageToken: string | undefined,
  nextSyncToken: string | undefined
}
```

**Sync Token の仕組み:**
1. 初回: syncTokenなしで全イベントを取得
2. `nextSyncToken`を保存
3. 2回目以降: syncTokenを使用して差分のみ取得
4. Invalidエラー時: トークンをリセットして全取得

---

### AppSheet API（将来用）

**注記:** 現在は`AppSheetSecureConnector`ライブラリ（ID: `1YjYuWL9-bfSkk_QRLtzBxl00V4p_95yYDFJ6rUeDifeRlRFsQqaNDHlG`）を使用。

将来的には共通モジュールの`appsheet_client.gs`に移行可能。

**更新処理:**
```javascript
AppSheetSecureConnector.updateAppSheetPlanTable(updateRows)
```

**パラメータ:**
- `updateRows` (Array<Object>): 更新行データの配列

**戻り値:**
```javascript
[
  { planId: string, status: string },
  ...
]
```

---

## 処理フロー

### onCalendarChanged

1. **トリガー起動**: Googleカレンダーでイベントが更新される
2. **ロック取得**: UserLockで排他制御
3. **syncCalendarEvents**: 差分イベントを取得
4. **processEventChanges**: イベントを処理
   - 期間外のイベントを除外（過去2日〜未来1年）
   - Schedule_Planから該当データを検索
   - AppSheet更新行を準備
   - 監査ログエントリーを作成
5. **AppSheet API呼び出し**: 更新行をバッチ送信
6. **ログ書き込み**: Event_Audit_Logに記録
7. **統合ログ保存**: finally句で実行ログを統合シートに保存

### activateUserSyncWebApp

1. **ユーザー認証**: Session.getActiveUser()
2. **既存トリガー確認**: getUserCalendarTrigger()
3. **トリガー作成**:
   ```javascript
   ScriptApp.newTrigger('onCalendarChanged')
     .forUserCalendar(userEmail)
     .onEventUpdated()
     .create();
   ```
4. **結果を返す**: JSON形式

---

## 設定パラメータ

### CONFIG (config.gs)

```javascript
{
  SPREADSHEET_ID: '11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc',
  STAFF_MASTER: {
    SPREADSHEET_ID: '1F8-HxdTtz4ljW9NVqdLFX3U4mEx3Ux1QOfYCMOBXBB4',
    SHEET_NAME: 'Staff_Members',
    EMAIL_COL: 'email',
    ID_COL: 'staff_id'
  },
  SHEET_NAMES: {
    PLAN: 'Schedule_Plan',
    LOG: 'Event_Audit_Log'
  },
  TIMEZONE: 'Asia/Tokyo',
  SYNC_TOKEN_PREFIX: 'USER_CAL_SYNC_TOKEN_',
  PROCESS_WINDOW_YEARS_AHEAD: 1,  // 未来1年後まで
  PROCESS_WINDOW_DAYS_PAST: 2      // 過去2日前まで
}
```

---

## OAuth2スコープ (appsscript.json)

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/script.send_mail"
  ]
}
```

---

## セキュリティ

### 認証

- **Google OAuth2**: 各ユーザーが自分のGoogleアカウントで認証
- **トリガー**: ユーザーごとのトリガー（UserTrigger）
- **UserProperties**: 同期トークンはユーザーごとに分離

### 排他制御

- **LockService.getUserLock()**: ユーザーごとのロック
- **tryLock(15000)**: 15秒のタイムアウト

### アクセス制御

- **Webアプリ**: executeAs=USER_ACCESSING, access=DOMAIN
- **スプレッドシート**: 編集権限が必要

---

## エラーハンドリング

### 1. Sync Token Invalid

```javascript
if (e.message.includes("Sync token is invalid")) {
  properties.deleteProperty(syncTokenKey);
  // トークンをリセットして再試行
}
```

### 2. ロック取得失敗

```javascript
if (!lock.tryLock(15000)) {
  logger.error('ロック取得失敗');
  return; // 処理をスキップ
}
```

### 3. スプレッドシートアクセスエラー

```javascript
try {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
} catch (e) {
  logger.error(`スプレッドシート初期化失敗: ${e.message}`);
  throw e;
}
```

### 4. AppSheet API エラー

```javascript
try {
  const results = AppSheetSecureConnector.updateAppSheetPlanTable(rows);
} catch (error) {
  logger.error(`AppSheet更新エラー: ${error.message}`);
  // ログにエラーステータスを記録
}
```

---

## パフォーマンス最適化

### 1. バッチ処理

- イベントを一度に取得（maxResults=1000）
- AppSheet更新を一括送信

### 2. キャッシュ

```javascript
GLOBAL_CACHE.staffMap = null; // 処理終了時にクリア
```

### 3. 期間制限

- 過去2日〜未来1年の範囲のみ処理
- 不要なイベントを早期に除外

### 4. 検索最適化

```javascript
// TextFinderを使用した高速検索
const finder = searchColumnRange.createTextFinder(regex)
  .matchEntireCell(true)
  .useRegularExpression(true);
```

---

## テストとデバッグ

### テスト関数

- `testGetStaffMap()`: スタッフマップ取得テスト
- `testGetSheetsAndColumns()`: スプレッドシート取得テスト
- `testLogger()`: ロガー動作テスト
- `testGetUserCalendarTrigger()`: トリガー状態確認
- `runAllTests()`: 統合テスト

### ログ確認

1. **GASエディタ**: `console.log()`の出力を確認
2. **統合ログシート**: 実行ログを確認（ID: `16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA`）
3. **監査ログシート**: イベント変更履歴を確認（Event_Audit_Log）

---

## デプロイ

### 1. Webアプリデプロイ

```bash
cd gas_projects/projects/common/Appsheet_カレンダー同期/scripts
clasp push
clasp deploy --description "v1.0.0: 最適化版"
```

### 2. Webアプリ設定

- **Execute as**: User accessing the web app
- **Who has access**: Anyone within Fractal Group

### 3. トリガー設定

ユーザー個別設定（Webアプリから有効化）

---

## トラブルシューティング

### 問題: 同期が動作しない

**確認事項:**
1. ユーザーがトリガーを有効化したか（`testGetUserCalendarTrigger()`）
2. カレンダーイベントが処理期間内か（過去2日〜未来1年）
3. Schedule_Planに該当のイベントIDが存在するか

### 問題: AppSheet更新が失敗する

**確認事項:**
1. AppSheetSecureConnectorライブラリが正しく設定されているか
2. ログシート（Event_Audit_Log）の`appsheet_sync_status`列を確認
3. ライブラリのバージョンを確認（developmentMode=true）

### 問題: スタッフマップが取得できない

**確認事項:**
1. Staff_Membersシートへのアクセス権限
2. 列名が正しいか（email, staff_id）
3. データが空でないか

---

## 今後の拡張

### 1. AppSheet API直接呼び出し

現在の`AppSheetSecureConnector`ライブラリから、共通モジュールの`appsheet_client.gs`に移行。

### 2. Webhook対応

カレンダートリガーに加えて、Webhook経由での呼び出しにも対応。

### 3. 通知機能

エラー時やAppSheet更新失敗時に、管理者にメール通知。

### 4. ダッシュボード

統合ログシートを元に、同期状況をダッシュボード化。

---

## 参考資料

- [Calendar API v3 Reference](https://developers.google.com/calendar/api/v3/reference)
- [Apps Script Triggers](https://developers.google.com/apps-script/guides/triggers)
- [LockService](https://developers.google.com/apps-script/reference/lock/lock-service)
- [PropertiesService](https://developers.google.com/apps-script/reference/properties/properties-service)
