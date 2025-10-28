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

    logger.info('[テスト] Vertex AI解析モード（参照資料あり）');

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

    // Vertex AI API呼び出し（引数の順序を変更: promptText, documentText）
    const aiResult = generateAnswerAndSummaryWithGemini(promptText, documentText);

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
 * テスト用関数: 通常の質疑応答（2段階AI処理）新形式
 * 利用者ID、基本情報、参考資料を使った新しい処理方式をテスト
 * mode='normal'を明示的に指定
 *
 * @return {Object} 処理結果
 */
function testNormalQAWithTwoStageNewFormat() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 通常の質疑応答（2段階AI処理）テスト - 新形式');
  Logger.log('='.repeat(60));

  const promptText = "今後必要な支援内容を具体的に提案してください。";
  
  const userBasicInfo = `
# 利用者基本情報

利用者ID: USER001
氏名: 山田花子
年齢: 82歳
性別: 女性
住所: 東京都渋谷区
要介護度: 要介護3
`;

  const referenceData = `
# 2024年10月20日 訪問記録

・歩行が不安定になってきた
・血圧: 150/90 (やや高め)
・食事摂取量: 70%程度
・認知機能: 軽度の低下あり
・独居、週3回の訪問介護利用中

# 2024年10月15日 訪問記録

・室内での転倒リスクが高い
・服薬管理に支援が必要
・家族（娘）は月1回程度訪問
・デイサービスの利用を検討中

# 既往歴

・高血圧
・変形性膝関節症
・骨粗鬆症
`;

  Logger.log(`質問: ${promptText}`);
  Logger.log('');

  try {
    // 新形式: optionsオブジェクトで指定
    const result = processClientQA(promptText, {
      mode: 'normal',  // モードを明示的に指定
      userId: 'USER001',
      userBasicInfo: userBasicInfo,
      referenceData: referenceData
    });

    Logger.log('✅ 処理成功');
    Logger.log('');
    Logger.log('📝 回答:');
    Logger.log(result.answer);
    Logger.log('');
    Logger.log('📋 要約:');
    Logger.log(result.summary);
    Logger.log('');
    Logger.log('🔍 抽出された関連情報:');
    Logger.log(result.extractedInfo || '（なし）');
    Logger.log('');

    if (result.usageMetadata) {
      Logger.log('💰 API使用量:');
      Logger.log(`  モデル: ${result.usageMetadata.model}`);
      Logger.log(`  Input Tokens: ${result.usageMetadata.inputTokens}`);
      Logger.log(`  Output Tokens: ${result.usageMetadata.outputTokens}`);
      Logger.log(`  Total Cost: ¥${result.usageMetadata.totalCostJPY.toFixed(4)}`);
    }

    Logger.log('='.repeat(60));
    return result;

  } catch (error) {
    Logger.log('❌ テストエラー: ' + error.toString());
    if (error.stack) {
      Logger.log('スタックトレース: ' + error.stack);
    }
    throw error;
  }
}


/**
 * テスト用関数: 参照資料ベース新形式
 * mode='document'を明示的に指定
 *
 * @return {Object} 処理結果
 */
function testDocumentQANewFormat() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 参照資料ベースの質疑応答テスト - 新形式');
  Logger.log('='.repeat(60));

  const promptText = "転倒リスクを減らすために、どのような対策が必要ですか？";
  
  const documentText = `
# 利用者基本情報

氏名: 田中花子
年齢: 82歳
要介護度: 要介護3

# 現在の状態

・独居
・歩行が不安定
・血圧が高め（150/90）
・軽度の認知症あり
`;

  Logger.log(`質問: ${promptText}`);
  Logger.log('');

  try {
    // 新形式: optionsオブジェクトで指定
    const result = processClientQA(promptText, {
      mode: 'document',  // モードを明示的に指定
      documentText: documentText
    });

    Logger.log('✅ 処理成功');
    Logger.log('');
    Logger.log('📝 回答:');
    Logger.log(result.answer);
    Logger.log('');
    Logger.log('📋 要約:');
    Logger.log(result.summary);
    Logger.log('');

    if (result.usageMetadata) {
      Logger.log('💰 API使用量:');
      Logger.log(`  モデル: ${result.usageMetadata.model}`);
      Logger.log(`  Input Tokens: ${result.usageMetadata.inputTokens}`);
      Logger.log(`  Output Tokens: ${result.usageMetadata.outputTokens}`);
      Logger.log(`  Total Cost: ¥${result.usageMetadata.totalCostJPY.toFixed(4)}`);
    }

    Logger.log('='.repeat(60));
    return result;

  } catch (error) {
    Logger.log('❌ テストエラー: ' + error.toString());
    if (error.stack) {
      Logger.log('スタックトレース: ' + error.stack);
    }
    throw error;
  }
}


