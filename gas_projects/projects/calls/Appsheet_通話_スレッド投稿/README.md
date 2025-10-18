# Appsheet_通話_スレッド投稿

**Script ID:** 1zs7zZjmjMpWvOT6ButOcmpZ87kg7R6992Xvbx_XCI6Co-0OuIXhbDLPu

**Created:** 2025-07-21T05:19:18.187Z

**Modified:** 2025-10-17T18:04:57.640Z

**Latest Deployment:** v2 (2025-10-17T18:04:57.640Z)

## 概要

通話の質疑応答（Call_Queries）をGoogle Chatスレッドに投稿するプロジェクト。AppSheetからのWebhookを受け取り、質問と回答をフォーマットしてGoogle Chatに投稿し、投稿結果をAppSheetに書き戻します。

## 主な機能

- **Google Chatスレッド投稿**: 既存スレッドへの返信または新規スレッド作成
- **Markdown整形**: テキスト内のMarkdown記号を自動正規化
- **OAuth2認証**: サービスアカウントを使用したユーザーなりすまし認証
- **AppSheet連携**: 投稿結果（メッセージID、ステータス）を自動更新
- **実行ログ記録**: 一元化されたログスプレッドシートに記録

## 必須パラメータ

| パラメータ | 型 | 説明 | 例 |
|-----------|-----|------|-----|
| `queryId` | string | 質疑応答ID（必須） | "CQ-001" |
| `posterEmail` | string | 投稿者メールアドレス（必須） | "user@example.com" |
| `targetThreadId` または `targetSpaceId` | string | 投稿先（いずれか必須） | "spaces/XXX/threads/YYY" |
| `questionText` | string | 質問テキスト（任意） | "サービスについて教えてください" |
| `answerText` | string | 回答テキスト（任意） | "以下のサービスを提供しています..." |
| `posterName` | string | 投稿者名（任意） | "山田太郎" |
| `rowUrl` | string | AppSheet行URL（任意） | "https://www.appsheet.com/..." |

## プロジェクト構造

```
Appsheet_通話_スレッド投稿/
├── README.md                     # このファイル
├── FLOW.md                       # フロー図
├── SPECIFICATIONS.md             # 技術仕様書
├── appsscript.json              # GASマニフェスト
├── project_metadata.json        # プロジェクトメタデータ
└── scripts/                      # スクリプトファイル
    ├── webhook.gs               # メインWebhookエントリーポイント
    ├── config.gs                # 設定管理
    ├── chat_service.gs          # Google Chat API連携
    ├── appsheet_service.gs      # AppSheet API連携
    ├── auth_service.gs          # OAuth2認証
    └── logger.gs                # 実行ログ記録
```

## 設定

### スクリプトプロパティ

以下のプロパティを設定してください:

| キー | 説明 |
|------|------|
| `SERVICE_ACCOUNT_JSON` | サービスアカウントのJSON鍵 |

### AppSheet設定

`config.gs` で以下を設定:
- `APP_ID`: AppSheetアプリID
- `ACCESS_KEY`: AppSheet APIアクセスキー
- `TABLE_NAME`: 更新対象テーブル名（Call_Queries）

### OAuth2スコープ

`appsscript.json` で必要なスコープが定義されています:
- `https://www.googleapis.com/auth/chat.messages`
- `https://www.googleapis.com/auth/spreadsheets`

## 使用方法

### Webhookからの実行

AppSheetのAutomationからWebhook URLを呼び出します:

```json
{
  "queryId": "CQ-001",
  "targetThreadId": "spaces/XXX/threads/YYY",
  "questionText": "質問内容",
  "answerText": "回答内容",
  "posterName": "山田太郎",
  "posterEmail": "yamada@example.com",
  "rowUrl": "https://www.appsheet.com/start/xxx"
}
```

### GASエディタからのテスト実行

`testProcessThreadPost()` 関数を使用:

```javascript
// scripts/webhook.gs内のtestProcessThreadPost()を実行
// テストパラメータを適切に設定してから実行してください
```

## エラーハンドリング

- **投稿失敗時**: AppSheetのCall_Queriesテーブルに`status='エラー'`とエラー詳細を記録
- **重複リクエスト**: ログに記録してスキップ
- **認証エラー**: OAuth2認証エラーをログに記録

## 実行ログ

全ての実行は以下のスプレッドシートに記録されます:
- **ログフォルダーID**: `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX`

ログ形式:
- タイムスタンプ
- スクリプト名
- ステータス（成功/エラー）
- リクエストID（queryId）
- 実行時間
- 詳細情報

## デプロイ

### 方法1: deploy_unified.py（推奨）

```bash
python deploy_unified.py Appsheet_通話_スレッド投稿 "v1: 通話質疑応答スレッド投稿機能"
```

### 方法2: clasp

```bash
cd gas_projects/Appsheet_通話_スレッド投稿
clasp push
clasp deploy
```

## トラブルシューティング

### 問題: "OAuth2認証に失敗"

**解決策**:
1. `SERVICE_ACCOUNT_JSON` スクリプトプロパティが正しく設定されているか確認
2. サービスアカウントにドメイン全体の委任が設定されているか確認
3. `posterEmail` が正しいGoogle Workspaceアカウントか確認

### 問題: "Chat APIエラー: 404"

**解決策**:
1. `targetThreadId` または `targetSpaceId` が正しいか確認
2. サービスアカウントがChatスペースにアクセス権を持っているか確認

### 問題: "AppSheet API Error"

**解決策**:
1. `APP_ID` と `ACCESS_KEY` が正しいか確認
2. `queryId` が実際に存在するか確認
3. AppSheet APIの制限に達していないか確認

## 参考資料

- [Google Chat API Documentation](https://developers.google.com/chat)
- [AppSheet API Documentation](https://help.appsheet.com/en/collections/1882912-api)
- [OAuth2ライブラリ](https://github.com/googleworkspace/apps-script-oauth2)
