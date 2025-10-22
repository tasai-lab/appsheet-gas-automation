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
 * ドキュメントテキストと質問を受け取り、Gemini APIで回答と要約を生成
 *
 * @param {string} documentText - 参照ドキュメント（必須）
 * @param {string} promptText - ユーザーの質問（必須）
 * @param {string} analysisId - 分析ID（オプション、AppSheet更新する場合は必須）
 * @param {boolean} updateAppSheet - AppSheetを更新するか（デフォルト: false）
 *
 * @return {Object} 処理結果
 * @return {string} return.answer - 詳細な回答
 * @return {string} return.summary - 回答の要約
 * @return {Object} return.usageMetadata - API使用量情報
 * @return {string} return.analysisId - 分析ID（指定された場合）
 *
 * @example
 * // 基本的な使用例（AppSheet更新なし）
 * const result = processClientQA(
 *   '利用者情報: 田中太郎さん、70歳、...',
 *   '血圧が高い場合の対応方法は？'
 * );
 * console.log(result.answer);   // 詳細な回答
 * console.log(result.summary);  // 要約
 *
 * @example
 * // AppSheet更新付き
 * const result = processClientQA(
 *   '利用者情報: 田中太郎さん、70歳、...',
 *   '血圧が高い場合の対応方法は？',
 *   'ANALYSIS-12345',
 *   true
 * );
 */
function processClientQA(
  documentText,
  promptText,
  analysisId = null,
  updateAppSheet = false
) {
  const logger = createLogger('Appsheet_利用者_質疑応答');
  let status = '成功';
  const startTime = new Date();

  try {
    // 必須パラメータのチェック
    if (!documentText || documentText.trim() === '') {
      throw new Error('documentTextは必須です');
    }
    if (!promptText || promptText.trim() === '') {
      throw new Error('promptTextは必須です');
    }

    logger.info('質疑応答処理開始', {
      analysisId: analysisId || 'なし',
      documentLength: documentText.length,
      promptLength: promptText.length,
      updateAppSheet: updateAppSheet
    });

    // Gemini API呼び出し
    const aiResult = generateAnswerAndSummaryWithGemini(documentText, promptText);

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
      analysisId: analysisId
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
  return processRequest(params, startTime);
}

/**
 * リクエスト処理関数
 * 冪等性チェック、パラメータ検証、非同期タスクのスケジューリングを実行
 *
 * @param {Object} params - リクエストパラメータ
 * @param {string} params.analysisId - 分析ID（必須）
 * @param {string} params.documentText - ドキュメントテキスト（必須）
 * @param {string} params.promptText - プロンプトテキスト（必須）
 * @param {Date} startTime - リクエスト受信時刻
 * @return {GoogleAppsScript.Content.TextOutput} JSON応答
 */
function processRequest(params, startTime) {
  let analysisId = null;
  let idempotencyLockAcquired = false;

  try {
    analysisId = params.analysisId;

    if (!analysisId) {
      throw new Error("Missing analysisId");
    }

    // パラメータ検証
    validateParameters(params);

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
 * @param {Object} params - リクエストパラメータ
 * @throws {Error} 必須パラメータが不足している場合
 */
function validateParameters(params) {
  if (!params.documentText) {
    throw new Error("Missing documentText");
  }

  if (!params.promptText) {
    throw new Error("Missing promptText");
  }
}
