/**
 * 通話イベント・タスク作成統合スクリプト
 * - action_typeパラメータで「イベント」または「タスク」を判別
 * - 英語('event'/'task')と日本語('イベント'/'タスク')の両方に対応
 * - 日時は日本時間(JST)で処理（タイムゾーン: Asia/Tokyo）
 * - Googleカレンダーイベント作成
 * - Googleタスク作成
 * 
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-17
 */

// --- 基本設定 ---
const APP_ID = '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f';
const ACCESS_KEY = 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT';
const ACTIONS_TABLE_NAME = 'Call_Actions';
const DEFAULT_SERVICE_ACCOUNT_JSON_KEY = 'SERVICE_ACCOUNT_JSON';
const DEFAULT_OAUTH_CALLBACK_FUNCTION = 'authCallback';

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
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

/**
 * メイン処理関数（統合版）
 * @param {string} actionId - アクションID
 * @param {string} actionType - アクションタイプ（'event'/'イベント' または 'task'/'タスク'）
 * @param {string} title - タイトル
 * @param {string} details - 詳細
 * @param {string} startDateTime - 開始日時（イベント用、日本時間JST ISO形式）
 * @param {string} endDateTime - 終了日時（イベント用、日本時間JST ISO形式）
 * @param {string} dueDateTime - 期限日時（タスク用、日本時間JST ISO形式）
 * @param {string} assigneeEmail - 担当者メールアドレス
 * @param {string} rowUrl - AppSheet行URL
 * @return {Object} 処理結果
 */
function processRequest(
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
  Logger.log(`[処理開始] actionId: ${actionId}, actionType: ${actionType}, title: ${title}`);
  
  try {
    // 基本パラメータ検証
    if (!actionId || !actionType || !title || !assigneeEmail) {
      throw new Error('必須パラメータ（actionId, actionType, title, assigneeEmail）が不足しています');
    }
    
    // actionTypeの正規化
    const normalizedActionType = (actionType || '').toLowerCase().trim();
    
    let result;
    
    // アクションタイプによる分岐（日本語にも対応）
    if (normalizedActionType === 'event' || normalizedActionType === 'イベント') {
      Logger.log('[処理モード] Googleカレンダーイベント作成');
      
      // イベント用パラメータ検証
      if (!startDateTime || !endDateTime) {
        throw new Error('イベント作成には startDateTime と endDateTime が必要です');
      }
      
      result = createGoogleCalendarEvent({
        title,
        details,
        startDateTime,
        endDateTime,
        assigneeEmail,
        rowUrl
      });
      
    } else if (normalizedActionType === 'task' || normalizedActionType === 'タスク') {
      Logger.log('[処理モード] Googleタスク作成');
      
      // タスク用パラメータ検証
      if (!dueDateTime) {
        throw new Error('タスク作成には dueDateTime が必要です');
      }
      
      result = createGoogleTask({
        title,
        details,
        dueDateTime,
        assigneeEmail
      });
      
    } else {
      throw new Error(`未対応のアクションタイプ: ${actionType}（'event'/'イベント' または 'task'/'タスク' を指定してください）`);
    }
    
    // 成功時のAppSheet更新
    if (result.status === 'SUCCESS') {
      updateActionOnSuccess(actionId, result.externalId, result.externalUrl);
      Logger.log(`[処理完了] ${normalizedActionType} ID: ${result.externalId}`);
      
      return {
        success: true,
        actionId: actionId,
        actionType: normalizedActionType,
        externalId: result.externalId,
        externalUrl: result.externalUrl
      };
      
    } else {
      throw new Error(result.errorMessage || '不明なエラー');
    }
    
  } catch (error) {
    Logger.log(`[エラー] ${error.message}`);
    
    if (actionId) {
      updateActionOnError(actionId, error.message);
    }
    
    return {
      success: false,
      actionId: actionId,
      error: error.message
    };
  }
}

/**
 * テスト用関数: イベント作成（英語パラメータ）
 * GASエディタから実行してテスト可能
 */
