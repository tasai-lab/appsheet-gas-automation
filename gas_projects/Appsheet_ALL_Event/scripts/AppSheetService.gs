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


const AppSheetService = {

  sendSuccessResponse(config, eventId, eventUrl, action) {

    const rowData = {};

    rowData[config.keyColumnName] = config.rowId;

    if (config.eventIdColumnName) rowData[config.eventIdColumnName] = eventId;

    if (config.eventUrlColumnName) rowData[config.eventUrlColumnName] = eventUrl;

    

    // アクションに応じてステータスを変更する

    if (action === 'DELETE') {

      rowData.status = config.deleteStatus || '削除済'; // AppSheet側で削除時のステータスを指定可能に

    } else {

      rowData.status = config.successStatus || '予定';

    }

    

    const payload = { Action: "Edit", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

    Logger.info('AppSheetへの成功通知を送信', { rowId: config.rowId, action });

    this._callApi(config, payload);

  },



  /**

   * 処理失敗をAppSheetに通知する

   * @param {AppSheetConfig} config

   * @param {Error} error

   */

  sendErrorResponse(config, error) {

    const rowData = {};

    rowData[config.keyColumnName] = config.rowId;

    rowData.status = "エラー"; // 固定

    if (config.errorDetailsColumnName) {

      rowData[config.errorDetailsColumnName] = `GAS Script Error: ${error.message}`;

    }



    const payload = { Action: "Edit", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

    Logger.info('AppSheetへのエラー通知を送信', { rowId: config.rowId, error: error.message });

    this._callApi(config, payload);

  },



  /**

   * AppSheet APIを呼び出す内部関数

   * @private

   * @param {AppSheetConfig} config

   * @param {Object} payload

   */

  _callApi(config, payload) {

    Utilities.sleep(Math.floor(Math.random() * 2000) + 500); // 0.5〜2.5秒の待機

    const apiUrl = `https://api.appsheet.com/api/v2/apps/${config.appId}/tables/${config.tableName}/Action`;

    const options = {

      method: 'post',

      contentType: 'application/json',

      headers: { 'ApplicationAccessKey': config.accessKey },

      payload: JSON.stringify(payload),

      muteHttpExceptions: true

    };

    

    const response = UrlFetchApp.fetch(apiUrl, options);

    const responseCode = response.getResponseCode();

    const responseBody = response.getContentText();



    if (responseCode >= 400) {

      Logger.error('AppSheet APIエラー', new Error(responseBody), { apiUrl, responseCode });

      throw new Error(`AppSheet API Error: ${responseCode} - ${responseBody}`);

    } else {

       Logger.info(`AppSheet API 応答`, { responseCode, responseBody });

    }

  }

};