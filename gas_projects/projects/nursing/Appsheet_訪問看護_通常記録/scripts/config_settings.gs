/**

 * 設定ファイル  // Vertex AI設定

  vertexAI: {

    model: 'gemini-2.5-pro',  // ★更新済み: gemini-1.5→2.5

    temperature: 0.3,

    maxOutputTokens: 8192

  }に応じて値を変更してください

 */


// ===================================

// Google Cloud Platform 設定

// ===================================

const GCP_CONFIG = {

  projectId: 'macro-shadow-458705-v8',

  location: 'us-central1',  // gemini-2.5-pro対応リージョン（asia-northeast1は非対応）

  bucketName: 'nursing-records-audio-macro',

  
  // Vertex AI設定

  vertexAI: {

    model: 'gemini-2.5-pro',

    temperature: 0.2,

    maxOutputTokens: 8192

  }

};


// ===================================
// ★★★ Google AI Studio API（Gemini API）完全廃止 ★★★
// ===================================
// 理由: 無料枠超過により90%エラー発生、200,000リクエスト/日の問題
// 修正日: 2025-10-18
// ユーザー指示: 「今後gemini apiを使用することが無いようにお願いします。今後、全てvertex apiを使用すること。」
//
// APIキーは削除済み。GEMINI_CONFIGは互換性のため残していますが、
// Google AI Studio API呼び出し関数は完全削除済みです。
// ===================================

const GEMINI_CONFIG = {

  apiKey: "",  // ★削除済み - Google AI Studio APIは使用不可

  model: 'gemini-2.5-pro',  // 参照用のみ

  temperature: 0.3

};


// ===================================

// AppSheet 設定

// ===================================

const APPSHEET_CONFIG = {

  appId: 'f40c4b11-b140-4e31-a60c-600f3c9637c8',

  accessKey: 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY',

  tableName: 'Care_Records'

};


// ===================================

// スプレッドシート設定

// ===================================

const SPREADSHEET_CONFIG = {

  masterId: '1EhLGOPKrxqMNl2b1_c0mA1M3w1tXiHN4PsnXWfWHSPw',

  sheetName: 'Care_Provided'

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

// システム設定

// ===================================

const SYSTEM_CONFIG = {

  processingMode: 'vertex-ai',  // ★Vertex AIのみ使用（Google AI Studio APIは完全廃止）

  debugMode: false,


  // タイムアウト設定(ミリ秒)

  timeout: {

    vertexAI: 120000,

    geminiAPI: 60000,

    appSheetAPI: 30000

  }

};


// ===================================

// 音声ファイル設定

// ===================================

const AUDIO_CONFIG = {

  supportedFormats: ['m4a', 'mp3', 'wav', 'ogg'],

  maxFileSizeBytes: 2147483648,

  mimeTypeMapping: {

    'm4a': 'audio/mp4',

    'mp3': 'audio/mpeg',

    'wav': 'audio/wav',

    'ogg': 'audio/ogg'

  }

};


// ===================================

// 共有ドライブ設定

// ===================================

const SHARED_DRIVE_CONFIG = {

  audioRootFolderId: '18Fwwm7lsBMy5BMFL_TnnFDh9lNVyAX04' // 音声記録フォルダ(共有ドライブ)

};


// ===================================

// 記録タイプ設定

// ===================================

const RECORD_TYPE_CONFIG = {

  normal: {

    name: '通常',

    matchText: '通常',

    outputFields: [

      'processedAudioText',

      'vitalSigns',

      'subjectiveInformation',

      'userCondition',

      'guidanceAndAdvice',

      'nursingAndRehabilitationItems',

      'specialNotes',

      'summaryForNextVisit'

    ]

  },

  
  psychiatry: {

    name: '精神科',

    matchText: '精神',

    outputFields: [

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

  }

};
