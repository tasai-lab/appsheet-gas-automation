# 本番環境デプロイガイド

**最終更新**: 2025-10-27
**対象環境**: Production

---

## 概要

このドキュメントは、RAG Medical Assistant APIを本番環境にデプロイする手順を説明します。

---

## 事前準備

### 1. 必須要件

- ✅ Google Cloud Project（GCP）
- ✅ Vertex AI API有効化
- ✅ Sheets API有効化
- ✅ サービスアカウントまたはApplication Default Credentials
- ✅ Vector DB Spreadsheet作成済み
- ✅ Python 3.11以上

### 2. 環境変数設定

```bash
# .envファイルを作成
cp backend/.env.example backend/.env

# 必須項目を設定
ENVIRONMENT=production
ADMIN_API_KEY=$(openssl rand -hex 32)
VECTOR_DB_SPREADSHEET_ID=your-spreadsheet-id
```

---

## デプロイ手順

### Option 1: Cloud Run（推奨）

#### 1. Dockerfileの作成（必要に応じて）

#### 2. Cloud Runへのデプロイ

```bash
# プロジェクトIDを設定
export PROJECT_ID=fractal-ecosystem
export REGION=us-central1

# Cloud Runにデプロイ
gcloud run deploy rag-backend \
  --source backend/ \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars ENVIRONMENT=production,CACHE_ENABLED=true \
  --set-secrets ADMIN_API_KEY=ADMIN_API_KEY:latest \
  --min-instances 1 \
  --max-instances 10 \
  --memory 2Gi \
  --timeout 300
```

#### 3. 環境変数をSecret Managerに設定

```bash
# Admin API Keyを設定
echo -n "your-admin-api-key" | gcloud secrets create ADMIN_API_KEY \
  --data-file=-

# 他の機密情報も同様に設定
```

---

### Option 2: 直接VM

#### 1. 依存パッケージのインストール

```bash
cd backend
pip3 install -r requirements.txt
```

#### 2. システムサービスとして起動

```bash
# systemdサービスファイルを作成
sudo nano /etc/systemd/system/rag-backend.service
```

```ini
[Unit]
Description=RAG Medical Assistant API
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/rag_system/backend
EnvironmentFile=/path/to/rag_system/backend/.env
ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# サービスを有効化して起動
sudo systemctl enable rag-backend
sudo systemctl start rag-backend
sudo systemctl status rag-backend
```

---

## 本番環境設定のベストプラクティス

### 1. セキュリティ

#### 管理者APIキーの設定

```bash
# ランダムな文字列を生成
openssl rand -hex 32

# .envに設定
ADMIN_API_KEY=生成した文字列
```

#### CORS設定

```bash
# 本番ドメインのみを許可
ALLOWED_ORIGINS=https://your-production-domain.com
```

### 2. パフォーマンス

#### キャッシュ設定の最適化

```bash
# 使用パターンに応じて調整
CACHE_EMBEDDINGS_TTL=86400  # 24時間
CACHE_VECTOR_DB_TTL=3600    # 1時間
CACHE_MAX_SIZE=2000         # メモリ2GBの場合
```

### 3. モニタリング

#### ログ設定

```bash
# 本番環境ではINFO以上を推奨
LOG_LEVEL=INFO
ENABLE_CLOUD_LOGGING=true
ENABLE_CLOUD_MONITORING=true
```

---

## デプロイ後の確認

### 1. ヘルスチェック

```bash
curl https://your-api-domain.com/health
```

**期待されるレスポンス:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "checks": {
    "api": true,
    "vertex_ai": true,
    "vector_db": true
  }
}
```

### 2. キャッシュメトリクス

```bash
curl https://your-api-domain.com/health/cache/metrics
```

### 3. ログ確認

```bash
# Cloud Runの場合
gcloud run logs read rag-backend --region us-central1 --limit 50

