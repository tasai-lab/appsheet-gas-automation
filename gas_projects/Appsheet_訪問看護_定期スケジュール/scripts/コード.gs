/**
 * 実行ログモジュール
 */
const ExecutionLogger = {
  SPREADSHEET_ID: '15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE',
  SHEET_NAME: 'シート1',
  
  /**
   * ログを記録
   * @param {string} scriptName - スクリプト名
   * @param {string} status - ステータス (SUCCESS/ERROR/WARNING)
   * @param {string} processId - 処理ID
   * @param {string} message - メッセージ
   * @param {string} errorDetail - エラー詳細
   * @param {number} executionTime - 実行時間(秒)
   * @param {Object} inputData - 入力データ
   */
  log: function(scriptName, status, processId, message, errorDetail, executionTime, inputData) {
    try {
      const ss = SpreadsheetApp.openById(this.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(this.SHEET_NAME);
      
      const timestamp = new Date();
      const user = Session.getActiveUser().getEmail();
      const inputDataStr = inputData ? JSON.stringify(inputData).substring(0, 1000) : '';
      
      sheet.appendRow([
        timestamp,
        scriptName,
        status,
        processId || '',
        message || '',
        errorDetail || '',
        executionTime || 0,
        user,
        inputDataStr
      ]);
    } catch (e) {
      Logger.log(`ログ記録エラー: ${e.message}`);
    }
  },
  
  /**
   * 成功ログ
   */
  success: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'SUCCESS', processId, message, '', executionTime, inputData);
  },
  
  /**
   * エラーログ
   */
  error: function(scriptName, processId, message, error, executionTime, inputData) {
    const errorDetail = error ? `${error.message}\n${error.stack}` : '';
    this.log(scriptName, 'ERROR', processId, message, errorDetail, executionTime, inputData);
  },
  
  /**
   * 警告ログ
   */
  warning: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'WARNING', processId, message, '', executionTime, inputData);
  }
};


/**
 * Webhook重複実行防止モジュール
 */
const DuplicationPrevention = {
  LOCK_TIMEOUT: 300000, // 5分
  CACHE_EXPIRATION: 3600, // 1時間
  
  /**
   * リクエストの重複チェック
   * @param {string} requestId - リクエストID（webhookデータのハッシュ値）
   * @return {boolean} - 処理を続行する場合はtrue
   */
  checkDuplicate: function(requestId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `processed_${requestId}`;
    
    // キャッシュチェック
    if (cache.get(cacheKey)) {
      Logger.log(`重複リクエストを検出: ${requestId}`);
      return false;
    }
    
    // ロック取得
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(this.LOCK_TIMEOUT);
      
      // 再度キャッシュチェック（ダブルチェック）
      if (cache.get(cacheKey)) {
        Logger.log(`ロック取得後、重複リクエストを検出: ${requestId}`);
        return false;
      }
      
      // 処理済みマークを設定
      cache.put(cacheKey, 'processed', this.CACHE_EXPIRATION);
      return true;
    } catch (e) {
      Logger.log(`ロック取得エラー: ${e.message}`);
      return false;
    } finally {
      lock.releaseLock();
    }
  },
  
  /**
   * リクエストIDを生成
   * @param {Object} data - Webhookデータ
   * @return {string} - リクエストID
   */
  generateRequestId: function(data) {
    const str = JSON.stringify(data);
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      str,
      Utilities.Charset.UTF_8
    ).map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
  }
};


// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

const SPREADSHEET_ID = '11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc';

const SHEET_NAME = 'Schedule_Plan';

const APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';

const ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';



const MASTER_TABLE_NAME = 'Schedule_Master'; // ★ マスターテーブル名を追加

const PLAN_TABLE_NAME = 'Schedule_Plan';



/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 */

function doPost(e) {

  let masterId = null;

  try {

    const params = JSON.parse(e.postData.contents);

    const masterData = params.masterData;

    const creatorId = params.creatorId;

    masterId = masterData.master_id;



    if (!masterData || !creatorId || !masterId) {

      throw new Error("必須パラメータ（masterData, creatorId）が不足しています。");

    }

    

    const existingSchedules = getExistingScheduleData();

    const potentialDates = calculatePotentialDates(masterData);



    const schedulesToCreate = potentialDates.filter(date => {

      const visitDateStr = Utilities.formatDate(date, "JST", "yyyy-MM-dd");

      const startTimeStr = masterData.start_time ? masterData.start_time.substring(0, 5) : '00:00';

      const endTimeStr = masterData.end_time ? masterData.end_time.substring(0, 5) : '00:00';

      

      const masterKey = [masterId, visitDateStr, startTimeStr, endTimeStr].join('|');

      const isDuplicate = existingSchedules.masterKeys.has(masterKey);

      

      return !isDuplicate;

    });



    if (schedulesToCreate.length === 0) {

      console.log("作成すべき新しい予定はありませんでした。");

      updateMasterStatus(masterId, "完了", null);

      return;

    }



    createSchedulesInAppSheet(masterData, schedulesToCreate, creatorId, existingSchedules.visitorMap);

    updateMasterStatus(masterId, "完了", null);

    console.log(`${schedulesToCreate.length}件の新しい予定を作成しました。`);



  } catch (error) {

    console.error(`処理中にエラーが発生しました: ${error.message}\n${error.stack}`);

    if (masterId) {

      updateMasterStatus(masterId, "エラー", error.message);

    }

  }

}



