





// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

const SHARED_DRIVE_FOLDER_ID = '1eOzeBli1FcusgKL6MEyhnZQUoDca-RLd';

const DESTINATION_FOLDER_ID = '1c2fguK-hSuF_zgSFkAk9MTgPo1wcboiB'; // ★★★ 移動先のフォルダIDをここに設定 ★★★

const SPREADSHEET_ID = '1ctSjcAlu9VSloPT9S9hsTyTd7yCw5XvNtF7-URyBeKo';

const CONTACTS_SHEET_NAME  = 'Organization_Contacts'; // 例: 'シート1'

const ORGS_SHEET_NAME = 'Organizations'; // AppSheet側の名刺保存フォルダ名

const APP_ID = '27bceb6f-9a2c-4ab6-9438-31fec25a495e';

const ACCESS_KEY = 'V2-A0207-tnP4i-YwteT-Cg55O-7YBvg-zMXQX-sS4Xv-XuaKP';

const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');



const CONTACTS_TABLE_NAME = 'Organization_Contacts';

const BUSINESS_CARD_APPSHEET_FOLDER = '名刺_格納';



/**

 * ★★★ この関数を実行します ★★★

 * @param {string} creatorId - 処理を実行する担当者のAppSheet上のID

 */

function processAllBusinessCards(creatorId = 'SYSTEM') {

  const now = new Date();

  const currentHour = now.getHours();

  const currentMinute = now.getMinutes();

  if (currentHour >= 21 || currentHour < 9 || (currentHour === 9 && currentMinute < 30)) {

    console.log(`実行時間外です（現在時刻: ${currentHour}:${currentMinute}）。処理をスキップします。`);

    return;

  }



  if (!creatorId) { console.error("実行者のIDが指定されていません。"); return; }

  console.log(`処理開始。実行者ID: ${creatorId}`);



  try {

    const sourceFolder = DriveApp.getFolderById(SHARED_DRIVE_FOLDER_ID);

    const destinationFolder = DriveApp.getFolderById(DESTINATION_FOLDER_ID);

    const files = sourceFolder.getFiles();

    const pairedCards = pairBusinessCards(files);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);



    for (const card of pairedCards) {

      console.log(`\n--- 処理中のファイル: ${card.front.getName()} ---`);

      try {

        const extractedInfo = extractInfoWithGemini(card.front, card.back);

        if (!extractedInfo || !extractedInfo.last_name || !extractedInfo.first_name) {

          throw new Error("AIが氏名を抽出できませんでした。");

        }



        const lastNameKana = extractedInfo.last_name_kana || '';

        const firstNameKana = extractedInfo.first_name_kana || '';

        

        const checkResult = findContactAction(ss, extractedInfo);

        

        let action = checkResult.action;

        let existingContactId = checkResult.contactId;



        if (action === 'CHECK_ORG') {

          console.log(`氏名が一致する既存の連絡先(${existingContactId})を発見。事業所の同一性をAIで確認します。`);

          const isSameOrg = areOrganizationsSame(ss, checkResult.orgId, extractedInfo);

          action = isSameOrg ? 'UPDATE' : 'CREATE';

        }



        switch (action) {

          case 'DELETE':

            console.log(`完全な重複を検出: ${extractedInfo.last_name} ${extractedInfo.first_name}。ファイルを削除します。`);

            deleteFile(card.front.getId());

            if (card.back) deleteFile(card.back.getId());

            break;



          case 'UPDATE':

            console.log(`事業所が同一と判断。既存の連絡先(${existingContactId})を上書き更新します。`);

            const updateFileNameBase = `${extractedInfo.last_name}${extractedInfo.first_name}_${lastNameKana}${firstNameKana}_${existingContactId}`;

            const updateFrontFileName = `${updateFileNameBase}.jpg`;

            const updateBackFileName = card.back ? `${updateFileNameBase}_001.jpg` : null;



            // 1. まずAppSheetを更新

            updateAppSheetContact(existingContactId, extractedInfo, updateFrontFileName, updateBackFileName, creatorId);

            // 2. AppSheetの更新が成功したら、ファイルを移動・リネーム

            card.front.moveTo(destinationFolder).setName(updateFrontFileName);

            if (card.back) card.back.moveTo(destinationFolder).setName(updateBackFileName);

            console.log(`ファイルを移動・リネームしました: ${updateFrontFileName}`);

            break;



          case 'CREATE':

            console.log(`新規連絡先として作成します: ${extractedInfo.last_name} ${extractedInfo.first_name}`);

            const newContactId = generateUniqueContactId(ss);

            const createFileNameBase = `${extractedInfo.last_name}${extractedInfo.first_name}_${lastNameKana}${firstNameKana}_${newContactId}`;

            const createFrontFileName = `${createFileNameBase}.jpg`;

            const createBackFileName = card.back ? `${createFileNameBase}_001.jpg` : null;

            

            // 1. まずAppSheetに登録

            createAppSheetContact(newContactId, extractedInfo, createFrontFileName, createBackFileName, creatorId);

            // 2. AppSheetへの登録が成功したら、ファイルを移動・リネーム

            card.front.moveTo(destinationFolder).setName(createFrontFileName);

            if (card.back) card.back.moveTo(destinationFolder).setName(createBackFileName);

            console.log(`ファイルを移動・リネームしました: ${createFrontFileName}`);

            break;

        }

      } catch (e) {

        console.error(`ファイル ${card.front.getName()} の処理中にエラーが発生しました: ${e.message}。このファイルはスキップ（移動しない）されます。`);

      }

    }

  } catch (e) {

    console.error(`メイン処理で致命的なエラー: ${e.message}`);

  }

  console.log("\n全処理が終了しました。");

}



