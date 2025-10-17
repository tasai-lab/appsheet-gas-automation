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

 * @fileoverview AppSheetからのWebhookを受け取り、Google Drive内のファイルを検索し、

 * 結果をAppSheetのテーブルにコールバックする汎用スクリプト。

 * 高い可読性、保守性、詳細なデバッグ機能を備えています。

 * @version 2.0.0

 */



// =================================================================================

// 1. 設定セクション (ここを修正するだけで動作をカスタマイズできます)

// =================================================================================



/**

 * 連携する複数のAppSheetアプリ情報を管理するオブジェクト。

 * WebhookのJSONボディで `appsheetConfigName` をキーとして指定します。

 */

const APPSHEET_CONFIGS = {

  // `appsheetConfigName` が指定されなかった場合のデフォルト設定

  'f-hokan': {

    API_ENDPOINT: 'https://api.appsheet.com/api/v2/apps/',

    APP_ID: 'f40c4b11-b140-4e31-a60c-600f3c9637c8', // TODO: ご自身の情報に書き換えてください

    ACCESS_KEY: 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY', // TODO: ご自身の情報に書き換えてください

    LOCALE: 'ja-JP',

    TIMEZONE: 'Asia/Tokyo'

  },

  // 2つ目以降のアプリ設定 (キーが「呼出名称」となる)

  'sales_app': {

    API_ENDPOINT: 'https://api.appsheet.com/api/v2/apps/',

    APP_ID: 'ここに営業用アプリのIDを記入', // TODO: ご自身の情報に書き換えてください

    ACCESS_KEY: 'ここに営業用アプリのAccessKeyを記入', // TODO: ご自身の情報に書き換えてください

    LOCALE: 'ja-JP',

    TIMEZONE: 'Asia/Tokyo'

  }

};



/** デフォルトで使用する設定の名称 */

const DEFAULT_CONFIG_NAME = 'f-hokan';



/** エラー発生時に通知メールを送信する宛先 */

const ERROR_RECIPIENTS = ['t.asai@fractal-group.co.jp'];



/** スクリプトの動作を制御する定数 */

const SCRIPT_CONSTANTS = {

  LOCK_TIMEOUT_MS: 30000, // ロックの最大待機時間 (ミリ秒)

  PRE_PROCESS_SLEEP_MS: 5000, // メイン処理前の待機時間 (ミリ秒)

  // 冪等性管理で使用するステータス (タイポ防止のため定数化)

  IDEMPOTENCY_STATUS: {

    PROCESSING: 'processing',

    COMPLETED: 'completed',

  },

  // AppSheetに設定するステータス (タイポ防止のため定数化)

  APPSHEET_STATUS: {

    SUCCESS_DEFAULT: '処理中',

    ERROR: 'エラー',

  },

  // デバッグモードの有効/無効 (trueにすると、より詳細なログが出力されます)

  DEBUG_MODE: false

};





// =================================================================================

// 2. メイン実行関数 (エントリーポイント)

// =================================================================================



