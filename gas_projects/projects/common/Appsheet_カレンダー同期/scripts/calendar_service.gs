/**
 * カレンダーサービスモジュール - Appsheet_カレンダー同期
 * Googleカレンダーのイベント同期とデータ処理
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-27
 */

/**
 * カレンダーイベントを同期する
 * @param {string} calendarId - カレンダーID（通常はメールアドレス）
 */
function syncCalendarEvents(calendarId) {
  // ユーザーごとの設定のため、UserPropertiesを使用
  const properties = PropertiesService.getUserProperties();
  const syncTokenKey = CONFIG.SYNC_TOKEN_PREFIX + calendarId;
  let syncToken = properties.getProperty(syncTokenKey);
  let pageToken = null;
  let events = [];
  let eventList;

  do {
    try {
      const options = {
        maxResults: 1000,
        showDeleted: true,
        singleEvents: true,
        pageToken: pageToken
      };

      if (syncToken) {
        options.syncToken = syncToken;
      }

      eventList = Calendar.Events.list(calendarId, options);

      if (eventList.items && eventList.items.length > 0) {
        events = events.concat(eventList.items);
      }
      pageToken = eventList.nextPageToken;

    } catch (e) {
      if (e.message.includes("Sync token is invalid") || e.message.includes("full sync")) {
        console.warn('Sync tokenが無効です。トークンをリセットします。');
        properties.deleteProperty(syncTokenKey);
        syncToken = null;
        pageToken = null;
        events = [];
        eventList = null;
        continue;
      }
      throw e;
    }
  } while (pageToken);

  if (events.length > 0) {
    processEventChanges(calendarId, events);
  }

  if (eventList && eventList.nextSyncToken) {
    properties.setProperty(syncTokenKey, eventList.nextSyncToken);
  }
}

/**
 * 変更されたイベントを処理する
 * @param {string} calendarId - カレンダーID
 * @param {Array} events - イベント配列
 */
