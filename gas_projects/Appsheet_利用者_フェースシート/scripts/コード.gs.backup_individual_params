/**

 * --------------------------------------------------------------------------

 * 設定項目: ご自身の環境に合わせて以下の3つの値を書き換えてください

 * --------------------------------------------------------------------------

 */


// 1. Gemini APIキー

const GEMINI_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY';


// 2. AppSheetのアプリID

const APPSHEET_APP_ID = "f40c4b11-b140-4e31-a60c-600f3c9637c8";


// 3. AppSheetのAPIアクセスキー

const APPSHEET_ACCESS_KEY = "V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY";


/**

 * AppSheetからのWebhook POSTリクエストを処理するメイン関数

 * @param {Object} e - Webhookから渡されるイベントオブジェクト

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_利用者_フェースシート';
    return processRequest(params);
  });
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  let faceSheetId; // catchブロックでも利用できるよう、外側で変数を定義

  try {

    // ステップ1: Webhookのペイロードを解析

    const requestBody = params;

    faceSheetId = requestBody.faceSheetId;

    const textToAnalyze = requestBody.textToAnalyze;

    // faceSheetIdやtextToAnalyzeがない場合はエラーとする

    if (!faceSheetId || !textToAnalyze) {

      throw new Error("Webhookのペイロードに faceSheetId または textToAnalyze がありません。");

    }

    // ステップ2: Gemini APIを呼び出してテキストを解析

    const parsedData = callGeminiApi(textToAnalyze);

    Logger.log("Geminiからの解析結果: " + JSON.stringify(parsedData));

    // ステップ3: AppSheet APIへの成功ペイロードを作成

    const successPayload = {

      Action: "Edit",

      Properties: {

        Locale: "ja-JP",

        Timezone: "Asia/Tokyo"

      },

      Rows: [

        {

          "face_sheet_id": faceSheetId,

          "status": "編集待ち", // ご指示の通り、成功時は「編集待ち」に設定

          "main_disease_name": parsedData.main_disease_name, // ★★★ 追加 ★★★

          "family_structure": parsedData.family_structure,

          "cohabiting_family": parsedData.cohabiting_family,

          "separate_family": parsedData.separate_family,

          "present_illness_history": parsedData.present_illness_history,

          "past_illness_history": parsedData.past_illness_history,

          "medical_condition": parsedData.medical_condition,

          "life_history": parsedData.life_history,

          "has_drug_allergy": parsedData.has_drug_allergy,

          "drug_allergy_details": parsedData.has_drug_allergy ? parsedData.drug_allergy_details : null,

          "has_food_allergy": parsedData.has_food_allergy,

          "food_allergy_details": parsedData.has_food_allergy ? parsedData.food_allergy_details : null,

        }

      ]

    };

    // ステップ4: AppSheet APIを呼び出してデータを更新

    callAppSheetApi(successPayload);

    Logger.log("AppSheetのデータ更新に成功しました。");

  } catch (error) {

    // エラー処理: ログに詳細を記録し、AppSheetのステータスを「エラー」に更新

    Logger.log("エラーが発生しました: " + error.toString());

    Logger.log("Stack Trace: " + error.stack);

    // faceSheetIdが取得できている場合のみ、ステータス更新を試みる

    if (faceSheetId) {

      const errorPayload = {

        Action: "Edit",

        Properties: {

          Locale: "ja-JP",

          Timezone: "Asia/Tokyo"

        },

        Rows: [

          {

            "face_sheet_id": faceSheetId,

            "status": "エラー"

          }

        ]

      };

      // エラー更新自体が失敗する可能性もあるが、ここでは実行を試みる

      try {

        callAppSheetApi(errorPayload);

        Logger.log("AppSheetのステータスを「エラー」に更新しました。");

      } catch (appsheetError) {

        Logger.log("エラー状態の更新中に、さらなるエラーが発生しました: " + appsheetError.toString());

      }

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

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_利用者_フェースシート');
}


/**

 * Gemini APIを呼び出し、解析結果のJSONオブジェクトを返す

 * @param {string} text - 解析対象のテキスト

 * @return {Object} - 解析結果のキーと値を持つオブジェクト

 */

