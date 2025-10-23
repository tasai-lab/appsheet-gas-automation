/**
 * 実行ログ記録モジュール
 * 統合コスト管理シートに実行履歴とAPI料金を記録
 * 共通モジュールパターンを使用
 * @author Fractal Group
 * @version 3.0.0
 * @date 2025-10-23
 */

// 設定（統合コスト管理シートを使用）
// EXECUTION_LOG_SPREADSHEET_ID は config.gs で定義
const EXECUTION_LOG_SHEET_NAME = 'コスト管理';

/**
 * 実行時間計測用のタイマークラス（共通モジュールパターン）
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

/**
 * 実行ログを記録
 * @param {string} status - ステータス ('成功' | '失敗' | 'スキップ')
 * @param {string} orgId - 組織ID（レコードID）
 * @param {Object} details - 処理詳細
 */
function logExecution(status, orgId, details = {}) {
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
      userEmail = 'システム';
    }

    // Places APIのコスト情報を取得
    const apiCalls = details.places_api_calls || 0;
    const cost = calculatePlacesAPICost(apiCalls);

    // 統合コスト管理シート用のログ行（37列）
    // 備考欄の内容を構築（デバッグ情報含む）
    let notesContent = details.notes || `USD: $${cost.costUSD.toFixed(4)}, キャッシュ使用: ${details.cacheUsed ? 'はい' : 'いいえ'}`;

    // デバッグモードが有効で、デバッグノートがある場合は追加
    if (DEBUG_MODE && details.debugNotes) {
      notesContent = `${details.debugNotes}\n\n---\n${notesContent}`;
    }

    const row = [
      timestamp,                                    // 1. タイムスタンプ
      SCRIPT_NAME,                                  // 2. スクリプト名
      status,                                       // 3. ステータス
      orgId || '',                                  // 4. レコードID
      '',                                           // 5. リクエストID
      details.processingTime || '',                 // 6. 処理時間(秒)
      'Places API (New) - Text Search',            // 7. モデル名（API名）
      '',                                           // 8. Input Tokens（Places APIでは使用しない）
      '',                                           // 9. Output Tokens（Places APIでは使用しない）
      '',                                           // 10. Input料金(円)（Places APIでは使用しない）
      '',                                           // 11. Output料金(円)（Places APIでは使用しない）
      cost.costJPY.toFixed(2),                      // 12. 合計料金(円)
      '',                                           // 13. 通話ID
      '',                                           // 14. ファイルパス
      '',                                           // 15. ファイルID
      '',                                           // 16. ファイルサイズ
      '',                                           // 17. 要約(抜粋)
      '',                                           // 18. 文字起こし長
      '',                                           // 19. アクション数
      '',                                           // 20. 利用者ID
      '',                                           // 21. 利用者名
      '',                                           // 22. 依頼理由
      '',                                           // 23. 全文回答ID
      '',                                           // 24. 記録ID
      '',                                           // 25. スタッフID
      '',                                           // 26. 記録タイプ
      '',                                           // 27. 入力テキスト長
      '',                                           // 28. ドキュメントキー
      details.processType || 'Places API検索',     // 29. 処理種別
      details.searchQuery || '',                    // 30. ファイル名（検索クエリとして使用）
      `API呼び出し: ${apiCalls}回`,                 // 31. 処理結果（API呼び出し回数）
      timestamp,                                    // 32. 開始時刻
      timestamp,                                    // 33. 終了時刻
      details.summary || `組織ID: ${orgId}`,       // 34. ログサマリー
      details.errorMessage || '',                   // 35. エラー詳細
      userEmail,                                    // 36. 実行ユーザー
      notesContent                                  // 37. 備考（デバッグ情報含む）
    ];

    sheet.appendRow(row);
    Logger.log(`[実行ログ] ${status}: ${orgId}, コスト: ¥${cost.costJPY.toFixed(2)}, API呼び出し: ${apiCalls}回`);

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
 * 処理開始ログを記録（共通モジュールパターン）
 * @param {string} orgId - 組織ID
 * @param {Object} details - 処理詳細
 */
function logStart(orgId, details = {}) {
  logExecution('処理中', orgId, {
    ...details,
    notes: details.notes || '処理開始'
  });
}

/**
 * 処理成功ログを記録（共通モジュールパターン）
 * @param {string} orgId - 組織ID
 * @param {Object} details - 処理詳細
 */
function logSuccess(orgId, details = {}) {
  logExecution('成功', orgId, details);
}

/**
 * 処理失敗ログを記録（共通モジュールパターン）
 * @param {string} orgId - 組織ID
 * @param {Error} error - エラーオブジェクト
 * @param {Object} details - 処理詳細
 */
function logFailure(orgId, error, details = {}) {
  logExecution('失敗', orgId, {
    ...details,
    errorMessage: error.message || String(error)
  });
}

/**
 * 処理スキップログを記録（共通モジュールパターン）
 * @param {string} orgId - 組織ID
 * @param {string} reason - スキップ理由
 * @param {Object} details - 処理詳細
 */
function logSkip(orgId, reason, details = {}) {
  logExecution('スキップ', orgId, {
    ...details,
    places_api_calls: 0,
    notes: reason
  });
}

/**
 * Places APIコスト情報を計算して返す
 * @param {number} apiCallCount - API呼び出し回数
 * @param {boolean} cacheUsed - キャッシュ使用フラグ
 * @returns {Object} コスト情報
 */
function calculateApiCostDetails(apiCallCount, cacheUsed = false) {
  const cost = calculatePlacesAPICost(apiCallCount);

  return {
    places_api_calls: apiCallCount,
    cacheUsed: cacheUsed,
    costUSD: cost.costUSD,
    costJPY: cost.costJPY,
    apiType: 'Places API (New) - Text Search',
    notes: `USD: $${cost.costUSD.toFixed(4)}, キャッシュ使用: ${cacheUsed ? 'はい' : 'いいえ'}`
  };
}

/**
 * 簡易Logger（互換性のため）
 */
function createLogger(scriptName) {
  return {
    info: function(message, data) {
      console.log(`[INFO] ${message}`, data || '');
    },
    success: function(message, data) {
      console.log(`[SUCCESS] ${message}`, data || '');
    },
    warning: function(message, data) {
      console.log(`[WARNING] ${message}`, data || '');
    },
    error: function(message, data) {
      console.error(`[ERROR] ${message}`, data || '');
    },
    saveToSpreadsheet: function(status, recordId, details) {
      logExecution(status, recordId, details);
    }
  };
}
