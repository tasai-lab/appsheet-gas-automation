/**
 * ApiCallLimiter.gs - API呼び出し制限モジュール（共通）
 *
 * すべてのプロジェクトで使用可能な、AI API呼び出し回数の制限と監視を提供
 *
 * @version 1.0.0
 * @date 2025-10-18
 * @author Fractal Group
 */

/**
 * API呼び出し制限の設定（グローバル変数）
 * 各プロジェクトでオーバーライド可能
 */
const API_CALL_LIMITER_CONFIG = {
  // デフォルトの最大呼び出し回数（1実行あたり）
  maxCallsPerExecution: 3,

  // API呼び出しカウンター（実行ごとにリセット）
  _callCounter: 0,

  // API種別ごとのカウント（詳細追跡用）
  _callsByType: {},

  // ログレベル
  enableDetailedLogging: true
};

/**
 * API呼び出し制限を設定
 * プロジェクトの初期化時に呼び出す
 *
 * @param {number} maxCalls - 最大呼び出し回数
 * @param {boolean} detailedLogging - 詳細ログを有効にするか
 */
function setApiCallLimit(maxCalls, detailedLogging = true) {
  API_CALL_LIMITER_CONFIG.maxCallsPerExecution = maxCalls;
  API_CALL_LIMITER_CONFIG.enableDetailedLogging = detailedLogging;

  if (API_CALL_LIMITER_CONFIG.enableDetailedLogging) {
    Logger.log(`[API制限] 最大呼び出し回数を ${maxCalls} 回に設定`);
  }
}

/**
 * API呼び出しカウンターをリセット
 * 各実行の開始時に呼び出す（通常はWebhook受信時）
 */
function resetApiCallCounter() {
  API_CALL_LIMITER_CONFIG._callCounter = 0;
  API_CALL_LIMITER_CONFIG._callsByType = {};

  if (API_CALL_LIMITER_CONFIG.enableDetailedLogging) {
    Logger.log('[API制限] カウンターをリセット');
  }
}

/**
 * API呼び出し回数を増加させ、制限をチェック
 * すべてのAI API呼び出しの直前に必ず実行すること
 *
 * @param {string} apiType - APIの種類（例: 'Vertex_AI', 'Google_AI', 'Gemini_Pro'）
 * @param {string} [operation] - 操作の説明（例: '書類OCR', '音声解析'）
 * @throws {Error} - 制限を超えた場合
 *
 * @example
 * // Vertex AI API呼び出し前
 * incrementApiCallCounter('Vertex_AI', '書類OCR処理');
 * const response = UrlFetchApp.fetch(endpoint, options);
 *
 * @example
 * // Google AI API呼び出し前
 * incrementApiCallCounter('Google_AI', '提供票データ抽出');
 * const response = UrlFetchApp.fetch(url, options);
 */
function incrementApiCallCounter(apiType, operation = '') {
  // カウンターを増加
  API_CALL_LIMITER_CONFIG._callCounter++;

  // API種別ごとのカウントを記録
  if (!API_CALL_LIMITER_CONFIG._callsByType[apiType]) {
    API_CALL_LIMITER_CONFIG._callsByType[apiType] = 0;
  }
  API_CALL_LIMITER_CONFIG._callsByType[apiType]++;

  const currentCount = API_CALL_LIMITER_CONFIG._callCounter;
  const maxCount = API_CALL_LIMITER_CONFIG.maxCallsPerExecution;

  // ログ出力
  const operationText = operation ? ` (${operation})` : '';
  const typeCount = API_CALL_LIMITER_CONFIG._callsByType[apiType];

  if (API_CALL_LIMITER_CONFIG.enableDetailedLogging) {
    Logger.log(
      `[API制限] ${apiType}${operationText} - ` +
      `全体: ${currentCount}/${maxCount}回, ${apiType}: ${typeCount}回`
    );
  }

  // 制限チェック
  if (currentCount > maxCount) {
    const errorMsg =
      `API呼び出し制限超過: ${currentCount}回 (上限: ${maxCount}回)\n` +
      `API種別: ${apiType}${operationText}\n` +
      `詳細: ${JSON.stringify(API_CALL_LIMITER_CONFIG._callsByType)}\n` +
      `1回の処理で過度なAPI呼び出しが発生しています。処理を中止します。`;

    Logger.log(`[API制限] ❌ ${errorMsg}`);

    throw new Error(errorMsg);
  }
}

