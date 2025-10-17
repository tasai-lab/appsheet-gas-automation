





// ================================================================================================

// 1. Configuration (設定)

// ================================================================================================



const CONFIG = {

  GEMINI: {

    API_KEY: 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY', // ★要設定: Gemini APIキー

    MODEL_NAME: 'gemini-2.5-pro',

    API_ENDPOINT: 'https://generativelanguage.googleapis.com/v1beta/models/',

    GENERATION_CONFIG: {

      "responseMimeType": "application/json",

      "temperature": 0.2

    }

  },

  APPSHEET: {

    APP_ID: 'f40c4b11-b140-4e31-a60c-600f3c9637c8', // ★要設定: AppSheetのアプリID

    ACCESS_KEY: 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY', // ★要設定: AppSheet APIのアクセスキー

    API_ENDPOINT: 'https://api.appsheet.com/api/v2/apps/',

    TABLE_NAME: 'Client_Analytics',

    LOCALE: 'ja-JP'

  },

  RETRY_SETTINGS: {

    MAX_ATTEMPTS: 3,

    INITIAL_DELAY_MS: 1000,

    BACKOFF_FACTOR: 2

  },

  // 非同期設定

  ASYNC_CONFIG: {

    WORKER_FUNCTION_NAME: 'processTaskQueueWorker',

    WORKER_ACTION_KEY: 'start_worker_v1',

    QUEUE_KEY: 'TASK_QUEUE',

    TASK_DATA_PREFIX: 'TASK_DATA_',

    IDEMPOTENCY_PREFIX: 'IDEMPOTENCY_',

    CACHE_EXPIRATION_SECONDS: 600, // 10分

    MAX_EXECUTION_TIME_MS: 300000

  }

};



const STATUS = {

  COMPLETED: "完了",

  ERROR: "エラー"

};



// ================================================================================================

// 2. Main Entry Point (doPost - 受付関数)

// ================================================================================================



