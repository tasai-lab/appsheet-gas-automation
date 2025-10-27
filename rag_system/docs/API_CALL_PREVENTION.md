# API呼び出し爆発防止ガイドライン

## ⚠️ 重要: このガイドラインは絶対遵守すること

過去の経験から、Google AI Studio APIで1日200,000リクエストという異常な使用量が発生し、90%エラー率に至った事例があります。

**本RAGシステムでは、この悪夢を絶対に繰り返さないため、以下のガイドラインを厳守します。**

---

## 1. 基本原則: 1処理 = 1API呼び出し

### ❌ 禁止パターン

```javascript
// NG: リトライループ
function callAPI() {
  const maxRetries = 3;  // ❌ 絶対禁止
  for (let i = 0; i < maxRetries; i++) {
    try {
      return actualAPICall();
    } catch (error) {
      if (i < maxRetries - 1) {
        Utilities.sleep(1000);
        continue;  // ❌ 再試行は爆発の元
      }
    }
  }
}
```

```javascript
// NG: whileループリトライ
function callAPI() {
  let success = false;
  let attempts = 0;
  while (!success && attempts < 5) {  // ❌ 絶対禁止
    try {
      actualAPICall();
      success = true;
    } catch (error) {
      attempts++;
      Utilities.sleep(2000);
    }
  }
}
```

```javascript
// NG: 再帰的リトライ
function callAPI(retryCount = 0) {
  try {
    return actualAPICall();
  } catch (error) {
    if (retryCount < 3) {  // ❌ 絶対禁止
      Utilities.sleep(1000);
      return callAPI(retryCount + 1);  // 再帰呼び出し
    }
  }
}
```

### ✅ 正しいパターン

```javascript
// OK: 1回のみ実行、エラーは即座にスロー
function callAPI() {
  Logger.log('API呼び出し (1回のみ実行)');

  try {
    return actualAPICall();
  } catch (error) {
    Logger.error(`API Error: ${error.toString()}`);
    throw error;  // ✅ 即座にスロー、リトライしない
  }
}
```

---

## 2. 実装時チェックリスト

全てのAPI呼び出し関数は以下を満たすこと:

- [ ] `for`ループによるリトライがないこと
- [ ] `while`ループによるリトライがないこと
- [ ] 再帰呼び出しによるリトライがないこと
- [ ] `maxRetries`, `retryCount`, `attempts`等の変数がないこと
- [ ] エラー時は即座に`throw`すること
- [ ] API呼び出し前にログ出力すること
- [ ] API呼び出し後にログ出力すること

---

## 3. RAGシステムでのAPI呼び出し箇所

### 3.1 GAS Layer (共通モジュール)

**embeddings_service.gs:**

```javascript
function createEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT', logger = null) {
  // ★★★ 1回のみ実行保証 ★★★
  if (logger) {
    logger.info(`Vertex AI Embeddings API呼び出し (タスクタイプ: ${taskType})`);
  }

  try {
    const response = UrlFetchApp.fetch(url, options);  // 1回のみ
    // ... レスポンス処理
    return embedding;
  } catch (error) {
    if (logger) {
      logger.error(`Vertex AI Embeddings API呼び出しエラー: ${error.toString()}`);
    }
    throw error;  // ✅ 即座にスロー
  }
}
```

**コメント必須:**
```javascript
// ★★★ API呼び出し: 1回のみ実行 (リトライなし) ★★★
// 理由: API爆発防止 (過去に200,000リクエスト/日の事例あり)
// 修正日: YYYY-MM-DD
```

### 3.2 Backend (FastAPI)

**services/vertex_ai.py:**

```python
async def create_embedding(self, text: str, task_type: str = "RETRIEVAL_DOCUMENT"):
    """
    Vertex AI Embeddings API呼び出し (1回のみ)

    Args:
        text: テキスト
        task_type: タスクタイプ

    Returns:
        埋め込みベクトル

    Raises:
        Exception: API呼び出しエラー (リトライなし)
    """
    logger.info(f"Vertex AI Embeddings API call (task_type={task_type})")

    try:
        # ★★★ 1回のみ実行 ★★★
        response = await self.client.predict(...)
        return response.predictions[0].embeddings.values

    except Exception as e:
        logger.error(f"Vertex AI Embeddings API error: {e}")
        raise  # ✅ 即座にraise、リトライなし
```

