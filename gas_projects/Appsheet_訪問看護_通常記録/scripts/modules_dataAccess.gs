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

 * データアクセスモジュール

 * スプレッドシートからのマスターデータ取得

 */



/**

 * 指導・助言マスターをテキスト形式で取得

 * @return {string} マスターリストのテキスト

 */

function getGuidanceMasterAsText() {

  try {

    const sheet = SpreadsheetApp

      .openById(SPREADSHEET_CONFIG.masterId)

      .getSheetByName(SPREADSHEET_CONFIG.sheetName);

    

    if (!sheet) {

      throw new Error(`シートが見つかりません: ${SPREADSHEET_CONFIG.sheetName}`);

    }

    

    const data = sheet.getDataRange().getValues();

    

    if (data.length === 0) {

      throw new Error('マスタースプレッドシートにデータがありません');

    }

    

    const headers = data.shift(); // ヘッダー行を取得

    const careProvidedIndex = headers.indexOf('Care_Provided');

    

    if (careProvidedIndex === -1) {

      throw new Error('マスタースプレッドシートに "Care_Provided" 列が見つかりません');

    }

    

    // "Care_Provided"列の値だけをリスト化

    const masterList = data

      .map(row => row[careProvidedIndex])

      .filter(value => value && value.toString().trim() !== '')

      .map(value => `- ${value}`)

      .join('\n');

    

    logStructured(LOG_LEVEL.INFO, 'マスターデータ取得成功', { count: data.length });

    

    return masterList;

    

  } catch (error) {

    logStructured(LOG_LEVEL.ERROR, 'マスターデータ取得エラー', { 

      error: error.message,

      errorCode: ERROR_CODE.MASTER_DATA_FETCH_FAILED 

    });

    throw new Error(`マスターデータの取得に失敗しました: ${error.message}`);

  }

}



/**

 * マスターデータをキャッシュから取得（パフォーマンス最適化）

 * @return {string} マスターリストのテキスト

 */

function getGuidanceMasterCached() {

  const cache = CacheService.getScriptCache();

  const cacheKey = 'guidance_master_text';

  const cacheDuration = 3600; // 1時間

  

  // キャッシュから取得を試みる

  let masterText = cache.get(cacheKey);

  

  if (masterText) {

    logDebug('マスターデータをキャッシュから取得');

    return masterText;

  }

  

  // キャッシュにない場合は取得してキャッシュに保存

  masterText = getGuidanceMasterAsText();

  cache.put(cacheKey, masterText, cacheDuration);

  

  return masterText;

}

