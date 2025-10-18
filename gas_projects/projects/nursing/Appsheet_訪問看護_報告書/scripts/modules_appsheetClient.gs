/**
 * modules_appsheetClient.gs - AppSheet API統合モジュール
 *
 * AppSheetテーブルへのデータ更新処理
 *
 * @version 1.0.0
 * @date 2025-10-18
 */

/**
 * 成功時にAppSheetのテーブルを更新する
 * @param {string} reportId - 報告書ID
 * @param {string} reportText - 生成された報告書テキスト
 * @param {string} staffId - スタッフID
 */
function updateReportOnSuccess(reportId, reportText, staffId) {
  const rowData = {
    [APPSHEET_FIELD_MAPPING.reportId]: reportId,
    [APPSHEET_FIELD_MAPPING.status]: "編集中",
    [APPSHEET_FIELD_MAPPING.symptomProgress]: reportText,
    [APPSHEET_FIELD_MAPPING.updatedBy]: staffId
  };

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP" },
    Rows: [rowData]
  };

  callAppSheetApi(payload);
}

/**
 * 失敗時にAppSheetのテーブルを更新する
 * @param {string} reportId - 報告書ID
 * @param {string} errorMessage - エラーメッセージ
 */
function updateReportOnError(reportId, errorMessage) {
  const rowData = {
    [APPSHEET_FIELD_MAPPING.reportId]: reportId,
    [APPSHEET_FIELD_MAPPING.status]: "エラー",
    [APPSHEET_FIELD_MAPPING.errorDetails]: `GAS Script Error: ${errorMessage}`
  };

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [rowData]
  };

  callAppSheetApi(payload);
}

/**
 * AppSheet APIを呼び出す共通関数
 * @param {Object} payload - AppSheet APIペイロード
 */
function callAppSheetApi(payload) {
  const perfStop = perfStart('AppSheet_API');

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APPSHEET_CONFIG.appId}/tables/${APPSHEET_CONFIG.tableName}/Action`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'ApplicationAccessKey': APPSHEET_CONFIG.accessKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();

  const duration = perfStop();
  logApiCall('AppSheet', apiUrl, responseCode, duration);

  if (responseCode >= 400) {
    const errorMsg = `AppSheet API Error: ${responseCode} - ${response.getContentText()}`;
    logStructured(LOG_LEVEL.ERROR, errorMsg, {
      payload: payload,
      responseCode: responseCode
    });
    throw new Error(errorMsg);
  }
}
