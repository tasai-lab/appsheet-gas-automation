/**
 * AppSheet API連携サービス
 * Call_Queriesテーブルの更新機能を提供
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-18
 */

/**
 * 質疑応答のステータスを更新
 * @param {string} queryId - 質疑応答ID
 * @param {string} status - ステータス（完了/エラー）
 * @param {string} messageId - ChatメッセージID（成功時）
 * @param {string} errorMessage - エラーメッセージ（失敗時）
 */
function updateQueryStatus(queryId, status, messageId, errorMessage) {
  const rowData = {
    query_id: queryId,
    status: status
  };

  // 成功時はメッセージIDを記録
  if (messageId) {
    rowData.thread_id = messageId;
  }

  // エラー時はエラー詳細を記録
  if (errorMessage) {
    rowData.error_details = `GAS Script Error: ${errorMessage}`;
  }

  const payload = {
    Action: "Edit",
    Properties: {
      Locale: "ja-JP",
      Timezone: "Asia/Tokyo"
    },
    Rows: [rowData]
  };

  callAppSheetAPI(payload);
}

/**
 * AppSheet APIを呼び出す
 * @param {Object} payload - APIペイロード
 */
function callAppSheetAPI(payload) {
  const config = getConfig();
  const apiUrl = `${config.appsheet.API_ENDPOINT}/${config.appsheet.APP_ID}/tables/${config.appsheet.TABLE_NAME}/Action`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'ApplicationAccessKey': config.appsheet.ACCESS_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  Logger.log(`[AppSheet] API応答: ${responseCode} - ${responseText}`);

  if (responseCode >= 400) {
    throw new Error(`AppSheet API Error: ${responseCode} - ${responseText}`);
  }
}
