/**

 * ファイルハンドリングモジュール (改善版)

 * Google DriveとCloud Storageの操作を担当

 * エラーハンドリングとロギングを強化

 */


/**

 * ファイルパスからファイルIDを取得する

 * @param {string} filePath - ファイルパス

 * @return {string} ファイルID

 * @throws {ValidationError|AppError} ファイルIDの取得に失敗

 */

function getFileIdFromPath(filePath) {

  return withErrorHandling(

    () => {

      // バリデーション

      const validPath = validateFilePath(filePath);

      logStructured(LOG_LEVEL.DEBUG, 'ファイルパス解析開始', { filePath: validPath });

      // パターン1: 完全なGoogle Drive URL

      const urlPattern = /\/d\/([a-zA-Z0-9_-]+)/;

      const urlMatch = validPath.match(urlPattern);

      if (urlMatch) {

        logStructured(LOG_LEVEL.INFO, 'URLパターンでファイルID取得', { fileId: urlMatch[1] });

        return urlMatch[1];

      }

      // パターン2: ファイルIDが直接渡された場合

      if (validPath.match(/^[a-zA-Z0-9_-]{20,}$/)) {

        logStructured(LOG_LEVEL.INFO, 'ファイルIDとして認識', { fileId: validPath });

        return validPath;

      }

      // パターン3: 共有ドライブのパス形式(フォルダ1/フォルダ2/ファイル名)

      if (validPath.includes('/')) {

        logStructured(LOG_LEVEL.INFO, '共有ドライブパス形式を検出');

        return getFileIdFromSharedDrivePath(validPath);

      }

      // パターン4: ファイル名で検索(マイドライブ)

      return searchFileByName(validPath);

    },

    'getFileIdFromPath',

    { filePath: filePath }

  );

}


/**

 * ファイル名でドライブ検索

 * @param {string} fileName - ファイル名

 * @return {string} ファイルID

 * @throws {AppError} ファイルが見つからない

 */

function searchFileByName(fileName) {

  logStructured(LOG_LEVEL.INFO, 'ファイル名で検索', { fileName: fileName });

  const files = DriveApp.getFilesByName(fileName);

  if (!files.hasNext()) {

    throw new AppError(

      ERROR_CODE.FILE_NOT_FOUND,

      ERROR_MESSAGES[ERROR_CODE.FILE_NOT_FOUND],

      { fileName: fileName }

    );

  }

  const file = files.next();

  const fileId = file.getId();

  // 同名ファイルが複数ある場合は警告

  if (files.hasNext()) {

    logStructured(LOG_LEVEL.WARN, '同名ファイルが複数存在', { 

      fileName: fileName,

      selectedFileId: fileId 

    });

  }

  logStructured(LOG_LEVEL.INFO, 'ファイルID取得成功', { fileId: fileId });

  return fileId;

}


/**

 * 共有ドライブのパスからファイルIDを取得する

 * @param {string} drivePath - 共有ドライブのパス(フォルダ1/フォルダ2/ファイル名)

 * @return {string} ファイルID

 * @throws {AppError} ファイル取得に失敗

 */

function getFileIdFromSharedDrivePath(drivePath) {

  return withErrorHandling(

    () => {

      const pathParts = drivePath.split('/').filter(part => part.trim() !== '');

      if (pathParts.length === 0) {

        throw new ValidationError(

          ERROR_CODE.INVALID_FILE_PATH,

          'パスが空です',

          { drivePath: drivePath }

        );

      }

      logStructured(LOG_LEVEL.INFO, '共有ドライブパス解析', { 

        path: pathParts.join(' > '),

        depth: pathParts.length

      });

      // ルートフォルダIDから開始

      let currentFolderId = SHARED_DRIVE_CONFIG.audioRootFolderId;

      // ファイル名は最後の要素

      const fileName = pathParts[pathParts.length - 1];

      const folderPath = pathParts.slice(0, -1);

      // フォルダを順番に辿る

      for (let i = 0; i < folderPath.length; i++) {

        currentFolderId = navigateToFolder(currentFolderId, folderPath[i], i, folderPath);

      }

      // 最終フォルダ内でファイルを検索

      return findFileInFolder(currentFolderId, fileName, drivePath);

    },

    'getFileIdFromSharedDrivePath',

    { drivePath: drivePath }

  );

}


/**

 * フォルダ内を移動

 * @param {string} parentFolderId - 親フォルダID

 * @param {string} folderName - 移動先フォルダ名

 * @param {number} depth - 現在の深さ

 * @param {Array} fullPath - 完全なパス

 * @return {string} フォルダID

 */

function navigateToFolder(parentFolderId, folderName, depth, fullPath) {

  logStructured(LOG_LEVEL.DEBUG, 'フォルダ検索', { 

    folderName: folderName,

    parentId: parentFolderId,

    depth: depth

  });

  const parentFolder = DriveApp.getFolderById(parentFolderId);

  const folders = parentFolder.getFoldersByName(folderName);

  if (!folders.hasNext()) {

    throw new AppError(

      ERROR_CODE.FILE_NOT_FOUND,

      `フォルダが見つかりません: ${folderName}`,

      { 

        folderName: folderName,

        pathSoFar: fullPath.slice(0, depth + 1).join('/'),

        parentFolderId: parentFolderId

      }

    );

  }

  const folder = folders.next();

  const folderId = folder.getId();

  logStructured(LOG_LEVEL.DEBUG, 'フォルダ発見', { 

    folderName: folderName,

    folderId: folderId 

  });

  // 同名フォルダが複数ある場合は警告

  if (folders.hasNext()) {

    logStructured(LOG_LEVEL.WARN, '同名フォルダが複数存在', { 

      folderName: folderName 

    });

  }

  return folderId;

}

