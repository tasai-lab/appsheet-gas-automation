# デプロイメント手順書

## 1. 前提条件

### 1.1 必要なツール

| ツール | バージョン | インストール |
|--------|-----------|------------|
| Node.js | 18+ | https://nodejs.org/ |
| Python | 3.11+ | https://www.python.org/ |
| gcloud CLI | latest | https://cloud.google.com/sdk/docs/install |
| clasp | latest | `npm install -g @google/clasp` |
| Docker | latest | https://www.docker.com/ (オプション) |

### 1.2 GCPプロジェクト設定

```bash
# gcloud初期化
gcloud init

# プロジェクトIDを設定
export GCP_PROJECT_ID=fractal-ecosystem
gcloud config set project $GCP_PROJECT_ID

# 必要なAPIを有効化
gcloud services enable \
  aiplatform.googleapis.com \
  discoveryengine.googleapis.com \
  run.googleapis.com \
  sheets.googleapis.com \
  drive.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com
```

### 1.3 認証情報準備

```bash
# サービスアカウント作成
gcloud iam service-accounts create rag-backend \
  --display-name="RAG Backend Service Account"

# 必要な権限付与
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:rag-backend@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:rag-backend@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter"
```

---

## 2. Vector DB (Spreadsheet) セットアップ

### 2.1 スプレッドシート作成

1. Google Driveで新規スプレッドシート作成
2. 名前: `RAG_VectorDB_統合ナレッジベース`
3. 保存先: フォルダーID `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX`

詳細は `docs/ja/RAG_VECTOR_DB_SETUP.md` を参照

### 2.2 スプレッドシートID取得

```bash
# URLから取得
# https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
export VECTOR_DB_SPREADSHEET_ID="【ここにIDを貼り付け】"
```

### 2.3 vector_db_sync.gs 更新

```javascript
// common_modules/vector_db_sync.gs
const VECTOR_DB_CONFIG = {
  spreadsheetId: '【SPREADSHEET_IDを貼り付け】',
  // ...
};
```

---

## 3. GAS Projects デプロイ

### 3.1 共通モジュール配布

全15プロジェクトに共通モジュールをコピー:

```bash
cd /Users/t.asai/code/appsheet-gas-automation

# 各プロジェクトにコピー (例: 訪問看護_通常記録)
cp common_modules/embeddings_service.gs \
   gas_projects/projects/nursing/Appsheet_訪問看護_通常記録/scripts/

cp common_modules/vector_db_sync.gs \
   gas_projects/projects/nursing/Appsheet_訪問看護_通常記録/scripts/
```

### 3.2 main.gs 更新

各プロジェクトの `main.gs` に `syncToVectorDB()` 呼び出しを追加:

```javascript
// 既存処理後
const result = processRequest(params);
updateAppSheet(result);

// ★追加
syncToVectorDB({
  domain: 'nursing',  // プロジェクトごとに変更
  sourceType: 'care_record',
  sourceTable: 'Care_Records',
  sourceId: params.recordId,
  userId: params.userId,
  title: `${params.visitDate} 訪問看護記録`,
  content: buildFullText(result),
  structuredData: result,
  metadata: { audioFileId: params.audioFileId },
  tags: extractTags(result),
  date: params.visitDate
}, logger);
```

### 3.3 appsscript.json 更新

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/cloud-platform"
  ]
}
```

### 3.4 デプロイ実行

```bash
# 看護系プロジェクト (例)
cd gas_projects/projects/nursing/Appsheet_訪問看護_通常記録
clasp push
clasp deploy --description "v100: RAG統合"

# または deploy_unified.py使用
cd /Users/t.asai/code/appsheet-gas-automation
python deploy_unified.py Appsheet_訪問看護_通常記録 "v100: RAG統合"
```

### 3.5 OAuth承認

1. GASエディタで任意の関数を実行
2. 承認画面で「詳細」→「安全ではないページに移動」
3. 全権限を承認

---

## 4. Backend (FastAPI) デプロイ

### 4.1 ローカル開発環境

```bash
cd rag_system/backend

# 仮想環境作成
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存関係インストール
pip install -r requirements.txt