// =================================================================

// 以下、サブ関数群（変更なし、参考として記載）

// =================================================================

function pairBusinessCards(files) {

    const cards = {};

    while (files.hasNext()) {

        const file = files.next();

        const name = file.getName();

        const baseName = name.replace(/_001\.(jpg|jpeg|png)$/i, '');

        if (!cards[baseName]) cards[baseName] = {};

        if (name.includes('_001.')) { cards[baseName].back = file; } else { cards[baseName].front = file; }

    }

    return Object.values(cards).filter(c => c.front);

}

function extractInfoWithGemini(frontFile, backFile) {

  const model = 'gemini-2.5-pro';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const textPrompt = `

# 指示

提供された名刺の画像から、以下の#ルールに従って連絡先情報を抽出し、一つのJSONオブジェクトとしてください。

# 職種と役職のルール

- **職種**: 名刺の記載から、必ず「医師」「看護師」「理学療法士」「作業療法士」「言語聴覚士」「介護支援専門員」「相談員」など、いずれか一つに分類してください。(例: 「院長」→「医師」, 「主任ケアマネージャー」→「介護支援専門員」)

- **役職**: 「主任」「課長」などの役職名が読み取れた場合はそれを記載し、なければ「一般」と記載してください。

- **氏名カナ**: 名刺に氏名の読み仮名が存在した場合にはカタカナで記載してください。また読み仮名が存在しない場合には最も適切な読み仮名を推測し、カタカナで出力してください。

- **特記事項**: 上記の職種分類の過程で失われた元の詳細な職名（例: "退院支援看護師"）や、その他特筆すべき情報をここに記述してください。

# 出力指示

- 以下のキーを持つJSONオブジェクトを生成してください。

- 該当する情報がない場合は、値にnullを設定してください。

- JSON以外の説明文は一切含めないでください。

{

  "last_name": "姓", "first_name": "名", "last_name_kana": "セイ", "first_name_kana": "メイ",

  "job_type": "（ルールに従った職種）", "job_title": "（ルールに従った役職）",

  "phone_number": "個人の直通電話番号や携帯電話番号", "email": "メールアドレス",

  "card_org_name": "事業所名", "card_org_postal_code": "郵便番号（XXX-XXXX形式）",

  "card_org_address": "所在地", "card_org_phone": "事業所の代表電話番号",

  "card_org_fax": "FAX番号", "card_org_website": "ウェブサイトURL",

  "special_notes": "（ルールに従った特記事項）"

}

`;

  const imageParts = [{ inlineData: { mimeType: 'image/jpeg', data: Utilities.base64Encode(frontFile.getBlob().getBytes()) } }];

  if (backFile) { imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: Utilities.base64Encode(backFile.getBlob().getBytes()) } }); }

  const requestBody = { contents: [{ parts: [{ text: textPrompt }, ...imageParts] }], generationConfig: { "responseMimeType": "application/json", "temperature": 0.1 } };

  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(requestBody), muteHttpExceptions: true };

  const response = UrlFetchApp.fetch(url, options);

  const responseText = response.getContentText();

  const jsonResponse = JSON.parse(responseText);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) { throw new Error("AIからの応答に有効な候補が含まれていません: " + responseText); }

  let content = jsonResponse.candidates[0].content.parts[0].text;

  const startIndex = content.indexOf('{');

  const endIndex = content.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1) throw new Error("AIの応答からJSONを抽出できませんでした。");

  return JSON.parse(content.substring(startIndex, endIndex + 1));

}



