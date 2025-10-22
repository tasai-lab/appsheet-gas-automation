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
 * processClientQAの結果をAppSheetに保存
 * 処理結果をAppSheet APIで更新または追加
 *
 * @param {Object} result - processClientQAの戻り値
 * @param {string} result.answer - 詳細な回答
 * @param {string} result.summary - 回答の要約
 * @param {string} analysisId - 分析ID（必須）
 * @param {string} action - アクション（'Edit'=更新、'Add'=追加、デフォルト: 'Edit'）
 *
 * @example
 * const result = processClientQA(documentText, promptText);
 * saveResultToAppSheet(result, 'ANALYSIS-12345');
 *
 * @example
 * // 新規レコードとして追加
 * const result = processClientQA(documentText, promptText);
 * saveResultToAppSheet(result, 'NEW-ANALYSIS-12345', 'Add');
 */
function saveResultToAppSheet(result, analysisId, action = 'Edit') {
  Logger.log(`[DEBUG][saveResultToAppSheet] === 関数開始 ===`);
  Logger.log(`[DEBUG][saveResultToAppSheet] パラメータ:`);
  Logger.log(`[DEBUG][saveResultToAppSheet]   - analysisId: ${analysisId} (type: ${typeof analysisId})`);
  Logger.log(`[DEBUG][saveResultToAppSheet]   - action: ${action} (type: ${typeof action})`);
  Logger.log(`[DEBUG][saveResultToAppSheet]   - result存在: ${!!result}`);

  if (result) {
    Logger.log(`[DEBUG][saveResultToAppSheet]   - result.answer存在: ${!!result.answer}, 長さ: ${result.answer ? result.answer.length : 0}文字`);
    Logger.log(`[DEBUG][saveResultToAppSheet]   - result.summary存在: ${!!result.summary}, 長さ: ${result.summary ? result.summary.length : 0}文字`);
    Logger.log(`[DEBUG][saveResultToAppSheet]   - result.usageMetadata: ${JSON.stringify(result.usageMetadata || null)}`);
  }

  // パラメータバリデーション
  Logger.log(`[DEBUG][saveResultToAppSheet] パラメータバリデーション開始`);

  if (!result || !result.answer || !result.summary) {
    Logger.log(`[DEBUG][saveResultToAppSheet] ❌ バリデーションエラー: 結果オブジェクトが不正`);
    throw new Error('結果オブジェクトにanswerまたはsummaryが含まれていません');
  }
  Logger.log(`[DEBUG][saveResultToAppSheet] ✅ result検証OK`);

  if (!analysisId || analysisId.trim() === '') {
    Logger.log(`[DEBUG][saveResultToAppSheet] ❌ バリデーションエラー: analysisIdが不正`);
    throw new Error('analysisIdは必須です');
  }
  Logger.log(`[DEBUG][saveResultToAppSheet] ✅ analysisId検証OK`);

  // rowData構築
  Logger.log(`[DEBUG][saveResultToAppSheet] rowData構築中...`);
  const rowData = {
    "analysis_id": analysisId,
    "status": STATUS.COMPLETED,
    "response_text": result.answer,
    "summary": result.summary
  };
  Logger.log(`[DEBUG][saveResultToAppSheet] rowData構築完了:`);
  Logger.log(`[DEBUG][saveResultToAppSheet]   - analysis_id: ${rowData.analysis_id}`);
  Logger.log(`[DEBUG][saveResultToAppSheet]   - status: ${rowData.status}`);
  Logger.log(`[DEBUG][saveResultToAppSheet]   - response_text: ${rowData.response_text.substring(0, 100)}...`);
  Logger.log(`[DEBUG][saveResultToAppSheet]   - summary: ${rowData.summary.substring(0, 100)}...`);

  Logger.log(`[AppSheet] ${action}アクションで保存開始: ${analysisId}`);

  // AppSheet API呼び出し
  Logger.log(`[DEBUG][saveResultToAppSheet] AppSheet API呼び出し実行中...`);
  try {
    callAppSheetApi({
      Action: action,
      Properties: {
        "Locale": CONFIG.APPSHEET.LOCALE
      },
      Rows: [rowData]
    });
    Logger.log(`[DEBUG][saveResultToAppSheet] ✅ AppSheet API呼び出し成功`);
  } catch (error) {
    Logger.log(`[DEBUG][saveResultToAppSheet] ❌ AppSheet API呼び出しエラー: ${error.toString()}`);
    throw error;
  }

  Logger.log(`[AppSheet] 保存完了: ${analysisId}`);
  Logger.log(`[DEBUG][saveResultToAppSheet] === 関数終了 ===`);
}


/**
 * 質疑応答処理とAppSheet保存を一度に実行（便利関数）
 * processClientQA + saveResultToAppSheetを連続実行
 *
 * @param {string} documentText - 参照ドキュメント（必須）
 * @param {string} promptText - ユーザーの質問（必須）
 * @param {string} analysisId - 分析ID（必須）
 * @param {string} action - AppSheetアクション（デフォルト: 'Edit'）
 *
 * @return {Object} 処理結果
 * @return {string} return.answer - 詳細な回答
 * @return {string} return.summary - 回答の要約
 * @return {Object} return.usageMetadata - API使用量情報
 * @return {string} return.analysisId - 分析ID
 *
 * @example
 * // 既存レコードを更新
 * const result = processClientQAAndSave(
 *   '利用者情報...',
 *   '質問内容...',
 *   'ANALYSIS-12345'
 * );
 *
 * @example
 * // 新規レコードとして追加
 * const result = processClientQAAndSave(
 *   '利用者情報...',
 *   '質問内容...',
 *   'NEW-ANALYSIS-12345',
 *   'Add'
 * );
 */
