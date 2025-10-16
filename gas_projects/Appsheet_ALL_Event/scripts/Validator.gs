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


const Validator = {

  validateRequestPayload(params) {

    if (!params) throw new Error("リクエストボディが空です。");

    if (!params.action) throw new Error("必須パラメータ 'action' が不足しています。");



    const { action, eventId, eventData, ownerData } = params;



    switch (action) {

      case 'CREATE':

        if (!eventData) throw new Error("'CREATE'アクションには 'eventData' が必須です。");

        if (!ownerData || !ownerData.newOwnerEmail) throw new Error("'CREATE'アクションには 'ownerData.newOwnerEmail' が必須です。");

        break;



      case 'UPDATE':

        if (!eventId) throw new Error("'UPDATE'アクションには 'eventId' が必須です。");

        if (!eventData) throw new Error("'UPDATE'アクションには 'eventData' が必須です。");

        if (!ownerData || !ownerData.newOwnerEmail) throw new Error("'UPDATE'アクションには 'ownerData.newOwnerEmail' が必須です。");

        break;



      case 'TRANSFER':

        if (!eventId) throw new Error("'TRANSFER'アクションには 'eventId' が必須です。");

        if (!eventData) throw new Error("'TRANSFER'アクションには 'eventData' が必須です。");

        if (!ownerData || !ownerData.oldOwnerEmail || !ownerData.newOwnerEmail) throw new Error("'TRANSFER'アクションには 'ownerData' の 'oldOwnerEmail' と 'newOwnerEmail' が必須です。");

        break;

        

      case 'DELETE':

        if (!eventId) throw new Error("'DELETE'アクションには 'eventId' が必須です。");

        if (!ownerData || !ownerData.oldOwnerEmail) throw new Error("'DELETE'アクションには 'ownerData.oldOwnerEmail' が必須です。");

        break;



      default:

        throw new Error(`未知のアクションです: ${action}`);

    }

  }

};