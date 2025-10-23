/**
 * テスト関数集
 * GASエディタから直接実行してテスト可能
 * 共通モジュールパターンのテストを含む
 */

/**
 * メイン処理のテスト
 * 実際のAPIを呼び出すため、慎重に実行すること
 */
function testProcessRequest() {
  // テストデータ
  const testOrgId = 'test-org-001';
  const testCommonName = 'トヨタ自動車株式会社';
  const testFullAddress = '〒471-8571 愛知県豊田市トヨタ町1番地';

  console.log('=== メイン処理テスト開始 ===');
  console.log(`org_id: ${testOrgId}`);
  console.log(`common_name: ${testCommonName}`);
  console.log(`full_address: ${testFullAddress}`);

  try {
    const result = processRequest(testOrgId, testCommonName, testFullAddress);
    console.log('テスト成功');
    console.log('結果:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('テスト失敗:', error.toString());
    console.error('スタック:', error.stack);
    throw error;
  }
}

/**
 * Places API単体テスト
 */
function testPlacesApi() {
  const testCommonName = 'トヨタ自動車株式会社';
  const testFullAddress = '〒471-8571 愛知県豊田市トヨタ町1番地';

  console.log('=== Places API テスト開始 ===');
  console.log(`common_name: ${testCommonName}`);
  console.log(`full_address: ${testFullAddress}`);

  try {
    const placeData = getPlaceDetails(testCommonName, testFullAddress);

    if (placeData.error) {
      console.error('エラー:', placeData.error);
      return placeData;
    }

    console.log('テスト成功');
    console.log('取得データ:', JSON.stringify(placeData, null, 2));
    return placeData;
  } catch (error) {
    console.error('テスト失敗:', error.toString());
    console.error('スタック:', error.stack);
    throw error;
  }
}

/**
 * AppSheet API単体テスト
 */
function testAppSheetApi() {
  const testOrgId = 'test-org-001';
  const testPlaceData = {
    postal_code: '471-8571',
    address: '愛知県豊田市トヨタ町1番地',
    latlong: '35.0833,137.1556',
    main_phone: '0565-28-2121',
    website_url: 'https://www.toyota.co.jp/',
    operating_hours: '月曜日: 09時00分～18時00分\n火曜日: 09時00分～18時00分\n水曜日: 09時00分～18時00分\n木曜日: 09時00分～18時00分\n金曜日: 09時00分～18時00分\n土曜日: 定休日\n日曜日: 定休日'
  };

  console.log('=== AppSheet API テスト開始 ===');
  console.log(`org_id: ${testOrgId}`);
  console.log('テストデータ:', JSON.stringify(testPlaceData, null, 2));

  try {
    updateOrganization(testOrgId, testPlaceData);
    console.log('テスト成功');
  } catch (error) {
    console.error('テスト失敗:', error.toString());
    console.error('スタック:', error.stack);
    throw error;
  }
}

/**
 * 郵便番号抽出テスト
 */
function testPostalCodeExtraction() {
  const testCases = [
    '〒471-8571 愛知県豊田市トヨタ町1番地',
    '4718571 愛知県豊田市トヨタ町1番地',
    '471-8571 愛知県豊田市トヨタ町1番地',
    '愛知県豊田市トヨタ町1番地' // 郵便番号なし
  ];

  console.log('=== 郵便番号抽出テスト ===');

  testCases.forEach((testCase, index) => {
    console.log(`\nテストケース ${index + 1}: ${testCase}`);

    const postalCodeMatch = testCase.match(/〒?(\d{3})-?(\d{4})/);
    if (postalCodeMatch) {
      const postalCode = `${postalCodeMatch[1]}-${postalCodeMatch[2]}`;
      const cleanAddress = testCase.replace(/〒?\d{3}-?\d{4}\s*/, '').trim();
      console.log(`  郵便番号: ${postalCode}`);
      console.log(`  住所: ${cleanAddress}`);
    } else {
      console.log('  郵便番号なし');
      console.log(`  住所: ${testCase}`);
    }
  });
}

/**
 * 営業時間整形テスト
 */
function testOpeningHoursFormatting() {
  const testData = {
    periods: [
      {
        open: { day: 1, hour: 9, minute: 0 },
        close: { day: 1, hour: 18, minute: 0 }
      },
      {
        open: { day: 2, hour: 9, minute: 0 },
        close: { day: 2, hour: 18, minute: 0 }
      },
      {
        open: { day: 3, hour: 9, minute: 0 },
        close: { day: 3, hour: 18, minute: 0 }
      },
      {
        open: { day: 4, hour: 9, minute: 0 },
        close: { day: 4, hour: 18, minute: 0 }
      },
      {
        open: { day: 5, hour: 9, minute: 0 },
        close: { day: 5, hour: 18, minute: 0 }
      }
    ]
  };

  console.log('=== 営業時間整形テスト ===');
  const formatted = formatOpeningHours(testData);
  console.log(formatted);
}

/**
 * ロガーテスト
 */
function testLogger() {
  console.log('=== ロガーテスト開始 ===');

  const logger = createLogger(SCRIPT_NAME);

  logger.info('情報ログのテスト', { test: 'info' });
  logger.success('成功ログのテスト', { test: 'success' });
  logger.warning('警告ログのテスト', { test: 'warning' });
  logger.error('エラーログのテスト', { test: 'error' });

  logger.saveToSpreadsheet('成功', 'test-record-001');

  console.log('ロガーテスト完了');
}

/**
 * 重複防止テスト
 */
function testDuplicationPrevention() {
  console.log('=== 重複防止テスト開始 ===');

  const dupPrevention = createDuplicationPrevention(SCRIPT_NAME);
  const testRecordId = 'test-dup-001';

  // 1回目の実行
  console.log('\n1回目の実行:');
  const result1 = dupPrevention.executeWithRetry(testRecordId, (id) => {
    console.log(`処理実行: ${id}`);
    return { success: true, data: 'test' };
  });
  console.log('結果:', JSON.stringify(result1, null, 2));

  // 2回目の実行（重複として検出されるべき）
  console.log('\n2回目の実行（重複）:');
  const result2 = dupPrevention.executeWithRetry(testRecordId, (id) => {
    console.log(`処理実行: ${id}`);
    return { success: true, data: 'test' };
  });
  console.log('結果:', JSON.stringify(result2, null, 2));

  // 状態をリセット
  console.log('\n状態をリセット:');
  dupPrevention.resetProcessingState(testRecordId);

  // 3回目の実行（リセット後なので実行されるべき）
  console.log('\n3回目の実行（リセット後）:');
  const result3 = dupPrevention.executeWithRetry(testRecordId, (id) => {
    console.log(`処理実行: ${id}`);
    return { success: true, data: 'test' };
  });
  console.log('結果:', JSON.stringify(result3, null, 2));

  console.log('\n重複防止テスト完了');
}

/**
 * ExecutionTimerのテスト（共通モジュールパターン）
 */
function testExecutionTimer() {
  console.log('=== ExecutionTimer テスト開始 ===\n');

  const timer = new ExecutionTimer();
  console.log('タイマー開始');

  // 1秒待機
  Utilities.sleep(1000);
  console.log(`経過時間（1秒後）: ${timer.getElapsedSeconds()}秒`);
  console.log(`経過時間（整形）: ${timer.getElapsedFormatted()}`);

  // さらに2秒待機
  Utilities.sleep(2000);
  console.log(`経過時間（3秒後）: ${timer.getElapsedSeconds()}秒`);
  console.log(`経過時間（整形）: ${timer.getElapsedFormatted()}`);

  console.log('\nExecutionTimer テスト完了');
}

/**
 * コスト計算ヘルパー関数のテスト（共通モジュールパターン）
 */
function testCalculateApiCostDetails() {
  console.log('=== コスト計算ヘルパー関数 テスト開始 ===\n');

  // 1回のAPI呼び出し（キャッシュなし）
  const cost1 = calculateApiCostDetails(1, false);
  console.log('1回のAPI呼び出し（キャッシュなし）:');
  console.log(JSON.stringify(cost1, null, 2));

  // 0回のAPI呼び出し（キャッシュヒット）
  const cost0 = calculateApiCostDetails(0, true);
  console.log('\n0回のAPI呼び出し（キャッシュヒット）:');
  console.log(JSON.stringify(cost0, null, 2));

  // 10回のAPI呼び出し
  const cost10 = calculateApiCostDetails(10, false);
  console.log('\n10回のAPI呼び出し:');
  console.log(JSON.stringify(cost10, null, 2));

  console.log('\nコスト計算ヘルパー関数 テスト完了');
}

/**
 * ログヘルパー関数のテスト（共通モジュールパターン）
 * 注意: 実際にスプレッドシートに書き込まれます
 */
function testLogHelpers() {
  console.log('=== ログヘルパー関数 テスト開始 ===\n');
  console.log('警告: 実際にスプレッドシートに書き込まれます！');

  const testOrgId = `test-${new Date().getTime()}`;
  const timer = new ExecutionTimer();

  // logStartのテスト
  console.log('\n1. logStart テスト');
  logStart(testOrgId, {
    processingTime: timer.getElapsedSeconds(),
    places_api_calls: 0
  });

  // 少し待機
  Utilities.sleep(1000);

  // logSuccessのテスト
  console.log('\n2. logSuccess テスト');
  const costDetails = calculateApiCostDetails(1, false);
  logSuccess(testOrgId, {
    ...costDetails,
    processingTime: timer.getElapsedSeconds(),
    searchQuery: 'テスト施設 東京都',
    processType: 'Places API検索',
    summary: `テスト成功: ${testOrgId}`
  });

  // logSkipのテスト
  console.log('\n3. logSkip テスト');
  const testOrgId2 = `test-skip-${new Date().getTime()}`;
  logSkip(testOrgId2, '既に確認済みのためスキップ', {
    processingTime: '0.50'
  });

  // logFailureのテスト
  console.log('\n4. logFailure テスト');
  const testOrgId3 = `test-error-${new Date().getTime()}`;
  const testError = new Error('テストエラー');
  logFailure(testOrgId3, testError, {
    processingTime: timer.getElapsedSeconds(),
    places_api_calls: 1
  });

  console.log('\nログヘルパー関数 テスト完了');
  console.log(`統合コスト管理シート（${EXECUTION_LOG_SPREADSHEET_ID}）を確認してください`);
}
