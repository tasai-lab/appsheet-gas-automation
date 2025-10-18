/**
 * OAuth2認証サービス
 * サービスアカウントを使用したユーザーなりすまし認証
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-18
 */

/**
 * OAuth2サービスを作成
 * @param {string} userEmail - なりすますユーザーのメールアドレス
 * @param {string[]} scopes - 必要なスコープ
 * @param {string} serviceNamePrefix - サービス名のプレフィックス
 * @returns {OAuth2.Service} - OAuth2サービス
 */
function createOAuth2Service(userEmail, scopes, serviceNamePrefix) {
  const config = getConfig();

  // サービスアカウントJSONを取得
  const serviceAccountJsonString = PropertiesService.getScriptProperties()
    .getProperty(config.oauth.SERVICE_ACCOUNT_JSON_KEY);

  if (!serviceAccountJsonString) {
    throw new Error(`スクリプトプロパティ '${config.oauth.SERVICE_ACCOUNT_JSON_KEY}' が設定されていません`);
  }

  const serviceAccountInfo = JSON.parse(serviceAccountJsonString);

  // OAuth2サービスを作成
  return OAuth2.createService(`${serviceNamePrefix}:${userEmail}`)
    .setTokenUrl(config.oauth.TOKEN_URL)
    .setPrivateKey(serviceAccountInfo.private_key)
    .setIssuer(serviceAccountInfo.client_email)
    .setClientId(serviceAccountInfo.client_id)
    .setSubject(userEmail)
    .setScope(scopes.join(' '))
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setCache(CacheService.getScriptCache())
    .setLock(LockService.getScriptLock())
    .setCallbackFunction(config.oauth.CALLBACK_FUNCTION);
}

/**
 * アクセストークンを取得
 * @param {OAuth2.Service} service - OAuth2サービス
 * @returns {string} - アクセストークン
 */
function getAccessToken(service) {
  if (!service.hasAccess()) {
    Logger.log(`[Auth] OAuth2サービスにアクセス権がありません。最後のエラー: ${service.getLastError()}`);
  }

  const accessToken = service.getAccessToken();

  if (!accessToken) {
    throw new Error(`OAuth2アクセストークン取得失敗。最後のエラー: ${service.getLastError()}`);
  }

  return accessToken;
}

/**
 * OAuth2コールバック関数
 * @param {Object} request - コールバックリクエスト
 * @returns {GoogleAppsScript.HTML.HtmlOutput} - HTML出力
 */
function authCallback(request) {
  const service = OAuth2.getService();
  const isAuthorized = service.handleCallback(request);
  const message = isAuthorized
    ? `認証成功: ${service.getServiceName()}`
    : `認証失敗: ${service.getLastError()}`;

  return HtmlService.createHtmlOutput(message);
}
