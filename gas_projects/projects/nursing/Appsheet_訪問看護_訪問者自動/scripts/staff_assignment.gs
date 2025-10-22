/**

 * 設定エリア

 * ご自身のスプレッドシートのID、シート名、列名に合わせて書き換えてください

 */

const CONFIG = {

  // スプレッドシートID (URLから取得できます)

  SCHEDULE_SPREADSHEET_ID: '11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc',

  STAFF_SPREADSHEET_ID: '1F8-HxdTtz4ljW9NVqdLFX3U4mEx3Ux1QOfYCMOBXBB4',

  ATTENDANCE_SPREADSHEET_ID: '1QDMA3DP4Y9XSFRWY9ewwP3Vih2NJEpq7NmNRRgASqRY',


  // --- 新機能：Vertex AIによる均等配置 ---

  // trueにすると、Vertex AIが先月の訪問履歴を分析して最適なスタッフを選択します

  // falseにすると、STAFF_ASSIGNMENT_RATIOに基づいた比率で割り当てを試みます

  USE_VERTEX_AI_ASSIGNMENT: true,


  // --- 従来の訪問比率の設定（USE_VERTEX_AI_ASSIGNMENT=falseの時に使用） ---

  // trueにすると、STAFF_ASSIGNMENT_RATIOに基づいた比率で割り当てを試みます。

  // falseにすると、従来のロジック（空いているスタッフを順に割り当て）で動作します。

  USE_RATIO_ASSIGNMENT: false,


  // 各スタッフの訪問比率 (合計が1.0になるように調整してください)

  // 例: {'STF-001': 0.4, 'STF-003': 0.6}  // Aさんに40%, Bさんに60%

  STAFF_ASSIGNMENT_RATIO: {

    'STF-001': 0.1,

    'STF-003': 0.4,

    'STF-004': 0.5

  },


  // --- Vertex AI設定 ---

  GCP_PROJECT_ID: 'macro-shadow-458705-v8',

  GCP_LOCATION: 'us-central1',

  VERTEX_AI_MODEL: 'gemini-2.5-flash',


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

  // ロガー初期化（GAS実行ログへの記録用）

  const logger = createLogger('訪問看護_訪問者自動');

  let status = '成功';



  try {

    logger.info('=== スタッフ自動割り当て処理を開始 ===');

    logger.info(`設定: Vertex AI使用=${CONFIG.USE_VERTEX_AI_ASSIGNMENT}, モデル=${CONFIG.VERTEX_AI_MODEL}`);



    const ssSchedule = SpreadsheetApp.openById(CONFIG.SCHEDULE_SPREADSHEET_ID);

    const ssStaff = SpreadsheetApp.openById(CONFIG.STAFF_SPREADSHEET_ID);

    const ssAttendance = SpreadsheetApp.openById(CONFIG.ATTENDANCE_SPREADSHEET_ID);

    const scheduleSheet = ssSchedule.getSheetByName(CONFIG.SCHEDULE_SHEET_NAME);

    const staffSheet = ssStaff.getSheetByName(CONFIG.STAFF_SHEET_NAME);

    const attendanceSheet = ssAttendance.getSheetByName(CONFIG.ATTENDANCE_SHEET_NAME);

    if (!scheduleSheet || !staffSheet || !attendanceSheet) {

      throw new Error('設定されたシート名が見つかりません。CONFIGを確認してください。');

    }



    logger.info('スプレッドシート接続成功');

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

    // Vertex AI用: 先月の訪問統計を取得
    const lastMonthStats = CONFIG.USE_VERTEX_AI_ASSIGNMENT
      ? getLastMonthVisitStatistics(scheduleData.rows, scheduleCols, prevMonth)
      : null;

    if (CONFIG.USE_VERTEX_AI_ASSIGNMENT && lastMonthStats) {
      logger.info(`[先月統計] 総訪問件数: ${lastMonthStats.totalVisits}件`);
      logger.info(`[先月統計] スタッフ別: ${JSON.stringify(lastMonthStats.staffVisits)}`);
    }

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

    logger.info(`翌月の未割り当てスケジュール（看護）: ${unassignedVisits.length}件`);

    if (unassignedVisits.length === 0) {

      logger.info('翌月の未割り当てスケジュール（看護）はありませんでした。');

      logger.saveToSpreadsheet(status);

      return;

    }

    // --- 割り当てロジック ---

    let assignedCount = 0;

    const assignedCounts = {}; // スタッフごとの割り当て件数を記録（今月の累積）

    // 比率計算の準備（USE_RATIO_ASSIGNMENT=trueの場合のみ）

    let targetCounts = {};

    if(CONFIG.USE_RATIO_ASSIGNMENT) {

        const totalVisits = unassignedVisits.length;

        for(const staffId in CONFIG.STAFF_ASSIGNMENT_RATIO){

            targetCounts[staffId] = totalVisits * CONFIG.STAFF_ASSIGNMENT_RATIO[staffId];

            assignedCounts[staffId] = 0;

        }

    }

    // Vertex AI用: 全スタッフの割り当てカウンターを初期化

    if(CONFIG.USE_VERTEX_AI_ASSIGNMENT) {

        for(const staffId in staffDetails){

            assignedCounts[staffId] = 0;

        }

    }

    const visitsByDayAndRoute = groupVisitsByDayAndRoute(unassignedVisits, scheduleCols);

    const dailyRouteAssignments = {};

    // Vertex AIバッチ処理用：全訪問グループを収集
    const visitGroupsForBatch = [];

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

      // 同じ日の同じルートに既に割り当てられている場合はスキップ
      if (dailyRouteAssignments[visitDateStr][routeTag]) {
        continue;
      }

      const assignedStaffOnDay = Object.values(dailyRouteAssignments[visitDateStr]);

      // 「看護」スタッフ（01-03）のみを対象に

      const availableStaff = findAvailableStaff(visitStartTime, visitEndTime, staffWorkSchedules, staffDetails, ['01', '02', '03'], assignedStaffOnDay);

      if (availableStaff.length > 0) {

        const preferredStaffId = clientPreferences[clientId];

        // Vertex AIバッチ処理用にグループ情報を収集
        if(CONFIG.USE_VERTEX_AI_ASSIGNMENT) {
          visitGroupsForBatch.push({
            key: key,
            visitDateStr: visitDateStr,
            visitDate: visitDate.toISOString().split('T')[0],
            routeTag: routeTag,
            clientId: clientId,
            visitsInGroup: visitsInGroup,
            availableStaff: availableStaff,
            preferredStaffId: preferredStaffId
          });
        }

      }

    }

    // Vertex AIバッチ処理実行
    let batchAssignments = {};
    if(CONFIG.USE_VERTEX_AI_ASSIGNMENT && visitGroupsForBatch.length > 0) {
      batchAssignments = assignStaffWithVertexAIBatch(visitGroupsForBatch, lastMonthStats, logger);
    }

    // 割り当て結果を適用
    for (const key in visitsByDayAndRoute) {

      const [visitDateStr, routeTag] = key.split('|');

      const visitsInGroup = visitsByDayAndRoute[key];

      const firstVisit = visitsInGroup[0];

      const visitDate = new Date(firstVisit.row[scheduleCols.VISIT_DATE]);

      const visitStartTime = combineDateAndTime(visitDate, firstVisit.row[scheduleCols.START_TIME]);

      const visitEndTime = combineDateAndTime(visitDate, firstVisit.row[scheduleCols.END_TIME]);

      const clientId = firstVisit.row[scheduleCols.CLIENT_ID];

      let assignedStaffId = null;

      // 同じ日の同じルートに既に割り当てられている場合は再利用
      if (dailyRouteAssignments[visitDateStr] && dailyRouteAssignments[visitDateStr][routeTag]) {

        assignedStaffId = dailyRouteAssignments[visitDateStr][routeTag];

      } else {

        const assignedStaffOnDay = Object.values(dailyRouteAssignments[visitDateStr] || {});

        const availableStaff = findAvailableStaff(visitStartTime, visitEndTime, staffWorkSchedules, staffDetails, ['01', '02', '03'], assignedStaffOnDay);

        if (availableStaff.length > 0) {

           const preferredStaffId = clientPreferences[clientId];

           if(CONFIG.USE_VERTEX_AI_ASSIGNMENT && batchAssignments[key]){

               // バッチ処理の結果を使用
               assignedStaffId = batchAssignments[key];

           } else if(CONFIG.USE_RATIO_ASSIGNMENT){

               assignedStaffId = selectStaffByRatio(availableStaff, preferredStaffId, assignedCounts, targetCounts);

           } else {

               const preferredStaffIsAvailable = availableStaff.find(s => s.staffId === preferredStaffId);

               assignedStaffId = preferredStaffIsAvailable ? preferredStaffId : availableStaff[0].staffId;

           }

        }

      }

      if (assignedStaffId) {

        if (!dailyRouteAssignments[visitDateStr]) {
          dailyRouteAssignments[visitDateStr] = {};
        }

        dailyRouteAssignments[visitDateStr][routeTag] = assignedStaffId;

        visitsInGroup.forEach(visit => {

          scheduleData.rows[visit.index][scheduleCols.VISITOR_NAME] = assignedStaffId;

          assignedCount++;

        });

        // 割り当て件数をカウント（Vertex AIまたは比率割り当て使用時）

        if((CONFIG.USE_VERTEX_AI_ASSIGNMENT || CONFIG.USE_RATIO_ASSIGNMENT) && assignedCounts[assignedStaffId] !== undefined) {

            assignedCounts[assignedStaffId] += visitsInGroup.length;

        }

      }

    }

    const originalData = scheduleSheet.getDataRange().getValues();

    const updatedData = [originalData[0], ...scheduleData.rows];

    scheduleSheet.getRange(1, 1, updatedData.length, updatedData[0].length).setValues(updatedData);

    logger.success(`処理完了: ${assignedCount}件のスケジュールにスタッフを割り当てました。`);

    if(CONFIG.USE_VERTEX_AI_ASSIGNMENT || CONFIG.USE_RATIO_ASSIGNMENT) {
      logger.info(`最終割り当て件数（今月）: ${JSON.stringify(assignedCounts)}`);
    }

  } catch (e) {

    status = 'エラー';

    logger.error(`エラーが発生しました: ${e.message}`, { stack: e.stack });

  } finally {

    // GAS実行ログにコスト含めて保存

    logger.saveToSpreadsheet(status);

    logger.info('=== 処理終了 ===');

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


// ============================================================================
// Vertex AI統合による均等配置機能
// ============================================================================

/**
 * 先月の訪問統計を取得
 * @param {Array} rows - Schedule_Planのデータ行
 * @param {Object} cols - 列インデックス
 * @param {Date} prevMonth - 先月の基準日
 * @return {Object} スタッフごとの訪問件数統計
 */
function getLastMonthVisitStatistics(rows, cols, prevMonth) {
  const stats = {
    totalVisits: 0,
    staffVisits: {},  // スタッフID → 件数
    staffByRoute: {}  // ルートカテゴリ → {スタッフID → 件数}
  };

  rows.forEach(row => {
    const visitDate = new Date(row[cols.VISIT_DATE]);
    const staffId = row[cols.VISITOR_NAME];
    const routeTag = row[cols.ROUTE_TAG];
    const jobType = row[cols.JOB_TYPE];

    // 先月かつ看護のみ
    if (staffId &&
        jobType === '看護' &&
        visitDate.getFullYear() === prevMonth.getFullYear() &&
        visitDate.getMonth() === prevMonth.getMonth()) {

      stats.totalVisits++;

      // スタッフごとの集計
      if (!stats.staffVisits[staffId]) {
        stats.staffVisits[staffId] = 0;
      }
      stats.staffVisits[staffId]++;

      // ルートカテゴリ×スタッフの集計
      if (routeTag) {
        if (!stats.staffByRoute[routeTag]) {
          stats.staffByRoute[routeTag] = {};
        }
        if (!stats.staffByRoute[routeTag][staffId]) {
          stats.staffByRoute[routeTag][staffId] = 0;
        }
        stats.staffByRoute[routeTag][staffId]++;
      }
    }
  });

  return stats;
}

/**
 * Vertex AIバッチ処理：全スケジュールを1回のAPI呼び出しでまとめて割り当て
 * @param {Array} visitGroups - 訪問グループの配列 [{key, visitsInGroup, availableStaff, preferredStaffId, visitDate, routeTag, clientId}]
 * @param {Object} lastMonthStats - 先月の訪問統計
 * @param {GASLogger} logger - ロガーインスタンス
 * @return {Object} {key: staffId} の割り当て結果
 */
function assignStaffWithVertexAIBatch(visitGroups, lastMonthStats, logger) {
  if (!visitGroups || visitGroups.length === 0) {
    return {};
  }

  logger.info(`[Vertex AI Batch] ${visitGroups.length}件のスケジュールをまとめて処理開始`);

  // バッチプロンプト構築
  const prompt = buildBatchAssignmentPrompt(visitGroups, lastMonthStats);

  try {
    // Vertex AI API呼び出し（JSONレスポンス）
    const result = callVertexAIForJSONGeneration(prompt, CONFIG.VERTEX_AI_MODEL, logger);

    // レスポンスパース
    const assignments = parseBatchAssignmentResponse(result.text, visitGroups);

    logger.success(`[Vertex AI Batch] ${Object.keys(assignments).length}件の割り当て完了`);

    return assignments;

  } catch (error) {
    logger.error(`[Vertex AI Batch] エラー: ${error.message}`);
    // エラー時はフォールバック（最初の候補を使用）
    const fallbackAssignments = {};
    visitGroups.forEach(group => {
      if (group.availableStaff.length > 0) {
        fallbackAssignments[group.key] = group.availableStaff[0].staffId;
      }
    });
    return fallbackAssignments;
  }
}

/**
 * バッチ割り当て用プロンプトを構築
 * @param {Array} visitGroups - 訪問グループ
 * @param {Object} lastMonthStats - 先月統計
 * @return {string} プロンプト
 */
function buildBatchAssignmentPrompt(visitGroups, lastMonthStats) {
  let prompt = `あなたは訪問看護のスタッフ配置を最適化するAIアシスタントです。

【目的】
${visitGroups.length}件の訪問スケジュールに対して、最適なスタッフを一括で割り当ててください。

【重要】均等配置の定義
「均等」とは、**曜日とルートのパターン**で各スタッフが偏りなく担当することを意味します。

例：
- 月曜日のRoute-A → STF-001, STF-003, STF-004が週ごとに交代
- 火曜日のRoute-B → STF-001, STF-003, STF-004が週ごとに交代
- 各スタッフが特定の曜日・ルートに偏らないようにバランス配置

【割り当て基準（優先順位順）】
1. **曜日×ルートのパターンで均等配置**: 各スタッフが様々な曜日とルートを担当できるようにする
2. **規定の目標比率に概ね近づける**: 全体の割り当て件数が目標比率に近づくようにする（厳密でなくてOK）
3. **同じ日の同じルートは同じスタッフ**: 1日の中では同じルートは同じスタッフが担当
4. **利用者との継続性**: 可能であれば先月と同じスタッフを優先（ただし均等性を優先）

【規定の目標比率】
`;

  // 目標比率
  if (CONFIG.STAFF_ASSIGNMENT_RATIO && Object.keys(CONFIG.STAFF_ASSIGNMENT_RATIO).length > 0) {
    for (const staffId in CONFIG.STAFF_ASSIGNMENT_RATIO) {
      const ratio = CONFIG.STAFF_ASSIGNMENT_RATIO[staffId];
      const percentage = (ratio * 100).toFixed(1);
      prompt += `- ${staffId}: ${percentage}%\n`;
    }
  } else {
    prompt += `（設定なし - 完全均等を目指す）\n`;
  }

  // 先月の実績
  prompt += `\n【先月の訪問実績】\n`;
  const staffIds = Object.keys(lastMonthStats.staffVisits).sort();
  const lastMonthTotal = lastMonthStats.totalVisits;
  staffIds.forEach(staffId => {
    const count = lastMonthStats.staffVisits[staffId];
    const percentage = lastMonthTotal > 0 ? ((count / lastMonthTotal) * 100).toFixed(1) : 0;
    prompt += `- ${staffId}: ${count}件 (${percentage}%)\n`;
  });

  // 各スケジュールの情報（曜日別にグループ化）
  prompt += `\n【割り当て対象スケジュール（曜日別）】\n`;

  // 曜日別にグループ化
  const dayOfWeekNames = ['日', '月', '火', '水', '木', '金', '土'];
  const schedulesByDayOfWeek = {};

  visitGroups.forEach((group) => {
    const date = new Date(group.visitDate);
    const dayOfWeek = dayOfWeekNames[date.getDay()];
    if (!schedulesByDayOfWeek[dayOfWeek]) {
      schedulesByDayOfWeek[dayOfWeek] = [];
    }
    schedulesByDayOfWeek[dayOfWeek].push(group);
  });

  // 曜日ごとに表示
  dayOfWeekNames.forEach(dayName => {
    if (schedulesByDayOfWeek[dayName] && schedulesByDayOfWeek[dayName].length > 0) {
      prompt += `\n### ${dayName}曜日（${schedulesByDayOfWeek[dayName].length}件）\n`;

      schedulesByDayOfWeek[dayName].forEach((group, index) => {
        prompt += `${index + 1}. ${group.key} - ルート:${group.routeTag}, 利用可能:${group.availableStaff.map(s => s.staffId).join(',')}`;
        if (group.preferredStaffId) {
          prompt += `, 先月:${group.preferredStaffId}`;
        }
        prompt += `\n`;
      });
    }
  });

  prompt += `\n【配置のポイント】
- 各曜日で、各スタッフがなるべく均等にルートを担当すること
- 例: 月曜日に4つのルートがある場合、STF-001, STF-003, STF-004が偏りなく担当
- 火曜日、水曜日なども同様に各スタッフが様々なルートを担当
- 特定のスタッフが特定の曜日・ルートに集中しないようにバランス配置

【出力形式】
以下のJSON形式で出力してください。説明は不要です。

\`\`\`json
{
  "assignments": [
    {
      "scheduleId": "スケジュールID（例: 2025-11-01|Route-A）",
      "staffId": "割り当てるスタッフID（例: STF-001）",
      "reason": "選択理由（簡潔に）"
    }
  ]
}
\`\`\`

【重要な制約】
- 全${visitGroups.length}件のスケジュールに対して割り当てを行ってください
- 利用可能なスタッフの中から必ず選択してください
- 同じ日の同じルートは同じスタッフに割り当ててください

【最優先事項】
1. 曜日×ルートのパターンで各スタッフが均等に配置されること
2. 全体の割り当て件数が目標比率（STF-001:10%, STF-003:40%, STF-004:50%）に概ね近いこと
3. 特定のスタッフが特定の曜日やルートに偏らないこと`;

  return prompt;
}

/**
 * バッチレスポンスをパース
 * @param {string} responseText - APIレスポンステキスト
 * @param {Array} visitGroups - 訪問グループ
 * @return {Object} {key: staffId}
 */
function parseBatchAssignmentResponse(responseText, visitGroups) {
  // JSONブロック抽出
  let jsonText = responseText;
  const jsonBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    jsonText = jsonBlockMatch[1];
  } else {
    const codeBlockMatch = responseText.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }
  }

  // JSONパース
  let jsonData;
  try {
    jsonData = JSON.parse(jsonText.trim());
  } catch (e) {
    throw new Error(`JSONパースエラー: ${e.message}\nレスポンス: ${responseText.substring(0, 500)}`);
  }

  // 割り当て結果を抽出
  const assignments = {};
  if (jsonData.assignments && Array.isArray(jsonData.assignments)) {
    jsonData.assignments.forEach(assignment => {
      if (assignment.scheduleId && assignment.staffId) {
        assignments[assignment.scheduleId] = assignment.staffId;
      }
    });
  }

  // 欠落している割り当てをフォールバックで補完
  visitGroups.forEach(group => {
    if (!assignments[group.key] && group.availableStaff.length > 0) {
      assignments[group.key] = group.availableStaff[0].staffId;
    }
  });

  return assignments;
}