/**

 * AppSheet WebhookからのPOSTリクエストを処理するメイン関数。

 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベントオブジェクト

 * @returns {GoogleAppsScript.Content.TextOutput} AppSheetに返すレスポンス

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  return processRequest(params);
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  let lock; // finallyブロックで確実に解放するため、ここで宣言

  let executionContext = {}; // 処理全体で引き回すコンテキスト情報



  try {

    // --- STEP 1: リクエストの解析とコンテキストの初期化 ---

    const { appConfig, config, data, baseFolderId } = parseRequest_(e);

    const keyValue = data.keyValue;



    executionContext = {

      configName: appConfig.name,

      keyValue: keyValue,

      fileName: data.fileName,

      idempotencyKey: `task_status_${keyValue}`

    };

    const logger = new CustomLogger_(executionContext);

    logger.info('スクリプト実行開始');



    // --- STEP 2: 重複実行の防止 (冪等性チェック) ---

    lock = LockService.getScriptLock();

    if (!lock.tryLock(SCRIPT_CONSTANTS.LOCK_TIMEOUT_MS)) {

      throw new Error(`他のプロセスが実行中のため、ロックを取得できませんでした (タイムアウト: ${SCRIPT_CONSTANTS.LOCK_TIMEOUT_MS}ms)`);

    }

    logger.info('スクリプト実行ロック取得成功');



    const currentStatus = PropertiesService.getScriptProperties().getProperty(executionContext.idempotencyKey);

    if (currentStatus === SCRIPT_CONSTANTS.IDEMPOTENCY_STATUS.PROCESSING || currentStatus === SCRIPT_CONSTANTS.IDEMPOTENCY_STATUS.COMPLETED) {

      logger.warn(`重複リクエストをスキップ (現在のステータス: ${currentStatus})`);

      return ContentService.createTextOutput(JSON.stringify({ status: "Skipped due to idempotency check" }));

    }

    setIdempotencyStatus_(executionContext.idempotencyKey, SCRIPT_CONSTANTS.IDEMPOTENCY_STATUS.PROCESSING, logger);

    

    // --- STEP 3: メイン処理の実行 ---

    const rowToUpdate = executeMainLogic_(data, baseFolderId, config, logger);



    // --- STEP 4: 正常完了処理 ---

    setIdempotencyStatus_(executionContext.idempotencyKey, SCRIPT_CONSTANTS.IDEMPOTENCY_STATUS.COMPLETED, logger);

    updateAppSheetRecord_(appConfig, config.tableName, rowToUpdate, logger);

    

    logger.info('スクリプト正常終了');

    return ContentService.createTextOutput(JSON.stringify({ status: "Processed" }));



  } catch (error) {

    // --- STEP 5: エラーハンドリング ---

    // この時点でloggerが初期化されていない可能性も考慮

    const logger = executionContext.idempotencyKey ? new CustomLogger_(executionContext) : new CustomLogger_({configName: 'N/A', keyValue: 'N/A'});

    return handleExecutionError_(error, executionContext, logger);



  } finally {

    // --- STEP 6: 後処理 ---

    if (lock && lock.hasLock()) {

      lock.releaseLock();

      if(executionContext.idempotencyKey) {

        const logger = new CustomLogger_(executionContext);

        logger.info('スクリプト実行ロック解放');

      }

    }

  }
}


/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  // TODO: テストデータを設定してください
  const testParams = {
    // 例: callId: "test-123",
    // 例: recordId: "rec-456",
    // 例: action: "CREATE"
  };

  console.log('=== テスト実行: AppSheet_ALL_ファイルID ===');
  console.log('入力パラメータ:', JSON.stringify(testParams, null, 2));

  try {
    const result = processRequest(testParams);
    console.log('処理成功:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('処理エラー:', error.message);
    console.error('スタックトレース:', error.stack);
    throw error;
  }
}






// =================================================================================

// 3. 機能別ヘルパー関数群 (ロジックの詳細)

// =================================================================================



/**

 * Webhookリクエストを解析し、必要な設定とデータを抽出する。

 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベントオブジェクト

 * @returns {Object} 必要な設定とデータのオブジェクト

 * @private

 */

function parseRequest_(e) {

  if (!e || !e.postData || !e.postData.contents) {

    throw new Error("POSTデータが空です。Webhookの設定を確認してください。");

  }

  const payload = JSON.parse(e.postData.contents);

  const configName = payload.appsheetConfigName || DEFAULT_CONFIG_NAME;

  const appConfig = APPSHEET_CONFIGS[configName];



  if (!appConfig) {

    const errorMessage = `指定されたAppSheet設定名 "${configName}" はAPPSHEET_CONFIGS内に見つかりません。`;

    // この段階ではコンテキストがないため、直接メール送信

    if (ERROR_RECIPIENTS && ERROR_RECIPIENTS.length > 0) {

      // Email removed - using execution log instead, '【設定エラー】AppSheet連携スクリプト', errorMessage);

    }

    throw new Error(errorMessage);

  }

  appConfig.name = configName; // 後でログ出力に使うため、設定名自体をオブジェクトに追加



  return {

    appConfig: appConfig,

    config: payload.config,

    data: payload.data,

    baseFolderId: payload.baseFolderId

  };

}



/**

 * 冪等性ステータスを設定/更新する。

 * @param {string} key - プロパティキー

 * @param {string} status - 設定するステータス

 * @param {CustomLogger_} logger - ログ出力用のインスタンス

 * @private

 */

