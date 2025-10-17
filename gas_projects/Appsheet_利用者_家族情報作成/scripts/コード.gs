





/**

 * 【家族情報の追加用スクリプト】

 * OCRテキストから家族の情報のみを抽出し、Client_Family_Membersテーブルに新しい行として追加する。

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
    params.scriptName = 'Appsheet_利用者_家族情報作成';
    return processRequest(params);
  });
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  // ▼▼▼ ユーザー設定 ▼▼▼

  const GEMINI_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY';

  const APPSHEET_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';

  const APPSHEET_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';

  // ▲▲▲ ユーザー設定 ▲▲▲



  const getAppSheetApiUrl = (tableName) => `https://api.appsheet.com/api/v2/apps/${APPSHEET_APP_ID}/tables/${tableName}/Action`;

  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;



  let documentId;

  try {

    

    documentId = params.documentId;

    const clientId = params.clientId;

    const ocrText = params.ocrText;

    if (!documentId || !clientId || !ocrText) throw new Error('必須パラメータが不足しています。');

    

    Logger.log(`家族情報追加処理を開始: DocumentID=${documentId}, ClientID=${clientId}`);



    const prompt = `あなたは医療・介護サービスの事務スタッフです。以下のOCRテキストから、ご家族の情報のみを抽出し、配列としてください。利用者本人の情報は含めないでください。結果は必ず指定されたキーを持つJSON形式のみで出力してください。フリガナはカタカナで出力してください。【抽出対象のキー】{"family_members": [{"relationship": "（続柄）","last_name": "（姓）","first_name": "（名。不明な場合は「（不明）」）","last_name_kana": "（姓カナ）","first_name_kana": "（名カナ）","is_cohabiting": "（同居か別居）","living_area": "（在住エリア）","phone1": "（電話番号1）","phone2": "（電話番号2）","email": "（メール）","preferred_contact_method": "（希望連絡手段）","available_contact_time": "（連絡可能時間帯）","wants_email_updates": "（メール配信希望 Y/N）","emergency_contact_priority": "（緊急連絡優先順位）","is_key_person": "（キーパーソン Y/N）","relationship_details": "（関係性詳細）","has_caution_notes": "（注意点有無 Y/N）","caution_notes": "（注意点詳細）"}]}`;

    const geminiPayload = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } };

    const geminiOptions = { method: 'post', contentType: 'application/json', payload: JSON.stringify(geminiPayload), muteHttpExceptions: true };

    const geminiResponse = UrlFetchApp.fetch(GEMINI_API_URL, geminiOptions);

    if (geminiResponse.getResponseCode() !== 200) throw new Error(`Gemini APIエラー: ${geminiResponse.getContentText()}`);

    

    const result = JSON.parse(JSON.parse(geminiResponse.getContentText()).candidates[0].content.parts[0].text);

    

    if (result.family_members && result.family_members.length > 0) {

      const rowsToAdd = result.family_members.map(member => ({

        ...member,

        family_member_id: `AFA-${Utilities.getUuid().substring(0, 8)}`,

        client_id: clientId

      }));

      

      const payload = { Action: 'Add', Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: rowsToAdd };

      const options = { method: 'post', contentType: 'application/json', headers: { ApplicationAccessKey: APPSHEET_ACCESS_KEY }, payload: JSON.stringify(payload), muteHttpExceptions: true };

      const response = UrlFetchApp.fetch(getAppSheetApiUrl('Client_Family_Members'), options);

      if (response.getResponseCode() !== 200) throw new Error(`AppSheet API (Family) エラー: ${response.getContentText()}`);

      Logger.log(`${rowsToAdd.length}件の家族情報を追加しました。`);

    } else {

      Logger.log('追加対象の家族情報は見つかりませんでした。');

    }

    

    const statusPayload = { Action: 'Edit', Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: [{ "document_id": documentId, "status": "家族情報完了" }] };

    const options = { method: 'post', contentType: 'application/json', headers: { ApplicationAccessKey: APPSHEET_ACCESS_KEY }, payload: JSON.stringify(statusPayload), muteHttpExceptions: true };

    UrlFetchApp.fetch(getAppSheetApiUrl('Client_Documents'), options);



  } catch (error) {

    Logger.log('エラーが発生しました: ' + error.toString());

    if (documentId) {

      const payload = { Action: 'Edit', Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: [{ "document_id": documentId, "status": "家族情報エラー" }] };

      const options = { method: 'post', contentType: 'application/json', headers: { ApplicationAccessKey: APPSHEET_ACCESS_KEY }, payload: JSON.stringify(payload), muteHttpExceptions: true };

      UrlFetchApp.fetch(getAppSheetApiUrl('Client_Documents'), options);

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

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_利用者_家族情報作成');
}