/**
 * Vertex AIを使って最適なスタッフを選択（個別処理・非推奨）
 * @deprecated バッチ処理（assignStaffWithVertexAIBatch）を使用してください
 * @param {Array} availableStaff - 利用可能なスタッフリスト [{staffId: 'STF-001'}, ...]
 * @param {string} preferredStaffId - 優先スタッフID（先月最も訪問したスタッフ）
 * @param {Object} lastMonthStats - 先月の訪問統計
 * @param {Object} currentMonthAssignments - 今月の割り当て状況 {staffId: 件数}
 * @param {string} routeTag - ルートタグ
 * @param {string} clientId - 利用者ID
 * @param {GASLogger} logger - ロガーインスタンス（コスト記録用）
 * @return {string} 選択されたスタッフID
 */
function selectStaffWithVertexAI(availableStaff, preferredStaffId, lastMonthStats, currentMonthAssignments, routeTag, clientId, logger) {

  // 利用可能なスタッフが1人だけの場合はそのまま返す
  if (availableStaff.length === 1) {
    return availableStaff[0].staffId;
  }

  // 利用可能なスタッフがいない場合はnull
  if (availableStaff.length === 0) {
    return null;
  }

  // プロンプト構築
  const prompt = buildStaffSelectionPrompt(
    availableStaff,
    preferredStaffId,
    lastMonthStats,
    currentMonthAssignments,
    routeTag,
    clientId
  );

  try {
    // Vertex AI API直接呼び出し（コスト追跡付き）
    const result = callVertexAIForTextGeneration(prompt, CONFIG.VERTEX_AI_MODEL, logger);

    // レスポンスからスタッフIDを抽出
    const selectedStaffId = extractStaffIdFromResponse(result.text, availableStaff);

    logger.info(`[Vertex AI] 選択: ${selectedStaffId} (候補: ${availableStaff.map(s => s.staffId).join(', ')})`);

    return selectedStaffId || availableStaff[0].staffId; // フォールバック

  } catch (error) {
    logger.warning(`[Vertex AI] エラー: ${error.message}、最初の候補を使用します`);
    return availableStaff[0].staffId; // エラー時はフォールバック
  }
}