function processEventChanges(calendarId, events) {
  const { logSheet, planSheet, planColMap } = getSheetsAndColumns();
  const staffMap = getStaffMap();

  const now = new Date();

  // 処理対象期間の計算
  // 1. 未来の上限
  const TIME_LIMIT_AHEAD = new Date(now.getTime());
  TIME_LIMIT_AHEAD.setFullYear(TIME_LIMIT_AHEAD.getFullYear() + CONFIG.PROCESS_WINDOW_YEARS_AHEAD);

  // 2. 過去の下限
  const TIME_LIMIT_PAST = new Date(now.getTime());
  TIME_LIMIT_PAST.setDate(TIME_LIMIT_PAST.getDate() - CONFIG.PROCESS_WINDOW_DAYS_PAST);
  TIME_LIMIT_PAST.setHours(0, 0, 0, 0);

  const executorEmail = Session.getActiveUser().getEmail();
  const executorIdentifier = staffMap.get(executorEmail.toLowerCase()) || executorEmail;

  // 1. 予備フィルタリングとID収集
  const preliminaryEvents = [];
  const eventIdsToSearch = new Set();

  for (const event of events) {
    const eventId = extractEventId(event);
    const changeType = determineChangeType(event);

    // 新規作成は除外
    if (changeType === 'CREATED') continue;

    // 更新(UPDATED)イベントの期間チェック
    if (changeType === 'UPDATED') {
      const eventStartTime = getEventDate(event.start);
      if (!eventStartTime || eventStartTime > TIME_LIMIT_AHEAD || eventStartTime < TIME_LIMIT_PAST) {
        continue;
      }
    }

    preliminaryEvents.push({ event, eventId, changeType });
    eventIdsToSearch.add(eventId);
  }

  if (preliminaryEvents.length === 0) {
    return;
  }

  // 2. 必要なPlanデータのみを取得
  const planMap = findPlanDataByIds(planSheet, Array.from(eventIdsToSearch), planColMap);

  const logEntriesMap = new Map();
  const appSheetUpdateRows = [];

  // 3. 処理と最終判定
  for (const { event, eventId, changeType } of preliminaryEvents) {
    const planInfo = planMap.get(eventId);
    if (!planInfo) continue; // Schedule_Planに存在しない場合は処理しない

    const oldData = planInfo.data;
    const planId = oldData[planColMap.get(CONFIG.PLAN_HEADERS.plan_id)];

    // 削除(DELETED)イベントの期間チェック
    if (changeType === 'DELETED') {
      const oldStartVal = oldData[planColMap.get(CONFIG.PLAN_HEADERS.gcal_start_time)];
      let eventStartTime = null;
      if (isValidDate(oldStartVal)) {
        eventStartTime = new Date(oldStartVal);
      }

      if (!eventStartTime || eventStartTime < TIME_LIMIT_PAST) {
        continue;
      }
    }

    let syncStatus = 'N/A';

    if (changeType !== 'DELETED') {
      syncStatus = 'Pending';
      const updateRow = prepareAppSheetUpdateRow(planId, event, executorIdentifier, now);
      if (updateRow) {
        appSheetUpdateRows.push(updateRow);
      } else {
        syncStatus = 'Skipped (Data Error)';
      }
    } else {
      syncStatus = 'N/A (Deleted)';
    }

    const logEntry = createLogEntry(
      calendarId, event, changeType, executorIdentifier,
      oldData, planId, now, planColMap, syncStatus
    );

    if (!logEntriesMap.has(planId)) {
      logEntriesMap.set(planId, []);
    }
    logEntriesMap.get(planId).push(logEntry);
  }

  // 4. AppSheet API呼び出し（共通モジュールのappsheet_clientを使用）
  if (appSheetUpdateRows.length > 0) {
    try {
      // TODO: AppSheetクライアントを使用して更新
      // 既存のAppSheetSecureConnectorライブラリの代わりに、共通モジュールを使用する場合は、
      // ライブラリの設定情報（APP_ID, ACCESS_KEY）をconfig.gsに追加する必要があります

      // 暫定: 既存のライブラリを使用
      const results = AppSheetSecureConnector.updateAppSheetPlanTable(appSheetUpdateRows);

      // 結果をログに反映
      results.forEach(result => {
        if (logEntriesMap.has(result.planId)) {
          logEntriesMap.get(result.planId).forEach(logEntry => {
            logEntry[logEntry.length - 1] = result.status;
          });
        }
      });
    } catch (error) {
      console.error(`AppSheet更新エラー: ${error.message}`);
      // エラー時はログに記録
      appSheetUpdateRows.forEach(row => {
        const planId = row[CONFIG.PLAN_HEADERS.plan_id];
        if (logEntriesMap.has(planId)) {
          logEntriesMap.get(planId).forEach(logEntry => {
            logEntry[logEntry.length - 1] = `Error: ${error.message}`;
          });
        }
      });
    }
  }

  // 5. ログの書き込み
  const allLogEntries = Array.from(logEntriesMap.values()).flat();
  if (allLogEntries.length > 0) {
    logSheet.getRange(
      logSheet.getLastRow() + 1, 1,
      allLogEntries.length, allLogEntries[0].length
    ).setValues(allLogEntries);
  }
}

/**
 * イベントIDのリストからPlanデータを検索
 * @param {Sheet} planSheet - Schedule_Planシート
 * @param {Array<string>} eventIds - イベントIDの配列
 * @param {Map} planColMap - 列名→列インデックスのマップ
 * @return {Map} イベントID→Planデータのマップ
 */
function findPlanDataByIds(planSheet, eventIds, planColMap) {
  const planMap = new Map();
  const lastRow = planSheet.getLastRow();

  if (eventIds.length === 0 || lastRow < 2) return planMap;

  const eventIdColIndex = planColMap.get(CONFIG.PLAN_HEADERS.gcal_event_id);
  if (eventIdColIndex === undefined) {
    throw new Error(`列「${CONFIG.PLAN_HEADERS.gcal_event_id}」が見つかりません。`);
  }

  const searchColumnRange = planSheet.getRange(2, eventIdColIndex + 1, lastRow - 1, 1);
  const regex = eventIds.map(id => escapeRegExp(String(id))).join('|');

  const finder = searchColumnRange.createTextFinder(regex)
    .matchEntireCell(true)
    .useRegularExpression(true);

  const occurrences = finder.findAll();

  if (occurrences.length > 0) {
    const rangeListA1 = occurrences.map(occ => {
      const row = occ.getRow();
      return `${row}:${row}`;
    });

    const dataRanges = planSheet.getRangeList(rangeListA1).getRanges();

    dataRanges.forEach(range => {
      const rowData = range.getValues()[0];
      const eventId = String(rowData[eventIdColIndex]);
      if (eventId && eventIds.includes(eventId)) {
        planMap.set(eventId, { data: rowData });
      }
    });
  }
  return planMap;
}

