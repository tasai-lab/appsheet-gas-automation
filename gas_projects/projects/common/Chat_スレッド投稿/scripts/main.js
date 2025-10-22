/**
 * Chat_スレッド投稿 - メインスクリプト
 *
 * Google Chatのスレッドにメッセージを投稿し、投稿したメッセージIDを返却します。
 * v1.3.0からメッセージ更新機能も追加されました。
 *
 * @version 1.3.0
 * @date 2025-10-22
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
  Logger.log(`[DEBUG] postMessageToThread開始`);
  Logger.log(`[DEBUG] threadId: ${threadId}`);
  Logger.log(`[DEBUG] messageText長: ${messageText.length}文字`);
  Logger.log(`[DEBUG] userEmail: ${userEmail}`);

  const cleanedText = cleanMessageText(messageText);
  Logger.log(`[DEBUG] クリーニング後テキスト長: ${cleanedText.length}文字`);

  const { apiUrl, messageResource } = buildChatApiPayload(threadId, cleanedText);
  Logger.log(`[DEBUG] API URL: ${apiUrl}`);
  Logger.log(`[DEBUG] messageResource: ${JSON.stringify(messageResource).substring(0, 300)}`);

  const accessToken = getAccessTokenForUser(userEmail);
  Logger.log(`[DEBUG] アクセストークン取得成功`);

  const messageId = executeChatPost(apiUrl, messageResource, accessToken);
  Logger.log(`[DEBUG] メッセージ投稿成功: ${messageId}`);

  return messageId;
}

function cleanMessageText(text) {
  let cleaned = (text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\n/g, '\n');

  // 標準マークダウンをGoogle Chat形式に変換
  cleaned = convertMarkdownToGoogleChat(cleaned);

  return cleaned.trim();
}

/**
 * 標準マークダウンをGoogle Chat形式に変換
 * @param {string} text - 変換元テキスト
 * @return {string} Google Chat形式のテキスト
 */
function convertMarkdownToGoogleChat(text) {
  Logger.log('[DEBUG] convertMarkdownToGoogleChat開始');
  Logger.log(`[DEBUG] 変換前テキスト長: ${text.length}文字`);

  let converted = text;

  // 1. コードブロックを一時的に保護（変換対象から除外）
  const codeBlocks = [];
  converted = converted.replace(/```([\s\S]*?)```/g, (match, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });

  // 2. インラインコードを一時的に保護
  const inlineCodes = [];
  converted = converted.replace(/`([^`]+)`/g, (match, code) => {
    const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
    inlineCodes.push(match);
    return placeholder;
  });

  // 3. リンク形式を変換: [テキスト](URL) → <URL|テキスト>
  converted = converted.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<$2|$1>');

  // 4. 打ち消し線を変換: ~~テキスト~~ → ~テキスト~
  converted = converted.replace(/~~([^~]+)~~/g, '~$1~');

  // 5. 太字を一時的にマークして変換: **テキスト** → {{BOLD:テキスト}}
  converted = converted.replace(/\*\*([^\*]+)\*\*/g, '{{BOLD:$1}}');

  // 6. 斜体を変換: *テキスト* → _テキスト_
  converted = converted.replace(/\*([^\*]+)\*/g, '_$1_');

  // 7. 太字のマークを戻す: {{BOLD:テキスト}} → *テキスト*
  converted = converted.replace(/\{\{BOLD:([^}]+)\}\}/g, '*$1*');

  // 8. コードブロックを復元
  codeBlocks.forEach((code, index) => {
    converted = converted.replace(`__CODE_BLOCK_${index}__`, code);
  });

  // 9. インラインコードを復元
  inlineCodes.forEach((code, index) => {
    converted = converted.replace(`__INLINE_CODE_${index}__`, code);
  });

  Logger.log(`[DEBUG] 変換後テキスト長: ${converted.length}文字`);
  if (text !== converted) {
    Logger.log('[DEBUG] マークダウン変換を実行しました');
    Logger.log(`[DEBUG] 変換例（最初の200文字）:\n変換前: ${text.substring(0, 200)}\n変換後: ${converted.substring(0, 200)}`);
  }

  return converted;
}

function buildChatApiPayload(threadId, messageText) {
  Logger.log(`[DEBUG] buildChatApiPayload開始: threadId=${threadId}`);

  const messageResource = { text: messageText };
  let spaceName = '';
  let apiUrl = '';

  if (threadId.includes('/messages/')) {
    Logger.log(`[DEBUG] パターン: メッセージIDからスレッド取得`);
    // メッセージIDからスレッド名を取得してスレッドに返信
    spaceName = extractSpaceFromMessageId(threadId);
    Logger.log(`[DEBUG] spaceName: ${spaceName}`);

    const threadName = getThreadNameFromMessageId(threadId);
    Logger.log(`[DEBUG] threadName: ${threadName}`);

    messageResource.thread = { name: threadName };
    apiUrl = `https://chat.googleapis.com/v1/${spaceName}/messages?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;
  } else if (threadId.includes('/threads/')) {
    Logger.log(`[DEBUG] パターン: スレッドIDを直接指定`);
    // スレッドIDを直接指定してスレッドに返信
    messageResource.thread = { name: threadId };
    spaceName = threadId.split('/threads/')[0];
    Logger.log(`[DEBUG] spaceName: ${spaceName}`);
    apiUrl = `https://chat.googleapis.com/v1/${spaceName}/messages?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;
  } else if (threadId.match(/^spaces\/[^\/]+$/)) {
    Logger.log(`[DEBUG] パターン: 新規スレッド作成`);
    // スペースIDのみの場合は新しいスレッドを作成
    spaceName = threadId;
    messageResource.thread = { threadKey: `thread-${Utilities.getUuid()}` };
    apiUrl = `https://chat.googleapis.com/v1/${spaceName}/messages`;
  } else {
    throw new Error(`無効なthreadId形式: ${threadId}`);
  }

  Logger.log(`[DEBUG] 最終API URL: ${apiUrl}`);
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
  Logger.log(`[DEBUG] getThreadNameFromMessageId開始: messageId=${messageId}`);

  try {
    // REST APIを使ってメッセージ情報を取得
    const apiUrl = `https://chat.googleapis.com/v1/${messageId}`;
    Logger.log(`[DEBUG] REST API呼び出し: ${apiUrl}`);

    const accessToken = ScriptApp.getOAuthToken();
    const options = {
      method: 'get',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log(`[DEBUG] レスポンスコード: ${responseCode}`);
    Logger.log(`[DEBUG] レスポンス: ${responseText.substring(0, 500)}`);

    if (responseCode !== 200) {
      throw new Error(`Chat API呼び出し失敗 (${responseCode}): ${responseText}`);
    }

    const messageInfo = JSON.parse(responseText);

    if (!messageInfo || !messageInfo.thread || !messageInfo.thread.name) {
      throw new Error('スレッド情報を取得できませんでした');
    }

    Logger.log(`[DEBUG] スレッド名取得成功: ${messageInfo.thread.name}`);
    return messageInfo.thread.name;
  } catch (error) {
    Logger.log(`[ERROR] getThreadNameFromMessageId失敗: ${error.message}`);
    throw new Error(`Chat APIでのスレッド情報取得に失敗: ${error.message}`);
  }
}

