/**
 * 設定定数モジュール
 *
 * 利用者反映プロジェクトで使用する全ての設定定数を管理
 *
 * @version 1.0.0
 * @date 2025-10-21
 */

// ========================================
// AppSheet設定
// ========================================

/**
 * 依頼情報アプリの設定
 */
const REQUESTS_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';
const REQUESTS_APP_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';

/**
 * 利用者情報アプリの設定
 */
const CLIENTS_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';
const CLIENTS_APP_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';

// ========================================
// テーブル名
// ========================================

const REQUESTS_TABLE_NAME = 'Client_Requests';
const CLIENTS_TABLE_NAME = 'Clients';
const DOCUMENTS_TABLE_NAME = 'Client_Documents';

// ========================================
// Vertex AI設定
// ========================================

const GCP_PROJECT_ID = 'macro-shadow-458705-v8';
const GCP_LOCATION = 'us-central1';
const VERTEX_AI_MODEL = 'gemini-2.5-pro';

/**
 * Vertex AI API設定
 */
const VERTEX_AI_CONFIG = {
  projectId: GCP_PROJECT_ID,
  location: GCP_LOCATION,
  model: VERTEX_AI_MODEL,
  temperature: 0.1,
  maxOutputTokens: 8192
};

// ========================================
// スクリプト設定
// ========================================

/**
 * スクリプト名（ログやエラー処理で使用）
 */
const SCRIPT_NAME = 'Appsheet_利用者_反映';

/**
 * デフォルトのクライアントステータス
 */
const DEFAULT_CLIENT_STATUS = 'サービス提供中';

/**
 * 処理ステータス
 */
const PROCESS_STATUS = {
  REFLECTED: '反映済み',
  ERROR: 'エラー'
};
