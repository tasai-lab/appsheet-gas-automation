/**
 * AppSheet統合モジュール
 * AppSheet APIを使用したデータ更新
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-20
 */

/**
 * 処理成功時にAppSheetを更新
 * 分析IDに対応するレコードのステータス、回答、要約を更新
 *
 * @param {string} analysisId - 分析ID
 * @param {string} answer - 詳細な回答
 * @param {string} summary - 回答の要約
 */
function updateOnSuccess(analysisId, answer, summary) {
  const rowData = {
    "analysis_id": analysisId,
    "status": STATUS.COMPLETED,
    "response_text": answer,
    "summary": summary
  };

  callAppSheetApi({
    Action: "Edit",
    Properties: {
      "Locale": CONFIG.APPSHEET.LOCALE
    },
    Rows: [rowData]
  });
}

/**
 * 処理失敗時にAppSheetを更新
 * 分析IDに対応するレコードのステータスとエラーメッセージを更新
 *
 * @param {string} analysisId - 分析ID
 * @param {string} errorMessage - エラーメッセージ
 */
function updateOnError(analysisId, errorMessage) {
  const rowData = {
    "analysis_id": analysisId,
    "status": STATUS.ERROR,
    "response_text": `処理中にエラーが発生しました:\n${errorMessage.substring(0, 2000)}`
  };

  callAppSheetApi({
    Action: "Edit",
    Properties: {
      "Locale": CONFIG.APPSHEET.LOCALE
    },
    Rows: [rowData]
  });
}

/**
 * AppSheet APIを呼び出し
 * 指定されたペイロードでAppSheet APIのActionエンドポイントを呼び出し
 *
 * @param {Object} payload - APIリクエストペイロード
 * @param {string} payload.Action - アクション名（例: "Edit", "Add", "Delete"）
 * @param {Object} payload.Properties - プロパティ（Localeなど）
 * @param {Array<Object>} payload.Rows - 操作対象の行データ
 * @throws {Error} API呼び出しに失敗した場合
 */
function callAppSheetApi(payload) {
  const config = CONFIG.APPSHEET;

  const apiUrl = `${config.API_ENDPOINT}${config.APP_ID}/tables/${encodeURIComponent(config.TABLE_NAME)}/Action`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'ApplicationAccessKey': config.ACCESS_KEY
    },
    payload: JSON.stringify(payload)
  };

  try {
    fetchWithRetry(apiUrl, options, "AppSheet API");
  } catch (error) {
    throw new Error(`AppSheet APIの呼び出しに失敗しました: ${error.message}`);
  }
}
