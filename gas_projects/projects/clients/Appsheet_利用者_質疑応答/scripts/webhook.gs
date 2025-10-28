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
 * 1. 外部文章: promptType='外部文章' または mode='document'
 * 2. 通常: promptType='通常' または mode='normal'（2段階AI処理）
 *
 * @param {string} promptText - ユーザーの質問（必須）
 * @param {Object} options - オプションパラメータ
 * @param {string} options.promptType - プロンプトタイプ ('通常' | '外部文章')（推奨）
 * @param {string} options.mode - 処理モード ('normal' | 'document')（promptTypeの英語版）
 * @param {string} options.documentText - 参照ドキュメント（promptType='外部文章'で使用）
 * @param {string} options.userId - 利用者ID（promptType='通常'で使用）
 * @param {string} options.userBasicInfo - 利用者の基本情報（promptType='通常'で使用）
 * @param {string} options.referenceData - 参考資料（promptType='通常'で使用）
 * @param {string} options.analysisId - 分析ID（AppSheet更新する場合は必須）
 * @param {boolean} options.updateAppSheet - AppSheetを更新するか（デフォルト: false）
 *
 * @return {Object} 処理結果
 * @return {string} return.answer - 詳細な回答
 * @return {string} return.summary - 回答の要約
 * @return {Object} return.usageMetadata - API使用量情報
 * @return {string} return.analysisId - 分析ID（指定された場合）
 *
 * @example
 * // promptType='外部文章': 参照資料ベースの質疑応答（推奨形式）
 * const result = processClientQA('血圧が高い場合の対応方法は？', {
 *   promptType: '外部文章',
 *   documentText: '利用者情報: 田中太郎さん、70歳、...'
 * });
 *
 * @example
 * // promptType='通常': 通常の質疑応答（2段階AI処理）
 * const result = processClientQA('今後の支援内容を提案してください', {
 *   promptType: '通常',
 *   userId: 'USER001',
 *   userBasicInfo: '氏名: 山田花子、年齢: 82歳、要介護3',
 *   referenceData: '2024-10-20: 歩行不安定、血圧150/90...'
 * });
 *
 * @example
 * // mode指定（英語版）も引き続き使用可能
 * const result = processClientQA('血圧が高い場合の対応方法は？', {
 *   mode: 'document',
 *   documentText: '利用者情報: 田中太郎さん、70歳、...'
 * });
 *
 * @example
 * // AppSheet更新付き
 * const result = processClientQA('血圧が高い場合の対応方法は？', {
 *   promptType: '外部文章',
 *   documentText: '利用者情報: 田中太郎さん、70歳、...',
 *   analysisId: 'ANALYSIS-12345',
 *   updateAppSheet: true
 * });
 *
 * @example
 * // 旧形式（後方互換性のため維持）
 * const result = processClientQA(
 *   '質問',
 *   '参照資料',  // 第2引数が文字列の場合、documentTextとして扱う
 *   null, null, null,
 *   'ANALYSIS-12345',
 *   true
 * );
 */
