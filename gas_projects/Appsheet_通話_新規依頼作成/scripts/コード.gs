/**
 * 実行ログモジュール
 */
const ExecutionLogger = {
  SPREADSHEET_ID: '15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE',
  SHEET_NAME: 'シート1',
  
  /**
   * ログを記録
   * @param {string} scriptName - スクリプト名
   * @param {string} status - ステータス (SUCCESS/ERROR/WARNING)
   * @param {string} processId - 処理ID
   * @param {string} message - メッセージ
   * @param {string} errorDetail - エラー詳細
   * @param {number} executionTime - 実行時間(秒)
   * @param {Object} inputData - 入力データ
   */
  log: function(scriptName, status, processId, message, errorDetail, executionTime, inputData) {
    try {
      const ss = SpreadsheetApp.openById(this.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(this.SHEET_NAME);
      
      const timestamp = new Date();
      const user = Session.getActiveUser().getEmail();
      const inputDataStr = inputData ? JSON.stringify(inputData).substring(0, 1000) : '';
      
      sheet.appendRow([
        timestamp,
        scriptName,
        status,
        processId || '',
        message || '',
        errorDetail || '',
        executionTime || 0,
        user,
        inputDataStr
      ]);
    } catch (e) {
      Logger.log(`ログ記録エラー: ${e.message}`);
    }
  },
  
  /**
   * 成功ログ
   */
  success: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'SUCCESS', processId, message, '', executionTime, inputData);
  },
  
  /**
   * エラーログ
   */
  error: function(scriptName, processId, message, error, executionTime, inputData) {
    const errorDetail = error ? `${error.message}\n${error.stack}` : '';
    this.log(scriptName, 'ERROR', processId, message, errorDetail, executionTime, inputData);
  },
  
  /**
   * 警告ログ
   */
  warning: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'WARNING', processId, message, '', executionTime, inputData);
  }
};


/**
 * Webhook重複実行防止モジュール
 */
const DuplicationPrevention = {
  LOCK_TIMEOUT: 300000, // 5分
  CACHE_EXPIRATION: 3600, // 1時間
  
  /**
   * リクエストの重複チェック
   * @param {string} requestId - リクエストID（webhookデータのハッシュ値）
   * @return {boolean} - 処理を続行する場合はtrue
   */
  checkDuplicate: function(requestId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `processed_${requestId}`;
    
    // キャッシュチェック
    if (cache.get(cacheKey)) {
      Logger.log(`重複リクエストを検出: ${requestId}`);
      return false;
    }
    
    // ロック取得
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(this.LOCK_TIMEOUT);
      
      // 再度キャッシュチェック（ダブルチェック）
      if (cache.get(cacheKey)) {
        Logger.log(`ロック取得後、重複リクエストを検出: ${requestId}`);
        return false;
      }
      
      // 処理済みマークを設定
      cache.put(cacheKey, 'processed', this.CACHE_EXPIRATION);
      return true;
    } catch (e) {
      Logger.log(`ロック取得エラー: ${e.message}`);
      return false;
    } finally {
      lock.releaseLock();
    }
  },
  
  /**
   * リクエストIDを生成
   * @param {Object} data - Webhookデータ
   * @return {string} - リクエストID
   */
  generateRequestId: function(data) {
    const str = JSON.stringify(data);
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      str,
      Utilities.Charset.UTF_8
    ).map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
  }
};


// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

// ▼ メインアプリ（Call_Logs）の情報

const MAIN_APP_ID = '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f'; 

const MAIN_APP_ACCESS_KEY = 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT';



// ▼ 依頼作成先アプリ（Client_Requests）の情報

const REQUESTS_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8'; 

const REQUESTS_APP_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';



// Gemini APIキー

const GEMINI_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY'; 



// テーブル名

const LOGS_TABLE_NAME = 'Call_Logs';

const REQUESTS_TABLE_NAME = 'Client_Requests';



/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 */

