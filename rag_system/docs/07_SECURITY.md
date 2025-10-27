# セキュリティ設計書

## 1. セキュリティ概要

### 1.1 セキュリティ目標

| 目標 | 説明 |
|-----|------|
| 機密性 (Confidentiality) | 医療情報への不正アクセス防止 |
| 完全性 (Integrity) | データ改ざん防止、正確性保証 |
| 可用性 (Availability) | 99.5%以上のシステム稼働率 |
| 追跡可能性 (Traceability) | 全アクセスログの記録・監査 |

### 1.2 脅威モデル

| 脅威 | 影響 | リスクレベル | 対策 |
|-----|------|------------|------|
| 不正アクセス | 医療情報漏洩 | 高 | OAuth2認証、RBAC |
| SQLインジェクション | データ破壊 | 中 | パラメータ化クエリ、入力検証 |
| XSS攻撃 | セッション乗っ取り | 中 | CSP、入力サニタイズ |
| DDoS攻撃 | サービス停止 | 中 | Cloud Armorレート制限 |
| APIキー漏洩 | 不正利用 | 高 | シークレット管理、OAuth2 |

---

## 2. 認証・認可

### 2.1 認証フロー

```
┌──────────────┐
│   User       │
└──────┬───────┘
       │ (1) Google Sign-In
       ▼
┌──────────────┐
│ Identity     │
│ Platform     │
└──────┬───────┘
       │ (2) ID Token
       ▼
┌──────────────┐
│   Frontend   │
│   (Vercel)   │
└──────┬───────┘
       │ (3) Authorization: Bearer {token}
       ▼
┌──────────────┐
│   Backend    │
│ (Cloud Run)  │
└──────┬───────┘
       │ (4) Token検証
       │     - 署名確認
       │     - 有効期限確認
       │     - Issuer確認
       ▼
┌──────────────┐
│  Authorized  │
│   Request    │
└──────────────┘
```

### 2.2 OAuth2実装 (Backend)

**Token検証:**

```python
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

async def verify_token(token: str) -> dict:
    """
    Google ID Tokenを検証

    Args:
        token: Bearer Token

    Returns:
        ペイロード (user_id, email等)

    Raises:
        ValueError: トークン検証失敗
    """
    try:
        # Google公開鍵で署名検証
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            audience="YOUR_CLIENT_ID"
        )

        # Issuer確認
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Invalid issuer')

        # 有効期限確認 (自動)

        return idinfo

    except ValueError as e:
        raise ValueError(f'Token verification failed: {e}')
```

**FastAPI依存関係:**

```python
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    """
    現在のユーザー情報を取得

    Args:
        credentials: Bearer Token

    Returns:
        ユーザー情報

    Raises:
        HTTPException: 認証失敗
    """
    try:
        user_info = await verify_token(credentials.credentials)
        return user_info
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

# エンドポイントで使用
@app.post("/search")
async def search(
    request: SearchRequest,
    current_user: dict = Depends(get_current_user)
):
    # current_userでアクセス制御
    ...
```

### 2.3 Role-Based Access Control (RBAC)

**ロール定義:**

| ロール | 説明 | 権限 |
|--------|------|------|
| admin | 管理者 | 全機能アクセス、医療用語辞書編集 |
| nurse | 看護師 | 検索、チャット、自分の記録編集 |
| care_manager | ケアマネージャー | 検索、チャット、利用者情報閲覧 |
| readonly | 閲覧者 | 検索のみ |

**実装:**

```python
def check_permission(user: dict, required_role: str) -> bool:
    """
    権限チェック

    Args:
        user: ユーザー情報
        required_role: 必要なロール

    Returns:
        True: 権限あり, False: 権限なし
    """
    role_hierarchy = {
        'admin': 4,
        'nurse': 3,
        'care_manager': 2,
        'readonly': 1
    }

    user_role = user.get('role', 'readonly')
    return role_hierarchy.get(user_role, 0) >= role_hierarchy.get(required_role, 0)

# エンドポイントで使用
@app.post("/terms/edit")
async def edit_term(
    request: EditTermRequest,
    current_user: dict = Depends(get_current_user)
):
    if not check_permission(current_user, 'admin'):
        raise HTTPException(status_code=403, detail="管理者権限が必要です")
    ...
```

---

## 3. データ保護

### 3.1 暗号化

**通信暗号化:**
- Frontend ⇔ Backend: TLS 1.3
- Backend ⇔ Vertex AI: TLS 1.3
- Backend ⇔ Spreadsheet: Google API (TLS 1.3)

**保存データ暗号化:**
- Spreadsheet: Google管理暗号化 (AES-256)
- Cloud Run環境変数: Google Secret Manager
- ログデータ: Cloud Logging暗号化

### 3.2 個人情報マスキング

**ログ出力時:**

