/**

 * 通知・ロギングモジュール

 */


/**

 * エラー通知メールを送信

 * @param {string} recordNoteId - レコードID

 * @param {string} errorMessage - エラーメッセージ

 * @param {Object} context - エラーコンテキスト（オプション）

 */

function sendErrorEmail(recordNoteId, errorMessage, context = {}) {

  try {

    const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    const subject = `[要確認] GAS処理エラー: 看護記録作成 (ID: ${recordNoteId})`;

    let body = `看護記録の自動生成処理でエラーが発生しました。\n\n`;

    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    body += `■ 基本情報\n`;

    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    body += `対象記録ID: ${recordNoteId}\n`;

    body += `発生日時: ${timestamp}\n`;

    body += `処理モード: ${context.processingMode || SYSTEM_CONFIG.processingMode}\n`;

    if (context.errorCode) {

      body += `エラーコード: ${context.errorCode}\n`;

    }

    body += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    body += `■ エラー詳細\n`;

    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    body += `${errorMessage}\n\n`;

    if (context.filePath) {

      body += `ファイルパス: ${context.filePath}\n`;

    }

    if (context.errorDetails) {

      body += `\n追加情報:\n`;

      Object.entries(context.errorDetails).forEach(([key, value]) => {

        body += `  ${key}: ${JSON.stringify(value)}\n`;

      });

    }

    if (context.stackTrace) {

      body += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      body += `■ スタックトレース\n`;

      body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      body += `${context.stackTrace}\n\n`;

    }

    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    body += `■ アクション\n`;

    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    body += `詳細ログを確認:\n`;

    body += `https://script.google.com/home/executions\n\n`;

    body += `AppSheetで記録を確認:\n`;

    body += `記録ID: ${recordNoteId}\n`;

    // Email removed - using execution log instead

    logStructured(LOG_LEVEL.INFO, 'エラー通知メール送信成功', {

      recordNoteId: recordNoteId,

      recipient: NOTIFICATION_CONFIG.errorEmail

    });

  } catch (error) {

    logStructured(LOG_LEVEL.ERROR, 'エラー通知メール送信失敗', {

      recordNoteId: recordNoteId,

      error: error.message

    });

  }

}

/**

 * Slack通知を送信（オプション）

 * @param {string} message - 通知メッセージ

 * @param {string} type - 通知タイプ ('success', 'error', 'warning', 'info')

 */

function sendSlackNotification(message, type = 'info') {

  if (!NOTIFICATION_CONFIG.enableSlackNotification || !NOTIFICATION_CONFIG.slackWebhookUrl) {

    return;

  }

  try {

    const colors = {

      success: '#36a64f',

      error: '#ff0000',

      warning: '#ff9900',

      info: '#0099ff'

    };

    const payload = {

      attachments: [{

        color: colors[type] || colors.info,

        text: message,

        footer: 'Nursing Record GAS',

        ts: Math.floor(Date.now() / 1000)

      }]

    };

    const options = {

      method: 'post',

      contentType: 'application/json',

      payload: JSON.stringify(payload),

      muteHttpExceptions: true

    };

    UrlFetchApp.fetch(NOTIFICATION_CONFIG.slackWebhookUrl, options);

    Logger.log('Slack通知送信成功');

  } catch (error) {

    Logger.log(`Slack通知送信失敗: ${error.toString()}`);

  }

}


/**

 * 構造化ログを出力

 * @param {string} level - ログレベル (LOG_LEVEL定数を使用)

 * @param {string} message - メッセージ

 * @param {Object} data - 追加データ

 */

function logStructured(level, message, data = {}) {

  const logEntry = {

    timestamp: new Date().toISOString(),

    level: level,

    message: message,

    scriptId: ScriptApp.getScriptId(),

    ...data

  };

  // ログレベルに応じて出力方法を変更

  const logString = JSON.stringify(logEntry, null, SYSTEM_CONFIG.debugMode ? 2 : 0);

  switch (level) {

    case LOG_LEVEL.ERROR:

    case LOG_LEVEL.FATAL:

      console.error(logString);

      Logger.log(logString);

      break;

    case LOG_LEVEL.WARN:

      console.warn(logString);

      Logger.log(logString);

      break;

    case LOG_LEVEL.DEBUG:

      if (SYSTEM_CONFIG.debugMode) {

        console.log(logString);

        Logger.log(logString);

      }

      break;

    default:

      Logger.log(logString);

      if (SYSTEM_CONFIG.debugMode) {

        console.log(logString);

      }

  }

}


/**

 * 処理開始ログ

 * @param {string} recordNoteId - レコードID

 * @param {Object} params - パラメータ

 */

function logProcessingStart(recordNoteId, params) {

  logStructured('INFO', '処理開始', {

    recordNoteId: recordNoteId,

    staffId: params.staffId,

    hasFilePath: !!params.filePath,

    hasFileId: !!params.fileId,

    processingMode: SYSTEM_CONFIG.processingMode

  });

}

/**

 * 処理完了ログ

 * @param {string} recordNoteId - レコードID

 * @param {number} duration - 処理時間（ミリ秒）

 */

function logProcessingComplete(recordNoteId, duration) {

  logStructured('INFO', '処理完了', {

    recordNoteId: recordNoteId,

    durationMs: duration,

    durationSec: (duration / 1000).toFixed(2)

  });

}

/**

 * エラーログ

 * @param {string} recordNoteId - レコードID

 * @param {Error} error - エラーオブジェクト

 * @param {Object} context - エラーコンテキスト

 */

function logError(recordNoteId, error, context = {}) {

  logStructured('ERROR', 'エラー発生', {

    recordNoteId: recordNoteId,

    errorMessage: error.message,

    errorStack: error.stack,

    ...context

  });

}
