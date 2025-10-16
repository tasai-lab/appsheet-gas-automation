/**
 * 実行ログモジュール
 */
const ExecutionLogger = {
  SPREADSHEET_ID: '15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE',
  SHEET_NAME: 'シート1',
  
  /**
   * ログを記録
   * @param {string} scriptName - スクリプト名
   * @param {string} status - ステータス (SUCCESS/ERROR/WARNING)
   * @param {string} processId - 処理ID
   * @param {string} message - メッセージ
   * @param {string} errorDetail - エラー詳細
   * @param {number} executionTime - 実行時間(秒)
   * @param {Object} inputData - 入力データ
   */
  log: function(scriptName, status, processId, message, errorDetail, executionTime, inputData) {
    try {
      const ss = SpreadsheetApp.openById(this.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(this.SHEET_NAME);
      
      const timestamp = new Date();
      const user = Session.getActiveUser().getEmail();
      const inputDataStr = inputData ? JSON.stringify(inputData).substring(0, 1000) : '';
      
      sheet.appendRow([
        timestamp,
        scriptName,
        status,
        processId || '',
        message || '',
        errorDetail || '',
        executionTime || 0,
        user,
        inputDataStr
      ]);
    } catch (e) {
      Logger.log(`ログ記録エラー: ${e.message}`);
    }
  },
  
  /**
   * 成功ログ
   */
  success: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'SUCCESS', processId, message, '', executionTime, inputData);
  },
  
  /**
   * エラーログ
   */
  error: function(scriptName, processId, message, error, executionTime, inputData) {
    const errorDetail = error ? `${error.message}\n${error.stack}` : '';
    this.log(scriptName, 'ERROR', processId, message, errorDetail, executionTime, inputData);
  },
  
  /**
   * 警告ログ
   */
  warning: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'WARNING', processId, message, '', executionTime, inputData);
  }
};


/**

 * Webhook重複実行防止ライブラリ

 * 

 * 全てのAppsheet-GASプロジェクトで使用できる統一された重複防止機能を提供

 * 

 * 機能:

 * 1. レコードIDベースの重複チェック（処理中フラグ）

 * 2. Webhookフィンガープリントによる重複検知

 * 3. LockServiceを使用した排他制御

 * 4. エラー時の自動クリーンアップ

 * 

 * @author Fractal Group

 * @version 3.0.0

 * @date 2025-10-16

 */



// ========================================

// 定数定義

// ========================================



/**

 * キャッシュキーのプレフィックス

 */

const DEDUP_PREFIX = {

  PROCESSING: 'dedup_processing_',

  WEBHOOK: 'dedup_webhook_',

  LOCK: 'dedup_lock_',

  RETRY_COUNT: 'dedup_retry_'

};



/**

 * キャッシュの有効期限（秒）

 */

const DEDUP_DURATION = {

  PROCESSING: 600,        // 10分（処理中フラグ - Apps Script最大実行時間6分 + バッファ）

  COMPLETED: 21600,       // 6時間（処理完了フラグ - 重複webhook防止）

  WEBHOOK_FINGERPRINT: 120, // 2分（Webhook重複排除期間）

  LOCK: 30               // 30秒（ロック有効期限）

};



/**

 * リトライ設定

 */

const DEDUP_RETRY = {

  MAX_COUNT: 3,           // 最大リトライ回数

  WAIT_MS: 2000          // リトライ待機時間（ミリ秒）

};



// ========================================

// 主要機能

// ========================================



/**

 * Webhook重複実行チェック（統合版）

 * レコードIDベースとフィンガープリントの両方でチェック

 * 

 * @param {string} recordId - レコードID（必須）

 * @param {Object} webhookParams - Webhookパラメータ（オプション、より厳密なチェックに使用）

 * @return {Object} { isDuplicate: boolean, reason: string }

 */

function checkDuplicateRequest(recordId, webhookParams = null) {

  if (!recordId) {

    Logger.log('⚠️ recordIdが未指定です');

    return { isDuplicate: false, reason: 'no_record_id' };

  }



  // 1. 処理中/完了フラグチェック

  if (isProcessingOrCompleted(recordId)) {

    return { 

      isDuplicate: true, 

      reason: 'processing_or_completed',

      recordId: recordId 

    };

  }



  // 2. Webhookフィンガープリントチェック（パラメータが提供された場合）

  if (webhookParams) {

    if (isDuplicateWebhookFingerprint(recordId, webhookParams)) {

      return { 

        isDuplicate: true, 

        reason: 'duplicate_fingerprint',

        recordId: recordId 

      };

    }

  }



  return { isDuplicate: false, reason: 'new_request', recordId: recordId };

}



