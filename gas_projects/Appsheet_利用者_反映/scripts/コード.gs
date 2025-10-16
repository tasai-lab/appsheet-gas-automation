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

// ▼ 依頼情報アプリの情報

const REQUESTS_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8'; 

const REQUESTS_APP_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';



// ▼ 利用者情報アプリの情報 (もし同じなら、上記と同じID/KEYを設定)

const CLIENTS_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8'; 

const CLIENTS_APP_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';



// Gemini APIキー

const GEMINI_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY'; 



// テーブル名

const REQUESTS_TABLE_NAME = 'Client_Requests';

const CLIENTS_TABLE_NAME = 'Clients';

const DOCUMENTS_TABLE_NAME = 'Client_Documents';



/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 */

function doPost(e) {

  const params = JSON.parse(e.postData.contents);

  const requestId = params.requestId;



  try {

    const { clientInfoTemp, requestReason, documentFileId, staffId } = params;

    if (!requestId || !clientInfoTemp || !staffId) {

      throw new Error("必須パラメータ（requestId, clientInfoTemp, staffId）が不足しています。");

    }

    console.log(`処理開始: Request ID = ${requestId}`);



    // 1. 新しいClientIDをAppSheetから取得して採番

    const newClientId = getNewClientId();

    console.log(`新しいClientIDを採番しました: ${newClientId}`);



    // 2. AIで依頼情報から利用者情報を抽出

    const extractedInfo = extractClientInfoWithGemini(clientInfoTemp, requestReason, documentFileId);

    if (!extractedInfo) throw new Error("AIからの応答が不正でした。");



    // 3. Clientsテーブルに新しい利用者を作成

    createClientInAppSheet(newClientId, extractedInfo, params); // ★ paramsを丸ごと渡すように修正

    

    // 4. 元の依頼ステータスを「反映済み」に更新

    updateRequestStatus(requestId, "反映済み", null);



    console.log(`処理完了。新しい利用者ID ${newClientId} を作成しました。`);



  } catch (error) {

    console.log(`エラーが発生しました: ${error.toString()}`);

    if (requestId) {

      updateRequestStatus(requestId, "エラー", error.toString());

    }

  }

}



/**

 * AppSheet APIに問い合わせて、新しいClientIDを採番する

 */

function getNewClientId() {

  const findPayload = {

    Action: "Find",

    Properties: { "Locale": "ja-JP" },

  };

  const responseText = callAppSheetApi(CLIENTS_APP_ID, CLIENTS_APP_ACCESS_KEY, CLIENTS_TABLE_NAME, findPayload);

  const rows = JSON.parse(responseText);

  const newCount = rows.length + 1;

  const newIdNumber = "00000".substring(0, 5 - String(newCount).length) + newCount;

  return `CL-${newIdNumber}`;

}



/**

 * Gemini APIを呼び出し、依頼情報から利用者情報を抽出する

 */

