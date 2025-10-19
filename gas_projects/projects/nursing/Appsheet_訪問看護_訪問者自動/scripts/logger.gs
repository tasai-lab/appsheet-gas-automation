/**
 * 統合ロガーモジュール
 * 全てのGASプロジェクトで共通使用するログ管理システム
 * 
 * @version 1.0.0
 * @date 2025-10-16
 */

/**
 * ログ設定
 */
const LOGGER_CONFIG = {
  // ログスプレッドシート格納先（共有ドライブ）
  logFolderId: '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX', // 共有ドライブのGASフォルダー
  logSpreadsheetName: 'GAS実行ログ_統合',
  
  // ログ保持期間（日数）
  retentionDays: 90,
  
  // ログレベル
  levels: {
    INFO: 'INFO',
    SUCCESS: 'SUCCESS',
    WARNING: 'WARNING',
    ERROR: 'ERROR'
  }
};

/**
 * ロガークラス
 */
class GASLogger {
  constructor(scriptName) {
    this.scriptName = scriptName;
    this.logs = [];
    this.startTime = new Date();
    this.requestId = Utilities.getUuid();
    this.usageMetadata = null; // API使用量情報
  }

  /**
   * ログ追加
   * @param {string} level - ログレベル（INFO/SUCCESS/WARNING/ERROR）
   * @param {string} message - ログメッセージ
   * @param {Object} details - 詳細情報（オプション）
   */
  log(level, message, details = null) {
    const timestamp = new Date();
    const logEntry = {
      timestamp: timestamp,
      level: level,
      message: message,
      details: details
    };
    
    this.logs.push(logEntry);
    
    // コンソールにも出力
    const consoleMsg = `[${timestamp.toISOString()}] [${level}] ${message}`;
    if (level === LOGGER_CONFIG.levels.ERROR) {
      console.error(consoleMsg);
    } else if (level === LOGGER_CONFIG.levels.WARNING) {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }
  }

  /**
   * INFOレベルログ
   */
  info(message, details = null) {
    this.log(LOGGER_CONFIG.levels.INFO, message, details);
  }

  /**
   * SUCCESSレベルログ
   */
  success(message, details = null) {
    this.log(LOGGER_CONFIG.levels.SUCCESS, message, details);
  }

  /**
   * WARNINGレベルログ
   */
  warning(message, details = null) {
    this.log(LOGGER_CONFIG.levels.WARNING, message, details);
  }

  /**
   * ERRORレベルログ
   */
  error(message, details = null) {
    this.log(LOGGER_CONFIG.levels.ERROR, message, details);
  }

  /**
   * API使用量情報を設定
   * @param {Object} usageMetadata - 使用量情報 {model, inputTokens, outputTokens, inputCostJPY, outputCostJPY, totalCostJPY}
   */
  setUsageMetadata(usageMetadata) {
    if (!this.usageMetadata) {
      this.usageMetadata = {
        model: usageMetadata.model || '',
        inputTokens: usageMetadata.inputTokens || 0,
        outputTokens: usageMetadata.outputTokens || 0,
        inputCostJPY: usageMetadata.inputCostJPY || 0,
        outputCostJPY: usageMetadata.outputCostJPY || 0,
        totalCostJPY: usageMetadata.totalCostJPY || 0
      };
    } else {
      // 既存のusageMetadataに加算（複数回API呼び出しがある場合）
      this.usageMetadata.inputTokens += usageMetadata.inputTokens || 0;
      this.usageMetadata.outputTokens += usageMetadata.outputTokens || 0;
      this.usageMetadata.inputCostJPY += usageMetadata.inputCostJPY || 0;
      this.usageMetadata.outputCostJPY += usageMetadata.outputCostJPY || 0;
      this.usageMetadata.totalCostJPY += usageMetadata.totalCostJPY || 0;
    }
  }

