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
  try {
    return executeWebhookWithDuplicationPrevention(e, processCallSummaryWithErrorHandling, {
      recordIdField: 'callId',
      enableFingerprint: true,
      metadata: { 
        processor: 'vertex_ai',
        version: '3.0.0',
        scriptName: 'Appsheet_通話_要約生成'
      }
    });
  } catch (error) {
    Logger.log(`[doPost] エラー: ${error.message}`);
    
    // パラメータからcallIdを取得（可能な場合）
    let callId = 'ID不明';
    try {
      const params = JSON.parse(e.postData.contents);
      callId = params.callId || 'ID不明';
    } catch (e) {
      // パース失敗時は無視
    }
    
    // エラーログを記録
    logFailure(callId, error, {
      notes: 'doPost実行エラー'
    });
    
    throw error;
  }
}

/**
 * エラーハンドリング付きの通話要約処理
 * @param {Object} params - Webhookパラメータ
 * @return {Object} 処理結果
 */
function processCallSummaryWithErrorHandling(params) {
  const callId = params.callId || 'ID不明';
  
  try {
    return processCallSummary(params);
  } catch (error) {
    Logger.log(`[エラー] 通話ID: ${callId}, エラー: ${error.message}`);
    
    // エラーログを記録
    logFailure(callId, error, {
      filePath: params.filePath,
      fileId: params.fileId
    });
    
    // AppSheetにエラー記録
    try {
      const config = getConfig();
      recordError(callId, error.message, config);
    } catch (e) {
      Logger.log(`[エラー記録失敗] ${e.message}`);
    }
    
    throw error;
  }
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
  const timer = new ExecutionTimer();
  const config = getConfig();
  const callId = params.callId;
  const callDatetime = params.callDatetime;
  const filePath = params.filePath;
  const fileId = params.fileId;
  const callContextText = params.callContextText;
  const userInfoText = params.userInfoText;
  const clientId = params.clientId;
  
  Logger.log(`[処理開始] 通話ID: ${callId}`);
  
  // 処理開始をログ記録
  logStart(callId, {
    filePath: filePath,
    fileId: fileId,
    modelName: config.vertexAIModel
  });

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

  // 成功ログを記録
  logSuccess(callId, {
    filePath: filePath,
    fileId: resolvedFileId,
    summary: analysisResult.summary.substring(0, 200) + '...',
    transcriptLength: analysisResult.transcript.length,
    actionsCount: analysisResult.actions.length,
    processingTime: timer.getElapsedSeconds(),
    modelName: config.vertexAIModel,
    fileSize: analysisResult.fileSize
  });

  // 【統合機能】新規依頼作成（有効な場合のみ）
  let requestCreationResult = null;
  if (config.enableRequestCreation) {
    try {
      Logger.log(`[統合機能] 新規依頼作成を開始`);
      
      requestCreationResult = createOrUpdateRequestFromSummary(
        callId,
        callDatetime,
        analysisResult.summary,
        analysisResult.transcript,
        clientId,
        config,
        params.request_ids || params.requestIds,
        params.requester_org_id || params.requesterOrgId,
        params.requester_id || params.requesterId,
        params.creator_id || params.creatorId,
        params.existing_request_reason || params.existingRequestReason,
        params.existing_client_info || params.existingClientInfo,
        params.existing_next_action || params.existingNextAction
      );
      
      Logger.log(`[統合機能] 依頼作成完了 - Request ID: ${requestCreationResult.requestId}`);
      
      // Call_Logsにrequest_idsを更新（新規作成時のみ）
      if (requestCreationResult.isNew) {
        updateCallLogWithRequestId(callId, requestCreationResult.requestId, config);
      }
      
    } catch (error) {
      Logger.log(`[統合機能] 依頼作成エラー: ${error.message}`);
      // 依頼作成エラーは全体の処理を失敗にしない（ログのみ）
    }
  }

  // 処理結果を返す（自動的に完了マークされる）
  return {
    success: true,
    callId: callId,
    recording_file_id: resolvedFileId,
    recording_file_url: fileUrl,
    summary_length: analysisResult.summary.length,
    actions_count: analysisResult.actions.length,
    request_created: requestCreationResult ? {
      request_id: requestCreationResult.requestId,
      is_new: requestCreationResult.isNew
    } : null
  };
}