function findContactAction(ss, newInfo) {

  const sheet = ss.getSheetByName(CONTACTS_SHEET_NAME);

  const data = sheet.getDataRange().getValues();

  const headers = data[0];

  const col = (name) => headers.indexOf(name);

  const idx = { contactId: col('contact_id'), orgId: col('org_id'), lastName: col('last_name'), firstName: col('first_name'), lastNameKana: col('last_name_kana'), firstNameKana: col('first_name_kana'), postalCode: col('card_org_postal_code'), phone: col('card_org_phone'), cardFront: col('business_card_front') };

  for (let i = 1; i < data.length; i++) {

    const row = data[i];

    if (row[idx.lastName] == newInfo.last_name && row[idx.firstName] == newInfo.first_name && row[idx.postalCode] == newInfo.card_org_postal_code && row[idx.phone] == newInfo.card_org_phone) { return { action: 'DELETE' }; }

  }

  for (let i = 1; i < data.length; i++) {

    const row = data[i];

    if (row[idx.lastName] == newInfo.last_name && row[idx.firstName] == newInfo.first_name && row[idx.lastNameKana] == newInfo.last_name_kana && row[idx.firstNameKana] == newInfo.first_name_kana && !row[idx.cardFront]) { return { action: 'CHECK_ORG', contactId: row[idx.contactId], orgId: row[idx.orgId] }; }

  }

  return { action: 'CREATE' };

}



function areOrganizationsSame(ss, existingOrgId, newCardInfo) {

  try {

    const orgSheet = ss.getSheetByName(ORGS_SHEET_NAME);

    if (!orgSheet) { console.log(`警告: シート「${ORGS_SHEET_NAME}」が見つかりません。事業所が異なると判断します。`); return false; }

    const orgData = orgSheet.getDataRange().getValues();

    const orgHeaders = orgData[0];

    const orgIdIndex = orgHeaders.indexOf('org_id');

    const orgAddressIndex = orgHeaders.indexOf('address');

    const orgNameIndex = orgHeaders.indexOf('common_name');

    if (orgIdIndex === -1 || orgAddressIndex === -1 || orgNameIndex === -1) { console.log("警告: Organizationsシートに必要な列（org_id, address, common_name）が見つかりません。事業所が異なると判断します。"); return false; }

    let existingOrgAddress = ''; let existingOrgName = '';

    for (let i = 1; i < orgData.length; i++) { if (orgData[i][orgIdIndex] == existingOrgId) { existingOrgName = orgData[i][orgNameIndex]; existingOrgAddress = orgData[i][orgAddressIndex]; break; } }

    if (!existingOrgAddress || !existingOrgName) { console.log(`警告: 既存のorg_id「${existingOrgId}」に対応する情報が見つかりません。事業所が異なると判断します。`); return false; }

    const prompt = `

# 指示

以下の2つの事業所情報は、実質的に同じ事業所を指していますか？表記の揺れや住所のわずかな違いは許容してください。回答は必ず true または false のブール値のみで、JSON形式ではなくプレーンテキストで返してください。

# 比較対象

- **事業所1（既存データ）**: ${existingOrgName} ${existingOrgAddress}

- **事業所2（今回の名刺データ）**: ${newCardInfo.card_org_name} ${newCardInfo.card_org_address}

`;

    const model = 'gemini-2.5-flash';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { "temperature": 0.0 } };

    const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(requestBody), muteHttpExceptions: true };

    console.log("AIによる事業所判定を実行します...");

    const response = UrlFetchApp.fetch(url, options);

    const responseText = response.getContentText();

    const jsonResponse = JSON.parse(responseText);

    if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) { throw new Error("AIからの応答に有効な候補が含まれていません: " + responseText); }

    const aiAnswer = jsonResponse.candidates[0].content.parts[0].text.trim().toLowerCase();

    console.log(`AIの判定結果: ${aiAnswer}`);

    return (aiAnswer === 'true');

  } catch (e) {

    console.error(`事業所の同一性判定中にエラーが発生: ${e.message}。安全のため、事業所は異なると判断します。`);

    return false;

  }

}



