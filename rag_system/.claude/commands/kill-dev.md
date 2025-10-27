# 開発サーバー全停止

Backend (FastAPI) と Frontend (Next.js) の開発サーバーを強制終了する。

## 実行内容

1. Uvicorn (Backend) プロセス停止
2. Next.js (Frontend) プロセス停止
3. Node.js プロセス全停止
4. ポート8000, 8080, 3000の占有プロセス強制終了

## 実行コマンド

```bash
# Backend (Uvicorn) 停止
pkill -9 -f "uvicorn"

# Frontend (Next.js) 停止
pkill -9 -f "next dev"

# 全Node.jsプロセス停止
pkill -9 node

# ポート占有プロセス強制終了
lsof -ti:8000,8080,3000 | xargs kill -9 2>/dev/null

# 確認
lsof -i:8000
lsof -i:8080
lsof -i:3000

# 全て空ならOK
```

## 確認方法

```bash
# プロセス確認
ps aux | grep -E "uvicorn|next dev"

# ポート確認
lsof -i:8000
lsof -i:8080
lsof -i:3000

# 何も表示されなければ停止成功
```

## 注意事項

- **破壊的操作**: 全Node.jsプロセスを停止するため、他のNode.jsアプリも終了します
- **データ保存**: 未保存の変更がある場合は事前に保存してください
- **バックグラウンドプロセス**: 8個のバックグラウンドプロセスが検出されている場合があります

## 再起動

停止後、再起動する場合:

```bash
# /start-dev コマンドを使用
# または
cd rag_system && ./scripts/start-dev.sh
```

## トラブルシューティング

### プロセスが残っている

```bash
# 強制的に再実行
pkill -9 -f "uvicorn"
pkill -9 -f "next dev"
pkill -9 node

# それでも残る場合
sudo lsof -i:8000 | grep LISTEN | awk '{print $2}' | xargs sudo kill -9
sudo lsof -i:3000 | grep LISTEN | awk '{print $2}' | xargs sudo kill -9
```

### ポートが解放されない

```bash
# 強制解放
sudo lsof -ti:8000 | xargs sudo kill -9
sudo lsof -ti:3000 | xargs sudo kill -9

# 待機（1-2秒）
sleep 2

# 再確認
lsof -i:8000
lsof -i:3000
```

---

**最終更新**: 2025-10-27
