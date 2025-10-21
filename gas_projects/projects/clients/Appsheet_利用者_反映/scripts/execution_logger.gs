/**
 * 実行ログ記録モジュール
 * GAS実行ログスプレッドシートに実行履歴を記録
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-21
 */

// 設定（統合GAS実行ログを使用、専用シート）
const EXECUTION_LOG_SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';
const EXECUTION_LOG_SHEET_NAME = '実行履歴_利用者反映';

/**
 * 実行ログを記録
 * @param {string} status - ステータス ('成功' | '失敗' | 'スキップ' | '処理中')
 * @param {string} requestId - リクエストID
 * @param {Object} details - 処理詳細
 */
function logExecution(status, requestId, details = {}) {
  try {
    const spreadsheet = SpreadsheetApp.openById(EXECUTION_LOG_SPREADSHEET_ID);
    let sheet = spreadsheet.getSheetByName(EXECUTION_LOG_SHEET_NAME);

    // シートが存在しない場合は作成
    if (!sheet) {
      sheet = spreadsheet.insertSheet(EXECUTION_LOG_SHEET_NAME);
      initializeLogSheet(sheet);
    }

    const timestamp = new Date();

    // ユーザー情報を安全に取得
    let userEmail = 'システム';
    try {
      const activeUser = Session.getActiveUser().getEmail();
      if (activeUser) {
        userEmail = activeUser;
      }
    } catch (e) {
      // ユーザー情報取得失敗時はデフォルト値を使用
      userEmail = 'システム';
    }

    const row = [
      Utilities.formatDate(timestamp, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
      SCRIPT_NAME,
      status,
      requestId || '',
      details.clientId || '',
      details.clientName || '',
      details.requestReason || '',
      details.staffId || '',
      details.processingTime || '',
      details.errorMessage || '',
      details.modelName || '',
      userEmail,
      details.notes || '',
      details.inputTokens || '',
      details.outputTokens || '',
      details.inputCost || '',
      details.outputCost || '',
      details.totalCost || ''
    ];

    sheet.appendRow(row);
    Logger.log(`[実行ログ] ${status}: ${requestId}`);

  } catch (e) {
    Logger.log(`[実行ログ] ⚠️ ログ記録失敗: ${e.message}`);
    // ログ記録失敗はメイン処理に影響させない
  }
}

/**
 * ログシートを初期化（ヘッダー行を作成）
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function initializeLogSheet(sheet) {
  const headers = [
    'タイムスタンプ',
    'スクリプト名',
    'ステータス',
    'リクエストID',
    '利用者ID',
    '利用者名',
    '依頼理由',
    '担当者ID',
    '処理時間（秒）',
    'エラーメッセージ',
    'モデル名',
    '実行ユーザー',
    '備考',
    'Input Tokens',
    'Output Tokens',
    'Input料金(円)',
    'Output料金(円)',
    '合計料金(円)'
  ];

  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#f3f3f3');
  sheet.setFrozenRows(1);

  Logger.log('[実行ログ] シートを初期化しました');
}

/**
 * 処理開始ログを記録
 * @param {string} requestId - リクエストID
 * @param {Object} details - 処理詳細
 */
function logStart(requestId, details = {}) {
  logExecution('処理中', requestId, {
    ...details,
    notes: '処理開始'
  });
}

/**
 * 処理成功ログを記録
 * @param {string} requestId - リクエストID
 * @param {Object} details - 処理詳細
 */
function logSuccess(requestId, details = {}) {
  logExecution('成功', requestId, details);
}

/**
 * 処理失敗ログを記録
 * @param {string} requestId - リクエストID
 * @param {Error} error - エラーオブジェクト
 * @param {Object} details - 処理詳細
 */
function logFailure(requestId, error, details = {}) {
  logExecution('失敗', requestId, {
    ...details,
    errorMessage: error.message || String(error)
  });
}

/**
 * 処理スキップログを記録（重複時など）
 * @param {string} requestId - リクエストID
 * @param {string} reason - スキップ理由
 * @param {Object} details - 処理詳細
 */
function logSkip(requestId, reason, details = {}) {
  logExecution('スキップ', requestId, {
    ...details,
    notes: reason
  });
}

/**
 * 実行時間計測用のタイマークラス
 */
class ExecutionTimer {
  constructor() {
    this.startTime = new Date();
  }

  /**
   * 経過時間を秒単位で取得
   * @return {string} 経過時間（秒）
   */
  getElapsedSeconds() {
    const endTime = new Date();
    return ((endTime - this.startTime) / 1000).toFixed(2);
  }

  /**
   * 経過時間を分秒形式で取得
   * @return {string} 経過時間（分:秒）
   */
  getElapsedFormatted() {
    const seconds = parseFloat(this.getElapsedSeconds());
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return minutes > 0 ? `${minutes}:${secs}` : `${secs}s`;
  }
}
