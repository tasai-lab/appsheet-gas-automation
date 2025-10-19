/**
 * Webhook処理モジュール
 * AppSheetからのWebhookリクエストを受け付けてタスクキューにスケジュール
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-20
 */

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
