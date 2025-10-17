/**
 * 新規依頼作成モジュール
 * 通話要約から自動的に訪問看護依頼を作成・更新する
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-17
 */

/**
 * 通話要約から新規依頼を作成する統合処理
 * @param {string} callId - 通話ID
 * @param {string} callDatetime - 通話日時（ISO形式）
 * @param {string} summary - 通話要約
 * @param {string} transcript - 通話の全文書き起こし
 * @param {string} clientId - クライアントID
 * @param {Object} config - 設定オブジェクト
 * @param {string} [requestIds] - 既存の依頼ID（更新時）
 * @param {string} [requesterOrgId] - 依頼者組織ID
 * @param {string} [requesterId] - 依頼者ID
 * @param {string} [creatorId] - 作成者ID
 * @param {string} [existingRequestReason] - 既存の依頼理由
 * @param {string} [existingClientInfo] - 既存の利用者情報
 * @param {string} [existingNextAction] - 既存の次回アクション
 * @return {Object} 作成結果 { requestId, isNew, details }
 */
function createOrUpdateRequestFromSummary(
  callId,
  callDatetime,
  summary,
  transcript,
  clientId,
  config,
  requestIds = null,
  requesterOrgId = null,
  requesterId = null,
  creatorId = null,
  existingRequestReason = null,
  existingClientInfo = null,
  existingNextAction = null
) {
  try {
    Logger.log(`[依頼作成] 処理開始 - Call ID: ${callId}`);
    
    // request_idsの有無で処理を分岐
    if (requestIds && requestIds.trim() !== "") {
      // 既存依頼の更新
      Logger.log(`[依頼作成] 既存依頼を更新: ${requestIds}`);
      
      const updatedDetails = updateRequestDetailsWithGemini(
        summary,
        transcript,
        existingRequestReason,
        existingClientInfo,
        existingNextAction,
        config
      );
      
      if (!updatedDetails) {
        throw new Error("AI応答(更新)が不正でした");
      }
      
      const targetRequestId = requestIds.split(',')[0].trim();
      
      updateExistingRequest(
        targetRequestId,
        updatedDetails,
        creatorId,
        config
      );
      
      Logger.log(`[依頼作成] 更新完了 - Request ID: ${targetRequestId}`);
      
      return {
        requestId: targetRequestId,
        isNew: false,
        details: updatedDetails
      };
      
    } else {
      // 新規依頼の作成
      Logger.log(`[依頼作成] 新規依頼を作成`);
      
      const requestId = generateRequestId(callDatetime);
      
      const extractedDetails = extractNewRequestDetailsWithGemini(
        summary,
        transcript,
        config
      );
      
      if (!extractedDetails) {
        throw new Error("AI応答(新規)が不正でした");
      }
      
      createNewRequest(
        callId,
        callDatetime,
        requestId,
        extractedDetails,
        requesterOrgId,
        requesterId,
        creatorId,
        config
      );
      
      Logger.log(`[依頼作成] 新規作成完了 - Request ID: ${requestId}`);
      
      return {
        requestId: requestId,
        isNew: true,
        details: extractedDetails
      };
    }
    
  } catch (error) {
    Logger.log(`[依頼作成] エラー: ${error.message}`);
    throw error;
  }
}

/**
 * 【新規作成用】Gemini APIで通話内容から依頼情報を抽出する
 * @param {string} summary - 通話要約
 * @param {string} transcript - 通話全文
 * @param {Object} config - 設定オブジェクト
 * @return {Object} 抽出された依頼情報
 */
function extractNewRequestDetailsWithGemini(summary, transcript, config) {
  const prompt = `
# あなたの役割

あなたは優秀な事務スタッフです。以下の通話記録を読み解き、新しい「訪問看護依頼」の情報を抽出してください。

# 参照情報

## 通話の要約
${summary}

## 通話の全文
${transcript}

# 抽出ルール

- 参照情報から、以下のJSONオブジェクトのキーに対応する値を抽出・推測してください。
- client_name_temp: 依頼対象の利用者名が分かれば記載。不明なら「通話相手からのご依頼」と記載。
- 該当する情報がない場合はnullを設定してください。
- **JSON形式のみを出力し、説明文は一切含めないでください。**

{
  "priority": "依頼の緊急度を「高」「中」「低」で判断",
  "request_type": "依頼の種類を「相談案件」「新規依頼」で判断",
  "request_reason": "依頼の経緯や理由を要約",
  "client_name_temp": "(ルールに従って生成)",
  "client_info_temp": "新規利用者に関する情報を箇条書きテキストで要約",
  "next_action_date": "次回対応すべき日付をYYYY-MM-DD形式で推測(不明ならnull)",
  "next_action_details": "次に行うべきアクションの内容",
  "service_start_date": "サービス開始希望日をYYYY-MM-DD形式で推測(不明ならnull)"
}
`;

  return callGeminiForRequest(prompt, config);
}

/**
 * 【上書き更新用】Gemini APIで既存情報と通話内容を元に依頼情報を更新する
 * @param {string} summary - 通話要約
 * @param {string} transcript - 通話全文
 * @param {string} existingRequestReason - 既存の依頼理由
 * @param {string} existingClientInfo - 既存の利用者情報
 * @param {string} existingNextAction - 既存の次回アクション
 * @param {Object} config - 設定オブジェクト
 * @return {Object} 更新された依頼情報
 */
