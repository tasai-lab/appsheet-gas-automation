# GCP サービスアカウント設定完了レポート

> **設定日**: 2025-10-27
> **プロジェクト**: fractal-ecosystem
> **サービスアカウント**: rag-backend@fractal-ecosystem.iam.gserviceaccount.com

---

## ✅ 設定完了した権限

| ロール | 権限名 | 用途 |
|-------|--------|------|
| `roles/aiplatform.user` | Vertex AI User | Embeddings生成、Gemini API使用 |
| `roles/discoveryengine.editor` | Discovery Engine Editor | **⭐ Vertex AI Ranking API使用** |
| `roles/logging.logWriter` | Cloud Logging Writer | アプリケーションログ出力 |
| `roles/monitoring.metricWriter` | Cloud Monitoring Metric Writer | メトリクス送信 |
| `roles/run.admin` | Cloud Run Admin | Cloud Runサービス管理 |
| `roles/secretmanager.secretAccessor` | Secret Manager Accessor | シークレット読み取り |

---

## 🎯 主要な機能

### 1. Vertex AI 統合
```bash
# Embeddings API
roles/aiplatform.user → gemini-embedding-001 使用可能

# Generation API
roles/aiplatform.user → gemini-2.5-flash/pro 使用可能
```

### 2. ⭐ Vertex AI Ranking API
```bash
# Discovery Engine API (Ranking API含む)
roles/discoveryengine.editor → semantic-ranker-default-004 使用可能

# 必要なAPI
gcloud services enable discoveryengine.googleapis.com
```

### 3. Cloud Run デプロイ
```bash
# Backend FastAPIのデプロイと管理
roles/run.admin → Cloud Runサービス作成・更新・削除
```

### 4. 監視・ログ
```bash
# Cloud Logging
roles/logging.logWriter → ログ出力

# Cloud Monitoring
roles/monitoring.metricWriter → カスタムメトリクス送信
```

---

## 🔧 使用方法

### Backend (FastAPI) での認証

**Application Default Credentials (ADC) 使用:**

```python
from google.auth import default
from google.cloud import aiplatform

# 自動的にサービスアカウント認証を使用
credentials, project = default()

# Vertex AI初期化
aiplatform.init(
    project="fractal-ecosystem",
    location="us-central1",
    credentials=credentials
)
```

### Cloud Run デプロイ時

```bash
# Cloud Runにデプロイ（自動的にこのサービスアカウントを使用）
gcloud run deploy rag-backend \
  --image gcr.io/fractal-ecosystem/rag-backend:latest \
  --service-account rag-backend@fractal-ecosystem.iam.gserviceaccount.com \
  --region us-central1
```

### ローカル開発時

```bash
# サービスアカウントとして認証（開発時のみ）
gcloud auth application-default login --impersonate-service-account=rag-backend@fractal-ecosystem.iam.gserviceaccount.com
```

---

## 📋 必要なAPI有効化

以下のAPIが有効化されている必要があります:

```bash
# 既に有効化済み ✅
gcloud services list --enabled --filter="NAME:(
  aiplatform.googleapis.com OR
  discoveryengine.googleapis.com OR
  run.googleapis.com OR
  logging.googleapis.com OR
  monitoring.googleapis.com OR
  secretmanager.googleapis.com
)"
```

**確認コマンド:**
```bash
gcloud services list --enabled --project=fractal-ecosystem | grep -E "(aiplatform|discoveryengine|run|logging|monitoring|secretmanager)"
```

---

## 🔐 セキュリティ考慮事項

### 最小権限の原則

現在の権限設定は、RAG Backendの動作に**必要最小限**の権限です：

| 権限 | 理由 |
|------|------|
| `aiplatform.user` | Embeddings/Generation APIのみ（管理権限なし） |
| `discoveryengine.editor` | Ranking APIのみ（他のDiscovery Engine機能は不要） |
| `logging.logWriter` | 書き込みのみ（読み取り権限なし） |
| `monitoring.metricWriter` | メトリクス送信のみ（読み取り権限なし） |
| `run.admin` | 自身のサービス管理のみ |
| `secretmanager.secretAccessor` | 読み取りのみ（作成・削除権限なし） |

### 権限の監査

```bash
# 権限の定期確認（月次推奨）
gcloud projects get-iam-policy fractal-ecosystem \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:rag-backend@fractal-ecosystem.iam.gserviceaccount.com" \
  --format="table(bindings.role)"
```

---

## ❌ 付与していない権限（不要）

以下の権限は**意図的に付与していません**:

| 権限 | 理由 |
|------|------|
| `roles/owner` | 過剰な権限（プロジェクト全体の管理権限） |
| `roles/editor` | 過剰な権限（全リソースの編集権限） |
| `roles/aiplatform.admin` | 不要（モデル管理権限は不要） |
| `roles/storage.admin` | 不要（Cloud Storageは使用しない） |
| `roles/bigquery.admin` | 不要（BigQueryは使用しない） |

---

## 🚀 次のステップ

### Phase 1.2 完了に向けて

1. ✅ **GCPサービスアカウント権限設定** - 完了
2. ⏳ **Vector DB Spreadsheet作成** - 手動作成待ち
3. ⏳ **Spreadsheet ID設定** - 作成後に設定

### Phase 3 準備

サービスアカウント設定が完了したため、以下の実装が可能になりました:

- ✅ Vertex AI Embeddings API呼び出し
- ✅ Vertex AI Generation API呼び出し
- ✅ ⭐ Vertex AI Ranking API呼び出し
- ✅ Cloud Runへのデプロイ
- ✅ Cloud Loggingへのログ出力

---

## 📚 関連ドキュメント

- [GCP_SETUP.md](./GCP_SETUP.md) - GCPプロジェクト初期設定
- [06_DEPLOYMENT.md](./06_DEPLOYMENT.md) - デプロイメント手順
- [07_SECURITY.md](./07_SECURITY.md) - セキュリティ設計
- [VERTEX_AI_ADOPTION_SUMMARY.md](./VERTEX_AI_ADOPTION_SUMMARY.md) - Vertex AI Ranking API採用決定

---

## 🔗 参考コマンド

### サービスアカウント情報確認
```bash
# サービスアカウント詳細
gcloud iam service-accounts describe rag-backend@fractal-ecosystem.iam.gserviceaccount.com

# 権限一覧
gcloud projects get-iam-policy fractal-ecosystem \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:rag-backend@fractal-ecosystem.iam.gserviceaccount.com" \
  --format="table(bindings.role)"
```

### 追加権限の付与（将来必要な場合）
```bash
# 例: Storage読み取り権限を追加
gcloud projects add-iam-policy-binding fractal-ecosystem \
  --member="serviceAccount:rag-backend@fractal-ecosystem.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

### 権限の削除（誤って付与した場合）
```bash
# 例: 権限を削除
gcloud projects remove-iam-policy-binding fractal-ecosystem \
  --member="serviceAccount:rag-backend@fractal-ecosystem.iam.gserviceaccount.com" \
  --role="roles/ROLE_TO_REMOVE"
```

---

**最終更新**: 2025-10-27
**バージョン**: 1.0.0
**ステータス**: ✅ 設定完了