function setIdempotencyStatus_(key, status, logger) {

  PropertiesService.getScriptProperties().setProperty(key, status);

  logger.info(`冪等性キーのステータスを更新 -> [${status}]`);

}





/**

 * ファイル検索などのメインロジックを実行し、AppSheetに更新するデータを生成する。

 * @param {Object} data - AppSheetから渡されたデータオブジェクト

 * @param {string} baseFolderId - 検索の起点となるフォルダID

 * @param {Object} config - AppSheetのテーブル設定など

 * @param {CustomLogger_} logger - ログ出力用のインスタンス

 * @returns {Object} AppSheetの行を更新するためのデータオブジェクト

 * @private

 */

function executeMainLogic_(data, baseFolderId, config, logger) {

  logger.info('メイン処理開始');

  Utilities.sleep(SCRIPT_CONSTANTS.PRE_PROCESS_SLEEP_MS);



  const rowToUpdate = {

    [config.keyColumn]: data.keyValue

  };



  if (data.currentFileId) {

    logger.info(`処理スキップ: ファイルIDは既に存在します (FileID: ${data.currentFileId})`);

  } else {

    if (!data.fileName) throw new Error("ファイルパス(fileName)が空です。");

    

    logger.info(`ファイル検索開始: BaseFolderID=${baseFolderId}, FilePath=${data.fileName}`);

    const foundFile = findFileInDrive_(baseFolderId, data.fileName, logger);

    

    rowToUpdate[config.fileIdColumn] = foundFile.getId();

    rowToUpdate[config.fileUrlColumn] = foundFile.getUrl();

    logger.info(`ファイル発見成功: ID=${foundFile.getId()}, URL=${foundFile.getUrl()}`);

  }

  

  // 正常完了時のステータスを設定

  if (config.statusColumn) {

    const successStatus = config.successStatusValue || SCRIPT_CONSTANTS.APPSHEET_STATUS.SUCCESS_DEFAULT;

    rowToUpdate[config.statusColumn] = successStatus;

    logger.info(`AppSheet更新ステータスを準備: [${successStatus}]`);

  }



  logger.info('メイン処理正常完了');

  return rowToUpdate;

}





/**

 * 指定されたパスのファイルをGoogle Driveで検索する。

 * @param {string} baseFolderId - 検索の起点となるフォルダID

 * @param {string} filePath - 基点からの相対ファイルパス (例: "請求書/2025年")

 * @param {CustomLogger_} logger - ログ出力用のインスタンス

 * @returns {GoogleAppsScript.Drive.File} 見つかったファイルオブジェクト

 * @private

 */

function findFileInDrive_(baseFolderId, filePath, logger) {

  const pathParts = filePath.split('/').filter(p => p); // 空の要素を削除

  const fileName = pathParts.pop();

  let currentFolder = DriveApp.getFolderById(baseFolderId);

  logger.debug('ファイルパス解析結果', { pathParts, fileName });



  for (const folderName of pathParts) {

    const folders = currentFolder.getFoldersByName(folderName);

    if (!folders.hasNext()) {

      throw new Error(`パスの途中のフォルダが見つかりません: "${folderName}" in "${currentFolder.getName()}"`);

    }

    currentFolder = folders.next();

    logger.debug(`フォルダを辿っています... -> [${currentFolder.getName()}]`);

  }



  const files = currentFolder.getFilesByName(fileName);

  if (!files.hasNext()) {

    throw new Error(`指定されたパスにファイルが見つかりません: "${fileName}" in "${currentFolder.getName()}"`);

  }

  

  return files.next();

}





/**

 * AppSheet APIを呼び出して、指定されたテーブルの行を更新する。

 * @param {Object} appConfig - AppSheetアプリの設定情報

 * @param {string} tableName - 更新対象のテーブル名

 * @param {Object} rowData - 更新するデータ

 * @param {CustomLogger_} logger - ログ出力用のインスタンス

 * @private

 */

