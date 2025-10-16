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

 * 設定管理モジュール

 * Script Propertiesから設定を取得・管理

 * 

 * @author Fractal Group

 * @version 2.0.0

 * @date 2025-10-06

 */



/**

 * 設定を取得

 * Script Propertiesから全ての設定値を取得

 * 

 * @return {Object} 設定オブジェクト

 */

function getConfig() {

  const props = PropertiesService.getScriptProperties();

  

  return {

    // GCP設定

    gcpProjectId: props.getProperty('GCP_PROJECT_ID') || '',

    gcpLocation: props.getProperty('GCP_LOCATION') || 'us-central1',

    gcpBucketName: props.getProperty('GCP_BUCKET_NAME') || '',

    

    // Google Drive設定（共有ドライブ）

    sharedDriveFolderId: props.getProperty('SHARED_DRIVE_FOLDER_ID') || '15IahaL7lOjTT0QZ2IfDJbO7SXkGnsKOR',

    

    // Vertex AI設定

    vertexAIModel: props.getProperty('VERTEX_AI_MODEL') || 'gemini-2.5-pro',

    temperature: parseFloat(props.getProperty('TEMPERATURE') || '0.2'),

    maxOutputTokens: parseInt(props.getProperty('MAX_OUTPUT_TOKENS') || '20000'),

    topP: parseFloat(props.getProperty('TOP_P') || '1.0'),

    topK: parseInt(props.getProperty('TOP_K') || '32'),

    

    // AppSheet API設定

    appsheetAppId: props.getProperty('APPSHEET_APP_ID') || '',

    appsheetAccessKey: props.getProperty('APPSHEET_ACCESS_KEY') || '',

    logsTableName: props.getProperty('LOGS_TABLE_NAME') || 'Call_Logs',

    actionsTableName: props.getProperty('ACTIONS_TABLE_NAME') || 'Call_Actions',

    

    // 通知設定

    errorNotificationEmail: props.getProperty('ERROR_NOTIFICATION_EMAIL') || '',

    emailNotificationEnabled: props.getProperty('EMAIL_NOTIFICATION_ENABLED') !== 'false',

    notifyOnSuccess: props.getProperty('NOTIFY_ON_SUCCESS') === 'true',

    

    // システム設定

    useCloudStorage: props.getProperty('USE_CLOUD_STORAGE') === 'true',

    cloudStorageThresholdMB: parseInt(props.getProperty('CLOUD_STORAGE_THRESHOLD_MB') || '20'),

  };

}



/**

 * 初期設定を実行

 * Script Propertiesに設定値を一括保存

 * 

 * ⚠️ この関数は初回のみ実行してください

 * Apps Scriptエディタで手動実行

 */

function setupScriptProperties() {

  const props = PropertiesService.getScriptProperties();

  

  // ★★★ 以下の値をご自身の環境に合わせて修正してください ★★★

  const settings = {

    // GCP設定

    'GCP_PROJECT_ID': 'macro-shadow-458705-v8',

    'GCP_LOCATION': 'us-central1',  // Gemini 2.5対応リージョン

    'GCP_BUCKET_NAME': 'macro-shadow-458705-v8-call-logs',

    

    // Google Drive設定（共有ドライブ）

    'SHARED_DRIVE_FOLDER_ID': '15IahaL7lOjTT0QZ2IfDJbO7SXkGnsKOR',

    

    // Vertex AI設定

    'VERTEX_AI_MODEL': 'gemini-2.5-pro',  // または 'gemini-2.5-pro'

    'TEMPERATURE': '0.2',

    'MAX_OUTPUT_TOKENS': '20000',

    'TOP_P': '1.0',

    'TOP_K': '32',

    

    // AppSheet API設定

    'APPSHEET_APP_ID': '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f',

    'APPSHEET_ACCESS_KEY': 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT',

    'LOGS_TABLE_NAME': 'Call_Logs',

    'ACTIONS_TABLE_NAME': 'Call_Actions',

    

    // 通知設定

    'ERROR_NOTIFICATION_EMAIL': 't.asai@fractal-group.co.jp',

    'EMAIL_NOTIFICATION_ENABLED': 'true',

    'NOTIFY_ON_SUCCESS': 'false',

    

    // システム設定

    'USE_CLOUD_STORAGE': 'true',  // 20MB以上のファイルの場合はtrue推奨

    'CLOUD_STORAGE_THRESHOLD_MB': '20',

  };

  

  props.setProperties(settings);

  

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('✅ Script Propertiesの設定が完了しました');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('設定内容:');

  Logger.log(JSON.stringify(settings, null, 2));

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

}