```python
import re

def mask_personal_info(text: str) -> str:
    """
    個人情報をマスキング

    Args:
        text: 元のテキスト

    Returns:
        マスク済みテキスト
    """
    # 名前 (漢字2-4文字) → ***
    text = re.sub(r'[一-龯]{2,4}(?=さん|様|氏)', '***', text)

    # 電話番号 → 0XX-****-XXXX
    text = re.sub(r'0\d{1,4}-\d{4}-\d{4}', lambda m: f"{m.group()[:3]}-****-{m.group()[-4:]}", text)

    # 住所 → 県市区まで残す
    text = re.sub(r'(都|道|府|県)(.*?)(市|区|町|村)', r'\1\2\3以降マスク', text)

    return text
```

### 3.3 データ保持期間

| データ | 保持期間 | 削除方法 |
|--------|---------|---------|
| KnowledgeBase | 5年 | 自動アーカイブ |
| Embeddings | 5年 | KnowledgeBaseと連動 |
| ChatHistory | 90日 | 自動削除 (定期実行) |
| ログ | 30日 | Cloud Logging自動削除 |

**自動削除スクリプト:**

```javascript
// GASで定期実行 (毎日午前2時)
function cleanupOldChatHistory() {
  const ss = SpreadsheetApp.openById(VECTOR_DB_CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName('ChatHistory');

  const data = sheet.getDataRange().getValues();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  let deleteCount = 0;

  for (let i = data.length - 1; i > 0; i--) {
    const timestamp = new Date(data[i][7]);  // timestamp列
    if (timestamp < cutoffDate) {
      sheet.deleteRow(i + 1);
      deleteCount++;
    }
  }

  Logger.log(`削除したChatHistory: ${deleteCount}件`);
}
```

---

## 4. 入力検証

### 4.1 Frontend検証

```typescript
import { z } from 'zod';

const searchSchema = z.object({
  query: z.string()
    .min(1, '検索クエリを入力してください')
    .max(500, '検索クエリは500文字以内で入力してください'),
  user_id: z.string().optional(),
  top_k: z.number().min(1).max(50).optional()
});

// 使用例
try {
  const validated = searchSchema.parse(formData);
  await searchAPI(validated);
} catch (error) {
  if (error instanceof z.ZodError) {
    toast.error(error.errors[0].message);
  }
}
```

### 4.2 Backend検証

```python
from pydantic import BaseModel, Field, validator

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    user_id: Optional[str] = Field(None, max_length=100)
    top_k: Optional[int] = Field(10, ge=1, le=50)

    @validator('query')
    def sanitize_query(cls, v):
        # HTMLタグ除去
        v = re.sub(r'<[^>]+>', '', v)
        # スクリプトタグ除去
        v = re.sub(r'<script.*?</script>', '', v, flags=re.DOTALL)
        return v.strip()
```

### 4.3 SQLインジェクション対策

**Spreadsheet APIは安全** (Google Sheets API v4使用、SQLクエリなし)

**将来のRDBMS移行時:**
```python
# NG: 文字列連結
query = f"SELECT * FROM records WHERE id = '{record_id}'"

# OK: パラメータ化クエリ
query = "SELECT * FROM records WHERE id = ?"
cursor.execute(query, (record_id,))
```

---

## 5. APIセキュリティ

### 5.1 レート制限

**実装 (FastAPI + slowapi):**

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/search")
@limiter.limit("100/minute")
async def search(
    request: Request,
    search_request: SearchRequest
):
    ...

@app.post("/chat/stream")
@limiter.limit("20/minute")
async def chat_stream(
    request: Request,
    chat_request: ChatRequest
):
    ...
```

### 5.2 CORS設定

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # 開発
        "https://rag-frontend-xxx.vercel.app"  # 本番
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=3600
)
```

### 5.3 Content Security Policy (CSP)

**Frontend (Next.js):**

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self';
      connect-src 'self' https://rag-backend-xxx.run.app;
      frame-ancestors 'none';
    `.replace(/\s{2,}/g, ' ').trim()
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  }
};
```

---

## 6. シークレット管理

### 6.1 Google Secret Manager

**シークレット作成:**

```bash
# APIキー保存 (使用しない方針だが、将来のため)
echo -n "YOUR_SECRET_VALUE" | \
  gcloud secrets create vertex-ai-key \
  --data-file=- \
  --replication-policy="automatic"

# アクセス権限付与
gcloud secrets add-iam-policy-binding vertex-ai-key \
  --member="serviceAccount:rag-backend@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Backend で使用:**

```python
from google.cloud import secretmanager

