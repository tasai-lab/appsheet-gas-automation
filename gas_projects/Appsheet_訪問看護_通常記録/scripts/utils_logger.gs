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
 * Webhook重複実行防止モジュール
 */
const DuplicationPrevention = {
  LOCK_TIMEOUT: 300000, // 5分
  CACHE_EXPIRATION: 3600, // 1時間
  
  /**
   * リクエストの重複チェック
   * @param {string} requestId - リクエストID（webhookデータのハッシュ値）
   * @return {boolean} - 処理を続行する場合はtrue
   */
  checkDuplicate: function(requestId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `processed_${requestId}`;
    
    // キャッシュチェック
    if (cache.get(cacheKey)) {
      Logger.log(`重複リクエストを検出: ${requestId}`);
      return false;
    }
    
    // ロック取得
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(this.LOCK_TIMEOUT);
      
      // 再度キャッシュチェック（ダブルチェック）
      if (cache.get(cacheKey)) {
        Logger.log(`ロック取得後、重複リクエストを検出: ${requestId}`);
        return false;
      }
      
      // 処理済みマークを設定
      cache.put(cacheKey, 'processed', this.CACHE_EXPIRATION);
      return true;
    } catch (e) {
      Logger.log(`ロック取得エラー: ${e.message}`);
      return false;
    } finally {
      lock.releaseLock();
    }
  },
  
  /**
   * リクエストIDを生成
   * @param {Object} data - Webhookデータ
   * @return {string} - リクエストID
   */
  generateRequestId: function(data) {
    const str = JSON.stringify(data);
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      str,
      Utilities.Charset.UTF_8
    ).map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
  }
};


/**

 * Unified Logging Utility

 * All logging functions unified for consistency and debuggability

 */



/**

 * Enhanced structured logging with debug mode support

 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR, FATAL)

 * @param {string} message - Log message

 * @param {Object} data - Additional data to log

 */

function logStructured(level, message, data = {}) {

  const logEntry = {

    timestamp: new Date().toISOString(),

    level: level,

    message: message,

    scriptId: ScriptApp.getScriptId(),

    ...data

  };

  

  // Format log based on debug mode

  const logString = SYSTEM_CONFIG.debugMode 

    ? JSON.stringify(logEntry, null, 2) 

    : JSON.stringify(logEntry);

  

  // Output based on level

  switch (level) {

    case LOG_LEVEL.ERROR:

    case LOG_LEVEL.FATAL:

      console.error(logString);

      Logger.log(`[${level}] ${logString}`);

      break;

    case LOG_LEVEL.WARN:

      console.warn(logString);

      Logger.log(`[${level}] ${logString}`);

      break;

    case LOG_LEVEL.DEBUG:

      if (SYSTEM_CONFIG.debugMode) {

        console.log(logString);

        Logger.log(`[${level}] ${logString}`);

      }

      break;

    default:

      Logger.log(`[${level}] ${logString}`);

      if (SYSTEM_CONFIG.debugMode) {

        console.log(logString);

      }

  }

}



/**

 * Processing start log

 * @param {string} recordNoteId - Record ID

 * @param {Object} params - Parameters

 */

function logProcessingStart(recordNoteId, params) {

  logStructured(LOG_LEVEL.INFO, '処理開始', {

    recordNoteId: recordNoteId,

    staffId: params.staffId,

    hasFilePath: !!params.filePath,

    hasFileId: !!params.fileId,

    recordType: params.recordType || '通常',

    processingMode: SYSTEM_CONFIG.processingMode

  });

}



/**

 * Processing complete log

 * @param {string} recordNoteId - Record ID

 * @param {number} duration - Duration in milliseconds

 */

function logProcessingComplete(recordNoteId, duration) {

  logStructured(LOG_LEVEL.INFO, '処理完了', {

    recordNoteId: recordNoteId,

    durationMs: duration,

    durationSec: (duration / 1000).toFixed(2)

  });

}



/**

 * Error log with stack trace

 * @param {string} recordNoteId - Record ID

 * @param {Error} error - Error object

 * @param {Object} context - Error context

 */

function logError(recordNoteId, error, context = {}) {

  logStructured(LOG_LEVEL.ERROR, 'エラー発生', {

    recordNoteId: recordNoteId,

    errorMessage: error.message,

    errorName: error.name,

    errorStack: error.stack,

    errorCode: error.code || ERROR_CODE.UNEXPECTED_ERROR,

    ...context

  });

}



/**

 * API call log

 * @param {string} apiName - API name

 * @param {string} endpoint - Endpoint URL

 * @param {number} responseCode - Response code

 * @param {number} duration - Duration in milliseconds

 */

function logApiCall(apiName, endpoint, responseCode, duration) {

  logStructured(LOG_LEVEL.INFO, `${apiName} API呼び出し`, {

    api: apiName,

    endpoint: endpoint,

    responseCode: responseCode,

    durationMs: duration,

    durationSec: (duration / 1000).toFixed(2)

  });

}



/**

 * Debug log (only shown in debug mode)

 * @param {string} message - Message

 * @param {Object} data - Data to log

 */

function logDebug(message, data = {}) {

  if (SYSTEM_CONFIG.debugMode) {

    logStructured(LOG_LEVEL.DEBUG, message, data);

  }

}



/**

 * File operation log

 * @param {string} operation - Operation name

 * @param {string} filePath - File path

 * @param {Object} details - Additional details

 */

function logFileOperation(operation, filePath, details = {}) {

  logStructured(LOG_LEVEL.INFO, `ファイル操作: ${operation}`, {

    operation: operation,

    filePath: filePath,

    ...details

  });

}



/**

 * Performance marker for measuring execution time

 * @param {string} label - Marker label

 * @returns {Function} Stop function that returns duration

 */

function perfStart(label) {

  const startTime = Date.now();

  return function perfStop() {

    const duration = Date.now() - startTime;

    logDebug(`Performance: ${label}`, {

      label: label,

      durationMs: duration,

      durationSec: (duration / 1000).toFixed(2)

    });

    return duration;

  };

}



/**

 * Trace function execution (decorator pattern)

 * @param {Function} fn - Function to trace

 * @param {string} fnName - Function name

 * @returns {Function} Wrapped function

 */

function traced(fn, fnName) {

  return function(...args) {

    const stop = perfStart(fnName);

    logDebug(`関数開始: ${fnName}`, { args: args });

    

    try {

      const result = fn.apply(this, args);

      const duration = stop();

      logDebug(`関数完了: ${fnName}`, { duration: duration });

      return result;

    } catch (error) {

      stop();

      logError('N/A', error, { function: fnName });

      throw error;

    }

  };

}

