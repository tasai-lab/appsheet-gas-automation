/**
 * ユーティリティ関数モジュール
 * 汎用的なヘルパー関数を提供
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-20
 */

/**
 * 冪等性ロックを取得
 * CacheServiceを使用して重複実行を防止
 *
 * @param {string} analysisId - 分析ID
 * @return {boolean} ロック取得成功時true、失敗時false
 */
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

/**
 * 冪等性ロックを解除
 * エラー発生時にロックを解除してリトライを可能にする
 *
 * @param {string} analysisId - 分析ID
 */
function releaseIdempotencyLock(analysisId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = CONFIG.ASYNC_CONFIG.IDEMPOTENCY_PREFIX + analysisId;

  cache.remove(cacheKey);
  Logger.log(`[INFO][Idempotency] エラーのためロックを解除しました。 ID: ${analysisId}`);
}

/**
 * カスタムAPIエラークラス
 * HTTPステータスコードを保持するエラー
 */
class ApiError extends Error {
  /**
   * @param {string} message - エラーメッセージ
   * @param {number} statusCode - HTTPステータスコード
   */
  constructor(message, statusCode) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

/**
 * リトライ機能付きHTTPリクエスト
 * 指数バックオフを使用して失敗時にリトライ
 *
 * @param {string} url - リクエストURL
 * @param {Object} options - UrlFetchApp.fetchのオプション
 * @param {string} apiName - API名（ログ用）
 * @return {GoogleAppsScript.URL_Fetch.HTTPResponse} HTTPレスポンス
 * @throws {Error|ApiError} リクエストが最大試行回数後も失敗した場合
 */
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

      // 成功
      if (responseCode >= 200 && responseCode < 300) {
        return response;
      }

      // サーバーエラーまたはレート制限の場合はリトライ
      if (responseCode >= 500 || responseCode === 429) {
        if (attempts < settings.MAX_ATTEMPTS) {
          sleepWithJitter(delay);
          delay *= settings.BACKOFF_FACTOR;
          continue;
        }
      }

      // その他のエラーは即座に失敗
      const responseText = response.getContentText();
      const errorMsg = `[${apiName}] APIリクエスト失敗 (Code: ${responseCode}): ${responseText.substring(0, 500)}...`;
      throw new ApiError(errorMsg, responseCode);

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Invalid argumentエラーは即座に失敗
      if (error.message.includes("Invalid argument")) {
        throw new Error(`[${apiName}] 無効な引数が検出されました。処理を停止します: ${error.toString()}`);
      }

      // その他の例外はリトライ
      if (attempts < settings.MAX_ATTEMPTS) {
        sleepWithJitter(delay);
        delay *= settings.BACKOFF_FACTOR;
        continue;
      }

      throw new Error(`[${apiName}] 最大試行回数 (${settings.MAX_ATTEMPTS}) を超えてもリクエストに失敗しました: ${error.toString()}`);
    }
  }
}

/**
 * ジッター付きスリープ
 * ランダムなジッター（0-500ms）を追加して競合を緩和
 *
 * @param {number} delayMs - 基本待機時間（ミリ秒）
 */
function sleepWithJitter(delayMs) {
  const jitter = Math.random() * 500;
  Utilities.sleep(delayMs + jitter);
}

/**
 * JSON形式のHTTPレスポンスを作成
 * ContentServiceを使用してJSONレスポンスを生成
 *
 * @param {Object} data - レスポンスデータ
 * @return {GoogleAppsScript.Content.TextOutput} JSONテキスト出力
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
