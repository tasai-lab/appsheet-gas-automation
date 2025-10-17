/**
 * AppSheet API統合
 * Call_Actionsテーブルの更新処理
 * 
 * @author Fractal Group
 * @version 1.1.0
 * @date 2025-10-17
 */

// --- 基本設定 ---
const APP_ID = '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f';
const ACCESS_KEY = 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT';
const ACTIONS_TABLE_NAME = 'Call_Actions';

/**
 * 成功時のAppSheet更新
 * Call_Actionsテーブルのステータスを「反映済み」に更新
 * 
 * @param {string} actionId - アクションID
 * @param {string} externalId - 外部ID（Calendar/TasksのID）
 * @param {string} externalUrl - 外部URL（Calendar/TasksのURL）
 */
function updateActionOnSuccess(actionId, externalId, externalUrl) {
  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [{
      "action_id": actionId,
      "external_id": externalId,
      "external_url": externalUrl,
      "status": "反映済み"
    }]
  };
  
  callAppSheetApi(payload);
}

/**
 * エラー時のAppSheet更新
 * Call_Actionsテーブルのステータスを「エラー」に更新
 * 
 * @param {string} actionId - アクションID
 * @param {string} errorMessage - エラーメッセージ
 */
function updateActionOnError(actionId, errorMessage) {
  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [{
      "action_id": actionId,
      "status": "エラー",
      "error_details": `GAS Script Error: ${errorMessage}`
    }]
  };
  
  callAppSheetApi(payload);
}

/**
 * AppSheet API呼び出し共通関数
 * 
 * @param {Object} payload - リクエストペイロード
 * @throws {Error} API呼び出しが失敗した場合
 */
function callAppSheetApi(payload) {
  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${ACTIONS_TABLE_NAME}/Action`;
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'ApplicationAccessKey': ACCESS_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(apiUrl, options);
  Logger.log(`[AppSheet API] ${response.getResponseCode()} - ${response.getContentText()}`);
  
  if (response.getResponseCode() >= 400) {
    throw new Error(`AppSheet API Error: ${response.getResponseCode()} - ${response.getContentText()}`);
  }
}