def get_secret(secret_id: str) -> str:
    """
    Secret Managerからシークレット取得

    Args:
        secret_id: シークレットID

    Returns:
        シークレット値
    """
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{GCP_PROJECT_ID}/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode('UTF-8')
```

### 6.2 環境変数管理

**NG: コードにハードコード**
```python
API_KEY = "AIzaSyD..."  # NG
```

**OK: 環境変数**
```python
import os
API_KEY = os.getenv("API_KEY")  # OK
```

**OK: Secret Manager**
```python
API_KEY = get_secret("vertex-ai-key")  # BEST
```

---

## 7. 監査ログ

### 7.1 ログ記録項目

| イベント | 記録項目 |
|---------|---------|
| 検索実行 | user_id, query, timestamp, results_count |
| チャット実行 | user_id, message, session_id, timestamp |
| 用語確認 | user_id, original_term, selected_term, timestamp |
| 認証成功 | user_id, email, timestamp, ip_address |
| 認証失敗 | email, timestamp, ip_address, reason |
| API呼び出し | endpoint, user_id, timestamp, latency, status_code |

### 7.2 Cloud Logging実装

```python
import logging
from google.cloud import logging as gcp_logging

# Cloud Logging クライアント
logging_client = gcp_logging.Client()
logger = logging_client.logger('rag-backend')

def log_search_event(user_id: str, query: str, results_count: int):
    """
    検索イベントをログ記録

    Args:
        user_id: ユーザーID
        query: 検索クエリ (個人情報マスク済み)
        results_count: 結果件数
    """
    logger.log_struct({
        'event': 'search',
        'user_id': user_id,
        'query': mask_personal_info(query),
        'results_count': results_count,
        'timestamp': datetime.now().isoformat()
    }, severity='INFO')
```

### 7.3 ログ監査

**BigQueryにエクスポート:**

```bash
# ログシンク作成
gcloud logging sinks create rag-audit-logs \
  bigquery.googleapis.com/projects/$GCP_PROJECT_ID/datasets/audit_logs \
  --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="rag-backend"'
```

**BigQueryで分析:**

```sql
-- 日別検索回数
SELECT
  DATE(timestamp) as date,
  COUNT(*) as search_count
FROM `audit_logs.cloudaudit_googleapis_com_activity`
WHERE jsonPayload.event = 'search'
GROUP BY date
ORDER BY date DESC;

-- ユーザー別検索回数
SELECT
  jsonPayload.user_id,
  COUNT(*) as search_count
FROM `audit_logs.cloudaudit_googleapis_com_activity`
WHERE jsonPayload.event = 'search'
GROUP BY jsonPayload.user_id
ORDER BY search_count DESC;
```

---

## 8. 脆弱性対策

### 8.1 依存関係管理

**Python (Dependabot有効化):**

```bash
# セキュリティ脆弱性チェック
pip install safety
safety check --file requirements.txt

# アップデート
pip install --upgrade package-name
```

**Node.js (npm audit):**

```bash
npm audit
npm audit fix
```

### 8.2 定期的セキュリティスキャン

```bash
# Cloud Buildで自動実行
gcloud builds submit --config cloudbuild-security.yaml
```

**cloudbuild-security.yaml:**

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/rag-backend', '.']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        gcloud artifacts docker images scan gcr.io/$PROJECT_ID/rag-backend \
          --format='value(response.scan)' > /workspace/scan_id.txt

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        gcloud artifacts docker images list-vulnerabilities \
          $(cat /workspace/scan_id.txt) --format=json
```

---

## 9. インシデント対応

### 9.1 セキュリティインシデント対応フロー

```
(1) 検知
    ↓
(2) 初期対応
    - サービス停止判断
    - 影響範囲特定
    ↓
(3) 調査
    - ログ分析
    - 原因特定
    ↓
(4) 封じ込め
    - 脆弱性修正
    - パッチ適用
    ↓
(5) 復旧
    - サービス再開
    - 監視強化
    ↓
(6) 事後対応
    - インシデントレポート作成
    - 再発防止策実施
```

### 9.2 緊急連絡先

| 役割 | 担当者 | 連絡先 |
|-----|--------|--------|
| セキュリティ責任者 | 浅井氏 | t.asai@fractal-group.co.jp |
| 技術リード | Claude Code | - |
| GCP管理者 | IT部門 | it-support@fractal-group.co.jp |

---

## 10. コンプライアンス

### 10.1 個人情報保護法対応

- [x] 利用目的の明示
- [x] 本人同意の取得
- [x] 安全管理措置 (暗号化、アクセス制御)
- [x] 保存期間の定義
- [x] 削除手順の確立

### 10.2 医療情報システム安全管理ガイドライン

- [x] アクセス制御 (RBAC)
- [x] 監査証跡 (Cloud Logging)
- [x] バックアップ (Spreadsheet版履歴)
- [x] 暗号化通信 (TLS 1.3)

---

**最終更新**: 2025-10-27
**バージョン**: 1.0.0
