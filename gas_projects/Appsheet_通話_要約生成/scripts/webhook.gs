/**
 * Webhookエントリーポイント
 * AppSheetからのWebhookリクエストを受信し、重複防止機能を適用して処理を実行
 * 
 * @author Fractal Group
 * @version 4.0.0
 * @date 2025-10-17
 */

/**
 * WebアプリのPOSTリクエストエントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e - POSTリクエストイベント
 * @return {GoogleAppsScript.Content.TextOutput} レスポンス
 */
function doPost(e) {
  try {
    return executeWebhookWithDuplicationPrevention(e, processCallSummaryWithErrorHandling, {
      recordIdField: 'callId',
      enableFingerprint: true,
      metadata: { 
        processor: 'vertex_ai_unified',
        version: '4.0.0',
        scriptName: 'Appsheet_通話_要約生成'
      }
    });
  } catch (error) {
    Logger.log(`[doPost] エラー: ${error.message}`);
    
    // パラメータからcallIdを取得（可能な場合）
    let callId = 'ID不明';
    try {
      const params = JSON.parse(e.postData.contents);
      callId = params.callId || 'ID不明';
    } catch (e) {
      // パース失敗時は無視
    }
    
    // エラーログを記録
    logFailure(callId, error, {
      notes: 'doPost実行エラー'
    });
    
    throw error;
  }
}

/**
 * エラーハンドリング付きの通話要約処理
 * processCallSummaryをラップし、エラーログとAppSheetエラー記録を追加
 * 
 * @param {Object} params - Webhookパラメータ
 * @return {Object} 処理結果
 */
function processCallSummaryWithErrorHandling(params) {
  const callId = params.callId || 'ID不明';
  
  try {
    return processCallSummary(params);
  } catch (error) {
    Logger.log(`[エラー] 通話ID: ${callId}, エラー: ${error.message}`);
    
    // エラーログを記録
    logFailure(callId, error, {
      filePath: params.filePath,
      fileId: params.fileId
    });
    
    // AppSheetにエラー記録
    try {
      const config = getConfig();
      recordError(callId, error.message, config);
    } catch (e) {
      Logger.log(`[エラー記録失敗] ${e.message}`);
    }
    
    throw error;
  }
}
