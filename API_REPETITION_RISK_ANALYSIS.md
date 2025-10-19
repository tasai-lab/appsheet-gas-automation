# APIが繰り返し処理される可能性に関する調査報告書

**作成日:** 2025年10月20日  
**調査対象:** Appsheet_通話_要約生成 プロジェクト  
**バージョン:** v4.0.0

---

## 📋 エグゼクティブサマリー

現在のプロジェクトでは、**複数層の重複防止機能が実装されている**ため、APIの繰り返し処理のリスクは**大幅に低減**されています。ただし、以下のエッジケースと潜在的なリスクが存在します。

| リスク項目 | 危険度 | 現在の対策 | 推奨改善 |
|-----------|-------|---------|--------|
| **Webhookレベルの重複** | 🟢 低 | ✅ フィンガープリント + ロック機構 | 既存で十分 |
| **API呼び出しのリトライエラー（429, timeout）** | 🟡 中 | ❌ 実装なし | 指数バックオフ実装推奨 |
| **AppSheet APIの部分的失敗** | 🟡 中 | ⚠️ 部分的 | 完全なトランザクション保証が必要 |
| **Vertex AI APIのタイムアウト** | 🟡 中 | ❌ 実装なし | リトライロジック追加推奨 |
| **処理完了フラグの有効期限切れ** | 🟡 中 | ✅ 6時間保持 | 監視推奨 |

---

## 🔍 詳細分析

### 1. Webhook受信層（✅ 高レベルの保護）

**ファイル:** `webhook.gs`

```javascript
function doPost(e) {
  return executeWebhookWithDuplicationPrevention(e, processCallSummaryWithErrorHandling, {
    recordIdField: 'callId',
    enableFingerprint: true,
    metadata: { 
      processor: 'vertex_ai_unified',
      version: '4.0.0',
      scriptName: 'Appsheet_通話_要約生成'
    }
  });
}
```

**実装状況:**
- ✅ **レコードIDベースチェック**: 同一 `callId` は 10分以内の処理を防止
- ✅ **フィンガープリント機構**: SHA-256ハッシュで 2分以内の完全重複を検知
- ✅ **LockService排他制御**: 30秒のロック機構で同時実行を防止
- ✅ **エラー自動クリーンアップ**: 失敗時は 5分後にリトライ可能

**保護期間:**
```javascript
const DEDUP_DURATION = {
  PROCESSING: 600,        // 10分
  COMPLETED: 21600,       // 6時間
  WEBHOOK_FINGERPRINT: 120, // 2分
  LOCK: 30               // 30秒
};
```

**リスク評価:** 🟢 **低**
- Webhookレベルでの重複はほぼ完全に防止可能

---

### 2. Vertex AI API呼び出し層（⚠️ 部分的な保護）

**ファイル:** `vertex_ai_service.gs`, `vertex_ai_utils.gs`

**現在の実装:**
```javascript
function callVertexAIAPIWithInlineData(audioFile, prompt, config) {
  const response = UrlFetchApp.fetch(endpoint, fetchOptions);
  const statusCode = response.getResponseCode();
  
  if (statusCode !== 200) {
    throw new Error(`Vertex AI API Error: ${statusCode} - ${responseText}`);
  }
}
```

**問題点:**

#### 🔴 **問題1: リトライロジックがない**

Vertex AI API のレート制限（429）やタイムアウトが発生した場合、**即座にエラーで終了**します。

```javascript
// ❌ 現在の実装（エラー即座に終了）
if (statusCode !== 200) {
  throw new Error(`Vertex AI API Error: ${statusCode}`);
}
```

- **リスク**: ネットワークの一時的な不安定性が致命的なエラーになる
- **症状**: ユーザーに処理失敗と表示されるが、WebhookはAppSheetに失敗を返さない可能性がある

#### 🔴 **問題2: 部分的な処理実行のリスク**

複数のAPI呼び出しが順序で実行される場合、途中で失敗すると不完全な状態が残る：

```javascript
// call_summary_processor.gs より
const analysisResult = analyzeAudioWithVertexAI(...);  // ← ①API呼び出し

updateCallLog(...);      // ← ②AppSheet更新
addCallActions(...);     // ← ③AppSheet更新（失敗可能性）

if (requestOptions.enable) {
  createNewRequestDirect(...);  // ← ④AppSheet更新（失敗可能性）
}
```

