// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

// ▼ 依頼情報アプリの情報

const REQUESTS_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8'; 

const REQUESTS_APP_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';

// ▼ 利用者情報アプリの情報 (もし同じなら、上記と同じID/KEYを設定)

const CLIENTS_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8'; 

const CLIENTS_APP_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';

// ★★★ Google AI Studio APIキー削除済み ★★★
// 修正日: 2025-10-18
// 理由: ユーザー指示「今後gemini apiを使用することが無いようにお願いします。今後、全てvertex apiを使用すること。」
// Vertex AI（OAuth2認証）を使用するため、APIキー不要
// const GEMINI_API_KEY = '';  // ★削除済み 

// テーブル名

const REQUESTS_TABLE_NAME = 'Client_Requests';

const CLIENTS_TABLE_NAME = 'Clients';

const DOCUMENTS_TABLE_NAME = 'Client_Documents';

// --- Vertex AI設定 ---
const GCP_PROJECT_ID = 'macro-shadow-458705-v8';
const GCP_LOCATION = 'us-central1';
const VERTEX_AI_MODEL = 'gemini-2.5-pro';

/**
 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数
 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_利用者_反映';
    return processRequest(params);
  });
}

/**
 * 直接実行用関数（GASエディタから実行可能）
 * 個別の引数で受け取り、利用者反映処理を実行
 * 
 * @param {string} requestId - 依頼ID（例: "CR-00123"）
 * @param {string} clientInfoTemp - 利用者に関するメモ
 * @param {string} requestReason - 依頼理由
 * @param {string} documentFileId - 添付資料のGoogle Drive ファイルID（オプション）
 * @param {string} staffId - 担当スタッフID（例: "STF-001"）
 * @param {string} providerOffice - 担当事業所名（オプション）
 * @returns {Object} - 処理結果
 */
function processRequestDirect(requestId, clientInfoTemp, requestReason, documentFileId, staffId, providerOffice) {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📋 利用者反映処理 - 直接実行');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log(`Request ID: ${requestId || '未指定'}`);
  Logger.log(`Client Info: ${clientInfoTemp ? clientInfoTemp.substring(0, 100) + '...' : '未指定'}`);
  Logger.log(`Request Reason: ${requestReason || '未指定'}`);
  Logger.log(`Document File ID: ${documentFileId || '未指定'}`);
  Logger.log(`Staff ID: ${staffId || '未指定'}`);
  Logger.log(`Provider Office: ${providerOffice || '未指定'}`);
  Logger.log('');

  const params = {
    requestId: requestId,
    clientInfoTemp: clientInfoTemp,
    requestReason: requestReason,
    documentFileId: documentFileId,
    staffId: staffId,
    providerOffice: providerOffice,
    scriptName: 'Appsheet_利用者_反映'
  };

  try {
    const result = processRequest(params);
    Logger.log('✅ 処理成功');
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    Logger.log('❌ 処理エラー: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * メイン処理関数
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  const requestId = params.requestId;
  const clientInfoTemp = params.clientInfoTemp;
  const requestReason = params.requestReason;
  const documentFileId = params.documentFileId;
  const staffId = params.staffId;
  const providerOffice = params.providerOffice;

  try {
    // 必須パラメータチェック
    if (!requestId || !clientInfoTemp || !staffId) {
      throw new Error("必須パラメータ（requestId, clientInfoTemp, staffId）が不足しています。");
    }

    Logger.log(`処理開始: Request ID = ${requestId}`);

    // 1. 新しいClientIDをAppSheetから取得して採番
    const newClientId = getNewClientId();
    Logger.log(`新しいClientIDを採番しました: ${newClientId}`);

    // 2. AIで依頼情報から利用者情報を抽出
    const extractedInfo = extractClientInfoWithGemini(clientInfoTemp, requestReason, documentFileId);
    if (!extractedInfo) throw new Error("AIからの応答が不正でした。");

    // 3. Clientsテーブルに新しい利用者を作成
    createClientInAppSheet(newClientId, extractedInfo, params);

    // 4. 元の依頼ステータスを「反映済み」に更新
    updateRequestStatus(requestId, "反映済み", null);

    Logger.log(`処理完了。新しい利用者ID ${newClientId} を作成しました。`);
    
    return {
      success: true,
      clientId: newClientId,
      requestId: requestId,
      message: `新しい利用者 ${newClientId} を作成しました`
    };

  } catch (error) {
    Logger.log(`エラーが発生しました: ${error.toString()}`);

    if (requestId) {
      updateRequestStatus(requestId, "エラー", error.toString());
    }

    throw error;
  }
}

/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  // テストデータを設定
  const testParams = {
    requestId: 'CR-TEST001',
    clientInfoTemp: '山田太郎様、昭和30年5月10日生まれ、男性、要介護3、電話: 090-1234-5678（本人）、生活保護受給中',
    requestReason: '新規利用者の登録依頼',
    documentFileId: null, // 添付資料なし
    staffId: 'STF-001',
    providerOffice: 'フラクタル訪問看護ステーション'
  };

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_利用者_反映');
}

/**
 * Direct関数のテスト
 */
function testProcessRequestDirect() {
  return processRequestDirect(
    'CR-TEST002',
    '佐藤花子様、昭和25年3月15日生まれ、女性、要介護2、電話: 03-1234-5678（自宅）、090-9876-5432（長女）',
    '新規契約者の情報登録',
    null, // documentFileId
    'STF-002',
    'フラクタル訪問看護ステーション'
  );
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

  const generationConfig = { 
    responseMimeType: "application/json", 
    temperature: 0.1,
    maxOutputTokens: 8192
  };

  const requestBody = { 
    contents: [{ parts: parts }], 
    generationConfig: generationConfig 
  };

  // Vertex AI APIエンドポイント（OAuth2認証）
  const url = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${VERTEX_AI_MODEL}:generateContent`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${ScriptApp.getOAuthToken()}` },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  Logger.log('[Vertex AI] API呼び出し開始');
  const startTime = new Date().getTime();
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  const endTime = new Date().getTime();
  const responseTime = endTime - startTime;

  Logger.log(`[Vertex AI] API応答: ${responseCode}, 処理時間: ${responseTime}ms`);

  if (responseCode !== 200) {
    Logger.log(`[Vertex AI] エラーレスポンス: ${responseText}`);
    throw new Error(`Vertex AI API Error: ${responseCode} - ${responseText.substring(0, 200)}`);
  }

  const jsonResponse = JSON.parse(responseText);

  // 非ストリーミングAPIの構造: { candidates: [...] }
  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    throw new Error("AIからの応答に有効な候補が含まれていません: " + responseText.substring(0, 200));
  }

  const candidate = jsonResponse.candidates[0];
  
  // finishReasonチェック
  if (candidate.finishReason) {
    Logger.log(`[Vertex AI] finishReason: ${candidate.finishReason}`);
    if (candidate.finishReason === 'MAX_TOKENS') {
      throw new Error('Vertex AIの応答がトークン制限により途中で終了しました。');
    }
  }

  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    throw new Error('Vertex AIからの応答に有効なコンテンツが含まれていません');
  }

  const extractedText = candidate.content.parts[0].text;
  Logger.log(`[Vertex AI] 応答テキスト長: ${extractedText.length}文字`);

  return JSON.parse(extractedText);

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
 * 非推奨: AppSheetConnectorモジュールの使用を推奨
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
