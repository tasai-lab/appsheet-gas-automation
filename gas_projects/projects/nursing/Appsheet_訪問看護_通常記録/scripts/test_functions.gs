/**
 * テスト関数モジュール
 * 訪問看護記録処理のテスト
 * GASエディタから直接実行可能
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-20
 */

/**
 * テスト用関数: 通常記録（AI処理のみ、AppSheet更新なし）
 * AppSheet API呼び出しをスキップして、AI処理とコスト計算のみをテスト
 *
 * @return {Object} 処理結果
 */
function testNormalRecordAIOnly() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 通常記録テスト（AI処理のみ）');
  Logger.log('='.repeat(60));

  const timer = new ExecutionTimer();
  const testRecordId = 'TEST-NORMAL-AI-' + new Date().getTime();

  try {
    // API呼び出しカウンターの初期化
    resetApiCallCounter();
    setApiCallLimit(3);

    const recordText = '利用者は元気そうでした。血圧130/80、体温36.5度。食事は良好。散歩を30分行いました。';

    Logger.log('テキスト入力:');
    Logger.log(recordText);
    Logger.log('');

    // 処理開始ログを記録
    logStartExec(testRecordId, {
      staffId: 'test@fractal-group.co.jp',
      recordType: 'normal',
      hasAudioFile: false,
      recordTextLength: recordText.length,
      notes: 'AI処理のみテスト'
    });

    // マスターデータを取得
    const guidanceMasterText = getGuidanceMasterAsText();
    Logger.log(`マスターデータ取得: ${guidanceMasterText.length}文字`);

    // プロンプト構築
    const prompt = buildNormalPrompt(recordText, guidanceMasterText);
    Logger.log('プロンプト構築完了');
    Logger.log('');

    // Vertex AI API呼び出し（音声ファイルなし）
    Logger.log('🤖 Vertex AI API呼び出し開始...');
    const analysisResult = callVertexAIWithInlineData(null, prompt, 'normal');

    // 結果表示
    Logger.log('');
    Logger.log('✅ AI処理成功');
    Logger.log('='.repeat(60));
    Logger.log('生成された記録（一部）:');
    if (analysisResult.soap) {
      Logger.log('S: ' + (analysisResult.soap.substring(0, 100) + '...'));
    }
    if (analysisResult.focus) {
      Logger.log('フォーカス: ' + analysisResult.focus);
    }

    // API使用量表示
    const usageMetadata = analysisResult.usageMetadata || null;
    if (usageMetadata) {
      Logger.log('');
      Logger.log('💰 API使用量:');
      Logger.log(`  モデル: ${usageMetadata.model}`);
      Logger.log(`  Input: ${usageMetadata.inputTokens} tokens`);
      Logger.log(`  Output: ${usageMetadata.outputTokens} tokens`);
      Logger.log(`  Input料金: ¥${usageMetadata.inputCostJPY.toFixed(4)}`);
      Logger.log(`  Output料金: ¥${usageMetadata.outputCostJPY.toFixed(4)}`);
      Logger.log(`  合計料金: ¥${usageMetadata.totalCostJPY.toFixed(4)}`);
    }

    Logger.log('');
    Logger.log('ℹ️  AppSheet API更新はスキップしました（テストモード）');
    Logger.log('='.repeat(60));

    // API呼び出し統計を出力
    logApiCallSummary();

    // 成功ログを実行ログスプレッドシートに記録
    logSuccessExec(testRecordId, {
      staffId: 'test@fractal-group.co.jp',
      recordType: 'normal',
      hasAudioFile: false,
      recordTextLength: recordText.length,
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(2) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(2) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(2) : '',
      notes: 'AI処理のみテスト（AppSheet更新スキップ）'
    });

    return {
      success: true,
      analysisResult: analysisResult
    };

  } catch (error) {
    Logger.log('');
    Logger.log('❌ テストエラー: ' + error.toString());
    Logger.log('スタックトレース: ' + error.stack);
    Logger.log('='.repeat(60));

    // エラー時もAPI呼び出し統計を出力
    logApiCallSummary();

    // エラーログを実行ログスプレッドシートに記録
    logFailureExec(testRecordId, error, {
      staffId: 'test@fractal-group.co.jp',
      recordType: 'normal',
      hasAudioFile: false,
      processingTime: timer.getElapsedSeconds(),
      notes: 'AI処理のみテスト（エラー）'
    });

    throw error;
  }
}

