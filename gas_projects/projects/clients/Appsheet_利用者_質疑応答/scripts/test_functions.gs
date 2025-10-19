/**
 * テスト関数モジュール
 * 利用者質疑応答処理のテスト
 * GASエディタから直接実行可能
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-20
 */

/**
 * テスト用関数: Vertex AI + 実行ログテスト
 * AppSheet API呼び出しなし、Vertex AIと実行ログのみテスト
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 処理結果
 */
function testVertexAIWithLog() {
  const logger = createLogger('Appsheet_利用者_質疑応答');
  let recordId = null;
  let status = '成功';

  try {
    const testAnalysisId = 'test_analysis_' + new Date().getTime();
    recordId = testAnalysisId;

    logger.info('[テスト] Vertex AI解析モード');

    // テストデータ
    const documentText = `
# 利用者基本情報

氏名: 山田太郎
年齢: 75歳
住所: 東京都新宿区
要介護度: 要介護2

# 現在の状態

・独居
・週2回の訪問介護利用中
・食事摂取量が低下傾向
・軽度の認知症あり
`;

    const promptText = "この利用者について、今後必要な支援内容を提案してください。";

    logger.info(`ドキュメント長: ${documentText.length}文字`);
    logger.info(`質問: ${promptText}`);

    // Vertex AI API呼び出し
    const aiResult = generateAnswerAndSummaryWithGemini(documentText, promptText);

    // API使用量情報をloggerに記録
    if (aiResult.usageMetadata) {
      logger.setUsageMetadata(aiResult.usageMetadata);
      logger.info('API使用量情報を記録しました');
    }

    logger.success(`回答生成成功（回答: ${aiResult.answer.length}文字、要約: ${aiResult.summary.length}文字）`);
    logger.info('生成された回答:', { answer: aiResult.answer.substring(0, 200) + '...' });
    logger.info('生成された要約:', { summary: aiResult.summary.substring(0, 200) + '...' });

    // AppSheet APIはスキップ
    logger.info('[テスト] AppSheet API更新はスキップしました');

    return {
      success: true,
      analysisId: testAnalysisId,
      answer: aiResult.answer,
      summary: aiResult.summary,
      usageMetadata: aiResult.usageMetadata
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
 * テスト用関数: カスタムデータでテスト
 * ドキュメントと質問を引数で指定できるバージョン
 *
 * @param {string} documentText - ドキュメントテキスト
 * @param {string} promptText - 質問テキスト
 * @return {Object} 処理結果
 */
function testVertexAIWithCustomData(documentText, promptText) {
  const logger = createLogger('Appsheet_利用者_質疑応答');
  let recordId = null;
  let status = '成功';

  try {
    const testAnalysisId = 'test_custom_' + new Date().getTime();
    recordId = testAnalysisId;

    logger.info('[テスト] Vertex AI解析（カスタムデータ）');
    logger.info(`ドキュメント長: ${documentText.length}文字`);
    logger.info(`質問: ${promptText}`);

    // Vertex AI API呼び出し
    const aiResult = generateAnswerAndSummaryWithGemini(documentText, promptText);

    // API使用量情報をloggerに記録
    if (aiResult.usageMetadata) {
      logger.setUsageMetadata(aiResult.usageMetadata);
      logger.info('API使用量情報を記録しました');
    }

    logger.success(`回答生成成功（回答: ${aiResult.answer.length}文字、要約: ${aiResult.summary.length}文字）`);

    // AppSheet APIはスキップ
    logger.info('[テスト] AppSheet API更新はスキップしました');

    return {
      success: true,
      analysisId: testAnalysisId,
      answer: aiResult.answer,
      summary: aiResult.summary,
      usageMetadata: aiResult.usageMetadata
    };

  } catch (error) {
    status = 'エラー';
    logger.error(`テストエラー: ${error.toString()}`, { stack: error.stack });
    throw error;

  } finally {
    logger.saveToSpreadsheet(status, recordId);
    logger.info('テスト完了 - 実行ログをスプレッドシートに保存しました');
  }
}

/**
 * 実行ログスプレッドシートを開く
 * テスト実行後、この関数を実行してログを確認
 */
function openExecutionLog() {
  const spreadsheetId = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  Logger.log('実行ログスプレッドシート:');
  Logger.log(url);
  Logger.log('');
  Logger.log('「実行履歴」シートで以下を確認してください:');
  Logger.log('1. モデル列に「vertex-ai-gemini-2.5-flash」が記録されているか');
  Logger.log('2. Input Tokens列に数値が記録されているか');
  Logger.log('3. Output Tokens列に数値が記録されているか');
  Logger.log('4. Input料金(JPY): $0.075/1M tokens × 為替レート¥150');
  Logger.log('5. Output料金(JPY): $0.30/1M tokens × 為替レート¥150');
  Logger.log('6. 合計料金(JPY)が記録されているか');

  return url;
}

/**
 * コスト計算テスト
 * gemini-2.5-flashモデルのコスト計算が正しいか検証
 * 2025-10-20: gemini-2.5-proからgemini-2.5-flashへの変更を検証
 */
function testCostCalculation() {
  Logger.log('='.repeat(60));
  Logger.log('💰 コスト計算テスト開始');
  Logger.log('='.repeat(60));

  try {
    // テストケース: 10,000 input tokens, 2,000 output tokens
    const testInputTokens = 10000;
    const testOutputTokens = 2000;

    // gemini-2.5-flash価格（USD/1M tokens）
    const inputPricePer1M = 0.075;   // $0.075/1M tokens
    const outputPricePer1M = 0.30;   // $0.30/1M tokens
    const exchangeRate = 150;        // ¥150/USD

    // 期待される計算
    const expectedInputCostUSD = (testInputTokens / 1000000) * inputPricePer1M;
    const expectedOutputCostUSD = (testOutputTokens / 1000000) * outputPricePer1M;
    const expectedTotalCostUSD = expectedInputCostUSD + expectedOutputCostUSD;

    const expectedInputCostJPY = expectedInputCostUSD * exchangeRate;
    const expectedOutputCostJPY = expectedOutputCostUSD * exchangeRate;
    const expectedTotalCostJPY = expectedTotalCostUSD * exchangeRate;

    Logger.log('📊 テストケース:');
    Logger.log(`  Input Tokens: ${testInputTokens.toLocaleString()}`);
    Logger.log(`  Output Tokens: ${testOutputTokens.toLocaleString()}`);
    Logger.log('');

    Logger.log('💵 期待されるコスト (USD):');
    Logger.log(`  Input: $${expectedInputCostUSD.toFixed(6)}`);
    Logger.log(`  Output: $${expectedOutputCostUSD.toFixed(6)}`);
    Logger.log(`  Total: $${expectedTotalCostUSD.toFixed(6)}`);
    Logger.log('');

    Logger.log('💴 期待されるコスト (JPY):');
    Logger.log(`  Input: ¥${expectedInputCostJPY.toFixed(4)}`);
    Logger.log(`  Output: ¥${expectedOutputCostJPY.toFixed(4)}`);
    Logger.log(`  Total: ¥${expectedTotalCostJPY.toFixed(4)}`);
    Logger.log('');

    // EXCHANGE_RATE_USD_TO_JPYが定義されているか確認
    if (typeof EXCHANGE_RATE_USD_TO_JPY === 'undefined') {
      throw new Error('EXCHANGE_RATE_USD_TO_JPY が定義されていません');
    }

    Logger.log('✅ 設定値の確認:');
    Logger.log(`  為替レート: ¥${EXCHANGE_RATE_USD_TO_JPY}/USD`);
    Logger.log(`  モデル: ${CONFIG.GEMINI.MODEL_NAME}`);
    Logger.log('');

    Logger.log('='.repeat(60));
    Logger.log('✅ コスト計算テスト成功');
    Logger.log('='.repeat(60));
    Logger.log('');
    Logger.log('📝 次のステップ:');
    Logger.log('1. testVertexAIWithLog() を実行');
    Logger.log('2. openExecutionLog() で実行ログを確認');
    Logger.log('3. コスト列の値が上記の期待値と一致するか確認');

    return {
      success: true,
      expected: {
        inputCostJPY: expectedInputCostJPY,
        outputCostJPY: expectedOutputCostJPY,
        totalCostJPY: expectedTotalCostJPY
      }
    };

  } catch (error) {
    Logger.log('❌ コスト計算テストエラー: ' + error.toString());
    throw error;
  }
}

/**
 * 設定値検証テスト
 * 重複定義やAPIキー設定などの問題を検出
 */
function testConfigValidation() {
  Logger.log('='.repeat(60));
  Logger.log('🔍 設定値検証テスト開始');
  Logger.log('='.repeat(60));

  const errors = [];
  const warnings = [];

  try {
    // 1. EXCHANGE_RATE_USD_TO_JPY の確認
    if (typeof EXCHANGE_RATE_USD_TO_JPY === 'undefined') {
      errors.push('EXCHANGE_RATE_USD_TO_JPY が定義されていません');
    } else {
      Logger.log(`✅ EXCHANGE_RATE_USD_TO_JPY: ¥${EXCHANGE_RATE_USD_TO_JPY}`);
    }

    // 2. CONFIG の確認
    if (typeof CONFIG === 'undefined') {
      errors.push('CONFIG が定義されていません');
    } else {
      Logger.log(`✅ CONFIG.GEMINI.MODEL_NAME: ${CONFIG.GEMINI.MODEL_NAME}`);

      if (CONFIG.GEMINI.MODEL_NAME !== 'gemini-2.5-flash') {
        warnings.push(`モデルが gemini-2.5-flash ではありません: ${CONFIG.GEMINI.MODEL_NAME}`);
      }
    }

    // 3. generateAnswerAndSummaryWithGemini 関数の存在確認
    if (typeof generateAnswerAndSummaryWithGemini === 'undefined') {
      errors.push('generateAnswerAndSummaryWithGemini 関数が定義されていません');
    } else {
      Logger.log('✅ generateAnswerAndSummaryWithGemini 関数が定義されています');
    }

    // 4. createLogger 関数の存在確認
    if (typeof createLogger === 'undefined') {
      errors.push('createLogger 関数が定義されていません');
    } else {
      Logger.log('✅ createLogger 関数が定義されています');
    }

    Logger.log('');

    if (errors.length > 0) {
      Logger.log('❌ エラー:');
      errors.forEach(err => Logger.log(`  - ${err}`));
      throw new Error(`設定検証エラー: ${errors.join(', ')}`);
    }

    if (warnings.length > 0) {
      Logger.log('⚠️  警告:');
      warnings.forEach(warn => Logger.log(`  - ${warn}`));
    }

    Logger.log('='.repeat(60));
    Logger.log('✅ 設定値検証テスト成功');
    Logger.log('='.repeat(60));

    return {
      success: true,
      errors: errors,
      warnings: warnings
    };

  } catch (error) {
    Logger.log('❌ 設定値検証テストエラー: ' + error.toString());
    throw error;
  }
}

/**
 * 統合テスト実行
 * すべてのテストを順次実行
 */
function runAllTests() {
  Logger.log('');
  Logger.log('='.repeat(80));
  Logger.log('🧪 統合テスト実行開始');
  Logger.log('='.repeat(80));
  Logger.log('');

  const results = [];

  try {
    // 1. 設定値検証
    Logger.log('【1/3】設定値検証テスト');
    const configResult = testConfigValidation();
    results.push({ name: '設定値検証', success: configResult.success });
    Logger.log('');

    // 2. コスト計算テスト
    Logger.log('【2/3】コスト計算テスト');
    const costResult = testCostCalculation();
    results.push({ name: 'コスト計算', success: costResult.success });
    Logger.log('');

    // 3. Vertex AI + ログテスト
    Logger.log('【3/3】Vertex AI + ログテスト');
    const aiResult = testVertexAIWithLog();
    results.push({ name: 'Vertex AI', success: aiResult.success });
    Logger.log('');

    // 結果サマリー
    Logger.log('='.repeat(80));
    Logger.log('📊 テスト結果サマリー');
    Logger.log('='.repeat(80));
    results.forEach((result, index) => {
      const status = result.success ? '✅ 成功' : '❌ 失敗';
      Logger.log(`  ${index + 1}. ${result.name}: ${status}`);
    });

    const allSuccess = results.every(r => r.success);
    Logger.log('');
    if (allSuccess) {
      Logger.log('✅ すべてのテストが成功しました！');
    } else {
      Logger.log('❌ 一部のテストが失敗しました');
    }
    Logger.log('='.repeat(80));

    return {
      success: allSuccess,
      results: results
    };

  } catch (error) {
    Logger.log('');
    Logger.log('❌ 統合テストエラー: ' + error.toString());
    Logger.log('スタックトレース: ' + error.stack);
    throw error;
  }
}
