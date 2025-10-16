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
 * 重複実行防止モジュール
 * Webhook受信時の重複実行を防止するための共通モジュール
 * 
 * @version 1.0.0
 * @date 2025-10-16
 */

/**
 * 重複防止設定
 */
const DUPLICATION_PREVENTION_CONFIG = {
  // タイムアウト時間（ミリ秒）
  lockTimeout: 300000, // 5分
  
  // リトライ設定
  maxRetries: 3,
  retryDelay: 1000, // 1秒
  
  // クリーンアップ設定
  cleanupAfterHours: 24 // 24時間後に処理済みレコードを削除
};

/**
 * 重複実行防止クラス
 */
class DuplicationPrevention {
  
  /**
   * コンストラクタ
   * @param {string} scriptName - スクリプト名（ユニークなキーとして使用）
   */
  constructor(scriptName) {
    this.scriptName = scriptName;
    this.lockService = LockService.getScriptLock();
    this.cacheService = CacheService.getScriptCache();
    this.propertyService = PropertiesService.getScriptProperties();
  }

  /**
   * 処理が既に実行済みかチェック
   * @param {string} recordId - レコードID
   * @return {boolean} true: 既に処理済み, false: 未処理
   */
  isAlreadyProcessed(recordId) {
    const cacheKey = this._getCacheKey(recordId);
    const propertyKey = this._getPropertyKey(recordId);
    
    // まずキャッシュをチェック（高速）
    const cachedValue = this.cacheService.get(cacheKey);
    if (cachedValue === 'processed') {
      return true;
    }
    
    // 次にPropertiesをチェック（永続化）
    const propertyValue = this.propertyService.getProperty(propertyKey);
    if (propertyValue) {
      // キャッシュにも保存
      this.cacheService.put(cacheKey, 'processed', 21600); // 6時間
      return true;
    }
    
    return false;
  }

  /**
   * 処理開始を記録（ロック取得）
   * @param {string} recordId - レコードID
   * @param {number} timeout - タイムアウト時間（ミリ秒）
   * @return {boolean} true: ロック取得成功, false: 失敗（他の処理が実行中）
   */
  markAsProcessing(recordId, timeout = DUPLICATION_PREVENTION_CONFIG.lockTimeout) {
    const cacheKey = this._getCacheKey(recordId);
    const lockKey = `lock_${cacheKey}`;
    
    // 既に処理済みの場合は false を返す
    if (this.isAlreadyProcessed(recordId)) {
      return false;
    }
    
    try {
      // グローバルロックを取得（短時間）
      if (!this.lockService.tryLock(5000)) {
        console.warn(`ロック取得に失敗: ${recordId}`);
        return false;
      }
      
      try {
        // ロック状態をチェック
        const lockValue = this.cacheService.get(lockKey);
        if (lockValue === 'locked') {
          return false; // 他の処理が実行中
        }
        
        // ロックを設定
        this.cacheService.put(lockKey, 'locked', timeout / 1000);
        this.cacheService.put(cacheKey, 'processing', timeout / 1000);
        
        return true;
        
      } finally {
        this.lockService.releaseLock();
      }
      
    } catch (e) {
      console.error(`処理開始記録エラー: ${e.toString()}`);
      return false;
    }
  }

  /**
   * 処理完了を記録
   * @param {string} recordId - レコードID
   * @param {boolean} success - 成功したかどうか
   */
  markAsCompleted(recordId, success = true) {
    const cacheKey = this._getCacheKey(recordId);
    const propertyKey = this._getPropertyKey(recordId);
    const lockKey = `lock_${cacheKey}`;
    
    try {
      const timestamp = new Date().toISOString();
      const status = success ? 'processed' : 'error';
      
      // キャッシュに記録（6時間）
      this.cacheService.put(cacheKey, status, 21600);
      
      // Propertiesに永続化（タイムスタンプ付き）
      const propertyValue = JSON.stringify({
        status: status,
        timestamp: timestamp,
        scriptName: this.scriptName
      });
      this.propertyService.setProperty(propertyKey, propertyValue);
      
      // ロックを解除
      this.cacheService.remove(lockKey);
      
    } catch (e) {
      console.error(`処理完了記録エラー: ${e.toString()}`);
    }
  }

