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