function doPost(e) {

  const params = JSON.parse(e.postData.contents);

  const callId = params.callId;



  try {

    if (!callId || !params.callDatetime || !params.summary || !params.fullTranscript) {

      throw new Error("必須パラメータが不足しています。");

    }

    console.log(`処理開始: Call ID = ${callId}`);



    // ★ request_idsの有無で処理を分岐 ★

    if (params.request_ids && params.request_ids.trim() !== "") {

      // --- 上書き更新の処理 ---

      console.log(`既存の依頼を更新します: ${params.request_ids}`);

      const updatedDetails = updateRequestDetailsWithGemini(params);

      if (!updatedDetails) throw new Error("AIからの応答(更新)が不正でした。");

      

      const targetRequestId = params.request_ids.split(',')[0].trim(); // リストの先頭IDを対象とする

      updateExistingRequest(targetRequestId, params, updatedDetails);

      updateCallLogOnSuccess(callId, null); // 更新時は新しいIDを追加しない



    } else {

      // --- 新規作成の処理 ---

      console.log("新しい依頼を作成します。");

      const requestId = generateRequestId(params.callDatetime);

      const extractedDetails = extractNewRequestDetailsWithGemini(params.summary, params.fullTranscript);

      if (!extractedDetails) throw new Error("AIからの応答(新規)が不正でした。");



      createNewRequest(params, requestId, extractedDetails);

      updateCallLogOnSuccess(callId, requestId); // 新しいIDを渡す

    }



    console.log(`処理完了: Call ID = ${callId}`);



  } catch (error) {

    console.log(`エラーが発生しました: ${error.toString()}`);

    if (callId) {

      updateCallLogOnError(callId, error.toString());

    }

  }

}



// =================================================================

// Gemini API 呼び出し関数群 (新規用と更新用)

// =================================================================



/**

 * 【新規作成用】Gemini APIで通話内容から依頼情報を抽出する

 */

function extractNewRequestDetailsWithGemini(summary, fullTranscript) {

  const prompt = `

# あなたの役割

あなたは優秀な事務スタッフです。以下の通話記録を読み解き、新しい「訪問看護依頼」の情報を抽出してください。

# 参照情報

## 通話の要約: ${summary}

## 通話の全文: ${fullTranscript}

# 抽出ルール

- 参照情報から、以下のJSONオブジェクトのキーに対応する値を抽出・推測してください。

- client_name_temp: 依頼対象の利用者名が分かれば記載。不明なら「通話相手からのご依頼」と記載。

- 該当する情報がない場合はnullを設定してください。JSON以外の説明文は不要です。

{

  "priority": "依頼の緊急度を「高」「中」「低」で判断",

  "request_type": "依頼の種類を「相談案件」「新規依頼」で判断",

  "request_reason": "依頼の経緯や理由を要約",

  "client_name_temp": "（ルールに従って生成）",

  "client_info_temp": "新規利用者に関する情報を箇条書きテキストで要約",

  "next_action_date": "次回対応すべき日付をYYYY-MM-DD形式で推測",

  "next_action_details": "次に行うべきアクションの内容",

  "service_start_date": "サービス開始希望日をYYYY-MM-DD形式で推測"

}

`;

  return callGemini(prompt);

}



/**

 * 【上書き更新用】Gemini APIで既存情報と通話内容を元に依頼情報を更新する

 */

function updateRequestDetailsWithGemini(params) {

    const prompt = `

# あなたの役割

あなたは優秀な事務スタッフです。以下の#既存の依頼情報に対して、#今回の通話内容で得られた新しい情報を反映・更新し、最終的な依頼情報を生成してください。

# 既存の依頼情報

- 依頼理由: ${params.existing_request_reason || '未記載'}

- 利用者情報: ${params.existing_client_info || '未記載'}

- 次回アクション: ${params.existing_next_action || '未記載'}

# 今回の通話内容

## 通話の要約: ${params.summary}

## 通話の全文: ${params.fullTranscript}

# 抽出・更新ルール

- 上記の全ての情報を考慮し、以下のJSONオブジェクトの値を最新の情報に更新してください。

- 変更がない項目は、既存の情報を維持してください。

- 該当する情報がない場合はnullを設定してください。JSON以外の説明文は不要です。

{

  "priority": "最新の状況を反映した緊急度を「高」「中」「低」で再判断",

  "request_type": "最新の状況を反映した依頼の種類を「相談依頼」「新規依頼」で再判断",

  "request_reason": "最新の状況を反映した依頼の経緯や理由",

  "client_name_temp": "（変更があれば更新、なければ既存のままでOK）",

  "client_info_temp": "最新の状況を反映した利用者情報の箇条書きテキスト",

  "next_action_date": "最新の状況を反映した次回対応日をYYYY-MM-DD形式で推測",

  "next_action_details": "最新の状況を反映した次回アクションの内容",

  "service_start_date": "最新の状況を反映したサービス開始希望日をYYYY-MM-DD形式で推測"

}

`;

    return callGemini(prompt);

}



/**

 * Gemini APIを呼び出す共通関数

 */

function callGemini(prompt) {

  const textPart = { text: prompt };

  const model = 'gemini-2.5-pro';

  const generationConfig = { "responseMimeType": "application/json", "temperature": 0.3 };

  const requestBody = { contents: [{ parts: [textPart] }], generationConfig: generationConfig };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(requestBody), muteHttpExceptions: true };

  const response = UrlFetchApp.fetch(url, options);

  const responseText = response.getContentText();

  Logger.log('Gemini API Response: ' + responseText);

  const jsonResponse = JSON.parse(responseText);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {

    throw new Error("AIからの応答に有効な候補が含まれていません: " + responseText);

  }

  return JSON.parse(jsonResponse.candidates[0].content.parts[0].text);

}





