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
