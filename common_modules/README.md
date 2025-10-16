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

## バージョン情報
- Version: 1.0.0
- 作成日: 2025-10-16
- 最終更新: 2025-10-16
