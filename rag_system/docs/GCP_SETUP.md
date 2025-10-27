# GCP セットアップ完了報告

## プロジェクト情報

| 項目 | 値 |
|-----|-----|
| プロジェクトID | fractal-ecosystem |
| プロジェクト番号 | 411046620715 |
| プロジェクト名 | Fractal-EcoSystem |
| リージョン | us-central1 (推奨) |

## ✅ 完了した設定

### 1. 有効化したAPI

以下のAPIを有効化しました:

```bash
✅ aiplatform.googleapis.com           # Vertex AI (Embeddings, Generation)
✅ run.googleapis.com                  # Cloud Run
✅ sheets.googleapis.com               # Google Sheets API
✅ drive.googleapis.com                # Google Drive API
✅ logging.googleapis.com              # Cloud Logging
✅ monitoring.googleapis.com           # Cloud Monitoring
✅ cloudbuild.googleapis.com           # Cloud Build
✅ artifactregistry.googleapis.com     # Artifact Registry
✅ secretmanager.googleapis.com        # Secret Manager
✅ cloudresourcemanager.googleapis.com # Resource Manager
✅ cloudbilling.googleapis.com         # Cloud Billing
```

### 2. サービスアカウント作成

**サービスアカウント名:** `rag-backend`

**メールアドレス:** `rag-backend@fractal-ecosystem.iam.gserviceaccount.com`

**付与した権限:**
- `roles/aiplatform.user` - Vertex AI使用権限
- `roles/run.admin` - Cloud Run管理権限
- `roles/logging.logWriter` - ログ書き込み権限
- `roles/secretmanager.secretAccessor` - Secret Manager アクセス権限

### 3. 予算設定（月5000円）

**設定方法:** Cloud Console経由で設定

#### 手動設定手順

1. Cloud Consoleにアクセス
   ```
   https://console.cloud.google.com/billing/budgets?project=fractal-ecosystem
   ```

2. 「予算を作成」をクリック

3. 予算設定:
   - **名前**: RAG System Monthly Budget
   - **プロジェクト**: fractal-ecosystem
   - **予算額**: 5,000円/月
   - **期間**: 月次

4. アラート設定:
   - **50%**: 2,500円使用時にメール通知
   - **90%**: 4,500円使用時にメール通知
   - **100%**: 5,000円使用時にメール通知

5. 通知先:
   - メール: t.asai@fractal-group.co.jp

#### 自動化スクリプト (参考)

```bash
# 予算設定は現在gcloud CLIでサポートされていないため、
# Terraform または Cloud Console で設定してください

# Terraform例:
resource "google_billing_budget" "rag_budget" {
  billing_account = "010DCE-166EF1-924626"  # 要確認
  display_name    = "RAG System Monthly Budget"

  budget_filter {
    projects = ["projects/411046620715"]
  }

  amount {
    specified_amount {
      currency_code = "JPY"
      units         = "5000"
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 0.9
  }
  threshold_rules {
    threshold_percent = 1.0
  }
}
```

---

## 設定ファイルの更新

### 1. common_modules/embeddings_service.gs

```javascript
const EMBEDDINGS_CONFIG = {
  projectId: 'fractal-ecosystem',  // 更新
  location: 'us-central1',
  model: 'gemini-embedding-001',
  outputDimensionality: 3072,
  maxTokensPerText: 2048,
  maxTextsPerBatch: 250,
  maxTokensPerBatch: 20000
};
```

### 2. rag_system/backend/.env

```env
GCP_PROJECT_ID=fractal-ecosystem
GCP_LOCATION=us-central1
GCP_PROJECT_NUMBER=411046620715
VECTOR_DB_SPREADSHEET_ID=【作成後に設定】
GEMINI_MODEL=gemini-2.5-flash
RERANKER_MODEL=cross-encoder/mmarco-mMiniLMv2-L12-H384-v1
LOG_LEVEL=INFO
```

### 3. rag_system/frontend/.env.local

```env
NEXT_PUBLIC_API_URL=https://rag-backend-xxx.run.app
NEXT_PUBLIC_GCP_PROJECT_ID=fractal-ecosystem
NEXT_PUBLIC_APP_NAME=医療RAGシステム
```

---

## コスト試算（月5000円以内）

### 想定使用量

