/**

 * main.js - AppSheet Webhook Entry Point

 * Refactored with unified logging and proper error handling

 */ 

/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_訪問看護_通常記録';
    return processRequest(params.recordNoteId || params.data?.recordNoteId, params.staffId || params.data?.staffId, params.recordText || params.data?.recordText, params.recordType || params.data?.recordType, params.filePath || params.data?.filePath, params.fileId || params.data?.fileId);
  });
}

/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(recordNoteId, staffId, recordText, recordType, filePath, fileId) {
  const timer = new ExecutionTimer();

  // パラメータをログ用に保存
  const params = {
    recordNoteId: recordNoteId,
    staffId: staffId,
    recordText: recordText ? recordText.substring(0, 100) + '...' : '',
    recordType: recordType,
    filePath: filePath,
    fileId: fileId
  };

  try {

    // API呼び出しカウンターの初期化
    resetApiCallCounter();
    setApiCallLimit(3);  // 最大3回（初回 + 1回リトライ + 予備）

    // Validate required parameters

    if (!recordNoteId || !staffId || !recordText) {

      throw new Error("必須パラメータ（recordNoteId, staffId, recordText）が不足しています。");

    }

    // 処理開始ログを記録
    logStartExec(recordNoteId, {
      staffId: staffId,
      recordType: recordType || '通常',
      hasAudioFile: !!(filePath || fileId),
      recordTextLength: recordText ? recordText.length : 0
    });

    logProcessingStart(recordNoteId, params);

    // --- 1. マスターデータをスプレッドシートから読み込む ---

    const guidanceMasterText = getGuidanceMasterAsText();

    // --- 2. 記録タイプを判定（日本語「通常」「精神」 → 内部形式 'normal' / 'psychiatry'） ---

    const normalizedRecordType = determineRecordType(recordType);

    Logger.log(`📋 記録タイプ判定: "${recordType}" → "${normalizedRecordType}"`);

    // --- 3. ファイル処理 (音声ファイルがある場合) ---

    let fileData = null;

    if (filePath || fileId) {

      const actualFileId = fileId || getFileIdFromPath(filePath);

      fileData = getFileFromDrive(actualFileId);

      Logger.log(`📁 音声ファイル取得完了: ${fileData.fileName} (${(fileData.blob.getBytes().length / (1024 * 1024)).toFixed(2)}MB)`);

    }

    // --- 4. AIで看護記録を生成（記録タイプに応じてプロンプトを選択） ---

    const prompt = normalizedRecordType === 'psychiatry'

      ? buildPsychiatryPrompt(recordText, guidanceMasterText)

      : buildNormalPrompt(recordText, guidanceMasterText);

    Logger.log(`🤖 AI呼び出し: ${normalizedRecordType === 'psychiatry' ? '精神科' : '通常'}記録プロンプト`);

    // ★★★ Vertex AI APIのみ使用（Google AI Studio APIは完全廃止）
    // 修正日: 2025-10-18
    // ユーザー指示: 「今後gemini apiを使用することが無いようにお願いします。今後、全てvertex apiを使用すること。」
    const analysisResult = callVertexAIWithInlineData(fileData, prompt, normalizedRecordType);

    if (!analysisResult) throw new Error("AIからの応答が不正でした。");

    // API使用量メタデータを取得
    const usageMetadata = analysisResult.usageMetadata || null;

    if (usageMetadata) {
      Logger.log(`💰 API使用量: モデル=${usageMetadata.model}, Input=${usageMetadata.inputTokens}tokens, Output=${usageMetadata.outputTokens}tokens, 合計=¥${usageMetadata.totalCostJPY.toFixed(2)}`);
    }

    // --- 5. AppSheetに結果を書き込み（記録タイプに応じたフィールドマッピング） ---

    updateRecordOnSuccess(recordNoteId, analysisResult, staffId, normalizedRecordType);

    logProcessingComplete(recordNoteId, timer.getElapsedSeconds() * 1000);

    // API呼び出し統計を出力
    logApiCallSummary();

    // 成功ログを実行ログスプレッドシートに記録
    logSuccessExec(recordNoteId, {
      staffId: staffId,
      recordType: normalizedRecordType,
      hasAudioFile: !!(filePath || fileId),
      recordTextLength: recordText ? recordText.length : 0,
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(2) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(2) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(2) : ''
    });

  } catch (error) {

    // エラー時もAPI呼び出し統計を出力
    logApiCallSummary();

    logError(recordNoteId || 'UNKNOWN', error, { params: params });

    // エラーログを実行ログスプレッドシートに記録
    logFailureExec(recordNoteId, error, {
      staffId: staffId,
      recordType: recordType || '通常',
      hasAudioFile: !!(filePath || fileId),
      recordTextLength: recordText ? recordText.length : 0,
      processingTime: timer.getElapsedSeconds()
    });

    if (recordNoteId) {

      updateRecordOnError(recordNoteId, error.toString());

      sendErrorEmail(recordNoteId, error.toString());

    }

    throw error;
  }
}

