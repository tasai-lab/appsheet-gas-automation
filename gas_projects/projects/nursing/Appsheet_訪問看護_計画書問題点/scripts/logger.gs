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
  // ログスプレッドシート（統合コスト管理シート）
  logSpreadsheetId: '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA', // 統合GAS実行ログ
  logSheetName: 'コスト管理', // シート名

  // フォールバック用（スプレッドシートが見つからない場合）
  logFolderId: '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX', // 共有ドライブのGASフォルダー
  logSpreadsheetName: 'GAS実行ログ', // スプレッドシート名

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

      // 統合コスト管理シート用のログ行（37列）
      const mainLogRow = [
        this.startTime,                    // 1. タイムスタンプ
        this.scriptName,                   // 2. スクリプト名
        status,                            // 3. ステータス
        recordId || '',                    // 4. レコードID
        this.requestId,                    // 5. リクエストID
        executionTime,                     // 6. 処理時間(秒)
        model,                             // 7. モデル名
        inputTokens,                       // 8. Input Tokens
        outputTokens,                      // 9. Output Tokens
        inputCostJPY,                      // 10. Input料金(円)
        outputCostJPY,                     // 11. Output料金(円)
        totalCostJPY,                      // 12. 合計料金(円)
        '',                                // 13. 通話ID（プロジェクト固有）
        '',                                // 14. ファイルパス
        '',                                // 15. ファイルID
        '',                                // 16. ファイルサイズ
        '',                                // 17. 要約(抜粋)
        '',                                // 18. 文字起こし長
        '',                                // 19. アクション数
        '',                                // 20. 利用者ID
        '',                                // 21. 利用者名
        '',                                // 22. 依頼理由
        '',                                // 23. 全文回答ID
        '',                                // 24. 記録ID
        '',                                // 25. スタッフID
        '',                                // 26. 記録タイプ
        '',                                // 27. 入力テキスト長
        '',                                // 28. ドキュメントキー
        '',                                // 29. 処理種別
        '',                                // 30. ファイル名
        '',                                // 31. 処理結果(ページ数)
        this.startTime,                    // 32. 開始時刻
        endTime,                           // 33. 終了時刻
        this._getLogSummary(),             // 34. ログサマリー
        this._getErrorSummary(),           // 35. エラー詳細
        '',                                // 36. 実行ユーザー
        ''                                 // 37. 備考
      ];

      sheet.appendRow(mainLogRow);

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
    let spreadsheet;

    try {
      // 固定のスプレッドシートIDを使用（統合コスト管理シート）
      spreadsheet = SpreadsheetApp.openById(LOGGER_CONFIG.logSpreadsheetId);
    } catch (e) {
      // スプレッドシートが見つからない場合はフォールバック
      console.error(`統合ログシートが見つかりません（ID: ${LOGGER_CONFIG.logSpreadsheetId}）。フォールバック処理を実行します。`);

      const folder = DriveApp.getFolderById(LOGGER_CONFIG.logFolderId);

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
    }

    let sheet = spreadsheet.getSheetByName(LOGGER_CONFIG.logSheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(LOGGER_CONFIG.logSheetName);

      // 統合ヘッダー行を追加
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

      // ヘッダー行のフォーマット
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');

      // 列幅を調整（統合コスト管理シート用）
      sheet.setColumnWidth(1, 150);  // タイムスタンプ
      sheet.setColumnWidth(2, 250);  // スクリプト名
      sheet.setColumnWidth(3, 100);  // ステータス
      sheet.setColumnWidth(4, 150);  // レコードID
      sheet.setColumnWidth(5, 250);  // リクエストID
      sheet.setColumnWidth(6, 100);  // 処理時間(秒)
      sheet.setColumnWidth(7, 180);  // モデル名
      sheet.setColumnWidth(8, 120);  // Input Tokens
      sheet.setColumnWidth(9, 120);  // Output Tokens
      sheet.setColumnWidth(10, 120); // Input料金(円)
      sheet.setColumnWidth(11, 120); // Output料金(円)
      sheet.setColumnWidth(12, 120); // 合計料金(円)

      // プロジェクト固有の列（デフォルト幅）
      for (let col = 13; col <= 31; col++) {
        sheet.setColumnWidth(col, 150);
      }

      sheet.setColumnWidth(32, 150); // 開始時刻
      sheet.setColumnWidth(33, 150); // 終了時刻
      sheet.setColumnWidth(34, 400); // ログサマリー
      sheet.setColumnWidth(35, 400); // エラー詳細
      sheet.setColumnWidth(36, 150); // 実行ユーザー
      sheet.setColumnWidth(37, 200); // 備考

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
   * 古いログを削除（保持期間を超えたログ）
   * トリガーで定期実行を推奨
   */
  static cleanupOldLogs() {
    try {
      let spreadsheet;

      try {
        // 固定のスプレッドシートIDを使用
        spreadsheet = SpreadsheetApp.openById(LOGGER_CONFIG.logSpreadsheetId);
      } catch (e) {
        // フォールバック
        const folder = DriveApp.getFolderById(LOGGER_CONFIG.logFolderId);
        const files = folder.getFilesByName(LOGGER_CONFIG.logSpreadsheetName);

        if (!files.hasNext()) {
          console.error('ログスプレッドシートが見つかりません');
          return;
        }

        spreadsheet = SpreadsheetApp.openById(files.next().getId());
      }

      const sheet = spreadsheet.getSheetByName(LOGGER_CONFIG.logSheetName);

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