// =================================================================

// AppSheet API 呼び出し関数群

// =================================================================



/**

 * AppSheetに新しい依頼行を作成する

 */

function createNewRequest(params, requestId, extractedDetails) {

  const date = new Date(params.callDatetime);

  const rowData = {

      "request_id": requestId, "status": "新規受付", "channel": "電話",

      "priority": extractedDetails.priority, "request_type": extractedDetails.request_type,

      "request_date": Utilities.formatDate(date, "JST", "yyyy-MM-dd"),

      "request_time": Utilities.formatDate(date, "JST", "HH:mm:ss"),

      "request_reason": extractedDetails.request_reason,

      "requester_org_id": params.requesterOrgId, "requester_id": params.requesterId,

      "client_name_temp": extractedDetails.client_name_temp,

      "client_info_temp": extractedDetails.client_info_temp,

      "next_action_date": extractedDetails.next_action_date,

      "next_action_details": extractedDetails.next_action_details,

      "call_record_id": params.callId,

      "service_start_date": extractedDetails.service_start_date,

      "created_by": params.creatorId, "updated_by": params.creatorId

  };

  const payload = { Action: "Add", Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: [rowData] };

  callAppSheetApi(REQUESTS_APP_ID, REQUESTS_APP_ACCESS_KEY, REQUESTS_TABLE_NAME, payload);

}



/**

 * AppSheetの既存の依頼行を更新する

 */

function updateExistingRequest(requestId, params, updatedDetails) {

    const rowData = {

        "request_id": requestId, // 更新対象のキー

        "priority": updatedDetails.priority,

        "request_type": updatedDetails.request_type,

        "request_reason": updatedDetails.request_reason,

        "client_name_temp": updatedDetails.client_name_temp,

        "client_info_temp": updatedDetails.client_info_temp,

        "next_action_date": updatedDetails.next_action_date,

        "next_action_details": updatedDetails.next_action_details,

        "service_start_date": updatedDetails.service_start_date,

        "updated_by": params.creatorId // 更新者のみ設定

    };

    const payload = { Action: "Edit", Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: [rowData] };

    callAppSheetApi(REQUESTS_APP_ID, REQUESTS_APP_ACCESS_KEY, REQUESTS_TABLE_NAME, payload);

}



/**

 * 成功時に元の通話記録を更新する

 */

function updateCallLogOnSuccess(callId, newRequestId) {

  const rowData = { "call_id": callId, "Status": "完了" };

  // newRequestIdがある場合（新規作成時）のみ、request_idsを更新

  if (newRequestId) {

    rowData.request_ids = newRequestId;

  }

  const payload = { Action: "Edit", Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: [rowData] };

  callAppSheetApi(MAIN_APP_ID, MAIN_APP_ACCESS_KEY, LOGS_TABLE_NAME, payload);

}



/**

 * 失敗時に元の通話記録を更新する

 */

function updateCallLogOnError(callId, errorMessage) {

  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [{

      "call_id": callId,

      "Status": "エラー",

      "error_details": `GAS Script Error: ${errorMessage}`

    }]

  };

  callAppSheetApi(MAIN_APP_ID, MAIN_APP_ACCESS_KEY, LOGS_TABLE_NAME, payload);

}



/**

 * AppSheet APIを呼び出す共通関数

 */

function callAppSheetApi(appId, accessKey, tableName, payload) {

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${tableName}/Action`;

  const options = {

    method: 'post', contentType: 'application/json',

    headers: { 'ApplicationAccessKey': accessKey },

    payload: JSON.stringify(payload), muteHttpExceptions: true

  };

  const response = UrlFetchApp.fetch(apiUrl, options);

  Logger.log(`AppSheet API (${tableName}) 応答: ${response.getResponseCode()} - ${response.getContentText()}`);

  if (response.getResponseCode() >= 400) {

    throw new Error(`AppSheet API Error (${tableName}): ${response.getResponseCode()} - ${response.getContentText()}`);

  }

}



// 依頼ID生成関数

function generateRequestId(datetimeString) {

  const date = new Date(datetimeString);

  const y = date.getFullYear();

  const m = (date.getMonth() + 1).toString().padStart(2, '0');

  const d = date.getDate().toString().padStart(2, '0');

  const h = date.getHours().toString().padStart(2, '0');

  const min = date.getMinutes().toString().padStart(2, '0');

  return `CLRQ-${y}${m}${d}${h}${min}`;

}