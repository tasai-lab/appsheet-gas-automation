# 共通モジュール

全てのGASプロジェクトで共通使用するモジュール群

## モジュール一覧

### 1. logger.gs - 統合ロガー
全てのスクリプトの実行ログを統一的に管理

**主な機能:**
- ログレベル管理（INFO/SUCCESS/WARNING/ERROR）
- スプレッドシートへの自動保存
- リクエストIDによるトレーサビリティ
- 古いログの自動クリーンアップ

**使用例:**
```javascript
// ロガー作成
const logger = createLogger('スクリプト名');

// ログ記録
logger.info('処理開始');
logger.success('処理成功');
logger.warning('警告メッセージ');
logger.error('エラー発生', { details: errorObject });

// スプレッドシートに保存
logger.saveToSpreadsheet('成功', 'record-123');
```

### 2. duplication_prevention.gs - 重複実行防止
Webhook受信時の重複実行を防止

**主な機能:**
- リクエストIDベースの重複チェック
- キャッシュ + Propertiesによる二重管理
- 自動リトライ機能
- タイムアウト管理

**使用例:**
```javascript
// 重複防止インスタンス作成
const dupPrevention = createDuplicationPrevention('スクリプト名');

// リトライ付き実行
const result = dupPrevention.executeWithRetry(recordId, (id) => {
  // 実際の処理
  return processRecord(id);
}, logger);

if (result.isDuplicate) {
  logger.warning('重複実行を検出しました');
  return;
}

if (!result.success) {
  logger.error('処理失敗', { error: result.error });
  return;
}
```

### 3. gemini_client.gs - Gemini APIクライアント
Gemini APIへの統一的なアクセスを提供

**主な機能:**
- モデル選択（gemini-2.5-pro / gemini-2.5-flash）
- テキスト生成
- JSON生成（自動パース）
- チャット形式生成
- 統一されたエラーハンドリング

**使用例:**
```javascript
// PROモデル使用（複雑な思考が必要）
const geminiPro = createGeminiProClient();
const summary = geminiPro.generateText(prompt, logger);

// FLASHモデル使用（標準処理）
const geminiFlash = createGeminiFlashClient();
const result = geminiFlash.generateJSON(jsonPrompt, logger);

// カスタム設定
const geminiCustom = createGeminiClient('gemini-2.5-pro', {
  temperature: 0.5,
  maxOutputTokens: 4096
});
```

### 4. appsheet_client.gs - AppSheet APIクライアント
AppSheet APIへの統一的なアクセスを提供

**主な機能:**
- レコード追加/更新/削除
- レコード検索
- エラーステータス更新
- 成功ステータス更新

**使用例:**
```javascript
// クライアント作成
const appsheet = createAppSheetClient(APP_ID, ACCESS_KEY);

// レコード更新
appsheet.updateRecords('テーブル名', [
  { record_id: '123', field1: 'value1' }
], logger);

// エラーステータス更新
appsheet.updateErrorStatus(
  'テーブル名',
  'record-123',
  'record_id',
  'エラーメッセージ',
  'status',
  'error_details',
  logger
);

// 成功ステータス更新
appsheet.updateSuccessStatus(
  'テーブル名',
  'record-123',
  'record_id',
  { result_field: '結果データ' },
  'status',
  logger
);
```

### 5. FileIdUtilities.gs - ファイルID・URL取得
共有ドライブ対応のファイル検索機能

**主な機能:**
- ファイルパスからファイルID・URLを取得
- 共有ドライブ完全対応
- エラーハンドリング
- 複数ファイルの一括取得

**使用例:**
```javascript
// 単一ファイルのID・URLを取得
const result = getFileIdAndUrl(
  "1ABC123...",  // 起点フォルダーID
  "2025年/請求書/invoice.pdf"  // 相対パス
);
console.log(result.id);   // "1XYZ789..."
console.log(result.url);  // "https://drive.google.com/file/d/..."

// 複数ファイルを一括取得
const results = getMultipleFileIdsAndUrls("1ABC123...", [
  "2025年/請求書/invoice1.pdf",
  "2025年/領収書/receipt1.pdf"
]);
// [{path: "...", id: "...", url: "..."}, ...]
```

