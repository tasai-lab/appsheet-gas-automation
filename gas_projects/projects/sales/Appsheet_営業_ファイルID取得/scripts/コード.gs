// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

const APP_ID = '27bceb6f-9a2c-4ab6-9438-31fec25a495e'; // AppSheetのアプリID

const TABLE_NAME = 'Sales_Activities';   // ★対象テーブル名を変更

const ACCESS_KEY = 'V2-A0207-tnP4i-YwteT-Cg55O-7YBvg-zMXQX-sS4Xv-XuaKP'; // AppSheet APIのアクセスキー

/**

 * スクリプト実行時エラーをAppSheetに記録する関数

 * @param {string} activityId - 更新対象のID

 * @param {string} errorMessage - 記録するエラーメッセージ

 */

/**
 * スクリプト実行時エラーを処理
 * @param {string} recordId - レコードID
 * @param {string} errorMessage - エラーメッセージ
 */
function handleScriptError(recordId, errorMessage) {
  const error = new Error(errorMessage);

  ErrorHandler.handleError(error, {
    scriptName: ScriptApp.getActive().getName(),
    processId: recordId,
    recordId: recordId,
    appsheetConfig: {
      appId: APP_ID,
      tableName: TABLE_NAME,
      accessKey: ACCESS_KEY
    }
  });
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
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_営業_ファイルID取得';
    return processRequest(params.recordId || params.data?.recordId, params.folderId || params.data?.folderId, params.fileName || params.data?.fileName);
  });
}

/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(recordId, folderId, fileName) {
  let activityId = null;

  try {

    activityId = params.activityId; // ★変数名を変更
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
    // 例: action: "test",
    // 例: data: "sample"
  };

  return CommonTest.runTest((params) => processRequest(params.recordId, params.folderId, params.fileName), testParams, 'Appsheet_営業_ファイルID取得');
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
