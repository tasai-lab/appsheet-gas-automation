// --- 1. 基本設定 ---

const GEMINI_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY'; // ★ Gemini APIキーを設定

const DEFAULT_SERVICE_ACCOUNT_JSON_KEY = 'SERVICE_ACCOUNT_JSON';

const DEFAULT_OAUTH_CALLBACK_FUNCTION = 'authCallback';

/**

 * AppSheetなどからのWebhook POSTリクエストを受け取るメイン関数

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_ALL_スレッド更新';
    return processRequest(params.threadId || params.data?.threadId, params.updateText || params.data?.updateText, params.userId || params.data?.userId);
  });
}

/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(threadId, updateText, userId) {
  let result = { status: "error", updatedMessageId: null, errorMessage: null };

  try {

    Logger.log(`Webhook受信: ${JSON.stringify(params)}`);

    let { impersonatingUserEmail, messageId, originalMessageText, newMessageText } = params;

    if (!impersonatingUserEmail || !messageId || !newMessageText || !originalMessageText) {

      throw new Error("必須パラメータ（impersonatingUserEmail, messageId, originalMessageText, newMessageText）が不足しています。");

    }

    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

    // ★ 1. テキストの前処理（改行とアスタリスクの整形）★

    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

    const cleanText = (text) => {

      if (!text) return "";

      return text

        .replace(/<br>/g, '\n')      // <br>タグを改行に変換

        .replace(/\\n/g, '\n')       // 文字列の"\n"を改行に変換

        .replace(/\*\*/g, '*')       // アスタリスク2つを1つに

        .replace(/\* /g, '* '); // アスタリスクと空白3つを2つに

    };

    const cleanedOriginalMessage = cleanText(originalMessageText);

    const cleanedNewMessage = cleanText(newMessageText);

    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

    // ★ 2. AIに変更点の要約を生成させる          ★

    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

    const changeSummary = generateChangeSummaryWithGemini(cleanedOriginalMessage, cleanedNewMessage);

    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

    // ★ 3. 最終的な投稿メッセージを組み立てる     ★

    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

    const finalMessageText = `${cleanedNewMessage}\n\n${changeSummary}`;

    // --- Chatメッセージを更新 ---

    const chatResult = updateChatMessage(messageId, finalMessageText, impersonatingUserEmail);

    if (chatResult.status === 'SUCCESS') {

      result.status = "success";

      result.updatedMessageId = chatResult.updatedMessageId;

      Logger.log(`メッセージの更新に成功しました。Message ID: ${chatResult.updatedMessageId}`);

    } else {

      throw new Error(chatResult.errorMessage || "不明なChat更新エラー");

    }

  } catch (error) {

    Logger.log(`doPostでエラーが発生: ${error.toString()}`);

    result.errorMessage = error.toString();

  }

  return ContentService.createTextOutput(JSON.stringify(result))

    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  // TODO: テストデータを設定してください
  const testParams = {
    // 例: action: "test",
    // 例: data: "sample"
  };

  return CommonTest.runTest((params) => processRequest(params.threadId, params.updateText, params.userId), testParams, 'Appsheet_ALL_スレッド更新');
}

/**

 * Gemini APIを呼び出し、2つのテキストの差分を要約する

 */

function generateChangeSummaryWithGemini(originalText, newText) {

  const prompt = `

# 指示

以下の「変更前の文章」と「変更後の文章」を比較し、何がどのように変更されたのかを1行で簡潔に要約してください。

要約は必ず「変更内容: 」から始めてください。

# 変更前の文章

${originalText}

# 変更後の文章

${newText}

`;

  const model = 'gemini-2.5-flash';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const requestBody = {

    contents: [{ parts: [{ text: prompt }] }],

    generationConfig: { "temperature": 0.1 }

  };

  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(requestBody), muteHttpExceptions: true };

  const response = UrlFetchApp.fetch(url, options);

  const responseText = response.getContentText();

  const jsonResponse = JSON.parse(responseText);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {

    console.log("警告: AIによる変更点の要約生成に失敗しました。");

    return "（変更点の自動要約に失敗しました）";

  }

  return jsonResponse.candidates[0].content.parts[0].text.trim();

}

