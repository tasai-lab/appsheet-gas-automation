/**
 * 設定ファイル
 * プロジェクト全体で使用する定数と設定を管理
 *
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-22
 */

// =============================================================================
// スプレッドシート設定
// =============================================================================

/**
 * スプレッドシートID
 * @constant {string}
 */
const SPREADSHEET_ID = '11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc';

/**
 * マスタースケジュールシート名
 * @constant {string}
 */
const MASTER_SHEET_NAME = 'Schedule_Master';

/**
 * 生成された予定シート名
 * @constant {string}
 */
const PLAN_SHEET_NAME = 'Schedule_Plan';

// =============================================================================
// AppSheet API設定
// =============================================================================

/**
 * AppSheetアプリケーションID
 * @constant {string}
 */
const APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';

/**
 * AppSheetアクセスキー
 * @constant {string}
 */
const ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';

/**
 * AppSheet マスターテーブル名
 * @constant {string}
 */
const MASTER_TABLE_NAME = 'Schedule_Master';

/**
 * AppSheet 予定テーブル名
 * @constant {string}
 */
const PLAN_TABLE_NAME = 'Schedule_Plan';

/**
 * AppSheet API ベースURL
 * @constant {string}
 */
const APPSHEET_API_BASE_URL = 'https://api.appsheet.com/api/v2/apps';

// =============================================================================
// プロジェクト設定
// =============================================================================

/**
 * プロジェクト名
 * @constant {string}
 */
const PROJECT_NAME = 'Appsheet_訪問看護_定期スケジュール';

/**
 * デフォルト作成者ID
 * @constant {string}
 */
const DEFAULT_CREATOR_ID = 'system';

/**
 * タイムゾーン
 * @constant {string}
 */
const TIMEZONE = 'JST';

/**
 * ロケール
 * @constant {string}
 */
const LOCALE = 'ja-JP';

// =============================================================================
// ステータス定数
// =============================================================================

/**
 * マスターデータのステータス
 * @enum {string}
 */
const MasterStatus = {
  PENDING: '未処理',
  PROCESSING: '処理中',
  COMPLETED: '完了',
  ERROR: 'エラー'
};

/**
 * 予定のステータス
 * @enum {string}
 */
const PlanStatus = {
  UNCONFIRMED: '未確定',
  CONFIRMED: '確定',
  CANCELLED: 'キャンセル'
};

// =============================================================================
// 頻度設定
// =============================================================================

/**
 * スケジュール頻度
 * @enum {string}
 */
const Frequency = {
  WEEKLY: '毎週',
  BIWEEKLY: '隔週',
  MONTHLY: '毎月'
};

// =============================================================================
// 曜日設定
// =============================================================================

/**
 * 曜日マッピング（1=月曜、7=日曜）
 * @enum {number}
 */
const DayOfWeek = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
};

/**
 * 曜日名（日本語）
 * @constant {string[]}
 */
const DAY_NAMES_JA = ['日', '月', '火', '水', '木', '金', '土'];

// =============================================================================
// パフォーマンス設定
// =============================================================================

/**
 * API呼び出し間隔（ミリ秒）
 * レート制限対策
 * @constant {number}
 */
const API_CALL_DELAY_MS = 1000;

/**
 * 最大リトライ回数
 * @constant {number}
 */
const MAX_RETRY_COUNT = 3;

/**
 * デフォルト適用期間（日数）
 * apply_end_dateが未指定の場合
 * @constant {number}
 */
const DEFAULT_APPLY_PERIOD_DAYS = 90;

// =============================================================================
// デバッグ設定
// =============================================================================

/**
 * デバッグモード
 * trueの場合、詳細ログを出力
 * @constant {boolean}
 */
const DEBUG_MODE = false;

/**
 * パフォーマンス計測モード
 * trueの場合、実行時間を計測
 * @constant {boolean}
 */
const PERFORMANCE_MODE = false;

/**
 * ドライランモード
 * trueの場合、実際の更新を行わない
 * @constant {boolean}
 */
const DRY_RUN_MODE = false;

// =============================================================================
// ログレベル
// =============================================================================

/**
 * ログレベル
 * @enum {string}
 */
const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS'
};

// =============================================================================
// 設定取得関数
// =============================================================================

/**
 * 設定オブジェクトを取得
 * @returns {Object} 全設定オブジェクト
 */
function getConfig() {
  return {
    spreadsheet: {
      id: SPREADSHEET_ID,
      masterSheetName: MASTER_SHEET_NAME,
      planSheetName: PLAN_SHEET_NAME
    },
    appsheet: {
      appId: APP_ID,
      accessKey: ACCESS_KEY,
      masterTableName: MASTER_TABLE_NAME,
      planTableName: PLAN_TABLE_NAME,
      baseUrl: APPSHEET_API_BASE_URL
    },
    project: {
      name: PROJECT_NAME,
      defaultCreatorId: DEFAULT_CREATOR_ID,
      timezone: TIMEZONE,
      locale: LOCALE
    },
    performance: {
      apiCallDelayMs: API_CALL_DELAY_MS,
      maxRetryCount: MAX_RETRY_COUNT,
      defaultApplyPeriodDays: DEFAULT_APPLY_PERIOD_DAYS
    },
    debug: {
      debugMode: DEBUG_MODE,
      performanceMode: PERFORMANCE_MODE,
      dryRunMode: DRY_RUN_MODE
    }
  };
}

/**
 * デバッグモードを有効化
 */
function enableDebugMode() {
  Logger.log('[CONFIG] デバッグモードを有効化しました');
  // グローバル定数は変更できないため、PropertiesServiceを使用
  PropertiesService.getScriptProperties().setProperty('DEBUG_MODE', 'true');
}

/**
 * デバッグモードを無効化
 */
function disableDebugMode() {
  Logger.log('[CONFIG] デバッグモードを無効化しました');
  PropertiesService.getScriptProperties().deleteProperty('DEBUG_MODE');
}

/**
 * デバッグモードの状態を取得
 * @returns {boolean}
 */
function isDebugMode() {
  const prop = PropertiesService.getScriptProperties().getProperty('DEBUG_MODE');
  return DEBUG_MODE || prop === 'true';
}
