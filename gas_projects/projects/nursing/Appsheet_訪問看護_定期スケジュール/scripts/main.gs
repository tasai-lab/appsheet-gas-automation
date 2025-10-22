/**
 * メインロジック - Appsheet_訪問看護_定期スケジュール
 * Schedule_MasterからSchedule_Planへの定期訪問スケジュール自動生成
 *
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-22
 *
 * @description
 * このスクリプトは以下の機能を提供します：
 * - マスターIDから定期スケジュールを生成
 * - 既存予定との重複チェック
 * - AppSheet APIによる予定作成
 * - ステータス管理
 *
 * @dependencies
 * - config.gs: 設定定数
 * - debug_utils.gs: デバッグ・ログ機能
 * - schedule_calculator.gs: 日付計算ロジック
 * - data_access.gs: データアクセス層
 * - logger.gs: 実行ログ記録（共通モジュール）
 * - duplication_prevention.gs: 重複防止（共通モジュール）
 */

// =============================================================================
// エントリーポイント
// =============================================================================

/**
 * AppSheet Webhook エントリーポイント
 *
 * @param {GoogleAppsScript.Events.DoPost} e - POSTリクエストイベント
 * @returns {GoogleAppsScript.Content.TextOutput} レスポンス
 *
 * @example
 * // AppSheetから以下のJSONでPOSTされる想定:
 * {
 *   "master_id": "MASTER_001",
 *   "creator_id": "user@example.com"
 * }
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = PROJECT_NAME;

    const masterId = params.master_id || params.data?.master_id;
    const creatorId = params.creator_id || params.data?.creator_id || DEFAULT_CREATOR_ID;

    return processRequestByMasterId(masterId, creatorId);
  });
}

/**
 * マスターIDから定期スケジュールを生成（直接実行用）
 *
 * @param {string} masterId - Schedule_MasterシートのマスターID
 * @param {string} [creatorId='system'] - 作成者ID
 * @returns {Object} 処理結果
 *   - status: 'success' | 'error'
 *   - message: 結果メッセージ
 *   - createdCount: 作成された予定数
 *
 * @example
 * // GASエディタから直接実行
 * const result = createScheduleFromMaster('MASTER_001', 'admin@example.com');
 * console.log(result.message); // "5件の予定を作成しました。"
 */
function createScheduleFromMaster(masterId, creatorId = DEFAULT_CREATOR_ID) {
  const logger = createDebugLogger('createScheduleFromMaster');
  logger.info(`開始: masterId=${masterId}, creatorId=${creatorId}`);

  const result = processRequestByMasterId(masterId, creatorId);

  logger.info(`完了: ${result.message}`);
  return result;
}

// =============================================================================
// コア処理
// =============================================================================

/**
 * メイン処理関数（マスターIDベース）
 *
 * 処理フロー:
 * 1. パラメータ検証
 * 2. マスターデータ取得（スプレッドシート）
 * 3. ステータス更新（処理中）
 * 4. 既存予定取得（重複チェック用）
 * 5. 候補日付計算
 * 6. 重複フィルタリング
 * 7. AppSheetに予定作成
 * 8. ステータス更新（完了/エラー）
 *
 * @param {string} masterId - マスターID
 * @param {string} creatorId - 作成者ID
 * @returns {Object} 処理結果
 */
