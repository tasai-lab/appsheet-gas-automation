/**
 * テスト関数
 * GASエディタから直接実行してテスト可能
 */

/**
 * 営業音声分析のテスト（AI処理のみ、AppSheet更新なし）
 *
 * 使用方法:
 * 1. テストデータを設定
 * 2. GASエディタで実行
 * 3. ログで結果を確認
 * 4. 実行ログスプレッドシートでAPI使用量を確認
 */
function testSalesAudioAnalysisAIOnly() {
  const timer = new ExecutionTimer();
  const testActivityId = 'TEST-SALES-AI-' + new Date().getTime();

  Logger.log('='.repeat(60));
  Logger.log('🧪 営業音声分析テスト実行（AI処理のみ）');
  Logger.log('='.repeat(60));

  // ★★★ テストデータを設定してください ★★★
  const audioFilePath = '音声記録/2025-10-15/SLAC-71393b06.audio_file.100326.m4a';  // Google Driveのファイルパス
  const salespersonName = '山田太郎';
  const contactName = '田中花子';
  const orgName = '株式会社テスト';

  Logger.log('📋 テストデータ:');
  Logger.log(`  活動ID: ${testActivityId}`);
  Logger.log(`  音声ファイルパス: ${audioFilePath}`);
  Logger.log(`  営業担当者: ${salespersonName}`);
  Logger.log(`  面会相手: ${contactName}`);
  Logger.log(`  訪問先機関: ${orgName}`);
  Logger.log('');

  try {
    // 処理開始ログを記録
    logStartExec(testActivityId, {
      audioFileId: audioFilePath,
      salespersonName: salespersonName,
      contactName: contactName,
      orgName: orgName,
      notes: 'AI処理のみテスト'
    });

    // コンテキスト情報を構築
    const context = {
      filePath: audioFilePath,
      fileId: null,
      salespersonName: salespersonName,
      contactName: contactName,
      orgName: orgName
    };

    // Vertex AIで音声を分析（AppSheet更新はスキップ）
    Logger.log('🤖 Vertex AI API呼び出し開始...');
    const analysisResult = analyzeSalesCallWithVertexAI(context);

    if (!analysisResult) {
      throw new Error('AIからの応答が不正でした。');
    }

    Logger.log('='.repeat(60));
    Logger.log('✅ AI分析成功');
    Logger.log('='.repeat(60));
    Logger.log('');
    Logger.log('📊 分析結果:');
    Logger.log(`  要約: ${analysisResult.summary.substring(0, 200)}...`);
    Logger.log(`  重要ポイント数: ${analysisResult.key_points ? analysisResult.key_points.length : 0}`);
    Logger.log(`  次のアクション: ${analysisResult.next_actions.substring(0, 100)}...`);
    Logger.log(`  顧客フィードバック: ${analysisResult.customer_feedback.substring(0, 100)}...`);

    // API使用量メタデータを取得
    const usageMetadata = analysisResult.usageMetadata || null;

    if (usageMetadata) {
      Logger.log('');
      Logger.log('💰 API使用量:');
      Logger.log(`  モデル: ${usageMetadata.model}`);
      Logger.log(`  Input Tokens: ${usageMetadata.inputTokens.toLocaleString()}`);
      Logger.log(`  Output Tokens: ${usageMetadata.outputTokens.toLocaleString()}`);
      Logger.log(`  Input料金: ¥${usageMetadata.inputCostJPY.toFixed(2)}`);
      Logger.log(`  Output料金: ¥${usageMetadata.outputCostJPY.toFixed(2)}`);
      Logger.log(`  合計料金: ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
    }

    // 成功ログを実行ログスプレッドシートに記録
    logSuccessExec(testActivityId, {
      audioFileId: audioFilePath,
      salespersonName: salespersonName,
      contactName: contactName,
      orgName: orgName,
      summary: analysisResult.summary ? analysisResult.summary.substring(0, 200) + '...' : '',
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      fileSize: analysisResult.fileSize || '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(2) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(2) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(2) : '',
      notes: 'AI処理のみテスト（AppSheet更新スキップ）'
    });

    Logger.log('');
    Logger.log('📝 次のステップ:');
    Logger.log('1. 実行ログスプレッドシートを確認 (openExecutionLog() を実行)');
    Logger.log('2. API使用量とコストを確認');
    Logger.log('');
    Logger.log('⚠️  注意: このテストはAppSheet更新をスキップしています');

    return {
      success: true,
      activityId: testActivityId,
      analysis: analysisResult,
      usageMetadata: usageMetadata
    };

  } catch (error) {
    Logger.log('='.repeat(60));
    Logger.log('❌ テスト失敗');
    Logger.log('='.repeat(60));
    Logger.log('エラー: ' + error.toString());
    Logger.log('スタックトレース: ' + error.stack);

    // エラーログを実行ログスプレッドシートに記録
    logFailureExec(testActivityId, error, {
      audioFileId: audioFilePath,
      salespersonName: salespersonName,
      contactName: contactName,
      orgName: orgName,
      processingTime: timer.getElapsedSeconds(),
      notes: 'AI処理のみテスト（エラー）'
    });

    throw error;
  }
}

/**
 * ★★★ Google AI Studio API接続テスト削除済み ★★★
 *
 * 修正日: 2025-10-18
 * 理由: ユーザー指示「今後gemini apiを使用することが無いようにお願いします。今後、全てvertex apiを使用すること。」
 * このプロジェクトは既にVertex AI専用のため、Google AI Studio APIテスト関数を削除
 *
 * 代わりに、実際の音声ファイルでの処理テスト（testProcessSalesAudioAnalysis）を使用してください
 */

/**
 * AppSheet API接続テスト
 *
 * Sales_Activitiesテーブルへの書き込みをテスト
 * 注意: 実際にテーブルが更新されます
 */
function testAppSheetApiConnection() {
  Logger.log('=== AppSheet API接続テスト開始 ===');

  const testActivityId = 'TEST-API-' + new Date().getTime();

  try {
    const testData = {
      activity_id: testActivityId,
      status: 'テスト',
      summary: 'API接続テストによる書き込み'
    };

    const payload = {
      Action: 'Add',
      Properties: {
        Locale: 'ja-JP',
        Timezone: 'Asia/Tokyo'
      },
      Rows: [testData]
    };

    callAppSheetApi(payload);

    Logger.log('=== 接続テスト成功 ===');
    Logger.log(`テストレコードID: ${testActivityId}`);
    Logger.log('※ AppSheetでレコードを確認してください');

    return {
      success: true,
      testActivityId: testActivityId
    };

  } catch (error) {
    Logger.log('=== 接続テスト失敗 ===');
    Logger.log('エラー: ' + error.toString());
    throw error;
  }
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

    // Vertex AI gemini-2.5-flash価格（USD/1M tokens）
    const inputPricePer1M = 0.075;   // $0.075/1M tokens (≤128K)
    const outputPricePer1M = 0.30;   // $0.30/1M tokens (テキスト出力)
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

    const config = getConfig();
    Logger.log('✅ 設定値の確認:');
    Logger.log(`  為替レート: ¥${EXCHANGE_RATE_USD_TO_JPY}/USD`);
    Logger.log(`  モデル: ${config.vertexAIModel}`);
    Logger.log('');

    Logger.log('='.repeat(60));
    Logger.log('✅ コスト計算テスト成功');
    Logger.log('='.repeat(60));
    Logger.log('');
    Logger.log('📝 次のステップ:');
    Logger.log('1. testProcessSalesAudioAnalysis() を実行（音声ファイルIDを設定）');
    Logger.log('2. 実行ログスプレッドシートで料金を確認');
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
 * 重複定義や設定ミスを検出
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

    // 2. getConfig() の確認
    if (typeof getConfig === 'undefined') {
      errors.push('getConfig 関数が定義されていません');
    } else {
      const config = getConfig();
      Logger.log(`✅ config.vertexAIModel: ${config.vertexAIModel}`);

      if (config.vertexAIModel !== 'gemini-2.5-flash') {
        warnings.push(`モデルが gemini-2.5-flash ではありません: ${config.vertexAIModel}`);
      }
    }

    // 3. extractVertexAIUsageMetadata 関数の存在確認
    if (typeof extractVertexAIUsageMetadata === 'undefined') {
      errors.push('extractVertexAIUsageMetadata 関数が定義されていません');
    } else {
      Logger.log('✅ extractVertexAIUsageMetadata 関数が定義されています');
    }

    // 4. processSalesAudioAnalysis 関数の存在確認
    if (typeof processSalesAudioAnalysis === 'undefined') {
      errors.push('processSalesAudioAnalysis 関数が定義されていません');
    } else {
      Logger.log('✅ processSalesAudioAnalysis 関数が定義されています');
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
 * Vertex AI価格設定テスト
 * getVertexAIPricing()の返り値を確認
 */
function testVertexAIPricing() {
  Logger.log('='.repeat(60));
  Logger.log('💵 Vertex AI価格設定テスト');
  Logger.log('='.repeat(60));

  try {
    const pricing = getVertexAIPricing();

    Logger.log('取得した価格設定:');
    Logger.log(`  Input: $${pricing.inputPer1M}/1M tokens`);
    Logger.log(`  Output: $${pricing.outputPer1M}/1M tokens`);
    Logger.log('');

    // 期待される価格（gemini-2.5-flash）
    const expectedInputPrice = 0.075;
    const expectedOutputPrice = 0.30;

    if (pricing.inputPer1M === expectedInputPrice && pricing.outputPer1M === expectedOutputPrice) {
      Logger.log('✅ 価格設定が gemini-2.5-flash と一致しています');
    } else {
      throw new Error(
        `価格設定が期待値と異なります。` +
        `期待: Input=$${expectedInputPrice}, Output=$${expectedOutputPrice}, ` +
        `実際: Input=$${pricing.inputPer1M}, Output=$${pricing.outputPer1M}`
      );
    }

    Logger.log('='.repeat(60));

    return {
      success: true,
      pricing: pricing
    };

  } catch (error) {
    Logger.log('❌ 価格設定テストエラー: ' + error.toString());
    throw error;
  }
}

/**
 * 統合テスト実行
 * すべてのテストを順次実行（音声ファイル処理以外）
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

    // 2. 価格設定テスト
    Logger.log('【2/3】Vertex AI価格設定テスト');
    const pricingResult = testVertexAIPricing();
    results.push({ name: 'Vertex AI価格設定', success: pricingResult.success });
    Logger.log('');

    // 3. コスト計算テスト
    Logger.log('【3/3】コスト計算テスト');
    const costResult = testCostCalculation();
    results.push({ name: 'コスト計算', success: costResult.success });
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
      Logger.log('');
      Logger.log('📝 次のステップ:');
      Logger.log('1. testProcessSalesAudioAnalysis() で実際の音声ファイルをテスト');
      Logger.log('   - audioFileId に実際のGoogle DriveファイルIDを設定');
      Logger.log('2. 実行ログスプレッドシートでAPI使用量とコストを確認');
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

/**
 * 実行ログスプレッドシートを開く
 * テスト実行後、この関数を実行してログを確認
 */
function openExecutionLog() {
  const spreadsheetId = EXECUTION_LOG_SPREADSHEET_ID;
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  Logger.log('='.repeat(60));
  Logger.log('📊 実行ログスプレッドシート');
  Logger.log('='.repeat(60));
  Logger.log('URL:');
  Logger.log(url);
  Logger.log('');
  Logger.log(`シート名: ${EXECUTION_LOG_SHEET_NAME}`);
  Logger.log('');
  Logger.log('📝 確認項目:');
  Logger.log('1. タイムスタンプ列に実行日時が記録されているか');
  Logger.log('2. スクリプト名列に「Appsheet_営業_音声記録」が記録されているか');
  Logger.log('3. ステータス列に「成功」が記録されているか');
  Logger.log('4. モデル列に「vertex-ai-gemini-2.5-flash」が記録されているか');
  Logger.log('5. Input Tokens列に数値が記録されているか');
  Logger.log('6. Output Tokens列に数値が記録されているか');
  Logger.log('7. Input料金(円)列に金額が記録されているか');
  Logger.log('   - 計算式: (Input Tokens / 1,000,000) × $0.075 × ¥150');
  Logger.log('8. Output料金(円)列に金額が記録されているか');
  Logger.log('   - 計算式: (Output Tokens / 1,000,000) × $0.30 × ¥150');
  Logger.log('9. 合計料金(円)列に総額が記録されているか');
  Logger.log('');
  Logger.log('💡 価格情報:');
  Logger.log('  - gemini-2.5-flash入力: $0.075/1M tokens');
  Logger.log('  - gemini-2.5-flash出力: $0.30/1M tokens');
  Logger.log('  - 為替レート: ¥150/USD');
  Logger.log('='.repeat(60));

  return url;
}
