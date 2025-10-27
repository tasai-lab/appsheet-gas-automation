# Firebase設定ガイド

**作成日**: 2025-10-27
**対象**: Firebase統合（GCPプロジェクト: fractal-ecosystem）

---

## 概要

このガイドは、Firebase Consoleから設定情報を取得し、環境変数に設定する手順を説明します。

---

## 前提条件

✅ FirebaseがGCPプロジェクト（fractal-ecosystem）に統合済み
✅ Firebase Admin SDKが初期化済み（Application Default Credentials使用）

---

## 手順

### Step 1: Firebase Consoleにアクセス

1. https://console.firebase.google.com/ にアクセス
2. プロジェクト「fractal-ecosystem」を選択

### Step 2: Authentication有効化

1. 左メニューから「Authentication」を選択
2. 「始める」をクリック
3. 「Sign-in method」タブを選択
4. 「Google」プロバイダーを有効化
   - ステータスを「有効」に変更
   - プロジェクトのサポートメールを選択
   - 「保存」をクリック

### Step 3: 承認済みドメイン追加

1. 「Authentication」 > 「Settings」 > 「Authorized domains」
2. デフォルトで以下が追加されています:
   - `localhost`
   - `fractal-ecosystem.firebaseapp.com`
3. 本番環境ドメインがある場合は追加:
   - 例: `your-production-domain.com`

### Step 4: Web App設定取得

1. 左メニューから「Project Settings」（歯車アイコン）を選択
2. 「全般」タブを選択
3. 「マイアプリ」セクションまでスクロール
4. 「</> Web」アイコンをクリック（既にアプリがある場合はスキップ）
5. アプリ名を入力（例: "RAG Frontend"）
6. 「Firebase Hosting」は不要なのでチェックを外す
7. 「アプリを登録」をクリック

### Step 5: 設定情報コピー

「SDK の設定と構成」セクションに表示される設定をコピー:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "fractal-ecosystem.firebaseapp.com",
  projectId: "fractal-ecosystem",
  storageBucket: "fractal-ecosystem.appspot.com",
  messagingSenderId: "411046620715",
  appId: "1:411046620715:web:..."
};
```

### Step 6: Frontend環境変数設定

`frontend/.env.local` ファイルに以下を追加:

```bash
# Firebase設定
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=fractal-ecosystem.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=fractal-ecosystem
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=fractal-ecosystem.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=411046620715
NEXT_PUBLIC_FIREBASE_APP_ID=1:411046620715:web:...
```

**重要**:
- `NEXT_PUBLIC_` プレフィックスが必要です
- `.env.local` は Git 除外されています（機密情報保護）

---

## 確認

### 1. Frontend再起動

```bash
# frontend ディレクトリで
npm run dev
```

### 2. ブラウザで確認

http://localhost:3000 にアクセスして、ログインボタンが表示されることを確認

### 3. ログインテスト

1. 「Googleでログイン」をクリック
2. Googleアカウントを選択
3. ログイン成功を確認

---

## トラブルシューティング

### 問題: "Firebase App named '[DEFAULT]' already exists"

**原因**: Firebaseが複数回初期化されている

**解決策**: ページをリロード（開発環境では Hot Reload の問題）

### 問題: "auth/unauthorized-domain"

**原因**: 使用しているドメインが承認済みドメインに追加されていない

**解決策**:
1. Firebase Console > Authentication > Settings > Authorized domains
2. ドメインを追加

### 問題: "Invalid API key"

**原因**: `.env.local` の設定が間違っている

**解決策**:
1. Firebase Console で設定を再確認
2. `.env.local` を修正
3. `npm run dev` を再起動

---

## Backend設定（オプション）

現在、Backend は Application Default Credentials を使用しているため、追加設定は不要です。

本番環境（Cloud Run）では、サービスアカウント認証情報が自動的に使用されます。

---

## 段階的ロールアウト

### Phase 1: 認証オプショナル（現在）

```bash
# backend/.env
REQUIRE_AUTHENTICATION=false
```

- 認証なしでもAPI使用可能
- ログイン機能は利用可能だが必須ではない

### Phase 2: 認証必須

```bash
# backend/.env
REQUIRE_AUTHENTICATION=true
```

- 全てのAPIエンドポイントで認証が必須
- ログインしていないユーザーは401エラー

---

## 次のステップ

1. ✅ Firebase Console設定完了
2. ✅ 環境変数設定完了
3. ⏭️ ログインUIテスト
4. ⏭️ 認証フロー確認
5. ⏭️ 本番環境デプロイ

---

**最終更新**: 2025-10-27
**作成者**: Claude Code
