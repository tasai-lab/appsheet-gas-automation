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


// ================================================================================================

// 1. Configuration & Constants (設定と定数)

// ================================================================================================



/**

 * スクリプト全体の設定を管理するオブジェクト

 */

const CONFIG = {

  // 認証設定

  AUTH: {

    SERVICE_ACCOUNT_KEY_PROPERTY: 'SERVICE_ACCOUNT_JSON',

    OAUTH_CALLBACK_FUNCTION: 'authCallback',

    CHAT_SCOPES: ['https://www.googleapis.com/auth/chat.messages']

  },

  // APIリトライ設定

  RETRY_SETTINGS: {

    MAX_ATTEMPTS: 3,

    INITIAL_DELAY_MS: 1000,

    BACKOFF_FACTOR: 2

  },

  // 非同期処理設定

  ASYNC_CONFIG: {

    // [MODIFIED] ワーカーを起動するための内部アクション名を定義

    WORKER_ACTION: 'runWorker',

    QUEUE_KEY: 'CHAT_TASK_QUEUE',

    TASK_DATA_PREFIX: 'CHAT_TASK_DATA_',

    // [MODIFIED] 実行時間制限を4分半に設定 (GASの6分制限に対する安全マージン)

    MAX_EXECUTION_TIME_MS: 270000

  },

  // [MODIFIED] 冪等性（重複実行防止）設定。PropertiesServiceを使用。

  IDEMPOTENCY: {

    PROPERTY_KEY_PREFIX: 'IDEMPOTENCY_STATE_',

    // 完了状態を保持する期間（秒）。AppSheetのリトライ期間より長く設定する。

    COMPLETED_STATE_EXPIRATION_SECONDS: 600, // 10分

    STATE_PROCESSING: 'processing',

    STATE_COMPLETED: 'completed'

  },

  // [NEW] 複数のAppSheetアプリ情報を管理するオブジェクト

  APPSHEET_APPS: {

    // ボディで`appsheetConfigName`が指定されなかった場合のデフォルト設定

    'f-hokan': {

      API_ENDPOINT: 'https://api.appsheet.com/api/v2/apps/',

      APP_ID: 'f40c4b11-b140-4e31-a60c-600f3c9637c8', // TODO: ご自身の情報に書き換えてください

      ACCESS_KEY: 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY', // TODO: ご自身の情報に書き換えてください

      LOCALE: 'ja-JP'

    },

    // 2つ目以降のアプリ設定 (キーが「呼出名称」となる)

    'sales_app': {

      API_ENDPOINT: 'https://api.appsheet.com/api/v2/apps/',

      APP_ID: '営業用アプリのID', // TODO: ご自身の情報に書き換えてください

      ACCESS_KEY: '営業用アプリのAccessKey', // TODO: ご自身の情報に書き換えてください

      LOCALE: 'ja-JP'

    }

    // 必要に応じて、他のアプリ設定をここに追加

  }

};



const STATUS = {

  COMPLETED: '完了',

  ERROR: 'エラー'

};





// ================================================================================================

// 2. Main Entry Points (doPost / doGet)

// ================================================================================================



function doPost(e) {

  const startTime = new Date();

  const responsePayload = {

    status: 'error',

    message: null,

    requestId: null,

    processedAt: new Date().toISOString(),

  };



  try {

    const params = parseAndValidateRequest(e);

    const requestId = params.returnToAppSheet && params.returnToAppSheet.rowId ? params.returnToAppSheet.rowId : `adhoc-${Utilities.getUuid()}`;

    responsePayload.requestId = requestId;



    const idempotencyState = getIdempotencyState(requestId);

    if (idempotencyState === CONFIG.IDEMPOTENCY.STATE_PROCESSING || idempotencyState === CONFIG.IDEMPOTENCY.STATE_COMPLETED) {

      responsePayload.status = 'skipped_duplicate';

      responsePayload.message = `Request for ${requestId} is already processing or has been completed. State: ${idempotencyState}`;

      Logger.log(`[INFO][doPost] 重複リクエストを検出、スキップ: ${requestId}`);

      return createJsonResponse(responsePayload);

    }

    

    setIdempotencyState(requestId, CONFIG.IDEMPOTENCY.STATE_PROCESSING);

    scheduleAsyncTask(requestId, params);



    // [FIXED] .getTime()を削除してエラーを修正

    const duration = new Date() - startTime;

    responsePayload.status = 'accepted';

    responsePayload.message = 'Request accepted for asynchronous processing.';

    Logger.log(`[INFO][doPost] リクエスト受付完了: ${requestId}, 応答時間 = ${duration}ms`);



    return createJsonResponse(responsePayload);



  } catch (error) {

    Logger.log(`[ERROR][doPost] リクエスト受付エラー: ${error.toString()}\nスタックトレース: ${error.stack}`);

    responsePayload.status = 'error';

    responsePayload.message = `Failed to accept request: ${error.message}`;

    if (responsePayload.requestId) {

      deleteIdempotencyState(responsePayload.requestId);

    }

    return createJsonResponse(responsePayload);

  }

}



