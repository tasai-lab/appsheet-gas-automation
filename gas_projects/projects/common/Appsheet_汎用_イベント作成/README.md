# Appsheet_汎用_イベント作成

Googleカレンダーイベントと不在イベント（Out of Office）を作成・削除する汎用GASプロジェクト

## 概要

個別引数またはWebhookペイロードでGoogleカレンダーイベントを作成・削除し、JSON形式で{id, url}を返します。OAuth2なりすまし認証を使用して指定ユーザーのカレンダーにイベントを作成できます。

## 主な機能

### コア機能

- ✅ **通常イベント作成**: 開始・終了日時を指定してカレンダーイベント作成
- ✅ **通常イベント削除**: イベントIDでイベント削除
- ✅ **不在イベント作成**: Out of Officeイベント作成（終日/時間指定）
- ✅ **不在イベント削除**: 不在イベント削除
- ✅ **簡易版不在イベント作成**: 日付とメールだけで終日不在設定
- ✅ **OAuth2なりすまし認証**: サービスアカウントで指定ユーザーのカレンダーにアクセス
- ✅ **重複防止機能**: リクエストIDベースの重複検出
- ✅ **実行ログ記録**: 統合ログスプレッドシートに記録

### サポートする操作

| action | 説明 | 必須パラメータ |
|--------|------|---------------|
| CREATE (デフォルト) | 通常イベント作成 | title, startDateTime, endDateTime, assigneeEmail |
| DELETE | イベント削除 | ownerEmail, eventId |
| CREATE_OOO | 不在イベント作成 | title, startDate, endDate, ownerEmail |
| DELETE_OOO | 不在イベント削除 | ownerEmail, eventId |
| CREATE_DAILY_OOO | 簡易版不在イベント作成 | date, ownerEmail |

## 使用方法

### 1. 通常イベント作成（個別引数版）

```javascript
const result = createGenericEvent(
  'ミーティング',                    // title
  '週次定例会議',                    // description
  'owner@example.com',              // ownerEmail
  'user1@example.com,user2@example.com', // attendees
  '11',                             // colorId (11=トマト/赤)
  new Date('2025-10-22T10:00:00'),  // startDateTime
  new Date('2025-10-22T11:00:00'),  // endDateTime
  '会議室A',                        // location
  'Asia/Tokyo',                     // timeZone
  true,                             // sendUpdates
  null,                             // recurrence
  null                              // reminders
);

// レスポンス: {id: 'event_id', url: 'https://calendar.google.com/...'}
```

### 2. 通常イベント削除

```javascript
const result = deleteGenericEvent(
  'owner@example.com',  // ownerEmail
  'event_id_here',      // eventId
  true                  // sendUpdates
);

// レスポンス: {success: true, message: 'イベントを削除しました'}
```

### 3. 不在イベント作成（Out of Office）

```javascript
const result = createOutOfOfficeEvent(
  '夏季休暇',                       // title
  'VACATION',                      // reason
  'user@example.com',              // ownerEmail
  new Date('2025-08-01'),          // startDate
  new Date('2025-08-05'),          // endDate
  'この期間は休暇中です。緊急の場合は〇〇までご連絡ください。', // declineMessage
  true,                            // sendUpdates
  'Asia/Tokyo',                    // timeZone
  true                             // allDay
);

// レスポンス: {id: 'event_id', url: 'https://calendar.google.com/...'}
```

**不在イベントの重要な仕様:**
- Google Calendar APIの仕様により、不在イベントは終日（all-day）形式を使用できません
- `allDay: true`を指定しても、内部的には開始日00:00:00～終了日翌日00:00:00の時間指定として処理されます
- カレンダーUIでは終日イベントのように表示されます

### 4. 簡易版不在イベント作成（最もシンプル）

```javascript
// 日付とメールだけで、その日を終日不在にする
const result = createDailyOutOfOfficeEvent(
  '2025-10-25',         // date
  'user@example.com'    // ownerEmail
);

// レスポンス: {id: 'event_id', url: 'https://calendar.google.com/...'}
```

### 5. Webhookエントリーポイント（doPost）

