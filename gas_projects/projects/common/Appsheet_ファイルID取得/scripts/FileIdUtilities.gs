/**
 * ファイルID・URL取得ユーティリティ
 *
 * 共有ドライブ対応のファイル検索機能を提供
 *
 * @version 1.0.0
 * @date 2025-10-21
 */

/**
 * ファイルパスからファイルIDとURLを取得
 *
 * @param {string} baseFolderId - 起点となるフォルダーID（共有ドライブ内のフォルダーIDを推奨）
 * @param {string} filePath - 起点フォルダーからの相対パス（例: "2025年/請求書/invoice.pdf"）
 * @returns {Object} {id: string, url: string} - ファイルIDとURL
 *
 * @example
 * const result = getFileIdAndUrl("1ABC123...", "2025年/請求書/invoice.pdf");
 * Logger.log(result.id);   // "1XYZ789..."
 * Logger.log(result.url);  // "https://drive.google.com/file/d/1XYZ789.../view"
 */
function getFileIdAndUrl(baseFolderId, filePath) {
  try {
    // パラメータ検証
    if (!baseFolderId || typeof baseFolderId !== 'string') {
      throw new Error('baseFolderIdは必須です（文字列）');
    }
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('filePathは必須です（文字列）');
    }

    Logger.log(`[FileIdUtilities] ファイル検索開始: baseFolderId=${baseFolderId}, filePath=${filePath}`);

    // ファイルパスを解析
    const pathParts = filePath.split('/').filter(p => p.trim()); // 空の要素を削除
    const fileName = pathParts.pop(); // 最後の要素がファイル名

    if (!fileName) {
      throw new Error('filePathからファイル名を取得できませんでした');
    }

    // 起点フォルダーを取得（共有ドライブ対応）
    let currentFolder = getFolderByIdSafe_(baseFolderId);

    Logger.log(`[FileIdUtilities] 起点フォルダー: ${currentFolder.getName()} (ID: ${baseFolderId})`);

    // フォルダーパスを辿る
    for (const folderName of pathParts) {
      Logger.log(`[FileIdUtilities] フォルダー検索: ${folderName}`);

      const folders = currentFolder.getFoldersByName(folderName);

      if (!folders.hasNext()) {
        throw new Error(`フォルダーが見つかりません: "${folderName}" (親フォルダー: "${currentFolder.getName()}")`);
      }

      currentFolder = folders.next();
      Logger.log(`[FileIdUtilities] フォルダー発見: ${currentFolder.getName()} (ID: ${currentFolder.getId()})`);
    }

    // ファイルを検索
    Logger.log(`[FileIdUtilities] ファイル検索: ${fileName}`);

    const files = currentFolder.getFilesByName(fileName);

    if (!files.hasNext()) {
      throw new Error(`ファイルが見つかりません: "${fileName}" (フォルダー: "${currentFolder.getName()}")`);
    }

    const file = files.next();
    const fileId = file.getId();
    const fileUrl = file.getUrl();

    Logger.log(`[FileIdUtilities] ファイル発見成功: ${file.getName()} (ID: ${fileId})`);

    return {
      id: fileId,
      url: fileUrl
    };

  } catch (error) {
    Logger.log(`[FileIdUtilities] エラー: ${error.message}`);
    throw error;
  }
}

/**
 * フォルダーIDからフォルダーオブジェクトを取得（共有ドライブ対応）
 * @private
 * @param {string} folderId - フォルダーID
 * @returns {GoogleAppsScript.Drive.Folder} フォルダーオブジェクト
 */
function getFolderByIdSafe_(folderId) {
  try {
    // 通常のマイドライブまたは共有ドライブのフォルダーを取得
    return DriveApp.getFolderById(folderId);
  } catch (error) {
    // DriveApp.getFolderByIdで取得できない場合、Drive API v3を試みる
    try {
      if (typeof Drive !== 'undefined' && Drive.Files) {
        const file = Drive.Files.get(folderId, {
          supportsAllDrives: true,
          fields: 'id,name,mimeType'
        });

        if (file.mimeType !== 'application/vnd.google-apps.folder') {
          throw new Error(`指定されたIDはフォルダーではありません: ${folderId}`);
        }

        // DriveApp経由で再取得
        return DriveApp.getFolderById(folderId);
      }
    } catch (apiError) {
      Logger.log(`[FileIdUtilities] Drive API v3でも取得失敗: ${apiError.message}`);
    }

    throw new Error(`フォルダーが見つかりません: ${folderId} (共有ドライブのフォルダーの場合、Drive API v3を有効にしてください)`);
  }
}

/**
 * 複数ファイルのIDとURLを一括取得
 *
 * @param {string} baseFolderId - 起点となるフォルダーID
 * @param {Array<string>} filePaths - ファイルパスの配列
 * @returns {Array<Object>} [{path: string, id: string, url: string, error?: string}]
 *
 * @example
 * const results = getMultipleFileIdsAndUrls("1ABC123...", [
 *   "2025年/請求書/invoice1.pdf",
 *   "2025年/領収書/receipt1.pdf"
 * ]);
 */
function getMultipleFileIdsAndUrls(baseFolderId, filePaths) {
  if (!Array.isArray(filePaths)) {
    throw new Error('filePathsは配列である必要があります');
  }

  const results = [];

  for (const filePath of filePaths) {
    try {
      const result = getFileIdAndUrl(baseFolderId, filePath);
      results.push({
        path: filePath,
        id: result.id,
        url: result.url
      });
    } catch (error) {
      results.push({
        path: filePath,
        id: null,
        url: null,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * テスト関数
 */
function testGetFileIdAndUrl() {
  // ⚠️ 以下の値を実際の環境に合わせて変更してください
  const baseFolderId = "1ABC123...";  // 実際のフォルダーID
  const filePath = "2025年/請求書/test.pdf";  // 実際のファイルパス

  Logger.log('[TEST] ファイルID・URL取得テスト開始');
  Logger.log(`  baseFolderId: ${baseFolderId}`);
  Logger.log(`  filePath: ${filePath}`);

  try {
    const result = getFileIdAndUrl(baseFolderId, filePath);
    Logger.log('[TEST] 成功:');
    Logger.log(JSON.stringify(result, null, 2));
  } catch (error) {
    Logger.log('[TEST] エラー:');
    Logger.log(error.message);
    Logger.log(error.stack);
  }
}
