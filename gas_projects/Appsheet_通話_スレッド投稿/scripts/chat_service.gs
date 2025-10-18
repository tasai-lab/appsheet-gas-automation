/**
 * Google Chat API連携サービス
 * Google Chatへのメッセージ投稿機能を提供
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-18
 */

/**
 * Google Chatにメッセージを投稿
 * @param {Object} params - 投稿パラメータ
 * @param {string} params.targetThreadId - スレッドID（オプション）
 * @param {string} params.targetSpaceId - スペースID（オプション）
 * @param {string} params.messageText - 投稿メッセージ
 * @param {string} params.posterEmail - 投稿者のメールアドレス
 * @param {string} params.queryId - 質疑応答ID（スレッドキーとして使用）
 * @returns {Object} - 投稿結果
 */
function postMessageToChat(params) {
  const {
    targetThreadId,
    targetSpaceId,
    messageText,
    posterEmail,
    queryId
  } = params;

  try {
    // Chat APIペイロードを構築
    const chatPayload = buildChatPayload(targetThreadId, targetSpaceId, messageText, queryId);

    // Chat APIを実行
    const result = executeChatPost(chatPayload.apiUrl, chatPayload.messageResource, posterEmail);

    Logger.log(`[Chat] メッセージ投稿成功: ${result.messageId}`);

    return {
      status: 'success',
      messageId: result.messageId,
      errorMessage: null
    };

  } catch (error) {
    Logger.log(`[Chat] メッセージ投稿エラー: ${error.message}`);

    return {
      status: 'failure',
      messageId: null,
      errorMessage: error.message
    };
  }
}

/**
 * Chat APIペイロードを構築
 * @param {string} targetThreadId - スレッドID
 * @param {string} targetSpaceId - スペースID
 * @param {string} messageText - メッセージテキスト
 * @param {string} queryId - 質疑応答ID
 * @returns {Object} - APIペイロード
 */
function buildChatPayload(targetThreadId, targetSpaceId, messageText, queryId) {
  const messageResource = { text: messageText };
  let apiUrl = '';
  let spaceName = '';

  // ケース1: メッセージIDが指定されている（既存メッセージへの返信）
  if (targetThreadId && targetThreadId.includes('/messages/')) {
    Logger.log(`[Chat] メッセージIDからスレッド情報を取得: ${targetThreadId}`);

    // Chat高度なサービスを使用してスレッド情報を取得
    const messageInfo = Chat.Spaces.Messages.get(targetThreadId);

    if (!messageInfo || !messageInfo.thread || !messageInfo.thread.name) {
      throw new Error(`メッセージID ${targetThreadId} からスレッド情報を取得できませんでした`);
    }

    spaceName = messageInfo.space.name;
    messageResource.thread = { name: messageInfo.thread.name };
    apiUrl = `${CHAT_CONFIG.API_ENDPOINT}/${spaceName}/messages?messageReplyOption=${CHAT_CONFIG.MESSAGE_REPLY_OPTION}`;

  // ケース2: スレッドIDが直接指定されている
  } else if (targetThreadId && targetThreadId.includes('/threads/')) {
    Logger.log(`[Chat] 既存スレッドに返信: ${targetThreadId}`);

    spaceName = targetThreadId.split('/threads/')[0];
    messageResource.thread = { name: targetThreadId };
    apiUrl = `${CHAT_CONFIG.API_ENDPOINT}/${spaceName}/messages?messageReplyOption=${CHAT_CONFIG.MESSAGE_REPLY_OPTION}`;

  // ケース3: 新しいスレッドを作成（スペースIDのみ指定）
  } else if (targetSpaceId) {
    Logger.log(`[Chat] 新しいスレッドを作成: Space=${targetSpaceId}`);

    spaceName = targetSpaceId;
    messageResource.thread = { threadKey: queryId || `thread-${Utilities.getUuid()}` };
    apiUrl = `${CHAT_CONFIG.API_ENDPOINT}/${spaceName}/messages`;

  } else {
    throw new Error('targetThreadIdまたはtargetSpaceIdのいずれかが必要です');
  }

  return {
    apiUrl,
    messageResource
  };
}

/**
 * Chat APIを実行してメッセージを投稿
 * @param {string} apiUrl - API URL
 * @param {Object} messageResource - メッセージリソース
 * @param {string} impersonatingUserEmail - 投稿者のメールアドレス
 * @returns {Object} - 投稿結果
 */
function executeChatPost(apiUrl, messageResource, impersonatingUserEmail) {
  // OAuth2サービスを作成
  const chatService = createOAuth2Service(
    impersonatingUserEmail,
    CHAT_CONFIG.SCOPES,
    'ChatImpersonation'
  );

  // アクセストークンを取得
  const accessToken = getAccessToken(chatService);

  // APIリクエストオプション
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    payload: JSON.stringify(messageResource),
    muteHttpExceptions: true
  };

  // API呼び出し
  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode >= 200 && responseCode < 300) {
    const sentMessage = JSON.parse(responseBody);
    return {
      messageId: sentMessage.name
    };
  } else {
    throw new Error(`Chat APIエラー: Status ${responseCode}, Body: ${responseBody}`);
  }
}
