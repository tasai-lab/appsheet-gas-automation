/**
 * 設定ファイル
 * Appsheet_通話_スレッド投稿プロジェクトの設定を管理
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-18
 */

// ==================================================================
// AppSheet API設定
// ==================================================================

const APPSHEET_CONFIG = {
  APP_ID: '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f',
  ACCESS_KEY: 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT',
  TABLE_NAME: 'Call_Queries',
  API_ENDPOINT: 'https://api.appsheet.com/api/v2/apps'
};

// ==================================================================
// Google Chat API設定
// ==================================================================

const CHAT_CONFIG = {
  API_ENDPOINT: 'https://chat.googleapis.com/v1',
  MESSAGE_REPLY_OPTION: 'REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD',
  SCOPES: ['https://www.googleapis.com/auth/chat.messages']
};

// ==================================================================
// OAuth2設定
// ==================================================================

const OAUTH_CONFIG = {
  SERVICE_ACCOUNT_JSON_KEY: 'SERVICE_ACCOUNT_JSON',
  CALLBACK_FUNCTION: 'authCallback',
  TOKEN_URL: 'https://oauth2.googleapis.com/token'
};

// ==================================================================
// 実行ログ設定
// ==================================================================

const LOGGER_CONFIG = {
  logFolderId: '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX',
  scriptName: 'Appsheet_通話_スレッド投稿'
};

// ==================================================================
// ステータス定義
// ==================================================================

const STATUS = {
  COMPLETED: '完了',
  ERROR: 'エラー',
  PROCESSING: '処理中'
};

/**
 * 設定を取得
 * @returns {Object} - 設定オブジェクト
 */
function getConfig() {
  return {
    appsheet: APPSHEET_CONFIG,
    chat: CHAT_CONFIG,
    oauth: OAUTH_CONFIG,
    logger: LOGGER_CONFIG,
    status: STATUS
  };
}
