/*******************************************************************************
 * 高度なGoogleカレンダー同期システム (Frontend) - ウェブアプリ対応・セキュア版
/*******************************************************************************/

// =====================================================================================
// 設定 (Configuration)
// =====================================================================================
const CONFIG = {
  // メインのスプレッドシートID
  SPREADSHEET_ID: '11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc',

  // スタッフマスター設定
  STAFF_MASTER: {
    SPREADSHEET_ID: '1F8-HxdTtz4ljW9NVqdLFX3U4mEx3Ux1QOfYCMOBXBB4',
    SHEET_NAME: 'Staff_Members',
    EMAIL_COL: 'email',
    ID_COL: 'staff_id'
  },

  SHEET_NAMES: {
    PLAN: 'Schedule_Plan',
    LOG: 'Event_Audit_Log',
  },
  TIMEZONE: 'Asia/Tokyo',
  SYNC_TOKEN_PREFIX: 'USER_CAL_SYNC_TOKEN_',

  // ★★★ 処理対象期間の設定 ★★★
  PROCESS_WINDOW_YEARS_AHEAD: 1, // 未来1年後まで
  PROCESS_WINDOW_DAYS_PAST: 2,   // 過去2日前まで (今日を含めると3日間)

  // Schedule_Planの列名
  PLAN_HEADERS: {
    plan_id: 'plan_id', gcal_event_id: 'gcal_event_id', visit_date: 'visit_date',
    day_of_week: 'day_of_week', start_time: 'start_time', end_time: 'end_time',
    duration_minutes: 'duration_minutes', gcal_start_time: 'gcal_start_time',
    gcal_end_time: 'gcal_end_time', updated_at: 'updated_at', updated_by: 'updated_by'
  },
  // ログシートのヘッダー
  LOG_HEADERS: [
    'log_timestamp', 'calendar_id', 'event_id', 'plan_id', 'change_type',
    'event_title', 'old_start_time', 'old_end_time', 'new_start_time',
    'new_end_time', 'detected_by', 'api_updated_at', 'appsheet_sync_status'
  ]
};

// グローバルキャッシュ
const GLOBAL_CACHE = {
    staffMap: null
};

// =====================================================================================
// ウェブアプリケーション機能 (Web Application Functions)
// =====================================================================================

/**
 * ウェブアプリとしてアクセスされたときに実行される関数。
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('WebApp.html')
      .setTitle('カレンダー同期システム設定');
}

/**
 * 【Web App】ユーザーの現在の同期状態を確認する。
 */
function checkUserSyncStatusWebApp() {
    const userEmail = Session.getActiveUser().getEmail();
    const trigger = getUserCalendarTrigger();

    return {
        isActive: trigger !== null,
        email: userEmail
    };
}

/**
 * 【Web App】ユーザーが自身のカレンダー同期を有効化する。
 */
function activateUserSyncWebApp() {
  const userEmail = Session.getActiveUser().getEmail();

  try {
    // 1. シートの初期化確認と権限確認 (重要)
    getSheetsAndColumns();
    getStaffMap();

    // 2. 既存のトリガーを確認
    const existingTrigger = getUserCalendarTrigger();

    if (existingTrigger) {
      return { status: 'info', title: '設定済み', message: `あなたのカレンダー (${userEmail}) の同期は既に有効です。`, isActive: true };
    }

    // 3. カレンダートリガーを設定
    ScriptApp.newTrigger('onCalendarChanged')
      .forUserCalendar(userEmail)
      .onEventUpdated()
      .create();

    console.log(`ユーザーが同期を有効化しました (Web App): ${userEmail}`);
    return { status: 'success', title: '✅ 設定完了', message: `あなたのカレンダー (${userEmail}) の同期が有効になりました。<br>予定を変更すると、自動的にログ記録とAppSheet連携が行われます。`, isActive: true };

  } catch (error) {
    console.error(`ユーザー同期の有効化中にエラー (Web App): ${error.message}`);
    // エラーオブジェクトを返す
    return { status: 'error', title: '⚠️ エラー', message: `設定中にエラーが発生しました。必要なスプレッドシートへのアクセス権限（編集権限）があるか確認してください。<br>詳細: ${error.message}`, isActive: false };
  }
}

/**
 * 【Web App】ユーザーが自身のカレンダー同期を無効化する。
 */
function deactivateUserSyncWebApp() {
  const userEmail = Session.getActiveUser().getEmail();
  const trigger = getUserCalendarTrigger();

  if (trigger) {
    // トリガーを削除
    ScriptApp.deleteTrigger(trigger);
    // 同期トークンも削除
    PropertiesService.getUserProperties().deleteProperty(CONFIG.SYNC_TOKEN_PREFIX + userEmail);

    console.log(`ユーザーが同期を無効化しました (Web App): ${userEmail}`);
    return { status: 'success', title: '🛑 設定解除完了', message: `あなたのカレンダー (${userEmail}) の同期を無効化しました。`, isActive: false };
  } else {
    return { status: 'info', title: 'ℹ️ 情報', message: '同期は既に無効です。', isActive: false };
  }
}

