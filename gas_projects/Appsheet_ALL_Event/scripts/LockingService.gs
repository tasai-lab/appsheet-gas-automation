





/**

 * 処理の重複実行を防止するためのロックサービス

 */

const LockingService = {

  CACHE_PREFIX: 'lock_',

  LOCK_TIMEOUT_SECONDS: 60, // ロックの有効期間（秒）



  /**

   * 指定されたIDのロックを取得する。既にロックされている場合は例外を投げる。

   * @param {string} id - ロック対象の一意のID (例: plan_id)

   * @returns {boolean} ロック成功時にtrue

   * @throws {Error} IDが空の場合、または既にロックされている場合

   */

  acquireLock(id) {

    if (!id) {

      // ロックIDがない場合は何もしないで成功とみなす

      Logger.info('ロックIDが指定されていないため、ロック処理をスキップしました。');

      return true;

    }

    

    const lockKey = this.CACHE_PREFIX + id;

    // CacheServiceへの同時アクセスによる競合状態を防ぐため、ScriptLockを使用する

    const scriptLock = LockService.getScriptLock();

    

    try {

      // 最大5秒間、スクリプトロックの取得を試みる

      scriptLock.waitLock(5000);

      

      const cache = CacheService.getScriptCache();

      const existingLock = cache.get(lockKey);

      

      if (existingLock) {

        // 既にロック（キャッシュ）が存在する

        throw new Error(`ID '${id}' is currently locked due to a recent execution.`);

      }

      

      // 新しくロック（キャッシュ）を設定する

      cache.put(lockKey, 'locked', this.LOCK_TIMEOUT_SECONDS);

      Logger.info(`ID '${id}' のロックを取得しました。有効期限: ${this.LOCK_TIMEOUT_SECONDS}秒`);

      

      return true;

      

    } finally {

      // 必ずスクリプトロックを解放する

      scriptLock.releaseLock();

    }

  }

};