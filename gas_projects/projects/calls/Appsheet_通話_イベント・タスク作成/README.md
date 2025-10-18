# Appsheet_通話_イベント・タスク作成

## 概要

通話アクションに基づいて、Googleカレンダーイベントまたは Googleタスクを作成する統合GASプロジェクトです。

## 統合前のプロジェクト

- **Appsheet_通話_イベント作成** → アーカイブ済み
- **Appsheet_通話_タスク作成** → アーカイブ済み

## スクリプト構造（v2以降）

v2では、コードの保守性と可読性を向上させるため、役割別にスクリプトを分割しました。

### ファイル構成

```
scripts/
├── webhook.gs                   # Webhookエントリーポイント
├── action_processor.gs          # メイン処理・アクション分岐
├── google_service.gs            # Google API連携（Calendar/Tasks）
├── oauth_service.gs             # OAuth2認証サービス
├── appsheet_api.gs              # AppSheet API連携
├── test_functions.gs            # テスト関数
├── appsscript.json              # マニフェスト
└── _backup/
    └── コード_OLD.gs             # 旧統合コード（v1アーカイブ）
```

詳細は [SCRIPT_ARCHITECTURE.md](./SCRIPT_ARCHITECTURE.md) を参照してください。

## 主な機能

### v2.0の機能

- ✨ **役割別スクリプト分割**: 保守性向上のためモジュール化
- ✅ **action_typeによる自動判別**: `'event'` または `'task'` でイベント/タスクを自動選択
- ✅ **日本語パラメータ対応**: `'イベント'`/`'タスク'` も受付可能
- ✅ **Googleカレンダーイベント作成**: 開始・終了日時を指定してイベント作成
- ✅ **Googleタスク作成**: 期限日時を指定してタスク作成
- ✅ **個別引数対応**: AppSheetから個別パラメータで直接呼び出し可能
- ✅ **エラーハンドリング**: 失敗時はAppSheetにエラー詳細を記録

## パラメータ仕様

### 共通パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `actionId` | string | ✅ | アクションID |
| `actionType` | string | ✅ | `'event'`/`'イベント'` または `'task'`/`'タスク'` |
| `title` | string | ✅ | タイトル |
| `details` | string | ❌ | 詳細説明 |
| `assigneeEmail` | string | ✅ | 担当者メールアドレス |

**注意**: `actionType` は英語(`event`/`task`)または日本語(`イベント`/`タスク`)のいずれでも指定可能です。

### イベント作成用パラメータ (`actionType='event'` または `'イベント'`)

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `startDateTime` | string | ✅ | 開始日時（ISO形式、日本時間JST） |
| `endDateTime` | string | ✅ | 終了日時（ISO形式、日本時間JST） |
| `rowUrl` | string | ❌ | AppSheet行URL |

**日時形式**: `YYYY-MM-DDTHH:mm:ss+09:00` (例: `2025-10-18T10:00:00+09:00`)

### タスク作成用パラメータ (`actionType='task'` または `'タスク'`)

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `dueDateTime` | string | ✅ | 期限日時（ISO形式、日本時間JST） |

**日時形式**: `YYYY-MM-DDTHH:mm:ss+09:00` (例: `2025-10-25T17:00:00+09:00`)

## 使用例

### 例1: イベント作成（日本語パラメータ使用）

```javascript
processRequestDirect(
  "ACT-001",                    // actionId
  "イベント",                    // actionType（日本語）
  "営業ミーティング",            // title
  "顧客との打ち合わせ",          // details
  "2025-10-18T10:00:00+09:00",  // startDateTime（日本時間JST）
  "2025-10-18T11:00:00+09:00",  // endDateTime（日本時間JST）
  null,                         // dueDateTime (不要)
  "user@example.com",           // assigneeEmail
  "https://appsheet.com/row/123" // rowUrl
);
```

### 例2: タスク作成（日本語パラメータ使用）

```javascript
processRequestDirect(
  "ACT-002",                    // actionId
  "タスク",                      // actionType（日本語）
  "資料作成",                   // title
  "提案書を作成する",            // details
  null,                         // startDateTime (不要)
  null,                         // endDateTime (不要)
  "2025-10-25T17:00:00+09:00",  // dueDateTime（日本時間JST）
  "user@example.com",           // assigneeEmail
  null                          // rowUrl (不要)
);
```

### 例3: イベント作成（英語パラメータ使用）

```javascript
processRequestDirect(
  "ACT-003",                    // actionId
  "event",                      // actionType（英語）
  "営業ミーティング",            // title
  "顧客との打ち合わせ",          // details
  "2025-10-18T14:00:00+09:00",  // startDateTime（日本時間JST）
  "2025-10-18T15:00:00+09:00",  // endDateTime（日本時間JST）
  null,                         // dueDateTime (不要)
  "user@example.com",           // assigneeEmail
  "https://appsheet.com/row/456" // rowUrl
);
```

## AppSheetからの呼び出し

### Webhook設定

#### イベント作成の場合（日本語）

```json
{
  "actionId": "<<[action_id]>>",
  "actionType": "イベント",
  "title": "<<[title]>>",
  "details": "<<[details]>>",
  "startDateTime": "<<[start_datetime]>>",
  "endDateTime": "<<[end_datetime]>>",
  "assigneeEmail": "<<[assignee_email]>>",
  "rowUrl": "<<[row_url]>>"
}
```

#### イベント作成の場合（英語）

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

#### タスク作成の場合（日本語）

```json
{
  "actionId": "<<[action_id]>>",
  "actionType": "タスク",
  "title": "<<[title]>>",
  "details": "<<[details]>>",
  "dueDateTime": "<<[due_datetime]>>",
  "assigneeEmail": "<<[assignee_email]>>"
}
```

#### タスク作成の場合（英語）

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
- `actionType` は `'event'`/`'イベント'` または `'task'`/`'タスク'` のみ対応
- 日時は日本時間(JST)で `YYYY-MM-DDTHH:mm:ss+09:00` 形式で指定

## バージョン履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| v2.0 | 2025-10-17 | スクリプト役割別分割実施（詳細: [SCRIPT_ARCHITECTURE.md](./SCRIPT_ARCHITECTURE.md)） |
| v1.1 | 2025-10-17 | 日本語パラメータ対応（'イベント'/'タスク'） |
| v1.0 | 2025-10-17 | 初回リリース（イベント作成・タスク作成統合） |

## 関連プロジェクト

- [Appsheet_通話_要約生成](../Appsheet_通話_要約生成/) - 通話要約生成
- [共通モジュール](../../common_modules/) - 共通処理モジュール

## Author

Fractal Group
