/**
 * AppSheet API操作モジュール
 *
 * AppSheetとのデータ連携を担当
 * - ClientID採番
 * - 利用者データの作成
 * - 依頼ステータスの更新
 *
 * @version 1.0.0
 * @date 2025-10-21
 */

// ========================================
// AppSheet API操作
// ========================================

/**
 * AppSheet APIに問い合わせて、新しいClientIDを採番する
 *
 * @return {string} 新しいClientID（例: "CL-00001"）
 */
function getNewClientId() {
  const findPayload = {
    Action: "Find",
    Properties: { "Locale": "ja-JP" }
  };

  const responseText = callAppSheetApi(
    CLIENTS_APP_ID,
    CLIENTS_APP_ACCESS_KEY,
    CLIENTS_TABLE_NAME,
    findPayload
  );

  const rows = JSON.parse(responseText);
  const newCount = rows.length + 1;
  const newIdNumber = "00000".substring(0, 5 - String(newCount).length) + newCount;

  return `CL-${newIdNumber}`;
}

/**
 * AppSheetのClientsテーブルに新しい利用者を作成する
 *
 * @param {string} clientId - 新しく採番された利用者ID
 * @param {Object} extractedInfo - AIが抽出した利用者情報
 * @param {Object} params - Webhookで受け取った元のパラメータ
 */
function createClientInAppSheet(clientId, extractedInfo, params) {
  const rowData = {
    "client_id": clientId,
    "status": DEFAULT_CLIENT_STATUS,
    "request_id": params.requestId,
    "provider_office": params.providerOffice,
    "last_name": extractedInfo.last_name,
    "first_name": extractedInfo.first_name,
    "last_name_kana": extractedInfo.last_name_kana,
    "first_name_kana": extractedInfo.first_name_kana,
    "gender": extractedInfo.gender,
    "birth_date": extractedInfo.birth_date,
    "birth_date_nengo": extractedInfo.birth_date_nengo,
    "birth_date_nengo_year": extractedInfo.birth_date_nengo_year,
    "age": calculateAge(extractedInfo.birth_date),
    "is_welfare_recipient": extractedInfo.is_welfare_recipient,
    "care_level_name": extractedInfo.care_level_name,
    "phone1": extractedInfo.phone1,
    "phone1_destination": extractedInfo.phone1_destination,
    "phone2": extractedInfo.phone2,
    "phone2_destination": extractedInfo.phone2_destination,
    "special_notes": extractedInfo.special_notes,
    "created_by": params.staffId,
    "updated_by": params.staffId
  };

  const payload = {
    Action: "Add",
    Properties: { "Locale": "ja-JP" },
    Rows: [rowData]
  };

  callAppSheetApi(
    CLIENTS_APP_ID,
    CLIENTS_APP_ACCESS_KEY,
    CLIENTS_TABLE_NAME,
    payload
  );
}

/**
 * 元の依頼レコードのステータスを更新する
 *
 * @param {string} requestId - 依頼ID
 * @param {string} status - 新しいステータス（"反映済み" or "エラー"）
 * @param {string} errorMessage - エラーメッセージ（オプション）
 */
function updateRequestStatus(requestId, status, errorMessage) {
  const rowData = {
    "request_id": requestId,
    "status": status
  };

  if (errorMessage) {
    rowData.error_details = `GAS Script Error: ${errorMessage}`;
  }

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP" },
    Rows: [rowData]
  };

  callAppSheetApi(
    REQUESTS_APP_ID,
    REQUESTS_APP_ACCESS_KEY,
    REQUESTS_TABLE_NAME,
    payload
  );
}

/**
 * AppSheet APIを呼び出す共通関数
 *
 * @param {string} appId - AppアプリケーションID
 * @param {string} accessKey - アクセスキー
 * @param {string} tableName - テーブル名
 * @param {Object} payload - リクエストペイロード
 * @return {string} APIレスポンステキスト
 */
function callAppSheetApi(appId, accessKey, tableName, payload) {
  const apiUrl = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${tableName}/Action`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'ApplicationAccessKey': accessKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseText = response.getContentText();

  Logger.log(`AppSheet API (${tableName}) 応答: ${response.getResponseCode()} - ${responseText}`);

  if (response.getResponseCode() >= 400) {
    throw new Error(`AppSheet API Error (${tableName}): ${response.getResponseCode()} - ${responseText}`);
  }

  return responseText;
}
