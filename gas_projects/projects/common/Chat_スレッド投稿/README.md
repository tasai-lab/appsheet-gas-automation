# Chat_スレッド投稿

Google Chatのスレッドまたはスペースにメッセージを投稿するサービス

## 概要

AppSheetまたは直接実行から、Google Chatのスレッドにメッセージを投稿します。サービスアカウントのドメイン全体委任（Domain-Wide Delegation）を使用して、指定されたユーザーになりすましてメッセージを投稿できます。

## 主な機能

- ✅ **スレッド返信**: 既存スレッドに返信投稿
- ✅ **スペース投稿**: スペースに新規スレッドを作成して投稿
- ✅ **メッセージ更新**: 既存メッセージのテキストを更新 ⭐NEW
- ✅ **ユーザーなりすまし**: 指定されたユーザーとして投稿
- ✅ **マークダウン自動変換**: 標準マークダウンをGoogle Chat形式に自動変換
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

## マークダウン自動変換 ⭐NEW

標準マークダウン形式で記述されたメッセージを、Google Chat形式に自動変換します。

### 変換ルール

| 標準マークダウン | Google Chat形式 | 説明 |
|---------------|----------------|------|
| `**太字**` | `*太字*` | 太字 |
| `*斜体*` | `_斜体_` | 斜体 |
| `~~打ち消し~~` | `~打ち消し~` | 打ち消し線 |
| `[テキスト](URL)` | `<URL\|テキスト>` | リンク |
| `` `コード` `` | `` `コード` `` | インラインコード（変換なし） |
| ` ```コード``` ` | ` ```コード``` ` | コードブロック（変換なし） |

### 使用例

**入力（標準マークダウン）:**
```
これは**重要**な*お知らせ*です。
詳細は[こちら](https://example.com)を確認してください。
```

**出力（Google Chat形式）:**
```
これは*重要*な_お知らせ_です。
詳細は<https://example.com|こちら>を確認してください。
```

### 注意事項

- コードブロック内およびインラインコード内のマークダウン記法は変換されません
- 変換は自動的に行われるため、特別な設定は不要です
- 既にGoogle Chat形式で記述されている場合も安全に処理されます

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

**既存メッセージを更新:** ⭐NEW
```javascript
const result = updateChatMessage(
  "spaces/AAAA/messages/CCCC",  // messageId（更新対象）
  "更新されたメッセージです",    // newMessageText
  "user@example.com"           // userEmail（元の投稿者と同じ）
);

console.log(result.messageId);  // 更新されたメッセージのID
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
  - スコープ: `https://www.googleapis.com/auth/chat.messages.readonly`
  - **注:** v1.1以降、REST APIを直接使用（高度なサービス不要）

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
2. GCPでGoogle Chat APIを有効化
3. Script PropertiesにSERVICE_ACCOUNT_JSONを設定

### 4. デプロイ

```bash
cd "gas_projects/projects/common/Chat_スレッド投稿"
clasp push --force
```

## テスト関数

### メッセージ投稿テスト

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

### メッセージ更新テスト ⭐NEW

```javascript
// メッセージ更新のテスト実行
function testUpdateChatMessage() {
  const messageId = "spaces/AAAA/messages/CCCC";  // 更新対象のメッセージID
  const newMessageText = "メッセージを更新しました: " + new Date().toLocaleString('ja-JP');
  const userEmail = "user@example.com";  // 元の投稿者と同じメールアドレス

  const result = updateChatMessage(messageId, newMessageText, userEmail);
  Logger.log(JSON.stringify(result, null, 2));
}
```

GASエディタから`testUpdateChatMessage()`を実行すると、指定したメッセージが更新されます。

**注意事項:**
- メッセージIDは `spaces/xxx/messages/xxx` の形式である必要があります
- 更新者のメールアドレスは元の投稿者と同じである必要があります
- マークダウン自動変換が適用されます

### マークダウン変換テスト

```javascript
// マークダウン変換のテスト実行
function testMarkdownConversion() {
  const result = testMarkdownConversion();
  Logger.log(`テスト結果: ${result.passCount}件成功, ${result.failCount}件失敗`);
}
```

GASエディタから`testMarkdownConversion()`を実行すると、以下のテストケースが自動的に検証されます：
- 太字変換
- 斜体変換
- 打ち消し線変換
- リンク変換
- 複合変換
- コードブロック保護

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
   - 対処: メッセージIDが正しいか確認、GCPでChat APIが有効か確認

## 制限事項

- **実行時間**: GAS Webhookの6分制限
- **メッセージ長**: Google Chatの制限（約4096文字）
- **投稿頻度**: レート制限に注意

## セキュリティ

- サービスアカウントのJSONキーはScript Propertiesに保存
- ユーザーなりすましは適切な権限管理の下で使用
- ドメイン全体委任のスコープは最小限に

## バージョン履歴

### v1.3.0 (2025-10-22)
- ✅ **メッセージ更新機能追加**: `updateChatMessage()` 関数を実装
  - 既存メッセージのテキストを更新可能
  - Chat API の PATCH メソッドを使用
  - マークダウン自動変換にも対応
- ✅ **テスト関数追加**: `testUpdateChatMessage()` でメッセージ更新のテストが可能
- ✅ **ドキュメント更新**: README にメッセージ更新の使用例を追加

### v1.2.0 (2025-10-22)
- ✅ **マークダウン自動変換**: 標準マークダウンをGoogle Chat形式に自動変換
  - `**太字**` → `*太字*`
  - `*斜体*` → `_斜体_`
  - `~~打ち消し~~` → `~打ち消し~`
  - `[テキスト](URL)` → `<URL|テキスト>`
- ✅ **コード保護**: コードブロック内のマークダウンは変換されない
- ✅ **テスト関数追加**: `testMarkdownConversion()`で変換テストが可能

### v1.1.0 (2025-10-22)
- ✅ **REST API移行**: Chat高度なサービスから REST API へ完全移行
- ✅ **デバッグログ追加**: 全関数に詳細なデバッグログを追加
- ✅ **認証改善**: `ScriptApp.getOAuthToken()`を使用
- ✅ **エラー解決**: "Google Chat app not found" エラーを修正

### v1.0.0 (2025-10-21)
- 初回リリース
- スレッド返信機能
- スペース投稿機能追加
- ユーザーなりすまし機能

## ライセンス

Fractal Group Internal Use Only