function callGeminiApi(text) {

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

  // Geminiに渡す指示（プロンプト）。JSON形式での出力を厳密に指示する。

  const prompt = `

    以下の利用者に関するテキスト情報を分析し、指定された項目をJSON形式で抽出してください。

    # 制約条件

    - 出力は必ずJSON形式の文字列のみとすること。前後に説明文や\`\`\`jsonのようなマークダウンは含めないでください。

    - 抽出する項目は以下のキーを使用してください: "status", "family_structure", "cohabiting_family", "separate_family", "main_caregiver", "main_disease_name", "present_illness_history", "past_illness_history", "medical_condition", "life_history", "has_drug_allergy", "drug_allergy_details", "has_food_allergy", "food_allergy_details"

    - テキストから情報が読み取れない項目は、値として null を設定してください。

    - "has_drug_allergy", "has_food_allergy" は、アレルギーに関する記述があれば true, なければ false の真偽値にしてください。

    - "drug_allergy_details", "food_allergy_details" は、アレルギーがある場合にその具体的な内容を文字列で抽出してください。

    - "status"キーの値は常に"解析済み"としてください。

    # 分析対象テキスト

    ${text}

  `;

  const payload = {

    contents: [{

      parts: [{

        text: prompt

      }]

    }]

  };

  const options = {

    method: "post",

    contentType: "application/json",

    payload: JSON.stringify(payload),

    muteHttpExceptions: true // APIからのエラーレスポンスを例外として扱わず、戻り値として取得する

  };

  const response = UrlFetchApp.fetch(apiUrl, options);

  const responseCode = response.getResponseCode();

  const responseBody = response.getContentText();

  if (responseCode !== 200) {

    throw new Error(`Gemini APIエラー: Status Code ${responseCode}. Body: ${responseBody}`);

  }

  // Geminiからの返答をパースする

  const jsonResponse = JSON.parse(responseBody);

  let geminiText = jsonResponse.candidates[0].content.parts[0].text;

  // Geminiが返しがちなマークダウンを正規表現で除去する

  geminiText = geminiText.replace(/^```json\s*/, '').replace(/\s*```$/, '');

  // クリーンアップしたテキストをJSONとして解析

  try {

    return JSON.parse(geminiText);

  } catch(e) {

    Logger.log("クリーンアップ後もGeminiの応答がJSON形式ではありませんでした: " + geminiText);

    throw new Error("Geminiからの応答をJSONとして解析できませんでした。");

  }

}


/**

 * AppSheet APIを呼び出す共通関数

 * @param {Object} payload - AppSheet APIに送信するリクエストボディ

 */

function callAppSheetApi(payload) {

  const tableName = "Client_Face_Sheets";

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APPSHEET_APP_ID}/tables/${tableName}/Action`;

  const options = {

    method: "post",

    contentType: "application/json",

    headers: {

      "ApplicationAccessKey": APPSHEET_ACCESS_KEY

    },

    payload: JSON.stringify(payload),

    muteHttpExceptions: true // APIからのエラーレスポンスを例外として扱わず、戻り値として取得する

  };

  const response = UrlFetchApp.fetch(apiUrl, options);

  const responseCode = response.getResponseCode();

  const responseBody = response.getContentText();

  // AppSheet APIは成功時(200 OK)でもボディに"OK"などの文字列を返すことがある

  // ここでは200番台でない場合をエラーとして扱う

  if (responseCode < 200 || responseCode >= 300) {

     throw new Error(`AppSheet APIエラー: Status Code ${responseCode}. Body: ${responseBody}`);

  }

  Logger.log(`AppSheet API 応答: Code=${responseCode}, Body=${responseBody}`);

}
