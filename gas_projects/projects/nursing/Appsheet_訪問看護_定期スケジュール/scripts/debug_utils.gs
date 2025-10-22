/**
 * デバッグユーティリティ
 * デバッグ、パフォーマンス計測、データ検証機能を提供
 *
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-22
 */

// =============================================================================
// デバッグロガー
// =============================================================================

/**
 * デバッグログクラス
 */
class DebugLogger {
  constructor(context = '') {
    this.context = context;
    this.startTime = new Date();
    this.checkpoints = [];
  }

  /**
   * デバッグログを出力
   * @param {string} message - ログメッセージ
   * @param {*} data - 追加データ（オプション）
   */
  debug(message, data = null) {
    if (!isDebugMode()) return;

    const timestamp = new Date().toISOString();
    const contextStr = this.context ? `[${this.context}]` : '';
    let logMessage = `[DEBUG]${contextStr} ${message}`;

    if (data !== null) {
      if (typeof data === 'object') {
        logMessage += `\n${JSON.stringify(data, null, 2).substring(0, 500)}`;
      } else {
        logMessage += `: ${data}`;
      }
    }

    Logger.log(logMessage);
  }

  /**
   * 情報ログを出力
   * @param {string} message - ログメッセージ
   */
  info(message) {
    const contextStr = this.context ? `[${this.context}]` : '';
    Logger.log(`[INFO]${contextStr} ${message}`);
  }

  /**
   * 警告ログを出力
   * @param {string} message - ログメッセージ
   */
  warn(message) {
    const contextStr = this.context ? `[${this.context}]` : '';
    Logger.log(`[WARN]${contextStr} ${message}`);
  }

  /**
   * エラーログを出力
   * @param {string} message - ログメッセージ
   * @param {Error} error - エラーオブジェクト（オプション）
   */
  error(message, error = null) {
    const contextStr = this.context ? `[${this.context}]` : '';
    let logMessage = `[ERROR]${contextStr} ${message}`;

    if (error) {
      logMessage += `\nError: ${error.message}`;
      if (error.stack) {
        logMessage += `\nStack: ${error.stack}`;
      }
    }

    Logger.log(logMessage);
  }

  /**
   * 成功ログを出力
   * @param {string} message - ログメッセージ
   */
  success(message) {
    const contextStr = this.context ? `[${this.context}]` : '';
    Logger.log(`[SUCCESS]${contextStr} ${message}`);
  }

  /**
   * チェックポイントを記録
   * @param {string} label - チェックポイント名
   */
  checkpoint(label) {
    const elapsed = new Date() - this.startTime;
    this.checkpoints.push({ label, elapsed });

    if (isDebugMode()) {
      Logger.log(`[CHECKPOINT][${this.context}] ${label}: ${elapsed}ms`);
    }
  }

  /**
   * パフォーマンスサマリーを出力
   */
  summary() {
    const totalElapsed = new Date() - this.startTime;
    Logger.log(`\n${'='.repeat(60)}`);
    Logger.log(`[SUMMARY][${this.context}] 実行時間: ${totalElapsed}ms`);

    if (this.checkpoints.length > 0) {
      Logger.log('チェックポイント:');
      this.checkpoints.forEach(cp => {
        Logger.log(`  - ${cp.label}: ${cp.elapsed}ms`);
      });
    }

    Logger.log('='.repeat(60));
  }
}

/**
 * デバッグロガーを作成
 * @param {string} context - コンテキスト名
 * @returns {DebugLogger}
 */
function createDebugLogger(context) {
  return new DebugLogger(context);
}

// =============================================================================
// パフォーマンス計測
// =============================================================================

/**
 * 関数の実行時間を計測
 * @param {Function} func - 計測対象の関数
 * @param {Array} args - 関数の引数
 * @param {string} label - ラベル
 * @returns {*} 関数の戻り値
 */
function measurePerformance(func, args = [], label = '') {
  const startTime = new Date();
  const result = func(...args);
  const elapsed = new Date() - startTime;

  Logger.log(`[PERFORMANCE] ${label || func.name}: ${elapsed}ms`);

  return result;
}

/**
 * 非同期関数の実行時間を計測
 * @param {Promise} promise - 計測対象のPromise
 * @param {string} label - ラベル
 * @returns {Promise<*>}
 */
async function measureAsyncPerformance(promise, label = '') {
  const startTime = new Date();
  const result = await promise;
  const elapsed = new Date() - startTime;

  Logger.log(`[PERFORMANCE] ${label}: ${elapsed}ms`);

  return result;
}

// =============================================================================
// データ検証
// =============================================================================

/**
 * マスターデータを検証
 * @param {Object} masterData - マスターデータ
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateMasterData(masterData) {
  const errors = [];

  // 必須フィールドチェック
  const requiredFields = [
    'master_id',
    'client_id',
    'frequency',
    'day_of_week',
    'apply_start_date',
    'start_time',
    'end_time'
  ];

  requiredFields.forEach(field => {
    if (!masterData[field]) {
      errors.push(`必須フィールド '${field}' が未設定です`);
    }
  });

  // 頻度チェック
  const validFrequencies = [Frequency.WEEKLY, Frequency.BIWEEKLY, Frequency.MONTHLY];
  if (masterData.frequency && !validFrequencies.includes(masterData.frequency)) {
    errors.push(`無効な頻度: ${masterData.frequency}`);
  }

  // 曜日チェック
  if (masterData.day_of_week) {
    const dow = Number(masterData.day_of_week);
    if (isNaN(dow) || dow < 1 || dow > 7) {
      errors.push(`無効な曜日: ${masterData.day_of_week} (1-7の範囲で指定)`);
    }
  }

  // 日付チェック
  if (masterData.apply_start_date) {
    try {
      new Date(masterData.apply_start_date);
    } catch (e) {
      errors.push(`無効な適用開始日: ${masterData.apply_start_date}`);
    }
  }

  if (masterData.apply_end_date) {
    try {
      const endDate = new Date(masterData.apply_end_date);
      const startDate = new Date(masterData.apply_start_date);
      if (endDate < startDate) {
        errors.push('適用終了日が適用開始日より前です');
      }
    } catch (e) {
      errors.push(`無効な適用終了日: ${masterData.apply_end_date}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * 予定データを検証
 * @param {Object} planData - 予定データ
 * @returns {{valid: boolean, errors: string[]}}
 */
