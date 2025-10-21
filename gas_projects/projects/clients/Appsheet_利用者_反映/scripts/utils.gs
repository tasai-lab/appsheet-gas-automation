/**
 * ユーティリティ関数モジュール
 *
 * 汎用的なヘルパー関数を提供
 *
 * @version 1.0.0
 * @date 2025-10-21
 */

// ========================================
// 日付計算
// ========================================

/**
 * 生年月日から年齢を計算する
 *
 * @param {string} birthDateString - 生年月日（YYYY/MM/DD形式）
 * @return {number|null} 年齢（歳）。無効な日付の場合はnull
 */
function calculateAge(birthDateString) {
  // birthDateString が null または空文字列の場合は null を返す
  if (!birthDateString) return null;

  const today = new Date();
  const birthDate = new Date(birthDateString);

  // 日付として無効な場合は null を返す
  if (isNaN(birthDate.getTime())) return null;

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();

  // 今年の誕生日がまだ来ていない場合は1歳引く
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

// ========================================
// Google Driveファイル操作
// ========================================

/**
 * ファイルパスまたはURLからGoogle DriveのファイルIDを取得
 *
 * @param {string} filePathOrUrl - ファイルパス、URL、またはファイルID
 * @return {string|null} ファイルID。見つからない場合はnull
 *
 * @example
 * // URLの場合
 * getFileIdFromPath("https://drive.google.com/file/d/1ABC123XYZ/view")
 * // → "1ABC123XYZ"
 *
 * // パスの場合
 * getFileIdFromPath("マイドライブ/書類/契約書.pdf")
 * // → ファイルIDを検索して返す
 *
 * // 既にファイルIDの場合
 * getFileIdFromPath("1ABC123XYZ")
 * // → "1ABC123XYZ" (そのまま返す)
 */
function getFileIdFromPath(filePathOrUrl) {
  if (!filePathOrUrl || typeof filePathOrUrl !== 'string') {
    Logger.log('[getFileIdFromPath] ファイルパス/URLが未指定です');
    return null;
  }

  const trimmed = filePathOrUrl.trim();

  // 1. URLの場合: 正規表現でファイルIDを抽出
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return extractFileIdFromUrl(trimmed);
  }

  // 2. ファイルIDの形式かチェック（英数字とハイフン、アンダースコアのみ、20文字以上）
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    Logger.log(`[getFileIdFromPath] ファイルIDと判断: ${trimmed}`);
    return trimmed;
  }

  // 3. パス形式の場合: ファイル名で検索
  return findFileIdByPath(trimmed);
}

/**
 * URLからファイルIDを抽出
 * @private
 */
function extractFileIdFromUrl(url) {
  // Google DriveのURL形式:
  // https://drive.google.com/file/d/FILE_ID/view
  // https://drive.google.com/open?id=FILE_ID
  // https://docs.google.com/document/d/FILE_ID/edit
  // https://docs.google.com/spreadsheets/d/FILE_ID/edit

  // /d/FILE_ID/ パターン
  let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    Logger.log(`[extractFileIdFromUrl] URLからファイルIDを抽出: ${match[1]}`);
    return match[1];
  }

  // ?id=FILE_ID パターン
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) {
    Logger.log(`[extractFileIdFromUrl] URLからファイルIDを抽出: ${match[1]}`);
    return match[1];
  }

  Logger.log(`[extractFileIdFromUrl] URLからファイルIDを抽出できませんでした: ${url}`);
  return null;
}

/**
 * ファイルパスからファイルIDを検索
 * @private
 */
function findFileIdByPath(filePath) {
  try {
    // パスを分割（/ または \ で分割）
    const parts = filePath.split(/[/\\]/).filter(p => p.trim() !== '');

    if (parts.length === 0) {
      Logger.log('[findFileIdByPath] 無効なファイルパスです');
      return null;
    }

    // 最後の部分がファイル名
    const fileName = parts[parts.length - 1];
    Logger.log(`[findFileIdByPath] ファイル名で検索: ${fileName}`);

    // ファイル名で検索
    const files = DriveApp.getFilesByName(fileName);

    if (!files.hasNext()) {
      Logger.log(`[findFileIdByPath] ファイルが見つかりません: ${fileName}`);
      return null;
    }

    // フォルダパスが指定されている場合は、パスが一致するファイルを探す
    if (parts.length > 1) {
      while (files.hasNext()) {
        const file = files.next();
        const fullPath = getFilePath(file);

        // パスの末尾が一致するかチェック
        if (fullPath.endsWith(filePath) || fullPath.endsWith(filePath.replace(/\\/g, '/'))) {
          Logger.log(`[findFileIdByPath] ファイルIDを取得: ${file.getId()}`);
          return file.getId();
        }
      }

      Logger.log(`[findFileIdByPath] パスが一致するファイルが見つかりません: ${filePath}`);
      return null;
    }

    // ファイル名のみの場合は最初に見つかったファイルを返す
    const file = files.next();
    Logger.log(`[findFileIdByPath] ファイルIDを取得: ${file.getId()}`);

    // 複数のファイルが見つかった場合は警告
    if (files.hasNext()) {
      Logger.log(`[WARNING] 同名のファイルが複数存在します。最初に見つかったファイルを使用します: ${fileName}`);
    }

    return file.getId();

  } catch (error) {
    Logger.log(`[findFileIdByPath] エラー: ${error.message}`);
    return null;
  }
}

/**
 * ファイルの完全パスを取得
 * @private
 */
function getFilePath(file) {
  const pathParts = [];
  const parents = file.getParents();

  // 親フォルダを辿る（再帰的）
  if (parents.hasNext()) {
    const parent = parents.next();
    pathParts.unshift(getFolderPath(parent));
  }

  pathParts.push(file.getName());
  return pathParts.join('/');
}

/**
 * フォルダの完全パスを取得
 * @private
 */
function getFolderPath(folder) {
  const pathParts = [];
  pathParts.push(folder.getName());

  const parents = folder.getParents();
  if (parents.hasNext()) {
    const parent = parents.next();
    if (parent.getName() !== 'My Drive') {
      pathParts.unshift(getFolderPath(parent));
    }
  }

  return pathParts.join('/');
}

// ========================================
// バリデーション
// ========================================

/**
 * 必須パラメータをチェックする
 *
 * @param {Object} params - パラメータオブジェクト
 * @param {Array<string>} requiredFields - 必須フィールド名の配列
 * @throws {Error} 必須パラメータが不足している場合
 */
function validateRequiredParams(params, requiredFields) {
  const missingFields = [];

  for (const field of requiredFields) {
    if (!params[field]) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw new Error(`必須パラメータが不足しています: ${missingFields.join(', ')}`);
  }
}