#### イベント作成のWebhookペイロード例

```json
{
  "action": "CREATE",
  "title": "ミーティング",
  "description": "週次定例会議",
  "ownerEmail": "owner@example.com",
  "attendees": "user1@example.com,user2@example.com",
  "colorId": "11",
  "startDateTime": "2025-10-22T10:00:00+09:00",
  "endDateTime": "2025-10-22T11:00:00+09:00",
  "location": "会議室A"
}
```

#### 不在イベント作成のWebhookペイロード例

```json
{
  "action": "CREATE_OOO",
  "title": "夏季休暇",
  "reason": "VACATION",
  "ownerEmail": "user@example.com",
  "startDate": "2025-08-01",
  "endDate": "2025-08-05",
  "declineMessage": "この期間は休暇中です",
  "allDay": true
}
```

#### 簡易版不在イベント作成のWebhookペイロード例

```json
{
  "action": "CREATE_DAILY_OOO",
  "date": "2025-10-25",
  "ownerEmail": "user@example.com",
  "title": "休暇",
  "declineMessage": "本日は休暇です"
}
```

#### イベント削除のWebhookペイロード例

```json
{
  "action": "DELETE",
  "ownerEmail": "owner@example.com",
  "eventId": "event_id_here"
}
```

## パラメータ仕様

### createGenericEvent（通常イベント作成）

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| title | string | ✅ | - | イベントタイトル |
| description | string | ❌ | '' | イベントの説明 |
| ownerEmail | string | ❌ | Session.getActiveUser().getEmail() | イベント保有者のメールアドレス |
| attendees | string | ❌ | '' | 同行者のメールアドレス（カンマ区切り） |
| colorId | string | ❌ | '9' | イベントカラーID（1-11） |
| startDateTime | Date\|string | ❌ | 現在+1時間 | 開始日時 |
| endDateTime | Date\|string | ❌ | 開始+1時間 | 終了日時 |
| location | string | ❌ | '' | 場所 |
| timeZone | string | ❌ | 'Asia/Tokyo' | タイムゾーン |
| sendUpdates | boolean | ❌ | true | 参加者への通知 |
| recurrence | Array<string> | ❌ | null | 繰り返しルール（RRULE形式） |
| reminders | Object | ❌ | {useDefault: true} | リマインダー設定 |

### createOutOfOfficeEvent（不在イベント作成）

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| title | string | ✅ | - | 不在イベントタイトル |
| reason | string | ❌ | 'OTHER' | 不在理由（VACATION/SICK_LEAVE/MATERNITY_LEAVE/PATERNITY_LEAVE/OTHER） |
| ownerEmail | string | ❌ | Session.getActiveUser().getEmail() | イベント保有者のメールアドレス |
| startDate | Date\|string | ✅ | - | 開始日 |
| endDate | Date\|string | ✅ | - | 終了日 |
| declineMessage | string | ❌ | '' | 自動辞退時のメッセージ |
| sendUpdates | boolean | ❌ | true | 参加者への通知 |
| timeZone | string | ❌ | 'Asia/Tokyo' | タイムゾーン |
| allDay | boolean | ❌ | true | 終日イベントとして設定 |

### createDailyOutOfOfficeEvent（簡易版不在イベント作成）

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|----------|-----|------|-----------|------|
| date | Date\|string | ✅ | - | 不在にする日付 |
| ownerEmail | string | ✅ | - | イベント保有者のメールアドレス |
| title | string | ❌ | '不在' | 不在イベントタイトル |
| declineMessage | string | ❌ | '本日は不在です。' | 自動辞退時のメッセージ |
| reason | string | ❌ | 'OTHER' | 不在理由 |
| sendUpdates | boolean | ❌ | false | 参加者への通知 |

### イベントカラーID

| ID | 色 | 用途例 |
|----|-----|--------|
| 1 | ラベンダー | - |
| 2 | セージ | - |
| 3 | ブドウ | - |
| 4 | フラミンゴ | - |
| 5 | バナナ | - |
| 6 | タンジェリン | - |
| 7 | ピーコック | - |
| 8 | グラファイト | - |
| 9 | ブルーベリー（ブルー） | デフォルト |
| 10 | バジル | - |
| 11 | トマト（赤） | 重要イベント |