# 環境変数設定
cp .env.example .env
# .env を編集
```

**.env ファイル:**
```env
GCP_PROJECT_ID=macro-shadow-458705-v8
GCP_LOCATION=us-central1
VECTOR_DB_SPREADSHEET_ID=【SPREADSHEET_ID】
GEMINI_MODEL=gemini-2.5-flash
RERANKER_MODEL=cross-encoder/mmarco-mMiniLMv2-L12-H384-v1
LOG_LEVEL=INFO
```

**ローカル起動:**
```bash
uvicorn app.main:app --reload --port 8000
```

### 4.2 Docker ビルド

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 依存関係インストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコピー
COPY ./app ./app

# ポート公開
EXPOSE 8080

# 起動
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**ビルド:**
```bash
docker build -t rag-backend .
docker run -p 8080:8080 --env-file .env rag-backend
```

### 4.3 Cloud Run デプロイ

**方法1: gcloud コマンド**

```bash
cd rag_system/backend

# Artifact Registryにプッシュ
gcloud builds submit \
  --tag gcr.io/$GCP_PROJECT_ID/rag-backend

# Cloud Runにデプロイ
gcloud run deploy rag-backend \
  --image gcr.io/$GCP_PROJECT_ID/rag-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --set-env-vars "GCP_PROJECT_ID=$GCP_PROJECT_ID,GCP_LOCATION=us-central1,VECTOR_DB_SPREADSHEET_ID=$VECTOR_DB_SPREADSHEET_ID"
```

**方法2: cloudbuild.yaml**

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/rag-backend', '.']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/rag-backend']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'rag-backend'
      - '--image=gcr.io/$PROJECT_ID/rag-backend'
      - '--region=us-central1'
      - '--platform=managed'
      - '--memory=2Gi'
```

```bash
gcloud builds submit --config cloudbuild.yaml
```

### 4.4 デプロイ確認

```bash
# URLを取得
gcloud run services describe rag-backend \
  --region us-central1 \
  --format 'value(status.url)'

# ヘルスチェック
curl https://rag-backend-xxx.run.app/health
```

---

## 5. Frontend (Next.js) デプロイ

### 5.1 ローカル開発環境

```bash
cd rag_system/frontend

# 依存関係インストール
npm install

# 環境変数設定
cp .env.local.example .env.local
# .env.local を編集
```

**.env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=医療RAGシステム
```

**ローカル起動:**
```bash
npm run dev
# http://localhost:3000
```

### 5.2 Vercel デプロイ

**方法1: Vercel CLI**

```bash
# Vercel CLIインストール
npm install -g vercel

# ログイン
vercel login

# デプロイ
vercel
```

**方法2: GitHub連携**

1. GitHubリポジトリにプッシュ
2. Vercelダッシュボードで「Import Project」
3. リポジトリ選択
4. Build設定:
   - Framework Preset: Next.js
   - Root Directory: `rag_system/frontend`
   - Build Command: `npm run build`
   - Output Directory: `.next`

5. 環境変数設定:
   ```
   NEXT_PUBLIC_API_URL=https://rag-backend-xxx.run.app
   NEXT_PUBLIC_APP_NAME=医療RAGシステム
   ```

6. Deploy

### 5.3 カスタムドメイン設定 (オプション)

```bash
# Vercelダッシュボードで設定
# Settings → Domains → Add Domain
# 例: rag.fractal-group.co.jp
```

---

## 6. 初期データ移行

### 6.1 既存データのベクトル化

```bash
# GASエディタで実行
function migrateExistingData() {
  const logger = createLogger('data_migration');

  // 既存レコードを取得 (例: Care_Records)
  const appsheet = createAppSheetClient(APP_ID, ACCESS_KEY);
  const records = appsheet.getRecords('Care_Records', logger);

  logger.info(`移行対象: ${records.length}件`);

  let successCount = 0;
  let errorCount = 0;

  records.forEach((record, index) => {
    try {
      // Vector DBに同期
      syncToVectorDB({
        domain: 'nursing',
        sourceType: 'care_record',
        sourceTable: 'Care_Records',
        sourceId: record.record_id,
        userId: record.user_id,
        title: `${record.visit_date} 訪問看護記録`,
        content: buildFullText(record),
        structuredData: record,
        metadata: {},
        tags: extractTags(record),
        date: record.visit_date
      }, logger);

      successCount++;

      if ((index + 1) % 100 === 0) {
        logger.info(`進捗: ${index + 1}/${records.length}件`);
      }

    } catch (error) {
      logger.error(`移行エラー (record_id: ${record.record_id}): ${error.toString()}`);
      errorCount++;
    }
  });

  logger.info(`移行完了: 成功=${successCount}件, 失敗=${errorCount}件`);
}
```

### 6.2 バッチ実行 (推奨)

```javascript
// 100件ずつバッチ処理
function migrateExistingDataBatch() {
  const logger = createLogger('data_migration_batch');
  const batchSize = 100;

  const appsheet = createAppSheetClient(APP_ID, ACCESS_KEY);
  const records = appsheet.getRecords('Care_Records', logger);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const paramsArray = batch.map(record => ({
      domain: 'nursing',
      sourceType: 'care_record',
      sourceTable: 'Care_Records',
      sourceId: record.record_id,
      userId: record.user_id,
      title: `${record.visit_date} 訪問看護記録`,
      content: buildFullText(record),
      structuredData: record,
      metadata: {},
      tags: extractTags(record),
      date: record.visit_date
    }));

    try {
      syncToVectorDBBatch(paramsArray, logger);
      logger.info(`バッチ${Math.floor(i / batchSize) + 1}完了: ${i + batch.length}/${records.length}件`);
    } catch (error) {
      logger.error(`バッチエラー: ${error.toString()}`);
    }

    // API制限対策: 30秒待機
    Utilities.sleep(30000);
  }
}
```

---

## 7. 監視設定

### 7.1 Cloud Logging

```bash
# ログ表示
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=rag-backend" \
  --limit 50 \
  --format json