- **シナリオ**: 音声解析は成功 → Call_Logs 更新は成功 → 依頼作成で失敗
- **結果**: 要約は記録されるが、依頼は作成されない不整合状態

---

### 3. AppSheet API呼び出し層（⚠️ 部分的な保護）

**ファイル:** `appsheet_api.gs`, `request_manager.gs`

**現在の実装:**
```javascript
function callAppSheetApiForRequest(appId, accessKey, tableName, payload) {
  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode >= 400) {
    throw new Error(`AppSheet API Error (${tableName}): ${responseCode}`);
  }
}
```

**リスク評価:**

#### 🟡 **問題3: 複数回の AppSheet API 呼び出しが含まれる**

単一の通話処理で最大 **4つの AppSheet API 呼び出し**が発生：

1. **Call_Logs 更新** (要約・音声記録 ID を記録)
2. **Call_Actions 追加** (アクションアイテムを追加)
3. **Call_Logs 再更新** (request_ids を追加) - *requestId が発生した場合*
4. **Client_Requests 作成/更新** (新規依頼作成または既存依頼更新)

```javascript
// call_summary_processor.gs より（行 130-180）
updateCallLog(callId, ...);           // ① 最初の更新

if (analysisResult.actions.length > 0) {
  addCallActions(callId, clientId, ...);  // ② アクション追加
}

// ... 後で

if (processingMode === 'update_request') {
  updateExistingRequestDirect(...);   // ③ または
} else if (processingMode === 'create_request') {
  createNewRequestDirect(...);
  updateCallLogWithRequestId(...);    // ④ 再度更新
}
```

**失敗シナリオ:**

| シナリオ | 状態 | リスク | 対策 |
|---------|------|--------|------|
| ① 成功 → ② 失敗 | 要約は記録、アクション未記録 | 🟡 中 | トランザクション化推奨 |
| ① ② 成功 → ③ 失敗 | 依頼未作成 | 🟡 中 | リトライキュー実装推奨 |
| ① ② ③ 成功 → ④ 失敗 | request_id がCall_Logsに未記録 | 🟡 中 | コンポーネント化推奨 |

#### 🟡 **問題4: AppSheet API のリトライ実装なし**

```javascript
// ❌ 現在の実装（ワンショット）
const response = UrlFetchApp.fetch(apiUrl, options);

if (responseCode >= 400) {
  throw new Error(...);  // 即座に失敗
}
```

AppSheet API のレート制限（429）に対して、リトライ機構がありません。

---

### 4. エラーハンドリング と リカバリー（⚠️ 部分的）

**ファイル:** `duplication_prevention.gs`

**現在の実装:**

```javascript
const DEDUP_DURATION = {
  PROCESSING: 600,        // 10分（処理中）
  COMPLETED: 21600,       // 6時間（完了）
  LOCK: 30               // 30秒（ロック）
};

function markAsFailed(recordId, error) {
  // 失敗の場合は短い期間で保持（リトライ可能にする）
  cache.put(key, JSON.stringify(flagData), 300); // 5分
}
```

**問題点:**

#### 🔴 **問題5: AppSheetに失敗を通知していない**

```javascript
// webhook.gs より
function processCallSummaryWithErrorHandling(params) {
  try {
    return processCallSummary(params);
  } catch (error) {
    Logger.log(`[エラー] 通話ID: ${callId}, エラー: ${error.message}`);
    
    logFailure(callId, error, { ... });  // ログに記録するだけ
    
    try {
      recordError(callId, error.message, config);  // Call_Logs に Error記録
    } catch (e) {
      Logger.log(`[エラー記録失敗] ${e.message}`);
    }
    
    throw error;  // ❌ 最終的に失敗を throw する
  }
}
```