function testProcessRequestEvent() {
  const now = new Date();
  const start = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 明日
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1時間後
  
  const testParams = {
    actionId: 'test_event_' + now.getTime(),
    actionType: 'event', // 英語パラメータ
    title: 'テストイベント',
    details: 'これはテスト用のイベントです（日本時間JST）',
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    assigneeEmail: 'test@example.com', // ★要変更
    rowUrl: 'https://appsheet.com/sample'
  };
  
  Logger.log('[テスト:イベント] パラメータ:', JSON.stringify(testParams, null, 2));
  
  return processRequest(
    testParams.actionId,
    testParams.actionType,
    testParams.title,
    testParams.details,
    testParams.startDateTime,
    testParams.endDateTime,
    null,
    testParams.assigneeEmail,
    testParams.rowUrl
  );
}

/**
 * テスト用関数: タスク作成（日本語パラメータ）
 * GASエディタから実行してテスト可能
 */
function testProcessRequestTask() {
  const now = new Date();
  const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1週間後
  
  const testParams = {
    actionId: 'test_task_' + now.getTime(),
    actionType: 'タスク', // 日本語パラメータ
    title: 'テストタスク',
    details: 'これはテスト用のタスクです（日本時間JST）',
    dueDateTime: due.toISOString(),
    assigneeEmail: 'test@example.com' // ★要変更
  };
  
  Logger.log('[テスト:タスク] パラメータ:', JSON.stringify(testParams, null, 2));
  
  return processRequest(
    testParams.actionId,
    testParams.actionType,
    testParams.title,
    testParams.details,
    null,
    null,
    testParams.dueDateTime,
    testParams.assigneeEmail,
    null
  );
}

// =================================================================
// Googleカレンダーイベント作成
// =================================================================

/**
 * Googleカレンダーにイベントを作成
 * @param {Object} params
 * @return {Object} 処理結果
 */
function createGoogleCalendarEvent(params) {
  const result = {
    status: 'FAILURE',
    externalId: null,
    externalUrl: null,
    errorMessage: null
  };
  
  const { title, details, startDateTime, endDateTime, assigneeEmail, rowUrl } = params;
  
  try {
    const calendarScope = ['https://www.googleapis.com/auth/calendar'];
    const servicePrefix = 'CalendarImpersonation';
    
    // 認証
    const calendarService = createOAuth2ServiceForUser(assigneeEmail, calendarScope, servicePrefix);
    const accessToken = getAccessToken(calendarService);
    
    const apiUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    
    // AppSheetのHTMLタグからURL抽出
    let cleanUrl = rowUrl || '';
    if (cleanUrl.startsWith('<a href=')) {
      cleanUrl = cleanUrl.split('"')[1];
    }
    
    const descriptionText = `${details || ''}\n\nAppSheetで詳細を確認:\n${cleanUrl}`;
    
    // 日本時間(JST)の日時オブジェクトを作成
    const startDateJST = new Date(startDateTime);
    const endDateJST = new Date(endDateTime);
    
    // イベントリソース作成（タイムゾーンを明示的にAsia/Tokyoに設定）
    const eventResource = {
      'summary': title,
      'description': descriptionText,
      'start': {
        'dateTime': startDateJST.toISOString(),
        'timeZone': 'Asia/Tokyo'
      },
      'end': {
        'dateTime': endDateJST.toISOString(),
        'timeZone': 'Asia/Tokyo'
      }
    };
    
    Logger.log(`[カレンダー] イベント作成 - 開始: ${startDateJST.toISOString()}, 終了: ${endDateJST.toISOString()}`);
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      payload: JSON.stringify(eventResource),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    if (responseCode === 200) {
      const createdEvent = JSON.parse(responseBody);
      result.status = 'SUCCESS';
      result.externalId = createdEvent.id;
      result.externalUrl = createdEvent.htmlLink;
      Logger.log(`[イベント作成成功] ID: ${result.externalId}`);
    } else {
      throw new Error(`Google Calendar APIエラー: Status ${responseCode}, Body: ${responseBody}`);
    }
    
  } catch (e) {
    result.errorMessage = e.message;
    Logger.log(`[イベント作成エラー] ${result.errorMessage}`);
  }
  
  return result;
}