function doGet(e) {

  if (e.parameter.action !== CONFIG.ASYNC_CONFIG.WORKER_ACTION) {

    return ContentService.createTextOutput("Invalid action.").setMimeType(ContentService.MimeType.TEXT);

  }

  if (e.parameter.token !== PropertiesService.getScriptProperties().getProperty('INTERNAL_EXEC_TOKEN')) {

      Logger.log(`[WARN][doGet] 不正なトークンによるワーカー起動が試みられました。`);

      return ContentService.createTextOutput("Forbidden.").setMimeType(ContentService.MimeType.TEXT);

  }



  const lock = LockService.getScriptLock();

  if (lock.tryLock(10000)) {

    Logger.log('[INFO][doGet] ワーカーの実行ロックを取得しました。処理を開始します。');

    try {

      processTaskQueueWorker();

    } catch(err) {

      Logger.log(`[ERROR][doGet] ワーカー実行中に予期せぬエラーが発生: ${err.stack}`);

    } finally {

      lock.releaseLock();

      Logger.log('[INFO][doGet] ワーカーの実行ロックを解放しました。');

    }

  } else {

    Logger.log('[INFO][doGet] 他のワーカーが実行中のため、この回の起動はスキップします。');

  }



  return ContentService.createTextOutput("Worker process initiated.").setMimeType(ContentService.MimeType.TEXT);

}



function parseAndValidateRequest(e) {

  if (!e || !e.postData || !e.postData.contents) throw new Error("Invalid request body.");

  let params;

  try {

    params = JSON.parse(e.postData.contents);

  } catch (error) {

    throw new Error("Failed to parse JSON payload.");

  }

  if (!params.targetSpaceId && !params.targetThreadId) {

     throw new Error("Either targetSpaceId or targetThreadId must be provided.");

  }

  if (!params.appsheetConfigName) {

      params.appsheetConfigName = 'default';

  }

  if (!CONFIG.APPSHEET_APPS[params.appsheetConfigName]) {

      throw new Error(`指定されたappsheetConfigName '${params.appsheetConfigName}' はCONFIG内に存在しません。`);

  }

  return params;

}



// ================================================================================================

// 3. Async Task Management (キュー管理とスケジューリング)

// ================================================================================================



function scheduleAsyncTask(requestId, params) {

  const scriptProperties = PropertiesService.getScriptProperties();

  const propKey = CONFIG.ASYNC_CONFIG.TASK_DATA_PREFIX + requestId;



  try {

    scriptProperties.setProperty(propKey, JSON.stringify(params));

  } catch (e) {

    deleteIdempotencyState(requestId);

    throw new Error(`タスクデータの保存に失敗: ${e.toString()}`);

  }



  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(10000);

    const queue = JSON.parse(scriptProperties.getProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY) || '[]');

    if (!queue.includes(requestId)) {

      queue.push(requestId);

      scriptProperties.setProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY, JSON.stringify(queue));

    }

  } catch(e) {

    scriptProperties.deleteProperty(propKey);

    deleteIdempotencyState(requestId);

    throw new Error("ロック競合によりタスクのスケジュールに失敗。");

  } finally {

    lock.releaseLock();

  }

  

  triggerWorkerAsynchronously();

}



