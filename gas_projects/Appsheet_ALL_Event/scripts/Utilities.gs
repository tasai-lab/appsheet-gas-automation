





/**

 * 与えられた値が「真」と見なせるかを判定するヘルパー関数。

 * "true", "TRUE", "Y", "y", "1", true などを true として評価します。

 * @param {*} value - 判定する値

 * @returns {boolean} 真と見なせる場合はtrue、それ以外はfalse

 */

function isTruthy(value) {

  if (typeof value === 'boolean') {

    return value;

  }

  if (typeof value === 'string') {

    const lowerCaseValue = value.toLowerCase().trim();

    return lowerCaseValue === 'true' || lowerCaseValue === 'y' || lowerCaseValue === '1';

  }

  return !!value; // 数値の1などもtrueと判定

}