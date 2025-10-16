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

 * エラーハンドリングモジュール

 * アプリケーション全体のエラー処理を統一

 */



/**

 * カスタムアプリケーションエラー

 */

class AppError extends Error {

  constructor(code, message, details = {}, originalError = null) {

    super(message);

    this.name = 'AppError';

    this.code = code;

    this.details = details;

    this.originalError = originalError;

    this.timestamp = new Date().toISOString();

  }



  /**

   * エラー情報を構造化オブジェクトとして返す

   * @return {Object} エラー情報

   */

  toJSON() {

    return {

      name: this.name,

      code: this.code,

      message: this.message,

      details: this.details,

      timestamp: this.timestamp,

      stack: this.stack,

      originalError: this.originalError ? {

        message: this.originalError.message,

        stack: this.originalError.stack

      } : null

    };

  }

}



/**

 * エラーを適切な AppError に変換

 * @param {Error} error - 元のエラー

 * @param {string} context - エラーが発生したコンテキスト

 * @return {AppError} 変換されたエラー

 */

function normalizeError(error, context = 'Unknown') {

  // すでに AppError または ValidationError の場合はそのまま返す

  if (error instanceof AppError || error instanceof ValidationError) {

    return error;

  }



  // エラーメッセージからコードを推測

  let errorCode = ERROR_CODE.UNEXPECTED_ERROR;

  const errorMessage = error.message || error.toString();



  if (errorMessage.includes('Vertex AI')) {

    errorCode = ERROR_CODE.VERTEX_AI_ERROR;

  } else if (errorMessage.includes('Gemini API')) {

    errorCode = ERROR_CODE.GEMINI_API_ERROR;

  } else if (errorMessage.includes('AppSheet')) {

    errorCode = ERROR_CODE.APPSHEET_API_ERROR;

  } else if (errorMessage.includes('Cloud Storage')) {

    errorCode = ERROR_CODE.CLOUD_STORAGE_ERROR;

  } else if (errorMessage.includes('Drive')) {

    errorCode = ERROR_CODE.DRIVE_ACCESS_FAILED;

  } else if (errorMessage.includes('timeout')) {

    errorCode = ERROR_CODE.TIMEOUT_ERROR;

  }



  return new AppError(

    errorCode,

    ERROR_MESSAGES[errorCode] || errorMessage,

    { context: context, originalMessage: errorMessage },

    error

  );

}



/**

 * エラーをログに記録

 * @param {Error} error - エラーオブジェクト

 * @param {string} recordNoteId - レコードID

 * @param {Object} additionalContext - 追加コンテキスト

 */

function logErrorDetails(error, recordNoteId = 'unknown', additionalContext = {}) {

  const errorInfo = error instanceof AppError || error instanceof ValidationError

    ? error.toJSON ? error.toJSON() : {

        name: error.name,

        code: error.code,

        message: error.message,

        details: error.details

      }

    : {

        name: error.name || 'Error',

        message: error.message,

        stack: error.stack

      };



  logStructured(LOG_LEVEL.ERROR, 'エラー詳細', {

    recordNoteId: recordNoteId,

    error: errorInfo,

    ...additionalContext

  });

}



/**

 * エラーからユーザー向けメッセージを生成

 * @param {Error} error - エラーオブジェクト

 * @return {string} ユーザー向けメッセージ

 */

function getUserFriendlyErrorMessage(error) {

  if (error instanceof ValidationError) {

    return `入力データエラー: ${error.message}`;

  }



  if (error instanceof AppError) {

    const baseMessage = ERROR_MESSAGES[error.code] || error.message;

    

    // 詳細情報があれば追加

    if (error.details && Object.keys(error.details).length > 0) {

      const detailsStr = Object.entries(error.details)

        .map(([key, value]) => `${key}: ${value}`)

        .join(', ');

      return `${baseMessage} (${detailsStr})`;

    }

    

    return baseMessage;

  }



  // 一般的なエラー

  return `処理中にエラーが発生しました: ${error.message}`;

}



/**

 * エラーハンドリングのラッパー関数

 * @param {Function} fn - 実行する関数

 * @param {string} context - コンテキスト

 * @param {Object} options - オプション

 * @return {*} 関数の実行結果

 */

function withErrorHandling(fn, context = 'Unknown', options = {}) {

  const { 

    recordNoteId = 'unknown', 

    retryCount = 0, 

    maxRetries = 0,

    onError = null 

  } = options;



  try {

    return fn();

  } catch (error) {

    const normalizedError = normalizeError(error, context);

    logErrorDetails(normalizedError, recordNoteId, { retryCount });



    // リトライ処理

    if (retryCount < maxRetries && isRetryableError(normalizedError)) {

      Logger.log(`リトライ実行: ${retryCount + 1}/${maxRetries}`);

      Utilities.sleep(1000 * (retryCount + 1)); // 指数バックオフ

      return withErrorHandling(fn, context, {

        ...options,

        retryCount: retryCount + 1

      });

    }



    // カスタムエラーハンドラ

    if (onError) {

      onError(normalizedError);

    }



    throw normalizedError;

  }

}



/**

 * リトライ可能なエラーかどうか判定

 * @param {Error} error - エラーオブジェクト

 * @return {boolean} リトライ可能か

 */

function isRetryableError(error) {

  const retryableCodes = [

    ERROR_CODE.TIMEOUT_ERROR,

    ERROR_CODE.VERTEX_AI_ERROR,

    ERROR_CODE.GEMINI_API_ERROR,

    ERROR_CODE.CLOUD_STORAGE_ERROR

  ];



  if (error instanceof AppError) {

    return retryableCodes.includes(error.code);

  }



  const message = error.message.toLowerCase();

  return message.includes('timeout') || 

         message.includes('503') || 

         message.includes('502') ||

         message.includes('rate limit');

}



/**

 * エラー回復処理

 * @param {string} recordNoteId - レコードID

 * @param {Error} error - エラーオブジェクト

 * @param {Object} context - コンテキスト情報

 */

function handleErrorRecovery(recordNoteId, error, context = {}) {

  try {

    // エラーログ記録

    logErrorDetails(error, recordNoteId, context);



    // AppSheetレコード更新

    const userMessage = getUserFriendlyErrorMessage(error);

    updateRecordOnError(recordNoteId, userMessage);



    // エラー通知送信

    sendErrorEmail(recordNoteId, userMessage, {

      ...context,

      errorCode: error.code,

      errorDetails: error.details

    });



    // Slack通知（有効な場合）

    if (NOTIFICATION_CONFIG.enableSlackNotification) {

      sendSlackNotification(

        `❌ エラー発生\nID: ${recordNoteId}\n${userMessage}`,

        NOTIFICATION_TYPE.ERROR

      );

    }



  } catch (recoveryError) {

    Logger.log(`エラー回復処理中に追加エラー: ${recoveryError.toString()}`);

    logStructured(LOG_LEVEL.FATAL, 'エラー回復処理失敗', {

      recordNoteId: recordNoteId,

      originalError: error.message,

      recoveryError: recoveryError.message

    });

  }

}