function updateRequestDetailsWithGemini(
  summary,
  transcript,
  existingRequestReason,
  existingClientInfo,
  existingNextAction,
  config
) {
  const prompt = `
# あなたの役割

あなたは優秀な事務スタッフです。以下の#既存の依頼情報に対して、#今回の通話内容で得られた新しい情報を反映・更新し、最終的な依頼情報を生成してください。

# 既存の依頼情報

- 依頼理由: ${existingRequestReason || '未記載'}
- 利用者情報: ${existingClientInfo || '未記載'}
- 次回アクション: ${existingNextAction || '未記載'}

# 今回の通話内容

## 通話の要約
${summary}

## 通話の全文
${transcript}

# 抽出・更新ルール

- 上記の全ての情報を考慮し、以下のJSONオブジェクトの値を最新の情報に更新してください。
- 変更がない項目は、既存の情報を維持してください。
- 該当する情報がない場合はnullを設定してください。
- **JSON形式のみを出力し、説明文は一切含めないでください。**

{
  "priority": "最新の状況を反映した緊急度を「高」「中」「低」で再判断",
  "request_type": "最新の状況を反映した依頼の種類を「相談案件」「新規依頼」で再判断",
  "request_reason": "最新の状況を反映した依頼の経緯や理由",
  "client_name_temp": "(変更があれば更新、なければ既存のまま)",
  "client_info_temp": "最新の状況を反映した利用者情報の箇条書きテキスト",
  "next_action_date": "最新の状況を反映した次回対応日をYYYY-MM-DD形式で推測(不明ならnull)",
  "next_action_details": "最新の状況を反映した次回アクションの内容",
  "service_start_date": "最新の状況を反映したサービス開始希望日をYYYY-MM-DD形式で推測(不明ならnull)"
}
`;

  return callGeminiForRequest(prompt, config);
}

/**
 * Gemini APIを呼び出す共通関数（依頼作成用）
 * 共通のGeminiモデル定義を使用
 * @param {string} prompt - プロンプト
 * @param {Object} config - 設定オブジェクト
 * @return {Object} パース済みのJSON結果
 */
function callGeminiForRequest(prompt, config) {
  try {
    // 共通のGemini API呼び出し関数を使用
    // 中等度の思考力が必要なため、Flash思考モードを使用
    const result = generateJSON(prompt, config.geminiApiKey, {
      taskType: 'moderate',
      temperature: 0.3
    });
    
    Logger.log('[Gemini API] 依頼情報抽出成功');
    
    return result;
    
  } catch (error) {
    Logger.log(`[Gemini API] 依頼情報抽出エラー: ${error.message}`);
    throw error;
  }
}

/**
 * AppSheetに新しい依頼行を作成する
 * @param {string} callId - 通話ID
 * @param {string} callDatetime - 通話日時
 * @param {string} requestId - 依頼ID
 * @param {Object} extractedDetails - 抽出された依頼情報
 * @param {string} requesterOrgId - 依頼者組織ID
 * @param {string} requesterId - 依頼者ID
 * @param {string} creatorId - 作成者ID
 * @param {Object} config - 設定オブジェクト
 */
function createNewRequest(
  callId,
  callDatetime,
  requestId,
  extractedDetails,
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
    "priority": extractedDetails.priority,
    "request_type": extractedDetails.request_type,
    "request_date": Utilities.formatDate(date, "JST", "yyyy-MM-dd"),
    "request_time": Utilities.formatDate(date, "JST", "HH:mm:ss"),
    "request_reason": extractedDetails.request_reason,
    "requester_org_id": requesterOrgId,
    "requester_id": requesterId,
    "client_name_temp": extractedDetails.client_name_temp,
    "client_info_temp": extractedDetails.client_info_temp,
    "next_action_date": extractedDetails.next_action_date,
    "next_action_details": extractedDetails.next_action_details,
    "call_record_id": callId,
    "service_start_date": extractedDetails.service_start_date,
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
 * @param {string} requestId - 依頼ID
 * @param {Object} updatedDetails - 更新された依頼情報
 * @param {string} creatorId - 更新者ID
 * @param {Object} config - 設定オブジェクト
 */
function updateExistingRequest(requestId, updatedDetails, creatorId, config) {
  const rowData = {
    "request_id": requestId,
    "priority": updatedDetails.priority,
    "request_type": updatedDetails.request_type,
    "request_reason": updatedDetails.request_reason,
    "client_name_temp": updatedDetails.client_name_temp,
    "client_info_temp": updatedDetails.client_info_temp,
    "next_action_date": updatedDetails.next_action_date,
    "next_action_details": updatedDetails.next_action_details,
    "service_start_date": updatedDetails.service_start_date,
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
 * AppSheet API を呼び出す共通関数（依頼作成用）
 * @param {string} appId - アプリID
 * @param {string} accessKey - アクセスキー
 * @param {string} tableName - テーブル名
 * @param {Object} payload - リクエストペイロード
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

/**
 * Call_Logsテーブルにrequest_idsを更新する
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
 * @param {string} datetimeString - 日時文字列（ISO形式）
 * @return {string} 生成された依頼ID（CLRQ-YYYYMMDDHHmm形式）
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
