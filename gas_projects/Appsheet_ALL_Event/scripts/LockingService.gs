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

 * 処理の重複実行を防止するためのロックサービス

 */

const LockingService = {

  CACHE_PREFIX: 'lock_',

  LOCK_TIMEOUT_SECONDS: 60, // ロックの有効期間（秒）



  /**

   * 指定されたIDのロックを取得する。既にロックされている場合は例外を投げる。

   * @param {string} id - ロック対象の一意のID (例: plan_id)

   * @returns {boolean} ロック成功時にtrue

   * @throws {Error} IDが空の場合、または既にロックされている場合

   */

  acquireLock(id) {

    if (!id) {

      // ロックIDがない場合は何もしないで成功とみなす

      Logger.info('ロックIDが指定されていないため、ロック処理をスキップしました。');

      return true;

    }

    

    const lockKey = this.CACHE_PREFIX + id;

    // CacheServiceへの同時アクセスによる競合状態を防ぐため、ScriptLockを使用する

    const scriptLock = LockService.getScriptLock();

    

    try {

      // 最大5秒間、スクリプトロックの取得を試みる

      scriptLock.waitLock(5000);

      

      const cache = CacheService.getScriptCache();

      const existingLock = cache.get(lockKey);

      

      if (existingLock) {

        // 既にロック（キャッシュ）が存在する

        throw new Error(`ID '${id}' is currently locked due to a recent execution.`);

      }

      

      // 新しくロック（キャッシュ）を設定する

      cache.put(lockKey, 'locked', this.LOCK_TIMEOUT_SECONDS);

      Logger.info(`ID '${id}' のロックを取得しました。有効期限: ${this.LOCK_TIMEOUT_SECONDS}秒`);

      

      return true;

      

    } finally {

      // 必ずスクリプトロックを解放する

      scriptLock.releaseLock();

    }

  }

};