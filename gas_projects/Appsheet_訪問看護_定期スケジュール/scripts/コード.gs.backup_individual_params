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

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_訪問看護_定期スケジュール';
    return processRequest(params);
  });
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  let masterId = null;

  try {

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
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  // TODO: テストデータを設定してください
  const testParams = {
    // 例: action: "test",
    // 例: data: "sample"
  };

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_訪問看護_定期スケジュール');
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
