/**
 * Appsheet_名刺取り込み - Driveサービス
 * 
 * Google Driveファイル操作
 * 
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-23
 */

/**
 * 名刺画像をペアリング（表面・裏面）
 * 
 * @param {GoogleAppsScript.Drive.FileIterator} files - ファイルイテレーター
 * @returns {Array<Object>} ペアリングされた名刺配列 [{front: File, back: File | null}]
 */
function pairBusinessCards(files) {
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logInfo(`🗂️  名刺ペアリング処理開始`);
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const cards = {};
  let fileCount = 0;
  
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    fileCount++;
    
    // ベース名を取得（_001を除去）
    const baseName = name.replace(/_001\.(jpg|jpeg|png)$/i, '');
    
    // カードエントリーを初期化
    if (!cards[baseName]) {
      cards[baseName] = {
        front: null,
        back: null
      };
    }
    
    // 表面・裏面を判定
    if (name.includes('_001.')) {
      cards[baseName].back = file;
      logDebug(`裏面発見: ${name} (ベース名: ${baseName})`);
    } else {
      cards[baseName].front = file;
      logDebug(`表面発見: ${name} (ベース名: ${baseName})`);
    }
  }
  
  // 表面が存在するカードのみを抽出
  const pairedCards = Object.values(cards).filter(card => card.front);
  
  logInfo(`✅ ペアリング完了: 合計${fileCount}ファイル → ${pairedCards.length}組の名刺`);
  
  // 両面カウント
  const doubleSided = pairedCards.filter(card => card.back).length;
  logInfo(`   両面: ${doubleSided}組, 片面: ${pairedCards.length - doubleSided}組`);
  
  // 詳細デバッグ: 最初の3組を表示
  if (LOG_CONFIG.enableDetailedLogs && pairedCards.length > 0) {
    logDebug('ペアリング詳細（最初の3組）:');
    for (let i = 0; i < Math.min(3, pairedCards.length); i++) {
      logDebug(`  [${i + 1}] 表面: ${pairedCards[i].front.getName()}, 裏面: ${pairedCards[i].back ? pairedCards[i].back.getName() : 'なし'}`);
    }
  }
  
  return pairedCards;
}

/**
 * ソースフォルダーを取得
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function getSourceFolder() {
  try {
    const folder = DriveApp.getFolderById(DRIVE_CONFIG.sourceFolderId);
    logDebug(`ソースフォルダー取得成功: ${folder.getName()}`);
    return folder;
  } catch (error) {
    logError('ソースフォルダー取得エラー', error);
    throw new Error(`ソースフォルダーが見つかりません: ${DRIVE_CONFIG.sourceFolderId}`);
  }
}

/**
 * 移動先フォルダーを取得
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function getDestinationFolder() {
  try {
    const folder = DriveApp.getFolderById(DRIVE_CONFIG.destinationFolderId);
    logDebug(`移動先フォルダー取得成功: ${folder.getName()}`);
    return folder;
  } catch (error) {
    logError('移動先フォルダー取得エラー', error);
    throw new Error(`移動先フォルダーが見つかりません: ${DRIVE_CONFIG.destinationFolderId}`);
  }
}

/**
 * ファイルを移動・リネーム
 * 
 * @param {GoogleAppsScript.Drive.File} file - 移動するファイル
 * @param {GoogleAppsScript.Drive.Folder} destinationFolder - 移動先フォルダー
 * @param {string} newFileName - 新しいファイル名
 * @returns {GoogleAppsScript.Drive.File} 移動後のファイル
 */
function moveAndRenameFile(file, destinationFolder, newFileName) {
  try {
    const originalName = file.getName();
    const fileId = file.getId();
    
    logDebug(`ファイル移動開始:`, {
      originalName: originalName,
      newFileName: newFileName,
      fileId: fileId,
      destinationFolder: destinationFolder.getName()
    });
    
    // リネーム
    file.setName(newFileName);
    logDebug(`  ✓ リネーム完了: ${originalName} → ${newFileName}`);
    
    // 移動
    file.moveTo(destinationFolder);
    logDebug(`  ✓ 移動完了: ${destinationFolder.getName()}`);
    
    logDebug(`✅ ファイル移動完了: ${newFileName}`);
    
    return file;
    
  } catch (error) {
    logError(`ファイル移動エラー: ${file.getName()}`, error);
    throw error;
  }
}

/**
 * ファイルをアーカイブ（削除の代わりに archives フォルダーへ移動）
 * 共有ドライブでは削除権限がない場合があるため
 * 
 * @param {string} fileId - アーカイブするファイルID
 */