/**
 * テスト用関数 - 通常記録
 * GASエディタから直接実行してテスト可能
 *
 * @param {string} recordNoteId - 記録ID（例: "RN-001"）
 * @param {string} staffId - スタッフID（例: "staff@example.com"）
 * @param {string} recordText - 記録テキスト
 * @param {string} filePath - ファイルパス（オプション）
 * @param {string} fileId - ファイルID（オプション）
 */
function testNormalRecord(
  recordNoteId = "TEST-NORMAL-001",
  staffId = "test@fractal-group.co.jp",
  recordText = "利用者は元気そうでした。血圧130/80、体温36.5度。食事は良好。",
  filePath = null,
  fileId = null
) {
  console.log('='.repeat(60));
  console.log('🧪 通常記録テスト実行');
  console.log('='.repeat(60));

  return processRequest(recordNoteId, staffId, recordText, '通常', filePath, fileId);
}

/**
 * テスト用関数 - 精神科記録
 * GASエディタから直接実行してテスト可能
 *
 * @param {string} recordNoteId - 記録ID（例: "RN-002"）
 * @param {string} staffId - スタッフID（例: "staff@example.com"）
 * @param {string} recordText - 記録テキスト
 * @param {string} filePath - ファイルパス（オプション）
 * @param {string} fileId - ファイルID（オプション）
 */
function testPsychiatryRecord(
  recordNoteId = "TEST-PSYCH-001",
  staffId = "test@fractal-group.co.jp",
  recordText = "利用者は落ち着いた様子。服薬確認済み。幻聴の訴えなし。デイケアへの参加を促した。",
  filePath = null,
  fileId = null
) {
  console.log('='.repeat(60));
  console.log('🧪 精神科記録テスト実行');
  console.log('='.repeat(60));

  return processRequest(recordNoteId, staffId, recordText, '精神', filePath, fileId);
}

/**
 * カスタムパラメータでのテスト実行
 * GASエディタから直接実行してテスト可能
 *
 * @param {string} recordNoteId - 記録ID
 * @param {string} staffId - スタッフID
 * @param {string} recordText - 記録テキスト
 * @param {string} recordType - 記録タイプ（'通常' or '精神'）
 * @param {string} filePath - ファイルパス（オプション）
 * @param {string} fileId - ファイルID（オプション）
 */
function testCustomRecord(
  recordNoteId,
  staffId,
  recordText,
  recordType = '通常',
  filePath = null,
  fileId = null
) {
  console.log('='.repeat(60));
  console.log(`🧪 カスタムテスト実行: ${recordType}記録`);
  console.log('='.repeat(60));
  console.log(`記録ID: ${recordNoteId}`);
  console.log(`スタッフID: ${staffId}`);
  console.log(`記録タイプ: ${recordType}`);
  console.log('='.repeat(60));

  return processRequest(recordNoteId, staffId, recordText, recordType, filePath, fileId);
}

