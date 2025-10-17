# Appsheet_通話_イベント・タスク作成

## 概要

通話アクションに基づいて、Googleカレンダーイベントまたは Googleタスクを作成する統合GASプロジェクトです。

## 統合前のプロジェクト

- **Appsheet_通話_イベント作成** → アーカイブ済み
- **Appsheet_通話_タスク作成** → アーカイブ済み

## 主な機能

### v1.0.0の機能

- ✅ **action_typeによる自動判別**: `'event'` または `'task'` でイベント/タスクを自動選択
- ✅ **Googleカレンダーイベント作成**: 開始・終了日時を指定してイベント作成
- ✅ **Googleタスク作成**: 期限日時を指定してタスク作成
- ✅ **個別引数対応**: AppSheetから個別パラメータで直接呼び出し可能
- ✅ **エラーハンドリング**: 失敗時はAppSheetにエラー詳細を記録

## パラメータ仕様

### 共通パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `actionId` | string | ✅ | アクションID |
| `actionType` | string | ✅ | `'event'` or `'task'` (または `'イベント'` or `'タスク'`) |
| `title` | string | ✅ | タイトル |
| `details` | string | ❌ | 詳細説明 |
| `assigneeEmail` | string | ✅ | 担当者メールアドレス |

### イベント作成用パラメータ (`actionType='event'`)

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `startDateTime` | string | ✅ | 開始日時（ISO形式） |
| `endDateTime` | string | ✅ | 終了日時（ISO形式） |
| `rowUrl` | string | ❌ | AppSheet行URL |

### タスク作成用パラメータ (`actionType='task'`)

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `dueDateTime` | string | ✅ | 期限日時（ISO形式） |

## 使用例

### 例1: イベント作成

```javascript
processRequestDirect(
  "ACT-001",                    // actionId
  "event",                      // actionType
  "営業ミーティング",            // title
  "顧客との打ち合わせ",          // details
  "2025-10-18T10:00:00+09:00",  // startDateTime
  "2025-10-18T11:00:00+09:00",  // endDateTime
  null,                         // dueDateTime (不要)
  "user@example.com",           // assigneeEmail
  "https://appsheet.com/row/123" // rowUrl
);
```

### 例2: タスク作成

```javascript
processRequestDirect(
  "ACT-002",                    // actionId
  "task",                       // actionType
  "資料作成",                   // title
  "提案書を作成する",            // details
  null,                         // startDateTime (不要)
  null,                         // endDateTime (不要)
  "2025-10-25T17:00:00+09:00",  // dueDateTime
  "user@example.com",           // assigneeEmail
  null                          // rowUrl (不要)
);
```

## AppSheetからの呼び出し

### Webhook設定

#### イベント作成の場合

```json
{
  "actionId": "<<[action_id]>>",
  "actionType": "event",
  "title": "<<[title]>>",
  "details": "<<[details]>>",
  "startDateTime": "<<[start_datetime]>>",
  "endDateTime": "<<[end_datetime]>>",
  "assigneeEmail": "<<[assignee_email]>>",
  "rowUrl": "<<[row_url]>>"
}
```

#### タスク作成の場合

```json
{
  "actionId": "<<[action_id]>>",
  "actionType": "task",
  "title": "<<[title]>>",
  "details": "<<[details]>>",
  "dueDateTime": "<<[due_datetime]>>",
  "assigneeEmail": "<<[assignee_email]>>"
}
```

## レスポンス形式

### 成功時

```json
{
  "success": true,
  "actionId": "ACT-001",
  "actionType": "event",
  "externalId": "abc123xyz",
  "externalUrl": "https://calendar.google.com/..."
}
```

### 失敗時

```json
{
  "success": false,
  "actionId": "ACT-001",
  "error": "エラーメッセージ"
}
```

## 設定

### スクリプトプロパティ

- `SERVICE_ACCOUNT_JSON`: サービスアカウントのJSONキー

### OAuth2スコープ

- `https://www.googleapis.com/auth/calendar` - カレンダーイベント作成
- `https://www.googleapis.com/auth/tasks` - タスク作成
- `https://www.googleapis.com/auth/script.external_request` - 外部API呼び出し

## テスト

### テスト関数

- `testProcessRequestEvent()` - イベント作成テスト
- `testProcessRequestTask()` - タスク作成テスト

GASエディタから実行してテストできます。

## トラブルシューティング

### 問題1: 認証エラー

**症状**: OAuth2アクセストークン取得失敗

**対策**:
1. `SERVICE_ACCOUNT_JSON` スクリプトプロパティが設定されているか確認
2. サービスアカウントにドメイン全体の委任が有効か確認
3. 必要なスコープが付与されているか確認

### 問題2: パラメータエラー

**症状**: 必須パラメータが不足

**対策**:
- イベント作成: `startDateTime`, `endDateTime` が必須
- タスク作成: `dueDateTime` が必須
- `actionType` は `'event'` または `'task'` のみ対応

## バージョン履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| v1.0.0 | 2025-10-17 | 初回リリース（イベント作成・タスク作成統合） |

## 関連プロジェクト

- [Appsheet_通話_要約生成](../Appsheet_通話_要約生成/) - 通話要約生成
- [共通モジュール](../../common_modules/) - 共通処理モジュール

## Author

Fractal Group
