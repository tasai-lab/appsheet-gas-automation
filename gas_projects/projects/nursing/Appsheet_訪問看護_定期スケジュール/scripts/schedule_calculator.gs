/**
 * スケジュール日付計算モジュール
 * マスターデータから適用期間内の訪問日を計算
 *
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-22
 */

// =============================================================================
// メイン日付計算関数
// =============================================================================

/**
 * マスターデータから生成すべき候補日付を計算
 *
 * @param {Object} masterData - Schedule_Masterのマスターデータ
 * @param {Date} masterData.apply_start_date - 適用開始日
 * @param {Date} [masterData.apply_end_date] - 適用終了日（未指定の場合は開始日+90日）
 * @param {number} masterData.day_of_week - 曜日（1-7: 月曜-日曜）
 * @param {string} masterData.frequency - 頻度（'毎週', '隔週', '毎月'）
 * @param {string} [masterData.target_week] - 対象週（'第1週'など、頻度が'毎月'の場合のみ使用）
 * @returns {Date[]} 候補日付の配列
 *
 * @example
 * const masterData = {
 *   apply_start_date: new Date('2025-10-01'),
 *   apply_end_date: new Date('2025-12-31'),
 *   day_of_week: 2,  // 月曜
 *   frequency: '毎週'
 * };
 * const dates = calculatePotentialDates(masterData);
 * // => [2025-10-06, 2025-10-13, 2025-10-20, ...]
 */