  /**
   * ログをスプレッドシートに保存
   * @param {string} status - 最終ステータス（成功/エラー）
   * @param {string} recordId - 処理対象レコードID（オプション）
   */
  saveToSpreadsheet(status, recordId = null) {
    try {
      const sheet = this._getOrCreateLogSheet();
      const endTime = new Date();
      const executionTime = (endTime.getTime() - this.startTime.getTime()) / 1000;

      // API使用量情報
      const model = this.usageMetadata ? this.usageMetadata.model : '';
      const inputTokens = this.usageMetadata ? this.usageMetadata.inputTokens : 0;
      const outputTokens = this.usageMetadata ? this.usageMetadata.outputTokens : 0;
      const inputCostJPY = this.usageMetadata ? this.usageMetadata.inputCostJPY : 0;
      const outputCostJPY = this.usageMetadata ? this.usageMetadata.outputCostJPY : 0;
      const totalCostJPY = this.usageMetadata ? this.usageMetadata.totalCostJPY : 0;

      // メインログ行を追加
      const mainLogRow = [
        this.startTime,
        endTime,
        executionTime,
        this.scriptName,
        status,
        recordId || '',
        this.requestId,
        this._getLogSummary(),
        this._getErrorSummary(),
        model,
        inputTokens,
        outputTokens,
        inputCostJPY,
        outputCostJPY,
        totalCostJPY
      ];

      sheet.appendRow(mainLogRow);

      // 詳細ログをJSON形式で別シートに保存（オプション）
      this._saveDetailedLogs();

    } catch (e) {
      console.error(`ログのスプレッドシート保存に失敗: ${e.toString()}`);
      // スプレッドシート保存に失敗してもメイン処理は継続
    }
  }

  /**
   * ログスプレッドシートを取得または作成
   * @private
   */
  _getOrCreateLogSheet() {
    const folder = DriveApp.getFolderById(LOGGER_CONFIG.logFolderId);
    let spreadsheet;
    
    // 既存のログスプレッドシートを検索
    const files = folder.getFilesByName(LOGGER_CONFIG.logSpreadsheetName);
    if (files.hasNext()) {
      const file = files.next();
      spreadsheet = SpreadsheetApp.openById(file.getId());
    } else {
      // 新規作成
      spreadsheet = SpreadsheetApp.create(LOGGER_CONFIG.logSpreadsheetName);
      const file = DriveApp.getFileById(spreadsheet.getId());
      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    }
    
    let sheet = spreadsheet.getSheetByName('実行履歴');
    if (!sheet) {
      sheet = spreadsheet.insertSheet('実行履歴');
      
      // ヘッダー行を追加
      const headers = [
        '開始時刻',
        '終了時刻',
        '実行時間(秒)',
        'スクリプト名',
        'ステータス',
        'レコードID',
        'リクエストID',
        'ログサマリー',
        'エラー詳細',
        'モデル',
        'Input Tokens',
        'Output Tokens',
        'Input料金(円)',
        'Output料金(円)',
        '合計料金(円)'
      ];
      sheet.appendRow(headers);

      // ヘッダー行のフォーマット
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');

      // 列幅を調整
      sheet.setColumnWidth(1, 150);  // 開始時刻
      sheet.setColumnWidth(2, 150);  // 終了時刻
      sheet.setColumnWidth(3, 100);  // 実行時間
      sheet.setColumnWidth(4, 250);  // スクリプト名
      sheet.setColumnWidth(5, 100);  // ステータス
      sheet.setColumnWidth(6, 150);  // レコードID
      sheet.setColumnWidth(7, 250);  // リクエストID
      sheet.setColumnWidth(8, 400);  // ログサマリー
      sheet.setColumnWidth(9, 400);  // エラー詳細
      sheet.setColumnWidth(10, 180); // モデル
      sheet.setColumnWidth(11, 120); // Input Tokens
      sheet.setColumnWidth(12, 120); // Output Tokens
      sheet.setColumnWidth(13, 120); // Input Cost
      sheet.setColumnWidth(14, 120); // Output Cost
      sheet.setColumnWidth(15, 120); // Total Cost
      
      // 固定行
      sheet.setFrozenRows(1);
    }
    
    return sheet;
  }