// =====================================================================================
// 管理者用機能 (Admin Functions)
// =====================================================================================

/**
 * スプレッドシートが開かれたときに実行され、管理者用メニューを追加する。
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔧 管理者ツール')
    .addItem('承認依頼メールを送信', 'sendAuthorizationEmails')
    .addToUi();
}

/**
 * 【管理者メニュー実行】スタッフに承認依頼メールを送信する。
 */
function sendAuthorizationEmails() {
  const ui = SpreadsheetApp.getUi();

  // ウェブアプリのURLを取得
  const webAppUrl = ScriptApp.getService().getUrl();

  if (!webAppUrl) {
    ui.alert('⚠️ エラー', 'ウェブアプリがまだデプロイされていません。デプロイを実行してください。', ui.ButtonSet.OK);
    return;
  }

  const confirm = ui.alert('確認', 'Staff_Membersに登録されている全スタッフに、ウェブアプリへのリンクを含む承認依頼メールを送信しますか？', ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;

  try {
    const staffMap = getStaffMap();
    const recipients = Array.from(staffMap.keys()); // メールアドレスリスト

    if (recipients.length === 0) {
        ui.alert('情報', '送信対象のスタッフが見つかりませんでした。', ui.ButtonSet.OK);
        return;
    }

    const subject = "【重要・要対応】カレンダー同期システムの利用開始設定のお願い";
    const body = `
スタッフ各位

業務効率化のため、GoogleカレンダーとAppSheet（Schedule_Plan）の自動連携システムを導入しました。
このシステムを利用開始するには、ご自身での設定（権限承認）が必要です。

以下のリンクをクリックし、表示される画面の指示に従って設定を完了してください。

▼設定用リンク（クリックして設定を開始）
${webAppUrl}

手順：
1. 上記リンクをクリックして設定ページを開きます。
2. Googleの認証画面が表示された場合は「許可」を選択します。
3. 「同期を有効化 (Activate)」ボタンをクリックします。
4. 「✅ 設定完了」と表示されれば完了です。

※本システムは、今日から${CONFIG.PROCESS_WINDOW_DAYS_PAST}日前以降の予定変更のみを同期対象とします。

よろしくお願いいたします。
`;

    // メールを送信 (MailAppサービスを使用)
    MailApp.sendEmail({
        to: recipients.join(','),
        subject: subject,
        body: body
    });

    console.log(`承認依頼メールを送信しました。対象者: ${recipients.length}名`);
    ui.alert('送信完了', `${recipients.length}名に承認依頼メールを送信しました。`, ui.ButtonSet.OK);

  } catch (error) {
    console.error(`メール送信中にエラー: ${error.message}`);
    ui.alert('⚠️ エラー', `メール送信中にエラーが発生しました。管理者のメール送信権限を確認してください。\n詳細: ${error.message}`, ui.ButtonSet.OK);
  }
}


// =====================================================================================
// ヘルパーとメイン処理 (Helpers and Main Execution)
// =====================================================================================

/**
 * 現在のユーザーが設定したカレンダートリガーを取得するヘルパー関数。
 */
function getUserCalendarTrigger() {
  // getProjectTriggers() は、実行ユーザーが作成したトリガーのみを返す
  const triggers = ScriptApp.getProjectTriggers();
  const userEmail = Session.getActiveUser().getEmail();

  for (const trigger of triggers) {
    if (trigger.getTriggerSource() === ScriptApp.TriggerSource.CALENDAR &&
        trigger.getHandlerFunction() === 'onCalendarChanged' &&
        trigger.getTriggerSourceId() === userEmail) {
      return trigger;
    }
  }
  return null;
}

/**
 * カレンダー変更トリガーによって呼び出されるメイン関数
 */
function onCalendarChanged(e) {
  if (!e || !e.calendarId) return;
  const calendarId = e.calendarId;

  // 重要: ユーザーごとの実行のため、UserLockを使用する
  const lock = LockService.getUserLock();
  try {
    if (!lock.tryLock(15000)) {
      console.error('ロック取得失敗。同一ユーザーによる処理が重複しています。');
      return;
    }
    // console.log(`カレンダー更新検知・同期開始: ${calendarId}`);
    syncCalendarEvents(calendarId);

  } catch (error) {
    console.error(`同期処理中に致命的なエラーが発生しました: ${error.stack}`);
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
    GLOBAL_CACHE.staffMap = null;
  }
}

// =====================================================================================
// 同期・データ処理ロジック (Sync and Data Processing Logic)
// =====================================================================================

function syncCalendarEvents(calendarId) {
  // 重要: ユーザーごとの設定のため、UserPropertiesを使用
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
 * 変更されたイベントを処理する (期間制限ロジック追加版)
 */
function processEventChanges(calendarId, events) {
  const { logSheet, planSheet, planColMap } = getSheetsAndColumns();
  const staffMap = getStaffMap();

  const now = new Date();

  // --- 処理対象期間の計算 ---
  // 1. 未来の上限
  const TIME_LIMIT_AHEAD = new Date(now.getTime());
  TIME_LIMIT_AHEAD.setFullYear(TIME_LIMIT_AHEAD.getFullYear() + CONFIG.PROCESS_WINDOW_YEARS_AHEAD);

  // 2. 過去の下限 (例: 2日前を指定した場合、その日の00:00:00以降)
  const TIME_LIMIT_PAST = new Date(now.getTime());
  // 指定された日数だけ遡る (スクリプトのタイムゾーン基準で計算される)
  TIME_LIMIT_PAST.setDate(TIME_LIMIT_PAST.getDate() - CONFIG.PROCESS_WINDOW_DAYS_PAST);
  // その日の開始時刻に設定 (JSTの00:00:00)
  TIME_LIMIT_PAST.setHours(0, 0, 0, 0);
  // -------------------------

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
        // 開始時刻が不明（終日など）、または期間外（過去/未来）の場合はスキップ
        if (!eventStartTime || eventStartTime > TIME_LIMIT_AHEAD || eventStartTime < TIME_LIMIT_PAST) {
            continue;
        }
    }

    // 削除(DELETED)イベントはAPIレスポンスに開始時刻がない場合があるため、ここではフィルタリングせず、後で判定する
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

    // ★★★ 削除(DELETED)イベントの期間チェック (ここで実施) ★★★
    // APIレスポンスに時刻がない場合に備え、スプレッドシートの記録を元に判定する
    if (changeType === 'DELETED') {
        // Schedule_Planのデータから元の開始時刻を取得する
        const oldStartVal = oldData[planColMap.get(CONFIG.PLAN_HEADERS.gcal_start_time)];
        let eventStartTime = null;
        if (isValidDate(oldStartVal)) {
            eventStartTime = new Date(oldStartVal);
        }

        // 開始時刻が不明、または過去の制限より前であれば除外
        if (!eventStartTime || eventStartTime < TIME_LIMIT_PAST) {
            // console.log(`過去の制限により除外 (DELETED): ${planId}`);
            continue;
        }
    }
    // ----------------------------------------------------------

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

    const logEntry = createLogEntry(calendarId, event, changeType, executorIdentifier, oldData, planId, now, planColMap, syncStatus);

    if (!logEntriesMap.has(planId)) {
        logEntriesMap.set(planId, []);
    }
    logEntriesMap.get(planId).push(logEntry);
  }


  // 4. AppSheet APIの呼び出し (ライブラリ経由)
  if (appSheetUpdateRows.length > 0) {
    // ★★★ AppSheetSecureConnector はライブラリ追加時に設定した識別子 ★★★
    // ライブラリが正しく設定されていない場合、ここでエラーになります。
    const results = AppSheetSecureConnector.updateAppSheetPlanTable(appSheetUpdateRows);

    // 結果をログに反映
    results.forEach(result => {
        if (logEntriesMap.has(result.planId)) {
            logEntriesMap.get(result.planId).forEach(logEntry => {
                logEntry[logEntry.length - 1] = result.status;
            });
        }
    });
  }

  // 5. ログの書き込み
  const allLogEntries = Array.from(logEntriesMap.values()).flat();
  if (allLogEntries.length > 0) {
    logSheet.getRange(logSheet.getLastRow() + 1, 1, allLogEntries.length, allLogEntries[0].length).setValues(allLogEntries);
  }
}

