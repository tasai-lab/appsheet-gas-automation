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

 * AppSheetSecureConnector Library

 * AppSheet APIキーを安全に管理し、API呼び出しを仲介します。

 */



// =====================================================================================

// 設定 (Configuration) - このライブラリ内でのみ保持・使用

// =====================================================================================

const CONFIG = {

  APPSHEET: {

    APP_ID: 'f40c4b11-b140-4e31-a60c-600f3c9637c8',

    // ★★★ 重要: APIキーはここに記述され、安全に保護されます ★★★

    ACCESS_KEY: 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY',

    PLAN_TABLE_NAME: 'Schedule_Plan',

    getEndpoint: function() {

        return `https://api.appsheet.com/api/v2/apps/${this.APP_ID}/tables/${encodeURIComponent(this.PLAN_TABLE_NAME)}/Action`;

    }

  },

  TIMEZONE: 'Asia/Tokyo',

  LOCALE: 'ja-JP',

  PLAN_ID_HEADER: 'plan_id' // キー列名

};



/**

 * 【公開関数】AppSheet APIを使用してテーブルを一括更新（Edit）する。

 * この関数はフロントエンドスクリプトから呼び出されます。

 * @param {Array<object>} updateRows 更新するRowオブジェクトの配列

 * @returns {Array<object>} 各Rowの更新結果 [{planId, status}]

 */

function updateAppSheetPlanTable(updateRows) {

    if (!updateRows || updateRows.length === 0) {

        return [];

    }



    const endpoint = CONFIG.APPSHEET.getEndpoint();

    const payload = {

        Action: "Edit",

        Properties: {

            Locale: CONFIG.LOCALE,

            Timezone: CONFIG.TIMEZONE

        },

        Rows: updateRows

    };



    const options = {

        method: "post",

        contentType: "application/json",

        headers: {

            // APIキーはサーバーサイドでのみ使用されます

            "ApplicationAccessKey": CONFIG.APPSHEET.ACCESS_KEY

        },

        payload: JSON.stringify(payload),

        muteHttpExceptions: true

    };



    console.log(`[Library] AppSheet APIリクエスト送信 (${updateRows.length}件)`);



    // 結果オブジェクトの初期化

    const results = updateRows.map(row => ({

        planId: row[CONFIG.PLAN_ID_HEADER],

        status: 'Error: Unknown'

    }));



    try {

        const response = UrlFetchApp.fetch(endpoint, options);

        const responseCode = response.getResponseCode();

        const responseBody = response.getContentText();



        if (responseCode === 200) {

            console.log("[Library] AppSheet APIリクエスト成功。");

            results.forEach(r => r.status = 'Success');

        } else {

            console.error(`[Library] AppSheet APIリクエスト失敗。Code: ${responseCode}. Response: ${responseBody.substring(0, 500)}...`);

            let errorReason = `Error: HTTP ${responseCode}`;



            if (responseCode === 400 && (responseBody.includes("is not found") || responseBody.includes("key"))) {

                errorReason = 'Error: Record/Key Not Found in AppSheet';

            } else {

                errorReason = `Error: HTTP ${responseCode} (See logs)`;

            }

            results.forEach(r => r.status = errorReason);

        }

    } catch (e) {

        console.error("[Library] AppSheet API呼び出し中に例外が発生しました。", e);

        results.forEach(r => r.status = `Error: Exception - ${e.message}`);

    }



    return results;

}