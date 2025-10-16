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

 * Google Drive操作モジュール

 * 共有ドライブのファイル操作を管理

 * 

 * @author Fractal Group

 * @version 1.0.0

 * @date 2025-10-06

 */



/**

 * ファイルパスからファイルIDを取得（共有ドライブ対応）

 * 

 * @param {string} filePath - ファイルパス（例: "2024/10/recording.m4a"）

 * @param {string} baseFolderId - ベースフォルダーID（共有ドライブのルートフォルダー）

 * @return {Object} {fileId: string, fileUrl: string} または null

 */

function getFileIdFromPath(filePath, baseFolderId) {

  try {

    Logger.log(`[Drive] ファイルパス解決開始: ${filePath}`);

    Logger.log(`[Drive] ベースフォルダーID: ${baseFolderId}`);

    

    // パスを分割（例: "2024/10/recording.m4a" → ["2024", "10", "recording.m4a"]）

    const pathParts = filePath.split('/').filter(part => part.length > 0);

    

    if (pathParts.length === 0) {

      throw new Error('ファイルパスが空です');

    }

    

    // ベースフォルダーから開始

    let currentFolder = DriveApp.getFolderById(baseFolderId);

    

    // パスを辿る（最後の要素はファイル名なので除外）

    for (let i = 0; i < pathParts.length - 1; i++) {

      const folderName = pathParts[i];

      Logger.log(`[Drive] フォルダー検索: ${folderName}`);

      

      const folders = currentFolder.getFoldersByName(folderName);

      

      if (!folders.hasNext()) {

        throw new Error(`フォルダーが見つかりません: ${folderName} (パス: ${pathParts.slice(0, i + 1).join('/')})`);

      }

      

      currentFolder = folders.next();

      Logger.log(`[Drive] フォルダー発見: ${currentFolder.getName()} (ID: ${currentFolder.getId()})`);

    }

    

    // 最後の要素（ファイル名）を取得

    const fileName = pathParts[pathParts.length - 1];

    Logger.log(`[Drive] ファイル検索: ${fileName}`);

    

    const files = currentFolder.getFilesByName(fileName);

    

    if (!files.hasNext()) {

      throw new Error(`ファイルが見つかりません: ${fileName} (フォルダー: ${currentFolder.getName()})`);

    }

    

    const file = files.next();

    const fileId = file.getId();

    const fileUrl = file.getUrl();

    

    Logger.log(`[Drive] ファイル発見: ${file.getName()}`);

    Logger.log(`[Drive] ファイルID: ${fileId}`);

    Logger.log(`[Drive] ファイルURL: ${fileUrl}`);

    

    // 同名ファイルが複数ある場合は警告

    if (files.hasNext()) {

      Logger.log(`[Drive] ⚠️ 警告: 同名ファイルが複数存在します。最初のファイルを使用します。`);

    }

    

    return {

      fileId: fileId,

      fileUrl: fileUrl

    };

    

  } catch (error) {

    Logger.log(`[Drive] エラー: ${error.message}`);

    throw new Error(`ファイルパスの解決に失敗しました: ${error.message}`);

  }

}



/**

 * 共有ドライブのファイル情報を取得

 * 

 * @param {string} fileId - ファイルID

 * @return {Object} ファイル情報

 */

function getSharedDriveFileInfo(fileId) {

  try {

    const file = DriveApp.getFileById(fileId);

    

    return {

      id: file.getId(),

      name: file.getName(),

      mimeType: file.getMimeType(),

      size: file.getSize(),

      url: file.getUrl(),

      lastUpdated: file.getLastUpdated(),

      createdDate: file.getDateCreated()

    };

  } catch (error) {

    throw new Error(`ファイル情報の取得に失敗しました: ${error.message}`);

  }

}



/**

 * ファイルパス検証テスト

 * デバッグ用

 */

function testFilePathResolution() {

  const config = getConfig();

  

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('🧪 ファイルパス解決テスト');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('');

  

  // テストケース

  const testPaths = [

    '2024/10/test.m4a',

    'test.m4a',

    'subfolder/test.m4a'

  ];

  

  testPaths.forEach((testPath, index) => {

    Logger.log(`テスト ${index + 1}: ${testPath}`);

    

    try {

      const result = getFileIdFromPath(testPath, config.sharedDriveFolderId);

      Logger.log(`✅ 成功`);

      Logger.log(`  ファイルID: ${result.fileId}`);

      Logger.log(`  ファイルURL: ${result.fileUrl}`);

    } catch (error) {

      Logger.log(`❌ 失敗: ${error.message}`);

    }

    

    Logger.log('');

  });

  

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

}