/**
 * 現在のAPI呼び出し回数を取得
 *
 * @returns {Object} - { total: 全体の呼び出し回数, byType: API種別ごとの内訳 }
 */
function getApiCallCount() {
  return {
    total: API_CALL_LIMITER_CONFIG._callCounter,
    maxAllowed: API_CALL_LIMITER_CONFIG.maxCallsPerExecution,
    byType: { ...API_CALL_LIMITER_CONFIG._callsByType },
    remaining: API_CALL_LIMITER_CONFIG.maxCallsPerExecution - API_CALL_LIMITER_CONFIG._callCounter
  };
}

/**
 * API呼び出し統計を取得（ログ記録用）
 *
 * @returns {string} - 統計情報の文字列
 */
function getApiCallStats() {
  const stats = getApiCallCount();

  let result = `API呼び出し統計: ${stats.total}/${stats.maxAllowed}回 (残り: ${stats.remaining}回)\n`;

  if (Object.keys(stats.byType).length > 0) {
    result += '種別ごとの内訳:\n';
    for (const [type, count] of Object.entries(stats.byType)) {
      result += `  - ${type}: ${count}回\n`;
    }
  }

  return result;
}

/**
 * API呼び出し制限に余裕があるかチェック
 * 追加のAPI呼び出しを行う前に使用
 *
 * @param {number} [additionalCalls=1] - 追加で行う予定の呼び出し回数
 * @returns {boolean} - 余裕がある場合はtrue
 */
function hasApiCallCapacity(additionalCalls = 1) {
  const stats = getApiCallCount();
  return (stats.total + additionalCalls) <= stats.maxAllowed;
}

/**
 * API呼び出しを安全に実行するラッパー関数
 * 自動的にカウンターをインクリメントし、エラーハンドリングを行う
 *
 * @param {string} apiType - APIの種類
 * @param {Function} apiCallFunction - 実行するAPI呼び出し関数
 * @param {string} [operation] - 操作の説明
 * @returns {*} - API呼び出しの結果
 * @throws {Error} - API呼び出しエラーまたは制限超過エラー
 *
 * @example
 * const result = safeApiCall('Vertex_AI', () => {
 *   return UrlFetchApp.fetch(endpoint, options);
 * }, '書類OCR処理');
 */
function safeApiCall(apiType, apiCallFunction, operation = '') {
  // カウンターをインクリメント（制限チェック含む）
  incrementApiCallCounter(apiType, operation);

  try {
    // API呼び出しを実行
    const result = apiCallFunction();

    if (API_CALL_LIMITER_CONFIG.enableDetailedLogging) {
      Logger.log(`[API制限] ${apiType}${operation ? ' (' + operation + ')' : ''} 呼び出し成功`);
    }

    return result;

  } catch (error) {
    Logger.log(`[API制限] ${apiType}${operation ? ' (' + operation + ')' : ''} 呼び出しエラー: ${error.message}`);
    throw error;
  }
}

/**
 * プロジェクト終了時のAPI使用状況レポート
 * ログに統計情報を出力
 */
function logApiCallSummary() {
  const stats = getApiCallCount();

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('[API制限] 実行完了時の統計');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log(`  総呼び出し回数: ${stats.total}回`);
  Logger.log(`  上限: ${stats.maxAllowed}回`);
  Logger.log(`  使用率: ${Math.round((stats.total / stats.maxAllowed) * 100)}%`);

  if (Object.keys(stats.byType).length > 0) {
    Logger.log('  --- API種別ごとの内訳 ---');
    for (const [type, count] of Object.entries(stats.byType)) {
      Logger.log(`    ${type}: ${count}回`);
    }
  }

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ============================================
// 後方互換性のためのエイリアス
// （既存のconfig_settings.gsと同じ関数名）
// ============================================

/**
 * API呼び出しカウンターを増加（旧関数名との互換性）
 * @deprecated - incrementApiCallCounterを使用してください
 */
function incrementApiCounter(apiType) {
  incrementApiCallCounter(apiType);
}

/**
 * 現在のAPI呼び出し回数を取得（旧関数名との互換性）
 * @deprecated - getApiCallCountを使用してください
 */
function getApiCounter() {
  return getApiCallCount().total;
}