/**
 * スタッフ選択用プロンプトを構築
 */
function buildStaffSelectionPrompt(availableStaff, preferredStaffId, lastMonthStats, currentMonthAssignments, routeTag, clientId) {
  let prompt = `あなたは訪問看護のスタッフ配置を最適化するAIアシスタントです。

【目的】
訪問スケジュールにスタッフを割り当てる際、以下の基準で最適なスタッフを1名選択してください：
1. 先月と今月の合計訪問件数が概ね均等になること
2. 今月内でもある程度均等な配置になること
3. 規定の目標比率に概ね近づくこと（厳密でなくてOK）
4. 利用者との継続性（可能であれば同じスタッフ）

【規定の目標比率】
`;

  // 目標比率を表示
  if (CONFIG.STAFF_ASSIGNMENT_RATIO && Object.keys(CONFIG.STAFF_ASSIGNMENT_RATIO).length > 0) {
    for (const staffId in CONFIG.STAFF_ASSIGNMENT_RATIO) {
      const ratio = CONFIG.STAFF_ASSIGNMENT_RATIO[staffId];
      const percentage = (ratio * 100).toFixed(1);
      prompt += `- ${staffId}: ${percentage}%\n`;
    }
  } else {
    prompt += `（設定なし - 完全均等を目指す）\n`;
  }

  prompt += `\n【先月の訪問実績】\n`;

  // 先月の訪問件数
  const staffIds = Object.keys(lastMonthStats.staffVisits).sort();
  const lastMonthTotal = lastMonthStats.totalVisits;
  staffIds.forEach(staffId => {
    const count = lastMonthStats.staffVisits[staffId];
    const percentage = lastMonthTotal > 0 ? ((count / lastMonthTotal) * 100).toFixed(1) : 0;
    prompt += `- ${staffId}: ${count}件 (${percentage}%)\n`;
  });

  prompt += `\n【今月の割り当て状況（これまでの累計）】\n`;

  // 今月の割り当て状況
  let currentMonthTotal = 0;
  for (const staffId in currentMonthAssignments) {
    currentMonthTotal += currentMonthAssignments[staffId] || 0;
  }

  for (const staffId in currentMonthAssignments) {
    const count = currentMonthAssignments[staffId] || 0;
    const percentage = currentMonthTotal > 0 ? ((count / currentMonthTotal) * 100).toFixed(1) : 0;
    prompt += `- ${staffId}: ${count}件 (${percentage}%)\n`;
  }

  prompt += `\n【今回の訪問情報】\n`;
  prompt += `- 利用者ID: ${clientId}\n`;
  prompt += `- ルートカテゴリ: ${routeTag}\n`;
  if (preferredStaffId) {
    prompt += `- 先月の主担当: ${preferredStaffId}\n`;
  }

  prompt += `\n【利用可能なスタッフ（今回割り当て可能）】\n`;
  availableStaff.forEach(staff => {
    const lastMonthCount = lastMonthStats.staffVisits[staff.staffId] || 0;
    const currentCount = currentMonthAssignments[staff.staffId] || 0;
    const total = lastMonthCount + currentCount;
    const targetRatio = CONFIG.STAFF_ASSIGNMENT_RATIO[staff.staffId];
    const ratioInfo = targetRatio ? ` (目標比率: ${(targetRatio * 100).toFixed(1)}%)` : '';
    prompt += `- ${staff.staffId}: 先月${lastMonthCount}件 + 今月${currentCount}件 = 合計${total}件${ratioInfo}\n`;
  });

  prompt += `\n【判断基準】
最も適切なスタッフを選択する際は：
- 先月と今月の合計が最も少ないスタッフを優先
- ただし、目標比率から大きく外れないように配慮
- 利用者との継続性も考慮（同じスタッフなら+5%の優先度）

【出力形式】
スタッフIDのみを出力してください。理由の説明は不要です。
例: STF-001

選択するスタッフID:`;

  return prompt;
}