## レスポンス形式

### イベント作成成功時

```json
{
  "id": "event_id_here",
  "url": "https://calendar.google.com/calendar/event?eid=..."
}
```

### イベント削除成功時

```json
{
  "success": true,
  "message": "イベントを削除しました"
}
```

### 重複実行時

```json
{
  "duplicate": true
}
```

### エラー時

```json
{
  "error": "エラーメッセージ"
}
```

## 設定

### スクリプトプロパティ

| キー | 説明 | 必須 |
|------|------|------|
| SERVICE_ACCOUNT_JSON | サービスアカウントのJSONキー | ✅ |

### OAuth2スコープ（appsscript.json）

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

### 実行ログ設定

```javascript
const LOGGER_CONFIG = {
  logFolderId: '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX',
  logSpreadsheetName: 'GAS実行ログ',
  retentionDays: 90
};
```

## スクリプトファイル構成

```
scripts/
├── main.js                        # メイン処理
│   ├── createGenericEvent()       # 通常イベント作成
│   ├── deleteGenericEvent()       # イベント削除
│   ├── createOutOfOfficeEvent()   # 不在イベント作成
│   ├── deleteOutOfOfficeEvent()   # 不在イベント削除
│   ├── createDailyOutOfOfficeEvent() # 簡易版不在イベント作成
│   └── doPost()                   # Webhookエントリーポイント
├── test_functions.js              # テスト・修正ツール
│   ├── testFixCurrentMonthOutOfOffice() # 今月の不在イベント修正（ドライラン）
│   ├── testFixCurrentMonthOutOfOfficeExecute() # 今月の不在イベント修正（実行）
│   ├── testFixOutOfOfficeEndTime() # 指定年月の不在イベント修正
│   └── testFixOutOfOfficeEndTimeExecute() # 指定年月の不在イベント修正（実行）
├── config.js                      # 設定
├── AuthService.js                 # OAuth2認証サービス
├── logger.js                      # 実行ログ記録
├── duplication_prevention.js      # 重複防止機能
└── script_properties_manager.js   # スクリプトプロパティ管理
```

## テスト関数

### 通常イベント

```javascript
// 基本的なイベント作成
testCreateBasicEvent()

// 詳細設定付きイベント作成
testCreateDetailedEvent()

// 繰り返しイベント作成
testCreateRecurringEvent()

// イベント削除
testDeleteEvent()

// イベント作成して削除（統合テスト）
testCreateAndDeleteEvent()
```

### 不在イベント

```javascript
// 不在イベント作成（終日休暇）
testCreateOutOfOfficeEvent()

// 不在イベント作成（病欠）
testCreateSickLeaveEvent()

// 不在イベント削除
testDeleteOutOfOfficeEvent()

// 簡易版不在イベント作成
testCreateDailyOutOfOfficeEvent()

// 簡易版不在イベント作成（文字列日付で指定）
testCreateDailyOutOfOfficeEventByString()

// 簡易版不在イベント作成して削除（統合テスト）
testCreateAndDeleteDailyOutOfOfficeEvent()

// 不在イベント作成して削除（統合テスト）
testCreateAndDeleteOutOfOfficeEvent()
```

### 不在イベント修正ツール（test_functions.js）

既存の不在イベントの終了時刻を修正するためのユーティリティ関数です。主に、23:59:59で終了している不在イベントを翌日00:00:00に修正します。

```javascript
// 今月の不在イベントを確認（ドライラン）
testFixCurrentMonthOutOfOffice()

// 今月の不在イベントを修正（実行モード）
testFixCurrentMonthOutOfOfficeExecute()

// 特定の年月・ユーザーの不在イベントを確認（ドライラン）
testFixOutOfOfficeEndTime(2025, 10, 'user@example.com', true)

// 特定の年月・ユーザーの不在イベントを修正（実行モード）
testFixOutOfOfficeEndTimeExecute(2025, 10, 'user@example.com')
```