function triggerWorkerAsynchronously() {

    const scriptProperties = PropertiesService.getScriptProperties();

    let token = scriptProperties.getProperty('INTERNAL_EXEC_TOKEN');

    if (!token) {

        token = Utilities.getUuid();

        scriptProperties.setProperty('INTERNAL_EXEC_TOKEN', token);

    }



    const url = ScriptApp.getService().getUrl() + `?action=${CONFIG.ASYNC_CONFIG.WORKER_ACTION}&token=${token}`;

    const options = {

        method: 'get',

        headers: {

            'Authorization': 'Bearer ' + ScriptApp.getIdentityToken()

        },

        muteHttpExceptions: true

    };

    

    UrlFetchApp.fetch(url, options);

    Logger.log('[INFO][Async] 自己呼び出しWebhookでワーカーの起動をリクエストしました。');

}



function getNextTaskFromQueue() {

  const scriptProperties = PropertiesService.getScriptProperties();

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(10000);

    const queue = JSON.parse(scriptProperties.getProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY) || '[]');

    if (queue.length === 0) return null;

    const requestId = queue.shift();

    scriptProperties.setProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY, JSON.stringify(queue));

    return requestId;

  } catch (e) {

    Logger.log("[ERROR][Async] デキューのためのロック取得に失敗: " + e.toString());

    return null;

  } finally {

    lock.releaseLock();

  }

}



// ================================================================================================

// 4. Background Worker (ワーカー関数 - 非同期実行)

// ================================================================================================



function processTaskQueueWorker() {

  const startTime = new Date();

  let processedCount = 0;



  while ((new Date() - startTime) < CONFIG.ASYNC_CONFIG.MAX_EXECUTION_TIME_MS) {

    const requestId = getNextTaskFromQueue();

    if (!requestId) {

      Logger.log(`[INFO][Worker] キューが空です。ワーカーを終了します。処理件数: ${processedCount}`);

      break;

    }



    Logger.log(`[INFO][Worker] タスク処理開始: ${requestId}`);

    const taskData = getTaskData(requestId);



    if (taskData) {

      executeTask(requestId, taskData);

      processedCount++;

    } else {

      Logger.log(`[WARN][Worker] タスクデータが見つかりません: ${requestId}。スキップします。`);

      cleanupTask(requestId, true);

    }

    

    if ((new Date() - startTime) > CONFIG.ASYNC_CONFIG.MAX_EXECUTION_TIME_MS) {

        Logger.log('[INFO][Worker] 実行時間制限が近づいたため、ワーカーを停止します。');

        break;

    }

  }



  const queue = JSON.parse(PropertiesService.getScriptProperties().getProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY) || '[]');

  if (queue.length > 0) {

    Logger.log(`[INFO][Worker] 残存タスクがあります (${queue.length}件)。ワーカーを再スケジュールします。`);

    triggerWorkerAsynchronously();

  }

}



function executeTask(requestId, params) {

  const startTime = new Date();

  const returnToAppSheet = params.returnToAppSheet;

  let hasError = false;



  try {

    const chatResult = postMessageToChat(params); // エラーが発生していた箇所

    if (chatResult.status !== 'success') {

      throw new Error(chatResult.errorMessage || 'Unknown error during chat posting.');

    }

    Logger.log(`[INFO][Worker] メッセージ投稿成功: ${chatResult.sentMessageId}`);



    if (returnToAppSheet && returnToAppSheet.rowId) {

      const successData = {

        [returnToAppSheet.returnColumnName]: chatResult.sentMessageId,

        [returnToAppSheet.statusColumnName]: STATUS.COMPLETED,

      };

      writeResultToAppSheet(params.appsheetConfigName, returnToAppSheet, successData);

    }

  } catch (error) {

    hasError = true;

    Logger.log(`[FATAL ERROR][Worker] タスク失敗: ${requestId} - ${error.toString()}\nスタックトレース: ${error.stack}`);

    if (returnToAppSheet && returnToAppSheet.rowId) {

      try {

        const errorData = {

          [returnToAppSheet.statusColumnName]: STATUS.ERROR,

          [returnToAppSheet.errorColumnName]: error.message.substring(0, 1024),

        };

        writeResultToAppSheet(params.appsheetConfigName, returnToAppSheet, errorData);

      } catch (updateError) {

        Logger.log(`[ERROR][Worker] AppSheetへのエラー状態の更新にも失敗: ${updateError.toString()}`);

      }

    }

  } finally {

      cleanupTask(requestId, hasError);

      const duration = (new Date() - startTime) / 1000;

      Logger.log(`[INFO][Worker] タスク処理完了: ${requestId}, 処理時間 = ${duration}秒, エラー有無: ${hasError}`);

  }

}



