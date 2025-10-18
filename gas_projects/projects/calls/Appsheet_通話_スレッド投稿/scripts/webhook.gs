/**
 * Webhookエントリーポイント
 * 通話の質疑応答をGoogle Chatスレッドに投稿
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-18
 */

/**
 * WebアプリのPOSTリクエストエントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e - POSTリクエストイベント
 * @return {GoogleAppsScript.Content.TextOutput} レスポンス
 */
function doPost(e) {
  const logger = createLogger('Appsheet_通話_スレッド投稿');
  let queryId = null;
  let status = '成功';

  try {
    // リクエストデータの解析
    const params = JSON.parse(e.postData.contents);
    queryId = params.queryId || params.query_id;

    logger.info('Webhook受信', params);

    // 必須パラメータの検証
    if (!queryId) {
      throw new Error('必須パラメータ（queryId）が不足しています');
    }

    if (!params.targetThreadId && !params.targetSpaceId) {
      throw new Error('targetThreadIdまたはtargetSpaceIdのいずれかが必要です');
    }

    if (!params.posterEmail) {
      throw new Error('必須パラメータ（posterEmail）が不足しています');
    }

    // メイン処理を実行
    const result = processThreadPost(params);

    logger.success('処理完了', { queryId, messageId: result.messageId });

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      messageId: result.messageId
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    status = 'エラー';
    logger.error('処理エラー', error, { queryId });

    // AppSheetにエラー記録
    if (queryId) {
      try {
        updateQueryStatus(queryId, STATUS.ERROR, null, error.message);
      } catch (updateError) {
        logger.error('AppSheetエラー更新失敗', updateError);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    logger.saveToSpreadsheet(status, queryId);
  }
}

/**
 * メイン処理：質疑応答をGoogle Chatスレッドに投稿
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processThreadPost(params) {
  const {
    queryId,
    targetThreadId,
    targetSpaceId,
    questionText,
    answerText,
    posterName,
    posterEmail,
    rowUrl
  } = params;

  // テキストを整形（Markdown記号の正規化）
  const cleanedQuestion = (questionText || '').replace(/\* \*\*/g, '*').replace(/\*\*/g, '*').replace(/\* /g, '* ');
  const cleanedAnswer = (answerText || '').replace(/\*\*/g, '*').replace(/\* /g, '* ');

  // メッセージを組み立て
  const messageText = buildMessageText(cleanedQuestion, cleanedAnswer, posterName, rowUrl);

  // Google Chatに投稿
  const chatResult = postMessageToChat({
    targetThreadId,
    targetSpaceId,
    messageText,
    posterEmail,
    queryId
  });

  if (chatResult.status !== 'success') {
    throw new Error(chatResult.errorMessage || 'Chat投稿に失敗しました');
  }

  // AppSheetのステータスを更新
  updateQueryStatus(queryId, STATUS.COMPLETED, chatResult.messageId, null);

  return {
    messageId: chatResult.messageId
  };
}

/**
 * メッセージテキストを組み立て
 * @param {string} question - 質問テキスト
 * @param {string} answer - 回答テキスト
 * @param {string} posterName - 投稿者名
 * @param {string} rowUrl - AppSheet行URL
 * @returns {string} - 組み立てたメッセージ
 */
function buildMessageText(question, answer, posterName, rowUrl) {
  let message = '';

  if (question) {
    message += `Q. ${question}\n\n`;
  }

  if (answer) {
    message += `A. ${answer}\n\n`;
  }

  if (posterName) {
    message += `投稿者: ${posterName}\n`;
  }

  if (rowUrl) {
    message += `URL: ${rowUrl}`;
  }

  return message.trim();
}

/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessThreadPost() {
  const testParams = {
    queryId: 'TEST-QUERY-001',
    targetSpaceId: 'spaces/AAAAXXXXXXx', // TODO: 実際のSpace IDに置き換え
    questionText: 'これはテスト質問です',
    answerText: 'これはテスト回答です',
    posterName: 'テスト太郎',
    posterEmail: 'test@example.com', // TODO: 実際のメールアドレスに置き換え
    rowUrl: 'https://www.appsheet.com/start/xxx'
  };

  Logger.log('テスト開始...');
  const result = processThreadPost(testParams);
  Logger.log('テスト完了:', result);

  return result;
}
