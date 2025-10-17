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

const APP_ID = '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f'; // AppSheetのアプリID

const TABLE_NAME = 'Call_Logs';     // 対象のテーブル名

const ACCESS_KEY = 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT'; // AppSheet APIのアクセスキー



// --- 2. メール通知設定 (★必要に応じて修正してください) ---

const SEND_SUCCESS_EMAIL = false; // ★ 追加: 正常処理の完了時にメールを送信する (true) / しない (false)

const SEND_ERROR_EMAIL = true;   // ★ 追加: エラー発生時にメールを送信する (true) / しない (false)

const EMAIL_RECIPIENT = 't.asai@fractal-group.co.jp'; // ★ 追加: 通知先メールアドレス



/**

 * スクリプト実行時エラーをAppSheetとメールに記録/通知する関数

 * @param {string} callId - 更新対象の通話ID

 * @param {string} errorMessage - 記録するエラーメッセージ

 */

function handleScriptError(callId, errorMessage) {

  // ★ 追加: メール通知機能

  if (SEND_ERROR_EMAIL) {

    try {

      const subject = '【GASエラー通知】AppSheet連携スクリプトでエラーが発生しました';

      const body = `AppSheet連携スクリプトの実行中にエラーが発生しました。\n\n`

                   + `■ 通話ID (call_id):\n${callId || '不明'}\n\n`

                   + `■ エラー内容:\n${errorMessage}\n\n`

                   + `このメールはGoogle Apps Scriptから自動送信されています。`;

      // Email removed - using execution log instead

      Logger.log(`エラー内容をメールで通知しました: ${EMAIL_RECIPIENT}`);

    } catch (e) {

      Logger.log(`メール通知中にエラーが発生しました: ${e.toString()}`);

    }

  }

  

  // callIdがない場合は、AppSheetを更新できないので以降の処理を終了

  if (!callId) {

    Logger.log('callIdが不明なため、AppSheetへのエラー記録はスキップされました。');

    return;

  }



  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [{

      "call_id": callId,

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
  let callId = null;

  try {

    

    callId = params.callId;

    const folderId = params.folderId;



    if (!callId || !folderId) {

      throw new Error('必要なパラメータ (callId, folderId) が不足しています。');

    }

    Logger.log(`処理開始: Call ID = ${callId}, 親Folder ID = ${folderId}`);



    Utilities.sleep(5000); 



    const parentFolder = DriveApp.getFolderById(folderId);

    const latestFile = findFileInSubfolders(parentFolder, callId);



    if (!latestFile) {

      throw new Error(`'${callId}' を含むファイルが指定されたフォルダ內に見つかりません。`);

    }



    const supportedFileExtensions = {

      'm4a': 'audio/mp4', 'mp4': 'audio/mp4', 'mp3': 'audio/mpeg',

      'wav': 'audio/wav', 'ogg': 'audio/ogg', 

      '3gp': 'video/3gpp', '3gpp': 'video/3gpp'

    };



    const fileName = latestFile.getName();

    const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';

    let rowData;

    let isSuccess = false; // ★ 追加: 処理成功フラグ



    if (Object.keys(supportedFileExtensions).includes(extension)) {

      const fileId = latestFile.getId();

      const fileUrl = latestFile.getUrl();

      Logger.log(`対応形式のファイルを検出: Name=${fileName}, ID=${fileId}, URL=${fileUrl}`);

      

      rowData = {

        "call_id": callId,

        "recording_file_id": fileId,

        "recording_file_url": fileUrl,

        "status": "処理中"

      };

      isSuccess = true; // ★ 追加

    } else {

      const mimeType = latestFile.getMimeType();

      Logger.log(`非対応のファイル形式です: Name=${fileName}, MIME=${mimeType}`);

      rowData = {

        "call_id": callId,

        "status": "エラー",

        "error_details": `非対応のファイル形式です：${fileName} (形式: ${extension || '不明'})`

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

    const responseCode = response.getResponseCode();

    const responseText = response.getContentText();

    Logger.log(`AppSheet API 応答: ${responseCode} - ${responseText}`);

    

    if (responseCode >= 400) {

        throw new Error(`AppSheet API Error: ${responseCode} - ${responseText}`);

    }



    // ★ 変更: 正常処理が完了した場合にメールを送信

    if (isSuccess && SEND_SUCCESS_EMAIL) {

      try {

        const subject = '【GAS正常完了通知】AppSheet連携スクリプト';

        const body = `AppSheet連携スクリプトの処理が正常に完了しました。\n\n`

                     + `■ 通話ID (call_id):\n${callId}\n\n`

                     + `■ 処理対象ファイル:\n${fileName}\n\n`

                     + `■ AppSheetへの登録ステータス:\n処理中\n\n`

                     + `このメールはGoogle Apps Scriptから自動送信されています。`;

        // Email removed - using execution log instead

        Logger.log(`処理完了をメールで通知しました: ${EMAIL_RECIPIENT}`);

      } catch (e) {

        Logger.log(`完了通知メールの送信中にエラーが発生しました: ${e.toString()}`);

      }

    }



  } catch (error) {

    Logger.log(`エラーが発生しました: ${error.toString()}`);

    handleScriptError(callId, error.toString());

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

  console.log('=== テスト実行: Appsheet_通話_ファイルID取得 ===');
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

 * @param {string} partOfFileName - ファイル名に含まれる文字列 (callId)

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