/**
 * Webhook受信処理（新ライブラリ対応版）
 * AppSheetからのWebhookを受け取り、通話音声ファイルをVertex AIで処理する
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
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return executeWebhookWithDuplicationPrevention(e, processCallSummary, {
    recordIdField: 'callId',
    enableFingerprint: true,
    metadata: { 
      processor: 'vertex_ai',
      version: '3.0.0',
      scriptName: 'Appsheet_通話_要約生成'
    }
  });
}

/**
 * 直接実行用関数（個別引数版）
 * GASエディタから個別の引数を指定して直接実行可能
 * @param {string} callId - 通話ID
 * @param {string} callDatetime - 通話日時（ISO形式）
 * @param {string} filePath - ファイルパス（オプション）
 * @param {string} fileId - ファイルID（オプション）
 * @param {string} callContextText - 通話コンテキスト
 * @param {string} userInfoText - ユーザー情報
 * @param {string} clientId - クライアントID
 */
function processCallSummaryDirect(
  callId,
  callDatetime,
  filePath,
  fileId,
  callContextText,
  userInfoText,
  clientId
) {
  // 個別引数をparamsオブジェクトに変換
  const params = {
    callId: callId,
    callDatetime: callDatetime,
    filePath: filePath,
    fileId: fileId,
    callContextText: callContextText,
    userInfoText: userInfoText,
    clientId: clientId
  };
  
  Logger.log('[直接実行] パラメータ:', JSON.stringify(params, null, 2));
  
  const result = processCallSummary(params);
  
  Logger.log('[直接実行] 結果:', JSON.stringify(result, null, 2));
  
  return result;
}

/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  const testParams = {
    callId: "test_" + new Date().getTime(),
    callDatetime: new Date().toISOString(),
    filePath: "test/audio.m4a",
    callContextText: "テスト通話",
    userInfoText: "テストユーザー",
    clientId: "test_client"
  };
  
  Logger.log('[テスト] パラメータ:', JSON.stringify(testParams, null, 2));
  
  const result = processCallSummary(testParams);
  
  Logger.log('[テスト] 結果:', JSON.stringify(result, null, 2));
  
  return result;
}

/**
 * 通話要約の実処理
 * executeWebhookWithDuplicationPreventionから呼び出される
 * @param {Object} params - Webhookパラメータ
 * @return {Object} 処理結果
 */
function processCallSummary(params) {
  const config = getConfig();
  const callId = params.callId;
  const callDatetime = params.callDatetime;
  const filePath = params.filePath;
  const fileId = params.fileId;
  const callContextText = params.callContextText;
  const userInfoText = params.userInfoText;
  const clientId = params.clientId;
  
  Logger.log(`[処理開始] 通話ID: ${callId}`);

  // パラメータ検証
  if (!callId || !callDatetime) {
    throw new Error('必須パラメータが不足: callId, callDatetime');
  }

  // file_pathからファイルIDとURLを取得
  let resolvedFileId, fileUrl;
  
  if (filePath) {
    Logger.log(`[ファイル解決] ファイルパス: ${filePath}`);
    const fileInfo = getFileIdFromPath(filePath, config.sharedDriveFolderId);
    resolvedFileId = fileInfo.fileId;
    fileUrl = fileInfo.fileUrl;
    Logger.log(`[ファイル解決] ファイルID: ${resolvedFileId}`);
  } else if (fileId) {
    const file = DriveApp.getFileById(fileId);
    resolvedFileId = fileId;
    fileUrl = file.getUrl();
    Logger.log(`[ファイル解決] 直接指定 - ファイルID: ${resolvedFileId}`);
  } else {
    throw new Error('filePath または fileId が必要です');
  }

  // Vertex AIで音声解析
  const analysisResult = analyzeAudioWithVertexAI(
    resolvedFileId,
    callDatetime,
    callContextText,
    userInfoText,
    config
  );

  // 結果の検証
  if (!analysisResult || !analysisResult.summary || !analysisResult.transcript || !Array.isArray(analysisResult.actions)) {
    throw new Error('解析結果に必須キー (summary, transcript, actions) が不足しています');
  }

  // ファイル情報を結果に追加
  analysisResult.recording_file_id = resolvedFileId;
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
    addCallActions(callId, clientId, analysisResult.actions, config);
  }

  Logger.log(`[処理完了] 通話ID: ${callId}`);

  // 成功通知
  sendSuccessNotification(callId, analysisResult.summary, config);

  // 処理結果を返す（自動的に完了マークされる）
  return {
    success: true,
    callId: callId,
    recording_file_id: resolvedFileId,
    recording_file_url: fileUrl,
    summary_length: analysisResult.summary.length,
    actions_count: analysisResult.actions.length
  };
}
