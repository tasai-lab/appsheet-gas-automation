# Appsheet_通話_スレッド投稿 - 技術仕様書

## 目的

通話の質疑応答（Call_Queries）をGoogle Chatスレッドに投稿し、投稿結果をAppSheetに自動記録するシステム。

## システム構成

### コンポーネント

1. **Webhook受信ハンドラ** (`webhook.gs`)
   - AppSheetからのPOSTリクエストを受信
   - JSONペイロードをパース
   - パラメータ検証

2. **Google Chat連携** (`chat_service.gs`)
   - OAuth2認証（サービスアカウント）
   - スレッド投稿（既存スレッド/新規スレッド）
   - メッセージフォーマット

3. **AppSheet連携** (`appsheet_service.gs`)
   - Call_Queriesテーブル更新
   - ステータス記録（完了/エラー）
   - エラー詳細記録

4. **実行ログモジュール** (`logger.gs`)
   - すべての処理結果を記録
   - タイムスタンプ、ステータス、エラー詳細を保存
   - スプレッドシートに集約

5. **設定管理** (`config.gs`)
   - AppSheet設定
   - Google Chat設定
   - OAuth2設定
   - ログ設定

## データモデル

### リクエストパラメータ

```typescript
interface RequestParams {
  queryId: string;              // 質疑応答ID（必須）
  targetThreadId?: string;      // スレッドID（targetSpaceIdと排他）
  targetSpaceId?: string;       // スペースID（targetThreadIdと排他）
  questionText?: string;        // 質問テキスト
  answerText?: string;          // 回答テキスト
  posterName?: string;          // 投稿者名
  posterEmail: string;          // 投稿者メールアドレス（必須）
  rowUrl?: string;              // AppSheet行URL
}
```

### レスポンス

```typescript
interface SuccessResponse {
  status: 'success';
  messageId: string;            // ChatメッセージID
}

interface ErrorResponse {
  status: 'error';
  message: string;              // エラーメッセージ
}
```

### AppSheet更新データ

```typescript
interface CallQueryUpdate {
  query_id: string;             // 質疑応答ID
  status: '完了' | 'エラー';     // ステータス
  thread_id?: string;           // ChatメッセージID（成功時）
  error_details?: string;       // エラー詳細（失敗時）
}
```

## API仕様

### Google Chat API

**エンドポイント**: `https://chat.googleapis.com/v1`

#### 既存スレッドへの返信

```
POST /spaces/{spaceId}/messages?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD

{
  "text": "メッセージ本文",
  "thread": {
    "name": "spaces/{spaceId}/threads/{threadId}"
  }
}
```

#### 新規スレッド作成

```
POST /spaces/{spaceId}/messages

{
  "text": "メッセージ本文",
  "thread": {
    "threadKey": "unique-thread-key"
  }
}
```

### AppSheet API

**エンドポイント**: `https://api.appsheet.com/api/v2/apps/{appId}/tables/{tableName}/Action`

```json
{
  "Action": "Edit",
  "Properties": {
    "Locale": "ja-JP",
    "Timezone": "Asia/Tokyo"
  },
  "Rows": [{
    "query_id": "CQ-001",
    "status": "完了",
    "thread_id": "spaces/XXX/messages/YYY"
  }]
}
```

## 処理フロー

### メインフロー

```
1. doPost(e)
   ↓
2. JSONパース & 検証
   ↓
3. processThreadPost(params)
   ↓
4. buildMessageText() - メッセージ組み立て
   ↓
5. postMessageToChat() - Chat投稿
   ├─ buildChatPayload() - ペイロード構築
   ├─ createOAuth2Service() - 認証
   └─ executeChatPost() - API実行
   ↓
6. updateQueryStatus() - AppSheet更新
   ↓
7. レスポンス返却
```

### エラーフロー

```
エラー発生
   ↓
logger.error() - ログ記録
   ↓
updateQueryStatus() - AppSheetにエラー記録
   ↓
エラーレスポンス返却
```

## OAuth2認証