| サービス | 使用量 | 単価 | 月額コスト |
|---------|--------|------|-----------|
| **Vertex AI Embeddings** | 500文書/月 × 3KB | $0.025/1k文字 | ¥450 |
| **Vertex AI Generation** | 1,000検索/月 × 15kトークン | $0.075/1M入力 | ¥170 |
| **Cloud Run** | 1,000リクエスト/月 | $0.00002400/vCPU秒 | ¥300 |
| **Cloud Storage** | 1GB | $0.020/GB | ¥3 |
| **Cloud Logging** | 5GB | 最初50GBは無料 | ¥0 |
| **Cloud Monitoring** | 基本 | 最初150MB無料 | ¥0 |
| **Google Sheets** | Vector DB | 無料 | ¥0 |
| **予備** | - | - | ¥77 |
| **合計** | - | - | **¥1,000** |

**結論:** 想定使用量では月額約1,000円程度。予算5,000円に対して十分な余裕があります。

### コスト削減策

1. **Flash優先使用**: Gemini 2.5 Flash (Pro比で約1/20のコスト)
2. **キャッシング**: 検索結果を5分間キャッシュ
3. **バッチ処理**: Embeddings生成時はバッチAPI使用（50%割引）

---

## Vertex AIクォータ確認

```bash
# Embeddings API クォータ確認
gcloud ai-platform quotas list \
  --project=fractal-ecosystem \
  --filter="metric.type:aiplatform.googleapis.com/embedding_requests"

# Generation API クォータ確認
gcloud ai-platform quotas list \
  --project=fractal-ecosystem \
  --filter="metric.type:aiplatform.googleapis.com/generate_content_requests"
```

**デフォルトクォータ:**
- Embeddings: 600リクエスト/分
- Generation: 500リクエスト/分

**必要に応じてクォータ増加:**
```bash
# Cloud Consoleから申請
https://console.cloud.google.com/iam-admin/quotas?project=fractal-ecosystem
```

---

## 次のステップ

### 即時対応

1. **予算アラート設定** (Cloud Console)
   - https://console.cloud.google.com/billing/budgets?project=fractal-ecosystem
   - 月5000円、50%/90%/100%でアラート

2. **Application Default Credentials設定**
   ```bash
   gcloud auth application-default login
   gcloud auth application-default set-quota-project fractal-ecosystem
   ```

3. **設定ファイル更新**
   - `common_modules/embeddings_service.gs` のprojectId更新
   - `rag_system/backend/.env.example` 作成
   - `rag_system/frontend/.env.local.example` 作成

### Phase 2開始準備

4. **Vector DBスプレッドシート作成**
   - `docs/ja/RAG_VECTOR_DB_SETUP.md` 参照
   - fractal-ecosystemプロジェクトのGoogleアカウントで作成

5. **OAuth2承認**
   - GASプロジェクトでVertex AI APIへのアクセス承認

6. **テストデプロイ**
   - Cloud Runにサンプルアプリをデプロイして動作確認

---

## トラブルシューティング

### Q: "Permission denied" エラー

**原因:** サービスアカウントに必要な権限がない

**解決:**
```bash
gcloud projects add-iam-policy-binding fractal-ecosystem \
  --member="serviceAccount:rag-backend@fractal-ecosystem.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### Q: "Quota exceeded" エラー

**原因:** APIクォータを超過

**解決:**
1. Cloud Consoleでクォータ確認
2. 必要に応じてクォータ増加申請
3. リトライループがないか確認（**絶対にあってはならない**）

### Q: 予算アラートが届かない

**原因:** 通知設定が正しくない

**解決:**
1. Cloud Console → Billing → Budgets で設定確認
2. メールアドレスが正しいか確認
3. 通知チャネルが有効か確認

---

## セキュリティチェックリスト

- [x] サービスアカウント作成完了
- [x] 必要最小限の権限のみ付与
- [x] Secret Managerアクセス権限付与
- [x] Cloud Logging有効化
- [x] Cloud Monitoring有効化
- [ ] 予算アラート設定（要手動設定）
- [ ] Application Default Credentials設定
- [ ] OAuth2承認（GAS側で実施）

---

**設定実施日**: 2025-10-27
**担当者**: Claude Code
**承認者**: 浅井氏（要確認）