function executeChatPost(apiUrl, messageResource, accessToken) {
  Logger.log(`[DEBUG] executeChatPost開始`);
  Logger.log(`[DEBUG] API URL: ${apiUrl}`);
  Logger.log(`[DEBUG] messageResource: ${JSON.stringify(messageResource).substring(0, 300)}`);

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    payload: JSON.stringify(messageResource),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  Logger.log(`[DEBUG] レスポンスコード: ${responseCode}`);
  Logger.log(`[DEBUG] レスポンス: ${responseText.substring(0, 500)}`);

  if (responseCode !== 200) {
    Logger.log(`[ERROR] Chat API呼び出し失敗: ${responseText}`);
    throw new Error(`Chat API呼び出し失敗 (${responseCode}): ${responseText}`);
  }

  const result = JSON.parse(responseText);

  if (!result.name) {
    throw new Error('Chat APIレスポンスにメッセージIDが含まれていません');
  }

  Logger.log(`[DEBUG] メッセージID: ${result.name}`);
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
// 2. メッセージ更新機能
// ================================================================================================

/**
 * Google Chatのメッセージを更新する関数
 *
 * 既に投稿されたメッセージのテキストを更新します。
 * メッセージの投稿者と更新者は同じユーザーである必要があります。
 *
 * @param {string} messageId - 更新するメッセージのID（形式: "spaces/AAAA/messages/CCCC"）
 * @param {string} newMessageText - 新しいメッセージ本文
 * @param {string} userEmail - 更新者のメールアドレス（元の投稿者と同じである必要がある）
 * @returns {Object} JSON形式の結果 { status: "success"|"error", messageId?: string, error?: string, timestamp: string }
 *
 * @example
 * const result = updateChatMessage(
 *   "spaces/AAAAxxxxxxxx/messages/CCCCxxxxxxxx",
 *   "更新されたメッセージです",
 *   "user@example.com"
 * );
 */
function updateChatMessage(messageId, newMessageText, userEmail) {
  try {
    // パラメータ検証
    if (!messageId || typeof messageId !== 'string') {
      throw new Error('messageIdは必須です（文字列）');
    }
    if (!newMessageText || typeof newMessageText !== 'string') {
      throw new Error('newMessageTextは必須です（文字列）');
    }
    if (!userEmail || typeof userEmail !== 'string') {
      throw new Error('userEmailは必須です（文字列）');
    }
    if (!messageId.match(/^spaces\/[^\/]+\/messages\/[^\/]+$/)) {
      throw new Error('messageIdの形式が不正です（spaces/xxx/messages/xxx の形式である必要があります）');
    }

    // メッセージ更新
    const updatedMessageId = executeMessageUpdate(messageId, newMessageText, userEmail);

    Logger.log(`[SUCCESS] メッセージ更新成功: ${updatedMessageId}`);

    return {
      status: 'success',
      messageId: updatedMessageId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    Logger.log(`[ERROR] メッセージ更新失敗: ${error.message}\n${error.stack}`);

    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * メッセージ更新の実処理
 * @private
 */
function executeMessageUpdate(messageId, newMessageText, userEmail) {
  Logger.log(`[DEBUG] executeMessageUpdate開始`);
  Logger.log(`[DEBUG] messageId: ${messageId}`);
  Logger.log(`[DEBUG] newMessageText長: ${newMessageText.length}文字`);
  Logger.log(`[DEBUG] userEmail: ${userEmail}`);

  // メッセージテキストのクリーニングとマークダウン変換
  const cleanedText = cleanMessageText(newMessageText);
  Logger.log(`[DEBUG] クリーニング後テキスト長: ${cleanedText.length}文字`);

  // アクセストークン取得
  const accessToken = getAccessTokenForUser(userEmail);
  Logger.log(`[DEBUG] アクセストークン取得成功`);

  // Chat API PATCH リクエスト
  const apiUrl = `https://chat.googleapis.com/v1/${messageId}?updateMask=text`;
  Logger.log(`[DEBUG] API URL: ${apiUrl}`);

  const messageResource = {
    text: cleanedText
  };

  const options = {
    method: 'patch',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    payload: JSON.stringify(messageResource),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  Logger.log(`[DEBUG] レスポンスコード: ${responseCode}`);
  Logger.log(`[DEBUG] レスポンス: ${responseText.substring(0, 500)}`);

  if (responseCode !== 200) {
    Logger.log(`[ERROR] Chat API呼び出し失敗: ${responseText}`);
    throw new Error(`Chat API更新失敗 (${responseCode}): ${responseText}`);
  }

  const result = JSON.parse(responseText);

  if (!result.name) {
    throw new Error('Chat APIレスポンスにメッセージIDが含まれていません');
  }

  Logger.log(`[DEBUG] メッセージ更新成功: ${result.name}`);
  return result.name;
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

/**
 * メッセージ更新のテスト関数
 *
 * GASエディタから実行してメッセージ更新機能を確認するためのサンプル関数
 * 実際に使用する際は、messageId と userEmail を適切な値に変更してください
 */
function testUpdateChatMessage() {
  // ⚠️ 以下の値を実際の環境に合わせて変更してください

  const messageId = "spaces/AAAAxxxxxxxx/messages/CCCCxxxxxxxx";  // 更新対象のメッセージID
  const newMessageText = "メッセージを更新しました: " + new Date().toLocaleString('ja-JP');
  const userEmail = "user@example.com";  // 元の投稿者と同じメールアドレス

  Logger.log(`[TEST] メッセージ更新開始`);
  Logger.log(`  messageId: ${messageId}`);
  Logger.log(`  newMessageText: ${newMessageText}`);
  Logger.log(`  userEmail: ${userEmail}`);

  const result = updateChatMessage(messageId, newMessageText, userEmail);

  Logger.log(`[TEST] 結果:`);
  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

/**
 * マークダウン変換のテスト関数
 */
function testMarkdownConversion() {
  const testCases = [
    {
      name: '太字',
      input: 'これは**太字**です',
      expected: 'これは*太字*です'
    },
    {
      name: '斜体',
      input: 'これは*斜体*です',
      expected: 'これは_斜体_です'
    },
    {
      name: '打ち消し線',
      input: 'これは~~打ち消し~~です',
      expected: 'これは~打ち消し~です'
    },
    {
      name: 'リンク',
      input: 'これは[リンク](https://example.com)です',
      expected: 'これは<https://example.com|リンク>です'
    },
    {
      name: '複合',
      input: '**太字**と*斜体*と~~打ち消し~~と`コード`',
      expected: '*太字*と_斜体_と~打ち消し~と`コード`'
    },
    {
      name: 'コードブロック',
      input: '```\nfunction test() {\n  return "**これは変換されない**";\n}\n```',
      expected: '```\nfunction test() {\n  return "**これは変換されない**";\n}\n```'
    }
  ];

  Logger.log('[TEST] マークダウン変換テスト開始');
  Logger.log('='.repeat(50));

  let passCount = 0;
  let failCount = 0;

  testCases.forEach((testCase, index) => {
    const result = convertMarkdownToGoogleChat(testCase.input);
    const passed = result === testCase.expected;

    if (passed) {
      passCount++;
      Logger.log(`✅ テスト ${index + 1}: ${testCase.name} - 成功`);
    } else {
      failCount++;
      Logger.log(`❌ テスト ${index + 1}: ${testCase.name} - 失敗`);
      Logger.log(`  入力: ${testCase.input}`);
      Logger.log(`  期待: ${testCase.expected}`);
      Logger.log(`  結果: ${result}`);
    }
  });

  Logger.log('='.repeat(50));
  Logger.log(`[TEST] 結果: ${passCount}件成功, ${failCount}件失敗`);

  return { passCount, failCount, total: testCases.length };
}
