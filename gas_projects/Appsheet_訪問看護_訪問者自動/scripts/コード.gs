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


/**

 * 設定エリア

 * ご自身のスプレッドシートのID、シート名、列名に合わせて書き換えてください

 */

const CONFIG = {

  // スプレッドシートID (URLから取得できます)

  SCHEDULE_SPREADSHEET_ID: '11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc',

  STAFF_SPREADSHEET_ID: '1F8-HxdTtz4ljW9NVqdLFX3U4mEx3Ux1QOfYCMOBXBB4',

  ATTENDANCE_SPREADSHEET_ID: '1QDMA3DP4Y9XSFRWY9ewwP3Vih2NJEpq7NmNRRgASqRY',



  // --- 新機能：訪問比率の設定 ---

  // trueにすると、STAFF_ASSIGNMENT_RATIOに基づいた比率で割り当てを試みます。

  // falseにすると、従来のロジック（空いているスタッフを順に割り当て）で動作します。

  USE_RATIO_ASSIGNMENT: true,



  // 各スタッフの訪問比率 (合計が1.0になるように調整してください)

  // 例: {'STF-001': 0.4, 'STF-003': 0.6}  // Aさんに40%, Bさんに60%

  STAFF_ASSIGNMENT_RATIO: {

    'STF-001': 0.1,

    'STF-003': 0.4,

    'STF-004': 0.5

  },



  // シート名

  SCHEDULE_SHEET_NAME: 'Schedule_Plan',

  STAFF_SHEET_NAME: 'Staff_Members',

  ATTENDANCE_SHEET_NAME: '勤務_予定',



  // Schedule_Plan シートの列名

  SCHEDULE_COLUMNS: {

    VISIT_DATE: 'visit_date',

    START_TIME: 'start_time',

    END_TIME: 'end_time',

    VISITOR_NAME: 'visitor_name',

    CLIENT_ID: 'client_id',

    ROUTE_TAG: 'route_tag',

    JOB_TYPE: 'job_type' // ★追加

  },



  // Staff_Members シートの列名

  STAFF_COLUMNS: {

    STAFF_ID: 'staff_id',

    EMAIL: 'email',

    JOB_TYPE_ID: 'job_type_id' // ★追加

  },



  // 勤務_予定 シートの列名

  ATTENDANCE_COLUMNS: {

    DATE: '年月日',

    STATUS: '区分',

    START_TIME: '始業時刻_予定',

    END_TIME: '終業時刻_予定',

    EMAIL: '社員'

  }

};



/**

 * メイン関数：翌月の訪問スケジュールにスタッフを割り当てる

 */

