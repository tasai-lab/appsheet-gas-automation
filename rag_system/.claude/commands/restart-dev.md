# 開発サーバー再起動

Backend + Frontend を停止して再起動する。

## 使用ケース

- コード変更が反映されない
- ポート競合エラー
- 環境変数変更後
- .envファイル更新後
- ChunkLoadError発生時
- ハイドレーションエラー発生時

## 実行手順

### 1. 全停止

```bash
pkill -9 -f "uvicorn"
pkill -9 -f "next dev"
pkill -9 node
lsof -ti:8000,8080,3000 | xargs kill -9 2>/dev/null

# 待機
sleep 2
```

### 2. Frontend クリーンアップ

```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system/frontend

# ビルドキャッシュ削除
rm -rf .next

# 依存関係再確認（オプション）
# npm install
```

### 3. Backend 再起動

```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system/backend

# 環境変数読み込み
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# バックグラウンド起動
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &

# 待機（起動確認）
sleep 3

# ヘルスチェック
curl http://localhost:8000/health
```

### 4. Frontend 再起動

```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system/frontend

# バックグラウンド起動
npm run dev &

# 待機（起動確認）
sleep 5
```

### 5. 動作確認

```bash
# Backend
curl http://localhost:8000/health

# Frontend（ブラウザで確認）
open http://localhost:3000
```

## ワンライナー（全自動）

```bash
pkill -9 -f "uvicorn"; \
pkill -9 -f "next dev"; \
pkill -9 node; \
lsof -ti:8000,8080,3000 | xargs kill -9 2>/dev/null; \
sleep 2; \
cd /Users/t.asai/code/appsheet-gas-automation/rag_system/frontend && rm -rf .next; \
cd /Users/t.asai/code/appsheet-gas-automation/rag_system/backend && \
  (uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &); \
sleep 3; \
cd /Users/t.asai/code/appsheet-gas-automation/rag_system/frontend && \
  (npm run dev > /tmp/frontend.log 2>&1 &); \
sleep 5; \
curl http://localhost:8000/health && \
echo "Backend: ✅" || echo "Backend: ❌"; \
curl -s http://localhost:3000 > /dev/null && \
echo "Frontend: ✅" || echo "Frontend: ❌"
```

## ログ確認

### Backend ログ

```bash
tail -f /tmp/backend.log
```

### Frontend ログ

```bash
tail -f /tmp/frontend.log
```

## トラブルシューティング

### Backend起動失敗

```bash
# ログ確認
cat /tmp/backend.log

# 手動起動（エラー詳細表示）
cd backend
uvicorn app.main:app --reload
```

### Frontend起動失敗

```bash
# ログ確認
cat /tmp/frontend.log

# 手動起動（エラー詳細表示）
cd frontend
npm run dev
```

### ポート競合

```bash
# 占有プロセス確認
lsof -i:8000
lsof -i:3000

# 強制終了
kill -9 <PID>
```

---

**最終更新**: 2025-10-27
