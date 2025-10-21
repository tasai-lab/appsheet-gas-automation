/**
 * Chat_スレッド投稿 - メインスクリプト
 *
 * Google Chatのスレッドにメッセージを投稿し、投稿したメッセージIDを返却します。
 *
 * @version 1.0.0
 * @date 2025-10-21
 */

// ================================================================================================
// 1. メインエントリーポイント
// ================================================================================================

/**
 * 直接実行用関数 - Google Chatのスレッドまたはスペースにメッセージを投稿
 *
 * GASエディタから直接実行、またはスクリプトから呼び出すための関数
 *
 * @param {string} threadId - スレッドIDまたはスペースID
 *   - スレッド指定: "spaces/AAAA/threads/BBBB"
 *   - メッセージID: "spaces/AAAA/messages/CCCC"
 *   - スペース指定（新規スレッド作成）: "spaces/AAAA"
 * @param {string} messageText - 投稿するメッセージ本文
 * @param {string} userEmail - 投稿者のメールアドレス（なりすまし対象）
 * @returns {Object} JSON形式の結果 { status: "success"|"error", messageId?: string, error?: string, timestamp: string }
 *
 * @example
 * // 既存スレッドに投稿
 * const result1 = postChatMessage(
 *   "spaces/AAAAxxxxxxxx/threads/BBBBxxxxxxxx",
 *   "テストメッセージです",
 *   "user@example.com"
 * );
 *
 * @example
 * // スペースに新規スレッドを作成して投稿
 * const result2 = postChatMessage(
 *   "spaces/AAAAxxxxxxxx",
 *   "新しいスレッドです",
 *   "user@example.com"
 * );
 */
