/**
 * 営業音声分析プロセッサ
 * 音声ファイルの分析とAppSheet更新を統括
 */

/**
 * 営業音声記録を分析し、AppSheetを更新する
 * 
 * @param {string} activityId - 活動ID
 * @param {string} filePath - 音声ファイルのGoogle Driveパス（優先）
 * @param {string} fileId - 音声ファイルのGoogle Drive ID（filePathが無い場合）
 * @param {string} salespersonName - 営業担当者名（任意）
 * @param {string} contactName - 面会相手名（任意）
 * @param {string} orgName - 訪問先機関名（任意）
 * @returns {Object} - 分析結果
 */
function processSalesAudioAnalysis(activityId, filePath, fileId, salespersonName, contactName, orgName) {
  try {
    // パラメータ検証
    if (!activityId) {
      throw new Error('必須パラメータ（activityId）が不足しています。');
    }
    
    if (!filePath && !fileId) {
      throw new Error('filePathまたはfileIdのいずれかが必須です。');
    }
    
    Logger.log(`処理開始: Activity ID = ${activityId}`);
    Logger.log(`ファイル指定: filePath=${filePath || '未指定'}, fileId=${fileId || '未指定'}`);
    
    // コンテキスト情報を構築
    const context = {
      filePath: filePath,
      fileId: fileId,
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
    
    // AppSheetに分析結果を書き込み
    updateActivityOnSuccess(activityId, analysisResult);
    
    Logger.log(`処理完了。ID ${activityId} の分析結果を書き込みました。`);
    
    return {
      status: 'SUCCESS',
      activityId: activityId,
      analysis: analysisResult
    };
    
  } catch (error) {
    Logger.log(`エラーが発生しました: ${error.toString()}`);
    
    // AppSheetにエラー情報を書き込み
    if (activityId) {
      updateActivityOnError(activityId, error.toString());
    }
    
    throw error;
  }
}