function assignStaffForNextMonth() {

  try {

    const ssSchedule = SpreadsheetApp.openById(CONFIG.SCHEDULE_SPREADSHEET_ID);

    const ssStaff = SpreadsheetApp.openById(CONFIG.STAFF_SPREADSHEET_ID);

    const ssAttendance = SpreadsheetApp.openById(CONFIG.ATTENDANCE_SPREADSHEET_ID);



    const scheduleSheet = ssSchedule.getSheetByName(CONFIG.SCHEDULE_SHEET_NAME);

    const staffSheet = ssStaff.getSheetByName(CONFIG.STAFF_SHEET_NAME);

    const attendanceSheet = ssAttendance.getSheetByName(CONFIG.ATTENDANCE_SHEET_NAME);



    if (!scheduleSheet || !staffSheet || !attendanceSheet) {

      Logger.log('設定されたシート名が見つかりません。CONFIGを確認してください。');

      return;

    }



    const scheduleData = getSheetData(scheduleSheet);

    const staffData = getSheetData(staffSheet);

    const attendanceData = getSheetData(attendanceSheet);



    const scheduleCols = getHeaderIndices(scheduleData.header, CONFIG.SCHEDULE_COLUMNS);

    const staffCols = getHeaderIndices(staffData.header, CONFIG.STAFF_COLUMNS);

    const attendanceCols = getHeaderIndices(attendanceData.header, CONFIG.ATTENDANCE_COLUMNS);



    const today = new Date();

    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);



    const clientPreferences = createClientPreferences(scheduleData.rows, scheduleCols, prevMonth);

    const staffDetails = createStaffDetails(staffData, staffCols);

    const staffWorkSchedules = createWorkSchedules(staffDetails, attendanceData, attendanceCols);



    // ★修正：翌月の未割り当てスケジュールから「看護」のみを抽出

    const unassignedVisits = scheduleData.rows.map((row, index) => ({ row, index }))

      .filter(item => {

        const visitDate = new Date(item.row[scheduleCols.VISIT_DATE]);

        const visitor = item.row[scheduleCols.VISITOR_NAME];

        const jobType = item.row[scheduleCols.JOB_TYPE];

        return !visitor &&

               jobType === '看護' && // 「看護」のみを対象

               visitDate.getFullYear() === nextMonth.getFullYear() &&

               visitDate.getMonth() === nextMonth.getMonth();

      });



    Logger.log(`翌月の未割り当てスケジュール（看護）: ${unassignedVisits.length}件`);

    if (unassignedVisits.length === 0) {

      Logger.log('翌月の未割り当てスケジュール（看護）はありませんでした。');

      return;

    }



    // --- 割り当てロジック ---

    let assignedCount = 0;

    const assignedCounts = {}; // スタッフごとの割り当て件数を記録

    

    // 比率計算の準備

    let targetCounts = {};

    if(CONFIG.USE_RATIO_ASSIGNMENT) {

        const totalVisits = unassignedVisits.length;

        for(const staffId in CONFIG.STAFF_ASSIGNMENT_RATIO){

            targetCounts[staffId] = totalVisits * CONFIG.STAFF_ASSIGNMENT_RATIO[staffId];

            assignedCounts[staffId] = 0;

        }

    }





    const visitsByDayAndRoute = groupVisitsByDayAndRoute(unassignedVisits, scheduleCols);

    const dailyRouteAssignments = {};



    for (const key in visitsByDayAndRoute) {

      const [visitDateStr, routeTag] = key.split('|');

      const visitsInGroup = visitsByDayAndRoute[key];

      const firstVisit = visitsInGroup[0];

      

      const visitDate = new Date(firstVisit.row[scheduleCols.VISIT_DATE]);

      const visitStartTime = combineDateAndTime(visitDate, firstVisit.row[scheduleCols.START_TIME]);

      const visitEndTime = combineDateAndTime(visitDate, firstVisit.row[scheduleCols.END_TIME]);

      const clientId = firstVisit.row[scheduleCols.CLIENT_ID];



      if (!dailyRouteAssignments[visitDateStr]) {

        dailyRouteAssignments[visitDateStr] = {};

      }



      let assignedStaffId = null;



      if (dailyRouteAssignments[visitDateStr][routeTag]) {

        assignedStaffId = dailyRouteAssignments[visitDateStr][routeTag];

      } else {

        const assignedStaffOnDay = Object.values(dailyRouteAssignments[visitDateStr]);

        // ★修正：「看護」スタッフ（01-03）のみを対象に

        const availableStaff = findAvailableStaff(visitStartTime, visitEndTime, staffWorkSchedules, staffDetails, ['01', '02', '03'], assignedStaffOnDay);

        

        if (availableStaff.length > 0) {

           const preferredStaffId = clientPreferences[clientId];

           

           if(CONFIG.USE_RATIO_ASSIGNMENT){

               assignedStaffId = selectStaffByRatio(availableStaff, preferredStaffId, assignedCounts, targetCounts);

           } else {

               const preferredStaffIsAvailable = availableStaff.find(s => s.staffId === preferredStaffId);

               assignedStaffId = preferredStaffIsAvailable ? preferredStaffId : availableStaff[0].staffId;

           }

        }

      }

      

      if (assignedStaffId) {

        dailyRouteAssignments[visitDateStr][routeTag] = assignedStaffId;

        visitsInGroup.forEach(visit => {

          scheduleData.rows[visit.index][scheduleCols.VISITOR_NAME] = assignedStaffId;

          assignedCount++;

        });

        // 割り当て件数をカウント

        if(CONFIG.USE_RATIO_ASSIGNMENT && assignedCounts[assignedStaffId] !== undefined) {

            assignedCounts[assignedStaffId] += visitsInGroup.length;

        }

      }

    }



    const originalData = scheduleSheet.getDataRange().getValues();

    const updatedData = [originalData[0], ...scheduleData.rows];

    scheduleSheet.getRange(1, 1, updatedData.length, updatedData[0].length).setValues(updatedData);



    Logger.log(`処理が完了しました。${assignedCount}件のスケジュールにスタッフを割り当てました。`);

    if(CONFIG.USE_RATIO_ASSIGNMENT) Logger.log(`最終割り当て件数: ${JSON.stringify(assignedCounts)}`);



  } catch (e) {

    Logger.log(`エラーが発生しました: ${e.stack}`);

  }

}



