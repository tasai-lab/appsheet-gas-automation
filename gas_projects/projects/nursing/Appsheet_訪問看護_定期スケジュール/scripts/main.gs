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
// バッチ処理（AppSheet Automation連携）
// =============================================================================

/**
 * 有効なマスターを翌月（1日〜末日）で更新（AppSheet Automation連携用）
 *
 * この関数は有効なマスターのステータスと日付範囲をAppSheet API経由で更新するのみで、
 * 実際の予定作成はAppSheetのAutomationがWebhookを呼び出して行います。
 *
 * 処理内容:
 * 1. 翌月の1日と末日を計算
 * 2. is_active = TRUE のマスターを取得
 * 3. 各マスターに対してAppSheet APIで更新:
 *    - status = '処理中'
 *    - apply_start_date = 翌月1日
 *    - apply_end_date = 翌月末日
 * 4. AppSheetのAutomationが更新を検知してWebhookを実行
 * 5. WebhookがこのスクリプトのcreateScheduleFromMaster()を呼び出し
 *
 * @returns {Object} 実行結果
 *   - totalMasters: 更新対象マスター数
 *   - updatedMasters: 更新されたマスターのIDリスト
 *   - dateRange: 適用日付範囲（翌月1日〜末日）
 *
 * @example
 * // 翌月分のスケジュール生成
 * const result = updateMastersForNextMonth();
 * console.log(`${result.totalMasters}件のマスターを更新しました`);
 */
function updateMastersForNextMonth() {
  const logger = createDebugLogger('BatchProcess.updateMastersForNextMonth');
  logger.checkpoint('バッチ処理開始');

  Logger.log('='.repeat(80));
  Logger.log('📅 翌月スケジュール生成バッチ開始');
  Logger.log('='.repeat(80));

  try {
    // 翌月の1日と末日を計算
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const startDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    const endDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);

    const startDateStr = Utilities.formatDate(startDate, TIMEZONE, 'yyyy-MM-dd');
    const endDateStr = Utilities.formatDate(endDate, TIMEZONE, 'yyyy-MM-dd');

    Logger.log(`翌月範囲: ${startDateStr} 〜 ${endDateStr}`);
    logger.checkpoint('日付計算完了');

    // 有効なマスターを取得
    const activeMasters = getActiveScheduleMasters();
    logger.checkpoint('有効マスター取得完了');

    if (activeMasters.length === 0) {
      Logger.log('⚠️ 有効なスケジュールマスターが見つかりませんでした。');
      logger.summary();
      return {
        totalMasters: 0,
        updatedMasters: [],
        dateRange: { startDateStr, endDateStr }
      };
    }

    Logger.log(`更新対象マスター数: ${activeMasters.length}件`);
    Logger.log('');

    // AppSheet APIで一括更新
    const rows = activeMasters.map(master => ({
      master_id: master.master_id,
      status: MasterStatus.PROCESSING,
      apply_start_date: startDateStr,
      apply_end_date: endDateStr
    }));

    logger.checkpoint('更新ペイロード構築完了');

    if (isDebugMode()) {
      dumpArray(rows, 'Update Rows', 3);
    }

    // AppSheet API呼び出し
    const payload = {
      Action: 'Edit',
      Properties: {
        Locale: LOCALE,
        Timezone: 'Asia/Tokyo'
      },
      Rows: rows
    };

    const apiUrl = `${APPSHEET_API_BASE_URL}/${APP_ID}/tables/${MASTER_TABLE_NAME}/Action`;

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'ApplicationAccessKey': ACCESS_KEY
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    logger.checkpoint('API呼び出し');
    Logger.log('AppSheet APIを呼び出してマスターを更新中...');

    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    logger.debug(`レスポンスコード: ${responseCode}`);

    if (responseCode >= 400) {
      logger.error(`AppSheet API エラー: ${responseText}`);
      throw new Error(`AppSheet API Error: ${responseText}`);
    }

    logger.success('マスター更新成功');
    logger.checkpoint('更新完了');

    const updatedMasterIds = activeMasters.map(m => m.master_id);

    // サマリー出力
    Logger.log('');
    Logger.log('='.repeat(80));
    Logger.log('📊 バッチ処理完了サマリー');
    Logger.log('='.repeat(80));
    Logger.log(`翌月範囲: ${startDateStr} 〜 ${endDateStr}`);
    Logger.log(`更新対象マスター数: ${activeMasters.length}件`);
    Logger.log('');
    Logger.log('更新されたマスター:');
    updatedMasterIds.slice(0, 10).forEach((id, i) => {
      Logger.log(`  ${i + 1}. ${id}`);
    });
    if (updatedMasterIds.length > 10) {
      Logger.log(`  ... 他 ${updatedMasterIds.length - 10}件`);
    }
    Logger.log('');
    Logger.log('✅ AppSheetのAutomationが起動して各マスターの予定を作成します');
    Logger.log('='.repeat(80));

    logger.summary();

    return {
      totalMasters: activeMasters.length,
      updatedMasters: updatedMasterIds,
      dateRange: { startDateStr, endDateStr }
    };

  
  // ============================================================
  // Vector DB同期（RAGシステムへのデータ蓄積）
  // ============================================================
  try {
    log('Vector DB同期開始');

    // 同期データ準備
    const syncData = {
      domain: 'nursing',
      sourceType: 'schedule',
      sourceTable: 'Visit_Schedules',
      sourceId: scheduleId,
      userId: context.staffId || 'unknown',
      title: `${context.documentType} - ${context.clientName}`,
      content: scheduleData.description,
      structuredData: {},
      metadata: {
        driveFileId: context.driveFileId || '',
        projectName: 'Appsheet_訪問看護_定期スケジュール'
      },
      tags: context.documentType,
      date: new Date().toISOString().split('T')[0]
    };

    // Vector DB同期実行
    syncToVectorDB(syncData);

    log('✅ Vector DB同期完了');

  } catch (syncError) {
    log(`⚠️  Vector DB同期エラー（処理は継続）: ${syncError.toString()}`);
    // Vector DB同期エラーはメイン処理に影響させない
  }

} catch (error) {
    logger.error('バッチ処理中に致命的エラー', error);
    Logger.log('');
    Logger.log('='.repeat(80));
    Logger.log('❌ バッチ処理失敗');
    Logger.log(`エラー: ${error.message}`);
    Logger.log('='.repeat(80));

    throw error;
  }
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
 * 有効マスター取得のテスト
 */
function testGetActiveScheduleMasters() {
  Logger.log('='.repeat(60));
  Logger.log('有効マスター取得のテスト');
  Logger.log('='.repeat(60));

  const activeMasters = getActiveScheduleMasters();

  Logger.log(`有効なマスター数: ${activeMasters.length}件`);
  Logger.log('');

  if (activeMasters.length > 0) {
    Logger.log('最初の3件:');
    activeMasters.slice(0, 3).forEach((master, index) => {
      Logger.log(`${index + 1}. ${master.master_id} - ${master.client_name_temporary || '(名称なし)'}`);
      Logger.log(`   頻度: ${master.frequency}, 曜日: ${master.day_of_week}`);
    });
  }

  Logger.log('='.repeat(60));
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