```

### 7.2 Cloud Monitoring

**アラートポリシー作成:**

```bash
# エラー率アラート
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="RAG Backend Error Rate" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s
```

### 7.3 Uptime Check

```bash
gcloud monitoring uptime create \
  https://rag-backend-xxx.run.app/health \
  --display-name="RAG Backend Health"
```

---

## 8. ロールバック手順

### 8.1 Backend ロールバック

```bash
# リビジョン一覧表示
gcloud run revisions list --service rag-backend --region us-central1

# 前のリビジョンにロールバック
gcloud run services update-traffic rag-backend \
  --to-revisions REVISION_NAME=100 \
  --region us-central1
```

### 8.2 Frontend ロールバック

Vercelダッシュボード:
1. Deployments
2. 前のデプロイを選択
3. "Promote to Production"

### 8.3 GAS ロールバック

```bash
cd gas_projects/projects/nursing/Appsheet_訪問看護_通常記録

# デプロイメント一覧
clasp deployments

# 前のバージョンをアクティブ化
clasp undeploy DEPLOYMENT_ID
clasp deploy --deploymentId PREVIOUS_DEPLOYMENT_ID
```

---

## 9. トラブルシューティング

### 9.1 Backend起動失敗

**症状:** Cloud Runのログに "Service startup failed"

**対処:**
```bash
# ローカルでDockerビルド確認
docker build -t rag-backend .
docker run -p 8080:8080 --env-file .env rag-backend

# ログ確認
gcloud logging read "resource.type=cloud_run_revision" --limit 100
```

### 9.2 Vertex AI API エラー

**症状:** "Permission denied on Vertex AI"

**対処:**
```bash
# サービスアカウント権限確認
gcloud projects get-iam-policy $GCP_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:rag-backend@*"

# 権限追加
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:rag-backend@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### 9.3 Spreadsheet接続エラー

**症状:** "Spreadsheet not found"

**対処:**
1. スプレッドシートIDが正しいか確認
2. サービスアカウントに編集権限があるか確認
3. OAuth2承認を再実行

---

## 10. チェックリスト

### デプロイ前

- [ ] Vector DBスプレッドシート作成完了
- [ ] VECTOR_DB_SPREADSHEET_ID 設定完了
- [ ] 15 GASプロジェクトに共通モジュールコピー完了
- [ ] OAuth2承認完了
- [ ] Backend .env 設定完了
- [ ] Frontend .env.local 設定完了

### デプロイ後

- [ ] GAS デプロイ完了 (全15プロジェクト)
- [ ] Backend Cloud Run デプロイ完了
- [ ] Frontend Vercel デプロイ完了
- [ ] /health エンドポイント正常応答確認
- [ ] /search エンドポイント動作確認
- [ ] /chat/stream ストリーミング動作確認
- [ ] 監視・ログ設定完了
- [ ] アラート設定完了

---

**最終更新**: 2025-10-27
**バージョン**: 1.0.0
