





/**

 * =====================================================================================

 * AppSheet-Gemini-GAS 連携スクリプト (完全版)

 *

 * AppSheetのWebhookをトリガーに、OCRテキストをGemini APIで解析し、

 * - Clientsテーブルの既存情報を更新

 * - Client_Family_Membersテーブルに新しい家族情報を追加 (family_member_id自動生成)

 * - 処理の同時実行をロック機能で防止

 * - 最終的な処理結果を元のドキュメントのステータスに反映

 * =====================================================================================

 */

  // === 1. ロックの取得と基本設定 =======================================

  const GEMINI_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY';

  const APPSHEET_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';

  const APPSHEET_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';

  const ERROR_NOTIFICATION_EMAIL = "t.asai@fractal-group.co.jp"; // ★ エラー通知先のメールアドレス

  const EXCLUDED_CLIENT_COLUMNS = [

    'status', 'date_of_death', 'initial_visit_date', 'contract_office','full_name','full_name_kana',

    'provider_office', 'insurance_type', 'is_welfare_recipient',

    'mhlw_annex7_disease', 'independence_level', 'billing_code', 'address_label','address_id','clinic_id','doctor_id','support_office_id','care_manager_id','service_type','main_staff','sub_staff'

  ];



// テーブル名

const CLIENTS_TABLE_NAME = 'Clients';

const FAMILY_TABLE_NAME = 'Client_Family_Members';

const DOCUMENTS_TABLE_NAME = 'Client_Documents';





/**

 * AppSheet WebhookからのPOSTリクエストを処理するメイン関数

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_利用者_基本情報上書き';
    return processRequest(params);
  });
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  const documentId = params.documentId;



  try {

    const { clientId, ocrText } = params;

    if (!documentId || !clientId || !ocrText) {

      throw new Error('必須パラメータ（documentId, clientId, ocrText）が不足しています。');

    }

    console.log(`利用者情報更新処理を開始: DocumentID=${documentId}, ClientID=${clientId}`);



    const extractedData = extractInfoWithGemini(ocrText);

    if (!extractedData) throw new Error("AIからの応答が不正でした。");



    const clientInfo = { ...extractedData };

    delete clientInfo.family_members;

    updateClientData(clientId, clientInfo);



    if (extractedData.family_members && extractedData.family_members.length > 0) {

      processFamilyMembers(clientId, extractedData.family_members);

    }

    

    updateDocumentStatus(documentId, "登録済", null);

    console.log("全ての処理が正常に完了しました。");



  } catch (error) {

    console.error(`エラーが発生しました: ${error.toString()}`);

    if (documentId) {

      updateDocumentStatus(documentId, "エラー", error.toString());

      // ★★★ エラーメールを送信 ★★★

      sendErrorEmail(documentId, error.toString());

    }

  }
}


/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  // TODO: テストデータを設定してください
  const testParams = {
    // 例: action: "test",
    // 例: data: "sample"
  };

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_利用者_基本情報上書き');
}




/**

 * ★★★ 新しい関数 ★★★

 * 処理失敗時にメールでエラー内容を通知する

 */

function sendErrorEmail(documentId, errorMessage) {

  const subject = `[要確認] GAS処理エラー: 基本情報自動更新 (Document ID: ${documentId})`;

  const body = `AppSheetの基本情報自動更新処理でエラーが発生しました。\n\n■ 対象ドキュメントID\n${documentId}\n\n■ エラー内容\n${errorMessage}\n\nGASのログをご確認ください。`;

  try {

    // Email removed - using execution log instead

    console.log(`エラー通知メールを ${ERROR_NOTIFICATION_EMAIL} へ送信しました。`);

  } catch(e) {

    console.error(`エラー通知メールの送信に失敗しました: ${e.toString()}`);

  }

}





// =================================================================

// 以下のヘルパー関数群に変更はありません

// =================================================================



function processFamilyMembers(clientId, extractedMembers) {

  const findPayload = { Action: "Find", Properties: { "Locale": "ja-JP" }, Selector: `FILTER(Client_Family_Members, [client_id] = "${clientId}")` };

  const existingMembersText = callAppSheetApi(FAMILY_TABLE_NAME, findPayload);

  const existingMembers = JSON.parse(existingMembersText);

  const rowsToAdd = [];

  const rowsToUpdate = [];

  for (const extractedMember of extractedMembers) {

    const existingMember = existingMembers.find(em => em.last_name === extractedMember.last_name && em.first_name === extractedMember.first_name);

    if (existingMember) {

      const updatePayload = { "family_member_id": existingMember.family_member_id };

      let needsUpdate = false;

      for (const key in extractedMember) {

        if (!existingMember[key] && extractedMember[key]) {

          updatePayload[key] = extractedMember[key];

          needsUpdate = true;

        }

      }

      if (needsUpdate) rowsToUpdate.push(updatePayload);

    } else {

      extractedMember.family_member_id = `CLFM-${Utilities.getUuid().substring(0, 8)}`;

      extractedMember.client_id = clientId;

      rowsToAdd.push(extractedMember);

    }

  }

  if (rowsToAdd.length > 0) {

    console.log(`${rowsToAdd.length}件の新しい家族情報を追加します。`);

    const addPayload = { Action: 'Add', Properties: { "Locale": "ja-JP" }, Rows: rowsToAdd };

    callAppSheetApi(FAMILY_TABLE_NAME, addPayload);

  }

  if (rowsToUpdate.length > 0) {

    console.log(`${rowsToUpdate.length}件の既存の家族情報を更新（補完）します。`);

    const updatePayload = { Action: 'Edit', Properties: { "Locale": "ja-JP" }, Rows: rowsToUpdate };

    callAppSheetApi(FAMILY_TABLE_NAME, updatePayload);

  }

}



