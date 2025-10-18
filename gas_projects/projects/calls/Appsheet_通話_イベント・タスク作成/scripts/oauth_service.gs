/**
 * OAuth2認証サービス
 * サービスアカウントによるドメイン全体の委任
 * 
 * @author Fractal Group
 * @version 1.1.0
 * @date 2025-10-17
 */

// --- OAuth2設定 ---
const DEFAULT_SERVICE_ACCOUNT_JSON_KEY = 'SERVICE_ACCOUNT_JSON';
const DEFAULT_OAUTH_CALLBACK_FUNCTION = 'authCallback';

/**
 * ユーザー代理OAuth2サービス作成
 * サービスアカウントを使用して特定ユーザーの権限で認証
 * 
 * @param {string} userEmail - 代理するユーザーのメールアドレス
 * @param {Array<string>} scopes - 必要なOAuth2スコープ
 * @param {string} serviceNamePrefix - サービス名プレフィックス
 * @param {string} serviceAccountJsonKey - スクリプトプロパティのキー名
 * @param {string} callbackFunctionName - OAuth2コールバック関数名
 * @return {OAuth2.Service} OAuth2サービスオブジェクト
 */
function createOAuth2ServiceForUser(
  userEmail,
  scopes,
  serviceNamePrefix,
  serviceAccountJsonKey = DEFAULT_SERVICE_ACCOUNT_JSON_KEY,
  callbackFunctionName = DEFAULT_OAUTH_CALLBACK_FUNCTION
) {
  const serviceAccountJsonString = PropertiesService.getScriptProperties().getProperty(serviceAccountJsonKey);
  if (!serviceAccountJsonString) {
    throw new Error(`スクリプトプロパティ '${serviceAccountJsonKey}' が設定されていません`);
  }
  
  const serviceAccountInfo = JSON.parse(serviceAccountJsonString);
  
  return OAuth2.createService(`${serviceNamePrefix}:${userEmail}`)
    .setTokenUrl('https://oauth2.googleapis.com/token')
    .setPrivateKey(serviceAccountInfo.private_key)
    .setIssuer(serviceAccountInfo.client_email)
    .setClientId(serviceAccountInfo.client_id)
    .setSubject(userEmail)
    .setScope(scopes.join(' '))
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setCache(CacheService.getScriptCache())
    .setLock(LockService.getScriptLock())
    .setCallbackFunction(callbackFunctionName);
}

/**
 * アクセストークン取得
 * OAuth2サービスからアクセストークンを取得
 * 
 * @param {OAuth2.Service} service - OAuth2サービスオブジェクト
 * @return {string} アクセストークン
 * @throws {Error} トークン取得に失敗した場合
 */
function getAccessToken(service) {
  if (!service.hasAccess()) {
    Logger.log(`[OAuth2警告] アクセス権なし。最後のエラー: ${service.getLastError()}`);
  }
  
  const accessToken = service.getAccessToken();
  if (!accessToken) {
    throw new Error(`OAuth2アクセストークン取得失敗。最後のエラー: ${service.getLastError()}`);
  }
  
  return accessToken;
}

/**
 * OAuth2コールバック関数
 * OAuth2ライブラリが必要とするコールバック
 * 
 * @param {Object} request - コールバックリクエスト
 * @return {GoogleAppsScript.HTML.HtmlOutput} コールバック結果HTML
 */
function authCallback(request) {
  return HtmlService.createHtmlOutput('OAuth2認証完了');
}
