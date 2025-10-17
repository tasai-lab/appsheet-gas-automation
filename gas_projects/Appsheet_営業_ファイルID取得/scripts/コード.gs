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


// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

const APP_ID = '27bceb6f-9a2c-4ab6-9438-31fec25a495e'; // AppSheetのアプリID

const TABLE_NAME = 'Sales_Activities';   // ★対象テーブル名を変更

const ACCESS_KEY = 'V2-A0207-tnP4i-YwteT-Cg55O-7YBvg-zMXQX-sS4Xv-XuaKP'; // AppSheet APIのアクセスキー



/**

 * スクリプト実行時エラーをAppSheetに記録する関数

 * @param {string} activityId - 更新対象のID

 * @param {string} errorMessage - 記録するエラーメッセージ

 */

function handleScriptError(activityId, errorMessage) {

  if (!activityId) {

    Logger.log('activityIdが不明なため、AppSheetへのエラー記録はスキップされました。');

    return;

  }



  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [{

      "activity_id": activityId, // ★キー列名を変更

      "status": "エラー",

      "error_details": `GAS Script Error: ${errorMessage}`

    }]

  };

  

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${TABLE_NAME}/Action`;

  const options = {

    'method': 'post',

    'contentType': 'application/json',

    'headers': { 'ApplicationAccessKey': ACCESS_KEY },

    'payload': JSON.stringify(payload),

    'muteHttpExceptions': true

  };

  

  try {

    UrlFetchApp.fetch(apiUrl, options);

    Logger.log(`AppSheetへエラー内容を記録しました: ${errorMessage}`);

  } catch (e) {

    Logger.log(`AppSheetへのエラー記録中にさらにエラーが発生しました: ${e.toString()}`);

  }

}





/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 * @param {object} e - Webhookイベントオブジェクト

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
  let activityId = null;

  try {

    

    activityId = params.activityId; // ★変数名を変更

    const folderId = params.folderId;



    if (!activityId || !folderId) {

      throw new Error('必要なパラメータ (activityId, folderId) が不足しています。');

    }

    Logger.log(`処理開始: Activity ID = ${activityId}, 親Folder ID = ${folderId}`);



    Utilities.sleep(5000); 



    const parentFolder = DriveApp.getFolderById(folderId);

    const latestFile = findFileInSubfolders(parentFolder, activityId); // ★検索キーを変更



    if (!latestFile) {

      throw new Error(`'${activityId}' を含むファイルが指定されたフォルダ內に見つかりません。`);

    }



    const mimeType = latestFile.getMimeType();

    let rowData;

    const extension = latestFile.getName().split('.').pop().toLowerCase();

    const supportedExtensions = ['m4a', 'mp3'];



    if (supportedExtensions.includes(extension)) {

      const fileId = latestFile.getId();

      const fileUrl = latestFile.getUrl();

      Logger.log(`音声ファイルを検出: ID=${fileId}, URL=${fileUrl}`);

      

      rowData = {

        "activity_id": activityId, // ★キー列名を変更

        "audio_file_id": fileId,   // ★書き込み先列名を変更

        "audio_file_url": fileUrl, // ★書き込み先列名を変更

        "status": "処理中"

      };

    } else {

      Logger.log(`非対応のファイル形式です: ${extension}`);

      rowData = {

        "activity_id": activityId, // ★キー列名を変更

        "status": "エラー",

        "error_details": `非対応のファイル形式です：${extension}`

      };

    }

    

    const apiPayload = {

      "Action": "Edit",

      "Properties": { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

      "Rows": [rowData]

    };

    const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${TABLE_NAME}/Action`;

    const options = {

      'method': 'post',

      'contentType': 'application/json',

      'headers': { 'ApplicationAccessKey': ACCESS_KEY },

      'payload': JSON.stringify(apiPayload)

    };



    const response = UrlFetchApp.fetch(apiUrl, options);

    Logger.log(`AppSheet API 応答: ${response.getResponseCode()} - ${response.getContentText()}`);

    if (response.getResponseCode() >= 400) {

        throw new Error(`AppSheet API Error: ${response.getResponseCode()} - ${response.getContentText()}`);

    }



  } catch (error) {

    Logger.log(`エラーが発生しました: ${error.toString()}`);

    handleScriptError(activityId, error.toString());

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

  console.log('=== テスト実行: Appsheet_営業_ファイルID取得 ===');
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




/**

 * 指定されたフォルダとその全てのサブフォルダから、ファイル名に特定文字列を含む最新のファイルを検索する

 * @param {Folder} folder - 検索を開始する親フォルダ

 * @param {string} partOfFileName - ファイル名に含まれる文字列

 * @return {File|null} - 見つかった最新のファイル、またはnull

 */

function findFileInSubfolders(folder, partOfFileName) {

  let latestFile = null;

  let latestDate = new Date(0);



  function searchRecursively(currentFolder) {

    const files = currentFolder.searchFiles(

      `title contains '${partOfFileName}' and trashed = false`

    );

    while (files.hasNext()) {

      let currentFile = files.next();

      let createdDate = currentFile.getDateCreated();

      if (createdDate > latestDate) {

        latestFile = currentFile;

        latestDate = createdDate;

      }

    }

    const subFolders = currentFolder.getFolders();

    while (subFolders.hasNext()) {

      searchRecursively(subFolders.next());

    }

  }



  searchRecursively(folder);

  return latestFile;

}