/**

 * Gemini APIを呼び出し、OCRテキストから情報を抽出する

 */

function extractInfoWithGemini(ocrText) {

  const prompt = `

あなたは医療・介護サービスの事務スタッフです。以下のOCRテキストから、利用者様の情報と、そのご家族の情報を抽出してください。

結果は必ず指定されたキーを持つJSON形式のみで出力してください。余計な説明や\`\`\`jsonマーカーは不要です。

氏名のフリガナ（last_name_kana, first_name_kana）は、必ず**カタカナ**で出力してください。

情報が見つからない項目の値は null にしてください。日付は必ず "YYYY-MM-DD" 形式にしてください。

**今日（${new Date().toLocaleDateString('ja-JP')}）の時点での満年齢を計算して "age" に含めてください。**

家族情報が見つからない場合は、"family_members"には空の配列 [] を設定してください。



【抽出対象のキーとOCRテキスト】

{

  "end_of_visit_date": "（訪問終了日）",

  "care_level_name": "（要介護度・要支援度 例:要介護１ 数字は全角数字にすること）",

  "last_name": "（利用者の姓）",

  "first_name": "（利用者の名）",

  "last_name_kana": "（利用者の姓のカタカナ）",

  "first_name_kana": "（利用者の名のカタカナ）",

  "gender": "（性別 男性か女性か）",

  "birth_date": "（生年月日、西暦）",

  "birth_date_nengo": "（生年月日の元号 例:昭和）",

  "birth_date_nengo_year": "（生年月日の元号の年 例:45）",

  "age": "（今日時点の満年齢 例:80）",

  "phone1": "（主な電話番号）",

  "phone1_destination": "（電話番号1の宛先 例:自宅,携帯）",

  "phone2": "（その他の電話番号）",

  "phone2_destination": "（電話番号2の宛先 例:キーパーソン）",

  "email": "（連絡用メールアドレス）",

  "primary_contact_person": "（主要連絡者の氏名）",

  "special_notes": "（特記事項やアレルギーなど、ケアで最優先で確認すべき重要事項）",



  "family_members": [

    {

      "relationship": "（続柄 例:妻,長男）",

      "last_name": "（家族の姓）",

      "first_name": "（家族の名）",

      "is_cohabiting": "（同居の有無を「同居」または「別居」で回答）",

      "phone1": "（家族の電話番号）",

      "is_key_person": "（キーパーソンかを Y/N で回答）"

    }

  ]

}



【基本情報のテキスト】

${ocrText}

`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

  const payload = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { "responseMimeType": "application/json", "temperature": 0.1 } };

  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };

  

  const response = UrlFetchApp.fetch(url, options);

  const responseText = response.getContentText();

  if (response.getResponseCode() !== 200) throw new Error(`Gemini APIエラー: ${responseText}`);

  

  const jsonResponse = JSON.parse(responseText);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {

    throw new Error("AIからの応答に有効な候補が含まれていません: " + responseText);

  }

  let content = jsonResponse.candidates[0].content.parts[0].text;

  

  const startIndex = content.indexOf('{');

  const endIndex = content.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1) throw new Error("AIの応答からJSONを抽出できませんでした。");

  

  return JSON.parse(content.substring(startIndex, endIndex + 1));

}



function updateClientData(clientId, clientInfo) {

  if (clientInfo.care_level_name) {

    clientInfo.care_level_name = clientInfo.care_level_name.replace(/[0-9]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));

  }

  EXCLUDED_CLIENT_COLUMNS.forEach(key => delete clientInfo[key]);

  clientInfo.client_id = clientId;

  Object.keys(clientInfo).forEach(key => (clientInfo[key] == null) && delete clientInfo[key]);

  if (Object.keys(clientInfo).length > 1) {

    const payload = { Action: 'Edit', Properties: { "Locale": "ja-JP" }, Rows: [clientInfo] };

    callAppSheetApi(CLIENTS_TABLE_NAME, payload);

    console.log('Clientsテーブルの更新に成功。');

  } else {

    console.log('Clientsテーブルで更新すべきデータがありませんでした。');

  }

}



function updateDocumentStatus(documentId, status, errorMessage) {

  const rowData = { "document_id": documentId, "status": status };

  if (errorMessage) {

    rowData.error_details = `GAS Script Error: ${errorMessage}`;

  }

  const payload = { Action: 'Edit', Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(DOCUMENTS_TABLE_NAME, payload);

  console.log(`Document ID ${documentId} のステータスを「${status}」に更新しました。`);

}



function callAppSheetApi(tableName, payload) {

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APPSHEET_APP_ID}/tables/${tableName}/Action`;

  const options = {

    method: 'post', contentType: 'application/json',

    headers: { 'ApplicationAccessKey': APPSHEET_ACCESS_KEY },

    payload: JSON.stringify(payload), muteHttpExceptions: true

  };

  const response = UrlFetchApp.fetch(apiUrl, options);

  const responseCode = response.getResponseCode();

  const responseBody = response.getContentText();

  if (responseCode >= 400) {

    throw new Error(`AppSheet API (${tableName}) エラー (${responseCode}): ${responseBody}`);

  }

  return responseBody;

}