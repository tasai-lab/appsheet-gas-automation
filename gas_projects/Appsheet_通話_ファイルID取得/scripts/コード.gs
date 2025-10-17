// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

const APP_ID = '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f'; // AppSheetのアプリID

const TABLE_NAME = 'Call_Logs';     // 対象のテーブル名

const ACCESS_KEY = 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT'; // AppSheet APIのアクセスキー

// --- 2. メール通知設定 (★必要に応じて修正してください) ---

const SEND_SUCCESS_EMAIL = false; // ★ 追加: 正常処理の完了時にメールを送信する (true) / しない (false)

const SEND_ERROR_EMAIL = true;   // ★ 追加: エラー発生時にメールを送信する (true) / しない (false)

const EMAIL_RECIPIENT = 't.asai@fractal-group.co.jp'; // ★ 追加: 通知先メールアドレス

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
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_通話_ファイルID取得';
    return processRequest(params.callId || params.data?.callId, params.folderId || params.data?.folderId, params.filePath || params.data?.filePath);
  });
}

/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(callId, folderId, filePath) {
  const startTime = new Date();
  try {
    // パラメータ検証
    // callIdは必須
    if (!callId) {
      throw new Error('必須パラメータ callId が不足しています');
    }

    // filePathまたはfolderIdのいずれかが必要
    if (!filePath && !folderId) {
      throw new Error('filePath または folderId のいずれかが必要です');
    }

    Logger.log(`[処理開始] Call ID: ${callId}`);

    let fileInfo = null;

    // ファイルパスが指定されている場合（優先）
    if (filePath && folderId) {
      Logger.log(`[ファイル検索] パス指定: ${filePath}`);
      try {
        fileInfo = FileIdUtilities.getFileIdFromPath(filePath, folderId, {
          throwOnNotFound: false
        });
      } catch (e) {
        Logger.log(`[警告] パス検索失敗、フォルダー内検索にフォールバック: ${e.message}`);
      }
    }

    // パス検索が失敗またはfolderIdのみ指定の場合
    if (!fileInfo && folderId) {
      Logger.log(`[ファイル検索] フォルダー内検索: ${callId}`);

      // 5秒待機（ファイルアップロード完了待ち）
      Utilities.sleep(5000);

      // サポートする音声形式
      const allowedExtensions = ['m4a', 'mp4', 'mp3', 'wav', 'ogg', '3gp', '3gpp'];

      fileInfo = FileIdUtilities.findFileInFolder(folderId, callId, {
        recursive: true,
        returnLatest: true,
        allowedExtensions: allowedExtensions
      });
    }

    if (!fileInfo) {
      throw new Error(`'${callId}' を含むファイルが見つかりません`);
    }

    Logger.log(`[ファイル発見] ${fileInfo.fileName} (ID: ${fileInfo.fileId})`);

    // ファイル形式の検証
    const supportedFormats = ['m4a', 'mp4', 'mp3', 'wav', 'ogg', '3gp', '3gpp'];
    const validation = FileIdUtilities.validateFileFormat(fileInfo.fileName, supportedFormats);

    let rowData;
    let isSuccess = false;

    if (validation.isValid) {
      Logger.log(`[対応形式] ${validation.extension} (${validation.mimeType})`);

      rowData = {
        "call_id": callId,
        "recording_file_id": fileInfo.fileId,
        "recording_file_url": fileInfo.fileUrl,
        "file_name": fileInfo.fileName,
        "file_size": fileInfo.size,
        "mime_type": fileInfo.mimeType,
        "created_date": fileInfo.createdDate,
        "status": "処理中"
      };
      isSuccess = true;

    } else {
      Logger.log(`[非対応形式] ${validation.extension}`);

      rowData = {
        "call_id": callId,
        "status": "エラー",
        "error_details": `非対応のファイル形式です：${fileInfo.fileName} (形式: ${validation.extension || '不明'})`
      };
    }

    // AppSheet APIで更新
    const config = {
      appId: APP_ID,
      tableName: TABLE_NAME,
      accessKey: ACCESS_KEY
    };

    const apiResult = FileIdUtilities.updateAppSheetWithFileInfo(config, "Edit", [rowData]);

    // 実行時間計算
    const executionTime = (new Date() - startTime) / 1000;

    // 実行ログ記録
    if (isSuccess) {
      ExecutionLogger.success(
        'Appsheet_通話_ファイルID取得',
        callId,
        `ファイルID取得成功: ${fileInfo.fileName}`,
        executionTime, { callId: callId, folderId: folderId, filePath: filePath });

      Logger.log(`[処理完了] ${executionTime}秒`);

      // 成功通知（必要に応じて）
      if (SEND_SUCCESS_EMAIL) {
        Logger.log(`[通知] 処理完了メール送信: ${EMAIL_RECIPIENT}`);
      }

    } else {
      ExecutionLogger.warning(
        'Appsheet_通話_ファイルID取得',
        callId,
        `非対応ファイル形式: ${fileInfo.fileName}`,
        executionTime, { callId: callId, folderId: folderId, filePath: filePath });
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      callId: callId,
      fileId: fileInfo.fileId,
      fileUrl: fileInfo.fileUrl,
      fileName: fileInfo.fileName,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const executionTime = (new Date() - startTime) / 1000;

    Logger.log(`[エラー] ${error.toString()}`);
    Logger.log(`[スタックトレース] ${error.stack}`);

    // エラーログ記録
    ExecutionLogger.error(
      'Appsheet_通話_ファイルID取得',
      callId || 'ID不明',
      error.message,
      error,
      executionTime,
      { callId: callId, folderId: folderId, filePath: filePath }
    );

    // AppSheetエラー記録
    handleScriptError(callId, error.toString());

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      callId: callId,
      error: error.toString(),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
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

  return CommonTest.runTest((params) => processRequest(params.callId, params.folderId, params.filePath), testParams, 'Appsheet_通話_ファイルID取得');
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
