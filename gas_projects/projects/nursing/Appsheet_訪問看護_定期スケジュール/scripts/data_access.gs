/**
 * データアクセスモジュール
 * スプレッドシート読み取りとAppSheet API操作を提供
 *
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-22
 */

// =============================================================================
// スプレッドシート読み取り
// =============================================================================

/**
 * スプレッドシートからマスターIDに対応するマスターデータを取得
 *
 * @param {string} masterId - マスターID
 * @returns {Object|null} マスターデータオブジェクト、見つからない場合はnull
 *
 * @example
 * const masterData = getMasterDataById('MASTER_001');
 * if (masterData) {
 *   console.log(masterData.client_id);
 * }
 */
function getMasterDataById(masterId) {
  const logger = createDebugLogger('DataAccess.getMasterDataById');
  logger.checkpoint('取得開始');
  logger.debug(`マスターID: ${masterId}`);

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MASTER_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    // 列インデックスマップを作成
    const colIndex = {};
    headers.forEach((header, index) => {
      colIndex[header] = index;
    });

    logger.debug(`ヘッダー列数: ${headers.length}`);

    // master_idが一致する行を検索
    for (const row of data) {
      if (row[colIndex['master_id']] === masterId) {
        // マスターデータオブジェクトを作成
        const masterData = {};
        headers.forEach((header, index) => {
          masterData[header] = row[index];
        });

        logger.success(`マスターデータ見つかりました: client_id=${masterData.client_id}, frequency=${masterData.frequency}`);
        logger.checkpoint('取得完了');

        if (isDebugMode()) {
          dumpObject(masterData, `Master Data: ${masterId}`);
          logger.summary();
        }

        return masterData;
      }
    }

    logger.warn(`master_id: ${masterId} が見つかりませんでした`);
    return null;

  } catch (error) {
    logger.error('マスターデータ取得中にエラー', error);
    throw error;
  }
}

/**
 * スプレッドシートから既存の予定情報を読み込み
 * 重複チェック用キーと担当者割り当てマップを作成
 *
 * @returns {{masterKeys: Set<string>, visitorMap: Map<string, string>}} 既存予定データ
 *   - masterKeys: 重複判定用キーのSet（masterId|visitDate|startTime|endTime）
 *   - visitorMap: 日付×ルートカテゴリごとの担当者マップ
 *
 * @example
 * const existing = getExistingScheduleData();
 * if (existing.masterKeys.has('MASTER_001|2025-10-15|09:00|10:00')) {
 *   console.log('重複あり');
 * }
 */
function getExistingScheduleData() {
  const logger = createDebugLogger('DataAccess.getExistingScheduleData');
  logger.checkpoint('読み込み開始');

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PLAN_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    // 列インデックス取得ヘルパー
    const col = (name) => headers.indexOf(name);

    const idx = {
      visitDate: col('visit_date'),
      startTime: col('start_time'),
      endTime: col('end_time'),
      masterId: col('master_id'),
      routeCategory: col('route_category'),
      visitorName: col('visitor_name')
    };

    logger.debug(`既存予定行数: ${data.length}`);

    const masterKeys = new Set();
    const visitorMap = new Map();

    for (const row of data) {
      // 必須フィールドがない行はスキップ
      if (!row[idx.masterId] || !row[idx.visitDate] || !row[idx.startTime] || !row[idx.endTime]) {
        continue;
      }

      // 日付を正規化
      const visitDate = Utilities.formatDate(new Date(row[idx.visitDate]), TIMEZONE, 'yyyy-MM-dd');

      // 時刻を文字列として HH:MM 形式で取得
      const startTimeStr = String(row[idx.startTime]).substring(0, 5);
      const endTimeStr = String(row[idx.endTime]).substring(0, 5);

      // 重複判定キー: masterId|visitDate|startTime|endTime
      const masterKey = [row[idx.masterId], visitDate, startTimeStr, endTimeStr].join('|');
      masterKeys.add(masterKey);

      // 担当者マップ: visitDate|routeCategory → visitorName
      const visitor = row[idx.visitorName];
      const route = row[idx.routeCategory];

      if (visitor && route) {
        const visitorMapKey = `${visitDate}|${route}`;
        if (!visitorMap.has(visitorMapKey)) {
          visitorMap.set(visitorMapKey, visitor);
        }
      }
    }

    logger.checkpoint('読み込み完了');
    logger.info(`重複判定キー数: ${masterKeys.size}件`);
    logger.info(`担当者マップ数: ${visitorMap.size}件`);

    if (isDebugMode()) {
      logger.summary();
    }

    return { masterKeys, visitorMap };

  } catch (error) {
    logger.error('既存予定データ読み込み中にエラー', error);
    throw error;
  }
}

// =============================================================================
// AppSheet API操作
// =============================================================================

/**
 * AppSheetに複数の予定を一括作成
 *
 * @param {Object} masterData - マスターデータ
 * @param {Date[]} dates - 作成する日付の配列
 * @param {string} creatorId - 作成者ID
 * @param {Map<string, string>} visitorMap - 担当者割り当てマップ
 *
 * @example
 * createSchedulesInAppSheet(masterData, [new Date('2025-10-15')], 'admin@example.com', visitorMap);
 */
