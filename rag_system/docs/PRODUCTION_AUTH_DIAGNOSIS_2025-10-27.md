# 本番環境認証問題の診断レポート

**日時**: 2025-10-27
**問題**: チャット応答が表示されず、履歴にも記録されない
**ステータス**: 調査完了・デバッグロギング追加済み

---

## 📊 問題の症状

ユーザーから報告された症状:
- チャットメッセージを送信しても回答が表示されない
- チャット履歴にも記録が残らない
- ブラウザコンソールには以下のログが表示:

```
[ClientsContext] 利用者一覧取得成功: 39件
[ChatContainer] メッセージ送信開始
[ChatContainer] ストリーム取得完了、ループ開始
[API] streamChatMessage 開始
[API] Response status: 200 OK
[API] ストリーム読み込み開始
[API] ストリーム完了
[API] Reader released
[ChatContainer] for-await ループ終了
```

**注目点**: "Response status: 200 OK" と表示されているが、実際にはコンテンツが返されていない

---

## 🔍 調査結果

### 1. Backend認証設定の確認

**Cloud Run環境変数:**
```bash
REQUIRE_AUTHENTICATION=True
```

**Backend設定 (`backend/app/config.py`):**
```python
require_authentication: bool = True  # 認証必須
```

**結論**: ✅ Backendは認証を必須としている

### 2. 認証ミドルウェアの動作確認

**Backend認証フロー (`backend/app/middleware/auth.py`):**
1. Authorizationヘッダーの確認
2. "Bearer <token>" 形式のチェック
3. Firebase ID Token の検証
4. 検証失敗時は `401 Unauthorized` を返す

**curlテスト結果:**
```bash
$ curl -X POST https://rag-backend-411046620715.us-central1.run.app/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"message":"テスト","client_id":"CL-00001","context_size":1}'

HTTP/2 401
{"detail":"Authorization header missing"}
```

**結論**: ✅ Backend認証は正常に機能している

### 3. Frontend認証フローの確認

**トークン取得 (`frontend/src/contexts/AuthContext.tsx` L64-72):**
```typescript
const getIdToken = async (): Promise<string | null> => {
  if (!user) return null;  // ⚠️ ユーザーが未ログインの場合nullを返す
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('❌ トークン取得エラー:', error);
    return null;
  }
};
```

**API呼び出し (`frontend/src/lib/api.ts` L107):**
```typescript
const token = await getIdToken();
// tokenがnullの場合、Authorizationヘッダーが送信されない
```

**結論**: ⚠️ ユーザーが未ログイン、またはトークン取得に失敗している可能性が高い

### 4. Firebase設定の確認

**Frontend環境変数 (`.env.production`):**
```
NEXT_PUBLIC_API_URL=https://rag-backend-411046620715.us-central1.run.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=fractal-ecosystem
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=fractal-ecosystem.firebaseapp.com
```

**Backend Firebase Admin SDK:**
- プロジェクト: `fractal-ecosystem`
- サービスアカウント: 環境変数から読み込み

**結論**: ✅ Firebase設定は一致している

### 5. CORS設定の確認

**Backend CORS設定 (`backend/app/config.py` L41-49):**
```python
cors_origins: list[str] = [
    "http://localhost:3000",
    "https://rag-frontend.vercel.app",
    "https://fractal-ecosystem.web.app",  # ✅ 本番フロントエンド
    "https://fractal-ecosystem.firebaseapp.com"
]
cors_credentials: bool = True  # ✅ 認証情報の送信を許可
```

**結論**: ✅ CORS設定は正しい

---

## 🎯 根本原因の特定

### 最も可能性の高い原因

**仮説1: ユーザーが未ログイン状態でチャットを使用している**

証拠:
- `getIdToken()` は `user` が null の場合に null を返す
- Authorization ヘッダーなしでリクエストを送信
- Backend が 401 を返す
- しかし、ユーザーのコンソールログには "200 OK" と表示

矛盾点の説明:
- "200 OK" ログは **CORS preflight OPTIONS リクエスト** の可能性
- 実際の POST リクエストは 401 エラーだが、エラーハンドリングで適切にキャッチされていない可能性
- または、ログが古く、以前に認証が無効だった時のもの

**仮説2: トークンが期限切れ**

証拠:
- Firebase ID Token は1時間で期限切れ
- ユーザーが長時間ページを開いたままにしている場合、トークンが期限切れになる
- `getIdToken()` は期限切れのトークンを自動更新するが、失敗する可能性がある

**仮説3: エラーハンドリングの問題**

証拠:
- ユーザーのコンソールログにエラーメッセージが表示されていない
- `api.ts` の古いバージョンでは401エラーの詳細ログがなかった
- エラーが適切にユーザーに伝わっていない可能性

---

## 🛠️ 実施した対策

### 1. デバッグロギングの追加

**変更ファイル:** `frontend/src/lib/api.ts` (L43-87)

