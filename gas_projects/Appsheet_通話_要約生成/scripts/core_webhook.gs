/**

 * Webhook受信処理

 * AppSheetからのWebhookを受け取り、通話音声ファイルをVertex AIで処理する

 * @author Fractal Group

 * @version 2.0.0

 * @date 2025-10-05

 */

/**

 * WebアプリのPOSTリクエストエントリーポイント

 * AppSheetからのWebhookを受信

 * 重複リクエスト対策:

 * - 処理中の通話IDをキャッシュで管理

 * - 同一通話IDの重複リクエストをスキップ

 * - 処理完了後にキャッシュをクリア

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_通話_要約生成';
    return processRequest(params.callId || params.data?.callId, params.callDatetime || params.data?.callDatetime, params.filePath || params.data?.filePath, params.fileId || params.data?.fileId, params.callContextText || params.data?.callContextText, params.userInfoText || params.data?.userInfoText, params.clientId || params.data?.clientId);
  });
}

/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(callId, callDatetime, filePath, fileId, callContextText, userInfoText, clientId) {
  const config = getConfig();

  let callId = 'ID解析不能';

  try {

    // パラメータから callId を取得

    callId = callId || 'ID不明';

    // パラメータ検証

    validateRequiredParams(params);

    // ⭐ 重複リクエストチェック

    if (isDuplicateRequest(callId)) {

      Logger.log(`[重複スキップ] 通話ID: ${callId} は処理中または処理済みです`);

      return createDuplicateResponse(callId);

    }

    // 処理中フラグを設定

    markAsProcessing(callId);

    Logger.log(`[処理開始] 通話ID: ${callId}`);

    // file_pathからファイルIDとURLを取得

    let fileId, fileUrl;

    if (filePath) {

      Logger.log(`[ファイル解決] ファイルパス: ${filePath}`);

      const fileInfo = getFileIdFromPath(filePath, config.sharedDriveFolderId);

      fileId = fileInfo.fileId;

      fileUrl = fileInfo.fileUrl;

      Logger.log(`[ファイル解決] ファイルID: ${fileId}`);

      Logger.log(`[ファイル解決] ファイルURL: ${fileUrl}`);

    } else if (fileId) {

      // 後方互換性: fileIdが直接指定された場合
      const file = DriveApp.getFileById(fileId);

      fileUrl = file.getUrl();

      Logger.log(`[ファイル解決] 直接指定 - ファイルID: ${fileId}`);

    } else {

      throw new Error('filePath または fileId が必要です');

    }

    // Vertex AIで音声解析

    const analysisResult = analyzeAudioWithVertexAI(

      fileId,

      callDatetime,

      callContextText,

      userInfoText,

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

    if (analysisResult.actions.length > 0) {

      addCallActions(callId, clientId, analysisResult.actions, config);

    }

    Logger.log(`[処理完了] 通話ID: ${callId}`);

    // 処理完了フラグを設定（重複防止を6時間維持）

    markAsCompleted(callId);

    // 成功通知

    sendSuccessNotification(callId, analysisResult.summary, config);

    return createSuccessResponse(callId, fileId, fileUrl);

  } catch (error) {

    Logger.log(`[エラー] ${error.toString()}\n${error.stack}`);

    // エラー時も処理済みとしてマーク（リトライ防止）

    markAsCompleted(callId);

    recordError(callId, error.toString(), config);

    sendErrorNotification(callId, error.toString(), error.stack, config);

    return createErrorResponse(callId, error);

  }
}

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

  return CommonTest.runTest((params) => processRequest(params.callId, params.callDatetime, params.filePath, params.fileId, params.callContextText, params.userInfoText, params.clientId), testParams, 'Appsheet_通話_要約生成');
}

/**

 * リクエストデータを解析

 */

function parseRequest(e) {

  try {

    return JSON.parse(e.postData.contents);

  } catch (error) {

    throw new Error(`リクエストの解析に失敗: ${error.message}`);

  }

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

  if (!filePath && !fileId) {

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

/**

 * 成功レスポンスを返す

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

 * エラーレスポンスを返す

 */

function createErrorResponse(callId, error) {

  return ContentService.createTextOutput(JSON.stringify({

    status: 'error',

    callId: callId,

    error: error.toString(),

    timestamp: new Date().toISOString()

  })).setMimeType(ContentService.MimeType.JSON);

}

/**

 * 重複レスポンスを返す

 */

function createDuplicateResponse(callId) {

  return ContentService.createTextOutput(JSON.stringify({

    status: 'duplicate',

    callId: callId,

    message: '処理中または処理済みです',

    timestamp: new Date().toISOString()

  })).setMimeType(ContentService.MimeType.JSON);

}

/**

 * 重複リクエストかチェック

 * @param {string} callId - 通話ID

 * @return {boolean} 重複の場合true

 */

function isDuplicateRequest(callId) {

  const cache = CacheService.getScriptCache();

  const cacheKey = `processing_${callId}`;

  // キャッシュに存在する場合は重複

  const cachedValue = cache.get(cacheKey);

  if (cachedValue) {

    const status = JSON.parse(cachedValue);

    Logger.log(`[重複チェック] ${callId}: ${status.state} (開始: ${status.startTime})`);

    return true;

  }

  return false;

}

/**

 * 処理中としてマーク

 * @param {string} callId - 通話ID

 */

function markAsProcessing(callId) {

  const cache = CacheService.getScriptCache();

  const cacheKey = `processing_${callId}`;

  const status = {

    state: 'processing',

    startTime: new Date().toISOString()

  };

  // 10分間処理中としてマーク（Apps Scriptの最大実行時間6分を考慮）

  cache.put(cacheKey, JSON.stringify(status), 600);

  Logger.log(`[重複防止] 処理中マーク設定: ${callId}`);

}

/**

 * 処理完了としてマーク

 * @param {string} callId - 通話ID

 */

function markAsCompleted(callId) {

  const cache = CacheService.getScriptCache();

  const cacheKey = `processing_${callId}`;

  const status = {

    state: 'completed',

    completedTime: new Date().toISOString()

  };

  // 6時間完了済みとしてマーク（重複リクエスト防止）

  cache.put(cacheKey, JSON.stringify(status), 21600);

  Logger.log(`[重複防止] 処理完了マーク設定: ${callId} (6時間保持)`);

}

/**

 * 処理状態をクリア（デバッグ用）

 * @param {string} callId - 通話ID

 */

function clearProcessingState(callId) {

  const cache = CacheService.getScriptCache();

  const cacheKey = `processing_${callId}`;

  cache.remove(cacheKey);

  Logger.log(`[重複防止] 処理状態クリア: ${callId}`);

}