# VMの場合
sudo journalctl -u rag-backend -n 50 -f
```

---

## トラブルシューティング

### 問題: "ADMIN_API_KEY not configured"

**原因**: 環境変数が設定されていない

**解決策:**
```bash
# .envファイルを確認
cat backend/.env | grep ADMIN_API_KEY

# Secret Managerから取得（Cloud Runの場合）
gcloud secrets versions access latest --secret=ADMIN_API_KEY
```

### 問題: "Vector DB connection failed"

**原因**: SpreadsheetへのアクセスTODO権限がない、またはSpreadsheet IDが間違っている

**解決策:**
```bash
# Spreadsheet IDを確認
cat backend/.env | grep VECTOR_DB_SPREADSHEET_ID

# サービスアカウントに共有権限を付与
# Google Sheetsで該当のスプレッドシートを開き、サービスアカウントのメールアドレスに編集権限を付与
```

### 問題: "Vertex AI API timeout"

**原因**: ネットワーク遅延、モデル過負荷

**解決策:**
```python
# タイムアウト設定を調整（config.py）
REQUEST_TIMEOUT=60  # デフォルト30秒から増加

# または gemini_service.py でタイムアウトを延長
timeout_seconds = 180  # デフォルト120秒
```

### 問題: キャッシュメモリ使用量が大きい

**原因**: キャッシュエントリが多すぎる

**解決策:**
```bash
# キャッシュサイズを削減
CACHE_MAX_SIZE=500  # デフォルト1000から削減

# TTLを短縮
CACHE_EMBEDDINGS_TTL=43200  # 24時間 → 12時間
CACHE_VECTOR_DB_TTL=1800    # 1時間 → 30分
```

---

## パフォーマンスチューニング

### キャッシュ最適化

**メトリクスの確認:**
```bash
curl https://your-api-domain.com/health/cache/metrics
```

**ヒット率が低い場合（< 50%）:**
- TTLを延長（より長く保持）
- キャッシュサイズを増加
- キャッシュキー生成ロジックを確認

**メモリ使用量が高い場合:**
- `CACHE_MAX_SIZE` を削減
- TTLを短縮
- 不要な名前空間をクリア

### API使用量の監視

**コスト追跡:**
```bash
# ログスプレッドシートで確認
# スプレッドシートID: 16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA
# 列: inputCostJPY, outputCostJPY, totalCostJPY

# キャッシュによる節約効果を計算
# キャッシュヒット率 × 平均API呼び出しコスト = 節約額
```

**推定コスト削減:**
- Embeddings API: 95%削減（キャッシュヒット率95%想定）
- Generation API: 80%削減（同一クエリの繰り返し）

---

## セキュリティ強化

### Admin APIキーの保護

```bash
# Secret Managerを使用（推奨）
gcloud secrets create ADMIN_API_KEY --data-file=-
echo -n "$(openssl rand -hex 32)" | gcloud secrets create ADMIN_API_KEY --data-file=-

# Cloud Runで環境変数として設定
gcloud run services update rag-backend \
  --set-secrets ADMIN_API_KEY=ADMIN_API_KEY:latest
```

### CORS設定の厳格化

```python
# config.py
cors_origins: list[str] = [
    "https://your-production-domain.com",
    "https://www.your-production-domain.com"
]
# localhost は本番環境では削除
```

### アクセス制御

```python
# 本番環境では管理エンドポイントを無効化（推奨）
ENABLE_ADMIN_ENDPOINTS=false

# または、APIキー認証を必須化
# routers/health.py でデコレーター追加
from app.middleware.auth import require_admin_key

@router.post("/cache/clear")
@require_admin_key
async def cache_clear(...):
    ...
```

---

## モニタリング設定

### Cloud Logging

```python
# config.py
enable_cloud_logging: bool = True
log_level: str = "INFO"  # 本番環境ではINFO推奨
```

**ログ確認:**
```bash
# Cloud Runのログを確認
gcloud run logs read rag-backend --region us-central1 --limit 100