// --- ヘルパー関数 ---



function getSheetData(sheet) {

  const values = sheet.getDataRange().getValues();

  const header = values.shift();

  return { header, rows: values };

}



function getHeaderIndices(header, columnsConfig) {

  const indices = {};

  for (const key in columnsConfig) {

    const colName = columnsConfig[key];

    indices[key] = header.indexOf(colName);

    if (indices[key] === -1) throw new Error(`列名が見つかりません: ${colName}`);

  }

  return indices;

}



/**

 * ★新規：スタッフの詳細情報（職種IDなど）をまとめる

 */

function createStaffDetails(staffData, staffCols){

    const details = {};

    staffData.rows.forEach(row => {

        const staffId = row[staffCols.STAFF_ID];

        if(staffId){

            details[staffId] = {

                email: row[staffCols.EMAIL],

                jobTypeId: row[staffCols.JOB_TYPE_ID] ? String(row[staffCols.JOB_TYPE_ID]).padStart(2,'0') : null // ゼロ埋めして文字列に

            };

        }

    });

    return details;

}



function createClientPreferences(rows, cols, prevMonth) {

  const preferences = {};

  const visitCounts = {};

  rows.forEach(row => {

    const visitDate = new Date(row[cols.VISIT_DATE]);

    const clientId = row[cols.CLIENT_ID];

    const visitor = row[cols.VISITOR_NAME];

    if (visitor && clientId && visitDate.getFullYear() === prevMonth.getFullYear() && visitDate.getMonth() === prevMonth.getMonth()) {

      const key = `${clientId}_${visitor}`;

      visitCounts[key] = (visitCounts[key] || 0) + 1;

    }

  });

  const maxCounts = {};

  for (const key in visitCounts) {

    const [clientId, staffId] = key.split('_');

    const count = visitCounts[key];

    if (!maxCounts[clientId] || count > maxCounts[clientId].count) {

      maxCounts[clientId] = { staffId, count };

    }

  }

  for (const clientId in maxCounts) {

    preferences[clientId] = maxCounts[clientId].staffId;

  }

  return preferences;

}



/**

 * ★修正：staffDetailsを受け取るように変更

 */