function createSchedulesInAppSheet(masterData, dates, creatorId, visitorMap) {
  const logger = createDebugLogger('DataAccess.createSchedulesInAppSheet');
  logger.checkpoint('作成開始');
  logger.info(`作成件数: ${dates.length}件`);

  try {
    const now = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

    // 各日付に対応する予定レコードを作成
    const rows = dates.map(date => {
      const visitDateStr = Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd');
      const visitorMapKey = `${visitDateStr}|${masterData.route_category}`;

      // 既存担当者がいればそれを使用、なければマスターの担当者を使用
      const assignedVisitor = visitorMap.get(visitorMapKey) || masterData.visitor_name || '';

      return {
        master_id: masterData.master_id,
        client_id: masterData.client_id,
        job_type: masterData.job_type,
        insurance_type: masterData.insurance_type,
        is_regular_visit: true,
        visit_date: visitDateStr,
        start_time: masterData.start_time,
        end_time: masterData.end_time,
        duration_minutes: masterData.service_duration_minutes,
        visitor_name: assignedVisitor,
        companion_names: masterData.companion_names,
        route_category: masterData.route_category,
        status: PlanStatus.UNCONFIRMED,
        created_at: now,
        created_by: creatorId,
        updated_at: now,
        updated_by: creatorId
      };
    });

    logger.checkpoint('ペイロード構築完了');

    if (isDebugMode()) {
      dumpArray(rows, 'Schedule Rows', 3);
    }

    // AppSheet APIペイロード
    const payload = {
      Action: 'Add',
      Properties: {
        Locale: LOCALE,
        Timezone: 'Asia/Tokyo'
      },
      Rows: rows
    };

    // レート制限対策: ランダム待機
    const waitTime = Math.random() * 3000;
    logger.debug(`待機時間: ${Math.round(waitTime)}ms`);
    Utilities.sleep(waitTime);

    // API呼び出し
    const apiUrl = `${APPSHEET_API_BASE_URL}/${APP_ID}/tables/${PLAN_TABLE_NAME}/Action`;

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
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    logger.debug(`レスポンスコード: ${responseCode}`);

    if (responseCode >= 400) {
      logger.error(`AppSheet API エラー: ${responseText}`);
      throw new Error(`AppSheet API Error: ${responseText}`);
    }

    logger.success('予定作成成功');
    logger.checkpoint('作成完了');

    if (isDebugMode()) {
      logger.summary();
    }

  } catch (error) {
    logger.error('予定作成中にエラー', error);
    throw error;
  }
}

/**
 * マスターのステータスを更新
 *
 * @param {string} masterId - マスターID
 * @param {string} status - ステータス（'未処理', '処理中', '完了', 'エラー'）
 * @param {string|null} errorMessage - エラーメッセージ（エラー時のみ）
 *
 * @example
 * updateMasterStatus('MASTER_001', '完了', null);
 * updateMasterStatus('MASTER_002', 'エラー', 'データ不整合');
 */
function updateMasterStatus(masterId, status, errorMessage) {
  const logger = createDebugLogger('DataAccess.updateMasterStatus');
  logger.info(`ステータス更新: ${masterId} → ${status}`);

  try {
    const rowData = {
      master_id: masterId,
      status: status
    };

    if (errorMessage) {
      rowData.error_details = `GAS Script Error: ${errorMessage}`;
      logger.warn(`エラー詳細: ${errorMessage}`);
    }

    const payload = {
      Action: 'Edit',
      Properties: {
        Locale: LOCALE,
        Timezone: 'Asia/Tokyo'
      },
      Rows: [rowData]
    };

    // レート制限対策: ランダム待機
    const waitTime = Math.random() * 3000;
    Utilities.sleep(waitTime);

    // API呼び出し
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

    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();

    if (responseCode >= 400) {
      logger.error(`AppSheet API エラー: ${response.getContentText()}`);
      throw new Error(`AppSheet API Error: ${response.getContentText()}`);
    }

    logger.success('ステータス更新成功');

  } catch (error) {
    logger.error('ステータス更新中にエラー', error);
    // ステータス更新エラーは処理全体を止めないためスロー不要
    // Logger.log で記録のみ
  }
}

// =============================================================================
// テスト関数
// =============================================================================

/**
 * データアクセスモジュールのテスト
 */
function testDataAccess() {
  Logger.log('='.repeat(60));
  Logger.log('データアクセスモジュールのテスト開始');
  Logger.log('='.repeat(60));

  // テスト1: マスターデータ取得
  Logger.log('\n--- テスト1: マスターデータ取得 ---');
  const testMasterId = 'MASTER_001'; // ← 実際のIDに変更
  const masterData = getMasterDataById(testMasterId);

  if (masterData) {
    Logger.log('✅ マスターデータ取得成功');
    Logger.log(`client_id: ${masterData.client_id}`);
    Logger.log(`frequency: ${masterData.frequency}`);
  } else {
    Logger.log('❌ マスターデータが見つかりません');
  }

  // テスト2: 既存予定データ取得
  Logger.log('\n--- テスト2: 既存予定データ取得 ---');
  const existingData = getExistingScheduleData();
  Logger.log(`✅ 重複判定キー数: ${existingData.masterKeys.size}`);
  Logger.log(`✅ 担当者マップ数: ${existingData.visitorMap.size}`);

  // テスト3: ステータス更新（dry-runモード推奨）
  if (DRY_RUN_MODE) {
    Logger.log('\n--- テスト3: ステータス更新（DRY RUN） ---');
    Logger.log('⚠️ DRY_RUN_MODE が有効なため、実際の更新はスキップされます');
  } else {
    Logger.log('\n--- テスト3: ステータス更新 ---');
    Logger.log('⚠️ 実際のステータス更新は省略（手動テスト時のみ実行）');
    // updateMasterStatus(testMasterId, '処理中', null);
  }

  Logger.log('\n' + '='.repeat(60));
  Logger.log('データアクセスモジュールのテスト完了');
  Logger.log('='.repeat(60));
}