**注意事項:**
- 共有ドライブのフォルダーを起点とする場合、Drive API v3を有効化してください
- ファイルパスは起点フォルダーからの相対パスで指定します
- フォルダー区切り文字は `/` を使用してください

## 統合使用例

全てのモジュールを組み合わせた完全な例:

```javascript
/**
 * Webhookエントリポイント
 */
function doPost(e) {
  // 1. ロガー初期化
  const logger = createLogger('通話_要約生成');
  logger.info('Webhook受信');
  
  let recordId = null;
  let status = '成功';
  
  try {
    // 2. リクエストパース
    const params = JSON.parse(e.postData.contents);
    recordId = params.record_id;
    
    // 3. 重複防止
    const dupPrevention = createDuplicationPrevention('通話_要約生成');
    const result = dupPrevention.executeWithRetry(recordId, (id) => {
      
      // 4. Gemini APIで処理
      const gemini = createGeminiProClient({ temperature: 0.2 });
      const summary = gemini.generateText(params.prompt, logger);
      
      // 5. AppSheetに結果を書き戻し
      const appsheet = createAppSheetClient(APP_ID, ACCESS_KEY);
      appsheet.updateSuccessStatus(
        'Call_Logs',
        id,
        'call_id',
        { summary: summary },
        'status',
        logger
      );
      
      return summary;
      
    }, logger);
    
    if (result.isDuplicate) {
      status = '重複';
      logger.warning('重複実行を検出');
      return ContentService.createTextOutput('重複実行').setMimeType(ContentService.MimeType.TEXT);
    }
    
    if (!result.success) {
      status = 'エラー';
      throw new Error(result.error);
    }
    
    logger.success('処理完了');
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
    
  } catch (error) {
    status = 'エラー';
    logger.error(`処理エラー: ${error.toString()}`, { stack: error.stack });
    
    // エラーステータスをAppSheetに反映
    if (recordId) {
      const appsheet = createAppSheetClient(APP_ID, ACCESS_KEY);
      appsheet.updateErrorStatus('Call_Logs', recordId, 'call_id', error.toString(), 'status', 'error_details', logger);
    }
    
    return ContentService.createTextOutput('ERROR').setMimeType(ContentService.MimeType.TEXT);
    
  } finally {
    // 6. ログをスプレッドシートに保存
    logger.saveToSpreadsheet(status, recordId);
  }
}
```

## 各プロジェクトへの適用方法

1. これらの共通モジュールファイルを各GASプロジェクトにコピー
2. 各スクリプトから共通モジュールを利用
3. 既存のコードを段階的にリファクタリング

## メンテナンス

### ログクリーンアップ（定期実行推奨）
```javascript
function cleanupLogs() {
  GASLogger.cleanupOldLogs(); // 90日以上前のログを削除
  DuplicationPrevention.cleanupOldRecords(); // 24時間以上前の処理済みレコードを削除
}
```

トリガー設定: 毎日深夜に実行

## 設定

### ログフォルダーID
`LOGGER_CONFIG.logFolderId` = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX'

### Gemini APIキー
`GEMINI_API_CONFIG.apiKey` = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY'

### モデル選択基準
- **gemini-2.5-pro**: 通話要約、看護記録、質疑応答など複雑な思考が必要
- **gemini-2.5-flash**: データ抽出、OCR、分類など標準処理

### 6. embeddings_service.gs - Vertex AI Embeddings
Vertex AI gemini-embedding-001を使用した埋め込みベクトル生成サービス

**主な機能:**
- テキストの埋め込みベクトル生成 (3072次元)
- バッチ処理対応 (最大250テキスト/リクエスト)
- タスクタイプ指定 (RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY)
- OAuth2認証
- コサイン類似度計算
- 類似検索機能

