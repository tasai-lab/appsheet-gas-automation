/**
 * 営業音声分析プロセッサ
 * 音声ファイルの分析とAppSheet更新を統括
 */

/**
 * 営業音声記録を分析し、AppSheetを更新する
 *
 * @param {string} activityId - 活動ID
 * @param {string} filePath - 音声ファイルのGoogle Driveパス
 * @param {string} salespersonName - 営業担当者名（任意）
 * @param {string} contactName - 面会相手名（任意）
 * @param {string} orgName - 訪問先機関名（任意）
 * @returns {Object} - 分析結果
 */
function processSalesAudioAnalysis(activityId, filePath, salespersonName, contactName, orgName) {
  const timer = new ExecutionTimer();

  try {
    // パラメータ検証
    if (!activityId) {
      throw new Error('必須パラメータ（activityId）が不足しています。');
    }

    if (!filePath) {
      throw new Error('filePath が必須です。');
    }

    Logger.log(`処理開始: Activity ID = ${activityId}`);
    Logger.log(`ファイルパス: ${filePath}`);

    // 処理開始ログを記録
    logStartExec(activityId, {
      audioFileId: filePath,  // filePathを記録
      salespersonName: salespersonName || '不明',
      contactName: contactName || '不明',
      orgName: orgName || '不明'
    });

    // コンテキスト情報を構築
    const context = {
      filePath: filePath,
      fileId: null,  // fileIdは使用しない
      salespersonName: salespersonName || '不明',
      contactName: contactName || '不明',
      orgName: orgName || '不明'
    };

    // Vertex AIで音声を分析
    const analysisResult = analyzeSalesCallWithVertexAI(context);

    if (!analysisResult) {
      throw new Error('AIからの応答が不正でした。');
    }

    Logger.log('AI分析結果: ' + JSON.stringify(analysisResult));

    // API使用量メタデータを取得
    const usageMetadata = analysisResult.usageMetadata || null;

    if (usageMetadata) {
      Logger.log(`💰 API使用量: Input=${usageMetadata.inputTokens}tokens, Output=${usageMetadata.outputTokens}tokens, 合計=¥${usageMetadata.totalCostJPY.toFixed(2)}`);
    }

    // AppSheetに分析結果を書き込み
    updateActivityOnSuccess(activityId, analysisResult);

    Logger.log(`処理完了。ID ${activityId} の分析結果を書き込みました。`);

    // 成功ログを実行ログスプレッドシートに記録
    logSuccessExec(activityId, {
      audioFileId: filePath,  // filePathを記録
      salespersonName: salespersonName || '不明',
      contactName: contactName || '不明',
      orgName: orgName || '不明',
      summary: analysisResult.summary ? analysisResult.summary.substring(0, 200) + '...' : '',
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      fileSize: analysisResult.fileSize || '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(2) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(2) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(2) : ''
    });

    return {
      status: 'SUCCESS',
      activityId: activityId,
      analysis: analysisResult,
      usageMetadata: usageMetadata
    };

  } catch (error) {
    Logger.log(`エラーが発生しました: ${error.toString()}`);

    // エラーログを実行ログスプレッドシートに記録
    logFailureExec(activityId, error, {
      audioFileId: filePath,  // filePathを記録
      salespersonName: salespersonName || '不明',
      contactName: contactName || '不明',
      orgName: orgName || '不明',
      processingTime: timer.getElapsedSeconds()
    });

    // AppSheetにエラー情報を書き込み
    if (activityId) {
      updateActivityOnError(activityId, error.toString());
    }

    throw error;
  }
}