/**

 * 処理中フラグを設定（ロック取得付き）

 * 

 * @param {string} recordId - レコードID

 * @param {Object} metadata - 追加のメタデータ（オプション）

 * @return {boolean} 設定成功の場合true

 */

function markAsProcessingWithLock(recordId, metadata = {}) {

  if (!recordId) {

    Logger.log('⚠️ recordIdが未指定です');

    return false;

  }



  // LockServiceで排他制御

  const lock = LockService.getScriptLock();

  

  try {

    // 30秒待機してロック取得

    if (!lock.tryLock(30000)) {

      Logger.log(`❌ ロック取得タイムアウト: ${recordId}`);

      return false;

    }



    // 再度重複チェック（ロック取得後）

    if (isProcessingOrCompleted(recordId)) {

      Logger.log(`🔒 ロック取得後の重複検知: ${recordId}`);

      lock.releaseLock();

      return false;

    }



    // 処理中フラグ設定

    const cache = CacheService.getScriptCache();

    const key = DEDUP_PREFIX.PROCESSING + recordId;

    

    const flagData = {

      state: 'processing',

      startTime: new Date().toISOString(),

      scriptId: ScriptApp.getScriptId(),

      ...metadata

    };



    cache.put(key, JSON.stringify(flagData), DEDUP_DURATION.PROCESSING);

    Logger.log(`✅ 処理中フラグ設定: ${recordId}`);

    

    lock.releaseLock();

    return true;



  } catch (error) {

    Logger.log(`❌ 処理中フラグ設定エラー: ${error.toString()}`);

    try { lock.releaseLock(); } catch (e) {}

    return false;

  }

}



/**

 * 処理完了フラグを設定

 * 

 * @param {string} recordId - レコードID

 * @param {Object} result - 処理結果（オプション）

 */

function markAsCompleted(recordId, result = {}) {

  if (!recordId) {

    Logger.log('⚠️ recordIdが未指定です');

    return;

  }



  const cache = CacheService.getScriptCache();

  const key = DEDUP_PREFIX.PROCESSING + recordId;

  

  const flagData = {

    state: 'completed',

    completedTime: new Date().toISOString(),

    success: result.success !== false,

    ...result

  };



  // 長期間保持して重複webhook防止

  cache.put(key, JSON.stringify(flagData), DEDUP_DURATION.COMPLETED);

  Logger.log(`✅ 処理完了フラグ設定: ${recordId} (${DEDUP_DURATION.COMPLETED}秒保持)`);

}



/**

 * 処理失敗フラグを設定

 * 

 * @param {string} recordId - レコードID

 * @param {Error} error - エラーオブジェクト

 */

function markAsFailed(recordId, error) {

  if (!recordId) return;



  const cache = CacheService.getScriptCache();

  const key = DEDUP_PREFIX.PROCESSING + recordId;

  

  const flagData = {

    state: 'failed',

    failedTime: new Date().toISOString(),

    error: error.toString(),

    errorStack: error.stack || ''

  };



  // 失敗の場合は短い期間で保持（リトライ可能にする）

  cache.put(key, JSON.stringify(flagData), 300); // 5分

  Logger.log(`❌ 処理失敗フラグ設定: ${recordId}`);

}



/**

 * 処理フラグをクリア

 * 

 * @param {string} recordId - レコードID

 */

function clearProcessingFlag(recordId) {

  if (!recordId) return;



  const cache = CacheService.getScriptCache();

  const key = DEDUP_PREFIX.PROCESSING + recordId;

  cache.remove(key);

  Logger.log(`🗑️ 処理フラグクリア: ${recordId}`);

}



// ========================================

// 内部ヘルパー関数

// ========================================



/**

 * 処理中または完了済みかチェック

 * 

 * @param {string} recordId - レコードID

 * @return {boolean}

 */

function isProcessingOrCompleted(recordId) {

  const cache = CacheService.getScriptCache();

  const key = DEDUP_PREFIX.PROCESSING + recordId;

  const cachedValue = cache.get(key);



  if (cachedValue) {

    try {

      const status = JSON.parse(cachedValue);

      Logger.log(`🔒 重複検知: ${recordId} - 状態: ${status.state} (${status.startTime || status.completedTime || status.failedTime})`);

      return true;

    } catch (e) {

      // JSON解析失敗の場合も重複とみなす

      return true;

    }

  }



  return false;

}



