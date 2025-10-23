/**
 * 実行ログ記録モジュール（統合版）
 * GAS実行ログスプレッドシートに実行履歴を記録
 * コスト情報を含む詳細なログを記録
 *
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-23
 */

/**
 * 統合実行ログスプレッドシートID
 * 全プロジェクトがこの1つのスプレッドシートにログを記録
 */
const EXECUTION_LOG_SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';

/**
 * デフォルトのシート名
 */
const EXECUTION_LOG_SHEET_NAME = 'コスト管理';

/**
 * ExecutionLoggerクラス
 * プロジェクトごとにインスタンスを作成して使用
 */
class ExecutionLogger {
  /**
   * コンストラクタ
   * @param {string} scriptName - スクリプト名（例: 'Appsheet_通話_要約生成'）
   * @param {string} sheetName - シート名（デフォルト: 'コスト管理'）
   * @param {string} spreadsheetId - スプレッドシートID（デフォルト: 統合ログシート）
   */
  constructor(scriptName, sheetName = EXECUTION_LOG_SHEET_NAME, spreadsheetId = EXECUTION_LOG_SPREADSHEET_ID) {
    this.scriptName = scriptName;
    this.sheetName = sheetName;
    this.spreadsheetId = spreadsheetId;
    this.timer = new ExecutionTimer();
  }

  /**
   * 実行ログを記録
   * @param {string} status - ステータス ('成功' | '失敗' | 'スキップ' | '処理中')
   * @param {string} recordId - レコードID（通話ID、リクエストIDなど）
   * @param {Object} details - 処理詳細
   */
  log(status, recordId, details = {}) {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.spreadsheetId);
      let sheet = spreadsheet.getSheetByName(this.sheetName);

      // シートが存在しない場合は作成
      if (!sheet) {
        sheet = spreadsheet.insertSheet(this.sheetName);
        this._initializeLogSheet(sheet);
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
        this.scriptName,                  // 2. スクリプト名
        status,                           // 3. ステータス
        recordId || '',                   // 4. レコードID
        details.requestId || '',          // 5. リクエストID
        details.processingTime || this.timer.getElapsedSeconds(), // 6. 処理時間(秒)
        details.modelName || '',          // 7. モデル名
        details.inputTokens || '',        // 8. Input Tokens
        details.outputTokens || '',       // 9. Output Tokens
        details.inputCost || '',          // 10. Input料金(円)
        details.outputCost || '',         // 11. Output料金(円)
        details.totalCost || '',          // 12. 合計料金(円)
        details.callId || recordId || '', // 13. 通話ID
        details.filePath || '',           // 14. ファイルパス
        details.fileId || '',             // 15. ファイルID
        details.fileSize || '',           // 16. ファイルサイズ
        details.summary || '',            // 17. 要約(抜粋)
        details.transcriptLength || '',   // 18. 文字起こし長
        details.actionsCount || '',       // 19. アクション数
        details.userId || '',             // 20. 利用者ID
        details.userName || '',           // 21. 利用者名
        details.requestReason || '',      // 22. 依頼理由
        details.fullAnswerId || '',       // 23. 全文回答ID
        details.noteId || '',             // 24. 記録ID
        details.staffId || '',            // 25. スタッフID
        details.recordType || '',         // 26. 記録タイプ
        details.inputTextLength || '',    // 27. 入力テキスト長
        details.documentKey || '',        // 28. ドキュメントキー
        details.processType || '',        // 29. 処理種別
        details.fileName || '',           // 30. ファイル名
        details.processResult || '',      // 31. 処理結果(ページ数)
        details.startTime || timestamp,   // 32. 開始時刻
        details.endTime || timestamp,     // 33. 終了時刻
        details.logSummary || '',         // 34. ログサマリー
        details.errorMessage || '',       // 35. エラー詳細
        userEmail,                        // 36. 実行ユーザー
        details.notes || ''               // 37. 備考
      ];

      sheet.appendRow(row);
      Logger.log(`[実行ログ] ${status}: ${recordId}`);

    } catch (e) {
      Logger.log(`[実行ログ] ⚠️ ログ記録失敗: ${e.message}`);
      // ログ記録失敗はメイン処理に影響させない
    }
  }

  /**
   * 処理開始ログを記録
   * @param {string} recordId - レコードID
   * @param {Object} details - 処理詳細
   */
  logStart(recordId, details = {}) {
    this.log('処理中', recordId, {
      ...details,
      notes: '処理開始'
    });
  }

  /**
   * 処理成功ログを記録
   * @param {string} recordId - レコードID
   * @param {Object} details - 処理詳細
   */
  logSuccess(recordId, details = {}) {
    this.log('成功', recordId, details);
  }

  /**
   * 処理失敗ログを記録
   * @param {string} recordId - レコードID
   * @param {Error} error - エラーオブジェクト
   * @param {Object} details - 処理詳細
   */
  logFailure(recordId, error, details = {}) {
    this.log('失敗', recordId, {
      ...details,
      errorMessage: error.message || String(error)
    });
  }

  /**
   * 処理スキップログを記録（重複時など）
   * @param {string} recordId - レコードID
   * @param {string} reason - スキップ理由
   * @param {Object} details - 処理詳細
   */
  logSkip(recordId, reason, details = {}) {
    this.log('スキップ', recordId, {
      ...details,
      notes: reason
    });
  }

  /**
   * コスト情報付きログを記録（Vertex AI使用時）
   * @param {string} status - ステータス
   * @param {string} recordId - レコードID
   * @param {Object} usageMetadata - Vertex AIの使用メタデータ（extractVertexAIUsageMetadataの戻り値）
   * @param {Object} additionalDetails - その他の詳細情報
   */
  logWithCost(status, recordId, usageMetadata, additionalDetails = {}) {
    const details = {
      ...additionalDetails,
      modelName: usageMetadata ? usageMetadata.model : '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(2) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(2) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(2) : ''
    };

    this.log(status, recordId, details);
  }

  /**
   * 経過時間を取得
   * @return {string} 経過時間（秒）
   */
  getElapsedSeconds() {
    return this.timer.getElapsedSeconds();
  }

  /**
   * ログシートを初期化（ヘッダー行を作成）
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @private
   */
  _initializeLogSheet(sheet) {
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

/**
 * ファクトリー関数: ExecutionLoggerインスタンスを作成
 * @param {string} scriptName - スクリプト名
 * @param {string} sheetName - シート名（オプション）
 * @param {string} spreadsheetId - スプレッドシートID（オプション）
 * @return {ExecutionLogger}
 */
function createLogger(scriptName, sheetName = EXECUTION_LOG_SHEET_NAME, spreadsheetId = EXECUTION_LOG_SPREADSHEET_ID) {
  return new ExecutionLogger(scriptName, sheetName, spreadsheetId);
}
