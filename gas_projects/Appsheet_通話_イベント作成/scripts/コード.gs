/**
 * 実行ログモジュール
 */
const ExecutionLogger = {
  SPREADSHEET_ID: '15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE',
  SHEET_NAME: 'シート1',
  
  /**
   * ログを記録
   * @param {string} scriptName - スクリプト名
   * @param {string} status - ステータス (SUCCESS/ERROR/WARNING)
   * @param {string} processId - 処理ID
   * @param {string} message - メッセージ
   * @param {string} errorDetail - エラー詳細
   * @param {number} executionTime - 実行時間(秒)
   * @param {Object} inputData - 入力データ
   */
  log: function(scriptName, status, processId, message, errorDetail, executionTime, inputData) {
    try {
      const ss = SpreadsheetApp.openById(this.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(this.SHEET_NAME);
      
      const timestamp = new Date();
      const user = Session.getActiveUser().getEmail();
      const inputDataStr = inputData ? JSON.stringify(inputData).substring(0, 1000) : '';
      
      sheet.appendRow([
        timestamp,
        scriptName,
        status,
        processId || '',
        message || '',
        errorDetail || '',
        executionTime || 0,
        user,
        inputDataStr
      ]);
    } catch (e) {
      Logger.log(`ログ記録エラー: ${e.message}`);
    }
  },
  
  /**
   * 成功ログ
   */
  success: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'SUCCESS', processId, message, '', executionTime, inputData);
  },
  
  /**
   * エラーログ
   */
  error: function(scriptName, processId, message, error, executionTime, inputData) {
    const errorDetail = error ? `${error.message}\n${error.stack}` : '';
    this.log(scriptName, 'ERROR', processId, message, errorDetail, executionTime, inputData);
  },
  
  /**
   * 警告ログ
   */
  warning: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'WARNING', processId, message, '', executionTime, inputData);
  }
};


/**
 * Webhook重複実行防止モジュール
 */
const DuplicationPrevention = {
  LOCK_TIMEOUT: 300000, // 5分
  CACHE_EXPIRATION: 3600, // 1時間
  
  /**
   * リクエストの重複チェック
   * @param {string} requestId - リクエストID（webhookデータのハッシュ値）
   * @return {boolean} - 処理を続行する場合はtrue
   */
  checkDuplicate: function(requestId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `processed_${requestId}`;
    
    // キャッシュチェック
    if (cache.get(cacheKey)) {
      Logger.log(`重複リクエストを検出: ${requestId}`);
      return false;
    }
    
    // ロック取得
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(this.LOCK_TIMEOUT);
      
      // 再度キャッシュチェック（ダブルチェック）
      if (cache.get(cacheKey)) {
        Logger.log(`ロック取得後、重複リクエストを検出: ${requestId}`);
        return false;
      }
      
      // 処理済みマークを設定
      cache.put(cacheKey, 'processed', this.CACHE_EXPIRATION);
      return true;
    } catch (e) {
      Logger.log(`ロック取得エラー: ${e.message}`);
      return false;
    } finally {
      lock.releaseLock();
    }
  },
  
  /**
   * リクエストIDを生成
   * @param {Object} data - Webhookデータ
   * @return {string} - リクエストID
   */
  generateRequestId: function(data) {
    const str = JSON.stringify(data);
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      str,
      Utilities.Charset.UTF_8
    ).map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
  }
};


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
  const params = JSON.parse(e.postData.contents);
  return processRequest(params);
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

    const { title, details, startDateTime, endDateTime, assigneeEmail } = params;

    if (!actionId || !title || !startDateTime || !endDateTime || !assigneeEmail) {

      throw new Error("必須パラメータ（actionId, title, startDateTime, endDateTime, assigneeEmail）が不足しています。");

    }



    // Googleカレンダーにイベントを作成

    const eventResult = createGoogleCalendarEvent(params);

    

    // 成功後、AppSheetを更新

    if (eventResult.status === 'SUCCESS') {

      updateActionOnSuccess(actionId, eventResult.eventId, eventResult.eventUrl);

      Logger.log(`処理完了。イベントID ${eventResult.eventId} をAppSheetに記録しました。`);

    } else {

      throw new Error(eventResult.errorMessage || "不明なGoogleカレンダーイベント作成エラー");

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
    // 例: callId: "test-123",
    // 例: recordId: "rec-456",
    // 例: action: "CREATE"
  };

  console.log('=== テスト実行: Appsheet_通話_イベント作成 ===');
  console.log('入力パラメータ:', JSON.stringify(testParams, null, 2));

  try {
    const result = processRequest(testParams);
    console.log('処理成功:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('処理エラー:', error.message);
    console.error('スタックトレース:', error.stack);
    throw error;
  }
}




/**

 * Googleカレンダーにイベントを作成する

 */

function createGoogleCalendarEvent(params) {

  const result = { status: 'FAILURE', eventId: null, eventUrl: null, errorMessage: null };

  const { title, details, startDateTime, endDateTime, assigneeEmail, rowUrl } = params;



  try {

    const calendarScope = ['https://www.googleapis.com/auth/calendar'];

    const servicePrefix = 'CalendarImpersonation';



    // 認証

    const calendarService = createOAuth2ServiceForUser(assigneeEmail, calendarScope, servicePrefix);

    const accessToken = getAccessToken(calendarService);



    const apiUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';



    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

    // ★ 修正箇所 ★

    // AppSheetから送られてくるHTMLタグから、URL部分だけを抽出する

    let cleanUrl = rowUrl || '';

    if (cleanUrl.startsWith('<a href=')) {

      cleanUrl = cleanUrl.split('"')[1]; // 最初のダブルクォーテーションで区切って2番目の要素（URL）を取得

    }

    const descriptionText = `${details || ''}\n\nAppSheetで詳細を確認:\n${cleanUrl}`;

    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★



    // イベントリソースを作成

    const eventResource = {

      'summary': title,

      'description': descriptionText, // 修正したテキストを使用

      'start': {

        'dateTime': new Date(startDateTime).toISOString(),

        'timeZone': 'Asia/Tokyo'

      },

      'end': {

        'dateTime': new Date(endDateTime).toISOString(),

        'timeZone': 'Asia/Tokyo'

      }

    };



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

      result.eventId = createdEvent.id;

      result.eventUrl = createdEvent.htmlLink;

    } else {

      throw new Error(`Google Calendar APIエラー: Status ${responseCode}, Body: ${responseBody}`);

    }

  } catch (e) {

    result.errorMessage = e.message;

    Logger.log(`イベント作成処理でエラー: ${result.errorMessage}`);

  }

  return result;

}





// =================================================================

// AppSheet更新用ヘルパー関数群

// =================================================================



function updateActionOnSuccess(actionId, eventId, eventUrl) {

  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [{

      "action_id": actionId,

      "external_id": eventId,

      "external_url": eventUrl,

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

// 認証ヘルパー関数群 (流用)

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