/**
 * AppSheet更新用の行データを準備
 * @param {string} planId - プランID
 * @param {Object} event - カレンダーイベント
 * @param {string} updatedBy - 更新者
 * @param {Date} now - 現在時刻
 * @return {Object|null} 更新行データ
 */
function prepareAppSheetUpdateRow(planId, event, updatedBy, now) {
  const newStartTime = getEventDate(event.start);
  const newEndTime = getEventDate(event.end);

  if (!newStartTime || !newEndTime) {
    return null;
  }

  const tz = CONFIG.TIMEZONE;
  const H = CONFIG.PLAN_HEADERS;
  const row = {};

  row[H.plan_id] = planId;
  row[H.visit_date] = Utilities.formatDate(newStartTime, tz, "yyyy/MM/dd");

  let dayOfWeek = parseInt(Utilities.formatDate(newStartTime, tz, 'u'));
  if (dayOfWeek === 7) dayOfWeek = 1; else dayOfWeek += 1;
  row[H.day_of_week] = dayOfWeek;

  row[H.start_time] = Utilities.formatDate(newStartTime, tz, "HH:mm:ss");
  row[H.end_time] = Utilities.formatDate(newEndTime, tz, "HH:mm:ss");
  row[H.duration_minutes] = (newEndTime.getTime() - newStartTime.getTime()) / (1000 * 60);

  row[H.gcal_start_time] = Utilities.formatDate(newStartTime, tz, "yyyy/MM/dd HH:mm:ss");
  row[H.gcal_end_time] = Utilities.formatDate(newEndTime, tz, "yyyy/MM/dd HH:mm:ss");

  row[H.updated_at] = Utilities.formatDate(now, tz, "yyyy/MM/dd HH:mm:ss");
  row[H.updated_by] = `${updatedBy}`;

  return row;
}

/**
 * スタッフマップを取得（メールアドレス→スタッフID）
 * @return {Map} メールアドレス→スタッフIDのマップ
 */
function getStaffMap() {
  if (GLOBAL_CACHE.staffMap) return GLOBAL_CACHE.staffMap;

  const map = new Map();
  const STAFF_CONFIG = CONFIG.STAFF_MASTER;

  try {
    const ss = SpreadsheetApp.openById(STAFF_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(STAFF_CONFIG.SHEET_NAME);
    if (!sheet) throw new Error(`スタッフシート「${STAFF_CONFIG.SHEET_NAME}」が見つかりません。`);

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return map;

    const headers = values.shift();
    const staffIdIndex = headers.indexOf(STAFF_CONFIG.ID_COL);
    const emailIndex = headers.indexOf(STAFF_CONFIG.EMAIL_COL);

    if (staffIdIndex === -1 || emailIndex === -1) {
      throw new Error(`Staff_Membersシートに必須列が見つかりません。`);
    }

    values.forEach(row => {
      const email = String(row[emailIndex]).trim().toLowerCase();
      const staffId = String(row[staffIdIndex]).trim();
      if (email && staffId) {
        map.set(email, staffId);
      }
    });
    GLOBAL_CACHE.staffMap = map;

  } catch (e) {
    console.error(`スタッフ情報の読み込み中にエラー: ${e.message}`);
    throw e;
  }
  return map;
}

/**
 * スプレッドシートとカラムマップを取得
 * @return {Object} { ss, logSheet, planSheet, planColMap }
 */
function getSheetsAndColumns() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let logSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.LOG);
    const planSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PLAN);

    if (!planSheet) throw new Error(`シート「${CONFIG.SHEET_NAMES.PLAN}」が見つかりません。`);

    if (!logSheet) {
      logSheet = ss.insertSheet(CONFIG.SHEET_NAMES.LOG);
      logSheet.getRange(1, 1, 1, CONFIG.LOG_HEADERS.length).setValues([CONFIG.LOG_HEADERS]);
      logSheet.setFrozenRows(1);
    }

    const planHeaders = planSheet.getRange(1, 1, 1, planSheet.getLastColumn()).getValues()[0];
    const planColMap = new Map();
    planHeaders.forEach((header, index) => {
      planColMap.set(header, index);
    });

    return { ss, logSheet, planSheet, planColMap };
  } catch (e) {
    console.error(`スプレッドシートの初期化に失敗しました: ${e.message}`);
    throw e;
  }
}

