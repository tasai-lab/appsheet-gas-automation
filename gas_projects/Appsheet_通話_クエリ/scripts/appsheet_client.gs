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
 * AppSheet API統合クライアント
 * 全てのGASプロジェクトで共通使用するAppSheet API連携モジュール
 * 
 * @version 1.0.0
 * @date 2025-10-16
 */

/**
 * AppSheet APIクライアントクラス
 */
class AppSheetClient {
  
  /**
   * コンストラクタ
   * @param {string} appId - AppSheetアプリID
   * @param {string} accessKey - AppSheet APIアクセスキー
   */
  constructor(appId, accessKey) {
    this.appId = appId;
    this.accessKey = accessKey;
    this.baseUrl = 'https://api.appsheet.com/api/v2/apps';
  }

  /**
   * レコードを追加
   * @param {string} tableName - テーブル名
   * @param {Array<Object>} rows - 追加するレコードの配列
   * @param {Object} logger - ロガーインスタンス（オプション）
   * @return {Object} AppSheet APIレスポンス
   */
  addRecords(tableName, rows, logger = null) {
    if (logger) {
      logger.info(`AppSheet レコード追加: ${tableName}（${rows.length}件）`);
    }
    
    const payload = {
      Action: 'Add',
      Properties: {
        Locale: 'ja-JP',
        Timezone: 'Asia/Tokyo'
      },
      Rows: rows
    };
    
    return this._callApi(tableName, payload, logger);
  }

  /**
   * レコードを更新
   * @param {string} tableName - テーブル名
   * @param {Array<Object>} rows - 更新するレコードの配列（キー列を含む）
   * @param {Object} logger - ロガーインスタンス（オプション）
   * @return {Object} AppSheet APIレスポンス
   */
  updateRecords(tableName, rows, logger = null) {
    if (logger) {
      logger.info(`AppSheet レコード更新: ${tableName}（${rows.length}件）`);
    }
    
    const payload = {
      Action: 'Edit',
      Properties: {
        Locale: 'ja-JP',
        Timezone: 'Asia/Tokyo'
      },
      Rows: rows
    };
    
    return this._callApi(tableName, payload, logger);
  }

  /**
   * レコードを削除
   * @param {string} tableName - テーブル名
   * @param {Array<Object>} rows - 削除するレコードの配列（キー列のみ）
   * @param {Object} logger - ロガーインスタンス（オプション）
   * @return {Object} AppSheet APIレスポンス
   */
  deleteRecords(tableName, rows, logger = null) {
    if (logger) {
      logger.info(`AppSheet レコード削除: ${tableName}（${rows.length}件）`);
    }
    
    const payload = {
      Action: 'Delete',
      Properties: {
        Locale: 'ja-JP',
        Timezone: 'Asia/Tokyo'
      },
      Rows: rows
    };
    
    return this._callApi(tableName, payload, logger);
  }

  /**
   * レコードを検索
   * @param {string} tableName - テーブル名
   * @param {string} selector - セレクター式
   * @param {Object} logger - ロガーインスタンス（オプション）
   * @return {Object} AppSheet APIレスポンス
   */
  findRecords(tableName, selector, logger = null) {
    if (logger) {
      logger.info(`AppSheet レコード検索: ${tableName}`);
    }
    
    const payload = {
      Action: 'Find',
      Properties: {
        Locale: 'ja-JP',
        Timezone: 'Asia/Tokyo',
        Selector: selector
      }
    };
    
    return this._callApi(tableName, payload, logger);
  }

  /**
   * エラーステータスを更新
   * @param {string} tableName - テーブル名
   * @param {string} recordId - レコードID
   * @param {string} keyColumn - キー列名
   * @param {string} errorMessage - エラーメッセージ
   * @param {string} statusColumn - ステータス列名（デフォルト: 'status'）
   * @param {string} errorColumn - エラー詳細列名（デフォルト: 'error_details'）
   * @param {Object} logger - ロガーインスタンス（オプション）
   * @return {Object} AppSheet APIレスポンス
   */
  updateErrorStatus(tableName, recordId, keyColumn, errorMessage, 
                   statusColumn = 'status', errorColumn = 'error_details', logger = null) {
    if (logger) {
      logger.info(`AppSheet エラーステータス更新: ${recordId}`);
    }
    
    const row = {};
    row[keyColumn] = recordId;
    row[statusColumn] = 'エラー';
    row[errorColumn] = errorMessage.substring(0, 1000); // 最大1000文字
    
    return this.updateRecords(tableName, [row], logger);
  }

  /**
   * 成功ステータスを更新
   * @param {string} tableName - テーブル名
   * @param {string} recordId - レコードID
   * @param {string} keyColumn - キー列名
   * @param {Object} data - 更新するデータ
   * @param {string} statusColumn - ステータス列名（デフォルト: 'status'）
   * @param {Object} logger - ロガーインスタンス（オプション）
   * @return {Object} AppSheet APIレスポンス
   */
  updateSuccessStatus(tableName, recordId, keyColumn, data = {}, 
                     statusColumn = 'status', logger = null) {
    if (logger) {
      logger.info(`AppSheet 成功ステータス更新: ${recordId}`);
    }
    
    const row = { ...data };
    row[keyColumn] = recordId;
    row[statusColumn] = '完了';
    
    return this.updateRecords(tableName, [row], logger);
  }

  /**
   * AppSheet APIを呼び出す（内部共通メソッド）
   * @private
   */
  _callApi(tableName, payload, logger = null) {
    const url = `${this.baseUrl}/${this.appId}/tables/${tableName}/Action`;
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'ApplicationAccessKey': this.accessKey
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    if (logger) {
      // ログ用にペイロードを整形（大きなデータは省略）
      const logPayload = this._truncatePayloadForLogging(payload);
      logger.info('AppSheet API呼び出し', {
        url: url,
        action: payload.Action,
        payload: logPayload
      });
    }

    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      if (logger) {
        logger.info(`AppSheet APIレスポンス（ステータス: ${responseCode}）`);
      }
      
      if (responseCode >= 300) {
        const error = `AppSheet APIエラー（ステータス: ${responseCode}）: ${responseText}`;
        if (logger) {
          logger.error(error);
        }
        throw new Error(error);
      }

      const jsonResponse = JSON.parse(responseText);
      
      if (logger) {
        logger.success('AppSheet API呼び出し成功');
      }
      
      return jsonResponse;
      
    } catch (error) {
      if (logger) {
        logger.error(`AppSheet API呼び出しエラー: ${error.toString()}`, {
          tableName: tableName,
          action: payload.Action,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  /**
   * ログ用にペイロードを省略
   * @private
   */
  _truncatePayloadForLogging(payload) {
    const logPayload = JSON.parse(JSON.stringify(payload));
    
    if (logPayload.Rows && Array.isArray(logPayload.Rows)) {
      logPayload.Rows = logPayload.Rows.map(row => {
        const truncatedRow = {};
        for (const key in row) {
          if (typeof row[key] === 'string' && row[key].length > 200) {
            truncatedRow[key] = row[key].substring(0, 200) + '...(省略)';
          } else {
            truncatedRow[key] = row[key];
          }
        }
        return truncatedRow;
      });
    }
    
    return logPayload;
  }
}

/**
 * ヘルパー関数: AppSheetクライアント作成
 * @param {string} appId - AppSheetアプリID
 * @param {string} accessKey - AppSheet APIアクセスキー
 * @return {AppSheetClient} クライアントインスタンス
 */
function createAppSheetClient(appId, accessKey) {
  return new AppSheetClient(appId, accessKey);
}
