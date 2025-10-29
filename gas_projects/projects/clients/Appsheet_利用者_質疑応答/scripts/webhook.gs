/**
 * Webhook処理モジュール
 * AppSheetからのWebhookリクエストを受け付けてタスクキューにスケジュール
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-20
 */

/**
 * 利用者質疑応答処理（個別引数で直接実行可能）
 * プロンプトテキストを受け取り、Gemini APIで回答と要約を生成
 * 
 * 処理モード:
 * 1. promptType='外部文章': 参照資料ベースの質疑応答（1段階AI処理）
 * 2. promptType='通常': 通常の質疑応答（2段階AI処理）
 *
 * @param {string} promptType - プロンプトタイプ ('通常' | '外部文章')（必須）
 * @param {string} promptText - ユーザーの質問（必須）
 * @param {string} documentText - 参照ドキュメント（両モードで必須）
 * @param {string} userId - 利用者ID（promptType='通常'の場合は必須）
 * @param {string} userBasicInfo - 利用者の基本情報（promptType='通常'の場合は必須）
 * @param {string} analysisId - 分析ID（AppSheet更新する場合は必須、デフォルト: null）
 * @param {boolean} updateAppSheet - AppSheetを更新するか（デフォルト: false）
 *
 * @return {Object} 処理結果
 * @return {string} return.answer - 詳細な回答
 * @return {string} return.summary - 回答の要約
 * @return {Object} return.usageMetadata - API使用量情報
 * @return {string} return.analysisId - 分析ID（指定された場合）
 * @return {string} return.promptType - 使用したプロンプトタイプ
 *
 * @example
 * // promptType='外部文章': 参照資料ベースの質疑応答
 * const result = processClientQA(
 *   '外部文章',
 *   '血圧が高い場合の対応方法は？',
 *   '利用者情報: 田中太郎さん、70歳、...'
 * );
 *
 * @example
 * // promptType='通常': 通常の質疑応答（2段階AI処理）
 * const result = processClientQA(
 *   '通常',
 *   '今後の支援内容を提案してください',
 *   '2024-10-20: 歩行不安定、血圧150/90...',  // documentText
 *   'USER001',
 *   '氏名: 山田花子、年齢: 82歳、要介護3'
 * );
 *
 * @example
 * // AppSheet更新付き（外部文章モード）
 * const result = processClientQA(
 *   '外部文章',
 *   '血圧が高い場合の対応方法は？',
 *   '利用者情報: 田中太郎さん、70歳、...',
 *   null, null,  // 通常モード用の引数は不要
 *   'ANALYSIS-12345',
 *   true
 * );
 *
 * @example
 * // AppSheet更新付き（通常モード）
 * const result = processClientQA(
 *   '通常',
 *   '今後の支援内容を提案してください',
 *   '2024-10-20: 歩行不安定、血圧150/90...',  // documentText
 *   'USER001',
 *   '氏名: 山田花子、年齢: 82歳、要介護3',
 *   'ANALYSIS-12345',
 *   true
 * );
 */
