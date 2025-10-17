/**
 * Google Drive操作ユーティリティ
 * 音声ファイルの取得と検証を担当
 * 
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-17
 */

/**
 * 音声ファイルを取得してMIMEタイプを判定
 * Vertex AI パターンに準拠
 * 
 * @param {string} filePath - Google Driveのファイルパス（優先）
 * @param {string} fileId - Google DriveのファイルID（filePathが無い場合）
 * @returns {Object} - {blob: Blob, fileName: string, mimeType: string}
 * @throws {Error} - ファイルが見つからない、またはアクセスできない場合
 */
function getAudioFile(filePath, fileId) {
  try {
    let actualFileId = fileId;
    
    // filePathが指定されている場合、IDを解決
    if (filePath) {
      Logger.log(`[Drive] ファイルパスからID取得: ${filePath}`);
      const config = getConfig();
      
      if (!config.sharedDriveFolderId) {
        Logger.log('[Drive] ⚠️ 警告: SHARED_DRIVE_FOLDER_ID未設定、filePathを無視してfileIdを使用');
      } else {
        const pathResult = getFileIdFromPath(filePath, config.sharedDriveFolderId);
        actualFileId = pathResult.fileId;
        Logger.log(`[Drive] パス解決成功: ${actualFileId}`);
      }
    }
    
    if (!actualFileId) {
      throw new Error('filePathまたはfileIdが必要です');
    }
    
    Logger.log(`[Drive] ファイル取得開始: ${actualFileId}`);
    
    const file = DriveApp.getFileById(actualFileId);
    const blob = file.getBlob();
    const fileName = file.getName();
    
    // 拡張子からMIMEタイプを判定
    const mimeType = determineMimeType(fileName, blob);
    
    Logger.log(`[Drive] ファイル取得成功: ${fileName}`);
    Logger.log(`[Drive] MIMEタイプ: ${mimeType}`);
    
    return {
      blob: blob,
      fileName: fileName,
      mimeType: mimeType
    };
    
  } catch (error) {
    Logger.log(`[Drive] エラー: ${error.message}`);
    throw new Error(`ファイル取得エラー: ${error.message}`);
  }
}

/**
 * ファイル名と拡張子からMIMEタイプを判定
 * 
 * @param {string} fileName - ファイル名
 * @param {GoogleAppsScript.Base.Blob} blob - ファイルのBlob
 * @returns {string} - 判定されたMIMEタイプ
 */
function determineMimeType(fileName, blob) {
  const extension = fileName.includes('.') 
    ? fileName.split('.').pop().toLowerCase() 
    : '';
  
  // 音声/動画ファイルのMIMEタイプマッピング
  const mimeTypeMap = {
    // 音声ファイル
    'm4a': 'audio/mp4',
    'mp4': 'audio/mp4',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    'opus': 'audio/opus',
    'webm': 'audio/webm',
    // 動画ファイル（音声として処理可能）
    '3gp': 'video/3gpp',
    '3gpp': 'video/3gpp',
    'mov': 'video/quicktime'
  };
  
  // 拡張子マッピングから取得
  if (mimeTypeMap[extension]) {
    Logger.log(`[Drive] MIMEタイプ判定（拡張子）: ${extension} → ${mimeTypeMap[extension]}`);
    return mimeTypeMap[extension];
  }
  
  // Blobから取得
  const blobMimeType = blob.getContentType();
  Logger.log(`[Drive] MIMEタイプ判定（Blob）: ${blobMimeType}`);
  
  return blobMimeType;
}

/**
 * 音声ファイルをBase64エンコード
 * 
 * @param {GoogleAppsScript.Base.Blob} blob - 音声ファイルのBlob
 * @returns {string} - Base64エンコードされた文字列
 */
function encodeAudioToBase64(blob) {
  const startTime = new Date().getTime();
  const base64Data = Utilities.base64Encode(blob.getBytes());
  const endTime = new Date().getTime();
  
  const encodingTime = endTime - startTime;
  const sizeKB = (base64Data.length / 1024).toFixed(2);
  
  Logger.log(`[Drive] Base64エンコード完了: ${encodingTime}ms, サイズ: ${sizeKB}KB`);
  
  return base64Data;
}

/**
 * ファイルサイズを取得してMB単位で返す
 * 
 * @param {GoogleAppsScript.Base.Blob} blob - ファイルのBlob
 * @returns {number} - ファイルサイズ（MB単位）
 */
function getFileSizeMB(blob) {
  return (blob.getBytes().length / 1024 / 1024);
}

/**
 * ファイルサイズをチェック
 * 
 * @param {GoogleAppsScript.Base.Blob} blob - ファイルのBlob
 * @param {number} maxSizeMB - 最大サイズ（MB）
 * @throws {Error} - サイズ制限を超えた場合
 */
function validateFileSize(blob, maxSizeMB = 20) {
  const fileSizeMB = getFileSizeMB(blob);
  
  Logger.log(`[Drive] ファイルサイズ: ${fileSizeMB.toFixed(2)}MB`);
  
  if (fileSizeMB > maxSizeMB) {
    throw new Error(
      `ファイルサイズが制限を超えています: ${fileSizeMB.toFixed(2)}MB（上限: ${maxSizeMB}MB）`
    );
  }
}

/**
 * ファイルパスからファイルIDを取得（共有ドライブ対応）
 * 
 * @param {string} filePath - ファイルパス（例: "2024/10/recording.m4a"）
 * @param {string} baseFolderId - ベースフォルダーID（共有ドライブのルートフォルダー）
 * @returns {Object} - {fileId: string, fileUrl: string}
 * @throws {Error} - ファイルが見つからない場合
 */
function getFileIdFromPath(filePath, baseFolderId) {
  try {
    Logger.log(`[Drive] ファイルパス解決開始: ${filePath}`);
    Logger.log(`[Drive] ベースフォルダーID: ${baseFolderId}`);
    
    // パスを分割
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
        throw new Error(
          `フォルダーが見つかりません: ${folderName} ` +
          `(パス: ${pathParts.slice(0, i + 1).join('/')})`
        );
      }
      
      currentFolder = folders.next();
      Logger.log(`[Drive] フォルダー発見: ${currentFolder.getName()}`);
    }
    
    // 最後の要素（ファイル名）を取得
    const fileName = pathParts[pathParts.length - 1];
    Logger.log(`[Drive] ファイル検索: ${fileName}`);
    
    const files = currentFolder.getFilesByName(fileName);
    
    if (!files.hasNext()) {
      throw new Error(
        `ファイルが見つかりません: ${fileName} ` +
        `(フォルダー: ${currentFolder.getName()})`
      );
    }
    
    const file = files.next();
    const fileId = file.getId();
    const fileUrl = file.getUrl();
    
    Logger.log(`[Drive] ファイル発見: ${file.getName()}`);
    Logger.log(`[Drive] ファイルID: ${fileId}`);
    
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
