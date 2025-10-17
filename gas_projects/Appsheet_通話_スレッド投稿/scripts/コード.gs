// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---
const APP_ID = '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f'; // AppSheetのアプリID
const ACCESS_KEY = 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT'; // AppSheet APIのアクセスキー
const QUERIES_TABLE_NAME = 'Call_Queries'; // 質疑応答テーブル

// サービスアカウントキーを保存しているスクリプトプロパティのキー名
const DEFAULT_SERVICE_ACCOUNT_JSON_KEY = 'SERVICE_ACCOUNT_JSON';
// OAuth2コールバック関数名
const DEFAULT_OAUTH_CALLBACK_FUNCTION = 'authCallback';

/**
 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数
 */
/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  return processRequest(params);
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  const queryId = params.queryId;
  Logger.log(`Webhook受信: ${JSON.stringify(params)}`);

  try {
    const { 
      targetThreadId, targetSpaceId, questionText, answerText, 
      posterName, posterEmail, rowUrl 
    } = params;

    if (!queryId || (!targetThreadId && !targetSpaceId) || !posterEmail) {
      throw new Error("必須パラメータ（queryId, posterEmail, targetThreadIdまたはtargetSpaceId）が不足しています。");
    }

    // ★★★ テキスト整形処理 ★★★
    const cleanedQuestion = (questionText || '').replace(/\* \*\*/g, '*').replace(/\*\*/g, '*').replace(/\* /g, '* ');
    const cleanedAnswer = (answerText || '').replace(/\*\*/g, '*').replace(/\* /g, '* ');
    // ★★★★★★★★★★★★★★★★★

    // 整形後のテキストでメッセージを組み立て
    const messageToSend = `Q. ${cleanedQuestion}\n\nA. ${cleanedAnswer}\n\n投稿者: ${posterName}\nURL: ${rowUrl}`;

    // Chatへ投稿
    const result = postQueryToChat(params, messageToSend);

    // 投稿成功後、AppSheetを更新
    if (result.status === 'SUCCESS' && result.sentMessageId) {
      updateQueryOnSuccess(queryId, result.sentMessageId);
      Logger.log(`処理完了。メッセージID ${result.sentMessageId} をAppSheetに記録しました。`);
    } else {
      throw new Error(result.errorMessage || "不明なChat投稿エラー");
    }

  } catch (error) {
    Logger.log(`doPostでエラーが発生: ${error.toString()}`);
    if (queryId) {
      updateQueryOnError(queryId, error.toString());
    }
  }
}


/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  // TODO: テストデータを設定してください
  const testParams = {
    // 例: callId: "test-123",
    // 例: recordId: "rec-456",
    // 例: action: "CREATE"
  };

  console.log('=== テスト実行: Appsheet_通話_スレッド投稿 ===');
  console.log('入力パラメータ:', JSON.stringify(testParams, null, 2));

  try {
    const result = processRequest(testParams);
    console.log('処理成功:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('処理エラー:', error.message);
    console.error('スタックトレース:', error.stack);
    throw error;
  }
}


/**
 * 条件に応じてChatに投稿する
 */
function postQueryToChat(params, text) {
  const { queryId, targetThreadId, targetSpaceId, posterEmail } = params;
  
  let apiUrl = '';
  const messageResource = { text: text };
  let spaceName = '';
  
  if (targetThreadId && targetThreadId.includes('/messages/')) {
    Logger.log(`メッセージIDからスレッドIDを取得します: ${targetThreadId}`);
    const messageInfo = Chat.Spaces.Messages.get(targetThreadId);
    if (!messageInfo.thread || !messageInfo.thread.name) {
      throw new Error(`メッセージID ${targetThreadId} からスレッド情報を取得できませんでした。`);
    }
    spaceName = messageInfo.space.name;
    apiUrl = `https://chat.googleapis.com/v1/${spaceName}/messages?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;
    messageResource.thread = { name: messageInfo.thread.name };

  } else if (targetThreadId && targetThreadId.includes('/threads/')) {
    Logger.log(`既存スレッドに返信します: ${targetThreadId}`);
    spaceName = targetThreadId.split('/threads/')[0];
    apiUrl = `https://chat.googleapis.com/v1/${spaceName}/messages?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;
    messageResource.thread = { name: targetThreadId };

  } else {
    Logger.log(`新しいスレッドを作成します: Space=${targetSpaceId}`);
    spaceName = targetSpaceId;
    apiUrl = `https://chat.googleapis.com/v1/${spaceName}/messages`;
    messageResource.thread = { threadKey: queryId };
  }

  return executeChatPost(apiUrl, messageResource, posterEmail);
}

/**
 * Google Chat APIを呼び出してメッセージを投稿する実行関数
 */
function executeChatPost(apiUrl, messageResource, impersonatingUserEmail) {
  const result = { status: 'FAILURE', sentMessageId: null, errorMessage: null };
  try {
    const chatScopes = ['https://www.googleapis.com/auth/chat.messages'];
    const servicePrefix = 'ChatImpersonation';
    
    const chatService = createOAuth2ServiceForUser(impersonatingUserEmail, chatScopes, servicePrefix);
    const accessToken = getAccessToken(chatService);

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      payload: JSON.stringify(messageResource),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    if (responseCode >= 200 && responseCode < 300) {
      const sentMessage = JSON.parse(responseBody);
      result.status = 'SUCCESS';
      result.sentMessageId = sentMessage.name;
    } else {
      throw new Error(`Chat APIエラー: Status ${responseCode}, Body: ${responseBody}`);
    }
  } catch (e) {
    result.errorMessage = e.message;
    Logger.log(`Chat投稿処理でエラー: ${result.errorMessage}`);
  }
  return result;
}

/**
 * 処理成功時にAppSheetを更新する
 */
function updateQueryOnSuccess(queryId, messageId) {
  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [{
      "query_id": queryId,
      "thread_id": messageId,
      "status": "完了"
    }]
  };
  callAppSheetApi(payload);
}

/**
 * 処理失敗時にAppSheetを更新する
 */
function updateQueryOnError(queryId, errorMessage) {
  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [{
      "query_id": queryId,
      "status": "エラー",
      "error_details": `GAS Script Error: ${errorMessage}`
    }]
  };
  callAppSheetApi(payload);
}

/**
 * AppSheet APIを呼び出す共通関数
 */
function callAppSheetApi(payload) {
  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${QUERIES_TABLE_NAME}/Action`;
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'ApplicationAccessKey': ACCESS_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(apiUrl, options);
  Logger.log(`AppSheet API 応答: ${response.getResponseCode()} - ${response.getContentText()}`);
  if (response.getResponseCode() >= 400) {
    throw new Error(`AppSheet API Error: ${response.getResponseCode()} - ${response.getContentText()}`);
  }
}

// =================================================================
// 認証ヘルパー関数群
// =================================================================

function createOAuth2ServiceForUser(userEmail, scopes, serviceNamePrefix, serviceAccountJsonKey = DEFAULT_SERVICE_ACCOUNT_JSON_KEY, callbackFunctionName = DEFAULT_OAUTH_CALLBACK_FUNCTION) {
  const serviceAccountJsonString = PropertiesService.getScriptProperties().getProperty(serviceAccountJsonKey);
  if (!serviceAccountJsonString) throw new Error(`スクリプトプロパティ '${serviceAccountJsonKey}' が設定されていません。`);
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