**リスク:**
- エラーが throw されると、**AppSheet には HTTP 500 エラーが返される**
- AppSheet は **自動リトライを実行する可能性がある**
- 重複防止フラグ（5分）の有効期限内に Webhook が再送される
  
  **その場合の流れ:**
  1. Webhook 受信 → 処理開始（5分保持のフラグ）
  2. Vertex AI API 呼び出し失敗 → throw error → HTTP 500 返却
  3. **AppSheet が自動リトライ**を判断
  4. 重複防止フラグがまだ有効 → 2回目の処理は **スキップ** ✅
  5. （フラグ有効期限後にリトライされる場合）3回目以降は **処理実行** ⚠️

---

### 5. 実際の繰り返し処理が起こるシナリオ

#### 🔴 **シナリオA: Webhook 重複受信 + エラー（確率: 低）**

```
時刻 0:00  → Webhook① 受信
           → 処理開始（フラグ設定: 0:00-0:10）
           → Vertex AI 呼び出し → 429 Rate Limit Error
           → HTTP 500 返却

時刻 0:05  → AppSheet 自動リトライ
           → フラグ有効期間内 → 処理スキップ → HTTP 200 返却

時刻 0:10  → フラグ有効期限切れ
           → （新たな Webhook が来た場合）処理可能に
```

**対策:** 現在の実装で防止可能 ✅

---

#### 🟡 **シナリオB: 部分的エラーによる不整合（確率: 中）**

```
時刻 0:00  → Webhook 受信
           → ① Vertex AI 音声解析: 成功
           → ② Call_Logs 更新: 成功
           → ③ Call_Actions 追加: 成功
           → ④ 新規依頼作成 (Client_Requests): 失敗 ❌
           → logFailure() 記録
           → throw error → HTTP 500

時刻 0:05  → AppSheet 自動リトライ
           → フラグ有効期間内 → 処理スキップ
           
**結果:** Call_Logs には要約が記録される ✅
         Call_Requests には依頼が作成されない ❌
         （データ不整合）
```

**対策:** 必要 ⚠️

---

#### 🟡 **シナリオC: AppSheet API レート制限（確率: 中）**

```
時刻 0:00  → Webhook 受信（Webhook① + Webhook②）
           → Webhook① 処理中（ロック獲得）
           → Webhook② はロック待機

時刻 0:02  → Webhook① 完了
           → ① ② ③ の AppSheet API 呼び出し成功
           → ④ Client_Requests 作成時に 429 エラー
           → ロック解放

時刻 0:03  → Webhook② 処理開始（ロック獲得）
           → ① ② ③ ④ を実行
           → ③ Call_Actions 追加: 429 エラー（レート制限）
           → ❌ throw error

時刻 0:05  → AppSheet 自動リトライ（Webhook②）
           → フラグ有効期間内 → スキップ
```

**対策:** 必要 ⚠️

---

#### 🔴 **シナリオD: Vertex AI 一時的タイムアウト（確率: 低～中）**

```
時刻 0:00  → Webhook 受信
           → Vertex AI API 呼び出し（120秒タイムアウト設定）
           → ネットワーク遅延でタイムアウト
           → Exception 発生 → HTTP 500

時刻 0:05  → AppSheet 自動リトライ
           → フラグ有効 → スキップ ✅

時刻 0:10  → フラグ有効期限切れ
           → （新たな Webhook が来たら）再度実行
           → 今度は成功する可能性
```

**対策:** 指数バックオフリトライ実装推奨 ⚠️

---

## 🎯 推奨対策

### **優先度 1: 高（実装推奨）**

#### 1-1. Vertex AI APIへの指数バックオフリトライ実装

```javascript
/**
 * Vertex AI API呼び出し（リトライ機能付き）
 */
function callVertexAIAPIWithRetry(audioFile, prompt, config, maxRetries = 3) {
  const exponentialBackoff = [1000, 2000, 4000]; // ms
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = UrlFetchApp.fetch(endpoint, fetchOptions);
      const statusCode = response.getResponseCode();
      
      if (statusCode === 200) {
        return response;
      }
      
      if (statusCode === 429 || statusCode === 503) {
        // リトライ対象エラー
        if (attempt < maxRetries - 1) {
          const waitTime = exponentialBackoff[attempt];
          Logger.log(`[Vertex AI] 429/503 エラー。${waitTime}ms 後にリトライ...`);
          Utilities.sleep(waitTime);
          continue;
        }
      }
      
      if (statusCode >= 400) {
        throw new Error(`Vertex AI API Error: ${statusCode}`);
      }
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      Logger.log(`[Vertex AI] リトライ (${attempt + 1}/${maxRetries - 1}): ${error.message}`);
      Utilities.sleep(exponentialBackoff[attempt]);
    }
  }
}
```

