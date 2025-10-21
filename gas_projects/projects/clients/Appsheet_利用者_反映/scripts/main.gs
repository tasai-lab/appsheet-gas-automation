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
 * @param {string} clientInfoTemp - 利用者に関するメモ
 * @param {string} requestReason - 依頼理由
 * @param {string} documentFileId - 添付資料のGoogle Drive ファイルID（オプション）
 * @param {string} staffId - 担当スタッフID（例: "STF-001"）
 * @param {string} providerOffice - 担当事業所名（オプション）
 * @return {Object} - 処理結果
 */
function processRequestDirect(requestId, clientInfoTemp, requestReason, documentFileId, staffId, providerOffice) {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📋 利用者反映処理 - 直接実行');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log(`Request ID: ${requestId || '未指定'}`);
  Logger.log(`Client Info: ${clientInfoTemp ? clientInfoTemp.substring(0, 100) + '...' : '未指定'}`);
  Logger.log(`Request Reason: ${requestReason || '未指定'}`);
  Logger.log(`Document File ID: ${documentFileId || '未指定'}`);
  Logger.log(`Staff ID: ${staffId || '未指定'}`);
  Logger.log(`Provider Office: ${providerOffice || '未指定'}`);
  Logger.log('');

  const params = {
    requestId: requestId,
    clientInfoTemp: clientInfoTemp,
    requestReason: requestReason,
    documentFileId: documentFileId,
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
  const documentFileId = params.documentFileId;
  const staffId = params.staffId;
  const providerOffice = params.providerOffice;

  try {
    // 必須パラメータチェック
    validateRequiredParams(params, ['requestId', 'clientInfoTemp', 'staffId']);

    Logger.log(`処理開始: Request ID = ${requestId}`);

    // 1. 新しいClientIDをAppSheetから取得して採番
    const newClientId = getNewClientId();
    Logger.log(`新しいClientIDを採番しました: ${newClientId}`);

    // 2. AIで依頼情報から利用者情報を抽出
    const extractedInfo = extractClientInfoWithGemini(clientInfoTemp, requestReason, documentFileId);
    if (!extractedInfo) throw new Error("AIからの応答が不正でした。");

    // 3. Clientsテーブルに新しい利用者を作成
    createClientInAppSheet(newClientId, extractedInfo, params);

    // 4. 元の依頼ステータスを「反映済み」に更新
    updateRequestStatus(requestId, PROCESS_STATUS.REFLECTED, null);

    Logger.log(`処理完了。新しい利用者ID ${newClientId} を作成しました。`);

    return {
      success: true,
      clientId: newClientId,
      requestId: requestId,
      message: `新しい利用者 ${newClientId} を作成しました`
    };

  } catch (error) {
    Logger.log(`エラーが発生しました: ${error.toString()}`);

    if (requestId) {
      updateRequestStatus(requestId, PROCESS_STATUS.ERROR, error.toString());
    }

    throw error;
  }
}