// ================================================================================================

// 5. Google Chat Integration (Chat連携機能) - [RESTORED] 復元セクション

// ================================================================================================



function postMessageToChat(params) {

  try {

    const cleanedMessageText = (params.messageText || '')

      .replace(/<br>/g, '\n').replace(/\\n/g, '\n').replace(/\*\*/g, '*').replace(/\* /g, '* ');

    const chatPayload = buildChatApiPayload(params.targetThreadId, params.targetSpaceId, cleanedMessageText);

    const postResult = executeChatPost(chatPayload.apiUrl, chatPayload.messageResource, params.impersonatingUserEmail);

    return { ...postResult, actionType: chatPayload.actionType };

  } catch (error) {

    Logger.log(`[ERROR][postMessageToChat] Chat投稿準備中または実行中にエラー: ${error.stack}`);

    return { status: 'failure', sentMessageId: null, errorMessage: error.message, actionType: 'UNKNOWN' };

  }

}



function buildChatApiPayload(targetThreadId, targetSpaceId, messageText) {

  const messageResource = { text: messageText };

  let apiUrl = '';

  let actionType = 'UNKNOWN';



  if (targetThreadId) {

    actionType = 'REPLY_TO_THREAD';

    let spaceName = '';

    if (targetThreadId.includes('/messages/')) {

      if (typeof Chat === 'undefined' || !Chat.Spaces || !Chat.Spaces.Messages) {

        throw new Error("Google Chat API (高度なサービス) が有効になっていません。");

      }

      Logger.log("[INFO][Chat] 高度なサービスを使用してスレッド情報を取得中...");

      try {

        const messageInfo = Chat.Spaces.Messages.get(targetThreadId);

        if (!messageInfo || !messageInfo.thread || !messageInfo.thread.name) {

          throw new Error(`有効なスレッド情報を取得できませんでした。`);

        }

        messageResource.thread = { name: messageInfo.thread.name };

        spaceName = messageInfo.space.name;

      } catch (e) {

        throw new Error(`Chat API (高度なサービス)での情報取得に失敗: ${targetThreadId}. 詳細: ${e.toString()}`);

      }

    } else if (targetThreadId.includes('/threads/')) {

      messageResource.thread = { name: targetThreadId };

      spaceName = targetThreadId.split('/threads/')[0];

    } else {

      throw new Error(`無効なtargetThreadId形式: ${targetThreadId}`);

    }

    apiUrl = `https://chat.googleapis.com/v1/${spaceName}/messages?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;

  } else if (targetSpaceId && targetSpaceId.startsWith('spaces/')) {

    actionType = 'CREATE_NEW_THREAD';

    messageResource.thread = { threadKey: `thread-${Utilities.getUuid()}` };

    apiUrl = `https://chat.googleapis.com/v1/${targetSpaceId}/messages`;

  } else {

    throw new Error('無効なID形式です。targetThreadIdまたはtargetSpaceIdが正しくありません。');

  }

  return { apiUrl, messageResource, actionType };

}



function executeChatPost(apiUrl, messageResource, impersonatingUserEmail) {

  const chatService = createOAuth2ServiceForUser(impersonatingUserEmail, CONFIG.AUTH.CHAT_SCOPES, 'ChatImpersonation');

  const accessToken = getAccessToken(chatService);

  const options = {

    method: 'post',

    contentType: 'application/json',

    headers: { Authorization: `Bearer ${accessToken}` },

    payload: JSON.stringify(messageResource)

  };

  const response = fetchWithRetry(apiUrl, options, "Google Chat API (UrlFetch)");

  const sentMessage = JSON.parse(response.getContentText());

  return { status: 'success', sentMessageId: sentMessage.name, errorMessage: null };

}



// ================================================================================================

// 6. AppSheet Integration (AppSheet連携機能)

// ================================================================================================



