/**
 * エラーハンドリング共通モジュール
 *
 * エラー処理、通知、ログ記録を標準化
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-17
 */

const ErrorHandler = {
  /**
   * デフォルト設定
   */
  config: {
    sendErrorEmail: true,
    sendSuccessEmail: false,
    emailRecipient: 't.asai@fractal-group.co.jp',
    includeStackTrace: true,
    maxErrorDetailLength: 5000
  },

  /**
   * 設定を更新
   * @param {Object} newConfig - 新しい設定
   */
  configure: function(newConfig) {
    this.config = Object.assign({}, this.config, newConfig);
  },

  /**
   * エラーを処理
   * @param {Error} error - エラーオブジェクト
   * @param {Object} context - コンテキスト情報
   * @param {Object} [options] - オプション設定
   */
  handleError: function(error, context = {}, options = {}) {
    const opts = Object.assign({}, this.config, options);

    // エラー詳細を作成
    const errorDetail = this.formatError(error, context, opts);

    // ログ記録
    Logger.log('ERROR: ' + JSON.stringify(errorDetail));

    // ExecutionLoggerが存在する場合は使用
    if (typeof ExecutionLogger !== 'undefined' && ExecutionLogger.error) {
      const executionTime = context.executionTime || 0;
      ExecutionLogger.error(
        context.scriptName || 'Unknown',
        context.processId || '',
        error.message,
        error,
        executionTime,
        context.inputData
      );
    }

    // メール通知
    if (opts.sendErrorEmail && opts.emailRecipient) {
      this.sendErrorNotification(errorDetail, opts);
    }

    // AppSheet記録
    if (context.appsheetConfig && context.recordId) {
      this.recordToAppSheet(error, context);
    }

    return errorDetail;
  },

  /**
   * エラーをフォーマット
   * @param {Error} error - エラーオブジェクト
   * @param {Object} context - コンテキスト情報
   * @param {Object} opts - オプション
   * @return {Object} フォーマットされたエラー情報
   */
  formatError: function(error, context, opts) {
    const errorDetail = {
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      type: error.name || 'Error',
      scriptName: context.scriptName || 'Unknown',
      processId: context.processId || '',
      functionName: context.functionName || ''
    };

    if (opts.includeStackTrace && error.stack) {
      errorDetail.stack = error.stack.substring(0, opts.maxErrorDetailLength);
    }

    if (context.inputData) {
      errorDetail.inputData = this.sanitizeData(context.inputData);
    }

    if (context.additionalInfo) {
      errorDetail.additionalInfo = context.additionalInfo;
    }

    return errorDetail;
  },

  /**
   * データをサニタイズ（機密情報を除去）
   * @param {Object} data - データ
   * @return {Object} サニタイズされたデータ
   */
  sanitizeData: function(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveKeys = [
      'password', 'token', 'accessKey', 'apiKey',
      'secret', 'credential', 'authorization'
    ];

    const sanitized = {};

    for (const key in data) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof data[key] === 'object') {
        sanitized[key] = this.sanitizeData(data[key]);
      } else {
        sanitized[key] = data[key];
      }
    }

    return sanitized;
  },

  /**
   * エラー通知メールを送信
   * @param {Object} errorDetail - エラー詳細
   * @param {Object} opts - オプション
   */
  sendErrorNotification: function(errorDetail, opts) {
    try {
      const subject = `【GASエラー通知】${errorDetail.scriptName}でエラーが発生しました`;

      let body = 'Google Apps Scriptでエラーが発生しました。\n\n';
      body += `■ スクリプト名: ${errorDetail.scriptName}\n`;
      body += `■ 発生時刻: ${errorDetail.timestamp}\n`;
      body += `■ プロセスID: ${errorDetail.processId}\n`;
      body += `■ エラータイプ: ${errorDetail.type}\n`;
      body += `■ エラーメッセージ:\n${errorDetail.message}\n\n`;

      if (errorDetail.functionName) {
        body += `■ 関数名: ${errorDetail.functionName}\n\n`;
      }

      if (errorDetail.inputData) {
        body += `■ 入力データ:\n${JSON.stringify(errorDetail.inputData, null, 2)}\n\n`;
      }

      if (errorDetail.stack) {
        body += `■ スタックトレース:\n${errorDetail.stack}\n\n`;
      }

      body += 'このメールはGoogle Apps Scriptから自動送信されています。';

      // メール送信をログに記録（実際の送信は行わない - ExecutionLoggerを使用）
      Logger.log(`エラー通知メール準備完了: ${opts.emailRecipient}`);

      // 必要に応じてMailApp.sendEmailを有効化
      // MailApp.sendEmail(opts.emailRecipient, subject, body);

    } catch (e) {
      Logger.log('メール送信エラー: ' + e.toString());
    }
  },

  /**
   * AppSheetにエラーを記録
   * @param {Error} error - エラー
   * @param {Object} context - コンテキスト
   */
  recordToAppSheet: function(error, context) {
    if (!context.appsheetConfig || !context.recordId) {
      return;
    }

    try {
      if (typeof AppSheetConnector !== 'undefined') {
        AppSheetConnector.recordError(
          context.appsheetConfig,
          context.recordId,
          error,
          context.additionalData
        );
      }
    } catch (e) {
      Logger.log('AppSheetエラー記録失敗: ' + e.toString());
    }
  },

  /**
   * 成功通知を送信
   * @param {Object} context - コンテキスト情報
   * @param {Object} [options] - オプション
   */
  handleSuccess: function(context = {}, options = {}) {
    const opts = Object.assign({}, this.config, options);

    // ExecutionLoggerが存在する場合は使用
    if (typeof ExecutionLogger !== 'undefined' && ExecutionLogger.success) {
      const executionTime = context.executionTime || 0;
      ExecutionLogger.success(
        context.scriptName || 'Unknown',
        context.processId || '',
        context.message || '処理完了',
        executionTime,
        context.inputData
      );
    }

    // 成功通知メール
    if (opts.sendSuccessEmail && opts.emailRecipient) {
      this.sendSuccessNotification(context, opts);
    }

    // AppSheetステータス更新
    if (context.appsheetConfig && context.recordId) {
      this.updateAppSheetStatus(context, '完了');
    }
  },

  /**
   * 成功通知メールを送信
   * @param {Object} context - コンテキスト
   * @param {Object} opts - オプション
   */
  sendSuccessNotification: function(context, opts) {
    try {
      const subject = `【GAS処理完了】${context.scriptName}の処理が完了しました`;

      let body = 'Google Apps Scriptの処理が正常に完了しました。\n\n';
      body += `■ スクリプト名: ${context.scriptName}\n`;
      body += `■ 完了時刻: ${new Date().toISOString()}\n`;
      body += `■ プロセスID: ${context.processId || '-'}\n`;
      body += `■ 実行時間: ${context.executionTime || 0}秒\n`;

      if (context.message) {
        body += `■ メッセージ: ${context.message}\n`;
      }

      if (context.result) {
        body += `■ 結果:\n${JSON.stringify(context.result, null, 2)}\n`;
      }

      body += '\nこのメールはGoogle Apps Scriptから自動送信されています。';

      // メール送信をログに記録（実際の送信は行わない - ExecutionLoggerを使用）
      Logger.log(`成功通知メール準備完了: ${opts.emailRecipient}`);

      // 必要に応じてMailApp.sendEmailを有効化
      // MailApp.sendEmail(opts.emailRecipient, subject, body);

    } catch (e) {
      Logger.log('メール送信エラー: ' + e.toString());
    }
  },

  /**
   * AppSheetのステータスを更新
   * @param {Object} context - コンテキスト
   * @param {string} status - ステータス
   */
  updateAppSheetStatus: function(context, status) {
    if (!context.appsheetConfig || !context.recordId) {
      return;
    }

    try {
      if (typeof AppSheetConnector !== 'undefined') {
        AppSheetConnector.updateStatus(
          context.appsheetConfig,
          context.recordId,
          status,
          context.additionalData
        );
      }
    } catch (e) {
      Logger.log('AppSheetステータス更新失敗: ' + e.toString());
    }
  },

  /**
   * try-catch ラッパー
   * @param {Function} fn - 実行する関数
   * @param {Object} context - コンテキスト
   * @return {*} 関数の戻り値またはエラー
   */
  tryExecute: function(fn, context = {}) {
    const startTime = new Date();

    try {
      const result = fn();
      context.executionTime = (new Date() - startTime) / 1000;

      this.handleSuccess({
        ...context,
        result: result
      });

      return result;

    } catch (error) {
      context.executionTime = (new Date() - startTime) / 1000;

      this.handleError(error, context);
      throw error;
    }
  }
};
