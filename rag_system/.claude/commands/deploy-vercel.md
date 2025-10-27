# Vercel デプロイ

Next.js Frontend を Vercel にデプロイする。

## 前提条件

- Vercel アカウント作成済み
- Vercel CLI インストール済み (`npm install -g vercel`)
- GitHub リポジトリと連携済み（オプション）

## デプロイ方法

### 方法1: Vercel CLI (推奨)

```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system/frontend

# 初回: Vercel プロジェクト初期化
vercel login
vercel

# デプロイ（本番環境）
vercel --prod

# デプロイ（プレビュー環境）
vercel
```

### 方法2: GitHub連携（自動デプロイ）

1. **Vercel Dashboard** にアクセス
2. **Import Git Repository** をクリック
3. リポジトリ選択: `appsheet-gas-automation`
4. **Root Directory**: `rag_system/frontend` を指定
5. **Framework Preset**: Next.js を選択
6. **Environment Variables** を設定（下記参照）
7. **Deploy** をクリック

### 方法3: Vercel Dashboard（手動）

1. **Vercel Dashboard** → **Add New Project**
2. **Import from Git** or **Deploy from URL**
3. 設定を入力してデプロイ

## 環境変数設定

### Vercel Dashboard で設定

**必須環境変数**:

```env
# Backend API URL（Cloud Run URL）
NEXT_PUBLIC_API_URL=https://rag-backend-xxx.run.app

# アプリ名（オプション）
NEXT_PUBLIC_APP_NAME=F Assistant
```

### Vercel CLI で設定

```bash
# 環境変数追加
vercel env add NEXT_PUBLIC_API_URL production
# 値を入力: https://rag-backend-xxx.run.app

# 環境変数確認
vercel env ls
```

## ビルド設定

### vercel.json

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // 環境変数検証
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },

  // 画像最適化
  images: {
    domains: [],
  },
};

module.exports = nextConfig;
```

## デプロイ前チェックリスト

- [ ] Backend (Cloud Run) デプロイ済み
- [ ] Backend URL取得済み
- [ ] 環境変数設定済み
- [ ] ローカルでビルド成功確認: `npm run build`
- [ ] テスト成功確認: `npm test`
- [ ] TypeScriptエラーなし: `npm run type-check`
- [ ] Lintエラーなし: `npm run lint`

## デプロイ確認

### 1. ビルドログ確認

Vercel Dashboard → **Deployments** → 最新デプロイ → **Logs**

**成功例**:
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Creating an optimized production build
✓ Build completed
```

### 2. 本番環境確認

```bash
# デプロイURL取得
vercel ls

# ブラウザで確認
open https://rag-frontend-xxx.vercel.app
```

### 3. 動作確認

- [ ] トップページが表示される
- [ ] サイドバーが表示される
- [ ] チャット入力フォームが表示される
- [ ] テーマ切替ボタンが動作する
- [ ] Backend APIに接続できる（メッセージ送信テスト）
- [ ] SSEストリーミングが動作する
- [ ] モバイル表示が適切

### 4. パフォーマンス確認

```bash
# Lighthouse スコア確認
npx lighthouse https://rag-frontend-xxx.vercel.app --view
```

**目標スコア**:
- Performance: 90以上
- Accessibility: 95以上
- Best Practices: 100
- SEO: 100

## カスタムドメイン設定

### Vercel Dashboard

1. **Settings** → **Domains**
2. **Add Domain** をクリック
3. ドメイン名入力（例: `rag.fractal-group.co.jp`）
4. DNS設定を更新
   - Aレコード: `76.76.21.21`
   - CNAMEレコード: `cname.vercel-dns.com`

### ドメイン確認

```bash
# DNS伝播確認
nslookup rag.fractal-group.co.jp

# SSL証明書確認
curl -I https://rag.fractal-group.co.jp
```

## ロールバック

### 前バージョンに戻す

```bash
# デプロイ履歴確認
vercel ls

# 特定バージョンにロールバック
vercel rollback https://rag-frontend-xxx-git-abc123.vercel.app
```

### Vercel Dashboard

1. **Deployments** → 過去のデプロイを選択
2. **Promote to Production** をクリック

## トラブルシューティング

### ビルドエラー

```bash
# ローカルでビルドテスト
npm run build

# エラー詳細確認
npm run build -- --debug
```

### 環境変数未設定エラー

```bash
# 環境変数確認
vercel env ls

# 再設定
vercel env add NEXT_PUBLIC_API_URL production
```

### Backend接続エラー

```bash
# Backend URLが正しいか確認
curl https://rag-backend-xxx.run.app/health

# CORS設定確認（Backend側）
# backend/app/main.py で origins設定
```

### ハイドレーションエラー

```typescript
// ThemeContextを確認
// mounted状態を正しく使用しているか確認
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

if (!mounted) return null;  // サーバーサイドでは何も描画しない
```

## デプロイ後の監視

### Vercel Analytics

```bash
# Analyticsダッシュボード確認
# Vercel Dashboard → Analytics
```

**監視項目**:
- ページビュー
- ユニークビジター
- Core Web Vitals
- エラー率

### Vercel Logs

```bash
# リアルタイムログ確認
vercel logs https://rag-frontend-xxx.vercel.app --follow
```

---

**最終更新**: 2025-10-27