function processClientQA(
  promptType,
  promptText,
  documentText = null,
  userId = null,
  userBasicInfo = null,
  analysisId = null,
  updateAppSheet = false
) {
  const logger = createLogger('Appsheet_利用者_質疑応答');
  let status = '成功';
  const startTime = new Date();

  try {
    // 必須パラメータのチェック
    if (!promptType || (promptType !== '通常' && promptType !== '外部文章')) {
      throw new Error('promptTypeは必須です。"通常" または "外部文章" を指定してください');
    }

    if (!promptText || promptText.trim() === '') {
      throw new Error('promptTextは必須です');
    }

    // promptTypeに応じた必須パラメータのチェック
    if (!documentText || documentText.trim() === '') {
      throw new Error('documentTextは両モードで必須です');
    }

    if (promptType === '通常') {
      if (!userId || userId.trim() === '') {
        throw new Error('promptType="通常"の場合、userIdは必須です');
      }
      if (!userBasicInfo || userBasicInfo.trim() === '') {
        throw new Error('promptType="通常"の場合、userBasicInfoは必須です');
      }
    }

    // 処理モードの決定
    const actualMode = promptType === '通常' ? 'normal' : 'document';
    const modeLabel = actualMode === 'normal' ? '通常の質疑応答（2段階AI処理）' : '外部文章の参照資料ベースの回答';
    const promptTypeLabel = promptType;

    logger.info(`質疑応答処理開始: ${modeLabel}`, {
      analysisId: analysisId || 'なし',
      promptType: promptTypeLabel,
      mode: actualMode,
      userId: userId || 'なし',
      documentLength: documentText.length,
      userBasicInfoLength: userBasicInfo ? userBasicInfo.length : 0,
      promptLength: promptText.length,
      updateAppSheet: updateAppSheet
    });

    let aiResult;

    if (actualMode === 'normal') {
      // モード2: 通常の質疑応答（2段階AI処理）
      logger.info('モード2: 2段階AI処理を開始');
      aiResult = processNormalQAWithTwoStage(promptText, userId, userBasicInfo, documentText);
      logger.info('2段階AI処理完了', {
        extractedInfoLength: aiResult.extractedInfo ? aiResult.extractedInfo.length : 0
      });
    } else {
      // モード1: 参照資料ベースの回答
      logger.info('モード1: 参照資料ベースの回答を生成');
      aiResult = generateAnswerAndSummaryWithGemini(promptText, documentText);
    }

    // API使用量情報をloggerに記録
    if (aiResult.usageMetadata) {
      logger.setUsageMetadata(aiResult.usageMetadata);
    }

    // AppSheet更新（オプション）
    if (updateAppSheet && analysisId) {
      logger.info(`AppSheet更新開始: ${analysisId}`);
      updateOnSuccess(analysisId, aiResult.answer, aiResult.summary);
      logger.success('AppSheet更新成功');
    }

    const duration = (new Date() - startTime) / 1000;
    logger.success(`質疑応答処理完了: 処理時間 ${duration}秒`);

    return {
      answer: aiResult.answer,
      summary: aiResult.summary,
      usageMetadata: aiResult.usageMetadata,
      analysisId: analysisId,
      promptType: promptType,
      extractedInfo: aiResult.extractedInfo  // 通常モードの場合のみ存在
    };

  } catch (error) {
    status = 'エラー';
    logger.error(`質疑応答処理エラー: ${error.toString()}`, {
      stack: error.stack,
      analysisId: analysisId,
      documentLength: documentText ? documentText.length : 0,
      promptLength: promptText ? promptText.length : 0
    });

    // AppSheet更新（エラー時）
    if (updateAppSheet && analysisId) {
      try {
        updateOnError(analysisId, error.toString());
      } catch (updateError) {
        logger.error('AppSheetへのエラー更新失敗', { updateError: updateError.toString() });
      }
    }

    throw error;

  } finally {
    // ログをスプレッドシートに保存
    logger.saveToSpreadsheet(status, analysisId);
  }
}


/**
 * AppSheetからのWebhookエントリーポイント
 * グローバルロックを使用せず、IDが異なるリクエストの並行実行を許可
 *
 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベント
 * @return {GoogleAppsScript.Content.TextOutput} JSON応答
 */
function doPost(e) {
  const startTime = new Date();

  if (!e || !e.postData || !e.postData.contents) {
    return createJsonResponse({
      status: "error",
      message: "Invalid request body"
    });
  }

  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: "Invalid JSON in request body"
    });
  }

  // 内部からのワーカー起動リクエストか、AppSheetからの通常リクエストかを判定
  if (params.action === CONFIG.ASYNC_CONFIG.WORKER_ACTION_KEY) {
    Logger.log("[INFO][doPost] ワーカー起動リクエストを受信しました。");
    processTaskQueueWorker();
    return createJsonResponse({ status: "worker_process_invoked" });
  }

  // AppSheetからの通常リクエスト処理
  return _processRequest(params, startTime);
}