/**
 * Vertex AIのレスポンスからスタッフIDを抽出
 */
function extractStaffIdFromResponse(response, availableStaff) {
  const text = response.trim();

  // 利用可能なスタッフIDリスト
  const availableStaffIds = availableStaff.map(s => s.staffId);

  // レスポンステキストから最初に見つかったスタッフIDを返す
  for (const staffId of availableStaffIds) {
    if (text.includes(staffId)) {
      return staffId;
    }
  }

  // 見つからない場合はnull
  return null;
}

/**
 * Vertex AI APIでテキスト生成（コスト追跡付き）
 * @param {string} prompt - プロンプトテキスト
 * @param {string} model - モデル名
 * @param {GASLogger} logger - ロガーインスタンス
 * @return {Object} {text: 生成されたテキスト, usageMetadata: 使用量情報}
 */
function callVertexAIForTextGeneration(prompt, model, logger) {
  // エンドポイントURL構築
  const endpoint = `https://${CONFIG.GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${CONFIG.GCP_PROJECT_ID}/locations/${CONFIG.GCP_LOCATION}/publishers/google/models/${model}:generateContent`;

  // リクエストボディ構築
  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 500,
      topP: 0.95,
      topK: 40
    }
  };

  // API呼び出しオプション
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    headers: {
      'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
    },
    muteHttpExceptions: true
  };

  // API実行
  logger.info(`[Vertex AI] API呼び出し開始（モデル: ${model}）`);
  const response = UrlFetchApp.fetch(endpoint, options);
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  // ステータスコードチェック
  if (statusCode !== 200) {
    throw new Error(`Vertex AI APIエラー (HTTP ${statusCode}): ${responseText}`);
  }

  // JSONパース
  const jsonResponse = JSON.parse(responseText);

  // コンテンツ抽出
  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0 ||
      !jsonResponse.candidates[0].content || !jsonResponse.candidates[0].content.parts ||
      jsonResponse.candidates[0].content.parts.length === 0) {
    const finishReason = jsonResponse.candidates?.[0]?.finishReason || 'UNKNOWN';
    throw new Error(`Vertex AIレスポンスにコンテンツがありません（finishReason: ${finishReason}）`);
  }

  const generatedText = jsonResponse.candidates[0].content.parts[0].text.trim();

  // usageMetadataを抽出してコスト計算
  const usageMetadata = extractVertexAIUsageMetadata(jsonResponse, model, 'text');

  if (usageMetadata) {
    // ロガーにコスト情報を記録
    logger.setUsageMetadata(usageMetadata);
    logger.info(`[Vertex AI] Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(4)}`);
  }

  return {
    text: generatedText,
    usageMetadata: usageMetadata
  };
}

