/**
 * modules_notification.gs - 通知モジュール
 *
 * メール送信機能は廃止 - 実行ログスプレッドシートで代替
 *
 * @version 3.0.0
 * @date 2025-10-20
 */

/**
 * エラー通知メールを送信（廃止済み）
 * 実行ログスプレッドシートにエラーが記録されます
 * @param {string} documentId - 書類ID
 * @param {string} errorMessage - エラーメッセージ
 * @param {Object} [context] - コンテキスト情報
 */
function sendErrorEmail(documentId, errorMessage, context = {}) {
  // メール送信機能は廃止
  // 実行ログスプレッドシート（16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA）で確認してください
  logStructured(LOG_LEVEL.INFO, 'エラー通知はログに記録されました', {
    documentId: documentId,
    errorMessage: errorMessage.substring(0, 200)
  });
}

/**
 * 完了通知メールを送信（廃止済み）
 * 実行ログスプレッドシートに成功ログが記録されます
 * @param {Object} context - コンテキスト情報
 * @param {string} documentType - 書類種類
 * @param {Object} structuredData - 抽出された構造化データ
 * @param {string} recordId - 作成されたレコードID
 */
function sendCompletionNotificationEmail(context, documentType, structuredData, recordId) {
  // メール送信機能は廃止
  // 実行ログスプレッドシート（16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA）で確認してください
  logStructured(LOG_LEVEL.INFO, '処理完了通知はログに記録されました', {
    documentType: documentType,
    recordId: recordId,
    clientId: context.clientId
  });
}
