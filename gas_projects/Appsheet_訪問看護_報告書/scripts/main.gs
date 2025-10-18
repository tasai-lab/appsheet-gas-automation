/**
 * main.gs - 医療機関向け報告書生成
 *
 * AppSheetからの訪問看護記録をもとに、Gemini 2.5-proで
 * 医療機関向けの報告書を自動生成します。
 *
 * @version 2.1.0
 * @date 2025-10-18
 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベント
 * @return {GoogleAppsScript.Content.TextOutput} - JSONレスポンス
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_訪問看護_報告書';
    return processRequest(
      params.reportId || params.data?.reportId,
      params.clientName || params.data?.clientName,
      params.targetMonth || params.data?.targetMonth,
      params.visitRecords || params.data?.visitRecords,
      params.staffId || params.data?.staffId
    );
  });
}

/**
 * メイン処理関数
 * @param {string} reportId - 報告書ID
 * @param {string} clientName - 利用者名
 * @param {string} targetMonth - 対象月
 * @param {string} visitRecords - 訪問記録テキスト
 * @param {string} staffId - スタッフID
 * @returns {Object} - 処理結果
 */
function processRequest(reportId, clientName, targetMonth, visitRecords, staffId) {
  const startTime = Date.now();

  // パラメータをログ用に保存
  const params = {
    reportId: reportId,
    clientName: clientName,
    targetMonth: targetMonth,
    visitRecordsLength: visitRecords ? visitRecords.length : 0,
    staffId: staffId
  };

  try {
    // 必須パラメータのバリデーション
    if (!reportId || !clientName || !targetMonth || !visitRecords) {
      throw new Error("必須パラメータ（reportId, clientName, targetMonth, visitRecords）が不足しています。");
    }

    logProcessingStart(reportId, params);

    // --- AIで報告書を生成 ---
    const context = {
      clientName: clientName,
      targetMonth: targetMonth,
      visitRecords: visitRecords
    };

    const reportText = generateReportWithGemini(context);

    if (!reportText) {
      throw new Error("AIからの応答が空でした。");
    }

    // --- AppSheetに結果を書き込み ---
    updateReportOnSuccess(reportId, reportText, staffId);

    const duration = Date.now() - startTime;
    logProcessingComplete(reportId, duration);

    return { success: true, reportId: reportId };

  } catch (error) {
    logError(reportId || 'UNKNOWN', error, { params: params });

    if (reportId) {
      updateReportOnError(reportId, error.toString());
      sendErrorEmail(reportId, error.toString());
    }

    throw error;
  }
}

/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 *
 * @param {string} reportId - 報告書ID（例: "REPORT-001"）
 * @param {string} clientName - 利用者名（例: "山田太郎"）
 * @param {string} targetMonth - 対象月（例: "2025年10月"）
 * @param {string} visitRecords - 訪問記録テキスト
 * @param {string} staffId - スタッフID（例: "staff@example.com"）
 */
function testReportGeneration(
  reportId = "TEST-REPORT-001",
  clientName = "山田太郎",
  targetMonth = "2025年10月",
  visitRecords = "10/1訪問: BT36.5℃ BP120/70mmHg P72回/分 SpO2 98%。全身状態良好。食事摂取良好。",
  staffId = "test@fractal-group.co.jp"
) {
  console.log('='.repeat(60));
  console.log('🧪 報告書生成テスト実行');
  console.log('='.repeat(60));

  return processRequest(reportId, clientName, targetMonth, visitRecords, staffId);
}
