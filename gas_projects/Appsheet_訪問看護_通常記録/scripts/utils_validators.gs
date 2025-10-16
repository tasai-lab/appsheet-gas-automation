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

 * バリデーションモジュール

 * 入力データの検証と型チェックを担当

 */



/**

 * カスタムバリデーションエラー

 */

class ValidationError extends Error {

  constructor(code, message, details = {}) {

    super(message);

    this.name = 'ValidationError';

    this.code = code;

    this.details = details;

  }

}



/**

 * Webhook パラメータを検証

 * @param {Object} params - 検証対象のパラメータ

 * @throws {ValidationError} バリデーションエラー

 */

function validateWebhookParams(params) {

  if (!params) {

    throw new ValidationError(

      ERROR_CODE.MISSING_REQUIRED_PARAMS,

      ERROR_MESSAGES[ERROR_CODE.MISSING_REQUIRED_PARAMS],

      { reason: 'パラメータオブジェクトがnullまたはundefinedです' }

    );

  }



  // 必須フィールドのチェック

  const requiredFields = ['recordNoteId', 'staffId', 'recordText'];

  const missingFields = requiredFields.filter(field => !params[field]);



  if (missingFields.length > 0) {

    throw new ValidationError(

      ERROR_CODE.MISSING_REQUIRED_PARAMS,

      ERROR_MESSAGES[ERROR_CODE.MISSING_REQUIRED_PARAMS],

      { 

        missingFields: missingFields,

        receivedParams: Object.keys(params)

      }

    );

  }



  // recordNoteIdの型チェック

  if (typeof params.recordNoteId !== 'string' || params.recordNoteId.trim() === '') {

    throw new ValidationError(

      ERROR_CODE.MISSING_REQUIRED_PARAMS,

      'recordNoteIdは空でない文字列である必要があります',

      { receivedType: typeof params.recordNoteId }

    );

  }



  // staffIdの型チェック

  if (typeof params.staffId !== 'string' || params.staffId.trim() === '') {

    throw new ValidationError(

      ERROR_CODE.MISSING_REQUIRED_PARAMS,

      'staffIdは空でない文字列である必要があります',

      { receivedType: typeof params.staffId }

    );

  }



  // recordTextの型チェック

  if (typeof params.recordText !== 'string') {

    throw new ValidationError(

      ERROR_CODE.MISSING_REQUIRED_PARAMS,

      'recordTextは文字列である必要があります',

      { receivedType: typeof params.recordText }

    );

  }

}



/**

 * ファイルパスを検証

 * @param {string} filePath - ファイルパス

 * @throws {ValidationError} バリデーションエラー

 */

function validateFilePath(filePath) {

  if (!filePath || typeof filePath !== 'string') {

    throw new ValidationError(

      ERROR_CODE.INVALID_FILE_PATH,

      ERROR_MESSAGES[ERROR_CODE.INVALID_FILE_PATH],

      { receivedValue: filePath, receivedType: typeof filePath }

    );

  }



  const trimmedPath = filePath.trim();

  if (trimmedPath === '') {

    throw new ValidationError(

      ERROR_CODE.INVALID_FILE_PATH,

      'ファイルパスが空です',

      { receivedValue: filePath }

    );

  }



  return trimmedPath;

}



/**

 * 記録タイプを検証

 * @param {string} recordType - 記録タイプ

 * @return {string} 正規化された記録タイプ ('normal' or 'psychiatry')

 */

function validateRecordType(recordType) {

  if (!recordType) {

    return 'normal'; // デフォルト値

  }



  // 厳密一致チェック

  if (recordType === RECORD_TYPE_CONFIG.psychiatry.matchText) {

    return 'psychiatry';

  }



  if (recordType === RECORD_TYPE_CONFIG.normal.matchText) {

    return 'normal';

  }



  // 不明な値の場合は警告してデフォルト

  Logger.log(`警告: 不明な記録タイプ「${recordType}」を受信。通常記録として処理します。`);

  return 'normal';

}



/**

 * ファイルサイズを検証

 * @param {number} fileSize - ファイルサイズ (bytes)

 * @param {string} fileName - ファイル名 (ログ用)

 * @throws {ValidationError} バリデーションエラー

 */

