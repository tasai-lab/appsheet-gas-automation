/**
 * 設定ファイル - Appsheet_訪問看護_報告書
 *
 * このファイルには、報告書生成に必要な全ての設定を定義します
 * 環境に応じて値を変更してください
 */

// ===================================
// Gemini API 設定
// ===================================
const GEMINI_CONFIG = {
  apiKey: "AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY",
  model: 'gemini-2.5-pro',
  temperature: 0.2,
  maxOutputTokens: 8192
};

// ===================================
// AppSheet 設定
// ===================================
const APPSHEET_CONFIG = {
  appId: 'f40c4b11-b140-4e31-a60c-600f3c9637c8',
  accessKey: 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY',
  tableName: 'VN_Reports'
};

// ===================================
// 通知設定
// ===================================
const NOTIFICATION_CONFIG = {
  errorEmail: 't.asai@fractal-group.co.jp',
  enableSlackNotification: false,
  slackWebhookUrl: ''
};

// ===================================
// スプレッドシート設定
// ===================================
const SPREADSHEET_CONFIG = {
  executionLogId: '15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE',
  sheetName: '実行履歴'
};

// ===================================
// システム設定
// ===================================
const SYSTEM_CONFIG = {
  debugMode: false,
  enableDuplicationCheck: true,

  // タイムアウト設定(ミリ秒)
  timeout: {
    geminiAPI: 120000,
    appSheetAPI: 30000
  }
};

// ===================================
// ログレベル定義
// ===================================
const LOG_LEVEL = {
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR'
};

// ===================================
// AppSheetフィールドマッピング
// ===================================
const APPSHEET_FIELD_MAPPING = {
  reportId: 'report_id',
  status: 'status',
  symptomProgress: 'symptom_progress',
  errorDetails: 'error_details',
  updatedBy: 'updated_by'
};
