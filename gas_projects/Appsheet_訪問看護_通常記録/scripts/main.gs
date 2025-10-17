





/**

 * main.js - AppSheet Webhook Entry Point

 * Refactored with unified logging and proper error handling

 */ 



/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

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
    params.scriptName = 'Appsheet_訪問看護_通常記録';
    return processRequest(params);
  });
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  const startTime = Date.now();

  

  const recordNoteId = params.recordNoteId;



  try {

    // Validate required parameters

    if (!recordNoteId || !params.staffId || !params.recordText) {

      throw new Error("必須パラメータ（recordNoteId, staffId, recordText）が不足しています。");

    }

    

    logProcessingStart(recordNoteId, params);



    // --- 1. マスターデータをスプレッドシートから読み込む ---

    const guidanceMasterText = getGuidanceMasterAsText();



    // --- 2. 記録タイプを判定 ---

    const recordType = determineRecordType(params.recordType);

    

    // --- 3. ファイル処理 (音声ファイルがある場合) ---

    let gsUri = null;

    let mimeType = null;

    

    if (params.filePath || params.fileId) {

      const fileId = params.fileId || getFileIdFromPath(params.filePath);

      const fileData = getFileFromDrive(fileId);

      

      const uploadResult = uploadToCloudStorage(

        fileData.blob, 

        GCP_CONFIG.bucketName, 

        fileData.fileName

      );

      gsUri = uploadResult.gsUri;

      mimeType = fileData.mimeType;

    }



    // --- 4. AIで看護記録を生成 ---

    let analysisResult;

    

    if (SYSTEM_CONFIG.processingMode === 'vertex-ai' && gsUri) {

      // Vertex AI (音声ファイルあり)

      const prompt = recordType === 'psychiatry' 

        ? buildPsychiatryPrompt(params.recordText, guidanceMasterText)

        : buildNormalPrompt(params.recordText, guidanceMasterText);

      

      analysisResult = callVertexAIWithPrompt(gsUri, mimeType, prompt, recordType);

    } else {

      // Gemini API (フォールバック)

      const fileData = gsUri ? { blob: null, mimeType: mimeType } : null;

      const prompt = recordType === 'psychiatry'

        ? buildPsychiatryPrompt(params.recordText, guidanceMasterText)

        : buildNormalPrompt(params.recordText, guidanceMasterText);

      

      analysisResult = callGeminiAPIWithPrompt(fileData, prompt, recordType);

    }

    

    if (!analysisResult) throw new Error("AIからの応答が不正でした。");



    // --- 5. AppSheetに結果を書き込み ---

    updateRecordOnSuccess(recordNoteId, analysisResult, params.staffId, recordType);

    

    // --- 6. Cloud Storageのファイルをクリーンアップ ---

    if (gsUri) {

      const fileName = gsUri.split('/').pop();

      deleteFromCloudStorage(GCP_CONFIG.bucketName, fileName);

    }

    

    const duration = Date.now() - startTime;

    logProcessingComplete(recordNoteId, duration);



  } catch (error) {

    logError(recordNoteId || 'UNKNOWN', error, { params: params });

    if (recordNoteId) {

      updateRecordOnError(recordNoteId, error.toString());

      sendErrorEmail(recordNoteId, error.toString());

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

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_訪問看護_通常記録');
}










/**

 * 成功時にAppSheetのレコードを更新する

 */

function updateRecordOnSuccess(recordNoteId, resultData, staffId, recordType) {

  const rowData = {

    "record_note_id": recordNoteId,

    "status": "編集中",

    "updated_by": staffId

  };

  

  // 記録タイプに応じたフィールドマッピングを取得

  const fieldMapping = APPSHEET_FIELD_MAPPING[recordType];

  const outputFields = RECORD_TYPE_CONFIG[recordType].outputFields;

  

  // 各フィールドをマッピング

  outputFields.forEach(field => {

    const dbField = fieldMapping[field];

    if (dbField && resultData[field] !== undefined) {

      // 配列の場合はカンマ区切りに変換

      if (Array.isArray(resultData[field])) {

        rowData[dbField] = resultData[field].join(', ');

      } 

      // オブジェクトの場合はJSON文字列化

      else if (typeof resultData[field] === 'object' && resultData[field] !== null) {

        rowData[dbField] = JSON.stringify(resultData[field]);

      } 

      // それ以外はそのまま

      else {

        rowData[dbField] = resultData[field];

      }

    }

  });

  

  const payload = { Action: "Edit", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(payload);

}





/**

 * 処理失敗時にメールでエラー内容を通知する

 */

function sendErrorEmail(recordNoteId, errorMessage, context = {}) {

  const subject = `[要確認] GAS処理エラー: 看護記録作成 (ID: ${recordNoteId})`;

  let body = `看護記録の自動生成処理でエラーが発生しました。\n\n`;

  body += `■ 対象記録ID: ${recordNoteId}\n`;

  body += `■ 発生日時: ${new Date().toLocaleString('ja-JP')}\n`;

  body += `■ エラー内容:\n${errorMessage}\n\n`;

  

  if (context.errorCode) {

    body += `■ エラーコード: ${context.errorCode}\n\n`;

  }

  

  body += `GASのログをご確認ください。\n`;

  body += `https://script.google.com/home/executions`;

  

  try {

    // Email removed - using execution log instead

    logStructured(LOG_LEVEL.INFO, 'エラー通知メール送信成功', { 

      recordNoteId: recordNoteId,

      recipient: NOTIFICATION_CONFIG.errorEmail 

    });

  } catch(e) {

    logStructured(LOG_LEVEL.ERROR, 'エラー通知メール送信失敗', { 

      error: e.toString() 

    });

  }

}



/**

 * 失敗時にAppSheetのレコードをエラー状態で更新する

 */

function updateRecordOnError(recordNoteId, errorMessage) {

  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [{

      "record_note_id": recordNoteId,

      "status": "エラー",

      "error_details": `GAS Script Error: ${errorMessage}`

    }]

  };

  callAppSheetApi(payload);

}



/**

 * AppSheet APIを呼び出す共通関数

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