/**
 * Vertex AI APIでJSON生成（バッチ処理用・コスト追跡付き）
 * @param {string} prompt - プロンプトテキスト
 * @param {string} model - モデル名
 * @param {GASLogger} logger - ロガーインスタンス
 * @return {Object} {text: 生成されたテキスト, usageMetadata: 使用量情報}
 */
function callVertexAIForJSONGeneration(prompt, model, logger) {
  // エンドポイントURL構築
  const endpoint = `https://${CONFIG.GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${CONFIG.GCP_PROJECT_ID}/locations/${CONFIG.GCP_LOCATION}/publishers/google/models/${model}:generateContent`;

  // リクエストボディ構築（バッチ処理用に大きめのトークン数）
  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
      maxOutputTokens: 16384,  // バッチ処理用に十分大きく
      topP: 0.95,
      topK: 40
    }
  };

  // API呼び出しオプション
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    headers: {
      'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
    },
    muteHttpExceptions: true
  };

  // API実行
  logger.info(`[Vertex AI Batch] API呼び出し開始（モデル: ${model}, JSON形式）`);
  const response = UrlFetchApp.fetch(endpoint, options);
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  // ステータスコードチェック
  if (statusCode !== 200) {
    throw new Error(`Vertex AI APIエラー (HTTP ${statusCode}): ${responseText}`);
  }

  // JSONパース
  const jsonResponse = JSON.parse(responseText);

  // コンテンツ抽出
  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0 ||
      !jsonResponse.candidates[0].content || !jsonResponse.candidates[0].content.parts ||
      jsonResponse.candidates[0].content.parts.length === 0) {
    const finishReason = jsonResponse.candidates?.[0]?.finishReason || 'UNKNOWN';
    throw new Error(`Vertex AIレスポンスにコンテンツがありません（finishReason: ${finishReason}）`);
  }

  const generatedText = jsonResponse.candidates[0].content.parts[0].text.trim();

  // usageMetadataを抽出してコスト計算
  const usageMetadata = extractVertexAIUsageMetadata(jsonResponse, model, 'text');

  if (usageMetadata) {
    // ロガーにコスト情報を記録
    logger.setUsageMetadata(usageMetadata);
    logger.info(`[Vertex AI Batch] Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(4)}`);
  }

  return {
    text: generatedText,
    usageMetadata: usageMetadata
  };
}