**追加したログ:**
```typescript
// 開始ログ（トークンの有無を確認）
console.log("[API] streamChatMessage 開始", {
  request,
  apiUrl: API_URL,
  hasToken: !!token  // ⭐ トークンの有無を確認
});

// Authorization ヘッダー追加時のログ
if (token) {
  console.log("[API] Authorization header added");  // ⭐ トークン送信確認
  headers["Authorization"] = `Bearer ${token}`;
} else {
  console.warn("[API] ⚠️ No authentication token provided");  // ⚠️ トークンなし警告
}

// レスポンスステータスログ
console.log("[API] Response status:", response.status, response.statusText);

// エラー時の詳細ログ
if (!response.ok) {
  let errorDetail = response.statusText;
  try {
    const errorData = await response.json();
    errorDetail = errorData.detail || errorDetail;  // ⭐ サーバーエラー詳細
  } catch {
    // JSON parse error, use statusText
  }
  const errorMessage = `Stream API error (${response.status}): ${errorDetail}`;
  console.error("[API]", errorMessage);

  if (response.status === 401) {
    console.error("[API] ❌ 認証エラー: トークンが無効または期限切れです");  // ⭐ 401専用エラー
  }

  throw new Error(errorMessage);
}
```

### 2. Frontend再デプロイ

**実行コマンド:**
```bash
cd frontend
npm run build  # ✓ Compiled successfully
cd ..
firebase deploy --only hosting  # ✔ Deploy complete!
```

**デプロイ先:** `https://fractal-ecosystem.web.app`

**デプロイ時刻:** 2025-10-27 17:40頃

---

## 📋 次のステップ

### ユーザーが行うべきテスト手順

1. **ブラウザのキャッシュクリア**
   - Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
   - または、シークレットウィンドウで開く

2. **サイトにアクセス**
   - URL: https://fractal-ecosystem.web.app

3. **Googleでログイン**
   - 右上の「ログイン」ボタンをクリック
   - Googleアカウントでログイン
   - ログイン成功後、ユーザー名が表示されることを確認

4. **チャットメッセージを送信**
   - 任意のメッセージを入力して送信

5. **ブラウザコンソールを確認**
   - F12 を押して開発者ツールを開く
   - Console タブを選択
   - 以下のログを確認し、結果を報告

### 期待されるログ出力パターン

#### ✅ **ケース1: 正常動作（ログイン済み）**
```
[API] streamChatMessage 開始 { hasToken: true }
[API] Authorization header added
[API] Response status: 200 OK
[API] ストリーム読み込み開始
[API] Chunk #1: text
[API] Chunk #2: text
...
[API] Chunk #N: done
[API] ストリーム完了 { totalChunks: N }
```

#### ❌ **ケース2: 未ログイン**
```
[API] streamChatMessage 開始 { hasToken: false }
[API] ⚠️ No authentication token provided
[API] Response status: 401 Unauthorized
[API] Stream API error (401): Authorization header missing
[API] ❌ 認証エラー: トークンが無効または期限切れです
```

#### ⚠️ **ケース3: トークン期限切れ**
```
[API] streamChatMessage 開始 { hasToken: true }
[API] Authorization header added
[API] Response status: 401 Unauthorized
[API] Stream API error (401): Token expired
[API] ❌ 認証エラー: トークンが無効または期限切れです
```

---

## 🔧 さらなるトラブルシューティング

### ケース1: "⚠️ No authentication token provided" が表示される場合

**原因:** ユーザーがログインしていない、またはログインに失敗している

**対処法:**
1. ログイン画面でGoogleログインを実行
2. ログイン後、ページをリロード
3. 再度テスト

### ケース2: "Authorization header added" が表示されるが 401 エラーが返る場合

**原因:** トークンが無効または期限切れ

**対処法:**
1. 一度ログアウト
2. 再度ログイン（新しいトークンを取得）
3. 再度テスト

### ケース3: 依然として "200 OK" だが応答がない場合

**原因:** ブラウザキャッシュ、Service Worker、またはその他の問題

**対処法:**
1. ブラウザのキャッシュを完全にクリア
2. Service Worker を無効化:
   - Application タブ > Service Workers > "Unregister"
3. シークレットウィンドウで再テスト

---

## 📊 技術的な補足情報

### Firebase ID Token の仕様

- **有効期限:** 1時間
- **自動更新:** `getIdToken()` は必要に応じて自動更新を試みる
- **失敗時:** `null` を返す（エラーログに記録）

### Backend認証フロー

1. `verify_firebase_token()` が `Depends` として実行される
2. Authorization ヘッダーをチェック
3. "Bearer <token>" 形式を検証
4. Firebase Admin SDK で ID Token を検証
5. 検証成功: `decoded_token` を返す（uid, email 等）
6. 検証失敗: `HTTPException(401)` を raise

### CORS Preflight の影響

- ブラウザは POST リクエスト前に OPTIONS リクエストを送信
- OPTIONS リクエストは認証なしで 200 OK を返す可能性がある
- ユーザーのログに "200 OK" が表示されるのはこれが原因の可能性

---

## 🎉 期待される結果

デバッグロギングにより、以下が明確になるはず:
1. ✅ トークンが取得できているか (`hasToken: true/false`)
2. ✅ Authorization ヘッダーが送信されているか
3. ✅ Backend からの正確なエラーメッセージ
4. ✅ 401 エラーの具体的な理由（missing / expired / invalid）

この情報をもとに、正確な修正策を実施できます。

---

## 📝 関連ファイル

- `frontend/src/lib/api.ts` - デバッグロギング追加
- `frontend/src/contexts/AuthContext.tsx` - 認証コンテキスト
- `backend/app/middleware/auth.py` - 認証ミドルウェア
- `backend/app/config.py` - Backend設定
- `backend/.env` - 環境変数（ローカル）

---

**作成者:** Claude Code
**最終更新:** 2025-10-27