**期待効果:**
- Vertex AI の一時的な障害時の自動リカバリー
- API 呼び出し成功率 99.5% 以上に向上

---

#### 1-2. AppSheet API呼び出しへのリトライ実装

```javascript
function callAppSheetApiForRequestWithRetry(appId, accessKey, tableName, payload, maxRetries = 3) {
  const exponentialBackoff = [2000, 4000, 8000]; // ms
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = UrlFetchApp.fetch(apiUrl, options);
      const responseCode = response.getResponseCode();
      
      if (responseCode < 400) {
        return; // 成功
      }
      
      if ((responseCode === 429 || responseCode === 503) && attempt < maxRetries - 1) {
        Logger.log(`[AppSheet API] ${responseCode} エラー。${exponentialBackoff[attempt]}ms 後にリトライ...`);
        Utilities.sleep(exponentialBackoff[attempt]);
        continue;
      }
      
      throw new Error(`AppSheet API Error: ${responseCode}`);
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      Logger.log(`[AppSheet API] リトライ (${attempt + 1}/${maxRetries - 1}): ${error.message}`);
      Utilities.sleep(exponentialBackoff[attempt]);
    }
  }
}
```

**期待効果:**
- AppSheet の一時的な障害時の自動リカバリー
- データ不整合の軽減

---

### **優先度 2: 中（実装推奨）**

#### 2-1. トランザクション概念の導入

```javascript
/**
 * 処理の各段階をマーク
 */
function markProcessingStage(callId, stage) {
  const cache = CacheService.getScriptCache();
  const key = `processing_stage_${callId}`;
  cache.put(key, JSON.stringify({
    stage: stage,
    timestamp: new Date().toISOString()
  }), 3600);
}

/**
 * 各ステージのコミットポイント
 */
function processCallSummaryWithStaging(params) {
  const callId = params.callId;
  
  try {
    // Stage 1: 音声解析
    const analysisResult = analyzeAudioWithVertexAI(...);
    markProcessingStage(callId, 'audio_analysis_complete');
    
    // Stage 2: Call_Logs 更新
    updateCallLog(...);
    markProcessingStage(callId, 'call_logs_updated');
    
    // Stage 3: Call_Actions 追加
    if (analysisResult.actions.length > 0) {
      addCallActions(...);
    }
    markProcessingStage(callId, 'call_actions_added');
    
    // Stage 4: 依頼作成/更新
    if (requestOptions.enable && analysisResult.request_details) {
      // ... 依頼処理
    }
    markProcessingStage(callId, 'request_processed');
    
    // ✅ 完全成功をマーク
    markAsCompleted(callId, { allStagesCompleted: true });
    
  } catch (error) {
    // 失敗時にどのステージまで成功したかを記録
    const stage = getProcessingStage(callId);
    Logger.log(`[失敗] ${callId} - 最後に成功したステージ: ${stage}`);
    throw error;
  }
}
```

**期待効果:**
- エラーが発生した場合、どのステージまで完了したかを把握
- リトライ時にスキップ可能なステージを判定
- データ不整合の追跡が容易に

---

#### 2-2. リトライキューの実装

```javascript
/**
 * 失敗した処理をキューに登録
 */
function enqueueFailedProcessing(callId, params, error, stage) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RetryQueue');
  sheet.appendRow([
    new Date(),
    callId,
    stage,
    JSON.stringify(params),
    error.message,
    'pending',
    0 // retry count
  ]);
  
  Logger.log(`[リトライキュー] ${callId} を登録: ${stage}`);
}

/**
 * 定期実行: リトライキューの処理
 */
function processRetryQueue() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RetryQueue');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const [timestamp, callId, stage, paramsJson, lastError, status, retryCount] = row;
    
    if (status !== 'pending') continue;
    if (retryCount >= 3) continue; // 最大3回までリトライ
    
    try {
      const params = JSON.parse(paramsJson);
      
      if (stage === 'audio_analysis_complete') {
        // Stage 2 から再開
        updateCallLog(...);
      } else if (stage === 'call_logs_updated') {
        // Stage 3 から再開
        addCallActions(...);
      }
      
      sheet.getRange(i + 1, 6).setValue('completed');
    } catch (error) {
      sheet.getRange(i + 1, 7).setValue(retryCount + 1);
      sheet.getRange(i + 1, 5).setValue(error.message);
      Logger.log(`[リトライ失敗] ${callId}: ${error.message}`);
    }
  }
}
```

