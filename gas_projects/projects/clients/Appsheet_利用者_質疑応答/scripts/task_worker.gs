/**
 * バックグラウンドワーカーモジュール
 * タスクキューからタスクを取得して非同期に実行
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-20
 */

/**
 * タスクキューワーカー
 * キューからタスクを順次取得して実行、実行時間制限に達したら次のワーカーを起動
 */
function processTaskQueueWorker() {
  const lock = LockService.getScriptLock();

  // 別のワーカーが実行中の場合は終了
  if (!lock.tryLock(3000)) {
    Logger.log("[INFO][Worker] 別のワーカーが実行中のため、このインスタンスは終了します。");
    return;
  }

  const startTime = new Date();
  let processedCount = 0;

  try {
    while (true) {
      const analysisId = getNextTaskFromQueue();

      if (!analysisId) {
        Logger.log(`[INFO][Worker] キューが空です。ワーカーを終了します。処理件数: ${processedCount}`);
        break;
      }

      Logger.log(`[INFO][Worker] タスク処理開始: ${analysisId}`);

      const taskData = getTaskData(analysisId);

      if (taskData) {
        executeTask(analysisId, taskData);
        processedCount++;
      } else {
        Logger.log(`[WARN][Worker] タスクデータが見つかりません: ${analysisId}。スキップします。`);
      }

      cleanupTask(analysisId);

      // 実行時間制限チェック
      if ((new Date() - startTime) > CONFIG.ASYNC_CONFIG.MAX_EXECUTION_TIME_MS) {
        Logger.log("[INFO][Worker] 実行時間制限に近づいたため、ワーカーを停止します。");

        const scriptProperties = PropertiesService.getScriptProperties();
        const queue = JSON.parse(scriptProperties.getProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY) || '[]');

        if (queue.length > 0) {
          Logger.log(`[INFO][Worker] 残存タスクがあります (${queue.length}件)。次のワーカーをリクエストします。`);
          requestWorkerStart();
        }

        break;
      }
    }

  } finally {
    lock.releaseLock();
  }
}

/**
 * タスクを実行
 * Gemini API呼び出し、AppSheet更新、ログ記録を実行
 *
 * @param {string} analysisId - 分析ID
 * @param {Object} params - タスクパラメータ
 * @param {string} params.promptType - プロンプトタイプ ('通常' | '外部文章')（必須）
 * @param {string} params.promptText - プロンプトテキスト（必須）
 * @param {string} params.documentText - ドキュメントテキスト（promptType='外部文章'で使用）
 * @param {string} params.userId - 利用者ID（promptType='通常'で使用）
 * @param {string} params.userBasicInfo - 利用者の基本情報（promptType='通常'で使用）
 * @param {string} params.referenceData - 参考資料（promptType='通常'で使用）
 */
function executeTask(analysisId, params) {
  try {
    const { promptType, promptText, documentText, userId, userBasicInfo, referenceData } = params;

    Logger.log(`[INFO][Worker] タスク開始: ${analysisId} (promptType=${promptType})`);

    // processClientQA関数を呼び出し（updateAppSheet=trueで自動更新）
    const result = processClientQA(
      promptType,
      promptText,
      documentText,
      userId,
      userBasicInfo,
      referenceData,
      analysisId,
      true  // updateAppSheet=true
    );

    Logger.log(`[INFO][Worker] タスク正常完了: ${analysisId}`);

  } catch (error) {
    Logger.log(`[FATAL ERROR][Worker] タスク失敗: ${analysisId} - ${error.toString()}\nスタックトレース: ${error.stack}`);
    throw error;  // processClientQA内でエラー処理とログ記録が行われる
  }
}