// =====================================================================================
// ユーティリティとヘルパー関数 (Utilities and Helpers)
// =====================================================================================
// (以下の関数群は変更ありません)

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
    now, calendarId, eventId, planId || '', changeType, title,
    oldStartTime,
    oldEndTime,
    (changeType === 'UPDATED') ? (newStartTime || '') : '',
    (changeType === 'UPDATED') ? (newEndTime || '') : '',
    detectedBy, updatedTimestamp, syncStatus
  ];
}

// その他のヘルパー関数
function isValidDate(value) { return value && (value instanceof Date || (typeof value === 'string' && value.length > 0 && !isNaN(Date.parse(value)))); }
function extractEventId(event) { if (event.iCalUID && event.iCalUID.endsWith('@google.com')) { return event.iCalUID.replace('@google.com', ''); } return event.id; }
function determineChangeType(event) { if (event.status === 'cancelled') return 'DELETED'; try { const created = new Date(event.created).getTime(); const updated = new Date(event.updated).getTime(); if (Math.abs(created - updated) < 5000) return 'CREATED'; } catch(e) {} return 'UPDATED'; }
// Calendar APIのイベント時刻オブジェクトからDateオブジェクトを取得。終日イベントはnull。
function getEventDate(dateObj) { if (!dateObj || !dateObj.dateTime) return null; return new Date(dateObj.dateTime); }
function escapeRegExp(string) { return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }