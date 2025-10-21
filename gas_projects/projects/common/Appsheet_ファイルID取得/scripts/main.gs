/**
 * =====================================================================================
 * Appsheet_ファイルID取得 - 汎用ファイルID・URL取得サービス
 *
 * ファイルパスからGoogle DriveのファイルIDとURLを取得し、AppSheetに返却します。
 * 共有ドライブ完全対応。
 *
 * 機能:
 * - ファイルパスからID・URL取得
 * - 複数ファイルの一括取得対応
 * - 共有ドライブ対応
 * - エラーハンドリング
 * - JSON形式のレスポンス
 *
 * @version 1.0.0
 * @date 2025-10-21
 * =====================================================================================
 */

// ================================================================================================
// 定数定義
// ================================================================================================

const SCRIPT_NAME = 'Appsheet_ファイルID取得';

// ================================================================================================
// メインエントリーポイント
// ================================================================================================

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e - POSTリクエストイベント
 * @return {GoogleAppsScript.Content.TextOutput} - レスポンス
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = SCRIPT_NAME;
    return processRequest(params);
  });
}

/**
 * 直接実行用関数
 *
 * @param {string} baseFolderId - 起点フォルダーID
 * @param {string|Array<string>} filePath - ファイルパス（文字列または配列）
 * @returns {Object} JSON形式の処理結果
 *
 * @example
 * // 単一ファイル
 * const result = getFileIdAndUrlDirect(
 *   "1ABC123...",
 *   "2025年/請求書/invoice.pdf"
 * );
 *
 * @example
 * // 複数ファイル
 * const result = getFileIdAndUrlDirect(
 *   "1ABC123...",
 *   ["2025年/請求書/invoice1.pdf", "2025年/領収書/receipt1.pdf"]
 * );
 */
function getFileIdAndUrlDirect(baseFolderId, filePath) {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📁 ファイルID・URL取得処理 - 直接実行');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log(`Base Folder ID: ${baseFolderId || '未指定'}`);
  Logger.log(`File Path: ${JSON.stringify(filePath) || '未指定'}`);
  Logger.log('');

  const params = {
    baseFolderId: baseFolderId,
    filePath: filePath,
    scriptName: SCRIPT_NAME
  };

  try {
    const result = processRequest(params);
    Logger.log('✅ 処理成功');
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    Logger.log('❌ 処理エラー: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

// ================================================================================================
// メイン処理
// ================================================================================================

/**
 * メイン処理関数
 * @param {Object} params - リクエストパラメータ
 * @return {Object} - 処理結果
 */
function processRequest(params) {
  const baseFolderId = params.baseFolderId;
  const filePath = params.filePath;

  try {
    // パラメータ検証
    validateRequiredParams(params, ['baseFolderId', 'filePath']);

    Logger.log(`[INFO] 処理開始: baseFolderId=${baseFolderId}`);

    // 単一ファイルか複数ファイルかを判定
    if (Array.isArray(filePath)) {
      // 複数ファイルの場合
      Logger.log(`[INFO] 複数ファイル処理: ${filePath.length}件`);

      const results = getMultipleFileIdsAndUrls(baseFolderId, filePath);

      const successCount = results.filter(r => !r.error).length;
      const errorCount = results.filter(r => r.error).length;

      Logger.log(`[SUCCESS] 複数ファイル処理完了（成功: ${successCount}件、エラー: ${errorCount}件）`);

      return {
        success: true,
        mode: 'multiple',
        totalCount: filePath.length,
        successCount: successCount,
        errorCount: errorCount,
        results: results,
        timestamp: new Date().toISOString()
      };

    } else {
      // 単一ファイルの場合
      Logger.log(`[INFO] 単一ファイル処理: ${filePath}`);

      const result = getFileIdAndUrl(baseFolderId, filePath);

      Logger.log(`[SUCCESS] ファイル発見: ID=${result.id}`);

      return {
        success: true,
        mode: 'single',
        filePath: filePath,
        fileId: result.id,
        fileUrl: result.url,
        timestamp: new Date().toISOString()
      };
    }

  } catch (error) {
    Logger.log(`[ERROR] 処理エラー: ${error.toString()}`);

    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 必須パラメータのバリデーション
 * @private
 */
function validateRequiredParams(params, requiredKeys) {
  for (const key of requiredKeys) {
    if (params[key] === undefined || params[key] === null || params[key] === '') {
      throw new Error(`必須パラメータが不足しています: ${key}`);
    }
  }
}

// ================================================================================================
// テスト関数
// ================================================================================================

/**
 * 単一ファイルのテスト実行
 *
 * GASエディタから直接実行してテストできます。
 * ⚠️ baseFolderIdとfilePathを実際の値に変更してください。
 */
function testGetSingleFile() {
  // ⚠️ 以下の値を実際の環境に合わせて変更してください
  const baseFolderId = "1ABC123...";  // 起点フォルダーID
  const filePath = "2025年/請求書/invoice.pdf";  // 相対ファイルパス

  Logger.log('[TEST] 単一ファイル取得テスト開始');
  Logger.log(`  baseFolderId: ${baseFolderId}`);
  Logger.log(`  filePath: ${filePath}`);
  Logger.log('');

  try {
    const result = getFileIdAndUrlDirect(baseFolderId, filePath);

    Logger.log('[TEST] 結果:');
    Logger.log(JSON.stringify(result, null, 2));

    if (result.success) {
      Logger.log('');
      Logger.log('✅ テスト成功');
      Logger.log(`  ファイルID: ${result.fileId}`);
      Logger.log(`  ファイルURL: ${result.fileUrl}`);
    }

    return result;
  } catch (error) {
    Logger.log('[TEST] エラー:');
    Logger.log(error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * 複数ファイルのテスト実行
 *
 * GASエディタから直接実行してテストできます。
 * ⚠️ baseFolderIdとfilePathsを実際の値に変更してください。
 */
function testGetMultipleFiles() {
  // ⚠️ 以下の値を実際の環境に合わせて変更してください
  const baseFolderId = "1ABC123...";  // 起点フォルダーID
  const filePaths = [
    "2025年/請求書/invoice1.pdf",
    "2025年/請求書/invoice2.pdf",
    "2025年/領収書/receipt1.pdf"
  ];

  Logger.log('[TEST] 複数ファイル取得テスト開始');
  Logger.log(`  baseFolderId: ${baseFolderId}`);
  Logger.log(`  filePaths: ${JSON.stringify(filePaths)}`);
  Logger.log('');

  try {
    const result = getFileIdAndUrlDirect(baseFolderId, filePaths);

    Logger.log('[TEST] 結果:');
    Logger.log(JSON.stringify(result, null, 2));

    if (result.success) {
      Logger.log('');
      Logger.log('✅ テスト成功');
      Logger.log(`  合計: ${result.totalCount}件`);
      Logger.log(`  成功: ${result.successCount}件`);
      Logger.log(`  エラー: ${result.errorCount}件`);

      // 成功したファイル一覧
      result.results.forEach((r, index) => {
        if (!r.error) {
          Logger.log(`  [${index + 1}] ${r.path}`);
          Logger.log(`      ID: ${r.id}`);
        } else {
          Logger.log(`  [${index + 1}] ❌ ${r.path}: ${r.error}`);
        }
      });
    }

    return result;
  } catch (error) {
    Logger.log('[TEST] エラー:');
    Logger.log(error.message);
    Logger.log(error.stack);
    throw error;
  }
}
