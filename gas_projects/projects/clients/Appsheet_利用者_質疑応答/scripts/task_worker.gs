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
 * @param {string} params.promptText - プロンプトテキスト（必須）
 * @param {string} params.documentText - ドキュメントテキスト（モード1で使用）
 * @param {string} params.userId - 利用者ID（モード2で使用）
 * @param {string} params.userBasicInfo - 利用者の基本情報（モード2で使用）
 * @param {string} params.referenceData - 参考資料（モード2で使用）
 */
function executeTask(analysisId, params) {
  const startTime = new Date();
  const logger = createLogger('Appsheet_利用者_質疑応答');
  let status = '成功';

  try {
    const { promptText, documentText, userId, userBasicInfo, referenceData } = params;

    // モード判定
    const isMode2 = userId && userBasicInfo && referenceData;
    const mode = isMode2 ? '通常の質疑応答（2段階AI処理）' : '参照資料ベースの回答';

    logger.info(`タスク開始: ${analysisId} (${mode})`, {
      hasDocument: !!documentText,
      hasUserId: !!userId,
      documentLength: documentText ? documentText.length : 0,
      userBasicInfoLength: userBasicInfo ? userBasicInfo.length : 0,
      referenceDataLength: referenceData ? referenceData.length : 0,
      promptLength: promptText ? promptText.length : 0
    });

    let aiResult;

    if (isMode2) {
      // モード2: 通常の質疑応答（2段階AI処理）
      aiResult = processNormalQAWithTwoStage(promptText, userId, userBasicInfo, referenceData);
    } else {
      // モード1: 参照資料ベースの回答
      aiResult = generateAnswerAndSummaryWithGemini(promptText, documentText);
    }

    // API使用量情報をloggerに記録
    if (aiResult.usageMetadata) {
      logger.setUsageMetadata(aiResult.usageMetadata);
    }

    // AppSheet更新
    updateOnSuccess(analysisId, aiResult.answer, aiResult.summary);

    const duration = (new Date() - startTime) / 1000;
    Logger.log(`[INFO][Worker] タスク正常完了: ${analysisId}, 処理時間 = ${duration}秒`);
    logger.success(`タスク完了 (${mode}): 処理時間 ${duration}秒`);

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
