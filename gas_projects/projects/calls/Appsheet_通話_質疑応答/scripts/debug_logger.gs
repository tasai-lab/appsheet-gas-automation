/**
 * ロガーのデバッグ用関数
 * スプレッドシート設定を確認
 */
function debugLoggerSettings() {
  Logger.log('=== ロガー設定確認 ===');

  // LOGGER_CONFIGを確認
  Logger.log('LOGGER_CONFIG.logFolderId:', LOGGER_CONFIG.logFolderId);
  Logger.log('LOGGER_CONFIG.logSpreadsheetName:', LOGGER_CONFIG.logSpreadsheetName);

  // フォルダーを確認
  try {
    const folder = DriveApp.getFolderById(LOGGER_CONFIG.logFolderId);
    Logger.log('✓ フォルダー取得成功:', folder.getName());

    // スプレッドシートを検索
    const files = folder.getFilesByName(LOGGER_CONFIG.logSpreadsheetName);
    if (files.hasNext()) {
      const file = files.next();
      Logger.log('✓ スプレッドシート発見:', file.getName());
      Logger.log('  ID:', file.getId());
      Logger.log('  URL:', file.getUrl());

      // スプレッドシートを開く
      const spreadsheet = SpreadsheetApp.openById(file.getId());
      Logger.log('✓ スプレッドシート取得成功');

      // シート一覧を表示
      const sheets = spreadsheet.getSheets();
      Logger.log('シート数:', sheets.length);
      sheets.forEach((sheet, index) => {
        Logger.log(`  ${index + 1}. ${sheet.getName()} (${sheet.getLastRow()}行)`);
      });

      // 「実行履歴」シートを確認
      const sheet = spreadsheet.getSheetByName('実行履歴');
      if (sheet) {
        Logger.log('✓ 「実行履歴」シート取得成功');
        Logger.log('  最終行:', sheet.getLastRow());
        Logger.log('  最終列:', sheet.getLastColumn());

        // ヘッダー行を確認
        if (sheet.getLastColumn() > 0) {
          const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          Logger.log('  ヘッダー:', headers);
        }
      } else {
        Logger.log('✗ 「実行履歴」シートが見つかりません');
      }

    } else {
      Logger.log('✗ スプレッドシートが見つかりません');
    }

  } catch (error) {
    Logger.log('✗ エラー:', error.toString());
    Logger.log('  スタック:', error.stack);
  }
}

/**
 * 実際にログを書き込んでテスト
 */
function debugWriteLog() {
  Logger.log('=== ログ書き込みテスト ===');

  const logger = createLogger('デバッグテスト');

  try {
    logger.info('テストログ1');
    logger.info('テストログ2');
    logger.success('テスト成功');

    // API使用量情報を設定（ダミーデータ）
    logger.setUsageMetadata({
      model: 'gemini-2.5-flash',
      inputTokens: 1000,
      outputTokens: 500,
      inputCostJPY: 0.45,
      outputCostJPY: 1.88,
      totalCostJPY: 2.33
    });

    Logger.log('ログをスプレッドシートに保存中...');
    logger.saveToSpreadsheet('成功', 'debug_test_' + new Date().getTime());

    Logger.log('✓ 保存完了');
    Logger.log('スプレッドシートを確認してください:');
    Logger.log('https://docs.google.com/spreadsheets/d/16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA');

  } catch (error) {
    Logger.log('✗ エラー:', error.toString());
    Logger.log('  スタック:', error.stack);
  }
}

/**
 * LOGGER_CONFIGの値を直接確認
 */
function debugLoggerConfig() {
  Logger.log('=== LOGGER_CONFIG 詳細 ===');
  Logger.log(JSON.stringify(LOGGER_CONFIG, null, 2));
}
