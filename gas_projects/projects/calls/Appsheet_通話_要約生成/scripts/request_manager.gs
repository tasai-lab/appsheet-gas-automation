/**
 * 依頼管理モジュール
 * 新規依頼作成、既存依頼更新、依頼ID生成などの依頼関連処理
 * 
 * @author Fractal Group
 * @version 4.0.0
 * @date 2025-10-17
 */

/**
 * AppSheetに新しい依頼行を作成する
 * AIから取得した依頼情報を直接使用
 * 
 * @param {string} callId - 通話ID
 * @param {string} callDatetime - 通話日時（ISO形式）
 * @param {string} requestId - 依頼ID
 * @param {Object} requestDetails - AI抽出の依頼詳細情報
 * @param {string} requesterOrgId - 依頼元組織ID
 * @param {string} requesterId - 依頼者ID
 * @param {string} creatorId - 作成者ID
 * @param {Object} config - 設定オブジェクト
 */
function createNewRequestDirect(
  callId,
  callDatetime,
  requestId,
  requestDetails,
  requesterOrgId,
  requesterId,
  creatorId,
  config
) {
  const date = new Date(callDatetime);
  
  const rowData = {
    "request_id": requestId,
    "status": "新規受付",
    "channel": "電話",
    "priority": requestDetails.priority,
    "request_type": requestDetails.request_type,
    "request_date": Utilities.formatDate(date, "JST", "yyyy-MM-dd"),
    "request_time": Utilities.formatDate(date, "JST", "HH:mm:ss"),
    "request_reason": requestDetails.request_reason,
    "requester_org_id": requesterOrgId,
    "requester_id": requesterId,
    "client_name_temp": requestDetails.client_name_temp,
    "client_info_temp": requestDetails.client_info_temp,
    "next_action_date": requestDetails.next_action_date,
    "next_action_details": requestDetails.next_action_details,
    "call_record_id": callId,
    "service_start_date": requestDetails.service_start_date,
    "created_by": creatorId,
    "updated_by": creatorId
  };
  
  const payload = {
    Action: "Add",
    Properties: {
      "Locale": "ja-JP",
      "Timezone": "Asia/Tokyo"
    },
    Rows: [rowData]
  };
  
  callAppSheetApiForRequest(
    config.requestsAppId,
    config.requestsAppAccessKey,
    config.requestsTableName,
    payload
  );
  
  Logger.log(`[依頼作成] 新規依頼をAppSheetに登録: ${requestId}`);
}

/**
 * AppSheetの既存の依頼行を更新する
 * AIから取得した依頼情報を直接使用
 * 
 * @param {string} requestId - 依頼ID
 * @param {Object} requestDetails - AI抽出の依頼詳細情報
 * @param {string} creatorId - 作成者ID
 * @param {Object} config - 設定オブジェクト
 */
function updateExistingRequestDirect(requestId, requestDetails, creatorId, config) {
  const rowData = {
    "request_id": requestId,
    "priority": requestDetails.priority,
    "request_type": requestDetails.request_type,
    "request_reason": requestDetails.request_reason,
    "client_name_temp": requestDetails.client_name_temp,
    "client_info_temp": requestDetails.client_info_temp,
    "next_action_date": requestDetails.next_action_date,
    "next_action_details": requestDetails.next_action_details,
    "service_start_date": requestDetails.service_start_date,
    "updated_by": creatorId
  };
  
  const payload = {
    Action: "Edit",
    Properties: {
      "Locale": "ja-JP",
      "Timezone": "Asia/Tokyo"
    },
    Rows: [rowData]
  };
  
  callAppSheetApiForRequest(
    config.requestsAppId,
    config.requestsAppAccessKey,
    config.requestsTableName,
    payload
  );
  
  Logger.log(`[依頼作成] 既存依頼をAppSheetで更新: ${requestId}`);
}

/**
 * Call_Logsテーブルにrequest_idsを更新する
 * 
 * @param {string} callId - 通話ID
 * @param {string} requestId - 依頼ID
 * @param {Object} config - 設定オブジェクト
 */
function updateCallLogWithRequestId(callId, requestId, config) {
  const rowData = {
    "call_id": callId,
    "request_ids": requestId
  };
  
  const payload = {
    Action: "Edit",
    Properties: {
      "Locale": "ja-JP",
      "Timezone": "Asia/Tokyo"
    },
    Rows: [rowData]
  };
  
  callAppSheetApiForRequest(
    config.mainAppId,
    config.mainAppAccessKey,
    config.logsTableName,
    payload
  );
  
  Logger.log(`[依頼作成] Call_Logsにrequest_idsを更新: ${callId} -> ${requestId}`);
}

/**
 * 依頼ID生成関数
 * CLRQ-YYYYMMDDHHmm形式の依頼IDを生成
 * 
 * @param {string} datetimeString - 日時文字列（ISO形式）
 * @return {string} 生成された依頼ID（例: CLRQ-202510171430）
 */
function generateRequestId(datetimeString) {
  const date = new Date(datetimeString);
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  
  return `CLRQ-${y}${m}${d}${h}${min}`;
}