/**
 * リクエスト処理のメインロジック
 * 非同期タスクキューにタスクを登録
 *
 * @private
 * @param {Object} params - リクエストパラメータ
 * @param {string} params.analysisId - 分析ID（必須）
 * @param {string} params.promptType - プロンプトタイプ ('通常' | '外部文章')（必須）
 * @param {string} params.promptText - プロンプトテキスト（必須）
 * @param {string} params.documentText - ドキュメントテキスト（両モードで必須）
 * @param {string} params.userId - 利用者ID（promptType='通常'で必須）
 * @param {string} params.userBasicInfo - 利用者の基本情報（promptType='通常'で必須）
 * @param {Date} startTime - リクエスト受信時刻
 * @return {GoogleAppsScript.Content.TextOutput} JSON応答
 */
function _processRequest(params, startTime) {
  let analysisId = null;
  let idempotencyLockAcquired = false;

  try {
    analysisId = params.analysisId;

    if (!analysisId) {
      throw new Error("Missing analysisId");
    }

    // パラメータ検証
    _validateParameters(params);

    // 冪等性ロック取得
    idempotencyLockAcquired = acquireIdempotencyLock(analysisId);

    if (!idempotencyLockAcquired) {
      Logger.log(`[INFO][doPost] 重複リクエストまたはロック競合を検出、スキップ: ${analysisId}`);
      return createJsonResponse({
        status: "skipped",
        message: "Duplicate or conflict detected",
        analysisId: analysisId
      });
    }

    // 非同期タスクをスケジュール
    scheduleAsyncTask(analysisId, params);

    const duration = (new Date() - startTime);
    Logger.log(`[INFO][doPost] リクエスト受付完了 (ワーカー起動リクエスト済): ${analysisId}, 応答時間 = ${duration}ms`);

    return createJsonResponse({
      status: "accepted",
      message: "Request accepted for asynchronous processing",
      analysisId: analysisId
    });

  } catch (error) {
    Logger.log(`[ERROR][doPost] リクエスト受付エラー: ${error.toString()}`);

    // エラー時は冪等性ロックを解除
    if (idempotencyLockAcquired && analysisId) {
      Logger.log(`[INFO][doPost] エラー発生のため、冪等性ロックを解除します: ${analysisId}`);
      releaseIdempotencyLock(analysisId);
    }

    return createJsonResponse({
      status: "error",
      message: error.toString()
    });
  }
}

/**
 * パラメータ検証関数
 * 必須パラメータの存在をチェック
 *
 * promptType='外部文章': promptText + documentText
 * promptType='通常': promptText + documentText + userId + userBasicInfo
 *
 * @private
 * @param {Object} params - リクエストパラメータ
 * @throws {Error} 必須パラメータが不足している場合
 */
function _validateParameters(params) {
  // promptTypeのチェック
  if (!params.promptType) {
    throw new Error("Missing promptType. Specify '通常' or '外部文章'");
  }

  if (params.promptType !== '通常' && params.promptType !== '外部文章') {
    throw new Error(`Invalid promptType: ${params.promptType}. Use '通常' or '外部文章'`);
  }

  if (!params.promptText) {
    throw new Error("Missing promptText");
  }

  // documentTextは両モードで必須
  if (!params.documentText || params.documentText.trim() === '') {
    throw new Error("Missing or empty documentText");
  }

  // promptType='通常'の追加パラメータ検証
  if (params.promptType === '通常') {
    if (!params.userId) {
      throw new Error("Missing userId for promptType='通常'");
    }
    if (!params.userBasicInfo) {
      throw new Error("Missing userBasicInfo for promptType='通常'");
    }
  }
}
