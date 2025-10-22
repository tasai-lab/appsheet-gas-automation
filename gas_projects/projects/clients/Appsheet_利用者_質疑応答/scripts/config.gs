/**
 * 設定管理モジュール
 * アプリケーション全体で使用する設定定数を定義
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-20
 */

const CONFIG = {

  // ★★★ Google AI Studio API完全廃止 ★★★
  // 修正日: 2025-10-18
  // 理由: ユーザー指示「今後gemini apiを使用することが無いようにお願いします。今後、全てvertex apiを使用すること。」
  // Vertex AI（OAuth2認証）を使用するため、APIキー不要
  GEMINI: {

    // API_KEY: '',  // ★削除済み - Vertex AIはOAuth2認証を使用
    // API_ENDPOINT: '',  // ★削除済み - Vertex AI専用エンドポイントを使用

    MODEL_NAME: 'gemini-2.5-pro',

    GCP_PROJECT_ID: 'macro-shadow-458705-v8',

    GCP_LOCATION: 'us-central1',

    GENERATION_CONFIG: {

      "responseMimeType": "application/json",

      "temperature": 0.2

    }

  },

  APPSHEET: {

    APP_ID: 'f40c4b11-b140-4e31-a60c-600f3c9637c8',

    ACCESS_KEY: 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY',

    API_ENDPOINT: 'https://api.appsheet.com/api/v2/apps/',

    TABLE_NAME: 'Client_Analytics',

    LOCALE: 'ja-JP'

  },

  RETRY_SETTINGS: {

    MAX_ATTEMPTS: 3,

    INITIAL_DELAY_MS: 1000,

    BACKOFF_FACTOR: 2

  },

  // 非同期タスクキュー設定
  ASYNC_CONFIG: {

    WORKER_FUNCTION_NAME: 'processTaskQueueWorker',

    WORKER_ACTION_KEY: 'start_worker_v1',

    QUEUE_KEY: 'TASK_QUEUE',

    TASK_DATA_PREFIX: 'TASK_DATA_',

    IDEMPOTENCY_PREFIX: 'IDEMPOTENCY_',

    CACHE_EXPIRATION_SECONDS: 600, // 10分

    MAX_EXECUTION_TIME_MS: 300000  // 5分

  }

};

/**
 * ステータス定数
 */
const STATUS = {

  COMPLETED: "完了",

  ERROR: "エラー"

};

/**
 * 為替レート設定（USD -> JPY）
 * 2025年1月時点の想定レート
 */
const EXCHANGE_RATE_USD_TO_JPY = 150;