/**

 * 現在の設定を表示

 * デバッグ・確認用

 */

function showCurrentConfig() {

  const config = getConfig();

  

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('📋 現在の設定');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('');

  Logger.log('[GCP設定]');

  Logger.log(`  プロジェクトID: ${config.gcpProjectId || '未設定'}`);

  Logger.log(`  リージョン: ${config.gcpLocation}`);

  Logger.log(`  バケット名: ${config.gcpBucketName || '未設定'}`);

  Logger.log('');

  Logger.log('[Google Drive設定]');

  Logger.log(`  共有ドライブフォルダーID: ${config.sharedDriveFolderId || '未設定'}`);

  Logger.log('');

  Logger.log('[Vertex AI設定]');

  Logger.log(`  モデル: ${config.vertexAIModel}`);

  Logger.log(`  Temperature: ${config.temperature}`);

  Logger.log(`  Max Tokens: ${config.maxOutputTokens}`);

  Logger.log(`  Top P: ${config.topP}`);

  Logger.log(`  Top K: ${config.topK}`);

  Logger.log('');

  Logger.log('[AppSheet設定]');

  Logger.log(`  App ID: ${config.appsheetAppId ? '***設定済み***' : '未設定'}`);

  Logger.log(`  Access Key: ${config.appsheetAccessKey ? '***設定済み***' : '未設定'}`);

  Logger.log(`  Logsテーブル: ${config.logsTableName}`);

  Logger.log(`  Actionsテーブル: ${config.actionsTableName}`);

  Logger.log('');

  Logger.log('[通知設定]');

  Logger.log(`  通知先メール: ${config.errorNotificationEmail || '未設定'}`);

  Logger.log(`  メール通知: ${config.emailNotificationEnabled ? '有効' : '無効'}`);

  Logger.log(`  成功時通知: ${config.notifyOnSuccess ? '有効' : '無効'}`);

  Logger.log('');

  Logger.log('[システム設定]');

  Logger.log(`  Cloud Storage使用: ${config.useCloudStorage ? '有効' : '無効'}`);

  Logger.log(`  Cloud Storage閾値: ${config.cloudStorageThresholdMB}MB`);

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

}



/**

 * Script Propertiesをクリア

 * 

 * ⚠️ 警告: この関数を実行すると全ての設定が削除されます

 */

function clearScriptProperties() {

  const props = PropertiesService.getScriptProperties();

  props.deleteAllProperties();

  

  Logger.log('⚠️ Script Propertiesを全てクリアしました');

  Logger.log('再度 setupScriptProperties() を実行して設定してください');

}



/**

 * 設定の検証

 * 必須項目が設定されているかチェック

 * 

 * @return {Object} {isValid: boolean, errors: string[]}

 */

function validateConfig() {

  const config = getConfig();

  const errors = [];

  

  // 必須項目チェック

  if (!config.gcpProjectId) {

    errors.push('GCP_PROJECT_ID が未設定です');

  }

  

  if (!config.appsheetAppId) {

    errors.push('APPSHEET_APP_ID が未設定です');

  }

  

  if (!config.appsheetAccessKey) {

    errors.push('APPSHEET_ACCESS_KEY が未設定です');

  }

  

  if (config.emailNotificationEnabled && !config.errorNotificationEmail) {

    errors.push('メール通知が有効ですが ERROR_NOTIFICATION_EMAIL が未設定です');

  }

  

  if (config.useCloudStorage && !config.gcpBucketName) {

    errors.push('Cloud Storageが有効ですが GCP_BUCKET_NAME が未設定です');

  }

  

  const isValid = errors.length === 0;

  

  if (isValid) {

    Logger.log('✅ 設定の検証: 成功');

  } else {

    Logger.log('❌ 設定の検証: 失敗');

    errors.forEach(error => Logger.log(`  - ${error}`));

  }

  

  return { isValid, errors };

}

