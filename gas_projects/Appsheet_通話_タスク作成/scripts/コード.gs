// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

const APP_ID = '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f'; // AppSheetのアプリID

const ACCESS_KEY = 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT'; // AppSheet APIのアクセスキー

const ACTIONS_TABLE_NAME = 'Call_Actions'; // アクションテーブル


// サービスアカウントキーを保存しているスクリプトプロパティのキー名

const DEFAULT_SERVICE_ACCOUNT_JSON_KEY = 'SERVICE_ACCOUNT_JSON';

// OAuth2コールバック関数名

const DEFAULT_OAUTH_CALLBACK_FUNCTION = 'authCallback';


/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_通話_タスク作成';
    return processRequest(params);
  });
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  const actionId = params.actionId;

  Logger.log(`Webhook受信: ${JSON.stringify(params)}`);

  try {

    const { title, details, dueDateTime, assigneeEmail } = params;

    if (!actionId || !title || !dueDateTime || !assigneeEmail) {

      throw new Error("必須パラメータ（actionId, title, dueDateTime, assigneeEmail）が不足しています。");

    }

    // Googleタスクを作成

    const taskResult = createGoogleTask(params);

    // 成功後、AppSheetを更新

    if (taskResult.status === 'SUCCESS') {

      updateActionOnSuccess(actionId, taskResult.taskId, taskResult.taskUrl);

      Logger.log(`処理完了。タスクID ${taskResult.taskId} をAppSheetに記録しました。`);

    } else {

      throw new Error(taskResult.errorMessage || "不明なGoogleタスク作成エラー");

    }

  } catch (error) {

    Logger.log(`doPostでエラーが発生: ${error.toString()}`);

    if (actionId) {

      updateActionOnError(actionId, error.toString());

    }

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

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_通話_タスク作成');
}


/**

 * Googleタスクを作成する

 */

function createGoogleTask(params) {

  const result = { status: 'FAILURE', taskId: null, taskUrl: null, errorMessage: null };

  const { title, details, dueDateTime, assigneeEmail } = params;

  try {

    const tasksScope = ['https://www.googleapis.com/auth/tasks'];

    const servicePrefix = 'TasksImpersonation';

    // 認証

    const tasksService = createOAuth2ServiceForUser(assigneeEmail, tasksScope, servicePrefix);

    const accessToken = getAccessToken(tasksService);

    // Google Tasks API v1のエンドポイント

    const apiUrl = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks';

    // タスクの期限（RFC3339形式に変換）

    const dueDate = new Date(dueDateTime).toISOString();

    const taskResource = {

      'title': title,

      'notes': details,

      'due': dueDate

    };

    const options = {

      method: 'post',

      contentType: 'application/json',

      headers: { 'Authorization': `Bearer ${accessToken}` },

      payload: JSON.stringify(taskResource),

      muteHttpExceptions: true

    };

    const response = UrlFetchApp.fetch(apiUrl, options);

    const responseCode = response.getResponseCode();

    const responseBody = response.getContentText();

    if (responseCode === 200) {

      const createdTask = JSON.parse(responseBody);

      result.status = 'SUCCESS';

      result.taskId = createdTask.id;

      result.taskUrl = createdTask.selfLink; // タスク自体へのAPIリンク

    } else {

      throw new Error(`Google Tasks APIエラー: Status ${responseCode}, Body: ${responseBody}`);

    }

  } catch (e) {

    result.errorMessage = e.message;

    Logger.log(`タスク作成処理でエラー: ${result.errorMessage}`);

  }

  return result;

}


// =================================================================

// AppSheet更新用ヘルパー関数群

// =================================================================


function updateActionOnSuccess(actionId, taskId, taskUrl) {

  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [{

      "action_id": actionId,

      "external_id": taskId,

      "external_url": taskUrl,

      "status": "反映済み"

    }]

  };

  callAppSheetApi(payload);

}

function updateActionOnError(actionId, errorMessage) {

  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [{

      "action_id": actionId,

      "status": "エラー",

      "error_details": `GAS Script Error: ${errorMessage}`

    }]

  };

  callAppSheetApi(payload);

}


function callAppSheetApi(payload) {

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${ACTIONS_TABLE_NAME}/Action`;

  const options = {

    method: 'post',

    contentType: 'application/json',

    headers: { 'ApplicationAccessKey': ACCESS_KEY },

    payload: JSON.stringify(payload),

    muteHttpExceptions: true

  };

  const response = UrlFetchApp.fetch(apiUrl, options);

  Logger.log(`AppSheet API 応答: ${response.getResponseCode()} - ${response.getContentText()}`);

  if (response.getResponseCode() >= 400) {

    throw new Error(`AppSheet API Error: ${response.getResponseCode()} - ${response.getContentText()}`);

  }

}


// =================================================================

// 認証ヘルパー関数群 (Chat投稿用GASから流用)

// =================================================================


function createOAuth2ServiceForUser(userEmail, scopes, serviceNamePrefix, serviceAccountJsonKey = DEFAULT_SERVICE_ACCOUNT_JSON_KEY, callbackFunctionName = DEFAULT_OAUTH_CALLBACK_FUNCTION) {

  const serviceAccountJsonString = PropertiesService.getScriptProperties().getProperty(serviceAccountJsonKey);

  if (!serviceAccountJsonString) throw new Error(`スクリプトプロパティ '${serviceAccountJsonKey}' が設定されていません。`);

  const serviceAccountInfo = JSON.parse(serviceAccountJsonString);

  return OAuth2.createService(`${serviceNamePrefix}:${userEmail}`)

      .setTokenUrl('https://oauth2.googleapis.com/token')

      .setPrivateKey(serviceAccountInfo.private_key)

      .setIssuer(serviceAccountInfo.client_email)

      .setClientId(serviceAccountInfo.client_id)

      .setSubject(userEmail)

      .setScope(scopes.join(' '))

      .setPropertyStore(PropertiesService.getScriptProperties())

      .setCache(CacheService.getScriptCache())

      .setLock(LockService.getScriptLock())

      .setCallbackFunction(callbackFunctionName);

}

function getAccessToken(service) {

  if (!service.hasAccess()) {

    Logger.log(`警告: OAuth2サービスにはアクセス権がありません。最後のエラー: ${service.getLastError()}。トークン取得を試みます。`);

  }

  const accessToken = service.getAccessToken();

  if (!accessToken) {

    throw new Error(`OAuth2アクセストークン取得失敗。最後のエラー: ${service.getLastError()}`);

  }

  return accessToken;

}


function authCallback(request) {

  const service = OAuth2.getService();

  const isAuthorized = service.handleCallback(request);

  const message = isAuthorized ? `認証成功: ${service.getServiceName()}` : `認証失敗: ${service.getLastError()}`;

  return HtmlService.createHtmlOutput(message);

}