function createWorkSchedules(staffDetails, attendanceData, attendanceCols) {

  const schedules = {};

  for(const staffId in staffDetails){

      schedules[staffId] = { email: staffDetails[staffId].email, shifts: {} };

  }

  const emailToStaffId = Object.entries(staffDetails).reduce((acc, [id, detail]) => {

      acc[detail.email] = id;

      return acc;

  }, {});

  

  attendanceData.rows.forEach(row => {

    const email = row[attendanceCols.EMAIL];

    const staffId = emailToStaffId[email];

    const status = row[attendanceCols.STATUS];

    if (staffId && status === '出勤') {

      const date = new Date(row[attendanceCols.DATE]);

      const startTime = row[attendanceCols.START_TIME];

      const endTime = row[attendanceCols.END_TIME];

      if (date && startTime && endTime && !isNaN(date.getTime())) {

        const dateStr = date.toLocaleDateString();

        schedules[staffId].shifts[dateStr] = {

          start: combineDateAndTime(date, startTime),

          end: combineDateAndTime(date, endTime)

        };

      }

    }

  });

  return schedules;

}



/**

 * ★修正：職種IDでのフィルタリング機能を追加

 */

function findAvailableStaff(visitStart, visitEnd, staffSchedules, staffDetails, requiredJobTypeIds = [], excludeStaffIds = []) {

  const available = [];

  const visitDateStr = visitStart.toLocaleDateString();

  for (const staffId in staffSchedules) {

    if (excludeStaffIds.includes(staffId)) continue;

    

    // 職種フィルタ

    const staffJobTypeId = staffDetails[staffId]?.jobTypeId;

    if (requiredJobTypeIds.length > 0 && !requiredJobTypeIds.includes(staffJobTypeId)) continue;



    const staffShift = staffSchedules[staffId].shifts[visitDateStr];

    if (staffShift && visitStart >= staffShift.start && visitEnd <= staffShift.end) {

      available.push({ staffId: staffId });

    }

  }

  return available;

}



/**

 * ★新規：訪問を日付とルートタグでグループ化する

 */

function groupVisitsByDayAndRoute(visits, scheduleCols) {

    const groups = {};

    visits.forEach(visit => {

      const visitDateStr = new Date(visit.row[scheduleCols.VISIT_DATE]).toLocaleDateString();

      const routeTag = visit.row[scheduleCols.ROUTE_TAG] || 'UNKNOWN';

      const key = `${visitDateStr}|${routeTag}`;

      if (!groups[key]) groups[key] = [];

      groups[key].push(visit);

    });

    return groups;

}



/**

 * ★新規：比率に基づいてスタッフを選択するロジック

 */

function selectStaffByRatio(availableStaff, preferredStaffId, assignedCounts, targetCounts) {

    // 1. 優先スタッフが利用可能で、かつ目標件数に達していないか？

    const preferredIsAvailable = availableStaff.find(s => s.staffId === preferredStaffId);

    if (preferredIsAvailable && assignedCounts[preferredStaffId] < targetCounts[preferredStaffId]) {

        return preferredStaffId;

    }



    // 2. 目標比率に対して最も余裕のあるスタッフを探す

    let selectedStaff = null;

    let maxDeficiency = -Infinity;



    availableStaff.forEach(staff => {

        const staffId = staff.staffId;

        if(targetCounts[staffId] !== undefined) {

            const deficiency = targetCounts[staffId] - assignedCounts[staffId];

            if (deficiency > maxDeficiency) {

                maxDeficiency = deficiency;

                selectedStaff = staffId;

            }

        }

    });



    // 3. 比率設定にないが利用可能なスタッフがいれば、その人を返す

    if(!selectedStaff && availableStaff.length > 0) {

        return availableStaff[0].staffId;

    }



    return selectedStaff;

}



function combineDateAndTime(dateObj, time) {

  const newDate = new Date(dateObj);

  let hours = 0, minutes = 0, seconds = 0;

  if (time instanceof Date) {

    hours = time.getHours(); minutes = time.getMinutes(); seconds = time.getSeconds();

  } else if (typeof time === 'string' && time.includes(':')) {

    const parts = time.split(':');

    hours = parseInt(parts[0], 10) || 0;

    minutes = parseInt(parts[1], 10) || 0;

    seconds = parseInt(parts[2], 10) || 0;

  }

  newDate.setHours(hours, minutes, seconds, 0);

  return newDate;

}