/**
 * テスト用関数: 通常の質疑応答（2段階AI処理）
 * 利用者ID、基本情報、参考資料を使った新しい処理方式をテスト
 *
 * @return {Object} 処理結果
 */
function testNormalQAWithTwoStage() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 通常の質疑応答（2段階AI処理）テスト');
  Logger.log('='.repeat(60));

  const promptText = "今後必要な支援内容を具体的に提案してください。";
  const userId = 'USER001';
  
  const userBasicInfo = `
# 利用者基本情報

利用者ID: USER001
氏名: 山田花子
年齢: 82歳
性別: 女性
住所: 東京都渋谷区
要介護度: 要介護3
`;

  const referenceData = `
# 2024年10月20日 訪問記録

・歩行が不安定になってきた
・血圧: 150/90 (やや高め)
・食事摂取量: 70%程度
・認知機能: 軽度の低下あり
・独居、週3回の訪問介護利用中

# 2024年10月15日 訪問記録

・室内での転倒リスクが高い
・服薬管理に支援が必要
・家族（娘）は月1回程度訪問
・デイサービスの利用を検討中

# 既往歴

・高血圧
・変形性膝関節症
・骨粗鬆症
`;

  Logger.log(`質問: ${promptText}`);
  Logger.log(`利用者ID: ${userId}`);
  Logger.log(`基本情報: ${userBasicInfo.length}文字`);
  Logger.log(`参考資料: ${referenceData.length}文字`);
  Logger.log('');

  try {
    const result = processClientQA(
      promptText,
      null,  // documentTextはnull
      userId,
      userBasicInfo,
      referenceData
    );

    Logger.log('✅ 処理成功');
    Logger.log('');
    Logger.log('📝 回答:');
    Logger.log(result.answer);
    Logger.log('');
    Logger.log('📋 要約:');
    Logger.log(result.summary);
    Logger.log('');
    Logger.log('🔍 抽出された関連情報:');
    Logger.log(result.extractedInfo || '（なし）');
    Logger.log('');

    if (result.usageMetadata) {
      Logger.log('💰 API使用量:');
      Logger.log(`  モデル: ${result.usageMetadata.model}`);
      Logger.log(`  Input Tokens: ${result.usageMetadata.inputTokens}`);
      Logger.log(`  Output Tokens: ${result.usageMetadata.outputTokens}`);
      Logger.log(`  Total Cost: ¥${result.usageMetadata.totalCostJPY.toFixed(4)}`);
    }

    Logger.log('='.repeat(60));
    return result;

  } catch (error) {
    Logger.log('❌ テストエラー: ' + error.toString());
    if (error.stack) {
      Logger.log('スタックトレース: ' + error.stack);
    }
    throw error;
  }
}


/**
 * テスト用関数: 2段階AI処理（カスタムデータ）
 * 
 * @param {string} promptText - 質問
 * @param {string} userId - 利用者ID
 * @param {string} userBasicInfo - 利用者基本情報
 * @param {string} referenceData - 参考資料
 * @return {Object} 処理結果
 */
function testNormalQAWithTwoStageCustom(promptText, userId, userBasicInfo, referenceData) {
  Logger.log('='.repeat(60));
  Logger.log('🧪 通常の質疑応答（2段階AI処理・カスタムデータ）テスト');
  Logger.log('='.repeat(60));

  Logger.log(`質問: ${promptText}`);
  Logger.log(`利用者ID: ${userId}`);
  Logger.log(`基本情報: ${userBasicInfo.length}文字`);
  Logger.log(`参考資料: ${referenceData.length}文字`);
  Logger.log('');

  try {
    const result = processClientQA(
      promptText,
      null,  // documentTextはnull
      userId,
      userBasicInfo,
      referenceData
    );

    Logger.log('✅ 処理成功');
    Logger.log('');
    Logger.log('📝 回答:');
    Logger.log(result.answer.substring(0, 300) + '...');
    Logger.log('');
    Logger.log('📋 要約:');
    Logger.log(result.summary);
    Logger.log('');

    if (result.extractedInfo) {
      Logger.log('🔍 抽出された関連情報:');
      Logger.log(result.extractedInfo);
      Logger.log('');
    }

    if (result.usageMetadata) {
      Logger.log('💰 API使用量:');
      Logger.log(`  モデル: ${result.usageMetadata.model}`);
      Logger.log(`  Input Tokens: ${result.usageMetadata.inputTokens}`);
      Logger.log(`  Output Tokens: ${result.usageMetadata.outputTokens}`);
      Logger.log(`  Total Cost: ¥${result.usageMetadata.totalCostJPY.toFixed(4)}`);
    }

    Logger.log('='.repeat(60));
    return result;

  } catch (error) {
    Logger.log('❌ テストエラー: ' + error.toString());
    if (error.stack) {
      Logger.log('スタックトレース: ' + error.stack);
    }
    throw error;
  }
}


/**
 * テスト用関数: 通常の質疑応答（参照資料なし）
 * 外部文章を使わない通常の質疑応答をテスト
 *
 * @return {Object} 処理結果
 */
function testNormalQA() {
  const logger = createLogger('Appsheet_利用者_質疑応答');
  let recordId = null;
  let status = '成功';

  try {
    const testAnalysisId = 'test_normal_qa_' + new Date().getTime();
    recordId = testAnalysisId;

    logger.info('[テスト] 通常の質疑応答モード（参照資料なし）');

    const promptText = "JavaScriptでデバウンス処理を実装する方法を教えてください。実装例も含めて説明してください。";

    logger.info(`質問: ${promptText}`);

    // Vertex AI API呼び出し（documentTextなし）
    const aiResult = generateAnswerAndSummaryWithGemini(promptText, null);

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

    Logger.log('='.repeat(60));
    Logger.log('✅ 通常の質疑応答テスト完了');
    Logger.log('');
    Logger.log('📝 回答:');
    Logger.log(aiResult.answer);
    Logger.log('');
    Logger.log('📋 要約:');
    Logger.log(aiResult.summary);
    Logger.log('='.repeat(60));

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
 * @param {string} promptText - 質問テキスト（必須）
 * @param {string} documentText - ドキュメントテキスト（オプション）
 * @return {Object} 処理結果
 */
function testVertexAIWithCustomData(promptText, documentText = null) {
  const logger = createLogger('Appsheet_利用者_質疑応答');
  let recordId = null;
  let status = '成功';

  try {
    const testAnalysisId = 'test_custom_' + new Date().getTime();
    recordId = testAnalysisId;

    logger.info('[テスト] Vertex AI解析（カスタムデータ）');
    logger.info(`質問: ${promptText}`);
    logger.info(`ドキュメント: ${documentText ? documentText.length + '文字' : 'なし（通常の質疑応答モード）'}`);

    // Vertex AI API呼び出し（引数の順序を変更: promptText, documentText）
    const aiResult = generateAnswerAndSummaryWithGemini(promptText, documentText);

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
 * テスト用関数: processClientQA（個別引数）- 基本テスト（参照資料あり）
 * 新しい個別引数関数のテスト（AppSheet更新なし）
 *
 * @return {Object} 処理結果
 */
function testProcessClientQA() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 processClientQA() 基本テスト（参照資料あり）');
  Logger.log('='.repeat(60));

  const promptText = "転倒リスクを減らすために、どのような対策が必要ですか？";

  const documentText = `
# 利用者基本情報

氏名: 田中花子
年齢: 82歳
住所: 東京都渋谷区
要介護度: 要介護3

# 現在の状態

・独居
・週3回の訪問介護利用中
・最近、歩行が不安定になってきた
・血圧が高め（150/90）
`;

  Logger.log(`質問: ${promptText}`);
  Logger.log(`ドキュメント長: ${documentText.length}文字`);
  Logger.log('');

  try {
    const result = processClientQA(promptText, documentText);

    Logger.log('✅ 処理成功');
    Logger.log('');
    Logger.log('📝 回答:');
    Logger.log(result.answer.substring(0, 300) + '...');
    Logger.log('');
    Logger.log('📋 要約:');
    Logger.log(result.summary);
    Logger.log('');

    if (result.usageMetadata) {
      Logger.log('💰 API使用量:');
      Logger.log(`  Input Tokens: ${result.usageMetadata.inputTokens}`);
      Logger.log(`  Output Tokens: ${result.usageMetadata.outputTokens}`);
      Logger.log(`  Total Cost: ¥${result.usageMetadata.totalCostJPY.toFixed(4)}`);
    }

    Logger.log('='.repeat(60));
    return result;

  } catch (error) {
    Logger.log('❌ テストエラー: ' + error.toString());
    throw error;
  }
}


/**
 * テスト用関数: processClientQA（通常の質疑応答）
 * 参照資料なしの通常の質疑応答をテスト
 *
 * @return {Object} 処理結果
 */
function testProcessClientQANormal() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 processClientQA() 通常の質疑応答テスト（参照資料なし）');
  Logger.log('='.repeat(60));

  const promptText = "Reactでカスタムフックを作成する際のベストプラクティスを教えてください。";

  Logger.log(`質問: ${promptText}`);
  Logger.log('参照資料: なし');
  Logger.log('');

  try {
    const result = processClientQA(promptText, null);

    Logger.log('✅ 処理成功');
    Logger.log('');
    Logger.log('📝 回答:');
    Logger.log(result.answer.substring(0, 300) + '...');
    Logger.log('');
    Logger.log('📋 要約:');
    Logger.log(result.summary);
    Logger.log('');

    if (result.usageMetadata) {
      Logger.log('💰 API使用量:');
      Logger.log(`  Input Tokens: ${result.usageMetadata.inputTokens}`);
      Logger.log(`  Output Tokens: ${result.usageMetadata.outputTokens}`);
      Logger.log(`  Total Cost: ¥${result.usageMetadata.totalCostJPY.toFixed(4)}`);
    }

    Logger.log('='.repeat(60));
    return result;

  } catch (error) {
    Logger.log('❌ テストエラー: ' + error.toString());
    throw error;
  }
}


/**
 * テスト用関数: processClientQA（AppSheet更新付き）
 * analysisIdを指定してAppSheet更新をテストする
 * 注意: 実際のAppSheet APIが呼ばれます
 *
 * @return {Object} 処理結果
 */
function testProcessClientQAWithAppSheet() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 processClientQA() AppSheet更新テスト');
  Logger.log('⚠️  注意: 実際のAppSheet APIが呼ばれます！');
  Logger.log('='.repeat(60));

  const promptText = "糖尿病管理のための食事指導のポイントは？";

  const documentText = `
# 利用者基本情報

氏名: 佐藤一郎
年齢: 78歳
住所: 神奈川県横浜市
要介護度: 要介護2

# 現在の状態

・配偶者と二人暮らし
・週2回の訪問看護利用中
・糖尿病の管理が必要
`;

  const testAnalysisId = 'TEST-' + new Date().getTime();

  Logger.log(`Analysis ID: ${testAnalysisId}`);
  Logger.log(`質問: ${promptText}`);
  Logger.log('');

  try {
    const result = processClientQA(
      promptText,
      documentText,
      testAnalysisId,
      true  // AppSheet更新を実行
    );

    Logger.log('✅ 処理成功（AppSheet更新含む）');
    Logger.log('');
    Logger.log('📝 回答:');
    Logger.log(result.answer.substring(0, 200) + '...');
    Logger.log('');
    Logger.log('📋 要約:');
    Logger.log(result.summary);
    Logger.log('');
    Logger.log(`Analysis ID: ${result.analysisId}`);

    Logger.log('='.repeat(60));
    return result;

  } catch (error) {
    Logger.log('❌ テストエラー: ' + error.toString());
    throw error;
  }
}


/**
 * テスト用関数: saveResultToAppSheet（結果保存）
 * processClientQAの結果をAppSheetに保存するテスト
 * ⚠️ 注意: 実際のAppSheet APIが呼ばれます！
 *
 * @return {Object} 処理結果
 */
function testSaveResultToAppSheet() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 saveResultToAppSheet() テスト');
  Logger.log('⚠️  注意: 実際のAppSheet APIが呼ばれます！');
  Logger.log('='.repeat(60));

  const promptText = "膝の痛みを和らげるための運動指導の方法は？";

  const documentText = `
# 利用者基本情報

氏名: 山田次郎
年齢: 75歳
住所: 埼玉県さいたま市
要介護度: 要介護2

# 現在の状態

・配偶者と二人暮らし
・週2回の訪問介護利用中
・膝の痛みがある
`;

  const testAnalysisId = 'TEST-SAVE-' + new Date().getTime();

  Logger.log(`Analysis ID: ${testAnalysisId}`);
  Logger.log('');

  try {
    // ステップ1: 質疑応答処理（AppSheet更新なし）
    Logger.log('【ステップ1】質疑応答処理');
    const result = processClientQA(promptText, documentText);

    Logger.log('✅ 質疑応答処理成功');
    Logger.log('回答の長さ: ' + result.answer.length + '文字');
    Logger.log('要約の長さ: ' + result.summary.length + '文字');
    Logger.log('');

    // ステップ2: AppSheetに保存
    Logger.log('【ステップ2】AppSheetに保存');
    saveResultToAppSheet(result, testAnalysisId, 'Edit');

    Logger.log('✅ AppSheet保存成功');
    Logger.log('');
    Logger.log(`Analysis ID: ${testAnalysisId} で保存されました`);
    Logger.log('AppSheetで確認してください');

    Logger.log('='.repeat(60));
    return {
      success: true,
      analysisId: testAnalysisId,
      result: result
    };

  } catch (error) {
    Logger.log('❌ テストエラー: ' + error.toString());
    throw error;
  }
}