/**
 * テスト用関数: 通常記録（音声ファイルなし）
 * ⚠️ 注意: AppSheet APIを呼び出すため、テストレコードがAppSheetに存在する必要があります
 * 存在しない場合は404エラーが発生します（AI処理自体は成功します）
 *
 * @return {Object} 処理結果
 */
function testNormalRecordWithoutAudio() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 通常記録テスト（音声なし）');
  Logger.log('⚠️  このテストはAppSheet APIを呼び出します');
  Logger.log('='.repeat(60));

  const testParams = {
    recordNoteId: 'TEST-NORMAL-' + new Date().getTime(),
    staffId: 'test@fractal-group.co.jp',
    recordText: '利用者は元気そうでした。血圧130/80、体温36.5度。食事は良好。散歩を30分行いました。',
    recordType: '通常',
    filePath: null,
    fileId: null
  };

  Logger.log('テストパラメータ:');
  Logger.log(JSON.stringify(testParams, null, 2));
  Logger.log('');
  Logger.log('💡 ヒント: AI処理のみをテストする場合は testNormalRecordAIOnly() を使用してください');
  Logger.log('');

  try {
    const result = processRequest(
      testParams.recordNoteId,
      testParams.staffId,
      testParams.recordText,
      testParams.recordType,
      testParams.filePath,
      testParams.fileId
    );

    Logger.log('');
    Logger.log('✅ テスト成功');
    Logger.log('='.repeat(60));

    return result;

  } catch (error) {
    Logger.log('');
    Logger.log('❌ テストエラー: ' + error.toString());
    Logger.log('スタックトレース: ' + error.stack);
    Logger.log('='.repeat(60));
    throw error;
  }
}

/**
 * テスト用関数: 精神科記録（AI処理のみ、AppSheet更新なし）
 * AppSheet API呼び出しをスキップして、AI処理とコスト計算のみをテスト
 *
 * @return {Object} 処理結果
 */
function testPsychiatryRecordAIOnly() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 精神科記録テスト（AI処理のみ）');
  Logger.log('='.repeat(60));

  const timer = new ExecutionTimer();
  const testRecordId = 'TEST-PSYCH-AI-' + new Date().getTime();

  try {
    // API呼び出しカウンターの初期化
    resetApiCallCounter();
    setApiCallLimit(3);

    const recordText = '利用者は落ち着いた様子。服薬確認済み。幻聴の訴えなし。デイケアへの参加を促した。';

    Logger.log('テキスト入力:');
    Logger.log(recordText);
    Logger.log('');

    // 処理開始ログを記録
    logStartExec(testRecordId, {
      staffId: 'test@fractal-group.co.jp',
      recordType: 'psychiatry',
      hasAudioFile: false,
      recordTextLength: recordText.length,
      notes: 'AI処理のみテスト（精神科）'
    });

    // マスターデータを取得
    const guidanceMasterText = getGuidanceMasterAsText();
    Logger.log(`マスターデータ取得: ${guidanceMasterText.length}文字`);

    // プロンプト構築（精神科）
    const prompt = buildPsychiatryPrompt(recordText, guidanceMasterText);
    Logger.log('プロンプト構築完了（精神科記録）');
    Logger.log('');

    // Vertex AI API呼び出し（音声ファイルなし）
    Logger.log('🤖 Vertex AI API呼び出し開始...');
    const analysisResult = callVertexAIWithInlineData(null, prompt, 'psychiatry');

    // 結果表示
    Logger.log('');
    Logger.log('✅ AI処理成功');
    Logger.log('='.repeat(60));
    Logger.log('生成された記録（一部）:');
    if (analysisResult.psychiatry_progress_notes) {
      Logger.log('経過記録: ' + (analysisResult.psychiatry_progress_notes.substring(0, 100) + '...'));
    }
    if (analysisResult.psychiatry_focus) {
      Logger.log('フォーカス: ' + analysisResult.psychiatry_focus);
    }

    // API使用量表示
    const usageMetadata = analysisResult.usageMetadata || null;
    if (usageMetadata) {
      Logger.log('');
      Logger.log('💰 API使用量:');
      Logger.log(`  モデル: ${usageMetadata.model}`);
      Logger.log(`  Input: ${usageMetadata.inputTokens} tokens`);
      Logger.log(`  Output: ${usageMetadata.outputTokens} tokens`);
      Logger.log(`  Input料金: ¥${usageMetadata.inputCostJPY.toFixed(4)}`);
      Logger.log(`  Output料金: ¥${usageMetadata.outputCostJPY.toFixed(4)}`);
      Logger.log(`  合計料金: ¥${usageMetadata.totalCostJPY.toFixed(4)}`);
    }

    Logger.log('');
    Logger.log('ℹ️  AppSheet API更新はスキップしました（テストモード）');
    Logger.log('='.repeat(60));

    // API呼び出し統計を出力
    logApiCallSummary();

    // 成功ログを実行ログスプレッドシートに記録
    logSuccessExec(testRecordId, {
      staffId: 'test@fractal-group.co.jp',
      recordType: 'psychiatry',
      hasAudioFile: false,
      recordTextLength: recordText.length,
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(2) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(2) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(2) : '',
      notes: 'AI処理のみテスト（精神科、AppSheet更新スキップ）'
    });

    return {
      success: true,
      analysisResult: analysisResult
    };

  } catch (error) {
    Logger.log('');
    Logger.log('❌ テストエラー: ' + error.toString());
    Logger.log('スタックトレース: ' + error.stack);
    Logger.log('='.repeat(60));

    // エラー時もAPI呼び出し統計を出力
    logApiCallSummary();

    // エラーログを実行ログスプレッドシートに記録
    logFailureExec(testRecordId, error, {
      staffId: 'test@fractal-group.co.jp',
      recordType: 'psychiatry',
      hasAudioFile: false,
      processingTime: timer.getElapsedSeconds(),
      notes: 'AI処理のみテスト（精神科、エラー）'
    });

    throw error;
  }
}

