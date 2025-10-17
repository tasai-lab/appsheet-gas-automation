/**

 * 重複実行防止モジュール

 * CacheServiceを使用してリクエストの重複を検知し、防止します

 */


/**

 * 処理実行状態を管理するキャッシュキーのプレフィックス

 */

const CACHE_PREFIX = {

  PROCESSING: 'processing_',

  WEBHOOK_FINGERPRINT: 'webhook_',

  TRIGGER_LOCK: 'trigger_lock_'

};


/**

 * キャッシュの有効期限（秒）

 */

const CACHE_DURATION = {

  PROCESSING_FLAG: 300,      // 5分（処理中フラグ）

  WEBHOOK_DEDUP: 60,         // 1分（Webhook重複排除）

  TRIGGER_LOCK: 10           // 10秒（トリガーロック）

};


/**

 * レコードが既に処理中かどうかをチェック

 * @param {string} recordNoteId - レコードID

 * @return {boolean} 処理中の場合true

 */

function isAlreadyProcessing(recordNoteId) {

  if (!recordNoteId) {

    Logger.log('⚠️ recordNoteIdが未指定です');

    return false;

  }

  const cache = CacheService.getScriptCache();

  const key = CACHE_PREFIX.PROCESSING + recordNoteId;

  const cachedValue = cache.get(key);

  if (cachedValue) {

    Logger.log(`🔒 重複実行検知: ${recordNoteId} は既に処理中です`);

    return true;

  }

  return false;

}


/**

 * 処理中フラグを設定

 * @param {string} recordNoteId - レコードID

 * @param {number} durationSeconds - フラグの有効期限（秒）デフォルトは5分

 * @return {boolean} 設定成功の場合true

 */

function markAsProcessing(recordNoteId) {

  if (!recordNoteId) {

    Logger.log('⚠️ recordNoteIdが未指定です');

    return false;

  }

  const cache = CacheService.getScriptCache();

  const key = CACHE_PREFIX.PROCESSING + recordNoteId;

  const timestamp = new Date().toISOString();

  try {

    cache.put(key, timestamp, CACHE_DURATION.PROCESSING_FLAG);

    Logger.log(`✅ 処理中フラグ設定: ${recordNoteId} (有効期限: ${CACHE_DURATION.PROCESSING_FLAG}秒)`);

    return true;

  } catch (error) {

    Logger.log(`❌ 処理中フラグ設定エラー: ${error.toString()}`);

    return false;

  }

}


/**

 * 処理中フラグをクリア

 * @param {string} recordNoteId - レコードID

 * @return {boolean} クリア成功の場合true

 */

function clearProcessingFlag(recordNoteId) {

  if (!recordNoteId) {

    Logger.log('⚠️ recordNoteIdが未指定です');

    return false;

  }

  const cache = CacheService.getScriptCache();

  const key = CACHE_PREFIX.PROCESSING + recordNoteId;

  try {

    cache.remove(key);

    Logger.log(`✅ 処理中フラグクリア: ${recordNoteId}`);

    return true;

  } catch (error) {

    Logger.log(`⚠️ 処理中フラグクリアエラー: ${error.toString()}`);

    return false;

  }

}


/**

 * Webhookリクエストのフィンガープリントを生成

 * @param {Object} params - Webhookパラメータ

 * @return {string} フィンガープリント（SHA-256ハッシュ）

 */

function generateWebhookFingerprint(params) {

  const data = JSON.stringify({

    recordNoteId: params.recordNoteId,

    staffId: params.staffId,

    fileId: params.fileId || '',

    filePath: params.filePath || '',

    recordType: params.recordType || '',

    // タイムスタンプは含めない（同一リクエストの重複を検知するため）

  });

  const signature = Utilities.computeDigest(

    Utilities.DigestAlgorithm.SHA_256,

    data,

    Utilities.Charset.UTF_8

  );

  return Utilities.base64Encode(signature);

}

/**

 * Webhook重複リクエストをチェック

 * @param {Object} params - Webhookパラメータ

 * @return {boolean} 重複リクエストの場合true

 */

function isDuplicateWebhook(params) {

  const fingerprint = generateWebhookFingerprint(params);

  const cache = CacheService.getScriptCache();

  const key = CACHE_PREFIX.WEBHOOK_FINGERPRINT + fingerprint;

  const cachedValue = cache.get(key);

  if (cachedValue) {

    Logger.log(`🔒 Webhook重複検知: ${params.recordNoteId} (フィンガープリント: ${fingerprint.substring(0, 16)}...)`);

    return true;

  }

  // 重複でない場合、フィンガープリントをキャッシュ

  cache.put(key, new Date().toISOString(), CACHE_DURATION.WEBHOOK_DEDUP);

  Logger.log(`✅ Webhook受付: ${params.recordNoteId} (フィンガープリント: ${fingerprint.substring(0, 16)}...)`);

  return false;

}


/**

 * トリガー実行のロックを取得

 * @param {string} lockId - ロックID

 * @return {boolean} ロック取得成功の場合true

 */

function acquireTriggerLock(lockId) {

  const cache = CacheService.getScriptCache();

  const key = CACHE_PREFIX.TRIGGER_LOCK + lockId;

  const cachedValue = cache.get(key);

  if (cachedValue) {

    Logger.log(`🔒 トリガーロック取得失敗: ${lockId} は既にロックされています`);

    return false;

  }

  cache.put(key, new Date().toISOString(), CACHE_DURATION.TRIGGER_LOCK);

  Logger.log(`✅ トリガーロック取得: ${lockId}`);

  return true;

}


/**

 * トリガーロックを解放

 * @param {string} lockId - ロックID

 */

function releaseTriggerLock(lockId) {

  const cache = CacheService.getScriptCache();

  const key = CACHE_PREFIX.TRIGGER_LOCK + lockId;

  cache.remove(key);

  Logger.log(`✅ トリガーロック解放: ${lockId}`);

}


/**

 * すべての処理中フラグをクリア（メンテナンス用）

 * @return {number} クリアしたフラグの数

 */

function clearAllProcessingFlags() {

  const cache = CacheService.getScriptCache();

  let count = 0;

  try {

    // CacheServiceはキーの一覧取得ができないため、

    // PropertiesServiceに記録されたキーを使用

    const properties = PropertiesService.getScriptProperties();

    const keys = properties.getKeys();

    keys.forEach(key => {

      if (key.startsWith(CACHE_PREFIX.PROCESSING)) {

        cache.remove(key);

        count++;

      }

    });

    Logger.log(`✅ 処理中フラグクリア完了: ${count}件`);

    return count;

  } catch (error) {

    Logger.log(`⚠️ フラグクリアエラー: ${error.toString()}`);

    return count;

  }

}


/**

 * 重複実行防止の統計情報を取得（デバッグ用）

 * @return {Object} 統計情報

 */

function getDuplicateCheckerStats() {

  const cache = CacheService.getScriptCache();

  return {

    timestamp: new Date().toISOString(),

    cacheConfig: {

      processingFlagDuration: CACHE_DURATION.PROCESSING_FLAG,

      webhookDedupDuration: CACHE_DURATION.WEBHOOK_DEDUP,

      triggerLockDuration: CACHE_DURATION.TRIGGER_LOCK

    },

    note: 'CacheServiceはキー一覧取得非対応のため、個別のキーは確認できません'

  };

}
