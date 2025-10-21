/**
 * テスト関数モジュール
 *
 * GASエディタから直接実行してテスト可能な関数群
 *
 * @version 1.0.0
 * @date 2025-10-21
 */

// ========================================
// メイン処理のテスト
// ========================================

/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 利用者反映処理テスト実行');
  Logger.log('='.repeat(60));
  Logger.log('');

  // テストデータを設定
  const testParams = {
    requestId: 'CR-TEST001',
    clientInfoTemp: '山田太郎様、昭和30年5月10日生まれ、男性、要介護3、電話: 090-1234-5678（本人）、生活保護受給中',
    requestReason: '新規利用者の登録依頼',
    documentFileId: null, // 添付資料なし
    staffId: 'STF-001',
    providerOffice: 'フラクタル訪問看護ステーション'
  };

  Logger.log('📋 テストデータ:');
  Logger.log(JSON.stringify(testParams, null, 2));
  Logger.log('');

  return CommonTest.runTest(processRequest, testParams, SCRIPT_NAME);
}

/**
 * Direct関数のテスト
 */
function testProcessRequestDirect() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 利用者反映処理テスト実行（Direct関数）');
  Logger.log('='.repeat(60));
  Logger.log('');

  return processRequestDirect(
    'CR-TEST002',
    '佐藤花子様、昭和25年3月15日生まれ、女性、要介護2、電話: 03-1234-5678（自宅）、090-9876-5432（長女）',
    '新規契約者の情報登録',
    null, // documentFileId
    'STF-002',
    'フラクタル訪問看護ステーション'
  );
}

// ========================================
// 個別機能のテスト
// ========================================

/**
 * ClientID採番のテスト
 */
function testGetNewClientId() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 ClientID採番テスト');
  Logger.log('='.repeat(60));
  Logger.log('');

  try {
    const newClientId = getNewClientId();
    Logger.log('✅ ClientID採番成功');
    Logger.log(`新しいClientID: ${newClientId}`);
    Logger.log('');

    return {
      success: true,
      clientId: newClientId
    };

  } catch (error) {
    Logger.log('❌ ClientID採番エラー: ' + error.toString());
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * AI抽出のテスト（AppSheet更新なし）
 */
function testExtractClientInfo() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 AI情報抽出テスト');
  Logger.log('='.repeat(60));
  Logger.log('');

  const testClientInfoTemp = `
鈴木一郎様
生年月日：昭和20年8月15日
性別：男性
要介護度：要介護4
電話番号：090-1111-2222（本人）、03-3333-4444（長男）
生活保護を受給しています。
ADL：車椅子使用、食事は一部介助が必要
アレルギー：卵アレルギーあり
キーパーソン：長男（鈴木二郎）
`;

  const testRequestReason = '新規利用者の情報登録をお願いします';

  try {
    Logger.log('📋 テストデータ:');
    Logger.log(testClientInfoTemp);
    Logger.log('');

    Logger.log('🤖 Vertex AI API呼び出し開始...');
    const extractedInfo = extractClientInfoWithGemini(
      testClientInfoTemp,
      testRequestReason,
      null // 添付資料なし
    );

    Logger.log('='.repeat(60));
    Logger.log('✅ AI情報抽出成功');
    Logger.log('='.repeat(60));
    Logger.log('');
    Logger.log('📊 抽出結果:');
    Logger.log(JSON.stringify(extractedInfo, null, 2));
    Logger.log('');

    return {
      success: true,
      extractedInfo: extractedInfo
    };

  } catch (error) {
    Logger.log('❌ AI情報抽出エラー: ' + error.toString());
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * 年齢計算のテスト
 */
function testCalculateAge() {
  Logger.log('='.repeat(60));
  Logger.log('🧪 年齢計算テスト');
  Logger.log('='.repeat(60));
  Logger.log('');

  const testCases = [
    { birthDate: '1950/05/10', expected: 75 }, // 概算
    { birthDate: '1990/01/01', expected: 35 }, // 概算
    { birthDate: '2000/12/31', expected: 24 }, // 概算
    { birthDate: null, expected: null },
    { birthDate: '', expected: null },
    { birthDate: 'invalid', expected: null }
  ];

  let passCount = 0;
  let failCount = 0;

  testCases.forEach((testCase, index) => {
    const age = calculateAge(testCase.birthDate);
    const passed = age === testCase.expected || (testCase.expected !== null && Math.abs(age - testCase.expected) <= 1);

    if (passed) {
      Logger.log(`✅ テスト${index + 1}: ${testCase.birthDate} → ${age}歳`);
      passCount++;
    } else {
      Logger.log(`❌ テスト${index + 1}: ${testCase.birthDate} → ${age}歳 (期待値: ${testCase.expected}歳)`);
      failCount++;
    }
  });

  Logger.log('');
  Logger.log(`成功: ${passCount}件, 失敗: ${failCount}件`);
  Logger.log('');

  return {
    success: failCount === 0,
    passCount: passCount,
    failCount: failCount
  };
}

// ========================================
// 統合テスト
// ========================================

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
    // 1. 年齢計算テスト
    Logger.log('【1/3】年齢計算テスト');
    const ageResult = testCalculateAge();
    results.push({ name: '年齢計算', success: ageResult.success });
    Logger.log('');

    // 2. ClientID採番テスト
    Logger.log('【2/3】ClientID採番テスト');
    const clientIdResult = testGetNewClientId();
    results.push({ name: 'ClientID採番', success: clientIdResult.success });
    Logger.log('');

    // 3. AI情報抽出テスト
    Logger.log('【3/3】AI情報抽出テスト');
    const extractResult = testExtractClientInfo();
    results.push({ name: 'AI情報抽出', success: extractResult.success });
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
      Logger.log('1. testProcessRequest() でエンドツーエンドテストを実行');
      Logger.log('2. AppSheetで作成された利用者データを確認');
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
