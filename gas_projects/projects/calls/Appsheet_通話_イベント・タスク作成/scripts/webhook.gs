/**
 * Webhookエントリーポイント
 * AppSheetからのWebhookリクエストを受信して処理
 * 
 * @author Fractal Group
 * @version 1.1.0
 * @date 2025-10-17
 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e - POSTリクエストイベント
 * @return {GoogleAppsScript.Content.TextOutput} レスポンス
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_通話_イベント・タスク作成';
    return processRequest(
      params.actionId || params.data?.actionId,
      params.actionType || params.data?.actionType || params.action_type || params.data?.action_type,
      params.title || params.data?.title,
      params.details || params.data?.details,
      params.startDateTime || params.data?.startDateTime || params.start_datetime || params.data?.start_datetime,
      params.endDateTime || params.data?.endDateTime || params.end_datetime || params.data?.end_datetime,
      params.dueDateTime || params.data?.dueDateTime || params.due_datetime || params.data?.due_datetime,
      params.assigneeEmail || params.data?.assigneeEmail || params.assignee_email || params.data?.assignee_email,
      params.rowUrl || params.data?.rowUrl || params.row_url || params.data?.row_url
    );
  });
}

/**
 * 直接実行用のラッパー関数（個別引数版）
 * AppSheetから直接呼び出す際に使用
 * 
 * @param {string} actionId - アクションID（必須）
 * @param {string} actionType - アクションタイプ（'event'/'イベント' または 'task'/'タスク'）（必須）
 * @param {string} title - タイトル（必須）
 * @param {string} details - 詳細
 * @param {string} startDateTime - 開始日時（イベント用、日本時間JST ISO形式: YYYY-MM-DDTHH:mm:ss+09:00）
 * @param {string} endDateTime - 終了日時（イベント用、日本時間JST ISO形式: YYYY-MM-DDTHH:mm:ss+09:00）
 * @param {string} dueDateTime - 期限日時（タスク用、日本時間JST ISO形式: YYYY-MM-DDTHH:mm:ss+09:00）
 * @param {string} assigneeEmail - 担当者メールアドレス（必須）
 * @param {string} rowUrl - AppSheet行URL
 * @return {Object} 処理結果
 */
function processRequestDirect(
  actionId,
  actionType,
  title,
  details,
  startDateTime,
  endDateTime,
  dueDateTime,
  assigneeEmail,
  rowUrl
) {
  return processRequest(
    actionId,
    actionType,
    title,
    details,
    startDateTime,
    endDateTime,
    dueDateTime,
    assigneeEmail,
    rowUrl
  );
}
