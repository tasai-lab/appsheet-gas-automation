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

      // メイン処理を実行
      const result = processFunction(params);

      // 成功ログ記録（utils_logger.gsを使用）
      const executionTime = (new Date() - startTime) / 1000;
      Logger.log(`✅ 処理成功: ${params.scriptName || 'Unknown'} (${executionTime.toFixed(2)}秒)`);

      return this.createSuccessResponse(result);

    } catch (error) {
      // エラーログ記録（utils_logger.gsを使用）
      const executionTime = (new Date() - startTime) / 1000;
      Logger.log(`❌ 処理エラー: ${params?.scriptName || 'Unknown'} - ${error.message} (${executionTime.toFixed(2)}秒)`);
      console.error(error);

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
   * @param {Error} error - エラーオブジェクト
   * @param {Object} params - リクエストパラメータ
   * @return {GoogleAppsScript.Content.TextOutput}
   */
  createErrorResponse: function(error, params) {
    const response = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        params: params
      }
    };

    Logger.log('Error response: ' + JSON.stringify(response));

    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  },

};

/**
 * テスト実行用共通関数
 */
const CommonTest = {
  /**
   * processRequest関数をテスト
   * @param {Function} processFunction - テスト対象の関数
   * @param {Object} testParams - テストパラメータ
   * @param {string} scriptName - スクリプト名
   */
  runTest: function(processFunction, testParams, scriptName) {
    console.log('='.repeat(60));
    console.log(`🧪 テスト実行: ${scriptName}`);
    console.log('='.repeat(60));
    console.log('入力パラメータ:', JSON.stringify(testParams, null, 2));

    try {
      const startTime = new Date();
      const result = processFunction(testParams);
      const executionTime = (new Date() - startTime) / 1000;

      console.log('✅ 処理成功');
      console.log('実行時間:', executionTime + '秒');
      console.log('結果:', JSON.stringify(result, null, 2));

      return result;

    } catch (error) {
      console.error('❌ 処理エラー:', error.message);
      console.error('スタックトレース:', error.stack);
      throw error;
    }
  },

  /**
   * 共通のテストケースを実行
   * @param {Function} processFunction - テスト対象の関数
   * @param {string} scriptName - スクリプト名
   */
  runCommonTests: function(processFunction, scriptName) {
    const testCases = [
      {
        name: '正常系テスト',
        params: {
          action: 'test',
          data: 'sample'
        }
      },
      {
        name: '空パラメータテスト',
        params: {}
      },
      {
        name: 'エラー系テスト',
        params: {
          action: 'error',
          triggerError: true
        }
      }
    ];

    console.log(`📋 ${scriptName} - 共通テストケース実行`);
    console.log('='.repeat(60));

    testCases.forEach((testCase, index) => {
      console.log(`\nテストケース ${index + 1}: ${testCase.name}`);
      console.log('-'.repeat(40));

      try {
        this.runTest(processFunction, testCase.params, scriptName);
      } catch (error) {
        // エラーケースは想定内
        if (!testCase.params.triggerError) {
          console.error('予期しないエラー:', error.message);
        }
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('テスト完了');
  }
};