/**

 * スプレッドシートから既存の予定情報を読み込み、重複チェック用キーと担当者割り当てマップを作成する

 */

function getExistingScheduleData() {

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

  const data = sheet.getDataRange().getValues();

  const headers = data.shift();



  const col = (name) => headers.indexOf(name);

  const idx = {

    visitDate: col('visit_date'), startTime: col('start_time'), endTime: col('end_time'),

    masterId: col('master_id'), routeCategory: col('route_category'), visitorName: col('visitor_name')

  };

  

  const masterKeys = new Set();

  const visitorMap = new Map();

  

  for (const row of data) {

    if (!row[idx.masterId] || !row[idx.visitDate] || !row[idx.startTime] || !row[idx.endTime]) continue;



    const visitDate = Utilities.formatDate(new Date(row[idx.visitDate]), "JST", "yyyy-MM-dd");

    

    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

    // ★ 修正箇所：文字列として直接 時:分 を切り出す ★

    const startTimeStr = String(row[idx.startTime]).substring(0, 5);

    const endTimeStr = String(row[idx.endTime]).substring(0, 5);

    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

    

    const masterKey = [row[idx.masterId], visitDate, startTimeStr, endTimeStr].join('|');

    masterKeys.add(masterKey);



    const visitor = row[idx.visitorName];

    const route = row[idx.routeCategory];

    if (visitor && route) {

      const visitorMapKey = `${visitDate}|${route}`;

      if (!visitorMap.has(visitorMapKey)) {

        visitorMap.set(visitorMapKey, visitor);

      }

    }

  }

  return { masterKeys, visitorMap };

}





// =================================================================

// 以下のヘルパー関数群に変更はありません

// =================================================================

function createSchedulesInAppSheet(master, dates, creatorId, visitorMap) {

    const now = Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd HH:mm:ss");

    const rows = dates.map(date => {

        const visitDateStr = Utilities.formatDate(date, "JST", "yyyy-MM-dd");

        const visitorMapKey = `${visitDateStr}|${master.route_category}`;

        const assignedVisitor = visitorMap.get(visitorMapKey) || master.visitor_name || "";

        return { "master_id": master.master_id, "client_id": master.client_id, "job_type": master.job_type, "insurance_type": master.insurance_type, "is_regular_visit": true, "visit_date": visitDateStr, "start_time": master.start_time, "end_time": master.end_time, "duration_minutes": master.service_duration_minutes, "visitor_name": assignedVisitor, "companion_names": master.companion_names, "route_category": master.route_category, "status": "未確定", "created_at": now, "created_by": creatorId, "updated_at": now, "updated_by": creatorId };

    });

    const payload = { Action: "Add", Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: rows };

    Utilities.sleep(Math.random() * 3000);

    const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${PLAN_TABLE_NAME}/Action`;

    const options = { method: 'post', contentType: 'application/json', headers: { 'ApplicationAccessKey': ACCESS_KEY }, payload: JSON.stringify(payload), muteHttpExceptions: true };

    const response = UrlFetchApp.fetch(apiUrl, options);

    if (response.getResponseCode() >= 400) {

        throw new Error(`AppSheet API Error: ${response.getContentText()}`);

    }

}

function updateMasterStatus(masterId, status, errorMessage) {

    const rowData = { "master_id": masterId, "status": status };

    if (errorMessage) {

        rowData.error_details = `GAS Script Error: ${errorMessage}`;

    }

    const payload = { Action: "Edit", Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: [rowData] };

    Utilities.sleep(Math.random() * 3000);

    const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${MASTER_TABLE_NAME}/Action`;

    const options = { method: 'post', contentType: 'application/json', headers: { 'ApplicationAccessKey': ACCESS_KEY }, payload: JSON.stringify(payload), muteHttpExceptions: true };

    UrlFetchApp.fetch(apiUrl, options);

}

function calculatePotentialDates(master) {

    const startDate = new Date(master.apply_start_date);

    const endDate = master.apply_end_date ? new Date(master.apply_end_date) : new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    const targetDayOfWeek = Number(master.day_of_week) - 1;

    const dates = [];

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {

        if (isDateMatchRule(currentDate, master, targetDayOfWeek)) {

            dates.push(new Date(currentDate));

        }

        currentDate.setDate(currentDate.getDate() + 1);

    }

    return dates;

}

function isDateMatchRule(date, master, targetDayOfWeek) {

    if (date.getDay() !== targetDayOfWeek) return false;

    const freq = master.frequency;

    if (freq === '毎週') return true;

    if (freq === '隔週') {

        const start = new Date(master.apply_start_date);

        const diffTime = Math.abs(date.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0));

        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const diffWeeks = Math.floor(diffDays / 7);

        return diffWeeks % 2 === 0;

    }

    if (freq === '毎月') {

        const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1;

        const targetWeekNum = master.target_week ? parseInt(master.target_week.replace(/\D/g, ''), 10) : 0;

        return weekOfMonth === targetWeekNum;

    }

    return false;

}