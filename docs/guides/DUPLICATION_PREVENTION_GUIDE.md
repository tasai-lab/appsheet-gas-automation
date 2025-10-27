# Webhook重複実行防止ライブラリ

## 概要

AppsheetからのWebhook受信時に発生する重複実行を防止するための統一ライブラリです。

## 問題点

Appsheetや外部システムからWebhookを受信する際、以下の理由で同じリクエストが複数回送信されることがあります：

1. **ネットワークの不安定性**: タイムアウトによるリトライ
2. **Appsheetの仕様**: 成功レスポンスを受け取るまで再送
3. **トリガーの誤発火**: 複数のトリガーが同時に実行

これにより、Gemini APIが複数回呼び出され、以下の問題が発生します：

- **コストの増加**: 不要なAPI呼び出し
- **データの不整合**: 同じ処理が複数回実行される
- **パフォーマンスの低下**: 無駄な処理時間

## ソリューション

本ライブラリは3層の防御機能を提供します：

### 1. レコードIDベースの重複チェック
- 処理中/完了済みのレコードIDをキャッシュで管理
- 同一レコードの再処理を防止

### 2. Webhookフィンガープリント
- リクエスト内容のSHA-256ハッシュを生成
- 完全に同一のリクエストを検知

### 3. LockService排他制御
- 同時実行を物理的に防止
- レースコンディションを回避

## インストール方法

### 方法1: ファイルコピー（推奨）

1. `DuplicationPrevention.gs` を各GASプロジェクトにコピー
2. Apps Scriptエディタで新しいファイルとして追加

### 方法2: ライブラリとして公開

1. スタンドアロンスクリプトとして `DuplicationPrevention.gs` をデプロイ
2. ライブラリIDを取得
3. 各プロジェクトで「リソース」→「ライブラリ」から追加

## 基本的な使用方法

### パターンA: 簡単な統合（推奨）

既存の`doPost`関数を最小限の変更で保護できます。

```javascript
/**
 * Webhook受信エントリーポイント
 */
function doPost(e) {
  // executeWebhookWithDuplicationPreventionに処理を委譲
  return executeWebhookWithDuplicationPrevention(e, processWebhook, {
    recordIdField: 'callId',  // レコードIDのフィールド名を指定
    enableFingerprint: true    // フィンガープリントチェック有効化
  });
}

/**
 * 実際の処理ロジック
 */
function processWebhook(params) {
  // ここに既存の処理をそのまま移動
  const callId = params.callId;
  const fileId = params.fileId;
  
  // Gemini API呼び出し
  const result = analyzeWithGemini(fileId);
  
  // AppSheet更新
  updateAppSheet(callId, result);
  
  // 結果を返す
  return {
    success: true,
    callId: callId,
    summary: result.summary
  };
}
```

### パターンB: 手動制御

より細かい制御が必要な場合は、各関数を個別に使用できます。

```javascript
function doPost(e) {
  let recordId = null;
  
  try {
    // 1. リクエスト解析
    const params = JSON.parse(e.postData.contents);
    recordId = params.callId;
    
    // 2. 重複チェック
    const dupCheck = checkDuplicateRequest(recordId, params);
    if (dupCheck.isDuplicate) {
      Logger.log(`重複リクエスト: ${dupCheck.reason}`);
      return createDuplicateResponse(recordId, dupCheck.reason);
    }
    
    // 3. 処理中フラグ設定（ロック付き）
    if (!markAsProcessingWithLock(recordId, { source: 'webhook' })) {
      return createDuplicateResponse(recordId, 'lock_failed');
    }
    
    // 4. 実際の処理
    const result = processMainLogic(params);
    
    // 5. 完了マーク
    markAsCompleted(recordId, { success: true });
    
    return createSuccessResponse(recordId, result);
    
  } catch (error) {
    // エラー時は失敗マーク（リトライ可能にする）
    if (recordId) {
      markAsFailed(recordId, error);
    }
    return createErrorResponse(recordId || 'unknown', error);
  }
}
```

## 実装例

### 例1: 通話要約生成（Gemini API使用）

```javascript
/**
 * 通話音声をGemini APIで要約
 */
function doPost(e) {
  return executeWebhookWithDuplicationPrevention(e, generateCallSummary, {
    recordIdField: 'callId',
    metadata: { type: 'call_summary' }
  });
}

function generateCallSummary(params) {
  const { callId, fileId, callDatetime } = params;
  
  // 音声ファイル取得
  const audioFile = DriveApp.getFileById(fileId);
  
  // Gemini API呼び出し
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const summary = callGeminiAPI(audioFile, apiKey);
  
  // AppSheet更新
  updateCallLog(callId, {
    summary: summary.text,
    transcript: summary.transcript,
    analyzed_at: new Date().toISOString()
  });
  
  return {
    success: true,
    callId: callId,
    summaryLength: summary.text.length
  };
}
```

### 例2: 看護記録音声入力（Gemini API使用）

```javascript
function doPost(e) {
  return executeWebhookWithDuplicationPrevention(e, processNursingRecord, {
    recordIdField: 'recordNoteId',
    enableFingerprint: true
  });
}

function processNursingRecord(params) {
  const { recordNoteId, fileId, staffId, recordType } = params;
  
  // 音声ファイル取得
  const audioBlob = getAudioBlob(fileId);
  
  // Gemini APIで音声→テキスト変換＋構造化
  const analyzed = analyzeNursingAudio(audioBlob, recordType);
  
  // スプレッドシート更新
  updateNursingRecord(recordNoteId, {
    content: analyzed.structuredData,
    staff_id: staffId,
    processed_at: new Date().toISOString()
  });
  
  return {
    success: true,
    recordNoteId: recordNoteId,
    wordCount: analyzed.wordCount
  };
}
```