/**

 * Webhookフィンガープリントによる重複チェック

 * 

 * @param {string} recordId - レコードID

 * @param {Object} params - Webhookパラメータ

 * @return {boolean}

 */

function isDuplicateWebhookFingerprint(recordId, params) {

  const fingerprint = generateFingerprint(recordId, params);

  const cache = CacheService.getScriptCache();

  const key = DEDUP_PREFIX.WEBHOOK + fingerprint;



  const cachedValue = cache.get(key);



  if (cachedValue) {

    Logger.log(`🔒 Webhook重複検知: ${recordId} (フィンガープリント: ${fingerprint.substring(0, 16)}...)`);

    return true;

  }



  // 新規リクエストの場合、フィンガープリントを記録

  cache.put(key, new Date().toISOString(), DEDUP_DURATION.WEBHOOK_FINGERPRINT);

  Logger.log(`✅ 新規Webhook受付: ${recordId} (フィンガープリント: ${fingerprint.substring(0, 16)}...)`);



  return false;

}



/**

 * フィンガープリント生成

 * 

 * @param {string} recordId - レコードID

 * @param {Object} params - パラメータ

 * @return {string} SHA-256ハッシュ

 */

function generateFingerprint(recordId, params) {

  // 重複判定に使用するキー（タイムスタンプは除外）

  const fingerprintData = {

    recordId: recordId,

    staffId: params.staffId || '',

    fileId: params.fileId || '',

    filePath: params.filePath || '',

    recordType: params.recordType || '',

    callId: params.callId || '',

    // タイムスタンプやランダム値は含めない

  };



  const dataString = JSON.stringify(fingerprintData, Object.keys(fingerprintData).sort());

  

  const signature = Utilities.computeDigest(

    Utilities.DigestAlgorithm.SHA_256,

    dataString,

    Utilities.Charset.UTF_8

  );



  return Utilities.base64Encode(signature);

}



// ========================================

// レスポンス生成関数

// ========================================



/**

 * 成功レスポンス生成

 * 

 * @param {string} recordId - レコードID

 * @param {Object} data - 追加データ

 * @return {ContentService.TextOutput}

 */

function createSuccessResponse(recordId, data = {}) {

  return ContentService.createTextOutput(JSON.stringify({

    status: 'success',

    recordId: recordId,

    timestamp: new Date().toISOString(),

    ...data

  })).setMimeType(ContentService.MimeType.JSON);

}



/**

 * 重複レスポンス生成

 * 

 * @param {string} recordId - レコードID

 * @param {string} reason - 重複理由

 * @return {ContentService.TextOutput}

 */

function createDuplicateResponse(recordId, reason = '') {

  return ContentService.createTextOutput(JSON.stringify({

    status: 'duplicate',

    recordId: recordId,

    reason: reason,

    message: '処理中または処理済みです',

    timestamp: new Date().toISOString()

  })).setMimeType(ContentService.MimeType.JSON);

}



/**

 * エラーレスポンス生成

 * 

 * @param {string} recordId - レコードID

 * @param {Error} error - エラーオブジェクト

 * @return {ContentService.TextOutput}

 */

function createErrorResponse(recordId, error) {

  return ContentService.createTextOutput(JSON.stringify({

    status: 'error',

    recordId: recordId,

    error: error.toString(),

    message: error.message || '',

    timestamp: new Date().toISOString()

  })).setMimeType(ContentService.MimeType.JSON);

}



// ========================================

// 統合実行ラッパー関数

// ========================================



/**

 * Webhook処理の統合ラッパー

 * 重複チェック、ロック取得、エラーハンドリングを自動化

 * 

 * 使用例:

 * function doPost(e) {

 *   return executeWebhookWithDuplicationPrevention(e, processWebhook);

 * }

 * 

 * function processWebhook(params) {

 *   // 実際の処理

 *   return { success: true, data: {...} };

 * }

 * 

 * @param {Object} e - doPost/doGetイベントオブジェクト

 * @param {Function} processingFunction - 実際の処理を行う関数

 * @param {Object} options - オプション設定

 * @return {ContentService.TextOutput}

 */