function validateFileSize(fileSize, fileName = '') {

  if (fileSize > AUDIO_CONFIG.maxFileSizeBytes) {

    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

    const maxSizeMB = (AUDIO_CONFIG.maxFileSizeBytes / 1024 / 1024).toFixed(2);

    

    throw new ValidationError(

      ERROR_CODE.FILE_SIZE_EXCEEDED,

      ERROR_MESSAGES[ERROR_CODE.FILE_SIZE_EXCEEDED],

      {

        fileName: fileName,

        fileSizeMB: fileSizeMB,

        maxSizeMB: maxSizeMB

      }

    );

  }

}



/**

 * ファイル形式を検証

 * @param {string} fileName - ファイル名

 * @return {string} 拡張子

 * @throws {ValidationError} バリデーションエラー

 */

function validateFileFormat(fileName) {

  const extension = fileName.includes('.')

    ? fileName.split('.').pop().toLowerCase()

    : '';



  if (!extension) {

    throw new ValidationError(

      ERROR_CODE.UNSUPPORTED_FORMAT,

      'ファイルに拡張子がありません',

      { fileName: fileName }

    );

  }



  if (!AUDIO_CONFIG.supportedFormats.includes(extension)) {

    throw new ValidationError(

      ERROR_CODE.UNSUPPORTED_FORMAT,

      ERROR_MESSAGES[ERROR_CODE.UNSUPPORTED_FORMAT],

      {

        fileName: fileName,

        extension: extension,

        supportedFormats: AUDIO_CONFIG.supportedFormats

      }

    );

  }



  return extension;

}



/**

 * AI生成結果を検証

 * @param {Object} result - AI生成結果

 * @param {string} recordType - 記録タイプ

 * @throws {ValidationError} バリデーションエラー

 */

function validateAIResult(result, recordType) {

  if (!result || typeof result !== 'object') {

    throw new ValidationError(

      ERROR_CODE.RESPONSE_VALIDATION_ERROR,

      'AI応答が無効です',

      { receivedType: typeof result }

    );

  }



  const requiredFields = REQUIRED_FIELDS[recordType];

  const missingFields = requiredFields.filter(field => !(field in result));



  if (missingFields.length > 0) {

    Logger.log(`警告: 必須フィールドが欠落しています: ${missingFields.join(', ')}`);

    

    // デフォルト値を設定

    missingFields.forEach(field => {

      if (field === 'vitalSigns') {

        result[field] = {};

      } else if (field.includes('Items') || field === 'careProvided') {

        result[field] = [];

      } else {

        result[field] = '';

      }

    });

  }



  return result;

}



/**

 * HTTP レスポンスコードを検証

 * @param {number} statusCode - ステータスコード

 * @param {string} context - コンテキスト (ログ用)

 * @throws {Error} HTTPエラー

 */

function validateHttpResponse(statusCode, context = 'API') {

  if (statusCode >= 400) {

    const message = `${context}エラー: HTTPステータス ${statusCode}`;

    throw new Error(message);

  }

}



/**

 * JSON文字列を検証してパース

 * @param {string} jsonString - JSON文字列

 * @param {string} context - コンテキスト (ログ用)

 * @return {Object} パースされたオブジェクト

 * @throws {ValidationError} パースエラー

 */

function validateAndParseJSON(jsonString, context = 'JSON') {

  try {

    // JSONブロックの抽出

    const startIndex = jsonString.indexOf('{');

    const endIndex = jsonString.lastIndexOf('}');



    if (startIndex === -1 || endIndex === -1) {

      throw new Error('JSONブロックが見つかりません');

    }



    const extractedJson = jsonString.substring(startIndex, endIndex + 1);

    const parsed = JSON.parse(extractedJson);



    return parsed;



  } catch (error) {

    throw new ValidationError(

      ERROR_CODE.JSON_PARSE_ERROR,

      ERROR_MESSAGES[ERROR_CODE.JSON_PARSE_ERROR],

      {

        context: context,

        error: error.message,

        preview: jsonString.substring(0, 200) + '...'

      }

    );

  }

}

