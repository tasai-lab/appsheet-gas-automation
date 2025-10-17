/**

 * AppSheetからのWebhook POSTリクエストを受け取るメイン関数

 * @param {GoogleAppsScript.Events.DoPost} e

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_ALL_Event';
    return processRequest(params);
  });
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  try {

    Logger.info('Webhook受信', { params });

    // --- ▼▼▼ ここから修正・追加 ▼▼▼ ---

    // 処理の一意なIDを取得 (通常はAppSheetの行ID)

    const executionId = (params.returnToAppSheet && params.returnToAppSheet.rowId) 

      ? params.returnToAppSheet.rowId 

      : null;

    // IDに対して実行ロックを試みる

    LockingService.acquireLock(executionId);

    // --- ▲▲▲ ここまで修正・追加 ▲▲▲ ---

    Validator.validateRequestPayload(params);

    const result = routeAction(params);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result }))

      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {

    // --- ▼▼▼ ここから修正・追加 ▼▼▼ ---

    // 重複実行ロックによるエラーの場合、特別に処理する

    if (error.message.includes('is currently locked')) {

      const lockedId = (params && params.returnToAppSheet) ? params.returnToAppSheet.rowId : 'N/A';

      Logger.info(`ID '${lockedId}' の重複実行を検知・回避しました。`);

      // AppSheet側でユーザーにエラーを見せないよう、エラーではなく「スキップ」として応答する

      return ContentService.createTextOutput(JSON.stringify({ status: 'skipped', message: 'Duplicate execution avoided.' }))

        .setMimeType(ContentService.MimeType.JSON);

    }

    // --- ▲▲▲ ここまで修正・追加 ▲▲▲ ---

    Logger.error('doPostで致命的なエラーが発生', error, { params });

    if (params && params.returnToAppSheet) {

      try {

        AppSheetService.sendErrorResponse(params.returnToAppSheet, error);

      } catch (appsheetError) {

        Logger.error('AppSheetへのエラー通知中にさらにエラーが発生', appsheetError, { params });

      }

    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))

      .setMimeType(ContentService.MimeType.JSON)

      .setStatusCode(500);

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

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_ALL_Event');
}


/**

 * params.actionに応じて処理を振り分けるルーター関数

 * @param {Object} params

 */

function routeAction(params) {

  // この関数に変更はありません

  const { action, eventId, eventData, ownerData, returnToAppSheet } = params;

  let result = null;

  Logger.info(`アクション '${action}' を実行します。`);

  switch (action) {

    case 'CREATE':

      result = CalendarService.createEvent(ownerData.newOwnerEmail, eventData);

      break;

    case 'UPDATE':

      result = CalendarService.updateEvent(ownerData.newOwnerEmail, eventId, eventData);

      break;

    case 'TRANSFER':

      result = CalendarService.transferEvent(ownerData, eventId, eventData);

      break;

    case 'DELETE':

      result = CalendarService.deleteEvent(ownerData.oldOwnerEmail, eventId);

      break;

    default:

      throw new Error(`未知のアクションです: ${action}`);

  }

  if (returnToAppSheet) {

    const eventIdValue = result ? result.eventId : null;

    const eventUrlValue = result ? result.eventUrl : null;

    AppSheetService.sendSuccessResponse(returnToAppSheet, eventIdValue, eventUrlValue, action);

  }

  return result;

}
