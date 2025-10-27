// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

// ★★★ Google AI Studio APIキー削除済み ★★★
// 修正日: 2025-10-18
// Vertex AI（OAuth2認証）を使用するため、APIキー不要
// const GEMINI_API_KEY = '';  // ★削除済み

const GCP_PROJECT_ID = 'macro-shadow-458705-v8';

const GCP_LOCATION = 'us-central1';

const APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8'; // AppSheetのアプリID

const ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY'; // AppSheet APIのアクセスキー

// テーブル名

const PROBLEMS_TABLE_NAME = 'VN_Plan_Problems';

/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_訪問看護_計画書問題点_評価';
    return processRequest(params.problemId || params.data?.problemId, params.planText || params.data?.planText, params.latestRecords || params.data?.latestRecords, params.statusToSet || params.data?.statusToSet, params.staffId || params.data?.staffId);
  });
}

/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(problemId, planText, latestRecords, statusToSet, staffId) {
  try {

    const { planText, latestRecords, statusToSet, staffId } = params;

    if (!problemId || !planText || !latestRecords || !staffId) {

      throw new Error("必須パラメータ（problemId, planText, latestRecords, staffId）が不足しています。");

    }

    console.log(`処理開始: Problem ID = ${problemId}`);

    // --- AIで評価文を生成 ---

    const evaluationResult = generateEvaluationWithGemini(planText, latestRecords);

    if (!evaluationResult || !evaluationResult.evaluationText) {

      throw new Error("AIからの応答が不正でした。");

    }

    // --- AppSheetに結果を書き込み ---

    updateEvaluationInAppSheet(problemId, evaluationResult.evaluationText, statusToSet, staffId);

    console.log(`処理完了。ID ${problemId} の評価を更新しました。`);

  
  // ============================================================
  // Vector DB同期（RAGシステムへのデータ蓄積）
  // ============================================================
  try {
    log('Vector DB同期開始');

    // 同期データ準備
    const syncData = {
      domain: 'nursing',
      sourceType: 'care_plan_evaluation',
      sourceTable: 'Care_Plan_Evaluations',
      sourceId: recordId,
      userId: context.staffId || 'unknown',
      title: `${context.documentType} - ${context.clientName}`,
      content: aiResponse.problems,
      structuredData: {},
      metadata: {
        driveFileId: context.driveFileId || '',
        projectName: 'Appsheet_訪問看護_計画書問題点_評価'
      },
      tags: context.documentType,
      date: new Date().toISOString().split('T')[0]
    };

    // Vector DB同期実行
    syncToVectorDB(syncData);

    log('✅ Vector DB同期完了');

  } catch (syncError) {
    log(`⚠️  Vector DB同期エラー（処理は継続）: ${syncError.toString()}`);
    // Vector DB同期エラーはメイン処理に影響させない
  }

} catch (error) {

    console.log(`エラーが発生しました: ${error.toString()}`);

    // ここでエラー発生時にAppSheetのステータスを更新したり、メールを送信する処理も追加可能です

  }
}

/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  // TODO: テストデータを設定してください
  const testParams = {
    // 例: action: "test",
    // 例: data: "sample"
  };

  return CommonTest.runTest((params) => processRequest(params.problemId, params.planText, params.latestRecords, params.statusToSet, params.staffId), testParams, 'Appsheet_訪問看護_計画書問題点_評価');
}

/**

 * Gemini APIを呼び出し、看護計画の評価文を生成する

 */

function generateEvaluationWithGemini(planText, latestRecords) {

  const prompt = `

あなたは経験豊富な訪問看護師です。

以下の#看護計画と#最新の看護記録を比較・分析し、計画に対する評価を生成してください。

# 指示

- 最新の看護記録に基づき、看護計画の目標がどの程度達成されたか、計画は適切であったかを評価してください。

- 評価文は**50文字未満**で、簡潔明瞭な記録様式の表現（常体）を厳守してください。

- 出力は必ず指定されたJSON形式に従ってください。

# 看護計画

${planText}

# 最新の看護記録

${latestRecords}

# 出力形式（JSON）

以下の形式で、日本語のJSON文字列を生成してください。

{

  "evaluationText": "（ここに50文字未満の評価文を記述）"

}

`;

  const textPart = { text: prompt };

  const model = 'gemini-2.5-pro';

  const generationConfig = { "responseMimeType": "application/json", "temperature": 0.2 };

  const requestBody = { contents: [{ parts: [textPart] }], generationConfig: generationConfig };

  // ★★★ Google AI Studio API → Vertex AIに変更 ★★★
  // 修正日: 2025-10-18
  const url = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${model}:generateContent`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${ScriptApp.getOAuthToken()}` },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);

  const responseText = response.getContentText();

  Logger.log('Gemini API Response: ' + responseText);

  const jsonResponse = JSON.parse(responseText);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {

    throw new Error("AIからの応答に有効な候補が含まれていません: " + responseText);

  }

  let content = jsonResponse.candidates[0].content.parts[0].text;

  const startIndex = content.indexOf('{');

  const endIndex = content.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1) throw new Error("AIの応答からJSONを抽出できませんでした。");

  return JSON.parse(content.substring(startIndex, endIndex + 1));

}

/**

 * AppSheetのVN_Plan_Problemsテーブルを更新する

 */

function updateEvaluationInAppSheet(problemId, evaluationText, status, staffId) {

  const now = new Date();

  const formattedDate = Utilities.formatDate(now, "JST", "yyyy-MM-dd");

  const formattedDateTime = Utilities.formatDate(now, "JST", "yyyy-MM-dd HH:mm:ss");

  const rowData = {

    "problem_id": problemId,

    "evaluation": evaluationText,

    "evaluation_date": formattedDate,

    "status": status,

    "updated_at": formattedDateTime,

    "updated_by": staffId

  };

  const payload = { 

    Action: "Edit", 

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, 

    Rows: [rowData] 

  };

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${PROBLEMS_TABLE_NAME}/Action`;

  const options = {

    method: 'post',

    contentType: 'application/json',

    headers: { 'ApplicationAccessKey': ACCESS_KEY },

    payload: JSON.stringify(payload),

    muteHttpExceptions: true

  };

  const response = UrlFetchApp.fetch(apiUrl, options);

  Logger.log(`AppSheet API 応答: ${response.getResponseCode()} - ${response.getContentText()}`);

  if (response.getResponseCode() >= 400) {

    throw new Error(`AppSheet API Error: ${response.getResponseCode()} - ${response.getContentText()}`);

  }

}