function updateAppSheetRecord_(appConfig, tableName, rowData, logger) {

  // keyColumn以外に更新項目がある場合のみAPIを呼び出す

  if (Object.keys(rowData).length <= 1) {

    logger.info('AppSheetへの更新データがないため、API呼び出しをスキップします。');

    return;

  }

  

  const apiPayload = {

    "Action": "Edit",

    "Properties": { "Locale": appConfig.LOCALE, "Timezone": appConfig.TIMEZONE },

    "Rows": [ rowData ]

  };

  

  const apiUrl = `${appConfig.API_ENDPOINT}${appConfig.APP_ID}/tables/${tableName}/Action`;

  const options = {

    'method': 'post',

    'contentType': 'application/json',

    'headers': { 'ApplicationAccessKey': appConfig.ACCESS_KEY },

    'payload': JSON.stringify(apiPayload),

    'muteHttpExceptions': true

  };



  logger.info(`AppSheet API への更新リクエスト開始 (URL: ${apiUrl})`);

  logger.debug('AppSheet API Request Payload', apiPayload);



  const response = UrlFetchApp.fetch(apiUrl, options);

  const responseCode = response.getResponseCode();

  const responseBody = response.getContentText();



  if (responseCode >= 200 && responseCode < 300) {

    logger.info(`AppSheet API 呼び出し成功 (Status: ${responseCode})`);

    logger.debug('AppSheet API Response Body', responseBody);

  } else {

    // API呼び出し自体が失敗した場合、これはシステムエラーとして扱う

    throw new Error(`AppSheet APIへの更新リクエストに失敗しました。 Status: ${responseCode}, Response: ${responseBody}`);

  }

}





/**

 * スクリプト実行中に発生したエラーを一元的に処理する。

 * @param {Error} error - 発生したエラーオブジェクト

 * @param {Object} context - 実行コンテキスト情報

 * @param {CustomLogger_} logger - ログ出力用のインスタンス

 * @returns {GoogleAppsScript.Content.TextOutput} AppSheetに返すエラーレスポンス

 * @private

 */

function handleExecutionError_(error, context, logger) {

  const errorMessage = error.toString();

  const errorStack = error.stack || 'スタックトレースなし';



  logger.error(`スクリプト実行中に致命的なエラーが発生しました: ${errorMessage}`, errorStack);

  

  // 冪等性キーを削除して再実行を可能にする

  if (context.idempotencyKey) {

    PropertiesService.getScriptProperties().deleteProperty(context.idempotencyKey);

    logger.warn('エラー発生のため、冪等性キーを削除しました。修正後に再実行が可能です。');

  }



  // エラー通知メールを送信

  if (ERROR_RECIPIENTS && ERROR_RECIPIENTS.length > 0) {

    const subject = `【要確認】AppSheet連携スクリプト エラー発生通知 (${context.configName || '不明'})`;

    const body = `

AppSheet連携スクリプト("${context.configName || '不明'}"設定)の実行中にエラーが発生しました。



--------------------------------------------------

発生日時: ${new Date().toLocaleString('ja-JP')}

対象キー: ${context.keyValue || '取得不可'}

対象ファイルパス: ${context.fileName || '取得不可'}

--------------------------------------------------

エラー内容:

${errorMessage}

--------------------------------------------------

エラー詳細 (スタックトレース):

${errorStack}

--------------------------------------------------



このエラーにより、該当タスクの冪等性キーは削除されました。

AppSheet上で原因を修正後、再実行が可能です。

    `;

    // Email removed - using execution log instead, subject, body.trim());

    logger.info(`エラー通知メールを送信しました: To=${ERROR_RECIPIENTS.join(',')}`);

  }

  

  // エラーが発生した場合でも、AppSheet側のステータスを「エラー」に更新する試みを行う

  try {

    const payload = JSON.parse(e.postData.contents); // 元のリクエストから再度情報を取得

    const rowToUpdate = {

      [payload.config.keyColumn]: payload.data.keyValue,

      [payload.config.statusColumn]: SCRIPT_CONSTANTS.APPSHEET_STATUS.ERROR

    };

    const appConfig = APPSHEET_CONFIGS[payload.appsheetConfigName || DEFAULT_CONFIG_NAME];

    updateAppSheetRecord_(appConfig, payload.config.tableName, rowToUpdate, logger);

    logger.info('AppSheet側のステータスを「エラー」に更新しました。');

  } catch (updateError) {

    logger.error(`エラー発生後のAppSheetステータス更新処理中に、さらなるエラーが発生しました: ${updateError.toString()}`);

  }



  return ContentService.createTextOutput(JSON.stringify({ status: "Error", message: errorMessage }));

}







