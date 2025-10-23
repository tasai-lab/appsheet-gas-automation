/**
 * デバッグロガー
 * 詳細なデバッグ情報を記録・出力
 * @version 1.0.0
 * @date 2025-10-23
 */

/**
 * デバッグロガークラス
 */
class DebugLogger {
  constructor(context) {
    this.context = context;
    this.logs = [];
    this.startTime = new Date();
    this.debugMode = DEBUG_MODE;
  }

  /**
   * デバッグログを追加
   * @param {string} level - ログレベル (INFO/DEBUG/WARN/ERROR)
   * @param {string} message - メッセージ
   * @param {Object} data - 追加データ
   */
  log(level, message, data = null) {
    const timestamp = new Date();
    const elapsed = timestamp - this.startTime;

    const logEntry = {
      timestamp: Utilities.formatDate(timestamp, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss.SSS'),
      elapsed: `${elapsed}ms`,
      level: level,
      context: this.context,
      message: message,
      data: data
    };

    this.logs.push(logEntry);

    // コンソール出力（デバッグモード時）
    if (this.debugMode) {
      const prefix = `[${logEntry.timestamp}] [${elapsed}ms] [${level}] [${this.context}]`;

      if (data) {
        console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }

  info(message, data = null) {
    this.log('INFO', message, data);
  }

  debug(message, data = null) {
    this.log('DEBUG', message, data);
  }

  warn(message, data = null) {
    this.log('WARN', message, data);
  }

  error(message, data = null) {
    this.log('ERROR', message, data);
  }

  /**
   * API呼び出しの詳細をログ
   * @param {string} apiName - API名
   * @param {string} method - HTTPメソッド
   * @param {string} url - エンドポイントURL
   * @param {Object} requestData - リクエストデータ
   * @param {Object} headers - ヘッダー
   */
  logApiRequest(apiName, method, url, requestData = null, headers = null) {
    const sanitizedHeaders = headers ? this.sanitizeHeaders(headers) : null;

    this.debug(`${apiName} API リクエスト送信`, {
      method: method,
      url: url,
      headers: sanitizedHeaders,
      payload: requestData
    });
  }

  /**
   * API応答の詳細をログ
   * @param {string} apiName - API名
   * @param {number} statusCode - HTTPステータスコード
   * @param {Object} responseData - レスポンスデータ
   * @param {number} duration - 実行時間（ミリ秒）
   */
  logApiResponse(apiName, statusCode, responseData = null, duration = null) {
    const logData = {
      statusCode: statusCode,
      success: statusCode >= 200 && statusCode < 300,
      duration: duration ? `${duration}ms` : null,
      response: responseData
    };

    if (statusCode >= 400) {
      this.error(`${apiName} API エラー応答`, logData);
    } else {
      this.debug(`${apiName} API 応答受信`, logData);
    }
  }

  /**
   * キャッシュ操作をログ
   * @param {string} operation - 操作 (HIT/MISS/SET/CLEAR)
   * @param {string} cacheKey - キャッシュキー
   * @param {Object} metadata - メタデータ
   */
  logCache(operation, cacheKey, metadata = null) {
    const message = `キャッシュ${operation}: ${cacheKey}`;

    if (operation === 'HIT') {
      this.info(message, metadata);
    } else if (operation === 'MISS') {
      this.debug(message, metadata);
    } else {
      this.debug(message, metadata);
    }
  }

  /**
   * データ変換をログ
   * @param {string} step - 変換ステップ
   * @param {Object} input - 入力データ
   * @param {Object} output - 出力データ
   */
  logTransformation(step, input, output) {
    this.debug(`データ変換: ${step}`, {
      input: input,
      output: output
    });
  }

  /**
   * 処理ステップをログ
   * @param {string} step - ステップ名
   * @param {Object} context - コンテキスト情報
   */
  logStep(step, context = null) {
    this.info(`--- ${step} ---`, context);
  }

  /**
   * ヘッダー情報をサニタイズ（APIキーを隠す）
   * @param {Object} headers - ヘッダー
   * @returns {Object} サニタイズ済みヘッダー
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };

    // APIキーを隠す
    if (sanitized['X-Goog-Api-Key']) {
      const key = sanitized['X-Goog-Api-Key'];
      sanitized['X-Goog-Api-Key'] = `${key.substring(0, 10)}...${key.substring(key.length - 4)}`;
    }

    if (sanitized['ApplicationAccessKey']) {
      const key = sanitized['ApplicationAccessKey'];
      sanitized['ApplicationAccessKey'] = `${key.substring(0, 10)}...${key.substring(key.length - 4)}`;
    }

    return sanitized;
  }

  /**
   * 全ログを取得
   * @returns {Array} ログエントリの配列
   */
  getAllLogs() {
    return this.logs;
  }

  /**
   * ログサマリーを生成
   * @returns {Object} サマリー情報
   */
  getSummary() {
    const errorCount = this.logs.filter(log => log.level === 'ERROR').length;
    const warnCount = this.logs.filter(log => log.level === 'WARN').length;
    const totalDuration = new Date() - this.startTime;

    return {
      totalLogs: this.logs.length,
      errorCount: errorCount,
      warnCount: warnCount,
      totalDuration: `${totalDuration}ms`,
      startTime: Utilities.formatDate(this.startTime, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
      endTime: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')
    };
  }

  /**
   * ログをJSON文字列として出力
   * @param {boolean} prettyPrint - 整形するかどうか
   * @returns {string} JSON文字列
   */
  toJSON(prettyPrint = true) {
    const output = {
      context: this.context,
      summary: this.getSummary(),
      logs: this.logs
    };

    return prettyPrint ? JSON.stringify(output, null, 2) : JSON.stringify(output);
  }

  /**
   * ログをスプレッドシートの備考欄用にフォーマット
   * @param {number} maxLength - 最大文字数
   * @returns {string} フォーマット済み文字列
   */
  toNoteString(maxLength = 1000) {
    const summary = this.getSummary();
    const errorLogs = this.logs.filter(log => log.level === 'ERROR');
    const warnLogs = this.logs.filter(log => log.level === 'WARN');

    let note = `[デバッグ情報]\n`;
    note += `実行時間: ${summary.totalDuration}\n`;
    note += `ログ数: ${summary.totalLogs} (エラー: ${summary.errorCount}, 警告: ${summary.warnCount})\n`;

    if (errorLogs.length > 0) {
      note += `\n[エラー]\n`;
      errorLogs.forEach(log => {
        note += `${log.timestamp}: ${log.message}\n`;
        if (log.data) {
          note += `  ${JSON.stringify(log.data).substring(0, 200)}\n`;
        }
      });
    }

    if (warnLogs.length > 0) {
      note += `\n[警告]\n`;
      warnLogs.slice(0, 3).forEach(log => {
        note += `${log.timestamp}: ${log.message}\n`;
      });
    }

    // 最大文字数に制限
    if (note.length > maxLength) {
      note = note.substring(0, maxLength - 20) + '\n...(truncated)';
    }

    return note;
  }
}

/**
 * デバッグロガーを作成
 * @param {string} context - コンテキスト名
 * @returns {DebugLogger} デバッグロガーインスタンス
 */
function createDebugLogger(context) {
  return new DebugLogger(context);
}

/**
 * デバッグモードのテスト
 */
function testDebugLogger() {
  const logger = createDebugLogger('TEST');

  logger.info('テスト開始');
  logger.debug('デバッグ情報', { foo: 'bar', num: 123 });

  logger.logApiRequest('TestAPI', 'POST', 'https://example.com/api',
    { query: 'test' },
    { 'X-Goog-Api-Key': 'AIzaSyD-V_IwW1flPJif6eYFZPFjLpfonyLKT-Y' }
  );

  logger.logApiResponse('TestAPI', 200, { result: 'success' }, 123);

  logger.logCache('HIT', 'test_key', { size: '1.5KB' });

  logger.warn('警告メッセージ', { reason: 'test warning' });
  logger.error('エラーメッセージ', { error: 'test error' });

  console.log('\n=== サマリー ===');
  console.log(JSON.stringify(logger.getSummary(), null, 2));

  console.log('\n=== 備考欄用フォーマット ===');
  console.log(logger.toNoteString());

  console.log('\n=== 全ログJSON ===');
  console.log(logger.toJSON());
}
