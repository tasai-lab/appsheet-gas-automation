/**
 * 実行ログ記録モジュール
 * GAS実行ログスプレッドシートに実行履歴を記録
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-20
 */

// 設定（統合GAS実行ログを使用、コスト管理シート）
const EXECUTION_LOG_SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';
const EXECUTION_LOG_SHEET_NAME = 'コスト管理';
const SCRIPT_NAME_EXEC_LOG = 'Appsheet_営業_音声記録';

/**
 * 実行ログを記録
 * @param {string} status - ステータス ('成功' | '失敗' | 'スキップ' | '処理中')
 * @param {string} activityId - 活動ID（リクエストID）
 * @param {Object} details - 処理詳細
 */
function logExecution(status, activityId, details = {}) {
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

    // 統合コスト管理シート用のログ行（37列）
    const row = [
      timestamp,                        // 1. タイムスタンプ
      SCRIPT_NAME_EXEC_LOG,             // 2. スクリプト名
      status,                           // 3. ステータス
      activityId || '',                 // 4. レコードID
      '',                               // 5. リクエストID
      details.processingTime || '',     // 6. 処理時間(秒)
      details.modelName || '',          // 7. モデル名
      details.inputTokens || '',        // 8. Input Tokens
      details.outputTokens || '',       // 9. Output Tokens
      details.inputCost || '',          // 10. Input料金(円)
      details.outputCost || '',         // 11. Output料金(円)
      details.totalCost || '',          // 12. 合計料金(円)
      '',                               // 13. 通話ID
      details.audioFileId || '',        // 14. ファイルパス
      '',                               // 15. ファイルID
      details.fileSize || '',           // 16. ファイルサイズ
      details.summary || '',            // 17. 要約(抜粋)
      '',                               // 18. 文字起こし長
      '',                               // 19. アクション数
      '',                               // 20. 利用者ID
      '',                               // 21. 利用者名
      '',                               // 22. 依頼理由
      '',                               // 23. 全文回答ID
      '',                               // 24. 記録ID
      details.salespersonName || '',    // 25. スタッフID
      '',                               // 26. 記録タイプ
      '',                               // 27. 入力テキスト長
      '',                               // 28. ドキュメントキー
      '',                               // 29. 処理種別
      '',                               // 30. ファイル名
      '',                               // 31. 処理結果(ページ数)
      timestamp,                        // 32. 開始時刻
      timestamp,                        // 33. 終了時刻
      '',                               // 34. ログサマリー
      details.errorMessage || '',       // 35. エラー詳細
      userEmail,                        // 36. 実行ユーザー
      `面会相手: ${details.contactName || ''}, 訪問先: ${details.orgName || ''}${details.notes ? ', ' + details.notes : ''}` // 37. 備考
    ];

    sheet.appendRow(row);
    Logger.log(`[実行ログ] ${status}: ${activityId}`);

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
  // 統合コスト管理シート用ヘッダー（37列）
  const headers = [
    'タイムスタンプ',
    'スクリプト名',
    'ステータス',
    'レコードID',
    'リクエストID',
    '処理時間(秒)',
    'モデル名',
    'Input Tokens',
    'Output Tokens',
    'Input料金(円)',
    'Output料金(円)',
    '合計料金(円)',
    '通話ID',
    'ファイルパス',
    'ファイルID',
    'ファイルサイズ',
    '要約(抜粋)',
    '文字起こし長',
    'アクション数',
    '利用者ID',
    '利用者名',
    '依頼理由',
    '全文回答ID',
    '記録ID',
    'スタッフID',
    '記録タイプ',
    '入力テキスト長',
    'ドキュメントキー',
    '処理種別',
    'ファイル名',
    '処理結果(ページ数)',
    '開始時刻',
    '終了時刻',
    'ログサマリー',
    'エラー詳細',
    '実行ユーザー',
    '備考'
  ];

  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  Logger.log('[実行ログ] シートを初期化しました');
}

/**
 * 処理開始ログを記録
 * @param {string} activityId - 活動ID
 * @param {Object} details - 処理詳細
 */
function logStartExec(activityId, details = {}) {
  logExecution('処理中', activityId, {
    ...details,
    notes: '処理開始'
  });
}

/**
 * 処理成功ログを記録
 * @param {string} activityId - 活動ID
 * @param {Object} details - 処理詳細
 */
function logSuccessExec(activityId, details = {}) {
  logExecution('成功', activityId, details);
}

/**
 * 処理失敗ログを記録
 * @param {string} activityId - 活動ID
 * @param {Error} error - エラーオブジェクト
 * @param {Object} details - 処理詳細
 */
function logFailureExec(activityId, error, details = {}) {
  logExecution('失敗', activityId, {
    ...details,
    errorMessage: error.message || String(error)
  });
}

/**
 * 処理スキップログを記録（重複時など）
 * @param {string} activityId - 活動ID
 * @param {string} reason - スキップ理由
 * @param {Object} details - 処理詳細
 */
function logSkipExec(activityId, reason, details = {}) {
  logExecution('スキップ', activityId, {
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
