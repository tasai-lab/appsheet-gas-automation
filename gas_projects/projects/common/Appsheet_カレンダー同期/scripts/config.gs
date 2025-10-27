/**
 * 設定定数 - Appsheet_カレンダー同期
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-27
 */

/**
 * プロジェクト名
 */
const PROJECT_NAME = 'Appsheet_カレンダー同期';

/**
 * メイン設定
 */
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

  // シート名
  SHEET_NAMES: {
    PLAN: 'Schedule_Plan',
    LOG: 'Event_Audit_Log',
  },

  // タイムゾーン
  TIMEZONE: 'Asia/Tokyo',

  // 同期トークンのプレフィックス
  SYNC_TOKEN_PREFIX: 'USER_CAL_SYNC_TOKEN_',

  // 処理対象期間の設定
  PROCESS_WINDOW_YEARS_AHEAD: 1, // 未来1年後まで
  PROCESS_WINDOW_DAYS_PAST: 2,   // 過去2日前まで (今日を含めると3日間)

  // Schedule_Planの列名
  PLAN_HEADERS: {
    plan_id: 'plan_id',
    gcal_event_id: 'gcal_event_id',
    visit_date: 'visit_date',
    day_of_week: 'day_of_week',
    start_time: 'start_time',
    end_time: 'end_time',
    duration_minutes: 'duration_minutes',
    gcal_start_time: 'gcal_start_time',
    gcal_end_time: 'gcal_end_time',
    updated_at: 'updated_at',
    updated_by: 'updated_by'
  },

  // ログシートのヘッダー
  LOG_HEADERS: [
    'log_timestamp',
    'calendar_id',
    'event_id',
    'plan_id',
    'change_type',
    'event_title',
    'old_start_time',
    'old_end_time',
    'new_start_time',
    'new_end_time',
    'detected_by',
    'api_updated_at',
    'appsheet_sync_status'
  ]
};

/**
 * グローバルキャッシュ
 */
const GLOBAL_CACHE = {
  staffMap: null
};
