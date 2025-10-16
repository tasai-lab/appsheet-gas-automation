/**
 * 統一実行ログモジュール
 * 全GASスクリプトの実行履歴を共通スプレッドシートに記録
 */

// 統一実行ログスプレッドシート
const EXECUTION_LOG_SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';
const EXECUTION_LOG_SHEET_NAME = '実行履歴';

/**
 * 実行ログモジュール（統一版）
 */
const ExecutionLogger = {
  SPREADSHEET_ID: EXECUTION_LOG_SPREADSHEET_ID,
  SHEET_NAME: EXECUTION_LOG_SHEET_NAME,
  
  /**
   * ログを記録（詳細版）
   * @param {string} scriptName - スクリプト名
   * @param {string} status - ステータス (成功/失敗/警告/スキップ)
   * @param {string} requestId - リクエストID
   * @param {Object} details - 詳細情報
   */
  log: function(scriptName, status, requestId, details = {}) {
    try {
      const sheet = SpreadsheetApp.openById(this.SPREADSHEET_ID)
        .getSheetByName(this.SHEET_NAME);
      
      if (!sheet) {
        Logger.log(`警告: 実行ログシート "${this.SHEET_NAME}" が見つかりません`);
        return;
      }
      
      const timestamp = new Date();
      const row = [
        Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss'),
        scriptName,
        status,
        requestId || '',
        details.summary || '',
        details.errorMessage || '',
        details.user || Session.getActiveUser().getEmail(),
        details.processingTime || '',
        details.apiUsed || '',
        details.modelName || '',
        details.tokens || '',
        details.responseSize || '',
        details.inputSummary || '',
        details.outputSummary || '',
        details.notes || ''
      ];
      
      sheet.appendRow(row);
      
    } catch (e) {
      Logger.log(`ログ記録エラー: ${e.message}`);
    }
  },
  
  /**
   * 成功ログ
   */
  success: function(scriptName, requestId, summary, processingTime, details = {}) {
    this.log(scriptName, '成功', requestId, {
      summary: summary,
      processingTime: processingTime,
      ...details
    });
  },
  
  /**
   * エラーログ
   */
  error: function(scriptName, requestId, errorMessage, processingTime, details = {}) {
    this.log(scriptName, '失敗', requestId, {
      errorMessage: errorMessage,
      processingTime: processingTime,
      ...details
    });
  },
  
  /**
   * 警告ログ
   */
  warning: function(scriptName, requestId, summary, processingTime, details = {}) {
    this.log(scriptName, '警告', requestId, {
      summary: summary,
      processingTime: processingTime,
      ...details
    });
  },
  
  /**
   * スキップログ
   */
  skip: function(scriptName, requestId, summary, processingTime, details = {}) {
    this.log(scriptName, 'スキップ', requestId, {
      summary: summary,
      processingTime: processingTime,
      ...details
    });
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
 * 実行時間計測クラス
 */
class ExecutionTimer {
  constructor() {
    this.startTime = new Date();
  }
  
  getElapsedSeconds() {
    const endTime = new Date();
    return ((endTime - this.startTime) / 1000).toFixed(2);
  }
}
