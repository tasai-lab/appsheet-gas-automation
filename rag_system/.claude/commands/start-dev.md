# ローカル開発環境起動

Backend (FastAPI) と Frontend (Next.js) を同時に起動する。

## 前提条件

- Python 3.11以上がインストール済み
- Node.js 18以上がインストール済み
- 依存パッケージがインストール済み

## 実行手順

### 1. Backend起動（ポート8000）

```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system/backend

# 環境変数読み込み（.envファイルが存在する場合）
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Uvicorn起動
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Backend URL**: http://localhost:8000
**API Docs**: http://localhost:8000/docs

### 2. Frontend起動（ポート3000）

別ターミナルで実行:

```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system/frontend

# .next クリーンアップ（初回/エラー時）
rm -rf .next

# 開発サーバー起動
npm run dev
```

**Frontend URL**: http://localhost:3000

## 環境変数設定

### Backend (.env)

```env
GCP_PROJECT_ID=fractal-ecosystem
GCP_LOCATION=us-central1
VECTOR_DB_SPREADSHEET_ID=【設定済みID】
GEMINI_MODEL=gemini-2.5-flash
EMBEDDING_MODEL=gemini-embedding-001
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

**Note**: APIポート8080はプロキシ経由のパブリックポート

## 動作確認

### Backend ヘルスチェック

```bash
curl http://localhost:8000/health
```

**期待レスポンス**:
```json
{"status": "healthy", "version": "1.0.0"}
```

### Frontend アクセス

ブラウザで http://localhost:3000 を開く
- チャット画面が表示される
- サイドバーが表示される
- テーマ切替ボタンが動作する

## トラブルシューティング

### Backend起動エラー

```bash
# 依存関係再インストール
pip install -r requirements.txt

# ポート競合確認
lsof -i:8000
```

### Frontend起動エラー

```bash
# node_modules再インストール
rm -rf node_modules .next
npm install

# ポート競合確認
lsof -i:3000
```

### 環境変数未設定エラー

```bash
# Backend
cp .env.example .env
# .envファイルを編集

# Frontend
cp .env.example .env.local
# .env.localファイルを編集
```

## 停止方法

```bash
# Ctrl+C で各ターミナルを停止

# または強制終了
pkill -f "uvicorn"
pkill -f "next dev"
```

---

**最終更新**: 2025-10-27