/**

 * 【★修正】AppSheetからのWebhookと、内部からのワーカー起動リクエストを受け取る。

 * グローバルロックを解除し、IDが異なるリクエストの並行実行を許可する。

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_利用者_質疑応答';
    return processRequest(params);
  });
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  // 【★修正】doPost全体をロックしていたグローバルロックを解除しました。

  const startTime = new Date();

  if (!e || !e.postData || !e.postData.contents) {

    return createJsonResponse({ status: "error", message: "Invalid request body" });

  }



  



  // 内部からのワーカー起動リクエストか、AppSheetからの通常リクエストかを判定

  if (params.action === CONFIG.ASYNC_CONFIG.WORKER_ACTION_KEY) {

    Logger.log("[INFO][doPost] ワーカー起動リクエストを受信しました。");

    processTaskQueueWorker();

    return createJsonResponse({ status: "worker_process_invoked" });

  }



  // --- 以下、AppSheetからの通常リクエスト処理 ---

  let analysisId = null;

  let idempotencyLockAcquired = false;

  try {

    analysisId = params.analysisId;

    if (!analysisId) throw new Error("Missing analysisId");



    idempotencyLockAcquired = acquireIdempotencyLock(analysisId);

    if (!idempotencyLockAcquired) {

      Logger.log(`[INFO][doPost] 重複リクエストまたはロック競合を検出、スキップ: ${analysisId}`);

      return createJsonResponse({ status: "skipped", message: "Duplicate or conflict detected", analysisId: analysisId });

    }



    validateParameters(analysisId, params.documentText, params.promptText);

    scheduleAsyncTask(analysisId, params);



    const duration = (new Date() - startTime);

    Logger.log(`[INFO][doPost] リクエスト受付完了 (ワーカー起動リクエスト済): ${analysisId}, 応答時間 = ${duration}ms`);

    return createJsonResponse({ status: "accepted", message: "Request accepted for asynchronous processing", analysisId: analysisId });



  } catch (error) {

    Logger.log(`[ERROR][doPost] リクエスト受付エラー: ${error.toString()}`);

    if (idempotencyLockAcquired && analysisId) {

      Logger.log(`[INFO][doPost] エラー発生のため、冪等性ロックを解除します: ${analysisId}`);

      releaseIdempotencyLock(analysisId);

    }

    return createJsonResponse({ status: "error", message: error.toString() });

  }
}


/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
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

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_利用者_質疑応答');
}




function validateParameters(analysisId, documentText, promptText) {

  if (!documentText) throw new Error("Missing documentText");

  if (!promptText) throw new Error("Missing promptText");

}



// ================================================================================================

// 3. Async Task Management (キュー管理とスケジューリング)

// (このセクションに変更はありません)

// ================================================================================================



function scheduleAsyncTask(analysisId, params) {

  const scriptProperties = PropertiesService.getScriptProperties();

  const propKey = CONFIG.ASYNC_CONFIG.TASK_DATA_PREFIX + analysisId;

  try {

    scriptProperties.setProperty(propKey, JSON.stringify(params));

  } catch (e) {

    throw new Error(`タスクデータの保存に失敗しました。データサイズが大きすぎる可能性があります: ${e.toString()}`);

  }

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(10000);

    const queue = JSON.parse(scriptProperties.getProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY) || '[]');

    if (!queue.includes(analysisId)) {

      queue.push(analysisId);

      scriptProperties.setProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY, JSON.stringify(queue));

    }

  } catch (e) {

    scriptProperties.deleteProperty(propKey);

    throw new Error("キューへのタスク追加に失敗しました。");

  } finally {

    if (lock.hasLock()) {

      lock.releaseLock();

    }

  }

  requestWorkerStart();

}

function requestWorkerStart() {

  try {

    const url = ScriptApp.getService().getUrl();

    const token = ScriptApp.getOAuthToken();

    const payload = JSON.stringify({ action: CONFIG.ASYNC_CONFIG.WORKER_ACTION_KEY });

    const options = { method: 'post', contentType: 'application/json', payload: payload, headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true };

    UrlFetchApp.fetch(url, options);

    Logger.log("[INFO][Async] ワーカー起動をリクエストしました。");

  } catch (e) {

    Logger.log(`[ERROR][Async] ワーカー起動リクエストに失敗しました: ${e.toString()}`);

  }

}

function getNextTaskFromQueue() {

  const scriptProperties = PropertiesService.getScriptProperties();

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(10000);

    const queue = JSON.parse(scriptProperties.getProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY) || '[]');

    if (queue.length === 0) return null;

    const analysisId = queue.shift();

    scriptProperties.setProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY, JSON.stringify(queue));

    return analysisId;

  } catch (e) {

    Logger.log("[ERROR][Async] デキューのためのロック取得に失敗しました: " + e.toString());

    return null;

  } finally {

    if (lock.hasLock()) lock.releaseLock();

  }

}



// ================================================================================================

// 4. Background Worker (ワーカー関数 - 非同期実行)

// (このセクションに変更はありません)

// ================================================================================================



function processTaskQueueWorker() {

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(3000)) {

    Logger.log("[INFO][Worker] 別のワーカーが実行中のため、このインスタンスは終了します。");

    return;

  }

  const startTime = new Date();

  let processedCount = 0;

  try {

    while (true) {

      const analysisId = getNextTaskFromQueue();

      if (!analysisId) {

        Logger.log(`[INFO][Worker] キューが空です。ワーカーを終了します。処理件数: ${processedCount}`);

        break;

      }

      Logger.log(`[INFO][Worker] タスク処理開始: ${analysisId}`);

      const taskData = getTaskData(analysisId);

      if (taskData) {

        executeTask(analysisId, taskData);

        processedCount++;

      } else {

        Logger.log(`[WARN][Worker] タスクデータが見つかりません: ${analysisId}。スキップします。`);

      }

      cleanupTask(analysisId);

      if ((new Date() - startTime) > CONFIG.ASYNC_CONFIG.MAX_EXECUTION_TIME_MS) {

        Logger.log("[INFO][Worker] 実行時間制限に近づいたため、ワーカーを停止します。");

        const scriptProperties = PropertiesService.getScriptProperties();

        const queue = JSON.parse(scriptProperties.getProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY) || '[]');

        if (queue.length > 0) {

          Logger.log(`[INFO][Worker] 残存タスクがあります (${queue.length}件)。次のワーカーをリクエストします。`);

          requestWorkerStart();

        }

        break;

      }

    }

  } finally {

    lock.releaseLock();

  }

}

function executeTask(analysisId, params) {

  const startTime = new Date();

  try {

    const { documentText, promptText } = params;

    const aiResult = generateAnswerAndSummaryWithGemini(documentText, promptText);

    updateOnSuccess(analysisId, aiResult.answer, aiResult.summary);

    const duration = (new Date() - startTime) / 1000;

    Logger.log(`[INFO][Worker] タスク正常完了: ${analysisId}, 処理時間 = ${duration}秒`);

  } catch (error) {

    Logger.log(`[FATAL ERROR][Worker] タスク失敗: ${analysisId} - ${error.toString()}\nスタックトレース: ${error.stack}`);

    try {

      updateOnError(analysisId, error.toString());

    } catch (updateError) {

      Logger.log(`[ERROR][Worker] AppSheetへのエラー状態の更新にも失敗しました: ${updateError.toString()}`);

    }

  }

}



// ================================================================================================

// 5. Gemini AI Integration (Gemini連携機能)

// (このセクションに変更はありません)

// ================================================================================================



function generateAnswerAndSummaryWithGemini(documentText, promptText) {

  const prompt = createGeminiPrompt(documentText, promptText);

  const config = CONFIG.GEMINI;

  const requestBody = { contents: [{ parts: [{ text: prompt }] }], generationConfig: config.GENERATION_CONFIG, };

  const url = `${config.API_ENDPOINT}${config.MODEL_NAME}:generateContent?key=${config.API_KEY}`;

  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(requestBody) };

  const response = fetchWithRetry(url, options, "Gemini API");

  const responseText = response.getContentText();

  return parseGeminiResponse(responseText);

}

function createGeminiPrompt(documentText, promptText) {

  return `

# あなたの役割

あなたは、提供された#参照資料を深く理解し、#ユーザーからの質問に的確に答える、優秀なAIアシスタントです。



# 参照資料

${documentText}



---

# ユーザーからの質問

${promptText}



---

# 出力指示

- 上記の参照資料のみに基づいて、ユーザーからの質問に対する**詳細な回答**と、その回答を**簡潔に要約したもの**の両方を生成してください。

- 応答は、必ず以下の構造を持つ有効なJSONオブジェクト形式で返してください。マークダウン記法（例: \`\`\`json）や説明文などは一切含めないでください。



{

  "answer": "（ここに、質問に対する詳細な回答を記述）",

  "summary": "（ここに、上記answerの内容を簡潔に要約したものを記述）"

}

`;

}

function parseGeminiResponse(responseText) {

  let jsonResponse;

  try { jsonResponse = JSON.parse(responseText); } catch (e) { throw new Error("AIからの応答（JSON）の解析に失敗しました。"); }

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {

    if (jsonResponse.error) { throw new Error(`AIプラットフォームでエラーが発生しました: ${jsonResponse.error.message}`); }

    if (jsonResponse.promptFeedback && jsonResponse.promptFeedback.blockReason) { throw new Error(`AIへのリクエストがブロックされました。理由: ${jsonResponse.promptFeedback.blockReason}`); }

    throw new Error("AIからの応答に有効な候補が含まれていません。");

  }

  const candidate = jsonResponse.candidates[0];

  if (candidate.finishReason && candidate.finishReason !== 'STOP') { throw new Error(`AIの生成が不完全な状態で終了しました。理由: ${candidate.finishReason}`); }

  if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0].text) { throw new Error("AIからの応答にテキストコンテンツが含まれていません。"); }

  let contentText = candidate.content.parts[0].text;

  const jsonMatch = contentText.match(/```json\s*([\s\S]*?)\s*```/m);

  if (jsonMatch && jsonMatch[1]) { contentText = jsonMatch[1]; }

  const startIndex = contentText.indexOf('{');

  const endIndex = contentText.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1) { throw new Error("AIの応答から有効なJSON形式を抽出できませんでした。"); }

  const jsonString = contentText.substring(startIndex, endIndex + 1);

  try {

    const result = JSON.parse(jsonString);

    if (result && typeof result.answer === 'string' && typeof result.summary === 'string') { return result; }

    else { throw new Error("AIの応答に必要なキー（answer, summary）が含まれていません。"); }

  } catch (e) { throw new Error(`AIが生成したコンテンツの解析に失敗しました: ${e.message}`); }

}



// ================================================================================================

// 6. AppSheet Integration (AppSheet連携機能)

// (このセクションに変更はありません)

// ================================================================================================



function updateOnSuccess(analysisId, answer, summary) {

  const rowData = { "analysis_id": analysisId, "status": STATUS.COMPLETED, "response_text": answer, "summary": summary };

  callAppSheetApi({ Action: "Edit", Properties: { "Locale": CONFIG.APPSHEET.LOCALE }, Rows: [rowData] });

}

function updateOnError(analysisId, errorMessage) {

  const rowData = { "analysis_id": analysisId, "status": STATUS.ERROR, "response_text": `処理中にエラーが発生しました:\n${errorMessage.substring(0, 2000)}` };

  callAppSheetApi({ Action: "Edit", Properties: { "Locale": CONFIG.APPSHEET.LOCALE }, Rows: [rowData] });

}

function callAppSheetApi(payload) {

  const config = CONFIG.APPSHEET;

  const apiUrl = `${config.API_ENDPOINT}${config.APP_ID}/tables/${encodeURIComponent(config.TABLE_NAME)}/Action`;

  const options = { method: 'post', contentType: 'application/json', headers: { 'ApplicationAccessKey': config.ACCESS_KEY }, payload: JSON.stringify(payload) };

  try {

    fetchWithRetry(apiUrl, options, "AppSheet API");

  } catch (error) {

    throw new Error(`AppSheet APIの呼び出しに失敗しました: ${error.message}`);

  }

}



// ================================================================================================

// 7. Utilities (ユーティリティ関数)

// (このセクションに変更はありません)

// ================================================================================================



function acquireIdempotencyLock(analysisId) {

  const cache = CacheService.getScriptCache();

  const key = CONFIG.ASYNC_CONFIG.IDEMPOTENCY_PREFIX + analysisId;

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(5000);

    const status = cache.get(key);

    if (status === 'processing' || status === 'completed') {

      Logger.log(`[INFO][Idempotency] タスクは処理中または完了済みのためスキップします。 Status: ${status}, ID: ${analysisId}`);

      return false;

    }

    cache.put(key, 'processing', CONFIG.ASYNC_CONFIG.CACHE_EXPIRATION_SECONDS);

    return true;

  } catch (e) {

    Logger.log("[WARN][Idempotency] ロック取得に失敗しました: " + e.toString());

    return false;

  } finally {

    if (lock.hasLock()) {

      lock.releaseLock();

    }

  }

}

function releaseIdempotencyLock(analysisId) {

  const cache = CacheService.getScriptCache();

  const cacheKey = CONFIG.ASYNC_CONFIG.IDEMPOTENCY_PREFIX + analysisId;

  cache.remove(cacheKey);

  Logger.log(`[INFO][Idempotency] エラーのためロックを解除しました。 ID: ${analysisId}`);

}

function getTaskData(analysisId) {

  const scriptProperties = PropertiesService.getScriptProperties();

  const propKey = CONFIG.ASYNC_CONFIG.TASK_DATA_PREFIX + analysisId;

  const data = scriptProperties.getProperty(propKey);

  return data ? JSON.parse(data) : null;

}

function cleanupTask(analysisId) {

  const scriptProperties = PropertiesService.getScriptProperties();

  const propKey = CONFIG.ASYNC_CONFIG.TASK_DATA_PREFIX + analysisId;

  scriptProperties.deleteProperty(propKey);

  const cache = CacheService.getScriptCache();

  const cacheKey = CONFIG.ASYNC_CONFIG.IDEMPOTENCY_PREFIX + analysisId;

  cache.put(cacheKey, 'completed', CONFIG.ASYNC_CONFIG.CACHE_EXPIRATION_SECONDS);

  Logger.log(`[INFO][Cleanup] タスク ${analysisId} の状態を 'completed' に更新しました。`);

}

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

      if (responseCode >= 200 && responseCode < 300) return response;

      if (responseCode >= 500 || responseCode === 429) {

        if (attempts < settings.MAX_ATTEMPTS) { sleepWithJitter(delay); delay *= settings.BACKOFF_FACTOR; continue; }

      }

      const responseText = response.getContentText();

      const errorMsg = `[${apiName}] APIリクエスト失敗 (Code: ${responseCode}): ${responseText.substring(0, 500)}...`;

      throw new ApiError(errorMsg, responseCode);

    } catch (error) {

      if (error instanceof ApiError) { throw error; }

      if (error.message.includes("Invalid argument")) { throw new Error(`[${apiName}] 無効な引数が検出されました。処理を停止します: ${error.toString()}`); }

      if (attempts < settings.MAX_ATTEMPTS) { sleepWithJitter(delay); delay *= settings.BACKOFF_FACTOR; continue; }

      throw new Error(`[${apiName}] 最大試行回数 (${settings.MAX_ATTEMPTS}) を超えてもリクエストに失敗しました: ${error.toString()}`);

    }

  }

}

function sleepWithJitter(delayMs) {

  const jitter = Math.random() * 500;

  Utilities.sleep(delayMs + jitter);

}

function createJsonResponse(data) {

  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);

}