function processClientQAAndSave(documentText, promptText, analysisId, action = 'Edit') {
  const logger = createLogger('Appsheet_利用者_質疑応答');
  let status = '成功';

  try {
    logger.info(`質疑応答処理とAppSheet保存を開始: ${analysisId}`);

    // 質疑応答処理（AppSheet更新なし）
    const result = processClientQA(documentText, promptText, analysisId, false);

    // AppSheetに保存
    saveResultToAppSheet(result, analysisId, action);

    logger.success(`質疑応答処理とAppSheet保存が完了: ${analysisId}`);

    return result;

  } catch (error) {
    status = 'エラー';
    logger.error(`質疑応答処理またはAppSheet保存エラー: ${error.toString()}`, {
      stack: error.stack,
      analysisId: analysisId
    });
    throw error;

  } finally {
    logger.saveToSpreadsheet(status, analysisId);
  }
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
  Logger.log(`[DEBUG][callAppSheetApi] === 関数開始 ===`);

  const config = CONFIG.APPSHEET;

  // API URL構築
  Logger.log(`[DEBUG][callAppSheetApi] API URL構築中...`);
  const apiUrl = `${config.API_ENDPOINT}${config.APP_ID}/tables/${encodeURIComponent(config.TABLE_NAME)}/Action`;
  Logger.log(`[DEBUG][callAppSheetApi] API URL: ${apiUrl}`);
  Logger.log(`[DEBUG][callAppSheetApi]   - API_ENDPOINT: ${config.API_ENDPOINT}`);
  Logger.log(`[DEBUG][callAppSheetApi]   - APP_ID: ${config.APP_ID}`);
  Logger.log(`[DEBUG][callAppSheetApi]   - TABLE_NAME: ${config.TABLE_NAME}`);

  // ペイロード詳細ログ
  Logger.log(`[DEBUG][callAppSheetApi] ペイロード詳細:`);
  Logger.log(`[DEBUG][callAppSheetApi]   - Action: ${payload.Action}`);
  Logger.log(`[DEBUG][callAppSheetApi]   - Locale: ${payload.Properties ? payload.Properties.Locale : 'なし'}`);
  Logger.log(`[DEBUG][callAppSheetApi]   - Rows数: ${payload.Rows ? payload.Rows.length : 0}`);

  if (payload.Rows && payload.Rows.length > 0) {
    payload.Rows.forEach((row, index) => {
      Logger.log(`[DEBUG][callAppSheetApi]   - Row[${index}]:`);
      for (const key in row) {
        const value = row[key];
        const displayValue = typeof value === 'string' && value.length > 100
          ? value.substring(0, 100) + '...'
          : value;
        Logger.log(`[DEBUG][callAppSheetApi]       - ${key}: ${displayValue}`);
      }
    });
  }

  // リクエストオプション構築
  Logger.log(`[DEBUG][callAppSheetApi] リクエストオプション構築中...`);
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'ApplicationAccessKey': config.ACCESS_KEY
    },
    payload: JSON.stringify(payload)
  };

  Logger.log(`[DEBUG][callAppSheetApi] リクエストオプション:`);
  Logger.log(`[DEBUG][callAppSheetApi]   - method: ${options.method}`);
  Logger.log(`[DEBUG][callAppSheetApi]   - contentType: ${options.contentType}`);
  Logger.log(`[DEBUG][callAppSheetApi]   - headers.ApplicationAccessKey: ${config.ACCESS_KEY ? '***設定済み***' : '未設定'}`);
  Logger.log(`[DEBUG][callAppSheetApi]   - payload長: ${options.payload.length}文字`);

  // API呼び出し実行
  Logger.log(`[DEBUG][callAppSheetApi] fetchWithRetry実行中...`);
  const startTime = new Date();

  try {
    const response = fetchWithRetry(apiUrl, options, "AppSheet API");
    const duration = new Date() - startTime;

    Logger.log(`[DEBUG][callAppSheetApi] ✅ API呼び出し成功 (${duration}ms)`);

    if (response) {
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      Logger.log(`[DEBUG][callAppSheetApi] レスポンス詳細:`);
      Logger.log(`[DEBUG][callAppSheetApi]   - ステータスコード: ${responseCode}`);
      Logger.log(`[DEBUG][callAppSheetApi]   - レスポンステキスト: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`);
    }

    Logger.log(`[DEBUG][callAppSheetApi] === 関数終了 ===`);
    return response;

  } catch (error) {
    const duration = new Date() - startTime;
    Logger.log(`[DEBUG][callAppSheetApi] ❌ API呼び出しエラー (${duration}ms)`);
    Logger.log(`[DEBUG][callAppSheetApi] エラー詳細:`);
    Logger.log(`[DEBUG][callAppSheetApi]   - エラーメッセージ: ${error.message}`);
    Logger.log(`[DEBUG][callAppSheetApi]   - エラータイプ: ${error.name}`);
    if (error.stack) {
      Logger.log(`[DEBUG][callAppSheetApi]   - スタックトレース: ${error.stack}`);
    }

    throw new Error(`AppSheet APIの呼び出しに失敗しました: ${error.message}`);
  }
}
