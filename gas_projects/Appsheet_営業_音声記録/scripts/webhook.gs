/**
 * AppSheet Webhook エントリーポイント
 * 営業音声記録の分析リクエストを受け取る
 * 
 * @param {GoogleAppsScript.Events.DoPost} e - POSTリクエストイベント
 * @returns {GoogleAppsScript.Content.TextOutput} - レスポンス
 */
function doPost(e) {
  try {
    // リクエストパラメータを取得
    const params = JSON.parse(e.postData.contents);
    
    Logger.log('受信パラメータ: ' + JSON.stringify(params));
    
    // メイン処理を呼び出し（個別引数で渡す）
    const result = processSalesAudioAnalysis(
      params.activityId,
      params.audioFileId,
      params.salespersonName,
      params.contactName,
      params.orgName
    );
    
    // 成功レスポンスを返す
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      activityId: params.activityId,
      result: result
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Webhookエラー: ' + error.toString());
    
    // エラーレスポンスを返す
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 直接実行用関数（個別引数版）
 * GASエディタやスクリプトトリガーから直接実行する場合に使用
 * 
 * @param {string} activityId - 活動ID
 * @param {string} audioFileId - 音声ファイルのGoogle Drive ID
 * @param {string} salespersonName - 営業担当者名（任意）
 * @param {string} contactName - 面会相手名（任意）
 * @param {string} orgName - 訪問先機関名（任意）
 * @returns {Object} - 処理結果
 */
function processSalesAudioAnalysisDirect(activityId, audioFileId, salespersonName, contactName, orgName) {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🎤 営業音声分析 - 直接実行');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log(`Activity ID: ${activityId}`);
  Logger.log(`Audio File ID: ${audioFileId}`);
  Logger.log(`営業担当者: ${salespersonName || '未指定'}`);
  Logger.log(`面会相手: ${contactName || '未指定'}`);
  Logger.log(`訪問先: ${orgName || '未指定'}`);
  Logger.log('');
  
  return processSalesAudioAnalysis(
    activityId,
    audioFileId,
    salespersonName || '',
    contactName || '',
    orgName || ''
  );
}
