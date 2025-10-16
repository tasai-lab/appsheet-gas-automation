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


/**

 * ★★★ メンテナンス用関数 (個別指定版) ★★★

 * 指定した単一のdocumentIdに関連するロック情報をクリアします。

 * 特定の書類だけがロックされたままになってしまった場合に使用します。

 */

function clearSpecificLock() {

  // ★★★ 手順1: このIDを、リセットしたい書類IDに書き換えてください ★★★

  const documentIdToClear = 'CLDC-211f6fc6'; // 例: 'CLDC-148ddbe7'



  // --- ここから下は変更しないでください ---

  if (!documentIdToClear || documentIdToClear === 'ここにIDをペーストしてください') {

    console.error("エラー: 関数内の`documentIdToClear`に、リセットしたい書類IDを正しく入力してから実行してください。");

    return;

  }



  const properties = PropertiesService.getScriptProperties();

  let cleared = false;



  // メインのロックキーを削除 ('processing' or 'completed')

  if (properties.getProperty(documentIdToClear) !== null) {

    properties.deleteProperty(documentIdToClear);

    console.log(`ロックを解除しました: ${documentIdToClear}`);

    cleared = true;

  }



  // 提供票用のCONTEXTキーも削除

  const contextKey = `CONTEXT_${documentIdToClear}`;

  if (properties.getProperty(contextKey) !== null) {

    properties.deleteProperty(contextKey);

    console.log(`提供票の待機データを削除しました: ${contextKey}`);

    cleared = true;

  }



  if (cleared) {

    console.log(`ID: ${documentIdToClear} に関連するロック情報を正常に解除しました。`);

  } else {

    console.log(`ID: ${documentIdToClear} に関連するロックや待機データは見つかりませんでした。`);

  }

}



/**

 * ★★★ メンテナンス用関数 (一括解除) ★★★

 * PropertiesServiceに保存されている、このスクリプトのロック情報をすべてクリアします。

 * 原因が特定できない場合や、全体をリセットしたい場合に手動で実行します。

 */

function clearAllProcessLocks() {

  const properties = PropertiesService.getScriptProperties();

  const allKeys = properties.getKeys();

  let clearedCount = 0;



  for (const key of allKeys) {

    // このスクリプトで使われるキー（書類ID、または提供票のCONTEXT）を対象とする

    if (key.startsWith('CLDC-') || key.startsWith('CONTEXT_')) {

      properties.deleteProperty(key);

      console.log(`ロックを解除しました: ${key}`);

      clearedCount++;

    }

  }



  if (clearedCount === 0) {

    console.log("クリア対象のロック情報はありませんでした。");

  } else {

    console.log(`合計 ${clearedCount} 件のロック情報をクリアしました。`);

  }

}