**リトライはアプリケーション層で制御（ユーザー判断）**:

```python
# ユーザーが明示的に再試行ボタンをクリックした場合のみ
@app.post("/search")
async def search(request: SearchRequest):
    try:
        results = await hybrid_search(request.query)
        return results
    except Exception as e:
        # ✅ エラーを返すのみ、自動リトライしない
        raise HTTPException(status_code=500, detail=str(e))
```

### 3.3 Frontend (Next.js)

```typescript
// ユーザーが再試行ボタンをクリックした場合のみ再実行
const handleSearch = async () => {
  try {
    const results = await searchAPI(query);
    setResults(results);
  } catch (error) {
    // ✅ エラー表示のみ、自動リトライしない
    toast.error('検索エラーが発生しました');
    setError(error.message);
  }
};
```

---

## 4. コードレビューチェックリスト

新規実装・変更時は必ずレビュー:

### レビュー項目

1. **ループ確認**
   - [ ] `for`ループでAPI呼び出しをしていないか
   - [ ] `while`ループでAPI呼び出しをしていないか
   - [ ] `.forEach()`, `.map()`内でAPI呼び出しをしていないか

2. **条件分岐確認**
   - [ ] `if (retry)`, `if (attempt < maxRetries)`等がないか
   - [ ] エラーハンドリング内で`continue`, `return callAPI()`等がないか

3. **変数名確認**
   - [ ] `maxRetries`, `retryCount`, `attempts`, `maxAttempts`等の変数がないか

4. **ログ確認**
   - [ ] API呼び出し前にログ出力しているか
   - [ ] API呼び出し後にログ出力しているか
   - [ ] エラー時にログ出力しているか

5. **例外処理確認**
   - [ ] エラー時に即座に`throw`/`raise`しているか
   - [ ] エラー時に再帰呼び出ししていないか

---

## 5. 監視・アラート設定

### 5.1 API呼び出し数監視

**GAS (共通モジュール):**

```javascript
// PropertiesServiceでカウンター管理
function incrementApiCallCounter(apiName, description) {
  const props = PropertiesService.getScriptProperties();
  const key = `API_CALL_COUNT_${apiName}_${Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd')}`;

  const count = parseInt(props.getProperty(key) || '0') + 1;
  props.setProperty(key, count.toString());

  Logger.log(`API呼び出しカウンター: ${apiName} = ${count}回 (${description})`);

  // ★★★ 閾値チェック ★★★
  if (count > 100) {  // 1日100回を超えたら警告
    Logger.log(`⚠️ 警告: ${apiName}の呼び出しが${count}回に達しました`);
    sendAlertEmail(`API呼び出し警告: ${apiName}が${count}回`);
  }

  return count;
}
```

**Backend (FastAPI):**

```python
from functools import wraps
import redis

redis_client = redis.Redis(host='localhost', port=6379)