/**

 * フォルダ内でファイルを検索

 * @param {string} folderId - フォルダID

 * @param {string} fileName - ファイル名

 * @param {string} fullPath - 完全なパス(エラー用)

 * @return {string} ファイルID

 */

function findFileInFolder(folderId, fileName, fullPath) {

  logStructured(LOG_LEVEL.DEBUG, 'ファイル検索', { 

    fileName: fileName,

    folderId: folderId 

  });

  const targetFolder = DriveApp.getFolderById(folderId);

  const files = targetFolder.getFilesByName(fileName);

  if (!files.hasNext()) {

    throw new AppError(

      ERROR_CODE.FILE_NOT_FOUND,

      ERROR_MESSAGES[ERROR_CODE.FILE_NOT_FOUND],

      { 

        fileName: fileName,

        fullPath: fullPath,

        folderId: folderId

      }

    );

  }

  const file = files.next();

  const fileId = file.getId();

  logStructured(LOG_LEVEL.INFO, '共有ドライブファイル発見', { 

    fileName: fileName,

    fileId: fileId 

  });

  // 同名ファイルが複数ある場合は警告

  if (files.hasNext()) {

    logStructured(LOG_LEVEL.WARN, '同名ファイルが複数存在', { fileName: fileName });

  }

  return fileId;

}


/**

 * Google DriveからファイルのBlobを取得

 * @param {string} fileId - ファイルID

 * @return {Object} {blob: Blob, fileName: string, mimeType: string, fileSize: number}

 * @throws {AppError} ファイル取得に失敗

 */

function getFileFromDrive(fileId) {

  return withErrorHandling(

    () => {

      const file = DriveApp.getFileById(fileId);

      const blob = file.getBlob();

      const fileName = file.getName();

      const fileSize = blob.getBytes().length;

      // ファイルサイズチェック

      validateFileSize(fileSize, fileName);

      // ファイル形式チェック

      const extension = validateFileFormat(fileName);

      // MIME type の決定

      let mimeType = blob.getContentType();

      if (AUDIO_CONFIG.mimeTypeMapping[extension]) {

        mimeType = AUDIO_CONFIG.mimeTypeMapping[extension];

      }

      logStructured(LOG_LEVEL.INFO, 'ファイル取得成功', {

        fileName: fileName,

        fileSizeMB: (fileSize / 1024 / 1024).toFixed(2),

        mimeType: mimeType,

        extension: extension

      });

      return {

        blob: blob,

        fileName: fileName,

        mimeType: mimeType,

        fileSize: fileSize

      };

    },

    'getFileFromDrive',

    { fileId: fileId }

  );

}


/**

 * Cloud Storageにファイルをアップロード

 * @param {Blob} blob - アップロードするBlob

 * @param {string} bucketName - バケット名

 * @param {string} fileName - ファイル名

 * @return {Object} {gsUri: string, fileName: string, bucket: string}

 * @throws {AppError} アップロードに失敗

 */

function uploadToCloudStorage(blob, bucketName, fileName) {

  return withErrorHandling(

    () => {

      // タイムスタンプ付きのユニークなファイル名を生成

      const timestamp = new Date().getTime();

      const uniqueFileName = `${timestamp}_${fileName}`;

      const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(uniqueFileName)}`;

      logStructured(LOG_LEVEL.INFO, 'Cloud Storageアップロード開始', { 

        fileName: uniqueFileName,

        bucket: bucketName,

        sizeMB: (blob.getBytes().length / 1024 / 1024).toFixed(2)

      });

      const options = {

        method: 'post',

        contentType: blob.getContentType(),

        payload: blob.getBytes(),

        headers: {

          'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`

        },

        muteHttpExceptions: true

      };

      const startTime = new Date().getTime();

      const response = UrlFetchApp.fetch(url, options);

      const duration = ((new Date().getTime() - startTime) / 1000).toFixed(2);

      const responseCode = response.getResponseCode();

      validateHttpResponse(responseCode, 'Cloud Storage Upload');

      const gsUri = `gs://${bucketName}/${uniqueFileName}`;

      logStructured(LOG_LEVEL.INFO, 'Cloud Storageアップロード成功', {

        gsUri: gsUri,

        durationSec: duration

      });

      return {

        gsUri: gsUri,

        fileName: uniqueFileName,

        bucket: bucketName

      };

    },

    'uploadToCloudStorage',

    { bucketName: bucketName, fileName: fileName }

  );

}


/**

 * Cloud Storageからファイルを削除

 * @param {string} bucketName - バケット名

 * @param {string} fileName - ファイル名

 * @return {boolean} 成功したかどうか

 */

function deleteFromCloudStorage(bucketName, fileName) {

  try {

    const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodeURIComponent(fileName)}`;

  const options = {

    method: 'delete',

    headers: {

      'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`

    },

    muteHttpExceptions: true

  };    const response = UrlFetchApp.fetch(url, options);

    const responseCode = response.getResponseCode();

    if (responseCode === HTTP_STATUS.NO_CONTENT || responseCode === HTTP_STATUS.NOT_FOUND) {

      logStructured(LOG_LEVEL.INFO, 'Cloud Storageファイル削除成功', { 

        fileName: fileName 

      });

      return true;

    }

    logStructured(LOG_LEVEL.WARN, 'Cloud Storageファイル削除警告', { 

      fileName: fileName,

      statusCode: responseCode 

    });

    return false;

  } catch (error) {

    logStructured(LOG_LEVEL.ERROR, 'Cloud Storageファイル削除エラー', {

      fileName: fileName,

      error: error.message

    });

    return false;

  }

}