**使用例:**
```javascript
// 単一テキストの埋め込み生成
const embedding = createEmbedding("看護記録のテキスト", "RETRIEVAL_DOCUMENT", logger);
console.log(embedding.length); // 3072

// バッチ処理
const embeddings = createEmbeddingsBatch([
  "テキスト1",
  "テキスト2"
], "RETRIEVAL_DOCUMENT", logger);

// 類似検索
const candidates = [
  { id: 'doc1', text: '...', embedding: [...] },
  { id: 'doc2', text: '...', embedding: [...] }
];
const results = searchSimilarTexts("検索クエリ", candidates, 10, logger);
```

### 7. vector_db_sync.gs - Vector DB同期
統合Vector DBスプレッドシートへの同期サービス

**主な機能:**
- KnowledgeBaseシートへのデータ登録
- Embeddingsシートへのベクトル登録
- 医療用語キーワード自動抽出
- BM25用キーワード正規化
- バッチ同期対応

**使用例:**
```javascript
// Vector DBに同期
const kbId = syncToVectorDB({
  domain: 'nursing',
  sourceType: 'care_record',
  sourceTable: 'Care_Records',
  sourceId: 'rec_123',
  userId: 'user_001',
  title: '2025-10-27 訪問看護記録',
  content: '訪問時の状態...',
  structuredData: { vital_signs: {...} },
  metadata: { audioFileId: '...' },
  tags: 'バルーン交換,服薬確認',
  date: '2025-10-27'
}, logger);

// バッチ同期
const kbIds = syncToVectorDBBatch([params1, params2, params3], logger);

// レコード取得
const record = getKnowledgeBaseRecord(kbId, logger);
```

## RAG統合使用例

全てのモジュールを組み合わせたRAG対応の完全な例:

```javascript
/**
 * Webhookエントリポイント (RAG対応)
 */
function doPost(e) {
  const logger = createLogger('訪問看護_通常記録');
  logger.info('Webhook受信');

  let recordId = null;
  let status = '成功';

  try {
    const params = JSON.parse(e.postData.contents);
    recordId = params.record_id;

    // 重複防止
    const dupPrevention = createDuplicationPrevention('訪問看護_通常記録');
    const result = dupPrevention.executeWithRetry(recordId, (id) => {

      // Gemini APIで看護記録生成
      const gemini = createGeminiProClient();
      const careRecord = gemini.generateJSON(params.prompt, logger);

      // AppSheetに結果を書き戻し
      const appsheet = createAppSheetClient(APP_ID, ACCESS_KEY);
      appsheet.updateSuccessStatus(
        'Care_Records',
        id,
        'record_id',
        careRecord,
        'status',
        logger
      );

      // Vector DBに同期 (RAG用)
      syncToVectorDB({
        domain: 'nursing',
        sourceType: 'care_record',
        sourceTable: 'Care_Records',
        sourceId: id,
        userId: params.user_id,
        title: `${params.visit_date} 訪問看護記録`,
        content: buildFullText(careRecord),
        structuredData: careRecord,
        metadata: { audioFileId: params.audio_file_id },
        tags: extractTags(careRecord),
        date: params.visit_date
      }, logger);

      return careRecord;

    }, logger);

    if (result.isDuplicate) {
      status = '重複';
      return ContentService.createTextOutput('重複実行').setMimeType(ContentService.MimeType.TEXT);
    }

    logger.success('処理完了 (RAG同期含む)');
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    status = 'エラー';
    logger.error(`処理エラー: ${error.toString()}`, { stack: error.stack });
    return ContentService.createTextOutput('ERROR').setMimeType(ContentService.MimeType.TEXT);

  } finally {
    logger.saveToSpreadsheet(status, recordId);
  }
}
```

## バージョン情報
- Version: 2.0.0 (RAG対応)
- 作成日: 2025-10-16
- 最終更新: 2025-10-27
