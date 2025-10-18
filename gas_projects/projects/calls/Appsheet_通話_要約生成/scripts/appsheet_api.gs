/**
 * AppSheet API統合モジュール
 * 依頼作成・更新用のAppSheet API呼び出し共通関数
 * 
 * @author Fractal Group
 * @version 4.0.0
 * @date 2025-10-17
 */

/**
 * AppSheet API を呼び出す共通関数（依頼作成/更新用）
 * 
 * @param {string} appId - アプリID
 * @param {string} accessKey - アクセスキー
 * @param {string} tableName - テーブル名
 * @param {Object} payload - リクエストペイロード
 * @throws {Error} API呼び出しが失敗した場合
 */
function callAppSheetApiForRequest(appId, accessKey, tableName, payload) {
  const apiUrl = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${tableName}/Action`;
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'ApplicationAccessKey': accessKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  Logger.log(`[AppSheet API] ${tableName} - ${responseCode}: ${responseText.substring(0, 200)}`);
  
  if (responseCode >= 400) {
    throw new Error(`AppSheet API Error (${tableName}): ${responseCode} - ${responseText}`);
  }
}
