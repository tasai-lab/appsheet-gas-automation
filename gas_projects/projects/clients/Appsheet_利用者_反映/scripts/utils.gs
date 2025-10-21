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