def track_api_call(api_name: str):
    """
    APIデコレータ: 呼び出し数をカウント

    Args:
        api_name: API名
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # カウンター増加
            today = datetime.now().strftime('%Y-%m-%d')
            key = f"api_count:{api_name}:{today}"
            count = redis_client.incr(key)
            redis_client.expire(key, 86400 * 7)  # 7日間保持

            logger.info(f"API call: {api_name} (count={count})")

            # ★★★ 閾値チェック ★★★
            if count > 1000:  # 1日1000回を超えたら警告
                logger.warning(f"⚠️ API call threshold exceeded: {api_name} = {count}")
                await send_alert(f"API呼び出し警告: {api_name}が{count}回")

            return await func(*args, **kwargs)

        return wrapper
    return decorator

# 使用例
@track_api_call('vertex_ai_embeddings')
async def create_embedding(text: str):
    ...
```

### 5.2 Cloud Monitoring アラート

```bash
# Vertex AI API呼び出し数アラート
gcloud alpha monitoring policies create \
  --notification-channels=$CHANNEL_ID \
  --display-name="Vertex AI Embeddings Call Count Alert" \
  --condition-threshold-value=1000 \
  --condition-threshold-duration=86400s \
  --condition-filter='metric.type="aiplatform.googleapis.com/prediction/online/prediction_count" resource.type="aiplatform.googleapis.com/Endpoint"'
```

---

## 6. 緊急時の対応手順

### API呼び出し爆発が疑われる場合

1. **即座にサービス停止**
   ```bash
   # Cloud Run停止
   gcloud run services update rag-backend --no-traffic --region us-central1

   # GASデプロイ無効化
   clasp undeploy DEPLOYMENT_ID
   ```

2. **ログ確認**
   ```bash
   # 過去1時間のAPI呼び出しログ
   gcloud logging read "resource.type=cloud_run_revision AND jsonPayload.message=~'API call'" \
     --limit 1000 \
     --format json \
     --freshness 1h
   ```

3. **カウンター確認**
   ```javascript
   // GAS
   function checkApiCallCounts() {
     const props = PropertiesService.getScriptProperties();
     const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd');

     const keys = props.getKeys();
     keys.forEach(key => {
       if (key.includes(`API_CALL_COUNT_`) && key.includes(today)) {
         const count = props.getProperty(key);
         Logger.log(`${key}: ${count}回`);
       }
     });
   }
   ```

4. **原因特定**
   - リトライループがないか全ファイル検索
   ```bash
   grep -r "maxRetries\|retryCount\|while.*retry\|for.*retry" rag_system/
   ```

5. **修正・再デプロイ**
   - リトライコード削除
   - テスト実行
   - 段階的再開

---

## 7. 禁止コードパターン検出スクリプト

**check_retry_patterns.py:**

```python
import re
import sys
from pathlib import Path

# 禁止パターン
FORBIDDEN_PATTERNS = [
    r'maxRetries\s*=',
    r'retryCount\s*=',
    r'while\s+.*retry',
    r'for\s+.*retry',
    r'if\s+.*<\s*maxRetries',
    r'if\s+.*attempt\s*<',
]

def scan_file(file_path):
    """ファイルスキャン"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    violations = []
    for i, line in enumerate(content.split('\n'), 1):
        for pattern in FORBIDDEN_PATTERNS:
            if re.search(pattern, line):
                violations.append(f"{file_path}:{i} - {line.strip()}")

    return violations

def main():
    """全ファイルスキャン"""
    violations = []

    # .gs, .py, .ts, .tsxファイルをスキャン
    for ext in ['*.gs', '*.py', '*.ts', '*.tsx']:
        for file_path in Path('rag_system').rglob(ext):
            violations.extend(scan_file(file_path))

    if violations:
        print("⚠️ 禁止パターン検出:")
        for v in violations:
            print(f"  - {v}")
        sys.exit(1)
    else:
        print("✅ 禁止パターンなし")

if __name__ == '__main__':
    main()
```

**CI/CDに組み込み:**

```yaml
# .github/workflows/check_retry.yml
name: Check Retry Patterns

on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check for forbidden retry patterns
        run: python check_retry_patterns.py
```

---

## 8. 教訓: 過去の事例

### 事例1: Google AI Studio API 爆発 (2025-10-18)

**発生状況:**
- 1日200,000リクエスト (通常の100倍)
- Google AI Studio API: 20,514リクエスト/日 (無料枠1,500の13倍)
- Vertex AI: 68リクエスト/日
- エラー率: 90%

**原因:**
- `maxRetries = 2`によるリトライループ
- エラー時に最大3回のAPI呼び出し
- フォールバック処理により追加呼び出し

**修正内容:**
- リトライループ完全削除
- Google AI Studio API完全廃止
- Vertex AI APIのみ使用
- 1処理 = 1API呼び出し保証

**結論:**
> **リトライループは絶対に実装しない。エラーはユーザーに返し、ユーザー判断で再試行させる。**

---

**最終更新**: 2025-10-27
**レビュー**: 毎週必須
**違反発見時**: 即座に修正、デプロイ停止
