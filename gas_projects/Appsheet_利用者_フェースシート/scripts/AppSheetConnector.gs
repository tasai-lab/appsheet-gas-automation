/**
 * AppSheet API連携共通モジュール
 *
 * AppSheet APIへのデータ送信を標準化
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-17
 */

const AppSheetConnector = {
  /**
   * AppSheet API設定を検証
   * @param {Object} config - API設定
   * @return {boolean} 検証結果
   */
  validateConfig: function(config) {
    const requiredFields = ['appId', 'tableName', 'accessKey'];

    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`必須設定が不足: ${field}`);
      }
    }

    return true;
  },

  /**
   * AppSheet APIを呼び出す
   * @param {Object} config - API設定
   * @param {string} action - アクション (Edit/Add/Delete)
   * @param {Array<Object>} rows - 行データ
   * @param {Object} [options] - オプション設定
   * @return {Object} APIレスポンス
   */
  callAPI: function(config, action, rows, options = {}) {
    // 設定検証
    this.validateConfig(config);

    // デフォルトオプション
    const defaultOptions = {
      locale: 'ja-JP',
      timezone: 'Asia/Tokyo',
      retryCount: 2,
      retryDelay: 1000
    };

    const opts = Object.assign({}, defaultOptions, options);

    // ペイロード作成
    const payload = {
      Action: action,
      Properties: {
        Locale: opts.locale,
        Timezone: opts.timezone
      },
      Rows: rows
    };

    // API URL
    const apiUrl = `https://api.appsheet.com/api/v2/apps/${config.appId}/tables/${config.tableName}/Action`;

    // リクエストオプション
    const requestOptions = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'ApplicationAccessKey': config.accessKey
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    // リトライ付き実行
    let lastError = null;
    for (let attempt = 0; attempt <= opts.retryCount; attempt++) {
      try {
        if (attempt > 0) {
          Utilities.sleep(opts.retryDelay);
          Logger.log(`API呼び出しリトライ: ${attempt}/${opts.retryCount}`);
        }

        const response = UrlFetchApp.fetch(apiUrl, requestOptions);
        const statusCode = response.getResponseCode();
        const responseText = response.getContentText();

        if (statusCode >= 200 && statusCode < 300) {
          Logger.log(`AppSheet API成功: ${action} - ${rows.length}行`);
          return {
            success: true,
            statusCode: statusCode,
            data: JSON.parse(responseText)
          };
        } else {
          lastError = new Error(`API Error: ${statusCode} - ${responseText}`);
        }

      } catch (error) {
        lastError = error;
      }
    }

    // 全リトライ失敗
    throw new Error(`AppSheet API呼び出し失敗 (${opts.retryCount + 1}回試行): ${lastError.message}`);
  },

  /**
   * 単一行を更新
   * @param {Object} config - API設定
   * @param {Object} rowData - 行データ
   * @return {Object} APIレスポンス
   */
  updateRow: function(config, rowData) {
    return this.callAPI(config, 'Edit', [rowData]);
  },

  /**
   * 単一行を追加
   * @param {Object} config - API設定
   * @param {Object} rowData - 行データ
   * @return {Object} APIレスポンス
   */
  addRow: function(config, rowData) {
    return this.callAPI(config, 'Add', [rowData]);
  },

  /**
   * 単一行を削除
   * @param {Object} config - API設定
   * @param {Object} rowData - 行データ（キー項目のみ必要）
   * @return {Object} APIレスポンス
   */
  deleteRow: function(config, rowData) {
    return this.callAPI(config, 'Delete', [rowData]);
  },

  /**
   * 複数行を一括更新
   * @param {Object} config - API設定
   * @param {Array<Object>} rows - 行データ配列
   * @param {number} [batchSize=100] - バッチサイズ
   * @return {Array<Object>} APIレスポンス配列
   */
  batchUpdate: function(config, rows, batchSize = 100) {
    const results = [];

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      Logger.log(`バッチ処理: ${i + 1}-${Math.min(i + batchSize, rows.length)}/${rows.length}`);

      try {
        const result = this.callAPI(config, 'Edit', batch);
        results.push({
          batch: Math.floor(i / batchSize) + 1,
          success: true,
          count: batch.length,
          data: result.data
        });
      } catch (error) {
        results.push({
          batch: Math.floor(i / batchSize) + 1,
          success: false,
          count: batch.length,
          error: error.message
        });
      }
    }

    return results;
  },

  /**
   * エラー情報をAppSheetに記録
   * @param {Object} config - API設定
   * @param {string} recordId - レコードID
   * @param {Error} error - エラーオブジェクト
   * @param {Object} [additionalData] - 追加データ
   */
  recordError: function(config, recordId, error, additionalData = {}) {
    const errorData = {
      ...additionalData,
      status: 'エラー',
      error_details: `${error.message}\n${error.stack}`,
      error_timestamp: new Date().toISOString()
    };

    // レコードIDフィールド名を推測
    const idFieldCandidates = [
      'id', 'ID', 'record_id', 'recordId',
      'call_id', 'callId', 'transaction_id', 'transactionId'
    ];

    for (const fieldName of idFieldCandidates) {
      if (recordId && !errorData[fieldName]) {
        errorData[fieldName] = recordId;
        break;
      }
    }

    try {
      return this.updateRow(config, errorData);
    } catch (apiError) {
      Logger.log(`エラー記録失敗: ${apiError.message}`);
      return null;
    }
  },

  /**
   * 処理ステータスを更新
   * @param {Object} config - API設定
   * @param {string} recordId - レコードID
   * @param {string} status - ステータス
   * @param {Object} [additionalData] - 追加データ
   */
  updateStatus: function(config, recordId, status, additionalData = {}) {
    const statusData = {
      ...additionalData,
      status: status,
      updated_at: new Date().toISOString()
    };

    // レコードIDフィールド名を推測
    const idFieldCandidates = [
      'id', 'ID', 'record_id', 'recordId',
      'call_id', 'callId', 'transaction_id', 'transactionId'
    ];

    for (const fieldName of idFieldCandidates) {
      if (recordId && !statusData[fieldName]) {
        statusData[fieldName] = recordId;
        break;
      }
    }

    return this.updateRow(config, statusData);
  }
};