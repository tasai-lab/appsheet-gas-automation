/**
 * メイン処理モジュール
 *
 * 利用者反映処理のエントリーポイントとメインロジック
 *
 * @version 1.0.0
 * @date 2025-10-21
 */

// ========================================
// Webhookエントリーポイント
// ========================================

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e - POSTリクエストイベント
 * @return {GoogleAppsScript.Content.TextOutput} - レスポンス
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = SCRIPT_NAME;
    return processRequest(params);
  });
}

/**
 * 直接実行用関数（GASエディタから実行可能）
 * 個別の引数で受け取り、利用者反映処理を実行
 *
 * @param {string} requestId - 依頼ID（例: "CR-00123"）
 * @param {string} clientInfoTemp - 利用者に関するメモ（テキスト情報）
 * @param {string} requestReason - 依頼理由
 * @param {string} staffId - 担当スタッフID（例: "STF-001"）
 * @param {string} providerOffice - 担当事業所名（オプション）
 * @return {Object} - 処理結果
 *
 * @example
 * processRequestDirect(
 *   "CR-001",
 *   "山田太郎様、昭和25年5月10日生まれ、男性、要介護3...",
 *   "新規利用者の登録依頼",
 *   "STF-001",
 *   "フラクタル訪問看護ステーション"
 * )
 */
function processRequestDirect(requestId, clientInfoTemp, requestReason, staffId, providerOffice) {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📋 利用者反映処理 - 直接実行');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log(`Request ID: ${requestId || '未指定'}`);
  Logger.log(`Client Info: ${clientInfoTemp ? clientInfoTemp.substring(0, 100) + '...' : '未指定'}`);
  Logger.log(`Request Reason: ${requestReason || '未指定'}`);
  Logger.log(`Staff ID: ${staffId || '未指定'}`);
  Logger.log(`Provider Office: ${providerOffice || '未指定'}`);
  Logger.log('');

  const params = {
    requestId: requestId,
    clientInfoTemp: clientInfoTemp,
    requestReason: requestReason,
    staffId: staffId,
    providerOffice: providerOffice,
    scriptName: SCRIPT_NAME
  };

  try {
    const result = processRequest(params);
    Logger.log('✅ 処理成功');
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    Logger.log('❌ 処理エラー: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

// ========================================
// メイン処理
// ========================================

/**
 * メイン処理関数
 * @param {Object} params - リクエストパラメータ
 * @return {Object} - 処理結果
 */
function processRequest(params) {
  const requestId = params.requestId;
  const clientInfoTemp = params.clientInfoTemp;
  const requestReason = params.requestReason;
  const staffId = params.staffId;
  const providerOffice = params.providerOffice;

  const timer = new ExecutionTimer();
  let usageMetadata = null;
  let newClientId = null;
  let clientName = '';

  try {
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log('🚀 [processRequest] メイン処理開始');
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 必須パラメータチェック
    Logger.log('✓ [STEP 0] パラメータ検証中...');
    validateRequiredParams(params, ['requestId', 'clientInfoTemp', 'staffId']);
    Logger.log('✓ [STEP 0] パラメータ検証完了');

    Logger.log(`処理開始: Request ID = ${requestId}`);

    // 1. 新しいClientIDをAppSheetから取得して採番
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log('✓ [STEP 1] ClientID採番開始');
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    newClientId = getNewClientId();
    Logger.log(`✓ [STEP 1] ClientID採番完了: ${newClientId}`);

    // 2. AIでテキスト情報から利用者情報を抽出
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log('✓ [STEP 2] AI情報抽出開始');
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const result = extractClientInfoWithGemini(clientInfoTemp, requestReason);
    const extractedInfo = result.extractedInfo;
    usageMetadata = result.usageMetadata;

    if (!extractedInfo) throw new Error("AIからの応答が不正でした。");

    // 利用者名を取得（ログ用）
    clientName = `${extractedInfo.last_name || ''} ${extractedInfo.first_name || ''}`.trim();
    Logger.log(`✓ [STEP 2] AI情報抽出完了: ${clientName}`);

    // 3. Clientsテーブルに新しい利用者を作成
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log('✓ [STEP 3] 利用者データ作成開始');
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    createClientInAppSheet(newClientId, extractedInfo, params);
    Logger.log('✓ [STEP 3] 利用者データ作成完了');

    // 4. 元の依頼ステータスを「反映済み」に更新
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log('✓ [STEP 4] 依頼ステータス更新開始');
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    updateRequestStatus(requestId, PROCESS_STATUS.REFLECTED, null);
    Logger.log('✓ [STEP 4] 依頼ステータス更新完了');

    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log(`🎉 処理完了。新しい利用者ID ${newClientId} を作成しました。`);
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 成功ログを記録
    logSuccess(requestId, {
      clientId: newClientId,
      clientName: clientName,
      requestReason: requestReason,
      staffId: staffId,
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(4) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(4) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(4) : ''
    });

    return {
      success: true,
      clientId: newClientId,
      requestId: requestId,
      message: `新しい利用者 ${newClientId} を作成しました`,
      extractedInfo: extractedInfo,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    Logger.log(`エラーが発生しました: ${error.toString()}`);

    // エラーにもusageMetadataが存在すればそれを使用
    if (error.usageMetadata) {
      usageMetadata = error.usageMetadata;
    }

    if (requestId) {
      updateRequestStatus(requestId, PROCESS_STATUS.ERROR, error.toString());
    }

    // 失敗ログを記録（コスト情報も含む）
    logFailure(requestId, error, {
      clientId: newClientId,
      clientName: clientName,
      requestReason: requestReason,
      staffId: staffId,
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(4) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(4) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(4) : ''
    });

    throw error;
  }
}
