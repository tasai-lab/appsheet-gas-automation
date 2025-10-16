/**
 * 実行ログモジュール
 */
const ExecutionLogger = {
  SPREADSHEET_ID: '15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE',
  SHEET_NAME: 'シート1',
  
  /**
   * ログを記録
   * @param {string} scriptName - スクリプト名
   * @param {string} status - ステータス (SUCCESS/ERROR/WARNING)
   * @param {string} processId - 処理ID
   * @param {string} message - メッセージ
   * @param {string} errorDetail - エラー詳細
   * @param {number} executionTime - 実行時間(秒)
   * @param {Object} inputData - 入力データ
   */
  log: function(scriptName, status, processId, message, errorDetail, executionTime, inputData) {
    try {
      const ss = SpreadsheetApp.openById(this.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(this.SHEET_NAME);
      
      const timestamp = new Date();
      const user = Session.getActiveUser().getEmail();
      const inputDataStr = inputData ? JSON.stringify(inputData).substring(0, 1000) : '';
      
      sheet.appendRow([
        timestamp,
        scriptName,
        status,
        processId || '',
        message || '',
        errorDetail || '',
        executionTime || 0,
        user,
        inputDataStr
      ]);
    } catch (e) {
      Logger.log(`ログ記録エラー: ${e.message}`);
    }
  },
  
  /**
   * 成功ログ
   */
  success: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'SUCCESS', processId, message, '', executionTime, inputData);
  },
  
  /**
   * エラーログ
   */
  error: function(scriptName, processId, message, error, executionTime, inputData) {
    const errorDetail = error ? `${error.message}\n${error.stack}` : '';
    this.log(scriptName, 'ERROR', processId, message, errorDetail, executionTime, inputData);
  },
  
  /**
   * 警告ログ
   */
  warning: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'WARNING', processId, message, '', executionTime, inputData);
  }
};


/**
 * Webhook重複実行防止モジュール
 */
const DuplicationPrevention = {
  LOCK_TIMEOUT: 300000, // 5分
  CACHE_EXPIRATION: 3600, // 1時間
  
  /**
   * リクエストの重複チェック
   * @param {string} requestId - リクエストID（webhookデータのハッシュ値）
   * @return {boolean} - 処理を続行する場合はtrue
   */
  checkDuplicate: function(requestId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `processed_${requestId}`;
    
    // キャッシュチェック
    if (cache.get(cacheKey)) {
      Logger.log(`重複リクエストを検出: ${requestId}`);
      return false;
    }
    
    // ロック取得
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(this.LOCK_TIMEOUT);
      
      // 再度キャッシュチェック（ダブルチェック）
      if (cache.get(cacheKey)) {
        Logger.log(`ロック取得後、重複リクエストを検出: ${requestId}`);
        return false;
      }
      
      // 処理済みマークを設定
      cache.put(cacheKey, 'processed', this.CACHE_EXPIRATION);
      return true;
    } catch (e) {
      Logger.log(`ロック取得エラー: ${e.message}`);
      return false;
    } finally {
      lock.releaseLock();
    }
  },
  
  /**
   * リクエストIDを生成
   * @param {Object} data - Webhookデータ
   * @return {string} - リクエストID
   */
  generateRequestId: function(data) {
    const str = JSON.stringify(data);
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      str,
      Utilities.Charset.UTF_8
    ).map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
  }
};


/**

 * 設定ファイル  // Vertex AI設定

  vertexAI: {

    model: 'gemini-1.5-pro-latest',

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

    model: 'gemini-1.5-pro-latest',

    temperature: 0.2,

    maxOutputTokens: 8192

  }

};



// ===================================

// Gemini API 設定(フォールバック用)

// ===================================

const GEMINI_CONFIG = {

  apiKey: "AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY",

  model: 'gemini-1.5-pro-latest',

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

  processingMode: 'vertex-ai',

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