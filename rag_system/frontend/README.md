# RAG Medical Assistant Frontend

医療・看護記録検索 & チャットアシスタントのフロントエンドアプリケーション

## 技術スタック

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API**: SSE (Server-Sent Events) Streaming
- **Deployment**: Vercel

## 機能

- リアルタイムストリーミングチャット
- Hybrid Search (BM25 + Dense Retrieval + Vertex AI Ranking)
- コンテキスト表示（検索結果）
- ダークモード対応
- レスポンシブデザイン

## ローカル開発

### 前提条件

- Node.js 20.x以上
- npm または yarn

### セットアップ

```bash
# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env.local
# .env.localを編集してBackend API URLを設定

# 開発サーバーを起動
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

### ビルド

```bash
npm run build
npm start
```

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://rag-backend-411046620715.asia-northeast1.run.app` |

## Vercelデプロイ

### 1. Vercel CLIをインストール

```bash
npm install -g vercel
```

### 2. Vercelにログイン

```bash
vercel login
```

### 3. プロジェクトをデプロイ

```bash
cd rag_system/frontend
vercel
```

初回デプロイ時は以下の質問に答えます:

- Set up and deploy "~/rag_system/frontend"? `y`
- Which scope do you want to deploy to? `<your-account>`
- Link to existing project? `n`
- What's your project's name? `rag-medical-assistant`
- In which directory is your code located? `./`

### 4. 環境変数を設定

Vercelダッシュボードで環境変数を設定:

- `NEXT_PUBLIC_API_URL` = `https://rag-backend-411046620715.asia-northeast1.run.app`

または、CLIで設定:

```bash
vercel env add NEXT_PUBLIC_API_URL production
# 値を入力: https://rag-backend-411046620715.asia-northeast1.run.app
```

### 5. 本番デプロイ

```bash
vercel --prod
```

## プロジェクト構造

```
frontend/
├── src/
│   ├── app/              # App Router
│   │   ├── layout.tsx    # ルートレイアウト
│   │   ├── page.tsx      # ホームページ
│   │   └── globals.css   # グローバルスタイル
│   ├── components/       # Reactコンポーネント
│   │   ├── ChatContainer.tsx    # メインチャットコンテナ
│   │   ├── MessageList.tsx      # メッセージリスト
│   │   ├── Message.tsx          # メッセージコンポーネント
│   │   ├── MessageInput.tsx     # メッセージ入力
│   │   └── Context.tsx          # コンテキスト表示
│   ├── lib/              # ユーティリティ
│   │   └── api.ts        # API クライアント
│   └── types/            # TypeScript型定義
│       └── chat.ts       # チャット型定義
├── public/               # 静的ファイル
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
└── vercel.json          # Vercel設定
```

## API統合

### エンドポイント

- `POST /chat/stream` - SSEストリーミングチャット
- `POST /chat` - 非ストリーミングチャット（バックアップ用）
- `GET /health` - ヘルスチェック

### SSEストリーミング形式

```typescript
// Context chunk
{
  "type": "context",
  "context": [...]
}

// Text chunk
{
  "type": "text",
  "content": "生成されたテキスト"
}

// Done chunk
{
  "type": "done",
  "suggested_terms": [...]
}

// Error chunk
{
  "type": "error",
  "error": "エラーメッセージ"
}
```

## トラブルシューティング

### ビルドエラー

```bash
# node_modulesを削除して再インストール
rm -rf node_modules
npm install
npm run build
```

### 型エラー

```bash
# 型チェックのみ実行
npx tsc --noEmit
```

### SSEストリーミングが動作しない

- ブラウザコンソールでネットワークエラーを確認
- Backend API URLが正しいか確認
- CORSが有効になっているか確認

## ライセンス

MIT