/**
 * Vertex AI APIレスポンスからusageMetadataを抽出（日本円計算）
 * @note 為替レートはgemini_client.gsのEXCHANGE_RATE_USD_TO_JPYを使用
 * @param {Object} jsonResponse - APIレスポンス
 * @param {string} modelName - 使用したモデル名
 * @param {string} inputType - 入力タイプ ('audio' | 'text')
 * @return {Object|null} {inputTokens, outputTokens, inputCostJPY, outputCostJPY, totalCostJPY, model}
 */
function extractVertexAIUsageMetadata(jsonResponse, modelName, inputType = 'text') {
  if (!jsonResponse.usageMetadata) {
    return null;
  }

  const usage = jsonResponse.usageMetadata;
  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = usage.candidatesTokenCount || 0;

  // モデル名と入力タイプに応じた価格を取得
  const pricing = getVertexAIPricing(modelName, inputType);
  const inputCostUSD = (inputTokens / 1000000) * pricing.inputPer1M;
  const outputCostUSD = (outputTokens / 1000000) * pricing.outputPer1M;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  // 日本円に換算
  const inputCostJPY = inputCostUSD * EXCHANGE_RATE_USD_TO_JPY;
  const outputCostJPY = outputCostUSD * EXCHANGE_RATE_USD_TO_JPY;
  const totalCostJPY = totalCostUSD * EXCHANGE_RATE_USD_TO_JPY;

  return {
    model: modelName,
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    inputCostJPY: inputCostJPY,
    outputCostJPY: outputCostJPY,
    totalCostJPY: totalCostJPY
  };
}

