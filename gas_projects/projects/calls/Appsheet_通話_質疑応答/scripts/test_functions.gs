/**
 * テスト関数・デバッグ関数モジュール（統合版）
 * 通話質疑応答処理のテスト + ロガーデバッグ
 * debug_logger.gsから統合
 * GASエディタから直接実行可能
 *
 * @version 2.1.0
 * @date 2025-10-22
 */

/**
 * テスト用関数: 標準モデル（Flash）
 * AppSheet API呼び出しなし、Gemini APIと実行ログのみテスト
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 処理結果
 */
function testProcessRequestFlash() {
  const logger = createLogger(CONFIG.SCRIPT_NAME);
  let recordId = null;
  let status = '成功';

  try {
    const testQueryId = 'test_query_flash_' + new Date().getTime();
    const testParams = {
      queryId: testQueryId,
      promptText: 'この通話の要点を3つ挙げてください',
      callSummary: 'テスト通話の要約です。顧客からの問い合わせに対応しました。',
      callTranscript: '顧客: こんにちは。サービスについて質問があります。\n担当者: お世話になっております。どのようなご質問でしょうか。',
      call_info: '通話時間: 5分\n顧客: テスト株式会社',
      modelKeyword: '標準'  // Flash使用
    };

    recordId = testQueryId;

    logger.info('[テスト] Gemini Flash モード');
    logger.info('パラメータ:', testParams);

    // モデル選択
    const usePro = testParams.modelKeyword === 'しっかり';
    logger.info(`使用モデル: ${usePro ? 'gemini-2.5-pro' : 'gemini-2.5-flash'}`);

    // Geminiクライアント作成
    const gemini = usePro ?
      createGeminiProClient({ temperature: 0.3, maxOutputTokens: 20000 }) :
      createGeminiFlashClient({ temperature: 0.3, maxOutputTokens: 20000 });

    // プロンプト構築
    const prompt = buildPrompt(
      testParams.promptText,
      testParams.callSummary,
      testParams.callTranscript,
      testParams.call_info
    );

    logger.info(`プロンプト構築完了（${prompt.length}文字）`);

    // Gemini API呼び出し
    const response = gemini.generateText(prompt, logger);
    const answer = response.text;

    // API使用量情報をloggerに記録
    if (response.usageMetadata) {
      logger.setUsageMetadata(response.usageMetadata);
      logger.info('API使用量情報を記録しました');
    }

    logger.success(`回答生成成功（${answer.length}文字）`);
    logger.info('生成された回答:', { answer: answer.substring(0, 200) + '...' });

    // AppSheet APIはスキップ
    logger.info('[テスト] AppSheet API更新はスキップしました');

    return {
      success: true,
      queryId: testQueryId,
      answer: answer,
      usageMetadata: response.usageMetadata
    };

  } catch (error) {
    status = 'エラー';
    logger.error(`テストエラー: ${error.toString()}`, { stack: error.stack });
    throw error;

  } finally {
    // ログをスプレッドシートに保存
    logger.saveToSpreadsheet(status, recordId);
    logger.info('実行ログをスプレッドシートに保存しました');
  }
}

/**
 * テスト用関数: Proモデル
 * AppSheet API呼び出しなし、Gemini APIと実行ログのみテスト
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 処理結果
 */
function testProcessRequestPro() {
  const logger = createLogger(CONFIG.SCRIPT_NAME);
  let recordId = null;
  let status = '成功';

  try {
    const testQueryId = 'test_query_pro_' + new Date().getTime();
    const testParams = {
      queryId: testQueryId,
      promptText: 'この通話の詳細な分析を行い、重要なポイントを全て抽出してください',
      callSummary: 'テスト通話の要約です。顧客からの複雑な問い合わせに対応しました。',
      callTranscript: '顧客: 詳細な質問があります。料金プランの比較と、導入事例について教えてください。\n担当者: かしこまりました。詳しくご説明いたします。',
      call_info: '通話時間: 10分\n顧客: エンタープライズ企業',
      modelKeyword: 'しっかり'  // Pro使用
    };

    recordId = testQueryId;

    logger.info('[テスト] Gemini Pro モード');
    logger.info('パラメータ:', testParams);

    // モデル選択
    const usePro = testParams.modelKeyword === 'しっかり';
    logger.info(`使用モデル: ${usePro ? 'gemini-2.5-pro' : 'gemini-2.5-flash'}`);

    // Geminiクライアント作成
    const gemini = usePro ?
      createGeminiProClient({ temperature: 0.3, maxOutputTokens: 20000 }) :
      createGeminiFlashClient({ temperature: 0.3, maxOutputTokens: 20000 });

    // プロンプト構築
    const prompt = buildPrompt(
      testParams.promptText,
      testParams.callSummary,
      testParams.callTranscript,
      testParams.call_info
    );

    logger.info(`プロンプト構築完了（${prompt.length}文字）`);

    // Gemini API呼び出し
    const response = gemini.generateText(prompt, logger);
    const answer = response.text;

    // API使用量情報をloggerに記録
    if (response.usageMetadata) {
      logger.setUsageMetadata(response.usageMetadata);
      logger.info('API使用量情報を記録しました');
    }

    logger.success(`回答生成成功（${answer.length}文字）`);
    logger.info('生成された回答:', { answer: answer.substring(0, 200) + '...' });

    // AppSheet APIはスキップ
    logger.info('[テスト] AppSheet API更新はスキップしました');

    return {
      success: true,
      queryId: testQueryId,
      answer: answer,
      usageMetadata: response.usageMetadata
    };

  } catch (error) {
    status = 'エラー';
    logger.error(`テストエラー: ${error.toString()}`, { stack: error.stack });
    throw error;

  } finally {
    // ログをスプレッドシートに保存
    logger.saveToSpreadsheet(status, recordId);
    logger.info('実行ログをスプレッドシートに保存しました');
  }
}

/**
 * 実行ログスプレッドシートを開く
 * テスト実行後、このを実行してログを確認
 */
function openExecutionLog() {
  const spreadsheetId = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  Logger.log('実行ログスプレッドシート:');
  Logger.log(url);
  Logger.log('');
  Logger.log('このURLをブラウザで開いて、以下を確認してください:');
  Logger.log('1. モデル列に「gemini-2.5-flash」または「gemini-2.5-pro」が記録されているか');
  Logger.log('2. Input Tokens列に数値が記録されているか');
  Logger.log('3. Output Tokens列に数値が記録されているか');
  Logger.log('4. Input料金(円)、Output料金(円)、合計料金(円)が記録されているか');

  return url;
}

/**
 * デバッグ関数: ロガー設定確認
 * debug_logger.gsから統合
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
 * デバッグ関数: ログ書き込みテスト
 * debug_logger.gsから統合
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
 * デバッグ関数: LOGGER_CONFIG確認
 * debug_logger.gsから統合
 * LOGGER_CONFIGの値を直接確認
 */
function debugLoggerConfig() {
  Logger.log('=== LOGGER_CONFIG 詳細 ===');
  Logger.log(JSON.stringify(LOGGER_CONFIG, null, 2));
}
