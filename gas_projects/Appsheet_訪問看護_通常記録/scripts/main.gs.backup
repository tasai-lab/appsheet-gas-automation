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


/**

 * main.js - AppSheet Webhook Entry Point

 * Refactored with unified logging and proper error handling

 */ 



/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 */

function doPost(e) {

  const startTime = Date.now();

  const params = JSON.parse(e.postData.contents);

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