// =================================================================
// Googleタスク作成
// =================================================================

/**
 * Googleタスクを作成
 * @param {Object} params
 * @return {Object} 処理結果
 */
function createGoogleTask(params) {
  const result = {
    status: 'FAILURE',
    externalId: null,
    externalUrl: null,
    errorMessage: null
  };
  
  const { title, details, dueDateTime, assigneeEmail } = params;
  
  try {
    const tasksScope = ['https://www.googleapis.com/auth/tasks'];
    const servicePrefix = 'TasksImpersonation';
    
    // 認証
    const tasksService = createOAuth2ServiceForUser(assigneeEmail, tasksScope, servicePrefix);
    const accessToken = getAccessToken(tasksService);
    
    const apiUrl = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks';
    
    // タスクの期限（日本時間でRFC3339形式）
    // Google Tasks APIは日付のみを使用（時刻は無視される）
    const dueDateJST = new Date(dueDateTime);
    const dueDateRFC3339 = dueDateJST.toISOString();
    
    const taskResource = {
      'title': title,
      'notes': details || '',
      'due': dueDateRFC3339
    };
    
    Logger.log(`[タスク] タスク作成 - 期限: ${dueDateRFC3339} (JST)`);
    
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
      result.externalId = createdTask.id;
      result.externalUrl = createdTask.selfLink;
      Logger.log(`[タスク作成成功] ID: ${result.externalId}`);
    } else {
      throw new Error(`Google Tasks APIエラー: Status ${responseCode}, Body: ${responseBody}`);
    }
    
  } catch (e) {
    result.errorMessage = e.message;
    Logger.log(`[タスク作成エラー] ${result.errorMessage}`);
  }
  
  return result;
}

// =================================================================
// AppSheet更新ヘルパー関数
// =================================================================

/**
 * 成功時のAppSheet更新
 */
function updateActionOnSuccess(actionId, externalId, externalUrl) {
  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [{
      "action_id": actionId,
      "external_id": externalId,
      "external_url": externalUrl,
      "status": "反映済み"
    }]
  };
  
  callAppSheetApi(payload);
}

/**
 * エラー時のAppSheet更新
 */
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

/**
 * AppSheet API呼び出し
 */
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
  Logger.log(`[AppSheet API] ${response.getResponseCode()} - ${response.getContentText()}`);
  
  if (response.getResponseCode() >= 400) {
    throw new Error(`AppSheet API Error: ${response.getResponseCode()} - ${response.getContentText()}`);
  }
}

// =================================================================
// OAuth2認証ヘルパー関数
// =================================================================

/**
 * ユーザー代理OAuth2サービス作成
 */
function createOAuth2ServiceForUser(
  userEmail,
  scopes,
  serviceNamePrefix,
  serviceAccountJsonKey = DEFAULT_SERVICE_ACCOUNT_JSON_KEY,
  callbackFunctionName = DEFAULT_OAUTH_CALLBACK_FUNCTION
) {
  const serviceAccountJsonString = PropertiesService.getScriptProperties().getProperty(serviceAccountJsonKey);
  if (!serviceAccountJsonString) {
    throw new Error(`スクリプトプロパティ '${serviceAccountJsonKey}' が設定されていません`);
  }
  
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

/**
 * アクセストークン取得
 */
function getAccessToken(service) {
  if (!service.hasAccess()) {
    Logger.log(`[OAuth2警告] アクセス権なし。最後のエラー: ${service.getLastError()}`);
  }
  
  const accessToken = service.getAccessToken();
  if (!accessToken) {
    throw new Error(`OAuth2アクセストークン取得失敗。最後のエラー: ${service.getLastError()}`);
  }
  
  return accessToken;
}

/**
 * OAuth2コールバック
 */
function authCallback(request) {
  const service = OAuth2.getService();
  const isAuthorized = service.handleCallback(request);
  const message = isAuthorized 
    ? `認証成功: ${service.getServiceName()}` 
    : `認証失敗: ${service.getLastError()}`;
  return HtmlService.createHtmlOutput(message);
}