/**
 * Vertex AIモデルの価格情報を取得（モデル名と入力タイプに応じて動的に決定）
 * @param {string} modelName - モデル名
 * @param {string} inputType - 入力タイプ ('audio' | 'text')
 * @return {Object} {inputPer1M, outputPer1M}
 */
function getVertexAIPricing(modelName, inputType = 'text') {
  // 2025年1月時点のVertex AI価格（USD/100万トークン）
  const pricingTable = {
    'gemini-2.5-flash': {
      text: { inputPer1M: 0.075, outputPer1M: 0.30 },
      audio: { inputPer1M: 1.00, outputPer1M: 2.50 }
    },
    'gemini-2.5-pro': {
      text: { inputPer1M: 1.25, outputPer1M: 10.00 },
      audio: { inputPer1M: 1.25, outputPer1M: 10.00 }
    },
    'gemini-2.5-flash-lite': {
      text: { inputPer1M: 0.10, outputPer1M: 0.40 },
      audio: { inputPer1M: 0.10, outputPer1M: 0.40 }
    }
  };

  // モデル名を正規化（バージョン番号削除）
  const normalizedModelName = modelName.toLowerCase().replace(/-\d{3}$/, '');

  // モデルが見つからない場合はデフォルト価格を使用
  if (!pricingTable[normalizedModelName]) {
    return pricingTable['gemini-2.5-flash'][inputType] || pricingTable['gemini-2.5-flash']['text'];
  }

  // 入力タイプが見つからない場合はテキスト価格を使用
  if (!pricingTable[normalizedModelName][inputType]) {
    return pricingTable[normalizedModelName]['text'];
  }

  return pricingTable[normalizedModelName][inputType];
}