function archiveFile(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const fileName = file.getName();
    
    logDebug(`ファイルアーカイブ: ${fileName} (ID: ${fileId})`);
    
    // archivesフォルダーを取得または作成
    const archiveFolder = getOrCreateArchiveFolder();
    
    // ファイルを移動
    file.moveTo(archiveFolder);
    
    logDebug(`✅ ファイルアーカイブ完了: ${fileName} → ${archiveFolder.getName()}`);
    
  } catch (error) {
    logError(`ファイルアーカイブエラー: ${fileId}`, error);
    throw error;
  }
}

/**
 * アーカイブフォルダーを取得または作成
 * 
 * @returns {GoogleAppsScript.Drive.Folder} アーカイブフォルダー
 */
function getOrCreateArchiveFolder() {
  try {
    // 設定にarchiveFolderIdがある場合は使用
    if (DRIVE_CONFIG.archiveFolderId) {
      try {
        return DriveApp.getFolderById(DRIVE_CONFIG.archiveFolderId);
      } catch (e) {
        logDebug('設定されたarchiveFolderIdが見つかりません。自動作成を試みます。');
      }
    }
    
    // destinationFォルダー内でarchivesフォルダーを検索
    const destinationFolder = DriveApp.getFolderById(DRIVE_CONFIG.destinationFolderId);
    const folders = destinationFolder.getFoldersByName('archives');
    
    if (folders.hasNext()) {
      const archiveFolder = folders.next();
      logDebug(`archivesフォルダー発見: ${archiveFolder.getId()}`);
      return archiveFolder;
    }
    
    // 存在しない場合は作成
    logInfo('archivesフォルダーを作成します...');
    const newArchiveFolder = destinationFolder.createFolder('archives');
    logInfo(`✅ archivesフォルダー作成完了: ${newArchiveFolder.getId()}`);
    logInfo(`   このIDをconfig.gs の DRIVE_CONFIG.archiveFolderId に設定してください`);
    
    return newArchiveFolder;
    
  } catch (error) {
    logError('アーカイブフォルダー取得/作成エラー', error);
    throw error;
  }
}

/**
 * ファイル名を生成
 * 
 * @param {Object} info - 抽出された情報
 * @param {string} contactId - 連絡先ID
 * @param {boolean} isBack - 裏面かどうか
 * @returns {string} ファイル名
 */
function generateFileName(info, contactId, isBack = false) {
  const lastName = info.last_name || '';
  const firstName = info.first_name || '';
  const lastNameKana = info.last_name_kana || '';
  const firstNameKana = info.first_name_kana || '';
  
  let fileName = `${lastName}${firstName}_${lastNameKana}${firstNameKana}_${contactId}`;
  
  if (isBack) {
    fileName += `${PROCESSING_CONFIG.backCardSuffix}`;
  }
  
  fileName += '.jpg';
  
  return fileName;
}

/**
 * AppSheet用ファイルパスを生成
 * 
 * @param {string} fileName - ファイル名
 * @returns {string} AppSheet用パス
 */
function generateAppSheetFilePath(fileName) {
  return `${DRIVE_CONFIG.appsheetFolderPath}/${fileName}`;
}

/**
 * ファイルIDを取得
 * 
 * @param {GoogleAppsScript.Drive.File} file - ファイル
 * @returns {string} ファイルID
 */
function getFileId(file) {
  return file.getId();
}

/**
 * ファイルURLを取得
 * 
 * @param {GoogleAppsScript.Drive.File} file - ファイル
 * @returns {string} ファイルURL
 */
function getFileUrl(file) {
  return file.getUrl();
}

/**
 * ファイルサイズを取得（KB）
 * 
 * @param {GoogleAppsScript.Drive.File} file - ファイル
 * @returns {number} ファイルサイズ（KB）
 */
function getFileSizeKB(file) {
  return Math.round(file.getSize() / 1024);
}

/**
 * 名刺処理結果オブジェクトを構築
 * 
 * @param {string} action - 実行されたアクション（CREATE/UPDATE/DELETE）
 * @param {string} contactId - 連絡先ID
 * @param {Object} info - 抽出情報
 * @param {string} frontFileName - 表面ファイル名
 * @param {string} [backFileName] - 裏面ファイル名
 * @returns {Object} 処理結果
 */
function buildProcessingResult(action, contactId, info, frontFileName, backFileName = null) {
  return {
    action: action,
    contactId: contactId,
    fullName: `${info.last_name} ${info.first_name}`,
    orgName: info.card_org_name,
    frontFileName: frontFileName,
    backFileName: backFileName,
    timestamp: new Date().toISOString()
  };
}
