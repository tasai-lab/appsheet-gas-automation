/**
 * Automation_統合管理 - Webアプリケーション
 *
 * レシート処理と名刺取り込みの統合管理インターフェース
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-23
 */

/**
 * Web アプリケーションのエントリーポイント
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('自動化処理管理')
    .setFaviconUrl('https://www.google.com/images/branding/product/ico/apps_script_512dp.ico');
}

/**
 * 処理実行のメイン関数
 * @param {string} processType - 処理タイプ ('receipt-personal', 'receipt-corporate', 'business-card')
 * @returns {Object} 処理結果
 */
function runProcess(processType) {
  const logger = new ProcessLogger();

  try {
    logger.log('処理タイプ: ' + processType, 'info');

    let result;

    switch (processType) {
      case 'receipt-personal':
        result = runReceiptProcessPersonal(logger);
        break;

      case 'receipt-corporate':
        result = runReceiptProcessCorporate(logger);
        break;

      case 'business-card':
        result = runBusinessCardProcess(logger);
        break;

      default:
        throw new Error('不明な処理タイプ: ' + processType);
    }

    logger.log('全ての処理が完了しました', 'success');

    return {
      success: true,
      logs: logger.getLogs(),
      cost: result.cost,
      summary: result.summary
    };

  } catch (error) {
    logger.log('エラーが発生しました: ' + error.message, 'error');
    logger.log('スタックトレース: ' + error.stack, 'error');

    return {
      success: false,
      logs: logger.getLogs(),
      error: error.message
    };
  }
}

/**
 * レシート処理（個人）を実行
 * @param {ProcessLogger} logger
 * @returns {Object}
 */
function runReceiptProcessPersonal(logger) {
  logger.log('個人用レシート処理を開始します...', 'info');

  try {
    // レシートプロジェクトのmainProcessPersonalReceipts()を呼び出す
    // ここでは、レシートプロジェクトのスクリプトIDを使用してライブラリとして呼び出すか、
    // または同じプロジェクトにコードをコピーする必要があります

    // 仮実装: 実際の処理を呼び出す
    const result = processReceiptsPersonal();

    logger.log(`処理完了: ${result.processedCount}件のレシートを処理しました`, 'success');

    return {
      cost: result.cost,
      summary: `${result.processedCount}件のレシートを処理しました`
    };

  } catch (error) {
    logger.log('レシート処理でエラー: ' + error.message, 'error');
    throw error;
  }
}

/**
 * レシート処理（法人）を実行
 * @param {ProcessLogger} logger
 * @returns {Object}
 */
function runReceiptProcessCorporate(logger) {
  logger.log('法人用レシート処理を開始します...', 'info');

  try {
    const result = processReceiptsCorporate();

    logger.log(`処理完了: ${result.processedCount}件のレシートを処理しました`, 'success');

    return {
      cost: result.cost,
      summary: `${result.processedCount}件のレシートを処理しました`
    };

  } catch (error) {
    logger.log('レシート処理でエラー: ' + error.message, 'error');
    throw error;
  }
}

/**
 * 名刺取り込み処理を実行
 * @param {ProcessLogger} logger
 * @returns {Object}
 */
function runBusinessCardProcess(logger) {
  logger.log('名刺取り込み処理を開始します...', 'info');

  try {
    const result = processBusinessCards();

    logger.log(`処理完了: ${result.processedCount}件の名刺を取り込みました`, 'success');

    return {
      cost: result.cost,
      summary: `${result.processedCount}件の名刺を取り込みました`
    };

  } catch (error) {
    logger.log('名刺取り込みでエラー: ' + error.message, 'error');
    throw error;
  }
}

/**
 * ProcessLoggerクラス
 * Webアプリ用のログ収集クラス
 */
class ProcessLogger {
  constructor() {
    this.logs = [];
  }

  /**
   * ログを追加
   * @param {string} message - ログメッセージ
   * @param {string} type - ログタイプ ('info', 'success', 'warning', 'error')
   */
  log(message, type = 'info') {
    this.logs.push({
      message: message,
      type: type,
      timestamp: new Date().toISOString()
    });

    // Google Apps Scriptのログにも出力
    Logger.log(`[${type.toUpperCase()}] ${message}`);
  }

  /**
   * 全ログを取得
   * @returns {Array<Object>}
   */
  getLogs() {
    return this.logs;
  }
}
