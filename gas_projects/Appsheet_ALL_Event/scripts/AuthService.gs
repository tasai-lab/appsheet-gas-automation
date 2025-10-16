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


const AuthService = {

  _serviceAccountJsonKey: 'SERVICE_ACCOUNT_JSON', // スクリプトプロパティのキー名

  _callbackFunctionName: 'authCallback',

  _calendarScope: ['https://www.googleapis.com/auth/calendar'],



  /**

   * 指定されたユーザーのアクセストークンを取得する

   * @param {string} userEmail

   * @returns {string} アクセストークン

   */

  getAccessTokenForUser(userEmail) {

    const service = this._createOAuth2ServiceForUser(userEmail);

    if (!service.hasAccess()) {

      Logger.info(`OAuth2: ${userEmail} のための初回認証またはトークンリフレッシュを実行します。`);

    }

    const accessToken = service.getAccessToken();

    if (!accessToken) {

      Logger.error(`OAuth2アクセストークン取得失敗。`, new Error(service.getLastError()), { userEmail });

      throw new Error(`OAuth2アクセストークン取得失敗: ${service.getLastError()}`);

    }

    return accessToken;

  },



  /**

   * ユーザーごとのOAuth2サービスを作成する

   * @private

   * @param {string} userEmail

   * @returns {GoogleAppsScriptOAuth2.Service}

   */

  _createOAuth2ServiceForUser(userEmail) {

    const serviceNamePrefix = 'CalendarImpersonation';

    const serviceAccountJsonString = PropertiesService.getScriptProperties().getProperty(this._serviceAccountJsonKey);

    if (!serviceAccountJsonString) {

      throw new Error(`スクリプトプロパティ '${this._serviceAccountJsonKey}' が設定されていません。`);

    }

    const serviceAccountInfo = JSON.parse(serviceAccountJsonString);

    

    return OAuth2.createService(`${serviceNamePrefix}:${userEmail}`)

      .setTokenUrl('https://oauth2.googleapis.com/token')

      .setPrivateKey(serviceAccountInfo.private_key)

      .setIssuer(serviceAccountInfo.client_email)

      .setClientId(serviceAccountInfo.client_id)

      .setSubject(userEmail)

      .setScope(this._calendarScope.join(' '))

      .setPropertyStore(PropertiesService.getScriptProperties())

      .setCache(CacheService.getScriptCache())

      .setLock(LockService.getScriptLock())

      .setCallbackFunction(this._callbackFunctionName);

  }

};



/**

 * OAuth2認証フローのためのコールバック関数

 * @param {Object} request

 * @returns {GoogleAppsScript.HTML.HtmlOutput}

 */

function authCallback(request) {

  // 注意：この関数はAuthServiceオブジェクトの一部ではないため、グローバルスコープに配置する必要があります。

  const service = OAuth2.getService();

  const isAuthorized = service.handleCallback(request);

  const message = isAuthorized ? `認証成功: ${service.getServiceName()}` : `認証失敗: ${service.getLastError()}`;

  return HtmlService.createHtmlOutput(message);

}