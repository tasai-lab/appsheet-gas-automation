/**
 * Webhook受信処理（最適化版 v4.0）
 * - 1回のAPI呼び出しで要約+全文+アクション+依頼情報を取得
 * - core_request_creation.gsの2回目のAPI呼び出しを廃止
 * - コスト削減: 約28%、実行時間短縮: 約30%
 * 
 * @author Fractal Group
 * @version 4.0.0
 * @date 2025-10-17
 * 
 * 変更点:
 * - analyzeAudioWithVertexAIが依頼情報も含めて返すように変更
 * - core_request_creation.gsのcreateOrUpdateRequestFromSummaryを廃止
 * - AIレスポンスから直接依頼情報を取得
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
        processor: 'vertex_ai_unified',
        version: '4.0.0',
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
 * 通話要約の実処理（最適化版 + 条件分岐）
 * executeWebhookWithDuplicationPreventionから呼び出される
 * 
 * 処理モード:
 * 1. callType='新規依頼' → 依頼情報を含む音声解析 + 新規依頼作成
 * 2. requestId指定あり → 依頼情報を含む音声解析 + 既存依頼更新
 * 3. どちらでもない → 通常の要約のみ（依頼情報なし）
 * 
 * @param {Object} params - Webhookパラメータ
 * @param {string} params.callId - 通話ID（必須）
 * @param {string} params.callDatetime - 通話日時（必須）
 * @param {string} params.callType - 通話種別（'新規依頼' で依頼作成モード）
 * @param {string} params.requestId - 既存依頼ID（指定時は更新モード）
 * @param {string} params.filePath - ファイルパス
 * @param {string} params.fileId - ファイルID
 * @param {string} params.callContextText - 通話コンテキスト
 * @param {string} params.userInfoText - ユーザー情報
 * @param {string} params.clientId - クライアントID
 * @return {Object} 処理結果
 */