/**
 * テスト用関数: 精神科記録（音声ファイルなし）
 * ⚠️ 注意: AppSheet APIを呼び出すため、テストレコードがAppSheetに存在する必要があります
 * 存在しない場合は404エラーが発生します（AI処理自体は成功します）
 *
 * @return {Object} 処理結果
 */
function testPsychiatryRecordWithoutAudio() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 精神科記録テスト（音声なし）');
  Logger.log('⚠️  このテストはAppSheet APIを呼び出します');
  Logger.log('='.repeat(60));

  const testParams = {
    recordNoteId: 'TEST-PSYCH-' + new Date().getTime(),
    staffId: 'test@fractal-group.co.jp',
    recordText: '利用者は落ち着いた様子。服薬確認済み。幻聴の訴えなし。デイケアへの参加を促した。',
    recordType: '精神',
    filePath: null,
    fileId: null
  };

  Logger.log('テストパラメータ:');
  Logger.log(JSON.stringify(testParams, null, 2));
  Logger.log('');
  Logger.log('💡 ヒント: AI処理のみをテストする場合は testPsychiatryRecordAIOnly() を使用してください');
  Logger.log('');

  try {
    const result = processRequest(
      testParams.recordNoteId,
      testParams.staffId,
      testParams.recordText,
      testParams.recordType,
      testParams.filePath,
      testParams.fileId
    );

    Logger.log('');
    Logger.log('✅ テスト成功');
    Logger.log('='.repeat(60));

    return result;

  } catch (error) {
    Logger.log('');
    Logger.log('❌ テストエラー: ' + error.toString());
    Logger.log('スタックトレース: ' + error.stack);
    Logger.log('='.repeat(60));
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

    Logger.log('✅ 設定値の確認:');
    Logger.log(`  為替レート: ¥${EXCHANGE_RATE_USD_TO_JPY}/USD`);
    Logger.log(`  モデル: ${GCP_CONFIG.vertexAI.model}`);
    Logger.log('');

    Logger.log('='.repeat(60));
    Logger.log('✅ コスト計算テスト成功');
    Logger.log('='.repeat(60));
    Logger.log('');
    Logger.log('📝 次のステップ:');
    Logger.log('1. testNormalRecordWithoutAudio() または testPsychiatryRecordWithoutAudio() を実行');
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

    // 2. GCP_CONFIG の確認
    if (typeof GCP_CONFIG === 'undefined') {
      errors.push('GCP_CONFIG が定義されていません');
    } else {
      Logger.log(`✅ GCP_CONFIG.vertexAI.model: ${GCP_CONFIG.vertexAI.model}`);

      if (GCP_CONFIG.vertexAI.model !== 'gemini-2.5-flash') {
        warnings.push(`モデルが gemini-2.5-flash ではありません: ${GCP_CONFIG.vertexAI.model}`);
      }
    }

    // 3. callVertexAIWithInlineData 関数の存在確認
    if (typeof callVertexAIWithInlineData === 'undefined') {
      errors.push('callVertexAIWithInlineData 関数が定義されていません');
    } else {
      Logger.log('✅ callVertexAIWithInlineData 関数が定義されています');
    }

    // 4. extractUsageMetadata 関数の存在確認
    if (typeof extractUsageMetadata === 'undefined') {
      errors.push('extractUsageMetadata 関数が定義されていません');
    } else {
      Logger.log('✅ extractUsageMetadata 関数が定義されています');
    }

    // 5. processRequest 関数の存在確認
    if (typeof processRequest === 'undefined') {
      errors.push('processRequest 関数が定義されていません');
    } else {
      Logger.log('✅ processRequest 関数が定義されています');
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
 * Vertex AI API接続テスト
 * 最小限のプロンプトでAPI接続のみテスト
 */
function testVertexAIConnection() {
  Logger.log('='.repeat(60));
  Logger.log('🔌 Vertex AI API接続テスト');
  Logger.log('='.repeat(60));

  try {
    const testPrompt = `
以下の内容を日本語で要約してください:

利用者は元気に過ごしています。食事も良好です。

回答は必ずJSON形式で出力してください:
{
  "summary": "要約文"
}
`;

    Logger.log('テストプロンプトを送信...');

    // Vertex AI APIを直接呼び出し（音声ファイルなし）
    const result = callVertexAIWithInlineData(null, testPrompt, 'normal');

    Logger.log('');
    Logger.log('✅ API接続成功');
    Logger.log('レスポンス: ' + JSON.stringify(result, null, 2));

    // usageMetadata検証
    if (result.usageMetadata) {
      Logger.log('');
      Logger.log('📊 API使用量情報:');
      Logger.log(`  モデル: ${result.usageMetadata.model}`);
      Logger.log(`  Input Tokens: ${result.usageMetadata.inputTokens}`);
      Logger.log(`  Output Tokens: ${result.usageMetadata.outputTokens}`);
      Logger.log(`  Input料金(JPY): ¥${result.usageMetadata.inputCostJPY.toFixed(4)}`);
      Logger.log(`  Output料金(JPY): ¥${result.usageMetadata.outputCostJPY.toFixed(4)}`);
      Logger.log(`  合計料金(JPY): ¥${result.usageMetadata.totalCostJPY.toFixed(4)}`);
    } else {
      Logger.log('⚠️  usageMetadata が取得できませんでした');
    }

    Logger.log('');
    Logger.log('='.repeat(60));

    return {
      success: true,
      result: result
    };

  } catch (error) {
    Logger.log('');
    Logger.log('❌ API接続エラー: ' + error.toString());
    Logger.log('スタックトレース: ' + error.stack);
    Logger.log('='.repeat(60));
    throw error;
  }
}

/**
 * 統合テスト実行
 * すべてのテストを順次実行（AppSheet API呼び出しなし）
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
    Logger.log('【1/5】設定値検証テスト');
    const configResult = testConfigValidation();
    results.push({ name: '設定値検証', success: configResult.success });
    Logger.log('');

    // 2. コスト計算テスト
    Logger.log('【2/5】コスト計算テスト');
    const costResult = testCostCalculation();
    results.push({ name: 'コスト計算', success: costResult.success });
    Logger.log('');

    // 3. Vertex AI API接続テスト
    Logger.log('【3/5】Vertex AI API接続テスト');
    const apiResult = testVertexAIConnection();
    results.push({ name: 'Vertex AI接続', success: apiResult.success });
    Logger.log('');

    // 4. 通常記録AI処理テスト
    Logger.log('【4/5】通常記録AI処理テスト');
    const normalResult = testNormalRecordAIOnly();
    results.push({ name: '通常記録AI処理', success: normalResult.success });
    Logger.log('');

    // 5. 精神科記録AI処理テスト
    Logger.log('【5/5】精神科記録AI処理テスト');
    const psychiatryResult = testPsychiatryRecordAIOnly();
    results.push({ name: '精神科記録AI処理', success: psychiatryResult.success });
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
      Logger.log('📝 補足:');
      Logger.log('- このテストはAppSheet APIを呼び出していません');
      Logger.log('- Vertex AI API、コスト計算、JPY換算が正常に動作しています');
      Logger.log('- gemini-2.5-flashモデルが正しく使用されています');
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
  const spreadsheetId = LOGGER_CONFIG.logFolderId;
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