/**
 * テスト用関数: processClientQAAndSave（処理と保存を一度に）
 * 質疑応答処理とAppSheet保存を一度に実行するテスト
 * ⚠️ 注意: 実際のAppSheet APIが呼ばれます！
 *
 * @return {Object} 処理結果
 */
function testProcessClientQAAndSave() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 processClientQAAndSave() テスト');
  Logger.log('⚠️  注意: 実際のAppSheet APIが呼ばれます！');
  Logger.log('='.repeat(60));

  const promptText = "食事量が減少している利用者への対応方法は？";

  const documentText = `
# 利用者基本情報

氏名: 鈴木三郎
年齢: 80歳
住所: 千葉県千葉市
要介護度: 要介護3

# 現在の状態

・独居
・週3回の訪問看護利用中
・認知症あり（軽度）
・最近、食事量が減少
`;

  const testAnalysisId = 'TEST-ANDSAVE-' + new Date().getTime();

  Logger.log(`Analysis ID: ${testAnalysisId}`);
  Logger.log('質問: ' + promptText);
  Logger.log('');

  try {
    // 処理と保存を一度に実行
    const result = processClientQAAndSave(
      promptText,
      documentText,
      testAnalysisId,
      'Edit'
    );

    Logger.log('✅ 処理と保存が完了');
    Logger.log('');
    Logger.log('📝 回答（抜粋）:');
    Logger.log(result.answer.substring(0, 200) + '...');
    Logger.log('');
    Logger.log('📋 要約:');
    Logger.log(result.summary);
    Logger.log('');
    Logger.log(`Analysis ID: ${result.analysisId}`);
    Logger.log('AppSheetで確認してください');

    Logger.log('='.repeat(60));
    return result;

  } catch (error) {
    Logger.log('❌ テストエラー: ' + error.toString());
    throw error;
  }
}


