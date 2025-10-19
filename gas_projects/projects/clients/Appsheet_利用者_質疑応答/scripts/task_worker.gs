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
 * @param {string} params.documentText - ドキュメントテキスト
 * @param {string} params.promptText - プロンプトテキスト
 */
function executeTask(analysisId, params) {
  const startTime = new Date();
  const logger = createLogger('Appsheet_利用者_質疑応答');
  let status = '成功';

  try {
    const { documentText, promptText } = params;

    logger.info(`タスク開始: ${analysisId}`);

    // Gemini API呼び出し
    const aiResult = generateAnswerAndSummaryWithGemini(documentText, promptText);

    // API使用量情報をloggerに記録
    if (aiResult.usageMetadata) {
      logger.setUsageMetadata(aiResult.usageMetadata);
    }

    // AppSheet更新
    updateOnSuccess(analysisId, aiResult.answer, aiResult.summary);

    const duration = (new Date() - startTime) / 1000;
    Logger.log(`[INFO][Worker] タスク正常完了: ${analysisId}, 処理時間 = ${duration}秒`);
    logger.success(`タスク完了: 処理時間 ${duration}秒`);

  } catch (error) {
    status = 'エラー';
    Logger.log(`[FATAL ERROR][Worker] タスク失敗: ${analysisId} - ${error.toString()}\nスタックトレース: ${error.stack}`);
    logger.error(`タスク失敗: ${error.toString()}`, { stack: error.stack });

    try {
      updateOnError(analysisId, error.toString());
    } catch (updateError) {
      Logger.log(`[ERROR][Worker] AppSheetへのエラー状態の更新にも失敗しました: ${updateError.toString()}`);
    }

  } finally {
    // ログをスプレッドシートに保存
    logger.saveToSpreadsheet(status, analysisId);
  }
}
