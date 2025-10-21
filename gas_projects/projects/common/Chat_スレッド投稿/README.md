# Chat_スレッド投稿

Google Chatのスレッドまたはスペースにメッセージを投稿するサービス

## 概要

AppSheetまたは直接実行から、Google Chatのスレッドにメッセージを投稿します。サービスアカウントのドメイン全体委任（Domain-Wide Delegation）を使用して、指定されたユーザーになりすましてメッセージを投稿できます。

## 主な機能

- ✅ **スレッド返信**: 既存スレッドに返信投稿
- ✅ **スペース投稿**: スペースに新規スレッドを作成して投稿
- ✅ **ユーザーなりすまし**: 指定されたユーザーとして投稿
- ✅ **メッセージ整形**: HTMLの`<br>`タグを改行に自動変換
- ✅ **エラーハンドリング**: 詳細なエラーメッセージ
- ✅ **JSON形式のレスポンス**: 投稿したメッセージIDを返却

## 対応するID形式

### 1. メッセージID（スレッド返信）

```
spaces/AAAA/messages/CCCC
```

メッセージIDから自動的にスレッド名を取得して返信します。

### 2. スレッドID（直接返信）

```
spaces/AAAA/threads/BBBB
```

スレッドIDを直接指定して返信します。

### 3. スペースID（新規スレッド作成）⭐NEW

```
spaces/AAAA
```

スペースIDのみを指定すると、新しいスレッドを作成して投稿します。

## 使用方法

### 1. AppSheetからWebhook呼び出し

**リクエストボディ:**
```json
{
  "threadId": "spaces/AAAA/threads/BBBB",
  "messageText": "投稿するメッセージ",
  "userEmail": "user@example.com"
}
```

**レスポンス (成功):**
```json
{
  "status": "success",
  "messageId": "spaces/AAAA/messages/CCCC",
  "timestamp": "2025-10-21T12:34:56.789Z"
}
```

**レスポンス (エラー):**
```json
{
  "status": "error",
  "error": "エラーメッセージ",
  "timestamp": "2025-10-21T12:34:56.789Z"
}
```

### 2. GASエディタから直接実行

**既存スレッドに投稿:**
```javascript
const result = postChatMessage(
  "spaces/AAAA/threads/BBBB",  // threadId
  "テストメッセージです",        // messageText
  "user@example.com"           // userEmail
);

console.log(result.messageId);  // 投稿したメッセージのID
```

**スペースに新規スレッド作成:**
```javascript
const result = postChatMessage(
  "spaces/AAAA",              // スペースIDのみ
  "新しいスレッドです",        // messageText
  "user@example.com"          // userEmail
);
```

## パラメータ

### threadId (必須)
- **型:** String
- **説明:** スレッドID、メッセージID、またはスペースID
- **形式:**
  - スレッド: `spaces/AAAA/threads/BBBB`
  - メッセージ: `spaces/AAAA/messages/CCCC`
  - スペース: `spaces/AAAA` ⭐NEW
- **注意:** 必ず `spaces/` で始まる必要があります（`space/`は不可）

### messageText (必須)
- **型:** String
- **説明:** 投稿するメッセージ本文
- **自動変換:** `<br>`タグ → 改行、`\n` → 改行

### userEmail (必須)
- **型:** String
- **説明:** 投稿者のメールアドレス（なりすまし対象）
- **例:** `"user@example.com"`

## レスポンス

### 成功時

| フィールド | 型 | 説明 |
|----------|-----|------|
| status | String | "success"固定 |
| messageId | String | 投稿したメッセージのID |
| timestamp | String | 処理時刻 (ISO 8601) |

### エラー時

| フィールド | 型 | 説明 |
|----------|-----|------|
| status | String | "error"固定 |
| error | String | エラーメッセージ |
| timestamp | String | 処理時刻 (ISO 8601) |

## 技術仕様

### 認証方式

**サービスアカウントのドメイン全体委任（Domain-Wide Delegation）**

1. サービスアカウントのJSONキーをScript Propertiesに保存
2. OAuth2ライブラリを使用してユーザートークンを取得
3. 指定されたユーザーとして Chat API を呼び出し

### 必要なライブラリ

- **OAuth2 Library** (ID: `1B7FSrk5Zi6L1rSxxTDgDEUsPzlukNnHL`)
  - バージョン: 43

### 必要なAPI

- **Google Chat API**
  - スコープ: `https://www.googleapis.com/auth/chat.messages`
  - 高度なサービス: `Chat` (API v1)

### Script Properties設定

```javascript
SERVICE_ACCOUNT_JSON = '{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...",
  "client_id": "...",
  ...
}'
```

## スクリプトファイル構成

- [main.js](./scripts/main.js): メインロジック（Webhook・直接実行・API呼び出し）
- `appsscript.json`: プロジェクトマニフェスト（Chat API v1有効化）

## セットアップ

### 1. サービスアカウントの作成

1. GCPコンソールでサービスアカウントを作成
2. JSONキーをダウンロード
3. ドメイン全体委任を有効化

### 2. Google Workspace管理コンソール

1. セキュリティ → APIの制御 → ドメイン全体の委任
2. サービスアカウントのClient IDを追加
3. スコープ: `https://www.googleapis.com/auth/chat.messages`

### 3. GASプロジェクト設定

1. OAuth2ライブラリを追加
2. Chat API (高度なサービス) を有効化
3. Script PropertiesにSERVICE_ACCOUNT_JSONを設定

### 4. デプロイ

```bash
cd "gas_projects/projects/common/Chat_スレッド投稿"
clasp push --force
```

## テスト関数

```javascript
// テスト実行
function testPostChatMessage() {
  const threadId = "spaces/AAAA/threads/BBBB";  // または "spaces/AAAA"
  const messageText = "テスト投稿: " + new Date().toLocaleString('ja-JP');
  const userEmail = "user@example.com";

  const result = postChatMessage(threadId, messageText, userEmail);
  Logger.log(JSON.stringify(result, null, 2));
}
```

## エラーハンドリング

### よくあるエラー

1. **無効なthreadId形式**
   - エラー: `threadIdの形式が不正です（spaces/で始まる必要があります）`
   - 対処: `spaces/`で始まるIDを指定（`space/`は不可）

2. **OAuth2認証に失敗**
   - エラー: `OAuth2認証に失敗`
   - 対処: SERVICE_ACCOUNT_JSONとドメイン全体委任の設定を確認

3. **Chat API呼び出し失敗**
   - エラー: `Chat API呼び出し失敗 (403): ...`
   - 対処: ユーザーがスペースのメンバーか確認

4. **スレッド情報を取得できない**
   - エラー: `スレッド情報を取得できませんでした`
   - 対処: メッセージIDが正しいか確認、Chat API (高度なサービス) が有効か確認

## 制限事項

- **実行時間**: GAS Webhookの6分制限
- **メッセージ長**: Google Chatの制限（約4096文字）
- **投稿頻度**: レート制限に注意

## セキュリティ

- サービスアカウントのJSONキーはScript Propertiesに保存
- ユーザーなりすましは適切な権限管理の下で使用
- ドメイン全体委任のスコープは最小限に

## バージョン履歴

### v1.0.0 (2025-10-21)
- 初回リリース
- スレッド返信機能
- スペース投稿機能追加
- ユーザーなりすまし機能

## ライセンス

Fractal Group Internal Use Only
