/**

 * 定数定義モジュール

 * アプリケーション全体で使用する定数を管理

 */


// ===================================

// ステータス定数

// ===================================

const STATUS = {

  PROCESSING: '処理中',

  EDITING: '編集中',

  ERROR: 'エラー',

  COMPLETED: '完了'

};


// ===================================

// ログレベル定数

// ===================================

const LOG_LEVEL = {

  DEBUG: 'DEBUG',

  INFO: 'INFO',

  WARN: 'WARN',

  ERROR: 'ERROR',

  FATAL: 'FATAL'

};


// ===================================

// エラーコード定数

// ===================================

const ERROR_CODE = {

  // 入力エラー (1000番台)

  MISSING_REQUIRED_PARAMS: 'E1001',

  INVALID_FILE_PATH: 'E1002',

  INVALID_RECORD_TYPE: 'E1003',

  FILE_NOT_FOUND: 'E1004',

  FILE_SIZE_EXCEEDED: 'E1005',

  UNSUPPORTED_FORMAT: 'E1006',

  
  // データ取得エラー (2000番台)

  MASTER_DATA_FETCH_FAILED: 'E2001',

  FILE_FETCH_FAILED: 'E2002',

  DRIVE_ACCESS_FAILED: 'E2003',

  
  // AI処理エラー (3000番台)

  VERTEX_AI_ERROR: 'E3001',

  GEMINI_API_ERROR: 'E3002',

  JSON_PARSE_ERROR: 'E3003',

  RESPONSE_VALIDATION_ERROR: 'E3004',

  
  // 外部API エラー (4000番台)

  APPSHEET_API_ERROR: 'E4001',

  CLOUD_STORAGE_ERROR: 'E4002',

  
  // システムエラー (5000番台)

  UNEXPECTED_ERROR: 'E5001',

  TIMEOUT_ERROR: 'E5002',

  ASYNC_TRIGGER_ERROR: 'E5003'

};


// ===================================

// エラーメッセージテンプレート

// ===================================

const ERROR_MESSAGES = {

  [ERROR_CODE.MISSING_REQUIRED_PARAMS]: '必須パラメータが不足しています',

  [ERROR_CODE.INVALID_FILE_PATH]: 'ファイルパスが無効です',

  [ERROR_CODE.INVALID_RECORD_TYPE]: '記録タイプが無効です',

  [ERROR_CODE.FILE_NOT_FOUND]: 'ファイルが見つかりません',

  [ERROR_CODE.FILE_SIZE_EXCEEDED]: 'ファイルサイズが上限を超えています',

  [ERROR_CODE.UNSUPPORTED_FORMAT]: 'サポートされていないファイル形式です',

  [ERROR_CODE.MASTER_DATA_FETCH_FAILED]: 'マスターデータの取得に失敗しました',

  [ERROR_CODE.FILE_FETCH_FAILED]: 'ファイルの取得に失敗しました',

  [ERROR_CODE.DRIVE_ACCESS_FAILED]: 'Google Driveへのアクセスに失敗しました',

  [ERROR_CODE.VERTEX_AI_ERROR]: 'Vertex AIでの処理に失敗しました',

  [ERROR_CODE.GEMINI_API_ERROR]: 'Gemini APIでの処理に失敗しました',

  [ERROR_CODE.JSON_PARSE_ERROR]: '生成されたJSONの解析に失敗しました',

  [ERROR_CODE.RESPONSE_VALIDATION_ERROR]: 'AI応答の検証に失敗しました',

  [ERROR_CODE.APPSHEET_API_ERROR]: 'AppSheet APIの呼び出しに失敗しました',

  [ERROR_CODE.CLOUD_STORAGE_ERROR]: 'Cloud Storage操作に失敗しました',

  [ERROR_CODE.UNEXPECTED_ERROR]: '予期しないエラーが発生しました',

  [ERROR_CODE.TIMEOUT_ERROR]: '処理がタイムアウトしました',

  [ERROR_CODE.ASYNC_TRIGGER_ERROR]: '非同期処理のトリガー作成に失敗しました'

};


// ===================================

// API応答コード定数

// ===================================

const HTTP_STATUS = {

  OK: 200,

  ACCEPTED: 202,

  NO_CONTENT: 204,

  BAD_REQUEST: 400,

  UNAUTHORIZED: 401,

  FORBIDDEN: 403,

  NOT_FOUND: 404,

  INTERNAL_ERROR: 500,

  SERVICE_UNAVAILABLE: 503

};


// ===================================

// 必須フィールド定義

// ===================================

const REQUIRED_FIELDS = {

  normal: [

    'processedAudioText',

    'vitalSigns',

    'subjectiveInformation',

    'userCondition',

    'guidanceAndAdvice',

    'nursingAndRehabilitationItems',

    'specialNotes',

    'summaryForNextVisit'

  ],

  psychiatry: [

    'clientCondition',

    'dailyLivingObservation',

    'mentalStateObservation',

    'medicationAdherence',

    'socialFunctionalObservation',

    'careProvided',

    'guidanceAndAdvice',

    'remarks',

    'summaryForNextVisit'

  ]

};


// ===================================

// AppSheet フィールドマッピング

// ===================================

const APPSHEET_FIELD_MAPPING = {

  normal: {

    processedAudioText: 'extracted_text',

    vitalSigns: 'vital_signs',

    subjectiveInformation: 'subjective_information',

    userCondition: 'client_condition',

    guidanceAndAdvice: 'guidance_and_advice',

    nursingAndRehabilitationItems: 'care_provided',

    specialNotes: 'remarks',

    summaryForNextVisit: 'summary_for_next_visit'

  },

  psychiatry: {

    clientCondition: 'client_condition',

    dailyLivingObservation: 'daily_living_observation',

    mentalStateObservation: 'mental_state_observation',

    medicationAdherence: 'medication_adherence',

    socialFunctionalObservation: 'social_functional_observation',

    careProvided: 'care_provided',

    guidanceAndAdvice: 'guidance_and_advice',

    remarks: 'remarks',

    summaryForNextVisit: 'summary_for_next_visit'

  }

};


// ===================================

// 通知タイプ定数

// ===================================

const NOTIFICATION_TYPE = {

  SUCCESS: 'success',

  ERROR: 'error',

  WARNING: 'warning',

  INFO: 'info'

};