function writeResultToAppSheet(configName, returnConfig, dataToUpdate) {

  const appConfig = CONFIG.APPSHEET_APPS[configName];

  if (!appConfig) throw new Error(`AppSheet設定 '${configName}' が見つかりません。`);

  if (!returnConfig || !returnConfig.rowId || !returnConfig.keyColumnName || !returnConfig.tableName) {

    Logger.log('[WARN][AppSheet] 書き戻し設定が不足しているためスキップ。Config: ' + JSON.stringify(returnConfig));

    return;

  }

  const rowData = { [returnConfig.keyColumnName]: returnConfig.rowId };

  for (const columnName in dataToUpdate) {

    if (columnName && typeof columnName === 'string' && columnName !== 'null' && columnName !== 'undefined') {

      rowData[columnName] = dataToUpdate[columnName];

    }

  }

  if (Object.keys(rowData).length <= 1) {

    Logger.log('[INFO][AppSheet] 書き戻す有効なデータがないためスキップしました。');

    return;

  }

  const payload = { Action: "Edit", Properties: { "Locale": appConfig.LOCALE }, Rows: [rowData] };

  const apiUrl = `${appConfig.API_ENDPOINT}${appConfig.APP_ID}/tables/${encodeURIComponent(returnConfig.tableName)}/Action`;

  const options = {

    method: 'post',

    contentType: 'application/json',

    headers: { 'ApplicationAccessKey': appConfig.ACCESS_KEY },

    payload: JSON.stringify(payload)

  };

  try {

    fetchWithRetry(apiUrl, options, "AppSheet API");

    Logger.log(`[INFO][AppSheet] AppSheetへの書き戻し成功 (App: ${configName})`);

  } catch (error) {

    throw new Error(`AppSheet API (App: ${configName}) の呼び出しに失敗: ${error.message}`);

  }

}



// ================================================================================================

// 7. Authentication (OAuth2認証ヘルパー) - [RESTORED] 復元セクション

// ================================================================================================



function createOAuth2ServiceForUser(userEmail, scopes, serviceNamePrefix) {

  const serviceAccountJsonString = PropertiesService.getScriptProperties().getProperty(CONFIG.AUTH.SERVICE_ACCOUNT_KEY_PROPERTY);

  if (!serviceAccountJsonString) throw new Error(`スクリプトプロパティ '${CONFIG.AUTH.SERVICE_ACCOUNT_KEY_PROPERTY}' が設定されていません。`);

  if (typeof OAuth2 === 'undefined') throw new Error("OAuth2ライブラリ(ID: 1B7FSrk570L1R1ODA5zhI_e4q5MMaI9iCxzaVW8CImMrGF_F3i3Vmfap_)を追加してください。");

  const serviceAccountInfo = JSON.parse(serviceAccountJsonString);

  const serviceName = `${serviceNamePrefix}:${userEmail}`;



  return OAuth2.createService(serviceName)

    .setTokenUrl('https://oauth2.googleapis.com/token')

    .setPrivateKey(serviceAccountInfo.private_key)

    .setIssuer(serviceAccountInfo.client_email)

    .setClientId(serviceAccountInfo.client_id)

    .setSubject(userEmail)

    .setScope(scopes.join(' '))

    .setPropertyStore(PropertiesService.getScriptProperties())

    .setCache(CacheService.getScriptCache())

    .setLock(LockService.getScriptLock())

    .setCallbackFunction(CONFIG.AUTH.OAUTH_CALLBACK_FUNCTION);

}



function getAccessToken(service) {

  if (service.hasAccess()) {

    return service.getAccessToken();

  } else {

    const error = service.getLastError();

    Logger.log(`[ERROR][Auth] アクセストークンの取得に失敗: ${JSON.stringify(error)}`);

    throw new Error(`OAuth2認証に失敗: ${JSON.stringify(error)}`);

  }

}



function authCallback(request) {

  const service = OAuth2.getService();

  const isAuthorized = service.handleCallback(request);

  return HtmlService.createHtmlOutput(isAuthorized ? `認証成功。` : `認証拒否。`);

}



// ================================================================================================

// 8. Utilities (ユーティリティ関数)

// ================================================================================================



// --- 冪等性ヘルパー (PropertiesService版) ---

function getIdempotencyState(requestId) {

    const scriptProperties = PropertiesService.getScriptProperties();

    const key = CONFIG.IDEMPOTENCY.PROPERTY_KEY_PREFIX + requestId;

    const data = scriptProperties.getProperty(key);

    if (!data) return null;

    const parsed = JSON.parse(data);

    if (parsed.state === CONFIG.IDEMPOTENCY.STATE_COMPLETED) {

        const now = new Date().getTime();

        const expirationTime = parsed.timestamp + (CONFIG.IDEMPOTENCY.COMPLETED_STATE_EXPIRATION_SECONDS * 1000);

        if (now > expirationTime) {

            scriptProperties.deleteProperty(key);

            return null;

        }

    }

    return parsed.state;

}