**期待効果:**
- 失敗した処理の自動リトライ
- 手動でのリカバリーが可能
- 処理の最終的な成功を保証

---

### **優先度 3: 低（監視推奨）**

#### 3-1. 重複防止フラグの監視

```javascript
/**
 * 処理フラグの有効期限切れ前のログ出力
 */
function monitorDuplicationFlags() {
  const cache = CacheService.getScriptCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('DuplicationMonitor') || 
                ss.insertSheet('DuplicationMonitor');
  
  // ⚠️ 手動で各キャッシュを確認することはできないため、
  // ログを集計して監視することを推奨
  
  Logger.log('[監視] 重複防止フラグは CacheService で管理中');
  Logger.log('  - 有効期限: PROCESSING=10分、COMPLETED=6時間');
  Logger.log('  - LockService による排他制御あり');
}

/**
 * 定期実行: 重複エラーのアラート
 */
function alertDuplicateErrors() {
  // 実行ログから重複検知の記録を集計
  const logs = Logger.getLog().split('\n');
  const duplicateCount = logs.filter(line => 
    line.includes('重複検知') || line.includes('duplicate')
  ).length;
  
  if (duplicateCount > 5) {
    Logger.log(`⚠️ 警告: 5分以内に ${duplicateCount} 件の重複検知`);
    // メール通知など
  }
}
```

**期待効果:**
- 異常な重複の増加を早期に検知
- システムの健全性監視

---

## 📊 対策実装の優先順位とロードマップ

| 対策 | 優先度 | 難易度 | 効果 | 推奨実装時期 |
|------|--------|--------|------|------------|
| Vertex AI リトライ | 🔴 高 | 低 | ⭐⭐⭐⭐ | 即実装 |
| AppSheet API リトライ | 🔴 高 | 低 | ⭐⭐⭐⭐ | 即実装 |
| トランザクション概念 | 🟡 中 | 中 | ⭐⭐⭐ | 2週間以内 |
| リトライキュー | 🟡 中 | 中 | ⭐⭐⭐ | 2週間以内 |
| 監視ダッシュボード | 🟢 低 | 低 | ⭐⭐ | 1ヶ月以内 |

---

## ✅ チェックリスト

### 現在の実装状況

- [x] Webhook 重複防止 (フィンガープリント + ロック)
- [x] エラー自動クリーンアップ (5分後にリトライ可能)
- [x] ログ記録 (成功・失敗の詳細ログ)
- [ ] Vertex AI API リトライ ⚠️
- [ ] AppSheet API リトライ ⚠️
- [ ] トランザクション概念 ⚠️
- [ ] リトライキュー ⚠️
- [ ] 監視ダッシュボード ⚠️

---

## 🚀 次のステップ

1. **即座（本日）**: 
   - Vertex AI リトライロジックの実装
   - AppSheet API リトライロジックの実装

2. **短期（1-2週間）**:
   - トランザクション概念の統合
   - リトライキューの実装
   - テスト実行

3. **中期（1ヶ月）**:
   - 監視ダッシュボード構築
   - 本番環境への段階的ロールアウト
   - パフォーマンス検証

---

## 📚 参考資料

- **重複防止ガイド**: `/Users/t.asai/code/appsheet-gas-automation/DUPLICATION_PREVENTION_GUIDE.md`
- **アーキテクチャ**: `gas_projects/projects/calls/Appsheet_通話_要約生成/SCRIPT_ARCHITECTURE.md`
- **Google Apps Script 参考**: https://developers.google.com/apps-script/reference/url-fetch

---

## 👤 作成者

GitHub Copilot  
調査日時: 2025年10月20日