// =================================================================================

// 4. ユーティリティ (汎用的な補助機能)

// =================================================================================



/**

 * 詳細なログを出力するためのカスタムロガークラス。

 * @private

 */

class CustomLogger_ {

  /**

   * @param {Object} context ログに含めるコンテキスト情報

   */

  constructor(context) {

    this.context = context;

  }

  

  _log(level, message, details = '') {

    const timestamp = new Date().toISOString();

    const logEntry = `[${timestamp}] [${level}] [Config: ${this.context.configName}] [Key: ${this.context.keyValue}] - ${message}`;

    

    // 詳細情報があれば追記

    let fullLog = logEntry;

    if (details) {

      const detailsString = (typeof details === 'object') ? JSON.stringify(details, null, 2) : details.toString();

      fullLog += `\n--- Details ---\n${detailsString}\n---------------`;

    }

    

    Logger.log(fullLog);

  }



  info(message) {

    this._log('INFO', message);

  }



  warn(message) {

    this._log('WARN', message);

  }



  error(message, errorStack = '') {

    this._log('ERROR', message, errorStack);

  }

  

  /**

   * デバッグモードが有効な場合のみログを出力する

   * @param {string} message ログメッセージ

   * @param {*} data 出力したいデータ (オブジェクトなど)

   */

  debug(message, data = '') {

    if (SCRIPT_CONSTANTS.DEBUG_MODE) {

      this._log('DEBUG', message, data);

    }

  }

}



/**

 * =================================================================================

 * 5. 運用補助ツール (手動実行用)

 * =================================================================================

 */



/**

 * コード内で指定されたID (keyValue) に紐づく処理ステータス（冪等性キー）を強制的に削除する関数。

 * 処理がスタックしてしまったタスクを手動でリセットしたい場合に使用します。

 *

 * @description この関数はGASエディタから手動で実行してください。

 */

function resetTaskStatus() {

  

  // ▼▼▼▼▼【設定箇所】▼▼▼▼▼

  // ロックを解除したいタスクのID(keyValue)を、以下のクォーテーション(')の間に直接記入してください。

  const KEY_VALUE_TO_RESET = 'CRR-09b1cf02';

  // ▲▲▲▲▲【設定箇所】▲▲▲▲▲





  // --- 処理開始 ---

  Logger.log(`処理ロック解除ツールを開始します。対象ID: [${KEY_VALUE_TO_RESET}]`);



  // 1. 入力チェック

  if (!KEY_VALUE_TO_RESET || KEY_VALUE_TO_RESET === 'ここに解除したいIDを記入してください') {

    Logger.log('エラー: 解除対象のIDが指定されていません。コード内の`KEY_VALUE_TO_RESET`定数を編集してください。');

    return; // 処理を中断

  }



  try {

    // 2. 冪等性キーを組み立てて、存在確認

    const idempotencyKey = `task_status_${KEY_VALUE_TO_RESET}`;

    const properties = PropertiesService.getScriptProperties();

    const currentStatus = properties.getProperty(idempotencyKey);



    if (currentStatus === null) {

      Logger.log(`完了: 指定されたIDのロックは存在しませんでした。(検索キー: ${idempotencyKey})`);

      return;

    }



    // 3. キーを削除

    properties.deleteProperty(idempotencyKey);



    // 4. 実行ログに成功メッセージを出力

    Logger.log(`成功: 指定されたIDのロックを正常に解除しました。`);

    Logger.log(` - 解除したID: ${KEY_VALUE_TO_RESET}`);

    Logger.log(` - 解放したキー: ${idempotencyKey}`);

    Logger.log(` - 解放前のステータス: ${currentStatus}`);



  } catch (e) {

    Logger.log(`致命的なエラーが発生しました: ${e.toString()}`);

    Logger.log(e.stack); // エラーの詳細なスタックトレースを出力

  }

}