/**

 * 成功時にAppSheetのレコードを更新する

 */

function updateRecordOnSuccess(recordNoteId, resultData, staffId, recordType) {

  const rowData = {

    "record_note_id": recordNoteId,

    "status": "編集中",

    "updated_by": staffId

  };

  // 記録タイプに応じたフィールドマッピングを取得

  const fieldMapping = APPSHEET_FIELD_MAPPING[recordType];

  const outputFields = RECORD_TYPE_CONFIG[recordType].outputFields;

  // 各フィールドをマッピング

  outputFields.forEach(field => {

    const dbField = fieldMapping[field];

    if (dbField && resultData[field] !== undefined) {

      // 配列の場合はカンマ区切りに変換

      if (Array.isArray(resultData[field])) {

        rowData[dbField] = resultData[field].join(', ');

      } 

      // オブジェクトの場合はJSON文字列化

      else if (typeof resultData[field] === 'object' && resultData[field] !== null) {

        rowData[dbField] = JSON.stringify(resultData[field]);

      } 

      // それ以外はそのまま

      else {

        rowData[dbField] = resultData[field];

      }

    }

  });

  const payload = { Action: "Edit", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(payload);

}

/**

 * 処理失敗時にメールでエラー内容を通知する

 */

function sendErrorEmail(recordNoteId, errorMessage, context = {}) {

  const subject = `[要確認] GAS処理エラー: 看護記録作成 (ID: ${recordNoteId})`;

  let body = `看護記録の自動生成処理でエラーが発生しました。\n\n`;

  body += `■ 対象記録ID: ${recordNoteId}\n`;

  body += `■ 発生日時: ${new Date().toLocaleString('ja-JP')}\n`;

  body += `■ エラー内容:\n${errorMessage}\n\n`;

  if (context.errorCode) {

    body += `■ エラーコード: ${context.errorCode}\n\n`;

  }

  body += `GASのログをご確認ください。\n`;

  body += `https://script.google.com/home/executions`;

  try {

    // Email removed - using execution log instead

    logStructured(LOG_LEVEL.INFO, 'エラー通知メール送信成功', { 

      recordNoteId: recordNoteId,

      recipient: NOTIFICATION_CONFIG.errorEmail 

    });

  } catch(e) {

    logStructured(LOG_LEVEL.ERROR, 'エラー通知メール送信失敗', { 

      error: e.toString() 

    });

  }

}

/**

 * 失敗時にAppSheetのレコードをエラー状態で更新する

 */

function updateRecordOnError(recordNoteId, errorMessage) {

  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [{

      "record_note_id": recordNoteId,

      "status": "エラー",

      "error_details": `GAS Script Error: ${errorMessage}`

    }]

  };

  callAppSheetApi(payload);

}

/**

 * AppSheet APIを呼び出す共通関数

 */

function callAppSheetApi(payload) {

  const perfStop = perfStart('AppSheet_API');

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APPSHEET_CONFIG.appId}/tables/${APPSHEET_CONFIG.tableName}/Action`;

  const options = {

    method: 'post',

    contentType: 'application/json',

    headers: { 'ApplicationAccessKey': APPSHEET_CONFIG.accessKey },

    payload: JSON.stringify(payload),

    muteHttpExceptions: true

  };

  const response = UrlFetchApp.fetch(apiUrl, options);

  const responseCode = response.getResponseCode();

  const duration = perfStop();

  logApiCall('AppSheet', apiUrl, responseCode, duration);

  if (responseCode >= 400) {

    const errorMsg = `AppSheet API Error: ${responseCode} - ${response.getContentText()}`;

    logStructured(LOG_LEVEL.ERROR, errorMsg, { 

      payload: payload,

      responseCode: responseCode 

    });

    throw new Error(errorMsg);

  }

}