function processRequestByMasterId(masterId, creatorId) {
  const logger = createDebugLogger('processRequestByMasterId');
  logger.checkpoint('処理開始');

  try {
    // ========================================
    // 1. パラメータ検証
    // ========================================
    if (!masterId) {
      throw new Error('master_id が指定されていません。');
    }

    logger.info(`マスターID: ${masterId}`);

    // ========================================
    // 2. マスターデータ取得
    // ========================================
    logger.checkpoint('マスターデータ取得');
    const masterData = getMasterDataById(masterId);

    if (!masterData) {
      throw new Error(`master_id: ${masterId} のマスターデータが見つかりません。`);
    }

    logger.debug('マスターデータ取得成功', {
      client_id: masterData.client_id,
      frequency: masterData.frequency,
      day_of_week: masterData.day_of_week,
      apply_start_date: masterData.apply_start_date,
      apply_end_date: masterData.apply_end_date
    });

    // データ検証（デバッグモードのみ）
    if (isDebugMode()) {
      const validation = validateMasterData(masterData);
      if (!validation.valid) {
        logger.warn('マスターデータに問題があります', validation.errors);
      }
    }

    // ========================================
    // 3. ステータス更新（処理中）
    // ========================================
    logger.checkpoint('ステータス更新: 処理中');
    updateMasterStatus(masterId, MasterStatus.PROCESSING, null);

    // ========================================
    // 4. 既存予定取得
    // ========================================
    logger.checkpoint('既存予定取得');
    const existingSchedules = getExistingScheduleData();
    logger.info(`既存予定数: ${existingSchedules.masterKeys.size}件`);

    // ========================================
    // 5. 候補日付計算
    // ========================================
    logger.checkpoint('候補日付計算');
    const potentialDates = calculatePotentialDates(masterData);
    logger.info(`候補日付数: ${potentialDates.length}件`);

    if (isDebugMode() && potentialDates.length > 0) {
      const sampleDates = formatDates(potentialDates.slice(0, 5));
      logger.debug('候補日付（最初の5件）', sampleDates);
    }

    // ========================================
    // 6. 重複フィルタリング
    // ========================================
    logger.checkpoint('重複フィルタリング');
    const schedulesToCreate = filterDuplicateDates(
      potentialDates,
      masterData,
      masterId,
      existingSchedules.masterKeys,
      logger
    );

    logger.info(`作成対象: ${schedulesToCreate.length}件`);

    // 作成対象が0件の場合
    if (schedulesToCreate.length === 0) {
      logger.info('作成すべき新しい予定はありませんでした。');
      updateMasterStatus(masterId, MasterStatus.COMPLETED, null);

      return {
        status: 'success',
        message: '作成すべき新しい予定はありませんでした。',
        createdCount: 0
      };
    }

    // ========================================
    // 7. AppSheetに予定作成
    // ========================================
    logger.checkpoint('AppSheet予定作成');
    createSchedulesInAppSheet(
      masterData,
      schedulesToCreate,
      creatorId,
      existingSchedules.visitorMap
    );

    // ========================================
    // 8. ステータス更新（完了）
    // ========================================
    logger.checkpoint('ステータス更新: 完了');
    updateMasterStatus(masterId, MasterStatus.COMPLETED, null);

    logger.success(`${schedulesToCreate.length}件の新しい予定を作成しました。`);
    logger.summary();

    return {
      status: 'success',
      message: `${schedulesToCreate.length}件の予定を作成しました。`,
      createdCount: schedulesToCreate.length
    };

  } catch (error) {
    logger.error('処理中にエラーが発生', error);

    // ステータス更新（エラー）
    if (masterId) {
      updateMasterStatus(masterId, MasterStatus.ERROR, error.message);
    }

    logger.summary();

    return {
      status: 'error',
      message: error.message,
      createdCount: 0
    };
  }
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * 重複していない日付をフィルタリング
 *
 * @param {Date[]} potentialDates - 候補日付配列
 * @param {Object} masterData - マスターデータ
 * @param {string} masterId - マスターID
 * @param {Set<string>} existingKeys - 既存の重複判定キーのSet
 * @param {DebugLogger} logger - ロガーインスタンス
 * @returns {Date[]} 重複していない日付配列
 */
function filterDuplicateDates(potentialDates, masterData, masterId, existingKeys, logger) {
  const schedulesToCreate = [];
  let duplicateCount = 0;

  for (const date of potentialDates) {
    const visitDateStr = Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd');
    const startTimeStr = formatTimeValue(masterData.start_time);
    const endTimeStr = formatTimeValue(masterData.end_time);

    // 重複判定キー: masterId|visitDate|startTime|endTime
    const masterKey = [masterId, visitDateStr, startTimeStr, endTimeStr].join('|');

    if (existingKeys.has(masterKey)) {
      duplicateCount++;
      if (isDebugMode()) {
        logger.debug(`重複スキップ: ${masterKey}`);
      }
    } else {
      schedulesToCreate.push(date);
    }
  }

  if (duplicateCount > 0) {
    logger.info(`重複スキップ: ${duplicateCount}件`);
  }

  return schedulesToCreate;
}

// =============================================================================
// テスト関数
// =============================================================================

/**
 * テスト用関数 - GASエディタから直接実行してテスト
 *
 * ⚠️ 以下の masterId を実際の環境に合わせて変更してください
 */
function testCreateSchedule() {
  // ⚠️ 実際のマスターIDに変更してください
  const testMasterId = 'MASTER_001'; // ← Schedule_Master シートに存在するmaster_idを指定
  const testCreatorId = 'test_user@example.com';

  Logger.log('='.repeat(60));
  Logger.log('テスト開始: testCreateSchedule');
  Logger.log('='.repeat(60));
  Logger.log(`masterId: ${testMasterId}`);
  Logger.log(`creatorId: ${testCreatorId}`);
  Logger.log('');

  const result = createScheduleFromMaster(testMasterId, testCreatorId);

  Logger.log('');
  Logger.log('='.repeat(60));
  Logger.log('テスト結果:');
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log('='.repeat(60));

  return result;
}

/**
 * Schedule_Masterシートから全マスターIDを一覧表示するテスト関数
 */
function listAllMasterIds() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const masterIdIndex = headers.indexOf('master_id');
  const statusIndex = headers.indexOf('status');
  const clientNameIndex = headers.indexOf('client_name_temporary');

  Logger.log('='.repeat(60));
  Logger.log('📋 Schedule_Master 一覧');
  Logger.log('='.repeat(60));

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row[masterIdIndex]) {
      Logger.log(`${i + 1}. master_id: ${row[masterIdIndex]} | status: ${row[statusIndex] || '未設定'} | client: ${row[clientNameIndex] || '未設定'}`);
    }
  }

  Logger.log('='.repeat(60));
  Logger.log(`合計: ${data.filter(r => r[masterIdIndex]).length}件`);
}

/**
 * 全モジュールの統合テスト
 */
function testAllModules() {
  Logger.log('='.repeat(80));
  Logger.log('📋 全モジュール統合テスト開始');
  Logger.log('='.repeat(80));

  // 1. デバッグユーティリティのテスト
  Logger.log('\n1️⃣ デバッグユーティリティのテスト');
  Logger.log('-'.repeat(80));
  testDebugUtils();

  // 2. スケジュール計算のテスト
  Logger.log('\n2️⃣ スケジュール計算のテスト');
  Logger.log('-'.repeat(80));
  testScheduleCalculator();

  // 3. データアクセスのテスト
  Logger.log('\n3️⃣ データアクセスのテスト');
  Logger.log('-'.repeat(80));
  testDataAccess();

  Logger.log('\n' + '='.repeat(80));
  Logger.log('✅ 全モジュール統合テスト完了');
  Logger.log('='.repeat(80));
}
