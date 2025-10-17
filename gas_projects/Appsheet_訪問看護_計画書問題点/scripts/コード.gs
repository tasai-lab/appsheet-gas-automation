// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

const GEMINI_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY'; // Gemini APIキー

const APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8'; // AppSheetのアプリID

const ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY'; // AppSheet APIのアクセスキー

const ERROR_NOTIFICATION_EMAIL = "t.asai@fractal-group.co.jp"; // ★ エラー通知先のメールアドレス


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
    params.scriptName = 'Appsheet_訪問看護_計画書問題点';
    return processRequest(params);
  });
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  const problemId = params.problemId;

  try {

    const { contextText, problemPoint, problemIdentifiedDate } = params;

    if (!problemId || !contextText || !problemPoint || !problemIdentifiedDate) {

      throw new Error("必須パラメータ（problemId, contextText, problemPoint, problemIdentifiedDate）が不足しています。");

    }

    console.log(`処理開始: Problem ID = ${problemId}, 問題点 = ${problemPoint}`);

    const plan = generateCarePlanWithGemini(contextText, problemPoint, problemIdentifiedDate);

    if (!plan) {

      throw new Error("AIからの応答が不正でした。");

    }

    updatePlanInAppSheet(problemId, plan);

    console.log(`処理完了。ID ${problemId} の看護計画を更新しました。`);

  } catch (error) {

    console.log(`エラーが発生しました: ${error.toString()}`);

    if (problemId) {

      sendErrorEmail(problemId, error.toString());

    }

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

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_訪問看護_計画書問題点');
}


/**

 * ★★★ プロンプトをより詳細に、高品質なものに修正 ★★★

 * Gemini APIを呼び出し、看護計画を生成する

 */

function generateCarePlanWithGemini(contextText, problemPoint, identifiedDate) {

  const prompt = `

あなたは、日本の訪問看護ステーションに勤務する、経験豊富な看護師（Registered Nurse）です。

これから提供される情報に基づき、質の高い訪問看護計画（O-P, E-P/C-P）を立案してください。

# 指示

提供された#参照情報と、特に注目している#問題点を専門的に分析し、以下の#出力形式（JSON）に従って、看護計画を生成してください。

# 参照情報

- **この問題が明らかになった日付**: ${identifiedDate}

- **利用者様の基本情報と、これまでの看護記録**:

${contextText}

# 問題点

${problemPoint}

# 看護計画作成のルール

- **視点**: 常に利用者様の個別性を尊重し、安全・安楽を最優先する視点で記述してください。

- **表現**: 医療専門職が使う、簡潔明瞭な記録様式の表現（常体、「～である」「～する」）を厳守してください。丁寧語（「です」「ます」）は絶対に使用しないでください。

- **具体性**: 抽象的な表現は避け、誰が読んでも具体的に何をすべきか理解できるレベルで記述してください。

# 出力形式（JSON）

以下の形式で、日本語のJSON文字列を生成してください。

{

  "problem_statement": "提供された情報から最も重要と考えられる看護上の問題点を一つだけ選び、簡潔なキーワードで表現してください。例: '排便コントロール不良'、'皮膚トラブル'、'栄養・水分摂取不足'、'内服コントロール不良'。",

  "goal": "上記の問題点に対し、計画期間内に達成可能で、具体的かつ測定可能な長期目標（Goal）を「～できる」「～することができる」といった主観的な目標で記述してください。",

  "solutions_observation": "提示された問題点に直接関連する観察項目（O-P）を、具体的なポイントを読点「、」で繋いだ、簡潔で一つの文章として記述してください。改行やビュレットは含めないでください。",

  "solutions_implementation": "提示された問題点に直接関連する実施項目（E-P/C-P）を、具体的なケア内容を**体言止め（名詞形）のキーワード**として読点「、」で繋ぎ、一つの文章として記述してください。改行やビュレットは含めないでください。"

}

`;

  const textPart = { text: prompt };

  const model = 'gemini-2.5-pro';

  const generationConfig = { "responseMimeType": "application/json", "temperature": 0.3 };

  const requestBody = { contents: [{ parts: [textPart] }], generationConfig: generationConfig };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(requestBody), muteHttpExceptions: true };

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

function updatePlanInAppSheet(problemId, planData) {

  const solutionsText = `△ 観察項目\n${planData.solutions_observation}\n\n△ 実施項目\n${planData.solutions_implementation}`;

  const rowData = {

    "status": '編集中',

    "problem_id": problemId,

    "problem_statement": planData.problem_statement,

    "goal": planData.goal,

    "solutions": solutionsText

  };

  const payload = { Action: "Edit", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

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


/**

 * 処理失敗時にメールでエラー内容を通知する

 */

function sendErrorEmail(problemId, errorMessage) {

  const subject = `[要確認] GAS処理エラー: 看護計画自動立案 (ID: ${problemId})`;

  const body = `AppSheetの看護計画自動立案処理でエラーが発生しました。\n\n■ 対象ID\n${problemId}\n\n■ エラー内容\n${errorMessage}\n\nGASのログをご確認ください。`;

  try {

    // Email removed - using execution log instead

    console.log(`エラー通知メールを ${ERROR_NOTIFICATION_EMAIL} へ送信しました。`);

  } catch(e) {

    console.error(`エラー通知メールの送信に失敗しました: ${e.toString()}`);

  }

}