**使用例:**

1. まず、ドライランモードで対象イベントを確認
```javascript
testFixCurrentMonthOutOfOffice()
```

2. 結果を確認し、問題なければ実行モードで更新
```javascript
testFixCurrentMonthOutOfOfficeExecute()
```

⚠️ **注意**: 実行モード（`Execute`関数）は実際にイベントを更新します。必ず事前にドライランで確認してください。

## エラーハンドリング

### エラータイプ

1. **パラメータエラー**: 必須パラメータ不足
2. **OAuth2エラー**: アクセストークン取得失敗
3. **Calendar APIエラー**: イベント作成・削除失敗
4. **重複実行エラー**: 同じリクエストの再実行検出

### エラー時の動作

- エラーログを実行ログスプレッドシートに記録
- JSON形式でエラーレスポンスを返却
- メイン処理は例外をスローせず、エラーレスポンスで完了

## トラブルシューティング

### 問題1: OAuth2認証エラー

**症状**: `OAuth2アクセストークン取得失敗`

**対策**:
1. `SERVICE_ACCOUNT_JSON` スクリプトプロパティが設定されているか確認
2. サービスアカウントにドメイン全体の委任が有効か確認
3. カレンダースコープが付与されているか確認

### 問題2: イベント作成失敗

**症状**: `Calendar APIエラー: Status 400`

**対策**:
- 日時形式が正しいか確認（ISO形式またはDateオブジェクト）
- ownerEmailが有効なメールアドレスか確認
- タイムゾーンが正しいか確認（デフォルト: Asia/Tokyo）

### 問題3: 不在イベントが作成されない

**症状**: 不在イベント作成APIが失敗

**対策**:
- `eventType: 'outOfOffice'` が正しく設定されているか確認
- 終日イベントの場合、終了日は開始日の翌日を指定（Googleカレンダーの仕様）
- 不在理由（reason）が有効な値か確認（VACATION/SICK_LEAVE/OTHER）

## デプロイ

```bash
cd "gas_projects/projects/common/Appsheet_汎用_イベント作成"
clasp push --force
```

## バージョン履歴

### v1.2.0 (2025-10-27) - デプロイメント @13
- **コード最適化**
  - AuthService.jsのフォーマット整理
  - main.jsのJSDocコメント改善
  - コード可読性向上
- **テスト関数追加**
  - 新規ファイル: `test_functions.js`
  - 既存の不在イベントの終了時刻修正ツール
  - ドライランモード対応
  - 指定年月・ユーザーでの一括修正機能

### v1.1.1 (2025-10-27) - デプロイメント @12
- **不在イベントの時間範囲修正**
  - 終日イベントの終了時刻を23:59:59から翌日00:00:00に変更
  - より自然な終日イベントの表現方法に変更

### v1.1.0 (2025-10-27) - デプロイメント @11
- **不在イベントのAPI仕様準拠**
  - Google Calendar APIの仕様に完全準拠
  - `transparency: 'opaque'`を必須フィールドとして追加
  - 終日イベントでも`dateTime`フィールドを使用（`date`フィールド使用不可）
  - 00:00:00～23:59:59の時間指定で終日扱い
- **コード品質向上**
  - ヘルパー関数をプライベート化（`_`プレフィックス）
  - GASエディタの関数一覧がより見やすく
- **レスポンス確認**
  - 不在イベント作成時も正しく`{id, url}`を返却

### v1.0.0 (2025-10-16)
- 初回リリース
- 通常イベント作成・削除機能
- 不在イベント作成・削除機能
- 簡易版不在イベント作成機能
- OAuth2なりすまし認証実装
- 重複防止機能実装
- 実行ログ記録実装

## 関連ドキュメント

- [SPECIFICATIONS.md](./SPECIFICATIONS.md) - 技術仕様書
- [FLOW.md](./FLOW.md) - 処理フロー図
- [実行ログスプレッドシート](https://drive.google.com/drive/folders/16swPUizvdlyPxUjbDpVl9-VBDJZO91kX)

## ライセンス

Fractal Group Internal Use Only
