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
    
    // メイン処理を呼び出し
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
 * 直接実行用ラッパー関数
 * テストやスクリプトトリガーから呼び出す場合に使用
 * 
 * @param {string} activityId - 活動ID
 * @param {string} audioFileId - 音声ファイルのGoogle Drive ID
 * @param {string} salespersonName - 営業担当者名
 * @param {string} contactName - 面会相手名
 * @param {string} orgName - 訪問先機関名
 * @returns {Object} - 処理結果
 */
function processSalesAudioAnalysisDirect(activityId, audioFileId, salespersonName, contactName, orgName) {
  return processSalesAudioAnalysis(activityId, audioFileId, salespersonName, contactName, orgName);
}
