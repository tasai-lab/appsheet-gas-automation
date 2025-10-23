/**
 * Automation用実行ログ記録モジュール
 * 
 * 全てのAutomationスクリプトで共通して使用する実行ログ機能を提供します。
 * Vertex AI APIのコスト計算機能を含みます。
 */

// 設定
const EXECUTION_LOG_SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';
const EXECUTION_LOG_SHEET_NAME = '実行履歴';

/**
 * 実行ログを記録
 * @param {string} scriptName - スクリプト名
 * @param {string} status - ステータス ('成功' | '失敗' | 'スキップ')
 * @param {string} requestId - リクエストID（重複チェック用）
 * @param {Object} details - 処理詳細
 */
function logExecution(scriptName, status, requestId, details = {}) {
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
      details.cost || '',  // コスト（USD）
      details.notes || ''
    ];
    
    sheet.appendRow(row);
    
  } catch (e) {
    Logger.log(`エラー: ログ記録失敗 - ${e.message}`);
  }
}

/**
 * 重複実行チェック
 * @param {string} scriptName - スクリプト名
 * @param {string} requestId - リクエストID
 * @param {number} timeWindowMinutes - チェック対象時間範囲（分）
 * @return {boolean} - 重複している場合true
 */
function isDuplicateExecution(scriptName, requestId, timeWindowMinutes = 5) {
  if (!requestId) return false;
  
  try {
    const sheet = SpreadsheetApp.openById(EXECUTION_LOG_SPREADSHEET_ID)
      .getSheetByName(EXECUTION_LOG_SHEET_NAME);
    
    if (!sheet) return false;
    
    const now = new Date();
    const timeThreshold = new Date(now.getTime() - timeWindowMinutes * 60 * 1000);
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const scriptNameIdx = headers.indexOf('スクリプト名');
    const requestIdIdx = headers.indexOf('リクエストID');
    const timestampIdx = headers.indexOf('タイムスタンプ');
    
    for (let i = data.length - 1; i > 0; i--) {
      const row = data[i];
      const rowTimestamp = new Date(row[timestampIdx]);
      
      // 時間範囲外ならチェック終了
      if (rowTimestamp < timeThreshold) break;
      
      // スクリプト名とリクエストIDが一致するかチェック
      if (row[scriptNameIdx] === scriptName && row[requestIdIdx] === requestId) {
        Logger.log(`重複実行検出: ${scriptName}, RequestID: ${requestId}`);
        return true;
      }
    }
    
    return false;
    
  } catch (e) {
    Logger.log(`警告: 重複チェック失敗 - ${e.message}`);
    return false; // エラー時は処理を継続
  }
}

/**
 * 実行時間を計測するヘルパー
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
 * Vertex AI APIコスト計算機能
 */
class VertexAICostCalculator {
  constructor() {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.apiCalls = [];
  }
  
  /**
   * API呼び出しのトークン数を記録
   * @param {string} model - モデル名
   * @param {number} inputTokens - 入力トークン数
   * @param {number} outputTokens - 出力トークン数
   */
  recordApiCall(model, inputTokens, outputTokens) {
    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
    this.apiCalls.push({
      model: model,
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      timestamp: new Date()
    });
  }
  
  /**
   * 総コストを計算（USD）
   * @param {string} model - モデル名
   * @returns {number} コスト（USD）
   */
  calculateTotalCost(model) {
    const pricing = VERTEX_AI_CONFIG.pricing[model];
    
    if (!pricing) {
      Logger.log(`警告: モデル ${model} の価格情報が見つかりません`);
      return 0;
    }
    
    const inputCost = (this.totalInputTokens / 1000000) * pricing.inputPer1MTokens;
    const outputCost = (this.totalOutputTokens / 1000000) * pricing.outputPer1MTokens;
    
    return inputCost + outputCost;
  }
  
  /**
   * コストサマリーを取得
   * @param {string} model - モデル名
   * @returns {Object} サマリー情報
   */
  getSummary(model) {
    const cost = this.calculateTotalCost(model);
    
    return {
      totalApiCalls: this.apiCalls.length,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      totalCostUSD: cost.toFixed(6),
      costFormatted: `$${cost.toFixed(6)}`,
      model: model
    };
  }
  
  /**
   * ログ記録用の文字列を生成
   * @param {string} model - モデル名
   * @returns {string} ログ用文字列
   */
  getLogString(model) {
    const summary = this.getSummary(model);
    return `${summary.totalApiCalls}回 | In:${summary.totalInputTokens} Out:${summary.totalOutputTokens} | ${summary.costFormatted}`;
  }
}