  /**
   * 処理をリトライ可能な形で実行
   * @param {string} recordId - レコードID
   * @param {Function} processFunction - 実行する処理（recordIdを引数に取る関数）
   * @param {Object} logger - ロガーインスタンス（オプション）
   * @return {Object} {success: boolean, result: any, error: any}
   */
  executeWithRetry(recordId, processFunction, logger = null) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= DUPLICATION_PREVENTION_CONFIG.maxRetries; attempt++) {
      try {
        if (logger) {
          logger.info(`処理開始（試行 ${attempt}/${DUPLICATION_PREVENTION_CONFIG.maxRetries}）: ${recordId}`);
        }
        
        // 重複チェック
        if (this.isAlreadyProcessed(recordId)) {
          if (logger) {
            logger.warning(`既に処理済み: ${recordId}`);
          }
          return {
            success: false,
            result: null,
            error: '既に処理済みです',
            isDuplicate: true
          };
        }
        
        // 処理開始をマーク
        if (!this.markAsProcessing(recordId)) {
          if (logger) {
            logger.warning(`他の処理が実行中または処理済み: ${recordId}`);
          }
          return {
            success: false,
            result: null,
            error: '他の処理が実行中または処理済みです',
            isDuplicate: true
          };
        }
        
        // 実際の処理を実行
        const result = processFunction(recordId);
        
        // 処理完了をマーク
        this.markAsCompleted(recordId, true);
        
        if (logger) {
          logger.success(`処理完了: ${recordId}`);
        }
        
        return {
          success: true,
          result: result,
          error: null,
          isDuplicate: false
        };
        
      } catch (error) {
        lastError = error;
        
        if (logger) {
          logger.error(`処理エラー（試行 ${attempt}/${DUPLICATION_PREVENTION_CONFIG.maxRetries}）: ${error.toString()}`, {
            recordId: recordId,
            stack: error.stack
          });
        }
        
        // 最後の試行でない場合は待機してリトライ
        if (attempt < DUPLICATION_PREVENTION_CONFIG.maxRetries) {
          Utilities.sleep(DUPLICATION_PREVENTION_CONFIG.retryDelay * attempt);
        } else {
          // 全ての試行が失敗した場合はエラーとしてマーク
          this.markAsCompleted(recordId, false);
        }
      }
    }
    
    return {
      success: false,
      result: null,
      error: lastError ? lastError.toString() : '不明なエラー',
      isDuplicate: false
    };
  }

  /**
   * キャッシュキーを生成
   * @private
   */
  _getCacheKey(recordId) {
    return `${this.scriptName}_${recordId}`;
  }

  /**
   * Propertyキーを生成
   * @private
   */
  _getPropertyKey(recordId) {
    return `processed_${this.scriptName}_${recordId}`;
  }

  /**
   * 古い処理済みレコードをクリーンアップ
   * 定期実行トリガーで実行を推奨
   */
  static cleanupOldRecords() {
    try {
      const props = PropertiesService.getScriptProperties();
      const allProperties = props.getProperties();
      const cutoffTime = new Date().getTime() - (DUPLICATION_PREVENTION_CONFIG.cleanupAfterHours * 3600000);
      
      let deletedCount = 0;
      
      for (const key in allProperties) {
        if (key.startsWith('processed_')) {
          try {
            const value = JSON.parse(allProperties[key]);
            const recordTime = new Date(value.timestamp).getTime();
            
            if (recordTime < cutoffTime) {
              props.deleteProperty(key);
              deletedCount++;
            }
          } catch (e) {
            // JSONパースエラーの場合は古い形式なので削除
            props.deleteProperty(key);
            deletedCount++;
          }
        }
      }
      
      console.log(`${deletedCount}件の古い処理済みレコードを削除しました`);
      
    } catch (e) {
      console.error(`クリーンアップエラー: ${e.toString()}`);
    }
  }

  /**
   * 特定のレコードの処理状態をリセット
   * デバッグ用
   * @param {string} recordId - レコードID
   */
  resetProcessingState(recordId) {
    const cacheKey = this._getCacheKey(recordId);
    const propertyKey = this._getPropertyKey(recordId);
    const lockKey = `lock_${cacheKey}`;
    
    this.cacheService.remove(cacheKey);
    this.cacheService.remove(lockKey);
    this.propertyService.deleteProperty(propertyKey);
    
    console.log(`処理状態をリセット: ${recordId}`);
  }
}

/**
 * ヘルパー関数: 重複防止インスタンス作成
 * @param {string} scriptName - スクリプト名
 * @return {DuplicationPrevention} インスタンス
 */
function createDuplicationPrevention(scriptName) {
  return new DuplicationPrevention(scriptName);
}