function postChatMessage(threadId, messageText, userEmail) {
  try {
    // パラメータ検証
    if (!threadId || typeof threadId !== 'string') {
      throw new Error('threadIdは必須です（文字列）');
    }
    if (!messageText || typeof messageText !== 'string') {
      throw new Error('messageTextは必須です（文字列）');
    }
    if (!userEmail || typeof userEmail !== 'string') {
      throw new Error('userEmailは必須です（文字列）');
    }
    if (!threadId.startsWith('spaces/')) {
      throw new Error('threadIdの形式が不正です（spaces/で始まる必要があります）');
    }

    // メッセージ投稿
    const messageId = postMessageToThread(threadId, messageText, userEmail);

    Logger.log(`[SUCCESS] メッセージ投稿成功: ${messageId}`);

    return {
      status: 'success',
      messageId: messageId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    Logger.log(`[ERROR] メッセージ投稿失敗: ${error.message}\n${error.stack}`);

    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * AppSheet Webhook エントリーポイント
 *
 * @param {GoogleAppsScript.Events.DoPost} e - POSTリクエストイベント
 * @returns {GoogleAppsScript.Content.TextOutput} JSON形式のレスポンス
 */
function doPost(e) {
  try {
    const params = parseRequestBody(e);
    validateParameters(params);

    const messageId = postMessageToThread(
      params.threadId,
      params.messageText,
      params.userEmail
    );

    return createJsonResponse({
      status: 'success',
      messageId: messageId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    Logger.log(`[ERROR] ${error.message}\n${error.stack}`);

    return createJsonResponse({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('リクエストボディが空です');
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error(`JSONパースエラー: ${error.message}`);
  }
}

function validateParameters(params) {
  if (!params.threadId || typeof params.threadId !== 'string') {
    throw new Error('threadIdは必須です（文字列）');
  }

  if (!params.messageText || typeof params.messageText !== 'string') {
    throw new Error('messageTextは必須です（文字列）');
  }

  if (!params.userEmail || typeof params.userEmail !== 'string') {
    throw new Error('userEmailは必須です（文字列）');
  }

  if (!params.threadId.startsWith('spaces/')) {
    throw new Error('threadIdの形式が不正です（spaces/で始まる必要があります）');
  }
}

function postMessageToThread(threadId, messageText, userEmail) {
  const cleanedText = cleanMessageText(messageText);
  const { apiUrl, messageResource } = buildChatApiPayload(threadId, cleanedText);
  const accessToken = getAccessTokenForUser(userEmail);
  const messageId = executeChatPost(apiUrl, messageResource, accessToken);

  return messageId;
}

function cleanMessageText(text) {
  return (text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\n/g, '\n')
    .trim();
}

function buildChatApiPayload(threadId, messageText) {
  const messageResource = { text: messageText };
  let spaceName = '';
  let apiUrl = '';

  if (threadId.includes('/messages/')) {
    // メッセージIDからスレッド名を取得してスレッドに返信
    spaceName = extractSpaceFromMessageId(threadId);
    const threadName = getThreadNameFromMessageId(threadId);
    messageResource.thread = { name: threadName };
    apiUrl = `https://chat.googleapis.com/v1/${spaceName}/messages?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;
  } else if (threadId.includes('/threads/')) {
    // スレッドIDを直接指定してスレッドに返信
    messageResource.thread = { name: threadId };
    spaceName = threadId.split('/threads/')[0];
    apiUrl = `https://chat.googleapis.com/v1/${spaceName}/messages?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;
  } else if (threadId.match(/^spaces\/[^\/]+$/)) {
    // スペースIDのみの場合は新しいスレッドを作成
    spaceName = threadId;
    messageResource.thread = { threadKey: `thread-${Utilities.getUuid()}` };
    apiUrl = `https://chat.googleapis.com/v1/${spaceName}/messages`;
  } else {
    throw new Error(`無効なthreadId形式: ${threadId}`);
  }

  return { apiUrl, messageResource };
}

function extractSpaceFromMessageId(messageId) {
  const match = messageId.match(/^(spaces\/[^\/]+)/);
  if (!match) {
    throw new Error(`メッセージIDからスペース名を抽出できません: ${messageId}`);
  }
  return match[1];
}

function getThreadNameFromMessageId(messageId) {
  if (typeof Chat === 'undefined' || !Chat.Spaces || !Chat.Spaces.Messages) {
    throw new Error('Google Chat API（高度なサービス）が有効になっていません');
  }

  try {
    const messageInfo = Chat.Spaces.Messages.get(messageId);

    if (!messageInfo || !messageInfo.thread || !messageInfo.thread.name) {
      throw new Error('スレッド情報を取得できませんでした');
    }

    return messageInfo.thread.name;
  } catch (error) {
    throw new Error(`Chat APIでのスレッド情報取得に失敗: ${error.message}`);
  }
}

function executeChatPost(apiUrl, messageResource, accessToken) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    payload: JSON.stringify(messageResource),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    const errorText = response.getContentText();
    throw new Error(`Chat API呼び出し失敗 (${responseCode}): ${errorText}`);
  }

  const result = JSON.parse(response.getContentText());

  if (!result.name) {
    throw new Error('Chat APIレスポンスにメッセージIDが含まれていません');
  }

  return result.name;
}

function getAccessTokenForUser(userEmail) {
  const serviceAccountJson = PropertiesService.getScriptProperties()
    .getProperty('SERVICE_ACCOUNT_JSON');

  if (!serviceAccountJson) {
    throw new Error('Script Propertiesに SERVICE_ACCOUNT_JSON が設定されていません');
  }

  if (typeof OAuth2 === 'undefined') {
    throw new Error('OAuth2ライブラリが追加されていません');
  }

  const serviceAccountInfo = JSON.parse(serviceAccountJson);

  const service = OAuth2.createService(`ChatPost:${userEmail}`)
    .setTokenUrl('https://oauth2.googleapis.com/token')
    .setPrivateKey(serviceAccountInfo.private_key)
    .setIssuer(serviceAccountInfo.client_email)
    .setClientId(serviceAccountInfo.client_id)
    .setSubject(userEmail)
    .setScope('https://www.googleapis.com/auth/chat.messages')
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setCache(CacheService.getScriptCache())
    .setLock(LockService.getScriptLock());

  if (!service.hasAccess()) {
    const lastError = service.getLastError();
    throw new Error(`OAuth2認証に失敗: ${JSON.stringify(lastError)}`);
  }

  return service.getAccessToken();
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================================================================================================
// テスト関数
// ================================================================================================

/**
 * テスト実行用関数
 *
 * GASエディタから実行して動作確認するためのサンプル関数
 * 実際に使用する際は、threadId と userEmail を適切な値に変更してください
 */
function testPostChatMessage() {
  // ⚠️ 以下の値を実際の環境に合わせて変更してください

  // パターン1: 既存スレッドに投稿
  const threadId = "spaces/AAAAxxxxxxxx/threads/BBBBxxxxxxxx";

  // パターン2: スペースに新規スレッドを作成して投稿
  // const threadId = "spaces/AAAAxxxxxxxx";

  const messageText = "テスト投稿: " + new Date().toLocaleString('ja-JP');
  const userEmail = "user@example.com";  // 投稿者のメールアドレス

  Logger.log(`[TEST] メッセージ投稿開始`);
  Logger.log(`  threadId: ${threadId}`);
  Logger.log(`  messageText: ${messageText}`);
  Logger.log(`  userEmail: ${userEmail}`);

  const result = postChatMessage(threadId, messageText, userEmail);

  Logger.log(`[TEST] 結果:`);
  Logger.log(JSON.stringify(result, null, 2));

  return result;
}
