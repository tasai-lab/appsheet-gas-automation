/**
 * タスクキュー管理モジュール
 * 非同期タスクのスケジューリングとキュー管理
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-20
 */

/**
 * 非同期タスクをスケジュール
 * タスクデータをScript Propertiesに保存し、キューに追加してワーカーを起動
 *
 * @param {string} analysisId - 分析ID
 * @param {Object} params - タスクパラメータ
 * @throws {Error} タスクデータの保存またはキュー追加に失敗した場合
 */
function scheduleAsyncTask(analysisId, params) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const propKey = CONFIG.ASYNC_CONFIG.TASK_DATA_PREFIX + analysisId;

  // タスクデータを保存
  try {
    scriptProperties.setProperty(propKey, JSON.stringify(params));
  } catch (e) {
    throw new Error(`タスクデータの保存に失敗しました。データサイズが大きすぎる可能性があります: ${e.toString()}`);
  }

  // キューにタスクIDを追加
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const queue = JSON.parse(scriptProperties.getProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY) || '[]');

    if (!queue.includes(analysisId)) {
      queue.push(analysisId);
      scriptProperties.setProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY, JSON.stringify(queue));
    }

  } catch (e) {
    // キュー追加失敗時はタスクデータも削除
    scriptProperties.deleteProperty(propKey);
    throw new Error("キューへのタスク追加に失敗しました。");

  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }

  // ワーカー起動をリクエスト
  requestWorkerStart();
}

/**
 * ワーカー起動をリクエスト
 * 自分自身のWebhookエンドポイントにPOSTリクエストを送信してワーカーを起動
 */
function requestWorkerStart() {
  try {
    const url = ScriptApp.getService().getUrl();
    const token = ScriptApp.getOAuthToken();
    const payload = JSON.stringify({ action: CONFIG.ASYNC_CONFIG.WORKER_ACTION_KEY });

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: payload,
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch(url, options);
    Logger.log("[INFO][Async] ワーカー起動をリクエストしました。");

  } catch (e) {
    Logger.log(`[ERROR][Async] ワーカー起動リクエストに失敗しました: ${e.toString()}`);
  }
}

/**
 * キューから次のタスクを取得
 * ロックを使用してスレッドセーフにタスクIDをデキュー
 *
 * @return {string|null} タスクID、キューが空の場合はnull
 */
function getNextTaskFromQueue() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const queue = JSON.parse(scriptProperties.getProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY) || '[]');

    if (queue.length === 0) {
      return null;
    }

    const analysisId = queue.shift();
    scriptProperties.setProperty(CONFIG.ASYNC_CONFIG.QUEUE_KEY, JSON.stringify(queue));

    return analysisId;

  } catch (e) {
    Logger.log("[ERROR][Async] デキューのためのロック取得に失敗しました: " + e.toString());
    return null;

  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/**
 * タスクデータを取得
 * Script Propertiesから指定されたタスクIDのデータを取得
 *
 * @param {string} analysisId - 分析ID
 * @return {Object|null} タスクデータ、存在しない場合はnull
 */
function getTaskData(analysisId) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const propKey = CONFIG.ASYNC_CONFIG.TASK_DATA_PREFIX + analysisId;
  const data = scriptProperties.getProperty(propKey);

  return data ? JSON.parse(data) : null;
}

/**
 * タスクをクリーンアップ
 * タスクデータを削除し、冪等性キャッシュを'completed'に更新
 *
 * @param {string} analysisId - 分析ID
 */
function cleanupTask(analysisId) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const propKey = CONFIG.ASYNC_CONFIG.TASK_DATA_PREFIX + analysisId;

  // タスクデータを削除
  scriptProperties.deleteProperty(propKey);

  // 冪等性キャッシュを'completed'に更新
  const cache = CacheService.getScriptCache();
  const cacheKey = CONFIG.ASYNC_CONFIG.IDEMPOTENCY_PREFIX + analysisId;
  cache.put(cacheKey, 'completed', CONFIG.ASYNC_CONFIG.CACHE_EXPIRATION_SECONDS);

  Logger.log(`[INFO][Cleanup] タスク ${analysisId} の状態を 'completed' に更新しました。`);
}
