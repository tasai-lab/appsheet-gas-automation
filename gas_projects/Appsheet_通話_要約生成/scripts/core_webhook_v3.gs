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

 * Webhook受信処理（新ライブラリ対応版）

 * AppSheetからのWebhookを受け取り、通話音声ファイルをVertex AIで処理する

 * 

 * @author Fractal Group

 * @version 3.0.0 - 統一重複防止ライブラリ適用

 * @date 2025-10-16

 * 

 * 変更点:

 * - executeWebhookWithDuplicationPreventionを使用

 * - より強固な重複防止（フィンガープリント + ロック）

 * - エラーハンドリング強化

 */



/**

 * WebアプリのPOSTリクエストエントリーポイント

 * 

 * 重複リクエスト対策（v3.0の機能）:

 * - レコードIDベースの重複チェック

 * - Webhookフィンガープリント検証

 * - LockService による排他制御

 * - 自動エラーハンドリング

 */

function doPost(e) {

  return executeWebhookWithDuplicationPrevention(e, processCallSummary, {

    recordIdField: 'callId',

    enableFingerprint: true,

    metadata: { 

      processor: 'vertex_ai',

      version: '3.0.0' 

    }

  });

}



/**

 * 通話要約の実処理

 * executeWebhookWithDuplicationPreventionから呼び出される

 * 

 * @param {Object} params - Webhookパラメータ

 * @return {Object} 処理結果

 */

function processCallSummary(params) {

  const config = getConfig();

  const callId = params.callId;

  

  Logger.log(`[処理開始] 通話ID: ${callId}`);

  

  // パラメータ検証

  validateRequiredParams(params);

  

  // file_pathからファイルIDとURLを取得

  let fileId, fileUrl;

  if (params.filePath) {

    Logger.log(`[ファイル解決] ファイルパス: ${params.filePath}`);

    const fileInfo = getFileIdFromPath(params.filePath, config.sharedDriveFolderId);

    fileId = fileInfo.fileId;

    fileUrl = fileInfo.fileUrl;

    Logger.log(`[ファイル解決] ファイルID: ${fileId}`);

  } else if (params.fileId) {

    fileId = params.fileId;

    const file = DriveApp.getFileById(fileId);

    fileUrl = file.getUrl();

    Logger.log(`[ファイル解決] 直接指定 - ファイルID: ${fileId}`);

  } else {

    throw new Error('filePath または fileId が必要です');

  }



  // Vertex AIで音声解析

  const analysisResult = analyzeAudioWithVertexAI(

    fileId,

    params.callDatetime,

    params.callContextText,

    params.userInfoText,

    config

  );



  // 結果の検証

  validateAnalysisResult(analysisResult);

  

  // ファイル情報を結果に追加

  analysisResult.recording_file_id = fileId;

  analysisResult.recording_file_url = fileUrl;



  // AppSheet更新

  updateCallLog(

    callId, 

    analysisResult.transcript, 

    analysisResult.summary,

    analysisResult.recording_file_id,

    analysisResult.recording_file_url,

    config

  );



  // アクション追加

  if (analysisResult.actions.length > 0) {

    addCallActions(callId, params.clientId, analysisResult.actions, config);

  }



  Logger.log(`[処理完了] 通話ID: ${callId}`);

  

  // 成功通知

  sendSuccessNotification(callId, analysisResult.summary, config);



  // 処理結果を返す（自動的に完了マークされる）

  return {

    success: true,

    callId: callId,

    recording_file_id: fileId,

    recording_file_url: fileUrl,

    summary_length: analysisResult.summary.length,

    actions_count: analysisResult.actions.length

  };

}



/**

 * 必須パラメータの検証

 */

function validateRequiredParams(params) {

  const requiredFields = ['callId', 'callDatetime'];

  const missingFields = requiredFields.filter(key => !params[key]);

  

  if (missingFields.length > 0) {

    throw new Error(`必須パラメータが不足: ${missingFields.join(', ')}`);

  }

  

  // filePath または fileId のいずれかが必要

  if (!params.filePath && !params.fileId) {

    throw new Error('filePath または fileId が必要です');

  }

}



/**

 * 解析結果の検証

 */

function validateAnalysisResult(result) {

  if (typeof result !== 'object' || result === null) {

    throw new Error('解析結果が不正です');

  }

  

  if (!result.summary || !result.transcript || !Array.isArray(result.actions)) {

    throw new Error('解析結果に必須キー (summary, transcript, actions) が不足しています');

  }

}



// ======================================================

// 以下、旧版の関数（後方互換性のため残す）

// 新規プロジェクトでは使用しないでください

// ======================================================



/**

 * @deprecated v3.0でexecuteWebhookWithDuplicationPreventionに統合

 */

function parseRequest(e) {

  try {

    return JSON.parse(e.postData.contents);

  } catch (error) {

    throw new Error(`リクエストの解析に失敗: ${error.message}`);

  }

}



/**

 * @deprecated v3.0でcheckDuplicateRequestに統合

 */

function isDuplicateRequest(callId) {

  const dupCheck = checkDuplicateRequest(callId);

  return dupCheck.isDuplicate;

}



/**

 * @deprecated v3.0でmarkAsProcessingWithLockに統合

 */

function markAsProcessing(callId) {

  return markAsProcessingWithLock(callId);

}



/**

 * @deprecated v3.0で自動処理に統合

 */

function createSuccessResponse(callId, fileId, fileUrl) {

  return ContentService.createTextOutput(JSON.stringify({

    status: 'success',

    callId: callId,

    recording_file_id: fileId,

    recording_file_url: fileUrl,

    timestamp: new Date().toISOString()

  })).setMimeType(ContentService.MimeType.JSON);

}



/**

 * @deprecated v3.0でcreateErrorResponseに統合

 */

function createErrorResponse_old(callId, error) {

  return ContentService.createTextOutput(JSON.stringify({

    status: 'error',

    callId: callId,

    error: error.toString(),

    timestamp: new Date().toISOString()

  })).setMimeType(ContentService.MimeType.JSON);

}



/**

 * @deprecated v3.0でcreateDuplicateResponseに統合

 */

function createDuplicateResponse_old(callId) {

  return ContentService.createTextOutput(JSON.stringify({

    status: 'duplicate',

    callId: callId,

    message: '処理中または処理済みです',

    timestamp: new Date().toISOString()

  })).setMimeType(ContentService.MimeType.JSON);

}