# エラーログのみ抽出
gcloud run logs read rag-backend --region us-central1 --limit 100 | grep ERROR
```

### Cloud Monitoring

**推奨メトリクス:**
- リクエスト数（RPS）
- レスポンス時間（P50, P95, P99）
- エラー率
- キャッシュヒット率
- API呼び出し回数
- メモリ使用量
- CPU使用率

**アラート設定例:**
```bash
# エラー率が10%を超えた場合にアラート
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="RAG Backend Error Rate" \
  --condition-display-name="Error rate > 10%" \
  --condition-threshold-value=0.1
```

---

## スケーリング設定

### Cloud Run

```bash
# Auto-scaling設定
gcloud run services update rag-backend \
  --min-instances 1 \      # 常時1インスタンス起動（コールドスタート回避）
  --max-instances 10 \     # 最大10インスタンス
  --concurrency 80 \       # 1インスタンスあたり80リクエスト
  --cpu 2 \                # 2 vCPU
  --memory 2Gi             # 2GB RAM
```

### パフォーマンス最適化

**推奨設定（トラフィック予測に基づく）:**

| トラフィック | min-instances | max-instances | memory | concurrency |
|------------|--------------|--------------|--------|-------------|
| 低（< 10 RPS） | 0 | 3 | 1Gi | 80 |
| 中（10-50 RPS） | 1 | 5 | 2Gi | 80 |
| 高（> 50 RPS） | 2 | 10 | 2Gi | 100 |

---

## バックアップとリカバリ

### Vector DB Spreadsheet

**自動バックアップ（推奨）:**
```javascript
// Google Apps Scriptでスケジュール実行
function backupVectorDB() {
  const sourceId = 'YOUR_VECTOR_DB_SPREADSHEET_ID';
  const backupFolderId = 'YOUR_BACKUP_FOLDER_ID';

  const source = SpreadsheetApp.openById(sourceId);
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss');
  const backupName = `VectorDB_Backup_${timestamp}`;

  source.copy(backupName).moveTo(DriveApp.getFolderById(backupFolderId));

  Logger.log(`Backup created: ${backupName}`);
}
```

**手動バックアップ:**
```bash
# Google Drive UIでスプレッドシートをコピー
# または、Google Drive APIを使用
```

### 環境変数のバックアップ

```bash
# .envファイルをGit外で保管（暗号化推奨）
cp backend/.env backend/.env.backup
gpg -c backend/.env.backup  # パスワード暗号化
```

---

## 本番環境チェックリスト（最終確認）

デプロイ前に以下を確認してください：

- [ ] `ADMIN_API_KEY` を安全なランダム文字列に設定
- [ ] `ALLOWED_ORIGINS` を本番ドメインのみに設定
- [ ] `ENVIRONMENT=production` に設定
- [ ] `DEBUG=false` に設定
- [ ] GCP認証情報を正しく設定
- [ ] Vector DB Spreadsheetに適切な権限を付与
- [ ] キャッシュ設定を確認（TTL、サイズ）
- [ ] ログレベルを `INFO` に設定
- [ ] Cloud Logging/Monitoring を有効化
- [ ] ヘルスチェックエンドポイントが正常動作
- [ ] SSLが有効化されている
- [ ] バックアップ戦略を確立
- [ ] アラート設定を完了
- [ ] ドキュメントを最新化

---

## 参考リンク

- [Cloud Run ドキュメント](https://cloud.google.com/run/docs)
- [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [プロジェクトREADME](../README.md)
- [アーキテクチャ設計書](02_ARCHITECTURE.md)
- [キャッシュ実装ドキュメント](CACHE_IMPLEMENTATION.md)

---

**デプロイ完了後のフォローアップ:**
1. 24時間モニタリング
2. キャッシュメトリクスの確認
3. API使用量とコストの確認
4. エラーログの確認
5. パフォーマンステスト
6. ユーザーフィードバック収集

---

**最終更新**: 2025-10-27
**作成者**: Claude Code
**レビュー**: 必須（デプロイ前）