function calculatePotentialDates(masterData) {
  const logger = createDebugLogger('ScheduleCalculator');
  logger.checkpoint('計算開始');

  // 日付範囲の設定
  const startDate = new Date(masterData.apply_start_date);
  const endDate = masterData.apply_end_date
    ? new Date(masterData.apply_end_date)
    : new Date(startDate.getTime() + DEFAULT_APPLY_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  // 曜日変換（スプレッドシートの1-7 → JavaScriptの0-6）
  const targetDayOfWeek = Number(masterData.day_of_week) - 1;

  logger.debug('計算パラメータ', {
    startDate: Utilities.formatDate(startDate, TIMEZONE, 'yyyy-MM-dd'),
    endDate: Utilities.formatDate(endDate, TIMEZONE, 'yyyy-MM-dd'),
    targetDayOfWeek: targetDayOfWeek,
    frequency: masterData.frequency,
    targetWeek: masterData.target_week
  });

  const dates = [];
  let currentDate = new Date(startDate);

  // 日付をループして条件に合致する日付を収集
  while (currentDate <= endDate) {
    if (isDateMatchRule(currentDate, masterData, targetDayOfWeek)) {
      dates.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  logger.checkpoint('計算完了');
  logger.info(`候補日付数: ${dates.length}件`);

  if (isDebugMode()) {
    logger.summary();
  }

  return dates;
}

// =============================================================================
// 日付マッチング判定
// =============================================================================

/**
 * 指定日がマスタールールに合致するか判定
 *
 * @param {Date} date - 判定対象の日付
 * @param {Object} masterData - マスターデータ
 * @param {number} targetDayOfWeek - 対象曜日（0-6: 日曜-土曜）
 * @returns {boolean} ルールに合致する場合true
 */
function isDateMatchRule(date, masterData, targetDayOfWeek) {
  // 曜日チェック
  if (date.getDay() !== targetDayOfWeek) {
    return false;
  }

  const frequency = masterData.frequency;

  // 毎週の場合：曜日が一致すればOK
  if (frequency === Frequency.WEEKLY) {
    return true;
  }

  // 隔週の場合：開始日からの経過週数が偶数かチェック
  if (frequency === Frequency.BIWEEKLY) {
    return isDateMatchBiweekly(date, masterData);
  }

  // 毎月の場合：第N週の判定
  if (frequency === Frequency.MONTHLY) {
    return isDateMatchMonthly(date, masterData);
  }

  return false;
}

/**
 * 隔週ルールの判定
 *
 * @param {Date} date - 判定対象の日付
 * @param {Object} masterData - マスターデータ
 * @returns {boolean} 隔週ルールに合致する場合true
 */
function isDateMatchBiweekly(date, masterData) {
  const startDate = new Date(masterData.apply_start_date);

  // 両日付を00:00:00にリセット
  const dateNormalized = new Date(date);
  dateNormalized.setHours(0, 0, 0, 0);

  const startNormalized = new Date(startDate);
  startNormalized.setHours(0, 0, 0, 0);

  // 経過日数を計算
  const diffTime = Math.abs(dateNormalized - startNormalized);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // 経過週数を計算（週の開始から）
  const diffWeeks = Math.floor(diffDays / 7);

  // 偶数週のみ
  return diffWeeks % 2 === 0;
}

/**
 * 毎月（第N週）ルールの判定
 *
 * @param {Date} date - 判定対象の日付
 * @param {Object} masterData - マスターデータ
 * @returns {boolean} 毎月ルールに合致する場合true
 */
function isDateMatchMonthly(date, masterData) {
  // その月の第何週かを計算
  const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1;

  // 目標週を取得（例: "第2週" → 2）
  const targetWeekNum = masterData.target_week
    ? parseInt(masterData.target_week.replace(/\D/g, ''), 10)
    : 0;

  if (targetWeekNum === 0) {
    Logger.log(`[WARN] target_week が未設定または無効: ${masterData.target_week}`);
    return false;
  }

  return weekOfMonth === targetWeekNum;
}

// =============================================================================
// ユーティリティ関数
// =============================================================================

/**
 * 日付配列を文字列形式に変換（デバッグ用）
 *
 * @param {Date[]} dates - 日付配列
 * @param {string} [format='yyyy-MM-dd'] - 日付フォーマット
 * @returns {string[]} フォーマット済み日付文字列の配列
 */
function formatDates(dates, format = 'yyyy-MM-dd') {
  return dates.map(date => Utilities.formatDate(date, TIMEZONE, format));
}

/**
 * 頻度タイプの検証
 *
 * @param {string} frequency - 頻度文字列
 * @returns {boolean} 有効な頻度の場合true
 */
function isValidFrequency(frequency) {
  return [Frequency.WEEKLY, Frequency.BIWEEKLY, Frequency.MONTHLY].includes(frequency);
}

// =============================================================================
// テスト関数
// =============================================================================

/**
 * スケジュール計算のテスト
 */
function testScheduleCalculator() {
  Logger.log('='.repeat(60));
  Logger.log('スケジュール計算モジュールのテスト開始');
  Logger.log('='.repeat(60));

  // テストデータ1: 毎週
  const testMasterWeekly = {
    master_id: 'TEST_WEEKLY',
    apply_start_date: new Date('2025-10-01'),
    apply_end_date: new Date('2025-10-31'),
    day_of_week: 2, // 月曜
    frequency: '毎週'
  };

  Logger.log('\n--- テスト1: 毎週（月曜） ---');
  const datesWeekly = calculatePotentialDates(testMasterWeekly);
  Logger.log(`結果: ${datesWeekly.length}件`);
  formatDates(datesWeekly).forEach(d => Logger.log(`  - ${d}`));

  // テストデータ2: 隔週
  const testMasterBiweekly = {
    master_id: 'TEST_BIWEEKLY',
    apply_start_date: new Date('2025-10-01'),
    apply_end_date: new Date('2025-12-31'),
    day_of_week: 4, // 水曜
    frequency: '隔週'
  };

  Logger.log('\n--- テスト2: 隔週（水曜） ---');
  const datesBiweekly = calculatePotentialDates(testMasterBiweekly);
  Logger.log(`結果: ${datesBiweekly.length}件`);
  formatDates(datesBiweekly).forEach(d => Logger.log(`  - ${d}`));

  // テストデータ3: 毎月（第2週）
  const testMasterMonthly = {
    master_id: 'TEST_MONTHLY',
    apply_start_date: new Date('2025-10-01'),
    apply_end_date: new Date('2025-12-31'),
    day_of_week: 6, // 金曜
    frequency: '毎月',
    target_week: '第2週'
  };

  Logger.log('\n--- テスト3: 毎月（第2週金曜） ---');
  const datesMonthly = calculatePotentialDates(testMasterMonthly);
  Logger.log(`結果: ${datesMonthly.length}件`);
  formatDates(datesMonthly).forEach(d => Logger.log(`  - ${d}`));

  Logger.log('\n' + '='.repeat(60));
  Logger.log('スケジュール計算モジュールのテスト完了');
  Logger.log('='.repeat(60));
}
