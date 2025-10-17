





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

