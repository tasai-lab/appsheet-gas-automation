/**
 * 実行ログ記録モジュール
 * GAS実行ログスプレッドシートに実行履歴を記録
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-17
 */

// 設定
const EXECUTION_LOG_SPREADSHEET_ID = '15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE';
const EXECUTION_LOG_SHEET_NAME = '実行ログ';
const SCRIPT_NAME = 'Appsheet_通話_要約生成';

/**
 * 実行ログを記録
 * @param {string} status - ステータス ('成功' | '失敗' | 'スキップ' | '処理中')
 * @param {string} callId - 通話ID（リクエストID）
 * @param {Object} details - 処理詳細
 */
function logExecution(status, callId, details = {}) {
  try {
    const spreadsheet = SpreadsheetApp.openById(EXECUTION_LOG_SPREADSHEET_ID);
    let sheet = spreadsheet.getSheetByName(EXECUTION_LOG_SHEET_NAME);
    
    // シートが存在しない場合は作成
    if (!sheet) {
      sheet = spreadsheet.insertSheet(EXECUTION_LOG_SHEET_NAME);
      initializeLogSheet(sheet);
    }
    
    const timestamp = new Date();
    const row = [
      Utilities.formatDate(timestamp, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
      SCRIPT_NAME,
      status,
      callId || '',
      details.filePath || '',
      details.fileId || '',
      details.summary || '',
      details.transcriptLength || '',
      details.actionsCount || '',
      details.processingTime || '',
      details.errorMessage || '',
      details.modelName || '',
      details.fileSize || '',
      Session.getActiveUser().getEmail() || 'システム',
      details.notes || ''
    ];
    
    sheet.appendRow(row);
    Logger.log(`[実行ログ] ${status}: ${callId}`);
    
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
    '通話ID',
    'ファイルパス',
    'ファイルID',
    '要約（抜粋）',
    '文字起こし長',
    'アクション数',
    '処理時間（秒）',
    'エラーメッセージ',
    'モデル名',
    'ファイルサイズ',
    '実行ユーザー',
    '備考'
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
 * @param {string} callId - 通話ID
 * @param {Object} details - 処理詳細
 */
function logStart(callId, details = {}) {
  logExecution('処理中', callId, {
    ...details,
    notes: '処理開始'
  });
}

/**
 * 処理成功ログを記録
 * @param {string} callId - 通話ID
 * @param {Object} details - 処理詳細
 */
function logSuccess(callId, details = {}) {
  logExecution('成功', callId, details);
}

/**
 * 処理失敗ログを記録
 * @param {string} callId - 通話ID
 * @param {Error} error - エラーオブジェクト
 * @param {Object} details - 処理詳細
 */
function logFailure(callId, error, details = {}) {
  logExecution('失敗', callId, {
    ...details,
    errorMessage: error.message || String(error)
  });
}

/**
 * 処理スキップログを記録（重複時など）
 * @param {string} callId - 通話ID
 * @param {string} reason - スキップ理由
 * @param {Object} details - 処理詳細
 */
function logSkip(callId, reason, details = {}) {
  logExecution('スキップ', callId, {
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