### 例3: 書類OCR（Gemini Vision API使用）

```javascript
function doPost(e) {
  return executeWebhookWithDuplicationPrevention(e, processDocumentOCR, {
    recordIdField: 'documentId',
    metadata: { processor: 'gemini_vision' }
  });
}

function processDocumentOCR(params) {
  const { documentId, fileId, documentType } = params;
  
  // 画像ファイル取得
  const imageFile = DriveApp.getFileById(fileId);
  const imageBlob = imageFile.getBlob();
  
  // Gemini Vision APIでOCR処理
  const ocrResult = performOCRWithGemini(imageBlob, documentType);
  
  // 結果を保存
  saveOCRResult(documentId, ocrResult);
  
  return {
    success: true,
    documentId: documentId,
    extractedFields: Object.keys(ocrResult.fields).length
  };
}
```

## オプション設定

`executeWebhookWithDuplicationPrevention` の第3引数で設定できます：

```javascript
{
  recordIdField: 'recordId',          // レコードIDフィールド名（デフォルト: 'recordId'）
  parseRequest: true,                  // 自動でJSON.parse実行（デフォルト: true）
  enableFingerprint: true,             // フィンガープリントチェック有効化（デフォルト: true）
  autoMarkCompleted: true,             // 自動で完了マーク（デフォルト: true）
  metadata: {}                         // 追加メタデータ
}
```

## キャッシュ期間設定

必要に応じて、`DuplicationPrevention.gs` の定数を変更できます：

```javascript
const DEDUP_DURATION = {
  PROCESSING: 600,        // 10分（処理中フラグ）
  COMPLETED: 21600,       // 6時間（処理完了フラグ）
  WEBHOOK_FINGERPRINT: 120, // 2分（Webhook重複排除）
  LOCK: 30               // 30秒（ロック有効期限）
};
```

## デバッグ・メンテナンス

### レコードの状態確認

```javascript
// 特定レコードの状態を確認
const status = checkRecordStatus('call_12345');
console.log(status);
// 出力例: { exists: true, state: 'completed', completedTime: '2025-10-16T08:30:00Z' }
```

### システム情報取得

```javascript
const stats = getDuplicationPreventionStats();
console.log(stats);
```

### 処理フラグの手動クリア

```javascript
// 特定レコードのフラグをクリア（リトライを許可）
clearProcessingFlag('call_12345');
```

## ベストプラクティス

### 1. エラーハンドリング

処理中にエラーが発生した場合、`markAsFailed()`を使用します：

```javascript
try {
  const result = processData();
  markAsCompleted(recordId, result);
} catch (error) {
  markAsFailed(recordId, error);  // 5分後にリトライ可能になる
  throw error;
}
```

### 2. ログ出力

重複防止ライブラリは自動的にログを出力します：

- `✅` 正常処理
- `🔒` 重複検知
- `❌` エラー発生
- `⚠️` 警告

### 3. タイムアウト対策

Apps Scriptの最大実行時間（6分）を考慮し、長時間処理は分割してください：

```javascript
function processLargeData(params) {
  const chunks = divideIntoChunks(params.data);
  
  chunks.forEach((chunk, index) => {
    // 各チャンクに個別のrecordIdを使用
    const chunkId = `${params.recordId}_chunk_${index}`;
    processChunk(chunkId, chunk);
  });
}
```

## トラブルシューティング

### Q: 「ロック取得タイムアウト」エラーが発生する

**A**: 同時実行が多い場合に発生します。以下を確認してください：

1. 同じレコードIDで複数のwebhookが短時間に送信されていないか
2. 処理時間が長すぎないか（6分以内に収める）
3. LockServiceのタイムアウト時間を調整（デフォルト30秒）

### Q: 正常に処理したのに「重複」として拒否される

**A**: キャッシュが残っている可能性があります：

1. `checkRecordStatus(recordId)` で状態を確認
2. 必要に応じて `clearProcessingFlag(recordId)` でクリア
3. キャッシュは自動的に期限切れになります（最大6時間）

### Q: Gemini APIが複数回呼ばれてしまう

**A**: 以下を確認してください：

1. `executeWebhookWithDuplicationPrevention` を使用しているか
2. `enableFingerprint: true` が設定されているか
3. ログで重複チェックが動作しているか確認

## パフォーマンスへの影響

- **レイテンシ**: 約50-100ms増加（ロック取得とキャッシュチェック）
- **メモリ**: ほぼ影響なし（CacheServiceを使用）
- **配慮事項**: CacheServiceには容量制限（100KB/キー、1MB/スクリプト）があります

## ライセンス

MIT License

## サポート

問題が発生した場合は、ログを確認してください：

```javascript
// Apps Scriptエディタで「表示」→「ログ」
Logger.log('デバッグ情報');
```

## 更新履歴

- **v3.0.0** (2025-10-16)
  - 統合実行ラッパー関数追加
  - LockService統合
  - エラーハンドリング強化
  
- **v2.0.0** (2025-10-05)
  - Webhookフィンガープリント追加
  - 処理状態管理改善

- **v1.0.0** (2025-09-01)
  - 初回リリース
  - 基本的な重複チェック機能