/**
 * ログエントリーを作成
 * @param {string} calendarId - カレンダーID
 * @param {Object} event - カレンダーイベント
 * @param {string} changeType - 変更タイプ
 * @param {string} detectedBy - 検知者
 * @param {Array} oldData - 旧データ
 * @param {string} planId - プランID
 * @param {Date} now - 現在時刻
 * @param {Map} planColMap - カラムマップ
 * @param {string} syncStatus - 同期ステータス
 * @return {Array} ログエントリー
 */
function createLogEntry(calendarId, event, changeType, detectedBy, oldData, planId, now, planColMap, syncStatus) {
  const eventId = extractEventId(event);
  const title = event.summary || '(タイトルなし)';
  const updatedTimestamp = event.updated ? new Date(event.updated) : '';

  const newStartTime = (changeType !== 'DELETED') ? getEventDate(event.start) : null;
  const newEndTime = (changeType !== 'DELETED') ? getEventDate(event.end) : null;

  let oldStartTime = '';
  let oldEndTime = '';

  if (oldData) {
    const oldStartVal = oldData[planColMap.get(CONFIG.PLAN_HEADERS.gcal_start_time)];
    const oldEndVal = oldData[planColMap.get(CONFIG.PLAN_HEADERS.gcal_end_time)];

    if (isValidDate(oldStartVal)) oldStartTime = new Date(oldStartVal);
    if (isValidDate(oldEndVal)) oldEndTime = new Date(oldEndVal);
  }

  return [
    now,
    calendarId,
    eventId,
    planId || '',
    changeType,
    title,
    oldStartTime,
    oldEndTime,
    (changeType === 'UPDATED') ? (newStartTime || '') : '',
    (changeType === 'UPDATED') ? (newEndTime || '') : '',
    detectedBy,
    updatedTimestamp,
    syncStatus
  ];
}

/**
 * 有効な日付かチェック
 * @param {*} value - チェック対象の値
 * @return {boolean} 有効な日付ならtrue
 */
function isValidDate(value) {
  return value && (value instanceof Date || (typeof value === 'string' && value.length > 0 && !isNaN(Date.parse(value))));
}

/**
 * イベントIDを抽出
 * @param {Object} event - カレンダーイベント
 * @return {string} イベントID
 */
function extractEventId(event) {
  if (event.iCalUID && event.iCalUID.endsWith('@google.com')) {
    return event.iCalUID.replace('@google.com', '');
  }
  return event.id;
}

/**
 * 変更タイプを判定
 * @param {Object} event - カレンダーイベント
 * @return {string} 変更タイプ（CREATED/UPDATED/DELETED）
 */
function determineChangeType(event) {
  if (event.status === 'cancelled') return 'DELETED';
  try {
    const created = new Date(event.created).getTime();
    const updated = new Date(event.updated).getTime();
    if (Math.abs(created - updated) < 5000) return 'CREATED';
  } catch(e) {}
  return 'UPDATED';
}

/**
 * イベントの日時を取得（終日イベントはnull）
 * @param {Object} dateObj - Calendar APIの日時オブジェクト
 * @return {Date|null} 日時オブジェクト
 */
function getEventDate(dateObj) {
  if (!dateObj || !dateObj.dateTime) return null;
  return new Date(dateObj.dateTime);
}

/**
 * 正規表現のエスケープ
 * @param {string} string - エスケープ対象の文字列
 * @return {string} エスケープ済み文字列
 */
function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