function validatePlanData(planData) {
  const errors = [];

  // 必須フィールドチェック
  const requiredFields = [
    'master_id',
    'client_id',
    'visit_date',
    'start_time',
    'end_time'
  ];

  requiredFields.forEach(field => {
    if (!planData[field]) {
      errors.push(`必須フィールド '${field}' が未設定です`);
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// =============================================================================
// データダンプ
// =============================================================================

/**
 * オブジェクトを整形して出力
 * @param {*} obj - オブジェクト
 * @param {string} label - ラベル
 */
function dumpObject(obj, label = 'Object') {
  if (!isDebugMode()) return;

  Logger.log(`\n${'='.repeat(60)}`);
  Logger.log(`[DUMP] ${label}`);
  Logger.log('='.repeat(60));

  if (typeof obj === 'object') {
    Logger.log(JSON.stringify(obj, null, 2));
  } else {
    Logger.log(obj);
  }

  Logger.log('='.repeat(60));
}

/**
 * 配列を整形して出力
 * @param {Array} arr - 配列
 * @param {string} label - ラベル
 * @param {number} limit - 表示件数制限
 */
function dumpArray(arr, label = 'Array', limit = 10) {
  if (!isDebugMode()) return;

  Logger.log(`\n${'='.repeat(60)}`);
  Logger.log(`[DUMP] ${label} (${arr.length}件${arr.length > limit ? `, 最初の${limit}件を表示` : ''})`);
  Logger.log('='.repeat(60));

  const displayArr = arr.slice(0, limit);
  displayArr.forEach((item, index) => {
    Logger.log(`[${index}] ${typeof item === 'object' ? JSON.stringify(item).substring(0, 200) : item}`);
  });

  if (arr.length > limit) {
    Logger.log(`... 他 ${arr.length - limit}件`);
  }

  Logger.log('='.repeat(60));
}

// =============================================================================
// テストヘルパー
// =============================================================================

/**
 * アサーション
 * @param {boolean} condition - 条件
 * @param {string} message - エラーメッセージ
 */
function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(`[ASSERT] ${message}`);
  }
}

/**
 * 等値チェック
 * @param {*} actual - 実際の値
 * @param {*} expected - 期待値
 * @param {string} message - エラーメッセージ
 */
function assertEquals(actual, expected, message = '') {
  if (actual !== expected) {
    const msg = message || `Expected: ${expected}, Actual: ${actual}`;
    throw new Error(`[ASSERT] ${msg}`);
  }
}

/**
 * 真値チェック
 * @param {*} value - 値
 * @param {string} message - エラーメッセージ
 */
function assertTruthy(value, message = 'Value should be truthy') {
  if (!value) {
    throw new Error(`[ASSERT] ${message}`);
  }
}

/**
 * 偽値チェック
 * @param {*} value - 値
 * @param {string} message - エラーメッセージ
 */
function assertFalsy(value, message = 'Value should be falsy') {
  if (value) {
    throw new Error(`[ASSERT] ${message}`);
  }
}

// =============================================================================
// デバッグ用テスト関数
// =============================================================================

/**
 * デバッグユーティリティのテスト
 */
function testDebugUtils() {
  Logger.log('='.repeat(60));
  Logger.log('デバッグユーティリティのテスト開始');
  Logger.log('='.repeat(60));

  // デバッグロガーのテスト
  const logger = createDebugLogger('TEST');
  logger.info('情報ログのテスト');
  logger.debug('デバッグログのテスト', { key: 'value' });
  logger.warn('警告ログのテスト');
  logger.success('成功ログのテスト');

  // チェックポイントのテスト
  logger.checkpoint('開始');
  Utilities.sleep(100);
  logger.checkpoint('中間');
  Utilities.sleep(100);
  logger.checkpoint('終了');

  // サマリー出力
  logger.summary();

  // データ検証のテスト
  const validMaster = {
    master_id: 'TEST_001',
    client_id: 'CLIENT_001',
    frequency: '毎週',
    day_of_week: 2,
    apply_start_date: '2025-01-01',
    start_time: '09:00',
    end_time: '10:00'
  };

  const validationResult = validateMasterData(validMaster);
  Logger.log(`\n検証結果: ${validationResult.valid ? '✅ OK' : '❌ NG'}`);
  if (!validationResult.valid) {
    Logger.log('エラー:');
    validationResult.errors.forEach(err => Logger.log(`  - ${err}`));
  }

  // アサーションのテスト
  try {
    assert(true, 'This should pass');
    assertEquals(1, 1, 'This should pass');
    assertTruthy(validationResult.valid, 'Validation should pass');
    Logger.log('\n✅ 全てのアサーションが成功しました');
  } catch (e) {
    Logger.log(`\n❌ アサーション失敗: ${e.message}`);
  }

  Logger.log('\n' + '='.repeat(60));
  Logger.log('デバッグユーティリティのテスト完了');
  Logger.log('='.repeat(60));
}
