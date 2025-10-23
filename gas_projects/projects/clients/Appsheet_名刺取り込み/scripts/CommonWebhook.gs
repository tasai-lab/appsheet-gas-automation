/**
 * Webhook共通処理モジュール
 *
 * 全GASプロジェクトで使用する標準的なWebhook処理を提供
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-17
 */

const CommonWebhook = {
  /**
   * 標準的なdoPost処理
   * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベント
   * @param {Function} processFunction - 実際の処理を行う関数
   * @return {GoogleAppsScript.Content.TextOutput} - JSONレスポンス
   */
  handleDoPost: function(e, processFunction) {
    const startTime = new Date();
    let params = null;

    try {
      // リクエストパラメータをパース
      params = this.parseRequest(e);

      // 重複チェック（オプション）
      if (params.enableDuplicationCheck !== false) {
        const requestId = DuplicationPrevention.generateRequestId(params);
        if (!DuplicationPrevention.checkDuplicate(requestId)) {
          return this.createDuplicateResponse(params);
        }
      }

      // メイン処理を実行
      const result = processFunction(params);

      // 成功ログ記録
      const executionTime = (new Date() - startTime) / 1000;
      if (typeof ExecutionLogger !== 'undefined') {
        ExecutionLogger.success(
          params.scriptName || 'Unknown Script',
          params.processId || '',
          '処理完了',
          executionTime,
          params
        );
      }

      return this.createSuccessResponse(result);

    } catch (error) {
      // エラーログ記録
      const executionTime = (new Date() - startTime) / 1000;
      if (typeof ExecutionLogger !== 'undefined') {
        ExecutionLogger.error(
          params?.scriptName || 'Unknown Script',
          params?.processId || '',
          error.message,
          error,
          executionTime,
          params
        );
      }

      return this.createErrorResponse(error, params);
    }
  },

  /**
   * リクエストをパース
   * @param {GoogleAppsScript.Events.DoPost} e
   * @return {Object} パースされたパラメータ
   */
  parseRequest: function(e) {
    if (!e || !e.postData) {
      throw new Error('リクエストデータが不正です');
    }

    try {
      const params = JSON.parse(e.postData.contents);

      // 共通パラメータを追加
      params.timestamp = new Date().toISOString();
      params.requestMethod = e.parameter ? 'GET' : 'POST';

      return params;

    } catch (error) {
      throw new Error('JSONパースエラー: ' + error.message);
    }
  },

  /**
   * 成功レスポンスを作成
   * @param {Object} data - レスポンスデータ
   * @return {GoogleAppsScript.Content.TextOutput}
   */
  createSuccessResponse: function(data) {
    const response = {
      status: 'success',
      timestamp: new Date().toISOString(),
      data: data
    };

    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  },

  /**
   * エラーレスポンスを作成
   * @param {string} errorCode - エラーコード
   * @param {string} errorMessage - エラーメッセージ
   * @param {number} [statusCode=500] - HTTPステータスコード
   * @return {GoogleAppsScript.Content.TextOutput}
   */
  createErrorResponse: function(errorCode, errorMessage, statusCode = 500) {
    const response = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        code: errorCode,
        message: errorMessage
      }
    };

    Logger.log('Error response: ' + JSON.stringify(response));

    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  },

  /**
   * 重複レスポンスを作成
   * @param {Object} params - リクエストパラメータ
   * @return {GoogleAppsScript.Content.TextOutput}
   */
  createDuplicateResponse: function(params) {
    const response = {
      status: 'duplicate',
      timestamp: new Date().toISOString(),
      message: '重複リクエストのため処理をスキップしました',
      params: params
    };

    Logger.log('Duplicate request: ' + JSON.stringify(response));

    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }
};