function executeWebhookWithDuplicationPrevention(e, processingFunction, options = {}) {

  const defaultOptions = {

    recordIdField: 'recordId',          // レコードIDフィールド名

    parseRequest: true,                  // リクエストを自動パース

    enableFingerprint: true,             // フィンガープリントチェック有効化

    autoMarkCompleted: true,             // 自動で完了マーク

    metadata: {}                         // 追加メタデータ

  };



  const config = { ...defaultOptions, ...options };

  let recordId = 'unknown';

  let params = {};



  try {

    // 1. リクエスト解析

    if (config.parseRequest) {

      params = JSON.parse(e.postData.contents);

    } else {

      params = e;

    }



    recordId = params[config.recordIdField];

    

    if (!recordId) {

      throw new Error(`${config.recordIdField}が見つかりません`);

    }



    Logger.log(`📥 Webhook受信: ${recordId}`);



    // 2. 重複チェック

    const dupCheck = checkDuplicateRequest(

      recordId, 

      config.enableFingerprint ? params : null

    );



    if (dupCheck.isDuplicate) {

      Logger.log(`🔒 重複リクエストをスキップ: ${recordId} (理由: ${dupCheck.reason})`);

      return createDuplicateResponse(recordId, dupCheck.reason);

    }



    // 3. 処理中フラグ設定（ロック取得）

    if (!markAsProcessingWithLock(recordId, config.metadata)) {

      Logger.log(`❌ 処理中フラグ設定失敗: ${recordId}`);

      return createDuplicateResponse(recordId, 'lock_failed');

    }



    // 4. 実際の処理実行

    Logger.log(`▶️ 処理開始: ${recordId}`);

    const result = processingFunction(params);



    // 5. 完了マーク

    if (config.autoMarkCompleted) {

      markAsCompleted(recordId, result);

    }



    Logger.log(`✅ 処理完了: ${recordId}`);

    return createSuccessResponse(recordId, result);



  } catch (error) {

    Logger.log(`❌ エラー発生: ${recordId} - ${error.toString()}`);

    

    // エラー時は失敗フラグ設定（リトライ可能にする）

    markAsFailed(recordId, error);

    

    return createErrorResponse(recordId, error);

  }

}



// ========================================

// メンテナンス・デバッグ関数

// ========================================



/**

 * 特定レコードの状態を確認

 * 

 * @param {string} recordId - レコードID

 * @return {Object} 状態情報

 */

function checkRecordStatus(recordId) {

  const cache = CacheService.getScriptCache();

  const key = DEDUP_PREFIX.PROCESSING + recordId;

  const cachedValue = cache.get(key);



  if (!cachedValue) {

    return { 

      exists: false, 

      recordId: recordId,

      message: 'フラグが存在しません（新規または期限切れ）'

    };

  }



  try {

    const status = JSON.parse(cachedValue);

    return {

      exists: true,

      recordId: recordId,

      ...status

    };

  } catch (e) {

    return {

      exists: true,

      recordId: recordId,

      error: 'JSON解析失敗',

      rawValue: cachedValue

    };

  }

}



/**

 * すべての処理フラグをクリア（緊急メンテナンス用）

 * 注意: この関数は慎重に使用してください

 * 

 * @return {Object} クリア結果

 */

function emergencyClearAllFlags() {

  Logger.log('⚠️ 緊急フラグクリアを実行します');

  

  // CacheServiceは全キー取得不可のため、個別にクリアする必要がある

  // この関数は主にPropertiesServiceと併用する場合に有効

  

  return {

    timestamp: new Date().toISOString(),

    message: 'CacheServiceは全キー取得非対応です。個別にclearProcessingFlag()を使用してください。',

    note: 'キャッシュは有効期限で自動削除されます'

  };

}



/**

 * 重複防止システムの統計情報取得

 * 

 * @return {Object} 統計情報

 */

function getDuplicationPreventionStats() {

  return {

    version: '3.0.0',

    timestamp: new Date().toISOString(),

    config: {

      processing_duration: DEDUP_DURATION.PROCESSING,

      completed_duration: DEDUP_DURATION.COMPLETED,

      webhook_fingerprint_duration: DEDUP_DURATION.WEBHOOK_FINGERPRINT,

      lock_duration: DEDUP_DURATION.LOCK

    },

    features: [

      'レコードID重複チェック',

      'Webhookフィンガープリント',

      'LockService排他制御',

      '自動エラーハンドリング',

      '処理状態管理（processing/completed/failed）'

    ]

  };

}