function setIdempotencyState(requestId, state) {

    const scriptProperties = PropertiesService.getScriptProperties();

    const key = CONFIG.IDEMPOTENCY.PROPERTY_KEY_PREFIX + requestId;

    const data = { state: state, timestamp: new Date().getTime() };

    scriptProperties.setProperty(key, JSON.stringify(data));

}

function deleteIdempotencyState(requestId) {

    const scriptProperties = PropertiesService.getScriptProperties();

    const key = CONFIG.IDEMPOTENCY.PROPERTY_KEY_PREFIX + requestId;

    scriptProperties.deleteProperty(key);

}



// --- 非同期ヘルパー ---

function getTaskData(requestId) {

  const scriptProperties = PropertiesService.getScriptProperties();

  const propKey = CONFIG.ASYNC_CONFIG.TASK_DATA_PREFIX + requestId;

  const data = scriptProperties.getProperty(propKey);

  return data ? JSON.parse(data) : null;

}

function cleanupTask(requestId, hasError) {

  if (hasError) {

      deleteIdempotencyState(requestId);

  } else {

      setIdempotencyState(requestId, CONFIG.IDEMPOTENCY.STATE_COMPLETED);

  }

  const scriptProperties = PropertiesService.getScriptProperties();

  const propKey = CONFIG.ASYNC_CONFIG.TASK_DATA_PREFIX + requestId;

  scriptProperties.deleteProperty(propKey);

}



// --- APIリトライヘルパー - [RESTORED] 復元セクション ---

class ApiError extends Error {

  constructor(message, statusCode) { super(message); this.name = "ApiError"; this.statusCode = statusCode; }

}

function fetchWithRetry(url, options, apiName) {

  const settings = CONFIG.RETRY_SETTINGS;

  let attempts = 0;

  let delay = settings.INITIAL_DELAY_MS;

  const fetchOptions = { ...options, muteHttpExceptions: true };

  while (attempts < settings.MAX_ATTEMPTS) {

    attempts++;

    try {

      const response = UrlFetchApp.fetch(url, fetchOptions);

      const responseCode = response.getResponseCode();

      if (responseCode >= 200 && responseCode < 300) {

        Logger.log(`[INFO][API] ${apiName} 呼び出し成功 (試行回数: ${attempts})`);

        return response;

      }

      if (responseCode >= 500 || responseCode === 429) {

        Logger.log(`[WARN][API] ${apiName} リトライ可能なエラー発生 (Code: ${responseCode}, 試行回数: ${attempts}/${settings.MAX_ATTEMPTS})。`);

        if (attempts < settings.MAX_ATTEMPTS) {

          sleepWithJitter(delay);

          delay *= settings.BACKOFF_FACTOR;

          continue;

        }

      }

      const errorMsg = `[${apiName}] APIリクエスト失敗 (Code: ${responseCode}): ${response.getContentText().substring(0, 500)}`;

      Logger.log(`[ERROR][API] ${errorMsg}`);

      throw new ApiError(errorMsg, responseCode);

    } catch (error) {

      if (error instanceof ApiError) throw error;

      Logger.log(`[WARN][API] ${apiName} リクエスト中に例外発生 (試行回数: ${attempts}/${settings.MAX_ATTEMPTS}): ${error.toString()}`);

      if (error.message.includes("Invalid argument")) throw new Error(`[${apiName}] 無効な引数: ${error.toString()}`);

      if (attempts < settings.MAX_ATTEMPTS) {

        sleepWithJitter(delay);

        delay *= settings.BACKOFF_FACTOR;

        continue;

      }

      throw new Error(`[${apiName}] 最大試行回数 (${settings.MAX_ATTEMPTS}) を超えても失敗: ${error.toString()}`);

    }

  }

}

function sleepWithJitter(delayMs) {

  const jitter = Math.random() * 500;

  const totalDelay = delayMs + jitter;

  Logger.log(`[INFO][API] ${totalDelay.toFixed(0)}ミリ秒待機後、リトライします...`);

  Utilities.sleep(totalDelay);

}

function createJsonResponse(data) {

  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);

}