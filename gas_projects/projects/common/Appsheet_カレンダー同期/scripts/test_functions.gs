/**
 * テスト関数 - Appsheet_カレンダー同期
 * GASエディタから直接実行してテストするための関数
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-27
 */

/**
 * スタッフマップを表示するテスト関数
 */
function testGetStaffMap() {
  console.log('=== スタッフマップ取得テスト ===');

  try {
    const staffMap = getStaffMap();

    console.log(`スタッフ数: ${staffMap.size}名`);
    console.log('\nスタッフ一覧:');

    staffMap.forEach((staffId, email) => {
      console.log(`  ${email} → ${staffId}`);
    });

    console.log('\n✅ テスト成功');

  } catch (error) {
    console.error('❌ テストエラー:', error.message);
    console.error('スタックトレース:', error.stack);
  }
}

/**
 * スプレッドシートとカラムマップを取得するテスト関数
 */
function testGetSheetsAndColumns() {
  console.log('=== スプレッドシートとカラムマップ取得テスト ===');

  try {
    const { ss, logSheet, planSheet, planColMap } = getSheetsAndColumns();

    console.log(`スプレッドシート名: ${ss.getName()}`);
    console.log(`ログシート名: ${logSheet.getName()}`);
    console.log(`プランシート名: ${planSheet.getName()}`);

    console.log('\nプランシートの列マップ:');
    planColMap.forEach((index, header) => {
      console.log(`  ${header} → 列${index + 1}`);
    });

    console.log('\n✅ テスト成功');

  } catch (error) {
    console.error('❌ テストエラー:', error.message);
    console.error('スタックトレース:', error.stack);
  }
}

/**
 * ロガーのテスト関数
 */
function testLogger() {
  console.log('=== ロガーテスト ===');

  const logger = createLogger(PROJECT_NAME);
  let status = '成功';

  try {
    logger.info('テスト開始', { testType: 'logger' });

    // 各種ログレベルのテスト
    logger.info('情報ログのテスト');
    logger.success('成功ログのテスト');
    logger.warning('警告ログのテスト');

    console.log('✅ テスト成功');

  } catch (error) {
    status = 'エラー';
    logger.error(`テストエラー: ${error.toString()}`, { stack: error.stack });
    console.error('❌ テストエラー:', error.message);

  } finally {
    // ログをスプレッドシートに保存
    logger.saveToSpreadsheet(status, 'TEST_LOGGER');
  }
}

/**
 * 現在のユーザーのカレンダートリガー状態を確認するテスト関数
 */
function testGetUserCalendarTrigger() {
  console.log('=== ユーザーカレンダートリガー確認テスト ===');

  try {
    const userEmail = Session.getActiveUser().getEmail();
    console.log(`ユーザー: ${userEmail}`);

    const trigger = getUserCalendarTrigger();

    if (trigger) {
      console.log('✅ カレンダートリガーが設定されています');
      console.log(`  トリガーID: ${trigger.getUniqueId()}`);
      console.log(`  ハンドラー関数: ${trigger.getHandlerFunction()}`);
      console.log(`  トリガーソース: ${trigger.getTriggerSource()}`);
    } else {
      console.log('ℹ️ カレンダートリガーは設定されていません');
    }

    console.log('\n✅ テスト成功');

  } catch (error) {
    console.error('❌ テストエラー:', error.message);
    console.error('スタックトレース:', error.stack);
  }
}

/**
 * カレンダーイベントの日時抽出をテストする関数
 */
function testEventDateParsing() {
  console.log('=== イベント日時抽出テスト ===');

  try {
    // テスト用のイベントデータ
    const testEvents = [
      {
        name: '通常イベント',
        event: {
          start: { dateTime: '2025-10-28T10:00:00+09:00' },
          end: { dateTime: '2025-10-28T11:00:00+09:00' }
        }
      },
      {
        name: '終日イベント（dateTimeなし）',
        event: {
          start: { date: '2025-10-28' },
          end: { date: '2025-10-29' }
        }
      }
    ];

    testEvents.forEach(test => {
      console.log(`\nテスト: ${test.name}`);
      const startDate = getEventDate(test.event.start);
      const endDate = getEventDate(test.event.end);

      if (startDate) {
        console.log(`  開始: ${startDate.toISOString()}`);
      } else {
        console.log(`  開始: null（終日イベント）`);
      }

      if (endDate) {
        console.log(`  終了: ${endDate.toISOString()}`);
      } else {
        console.log(`  終了: null（終日イベント）`);
      }
    });

    console.log('\n✅ テスト成功');

  } catch (error) {
    console.error('❌ テストエラー:', error.message);
    console.error('スタックトレース:', error.stack);
  }
}

/**
 * 全てのテストを実行する統合テスト関数
 */
function runAllTests() {
  console.log('='.repeat(60));
  console.log('全テスト実行開始');
  console.log('='.repeat(60));

  const tests = [
    { name: 'スタッフマップ取得', func: testGetStaffMap },
    { name: 'スプレッドシートとカラムマップ取得', func: testGetSheetsAndColumns },
    { name: 'ロガー', func: testLogger },
    { name: 'ユーザーカレンダートリガー確認', func: testGetUserCalendarTrigger },
    { name: 'イベント日時抽出', func: testEventDateParsing }
  ];

  let successCount = 0;
  let failureCount = 0;

  tests.forEach((test, index) => {
    console.log(`\n[${index + 1}/${tests.length}] ${test.name}`);
    console.log('-'.repeat(60));

    try {
      test.func();
      successCount++;
    } catch (error) {
      console.error(`❌ テスト失敗: ${test.name}`);
      console.error(`  エラー: ${error.message}`);
      failureCount++;
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('テスト結果サマリー');
  console.log('='.repeat(60));
  console.log(`成功: ${successCount}/${tests.length}`);
  console.log(`失敗: ${failureCount}/${tests.length}`);

  if (failureCount === 0) {
    console.log('\n✅ 全てのテストが成功しました');
  } else {
    console.log('\n⚠️ 一部のテストが失敗しました');
  }
}
