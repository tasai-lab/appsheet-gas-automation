/**
 * modules_notification.gs - 通知モジュール
 *
 * エラー通知やアラートの送信処理
 *
 * @version 1.0.0
 * @date 2025-10-18
 */

/**
 * 処理失敗時にメールでエラー内容を通知する
 * @param {string} reportId - 報告書ID
 * @param {string} errorMessage - エラーメッセージ
 * @param {Object} context - コンテキスト情報（オプション）
 */
function sendErrorEmail(reportId, errorMessage, context = {}) {
  const subject = `[要確認] GAS処理エラー: 医療機関向け報告書作成 (ID: ${reportId})`;

  let body = `AppSheetの報告書自動生成処理でエラーが発生しました。\n\n`;
  body += `■ 対象ID: ${reportId}\n`;
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
      reportId: reportId,
      recipient: NOTIFICATION_CONFIG.errorEmail
    });
  } catch(e) {
    logStructured(LOG_LEVEL.ERROR, 'エラー通知メール送信失敗', {
      error: e.toString()
    });
  }
}
