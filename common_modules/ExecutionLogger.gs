/**
 * 実行履歴ログ記録モジュール
 * 全てのGASスクリプトの実行履歴を共通スプレッドシートに記録
 */

// ログスプレッドシートID（統一）
const LOG_SPREADSHEET_ID = '15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE';
const LOG_FOLDER_ID = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX';
const LOG_SHEET_NAME = '実行履歴';

/**
 * 実行履歴をスプレッドシートに記録
 * @param {string} scriptName - スクリプト名
 * @param {string} status - ステータス（SUCCESS/ERROR/WARNING）
 * @param {string} message - メッセージ
 * @param {Object} details - 詳細情報（オプション）
 * @param {string} requestId - リクエストID（オプション）
 * @param {number} processingTime - 処理時間（秒）（オプション）
 */
function logExecution(scriptName, status, message, details = null, requestId = null, processingTime = null) {
  try {
    const spreadsheet = getOrCreateLogSpreadsheet();
    const sheet = spreadsheet.getSheetByName(LOG_SHEET_NAME) || spreadsheet.getSheets()[0];
    
    const timestamp = new Date();
    const detailsStr = details ? JSON.stringify(details) : '';
    
    // ログ行を追加
    sheet.appendRow([
      timestamp,
      scriptName,
      status,
      message,
      detailsStr,
      requestId || '',
      processingTime || ''
    ]);
    
    // ステータスに応じて行の色を設定
    const lastRow = sheet.getLastRow();
    const range = sheet.getRange(lastRow, 1, 1, 7);
    
    switch(status) {
      case 'SUCCESS':
        range.setBackground('#d4edda'); // 緑
        break;
      case 'ERROR':
        range.setBackground('#f8d7da'); // 赤
        break;
      case 'WARNING':
        range.setBackground('#fff3cd'); // 黄色
        break;
      default:
        range.setBackground('#d1ecf1'); // 青
    }
    
    // 古いログを削除（10000行以上の場合）
    if (sheet.getLastRow() > 10000) {
      sheet.deleteRows(2, 1000); // ヘッダーを除いて古い1000行を削除
    }
    
  } catch (error) {
    console.error('Failed to log execution:', error);
    // ログ記録失敗は処理を止めない
  }
}

/**
 * ログスプレッドシートを取得または作成
 * @return {Spreadsheet} ログスプレッドシート
 */
function getOrCreateLogSpreadsheet() {
  try {
    // 統一されたスプレッドシートIDを使用
    if (LOG_SPREADSHEET_ID) {
      try {
        return SpreadsheetApp.openById(LOG_SPREADSHEET_ID);
      } catch (e) {
        console.warn('Log spreadsheet not accessible:', e.message);
      }
    }
    
    // PropertiesServiceからスプレッドシートIDを取得（フォールバック）
    const scriptProperties = PropertiesService.getScriptProperties();
    let spreadsheetId = scriptProperties.getProperty('LOG_SPREADSHEET_ID');
    
    if (spreadsheetId) {
      try {
        return SpreadsheetApp.openById(spreadsheetId);
      } catch (e) {
        // スプレッドシートが削除されている場合は再作成
        console.warn('Log spreadsheet not found, creating new one');
      }
    }
    
    // フォルダー内で既存のスプレッドシートを検索
    const folder = DriveApp.getFolderById(LOG_FOLDER_ID);
    const files = folder.getFilesByName(LOG_SHEET_NAME);
    
    if (files.hasNext()) {
      const file = files.next();
      spreadsheetId = file.getId();
      scriptProperties.setProperty('LOG_SPREADSHEET_ID', spreadsheetId);
      return SpreadsheetApp.openById(spreadsheetId);
    }
    
    // 新規作成
    const spreadsheet = SpreadsheetApp.create(LOG_SHEET_NAME);
    spreadsheetId = spreadsheet.getId();
    
    // フォルダーに移動
    const file = DriveApp.getFileById(spreadsheetId);
    file.moveTo(folder);
    
    // ヘッダー行を設定
    const sheet = spreadsheet.getSheets()[0];
    sheet.setName(LOG_SHEET_NAME);
    sheet.setFrozenRows(1);
    
    const headers = [
      'タイムスタンプ',
      'スクリプト名',
      'ステータス',
      'メッセージ',
      '詳細',
      'リクエストID',
      '処理時間(秒)'
    ];
    
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setBackground('#333333');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    
    // 列幅を調整
    sheet.setColumnWidth(1, 150); // タイムスタンプ
    sheet.setColumnWidth(2, 200); // スクリプト名
    sheet.setColumnWidth(3, 100); // ステータス
    sheet.setColumnWidth(4, 300); // メッセージ
    sheet.setColumnWidth(5, 400); // 詳細
    sheet.setColumnWidth(6, 150); // リクエストID
    sheet.setColumnWidth(7, 100); // 処理時間
    
    // プロパティに保存
    scriptProperties.setProperty('LOG_SPREADSHEET_ID', spreadsheetId);
    
    return spreadsheet;
    
  } catch (error) {
    console.error('Failed to get or create log spreadsheet:', error);
    throw new Error('ログスプレッドシートの取得/作成に失敗しました: ' + error.message);
  }
}

/**
 * 重複実行を防止するためのロック機構
 * @param {string} lockKey - ロックキー（リクエストIDなど）
 * @param {number} timeout - タイムアウト（ミリ秒）
 * @return {boolean} ロック取得成功の場合true
 */
function acquireLock(lockKey, timeout = 30000) {
  const lock = LockService.getScriptLock();
  
  try {
    return lock.tryLock(timeout);
  } catch (error) {
    console.error('Failed to acquire lock:', error);
    return false;
  }
}

/**
 * ロックを解放
 */
function releaseLock() {
  const lock = LockService.getScriptLock();
  lock.releaseLock();
}

/**
 * リクエストの重複チェック
 * @param {string} requestId - リクエストID
 * @param {number} timeWindow - 重複チェック時間窓（秒）デフォルト300秒（5分）
 * @return {boolean} 重複の場合true
 */
function isDuplicateRequest(requestId, timeWindow = 300) {
  if (!requestId) return false;
  
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'request_' + requestId;
    
    const existing = cache.get(cacheKey);
    if (existing) {
      console.log('Duplicate request detected:', requestId);
      return true;
    }
    
    // リクエストIDをキャッシュに保存
    cache.put(cacheKey, new Date().toISOString(), timeWindow);
    return false;
    
  } catch (error) {
    console.error('Failed to check duplicate request:', error);
    return false; // エラー時は処理を続行
  }
}

/**
 * エラー情報を整形
 * @param {Error} error - エラーオブジェクト
 * @return {Object} 整形されたエラー情報
 */
function formatError(error) {
  return {
    message: error.message || String(error),
    stack: error.stack || '',
    name: error.name || 'Error'
  };
}
