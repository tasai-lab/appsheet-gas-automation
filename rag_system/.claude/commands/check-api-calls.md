# API呼び出し回数確認

## 目的

現在のAPI呼び出し回数を確認し、異常な増加がないかチェックする

## 実行内容

1. GASのAPI呼び出しカウンター確認
2. Backend (FastAPI) のメトリクス確認
3. Cloud Loggingで過去24時間のAPI呼び出し数確認
4. 閾値超過の警告

## 手順

### 1. GAS カウンター確認

```bash
# GASエディタでScript Propertiesを確認
# 以下の関数を実行
```

```javascript
function checkApiCallCounts() {
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd');

  Logger.log('=== API呼び出しカウンター (今日) ===');

  const keys = props.getKeys();
  keys.forEach(key => {
    if (key.includes(`API_CALL_COUNT_`) && key.includes(today)) {
      const count = props.getProperty(key);
      const apiName = key.replace(`API_CALL_COUNT_`, '').replace(`_${today}`, '');
      Logger.log(`${apiName}: ${count}回`);

      // 閾値チェック
      if (parseInt(count) > 100) {
        Logger.log(`⚠️ 警告: ${apiName}が${count}回 (閾値: 100回)`);
      }
    }
  });

  Logger.log('=====================================');
}
```

### 2. Cloud Logging確認

```bash
cd rag_system

# 過去24時間のVertex AI Embeddings API呼び出し数
gcloud logging read \
  "resource.type=cloud_run_revision AND jsonPayload.message=~'Vertex AI Embeddings API'" \
  --limit 1000 \
  --freshness 24h \
  --format json | jq '. | length'

# 過去24時間のVertex AI Generation API呼び出し数
gcloud logging read \
  "resource.type=cloud_run_revision AND jsonPayload.message=~'Vertex AI Generation API'" \
  --limit 1000 \
  --freshness 24h \
  --format json | jq '. | length'
```

### 3. Backend メトリクス確認 (実装後)

```bash
# ローカル
curl http://localhost:8000/metrics | grep api_call_count

# 本番
curl https://rag-backend-xxx.run.app/metrics | grep api_call_count
```

## 期待結果

- Vertex AI Embeddings: < 100回/日
- Vertex AI Generation: < 1000回/日
- 合計: < 1100回/日

## 警告閾値

| API | 警告閾値 | Critical閾値 |
|-----|---------|-------------|
| Vertex AI Embeddings | 100回/日 | 500回/日 |
| Vertex AI Generation | 1000回/日 | 5000回/日 |

## アクション

閾値超過時:
1. `docs/ERROR_LOG.md` にエラー記録
2. ログで原因調査 (リトライループがないか確認)
3. 必要に応じてサービス停止
4. 修正後に再デプロイ

---

**最終更新**: 2025-10-27