function generateUniqueContactId(ss) {

  const sheet = ss.getSheetByName(CONTACTS_SHEET_NAME);

  const contactIdColumn = sheet.getRange("A:A").getValues().flat();

  let newId; let isUnique = false;

  while (!isUnique) { newId = 'ORGC-' + Utilities.getUuid().substring(0, 8); if (!contactIdColumn.includes(newId)) { isUnique = true; } }

  return newId;

}



/**

 * AppSheetに連絡先を新規作成する

 */

function createAppSheetContact(contactId, info, frontFileName, backFileName) {

    const payload = buildAppSheetPayload(contactId, info, frontFileName, backFileName);

    payload.Action = "Add";

    // created_byは不要になったので削除

    callAppSheetApi(payload);

}



function updateAppSheetContact(contactId, info, frontFile, backFile, creatorId) {

    const payload = buildAppSheetPayload(contactId, info, frontFile, backFile);

    payload.Action = "Edit";

    payload.Rows[0].updated_by = creatorId;

    payload.Rows[0].updated_at = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

    callAppSheetApi(payload);

}



/**

 * AppSheet APIのペイロードを構築する共通関数

 */

function buildAppSheetPayload(contactId, info, frontFileName, backFileName) {

  const rowData = {

    "contact_id": contactId, "status": "在職",

    "last_name": info.last_name, "first_name": info.first_name,

    "last_name_kana": info.last_name_kana, "first_name_kana": info.first_name_kana,

    "job_type": info.job_type, "job_title": info.job_title,

    "phone_number": info.phone_number, "email": info.email,

    "business_card_front": `${BUSINESS_CARD_APPSHEET_FOLDER}/${frontFileName}`,

    "business_card_back": backFileName ? `${BUSINESS_CARD_APPSHEET_FOLDER}/${backFileName}` : "",

    "card_org_name": info.card_org_name, "card_org_postal_code": info.card_org_postal_code,

    "card_org_address": info.card_org_address, "card_org_phone": info.card_org_phone,

    "card_org_fax": info.card_org_fax, "card_org_website": info.card_org_website,

    "special_notes": info.special_notes

  };

  return { Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: [rowData] };

}



function callAppSheetApi(payload) {

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${CONTACTS_TABLE_NAME}/Action`;

  const options = { method: 'post', contentType: 'application/json', headers: { 'ApplicationAccessKey': ACCESS_KEY }, payload: JSON.stringify(payload), muteHttpExceptions: true };

  const response = UrlFetchApp.fetch(apiUrl, options);

  if (response.getResponseCode() >= 400) { throw new Error(`AppSheet API Error: ${response.getContentText()}`); }

}



function deleteFile(fileId) { Drive.Files.remove(fileId); }