function processCallSummary(params) {
  const timer = new ExecutionTimer();
  const config = getConfig();
  const callId = params.callId;
  const callDatetime = params.callDatetime;
  const callType = params.callType || params.call_type || ''; // callTypeまたはcall_type
  const requestId = params.requestId || params.request_id || params.request_ids || params.requestIds || ''; // 複数の形式に対応
  const filePath = params.filePath;
  const fileId = params.fileId;
  const callContextText = params.callContextText;
  const userInfoText = params.userInfoText;
  const clientId = params.clientId;
  
  Logger.log(`[処理開始] 通話ID: ${callId}, callType: ${callType}, requestId: ${requestId}`);
  
  // 処理開始をログ記録
  logStart(callId, {
    filePath: filePath,
    fileId: fileId,
    modelName: config.vertexAIModel,
    callType: callType,
    requestId: requestId
  });

  // パラメータ検証
  if (!callId || !callDatetime) {
    throw new Error('必須パラメータが不足: callId, callDatetime');
  }
  
  // 処理モードの判定
  let processingMode = 'summary_only'; // デフォルト: 要約のみ
  
  if (callType === '新規依頼' || callType === 'new_request') {
    processingMode = 'create_request';
    Logger.log(`[処理モード] 新規依頼作成モード`);
  } else if (requestId && requestId.trim() !== '') {
    processingMode = 'update_request';
    Logger.log(`[処理モード] 既存依頼更新モード (Request ID: ${requestId})`);
  } else {
    Logger.log(`[処理モード] 通常要約モード（依頼情報なし）`);
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

  // 処理モードに応じて依頼作成の設定を準備
  const requestOptions = {
    enable: false, // デフォルトはfalse
    existingRequest: null
  };
  
  if (processingMode === 'create_request') {
    // 新規依頼作成モード
    requestOptions.enable = true;
    Logger.log(`[依頼設定] 新規依頼作成を有効化`);
    
  } else if (processingMode === 'update_request') {
    // 既存依頼更新モード
    requestOptions.enable = true;
    const existingRequestId = requestId.split(',')[0].trim();
    
    requestOptions.existingRequest = {
      request_id: existingRequestId,
      request_reason: params.existing_request_reason || params.existingRequestReason || '',
      client_info_temp: params.existing_client_info || params.existingClientInfo || '',
      next_action_details: params.existing_next_action || params.existingNextAction || ''
    };
    
    Logger.log(`[依頼設定] 既存依頼更新を有効化 (Request ID: ${existingRequestId})`);
    
  } else {
    // 通常要約モード（依頼情報なし）
    requestOptions.enable = false;
    Logger.log(`[依頼設定] 依頼情報の抽出を無効化（要約のみ）`);
  }

  // 【統合API呼び出し】Vertex AIで音声解析 + 依頼情報抽出を1回で実行
  const analysisResult = analyzeAudioWithVertexAI(
    resolvedFileId,
    callDatetime,
    callContextText,
    userInfoText,
    config,
    requestOptions
  );

  // 結果の検証（基本項目）
  if (!analysisResult || !analysisResult.summary || !analysisResult.transcript || !Array.isArray(analysisResult.actions)) {
    throw new Error('解析結果に必須キー (summary, transcript, actions) が不足しています');
  }

  // ファイル情報を結果に追加
  analysisResult.recording_file_id = resolvedFileId;
  analysisResult.recording_file_url = fileUrl;

  // AppSheet更新（Call_Logs）
  updateCallLog(
    callId, 
    analysisResult.transcript, 
    analysisResult.summary,
    analysisResult.recording_file_id,
    analysisResult.recording_file_url,
    config
  );

  // アクション追加（Call_Actions）
  if (analysisResult.actions.length > 0) {
    addCallActions(callId, clientId, analysisResult.actions, config);
  }

  Logger.log(`[処理完了] 通話ID: ${callId}`);

  // 成功通知
  sendSuccessNotification(callId, analysisResult.summary, config);

  // 【統合機能】依頼作成/更新（AIレスポンスから直接取得）
  let requestCreationResult = null;
  
  if (requestOptions.enable && analysisResult.request_details) {
    try {
      Logger.log(`[依頼情報] AIから抽出した依頼情報を処理 (モード: ${processingMode})`);
      
      const requestDetails = analysisResult.request_details;
      
      // 処理モードに応じた分岐
      if (processingMode === 'update_request' && requestOptions.existingRequest) {
        // 既存依頼の更新
        const existingRequestId = requestOptions.existingRequest.request_id;
        
        updateExistingRequestDirect(
          existingRequestId,
          requestDetails,
          params.creator_id || params.creatorId,
          config
        );
        
        Logger.log(`[依頼情報] 既存依頼を更新完了 - Request ID: ${existingRequestId}`);
        
        requestCreationResult = {
          requestId: existingRequestId,
          isNew: false,
          mode: 'update'
        };
        
      } else if (processingMode === 'create_request') {
        // 新規依頼の作成
        const newRequestId = generateRequestId(callDatetime);
        
        createNewRequestDirect(
          callId,
          callDatetime,
          newRequestId,
          requestDetails,
          params.requester_org_id || params.requesterOrgId,
          params.requester_id || params.requesterId,
          params.creator_id || params.creatorId,
          config
        );
        
        Logger.log(`[依頼情報] 新規依頼を作成完了 - Request ID: ${newRequestId}`);
        
        // Call_Logsにrequest_idsを更新
        updateCallLogWithRequestId(callId, newRequestId, config);
        
        requestCreationResult = {
          requestId: newRequestId,
          isNew: true,
          mode: 'create'
        };
      } else {
        // summary_onlyモード（依頼情報なし）
        Logger.log(`[依頼情報] summary_onlyモード - 依頼情報の抽出・作成をスキップ`);
      }
      
    } catch (error) {
      Logger.log(`[依頼情報] 処理エラー: ${error.message}`);
      // 依頼作成エラーは全体の処理を失敗にしない（ログのみ）
    }
  } else if (processingMode === 'summary_only') {
    Logger.log(`[依頼情報] summary_onlyモード - 依頼詳細の抽出は実行されませんでした`);
  }

  // 成功ログを記録
  logSuccess(callId, {
    filePath: filePath,
    fileId: resolvedFileId,
    summary: analysisResult.summary.substring(0, 200) + '...',
    transcriptLength: analysisResult.transcript.length,
    actionsCount: analysisResult.actions.length,
    processingTime: timer.getElapsedSeconds(),
    modelName: config.vertexAIModel,
    fileSize: analysisResult.fileSize,
    requestCreated: requestCreationResult ? 'あり' : 'なし'
  });

  // 処理結果を返す（自動的に完了マークされる）
  return {
    success: true,
    callId: callId,
    recording_file_id: resolvedFileId,
    recording_file_url: fileUrl,
    summary_length: analysisResult.summary.length,
    actions_count: analysisResult.actions.length,
    processing_mode: processingMode,
    request_created: requestCreationResult ? {
      request_id: requestCreationResult.requestId,
      is_new: requestCreationResult.isNew,
      mode: requestCreationResult.mode
    } : null
  };
}

/**
 * AppSheetに新しい依頼行を作成する（簡略版）
 * AIから取得した依頼情報を直接使用
 */
function createNewRequestDirect(
  callId,
  callDatetime,
  requestId,
  requestDetails,
  requesterOrgId,
  requesterId,
  creatorId,
  config
) {
  const date = new Date(callDatetime);
  
  const rowData = {
    "request_id": requestId,
    "status": "新規受付",
    "channel": "電話",
    "priority": requestDetails.priority,
    "request_type": requestDetails.request_type,
    "request_date": Utilities.formatDate(date, "JST", "yyyy-MM-dd"),
    "request_time": Utilities.formatDate(date, "JST", "HH:mm:ss"),
    "request_reason": requestDetails.request_reason,
    "requester_org_id": requesterOrgId,
    "requester_id": requesterId,
    "client_name_temp": requestDetails.client_name_temp,
    "client_info_temp": requestDetails.client_info_temp,
    "next_action_date": requestDetails.next_action_date,
    "next_action_details": requestDetails.next_action_details,
    "call_record_id": callId,
    "service_start_date": requestDetails.service_start_date,
    "created_by": creatorId,
    "updated_by": creatorId
  };
  
  const payload = {
    Action: "Add",
    Properties: {
      "Locale": "ja-JP",
      "Timezone": "Asia/Tokyo"
    },
    Rows: [rowData]
  };
  
  callAppSheetApiForRequest(
    config.requestsAppId,
    config.requestsAppAccessKey,
    config.requestsTableName,
    payload
  );
  
  Logger.log(`[依頼作成] 新規依頼をAppSheetに登録: ${requestId}`);
}

/**
 * AppSheetの既存の依頼行を更新する（簡略版）
 * AIから取得した依頼情報を直接使用
 */
function updateExistingRequestDirect(requestId, requestDetails, creatorId, config) {
  const rowData = {
    "request_id": requestId,
    "priority": requestDetails.priority,
    "request_type": requestDetails.request_type,
    "request_reason": requestDetails.request_reason,
    "client_name_temp": requestDetails.client_name_temp,
    "client_info_temp": requestDetails.client_info_temp,
    "next_action_date": requestDetails.next_action_date,
    "next_action_details": requestDetails.next_action_details,
    "service_start_date": requestDetails.service_start_date,
    "updated_by": creatorId
  };
  
  const payload = {
    Action: "Edit",
    Properties: {
      "Locale": "ja-JP",
      "Timezone": "Asia/Tokyo"
    },
    Rows: [rowData]
  };
  
  callAppSheetApiForRequest(
    config.requestsAppId,
    config.requestsAppAccessKey,
    config.requestsTableName,
    payload
  );
  
  Logger.log(`[依頼作成] 既存依頼をAppSheetで更新: ${requestId}`);
}

/**
 * AppSheet API を呼び出す共通関数（依頼作成用）
 * @param {string} appId - アプリID
 * @param {string} accessKey - アクセスキー
 * @param {string} tableName - テーブル名
 * @param {Object} payload - リクエストペイロード
 */
function callAppSheetApiForRequest(appId, accessKey, tableName, payload) {
  const apiUrl = `https://api.appsheet.com/api/v2/apps/${appId}/tables/${tableName}/Action`;
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'ApplicationAccessKey': accessKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  Logger.log(`[AppSheet API] ${tableName} - ${responseCode}: ${responseText.substring(0, 200)}`);
  
  if (responseCode >= 400) {
    throw new Error(`AppSheet API Error (${tableName}): ${responseCode} - ${responseText}`);
  }
}

/**
 * Call_Logsテーブルにrequest_idsを更新する
 * @param {string} callId - 通話ID
 * @param {string} requestId - 依頼ID
 * @param {Object} config - 設定オブジェクト
 */
function updateCallLogWithRequestId(callId, requestId, config) {
  const rowData = {
    "call_id": callId,
    "request_ids": requestId
  };
  
  const payload = {
    Action: "Edit",
    Properties: {
      "Locale": "ja-JP",
      "Timezone": "Asia/Tokyo"
    },
    Rows: [rowData]
  };
  
  callAppSheetApiForRequest(
    config.mainAppId,
    config.mainAppAccessKey,
    config.logsTableName,
    payload
  );
  
  Logger.log(`[依頼作成] Call_Logsにrequest_idsを更新: ${callId} -> ${requestId}`);
}

/**
 * 依頼ID生成関数
 * @param {string} datetimeString - 日時文字列（ISO形式）
 * @return {string} 生成された依頼ID（CLRQ-YYYYMMDDHHmm形式）
 */
function generateRequestId(datetimeString) {
  const date = new Date(datetimeString);
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  
  return `CLRQ-${y}${m}${d}${h}${min}`;
}