### サービスアカウント設定

1. **スコープ**:
   - `https://www.googleapis.com/auth/chat.messages`

2. **ドメイン全体の委任**:
   - サービスアカウントに対して設定が必要
   - Admin SDKでユーザーになりすます

3. **スクリプトプロパティ**:
   - `SERVICE_ACCOUNT_JSON`: サービスアカウントのJSON鍵

### 認証フロー

```
createOAuth2Service(userEmail, scopes)
   ↓
OAuth2.createService()
   .setSubject(userEmail)  // ユーザーになりすまし
   .setPrivateKey()
   ↓
getAccessToken(service)
   ↓
アクセストークン取得
```

## メッセージフォーマット

### 投稿メッセージの構造

```
Q. [質問テキスト]

A. [回答テキスト]

投稿者: [投稿者名]
URL: [AppSheet行URL]
```

### Markdown正規化

- `* **` → `*`
- `**` → `*`
- `* ` → `* `（スペース正規化）

## エラーハンドリング

### エラーレベル

1. **INFO**: 情報ログ
2. **SUCCESS**: 正常終了
3. **ERROR**: エラー発生

### エラー記録

すべてのエラーは以下に記録:
- 実行ログスプレッドシート
- AppSheet Call_Queriesテーブル

エラー情報:
- エラーメッセージ
- スタックトレース
- 入力データ
- 実行時間

## パフォーマンス考慮事項

### 実行時間

- **平均実行時間**: 2-5秒
- **最大実行時間**: 6分（GAS制限）

### APIレート制限

- **Google Chat API**: 分あたり60リクエスト
- **AppSheet API**: 分あたり100リクエスト

### 最適化

- OAuth2トークンをキャッシュ
- 不要なAPI呼び出しを削減
- エラー時の早期リターン

## セキュリティ

### 認証

- サービスアカウントによるOAuth2認証
- ドメイン全体の委任を使用
- トークンはキャッシュに一時保存

### データ保護

- APIキーはスクリプトプロパティで管理
- 実行ログに機密情報を含めない
- HTTPSで全ての通信を暗号化

## 制限事項

### Google Apps Script制限

- **実行時間**: 最大6分
- **URL Fetchサイズ**: 50MB
- **同時実行**: ユーザーあたり30

### 推奨事項

- 大量データ処理は分割実行
- タイムアウト対策としてエラーハンドリングを実装
- 重複リクエストの防止（今後実装予定）

## テスト

### 単体テスト

```javascript
function testProcessThreadPost() {
  const testParams = {
    queryId: 'TEST-001',
    targetSpaceId: 'spaces/XXX',
    questionText: 'テスト質問',
    answerText: 'テスト回答',
    posterName: 'テスト太郎',
    posterEmail: 'test@example.com',
    rowUrl: 'https://www.appsheet.com/xxx'
  };

  const result = processThreadPost(testParams);
  Logger.log(result);
}
```

### 統合テスト

AppSheetから実際のWebhookを送信してテストします。

## 保守

### ログ確認

定期的に実行ログスプレッドシートを確認:
- エラー率
- 実行時間の傾向
- 投稿成功率

### アップデート手順

1. スクリプトを更新
2. バージョン作成: `python deploy_unified.py Appsheet_通話_スレッド投稿 "vX: 説明"`
3. テスト実行
4. ログで動作確認

## 付録

### 設定値

| 項目 | 値 |
|------|-----|
| スクリプト名 | Appsheet_通話_スレッド投稿 |
| AppSheet APP_ID | 4762f34f-3dbc-4fca-9f84-5b6e809c3f5f |
| AppSheetテーブル名 | Call_Queries |
| ログフォルダーID | 16swPUizvdlyPxUjbDpVl9-VBDJZO91kX |

### 関連リソース

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [Google Chat API Documentation](https://developers.google.com/chat)
- [AppSheet API Documentation](https://help.appsheet.com/en/collections/1882912-api)
- [OAuth2ライブラリ](https://github.com/googleworkspace/apps-script-oauth2)