function extractClientInfoWithGemini(clientInfoTemp, requestReason, fileId) {

  // ★★★ 新しいデータ項目とルールに合わせてプロンプトを全面改訂 ★★★

  const prompt = `

# あなたの役割

あなたは、訪問看護ステーションの優秀な医療事務スタッフです。以下の#依頼情報と#添付資料（もしあれば）を精査し、新しい利用者（クライアント）の基本情報を日本の公的書類の形式に準拠して、極めて正確に抽出してください。



# 依頼情報

## 依頼理由

${requestReason || '記載なし'}



## 利用者に関するメモ

${clientInfoTemp}



# 抽出ルールと出力形式

- 全ての情報を元に、以下のJSONオブジェクトのキーに対応する値を抽出・推測してください。

- 該当する情報がない場合は、値にnullを設定してください。

- JSON以外の説明文は一切含めないでください。



{

  "last_name": "姓",

  "first_name": "名",

  "last_name_kana": "セイ（カタカナ）",

  "first_name_kana": "メイ（カタカナ）",

  "gender": "性別（「男性」「女性」「その他」のいずれか）",

  "birth_date": "生年月日を西暦のYYYY/MM/DD形式で抽出。例えば「昭和6年2月1日」は「1931/02/01」と変換。",

  "birth_date_nengo": "生年月日の年号を「大正」「昭和」「平成」「令和」のいずれかで抽出。",

  "birth_date_nengo_year": "生年月日の年号の年数を数値で抽出。例えば「昭和6年」なら 6。",

  "is_welfare_recipient": "生活保護を受給している事実があれば true, なければ false のブール値。",

  "care_level_name": "要介護度を抽出。必ず「要支援１」「要介護５」のように数字を全角にしてください。",

  "phone1": "可能な限り利用者本人の電話番号を抽出。",

  "phone1_destination": "phone1の電話番号の持ち主（例：「本人」「自宅」「妻」「長男」）",

  "phone2": "本人以外の緊急連絡先など、2つ目の電話番号を抽出。",

  "phone2_destination": "phone2の電話番号の持ち主（例：「長女」「キーパーソン」）",

  "special_notes": "特記事項（ADL、アレルギー、キーパーソン、その他注意点など）を要約"

}

`;

  const textPart = { text: prompt };

  const parts = [textPart];



  if (fileId) {

    const file = DriveApp.getFileById(fileId);

    const fileBlob = file.getBlob();

    parts.push({ inlineData: { mimeType: fileBlob.getContentType(), data: Utilities.base64Encode(fileBlob.getBytes()) } });

  }



  const model = 'gemini-2.5-pro';

  const generationConfig = { "responseMimeType": "application/json", "temperature": 0.1 };

  const requestBody = { contents: [{ parts: parts }], generationConfig: generationConfig };

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



/**

 * AppSheetのClientsテーブルに新しい行を作成する

 */

function createClientInAppSheet(clientId, extractedInfo, params) {

  const rowData = {

    "client_id": clientId,

    "status": "サービス提供中", // デフォルトステータス

    "request_id": params.requestId, // ★ 元の依頼IDを紐付け

    "provider_office": params.providerOffice, // ★ 担当事業所を紐付け

    "last_name": extractedInfo.last_name,

    "first_name": extractedInfo.first_name,

    "last_name_kana": extractedInfo.last_name_kana,

    "first_name_kana": extractedInfo.first_name_kana,

    "gender": extractedInfo.gender,

    "birth_date": extractedInfo.birth_date,

    "birth_date_nengo": extractedInfo.birth_date_nengo,

    "birth_date_nengo_year": extractedInfo.birth_date_nengo_year,

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

  const payload = { Action: "Add", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(CLIENTS_APP_ID, CLIENTS_APP_ACCESS_KEY, CLIENTS_TABLE_NAME, payload);

}



/**

 * 元の依頼レコードのステータスを更新する

 */

function updateRequestStatus(requestId, status, errorMessage) {

  const rowData = { "request_id": requestId, "status": status };

  if (errorMessage) {

    // Client_Requestsテーブルにerror_details列があれば、そこに書き込まれる

    rowData.error_details = `GAS Script Error: ${errorMessage}`;

  }

  const payload = { Action: "Edit", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(REQUESTS_APP_ID, REQUESTS_APP_ACCESS_KEY, REQUESTS_TABLE_NAME, payload);

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

  const responseText = response.getContentText();

  Logger.log(`AppSheet API (${tableName}) 応答: ${response.getResponseCode()} - ${responseText}`);

  if (response.getResponseCode() >= 400) {

    throw new Error(`AppSheet API Error (${tableName}): ${response.getResponseCode()} - ${responseText}`);

  }

  return responseText; // FindアクションのためにresponseTextを返す

}



/**

 * AppSheetのClientsテーブルに新しい行を作成する

 * @param {string} clientId - 新しく採番された利用者ID

 * @param {object} extractedInfo - AIが抽出した利用者情報

 * @param {object} params - Webhookで受け取った元のパラメータ

 */

function createClientInAppSheet(clientId, extractedInfo, params) {



  // ★★★ 年齢を計算するヘルパー関数 ★★★

  function calculateAge(birthDateString) {

    // birthDateString が null または空文字列の場合は null を返す

    if (!birthDateString) return null;

    

    const today = new Date();

    const birthDate = new Date(birthDateString);

    

    // 日付として無効な場合は null を返す

    if (isNaN(birthDate.getTime())) return null;



    let age = today.getFullYear() - birthDate.getFullYear();

    const m = today.getMonth() - birthDate.getMonth();

    

    // 今年の誕生日がまだ来ていない場合は1歳引く

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {

        age--;

    }

    return age;

  }

  // ★★★★★★★★★★★★★★★★★★★★★★



  const rowData = {

    "client_id": clientId,

    "status": "サービス提供中", // デフォルトステータス

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

    "age": calculateAge(extractedInfo.birth_date), // ★★★ 年齢を算出して追加 ★★★

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



  const payload = { Action: "Add", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(CLIENTS_APP_ID, CLIENTS_APP_ACCESS_KEY, CLIENTS_TABLE_NAME, payload);

}