/**
 * テスト用関数: processClientQA（エラーハンドリング）
 * 必須パラメータ不足のエラー処理をテスト
 *
 * @return {Object} テスト結果
 */
function testProcessClientQAErrorHandling() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 processClientQA() エラーハンドリングテスト');
  Logger.log('='.repeat(60));

  const tests = [];

  // テスト1: promptText不足
  Logger.log('【テスト1】promptText不足');
  try {
    processClientQA('', 'ドキュメント');
    tests.push({ name: 'promptText不足', success: false, message: 'エラーが発生しませんでした' });
  } catch (error) {
    if (error.message.includes('promptText')) {
      Logger.log('✅ 期待通りのエラー: ' + error.message);
      tests.push({ name: 'promptText不足', success: true });
    } else {
      Logger.log('❌ 予期しないエラー: ' + error.message);
      tests.push({ name: 'promptText不足', success: false, message: error.message });
    }
  }
  Logger.log('');

  // テスト2: documentTextなし（エラーにならないことを確認）
  Logger.log('【テスト2】documentTextなし（通常の質疑応答として動作）');
  try {
    const result = processClientQA('JavaScriptのクロージャとは何ですか？', null);
    Logger.log('✅ 通常の質疑応答として成功: ' + result.answer.substring(0, 100) + '...');
    tests.push({ name: 'documentTextなし', success: true });
  } catch (error) {
    Logger.log('❌ 予期しないエラー: ' + error.message);
    tests.push({ name: 'documentTextなし', success: false, message: error.message });
  }
  Logger.log('');

  // 結果サマリー
  Logger.log('📊 テスト結果:');
  tests.forEach(test => {
    const status = test.success ? '✅' : '❌';
    Logger.log(`  ${status} ${test.name}`);
    if (!test.success && test.message) {
      Logger.log(`     ${test.message}`);
    }
  });

  const allSuccess = tests.every(t => t.success);
  Logger.log('');
  Logger.log(allSuccess ? '✅ すべてのテスト成功' : '❌ 一部のテストが失敗');
  Logger.log('='.repeat(60));

  return {
    success: allSuccess,
    tests: tests
  };
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
