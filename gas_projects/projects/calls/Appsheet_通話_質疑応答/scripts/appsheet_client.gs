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
      // デバッグ用：Rowsの完全な内容をログに出力（最初の行のみ）
      if (payload.Rows && payload.Rows.length > 0) {
        const firstRow = payload.Rows[0];
        const rowKeys = Object.keys(firstRow);
        logger.info('送信行の詳細', {
          keys: rowKeys.join(', '),
          values: JSON.stringify(firstRow).substring(0, 300)
        });
      }
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
        // レスポンスの詳細をログに記録
        logger.info('AppSheet APIレスポンス詳細', {
          rows: jsonResponse.Rows ? jsonResponse.Rows.length : 0,
          response: JSON.stringify(jsonResponse).substring(0, 500)
        });
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