function processClientQA(promptText, ...args) {
  const logger = createLogger('Appsheet_利用者_質疑応答');
  let status = '成功';
  const startTime = new Date();

  try {
    // 必須パラメータのチェック
    if (!promptText || promptText.trim() === '') {
      throw new Error('promptTextは必須です');
    }

    // 引数の解析（新形式 vs 旧形式）
    let options = {};
    
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      // 新形式: processClientQA(promptText, {mode: 'document', ...})
      options = args[0];
    } else {
      // 旧形式: processClientQA(promptText, documentText, userId, userBasicInfo, referenceData, analysisId, updateAppSheet)
      const [documentText, userId, userBasicInfo, referenceData, analysisId, updateAppSheet] = args;
      options = {
        documentText: documentText || null,
        userId: userId || null,
        userBasicInfo: userBasicInfo || null,
        referenceData: referenceData || null,
        analysisId: analysisId || null,
        updateAppSheet: updateAppSheet || false
      };
    }

    // デフォルト値の設定
    const {
      promptType = null,  // '通常' | '外部文章'
      mode = null,  // 'normal' | 'document'（promptTypeの英語版）
      documentText = null,
      userId = null,
      userBasicInfo = null,
      referenceData = null,
      analysisId = null,
      updateAppSheet = false
    } = options;

    // 処理モードの決定
    let actualMode;
    
    // promptType（日本語）を優先的に処理
    if (promptType) {
      if (promptType === '通常') {
        actualMode = 'normal';
      } else if (promptType === '外部文章') {
        actualMode = 'document';
      } else {
        throw new Error(`無効なpromptType: ${promptType}。'通常' または '外部文章' を指定してください`);
      }
      
      // 指定されたタイプに必要なパラメータをチェック
      if (actualMode === 'document' && !documentText) {
        throw new Error('promptType="外部文章"の場合、documentTextは必須です');
      }
      if (actualMode === 'normal' && (!userId || !userBasicInfo || !referenceData)) {
        throw new Error('promptType="通常"の場合、userId、userBasicInfo、referenceDataは必須です');
      }
    } else if (mode) {
      // modeが明示的に指定されている場合（promptTypeが未指定の場合）
      if (mode !== 'document' && mode !== 'normal') {
        throw new Error(`無効なモード: ${mode}。'document' または 'normal' を指定してください`);
      }
      actualMode = mode;
      
      // 指定されたモードに必要なパラメータをチェック
      if (mode === 'document' && !documentText) {
        throw new Error('mode="document"の場合、documentTextは必須です');
      }
      if (mode === 'normal' && (!userId || !userBasicInfo || !referenceData)) {
        throw new Error('mode="normal"の場合、userId、userBasicInfo、referenceDataは必須です');
      }
    } else {
      // promptTypeもmodeも未指定の場合、パラメータから自動判定（後方互換性のため）
      const isMode2 = userId && userBasicInfo && referenceData;
      const isMode1 = documentText && !isMode2;

      if (!isMode1 && !isMode2) {
        throw new Error('処理モードが不明です。promptType="通常"/"外部文章" または mode="normal"/"document"を指定するか、必要なパラメータを指定してください');
      }

      actualMode = isMode2 ? 'normal' : 'document';
    }

    const modeLabel = actualMode === 'normal' ? '通常の質疑応答（2段階AI処理）' : '外部文章の参照資料ベースの回答';
    const promptTypeLabel = actualMode === 'normal' ? '通常' : '外部文章';

    logger.info(`質疑応答処理開始: ${modeLabel}`, {
      analysisId: analysisId || 'なし',
      promptType: promptTypeLabel,
      mode: actualMode,
      userId: userId || 'なし',
      hasDocument: !!documentText,
      documentLength: documentText ? documentText.length : 0,
      userBasicInfoLength: userBasicInfo ? userBasicInfo.length : 0,
      referenceDataLength: referenceData ? referenceData.length : 0,
      promptLength: promptText.length,
      updateAppSheet: updateAppSheet
    });

    let aiResult;

    if (actualMode === 'normal') {
      // モード2: 通常の質疑応答（2段階AI処理）
      logger.info('モード2: 2段階AI処理を開始');
      aiResult = processNormalQAWithTwoStage(promptText, userId, userBasicInfo, referenceData);
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
      mode: mode,
      extractedInfo: aiResult.extractedInfo  // モード2の場合のみ存在
    };

  } catch (error) {
    status = 'エラー';
    logger.error(`質疑応答処理エラー: ${error.toString()}`, {
      stack: error.stack,
      analysisId: analysisId,
      hasDocument: !!documentText,
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
 * @param {string} params.documentText - ドキュメントテキスト（必須）
 * @param {string} params.promptText - プロンプトテキスト（必須）
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
 * モード1（参照資料ベース）: promptText + documentText
 * モード2（通常の質疑応答）: promptText + userId + userBasicInfo + referenceData
 *
 * @private
 * @param {Object} params - リクエストパラメータ
 * @throws {Error} 必須パラメータが不足している場合
 */
function _validateParameters(params) {
  if (!params.promptText) {
    throw new Error("Missing promptText");
  }

  // モード判定
  const hasMode2Params = params.userId || params.userBasicInfo || params.referenceData;
  const hasMode1Params = params.documentText;

  if (hasMode2Params) {
    // モード2の場合、すべてのパラメータが必要
    if (!params.userId) {
      throw new Error("Missing userId for mode 2");
    }
    if (!params.userBasicInfo) {
      throw new Error("Missing userBasicInfo for mode 2");
    }
    if (!params.referenceData) {
      throw new Error("Missing referenceData for mode 2");
    }
  } else if (hasMode1Params) {
    // モード1の場合、documentTextのみ必要
    if (params.documentText.trim() === '') {
      Logger.log('[WARN][validateParameters] documentTextが空文字列です。');
      params.documentText = null;
    }
  } else {
    // どちらのモードでもない場合はエラー
    throw new Error("Missing required parameters. Provide either documentText (mode 1) or userId+userBasicInfo+referenceData (mode 2)");
  }
}