/**

 * 既存のGoogle Chatメッセージを更新（内容を置き換え）する

 */

function updateChatMessage(messageName, newText, email) {

  const result = { status: 'FAILURE', updatedMessageId: null, errorMessage: null };

  try {

    if (!messageName || !messageName.includes('/messages/')) {

      throw new Error('無効なメッセージID形式です。');

    }

    const chatScopes = ['https://www.googleapis.com/auth/chat.messages'];

    const servicePrefix = 'GenericChatUpdateImpersonation';

    const chatService = createOAuth2ServiceForUser(email, chatScopes, servicePrefix);

    const accessToken = getAccessToken(chatService);

    const apiUrl = `https://chat.googleapis.com/v1/${messageName}?updateMask=text`;

    const payload = { "text": newText };

    const options = {

      method: 'patch',

      contentType: 'application/json',

      headers: { 'Authorization': `Bearer ${accessToken}` },

      payload: JSON.stringify(payload),

      muteHttpExceptions: true

    };

    const response = UrlFetchApp.fetch(apiUrl, options);

    const responseCode = response.getResponseCode();

    const responseBody = response.getContentText();

    if (responseCode >= 200 && responseCode < 300) {

      const updatedMessage = JSON.parse(responseBody);

      result.status = 'SUCCESS';

      result.updatedMessageId = updatedMessage.name;

    } else {

      throw new Error(`Chat APIエラー: Status ${responseCode}, Body: ${responseBody}`);

    }

  } catch (e) {

    result.errorMessage = e.message;

    Logger.log(`Chatメッセージ更新処理でエラー: ${result.errorMessage}`);

  }

  return result;

}

// =================================================================

// 認証ヘルパー関数群 (他のスクリプトから流用)

// =================================================================

function createOAuth2ServiceForUser(userEmail, scopes, serviceNamePrefix, serviceAccountJsonKey = DEFAULT_SERVICE_ACCOUNT_JSON_KEY, callbackFunctionName = DEFAULT_OAUTH_CALLBACK_FUNCTION) {

    const serviceAccountJsonString = PropertiesService.getScriptProperties().getProperty(serviceAccountJsonKey);

    if (!serviceAccountJsonString) throw new Error(`スクリプトプロパティ '${serviceAccountJsonKey}' が設定されていません。`);

    const serviceAccountInfo = JSON.parse(serviceAccountJsonString);

    return OAuth2.createService(`${serviceNamePrefix}:${userEmail}`).setTokenUrl('https://oauth2.googleapis.com/token').setPrivateKey(serviceAccountInfo.private_key).setIssuer(serviceAccountInfo.client_email).setClientId(serviceAccountInfo.client_id).setSubject(userEmail).setScope(scopes.join(' ')).setPropertyStore(PropertiesService.getScriptProperties()).setCache(CacheService.getScriptCache()).setLock(LockService.getScriptLock()).setCallbackFunction(callbackFunctionName);

}

function getAccessToken(service) {

    if (!service.hasAccess()) {

        Logger.log(`警告: OAuth2サービスにはアクセス権がありません。最後のエラー: ${service.getLastError()}。トークン取得を試みます。`);

    }

    const accessToken = service.getAccessToken();

    if (!accessToken) {

        throw new Error(`OAuth2アクセストークン取得失敗。最後のエラー: ${service.getLastError()}`);

    }

    return accessToken;

}

function authCallback(request) {

    const service = OAuth2.getService();

    const isAuthorized = service.handleCallback(request);

    const message = isAuthorized ? `認証成功: ${service.getServiceName()}` : `認証失敗: ${service.getLastError()}`;

    return HtmlService.createHtmlOutput(message);

}