  /**
   * ログサマリーを取得
   * @private
   */
  _getLogSummary() {
    const summary = this.logs.map(log => {
      const time = Utilities.formatDate(log.timestamp, 'Asia/Tokyo', 'HH:mm:ss');
      return `[${time}] ${log.message}`;
    }).join('\n');
    
    // 最大文字数制限（スプレッドシートのセル制限対策）
    return summary.length > 50000 ? summary.substring(0, 50000) + '...(省略)' : summary;
  }

  /**
   * エラーサマリーを取得
   * @private
   */
  _getErrorSummary() {
    const errors = this.logs.filter(log => log.level === LOGGER_CONFIG.levels.ERROR);
    if (errors.length === 0) return '';
    
    const summary = errors.map(log => {
      let msg = log.message;
      if (log.details) {
        msg += `\n詳細: ${JSON.stringify(log.details, null, 2)}`;
      }
      return msg;
    }).join('\n---\n');
    
    return summary.length > 50000 ? summary.substring(0, 50000) + '...(省略)' : summary;
  }

  /**
   * 詳細ログを別シートに保存
   * @private
   */
  _saveDetailedLogs() {
    try {
      const spreadsheet = SpreadsheetApp.openById(
        DriveApp.getFilesByName(LOGGER_CONFIG.logSpreadsheetName).next().getId()
      );
      
      let sheet = spreadsheet.getSheetByName('詳細ログ');
      if (!sheet) {
        sheet = spreadsheet.insertSheet('詳細ログ');
        const headers = ['リクエストID', 'タイムスタンプ', 'レベル', 'メッセージ', '詳細'];
        sheet.appendRow(headers);
        
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#4285f4');
        headerRange.setFontColor('#ffffff');
        
        sheet.setFrozenRows(1);
      }
      
      // 詳細ログを追加
      this.logs.forEach(log => {
        const row = [
          this.requestId,
          log.timestamp,
          log.level,
          log.message,
          log.details ? JSON.stringify(log.details) : ''
        ];
        sheet.appendRow(row);
      });
      
    } catch (e) {
      console.error(`詳細ログの保存に失敗: ${e.toString()}`);
    }
  }

  /**
   * 古いログを削除（保持期間を超えたログ）
   * トリガーで定期実行を推奨
   */
  static cleanupOldLogs() {
    try {
      const folder = DriveApp.getFolderById(LOGGER_CONFIG.logFolderId);
      const files = folder.getFilesByName(LOGGER_CONFIG.logSpreadsheetName);
      
      if (!files.hasNext()) return;
      
      const spreadsheet = SpreadsheetApp.openById(files.next().getId());
      const sheet = spreadsheet.getSheetByName('実行履歴');
      
      if (!sheet) return;
      
      const data = sheet.getDataRange().getValues();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - LOGGER_CONFIG.retentionDays);
      
      // 古い行を特定（ヘッダー行をスキップ）
      const rowsToDelete = [];
      for (let i = data.length - 1; i >= 1; i--) {
        const rowDate = new Date(data[i][0]); // 開始時刻列
        if (rowDate < cutoffDate) {
          rowsToDelete.push(i + 1); // シート行番号は1始まり
        }
      }
      
      // 行を削除
      rowsToDelete.forEach(rowNum => {
        sheet.deleteRow(rowNum);
      });
      
      console.log(`${rowsToDelete.length}件の古いログを削除しました`);
      
    } catch (e) {
      console.error(`ログクリーンアップに失敗: ${e.toString()}`);
    }
  }
}

/**
 * ヘルパー関数: 簡易ロガー作成
 * @param {string} scriptName - スクリプト名
 * @return {GASLogger} ロガーインスタンス
 */
function createLogger(scriptName) {
  return new GASLogger(scriptName);
}
