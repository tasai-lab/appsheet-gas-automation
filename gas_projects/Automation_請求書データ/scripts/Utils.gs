/**
 * ユーティリティ関数
 */

/**
 * 実行時間計測クラス
 */
class ExecutionTimer {
  constructor() {
    this.startTime = new Date();
  }
  
  getElapsedSeconds() {
    const endTime = new Date();
    return ((endTime - this.startTime) / 1000).toFixed(2);
  }
}

/**
 * 実行ログを記録
 */
function logToExecutionSheet(scriptName, status, requestId, details = {}) {
  try {
    const sheet = SpreadsheetApp.openById(EXECUTION_LOG_SPREADSHEET_ID)
      .getSheetByName(EXECUTION_LOG_SHEET_NAME);
    
    if (!sheet) {
      Logger.log(`警告: 実行ログシート "${EXECUTION_LOG_SHEET_NAME}" が見つかりません`);
      return;
    }
    
    const timestamp = new Date();
    const row = [
      Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss'),
      scriptName,
      status,
      requestId || '',
      details.summary || '',
      details.errorMessage || '',
      details.user || Session.getActiveUser().getEmail(),
      details.processingTime || '',
      details.apiUsed || '',
      details.modelName || '',
      details.tokens || '',
      details.responseSize || '',
      details.inputSummary || '',
      details.outputSummary || '',
      details.notes || ''
    ];
    
    sheet.appendRow(row);
    
  } catch (e) {
    Logger.log(`エラー: ログ記録失敗 - ${e.message}`);
  }
}

/**
 * ヘッダーマップを作成
 */
function createHeaderMap(headers, requiredHeaders) {
  const map = {};
  requiredHeaders.forEach(header => {
    const index = headers.indexOf(header);
    map[header] = index;
  });
  return map;
}
