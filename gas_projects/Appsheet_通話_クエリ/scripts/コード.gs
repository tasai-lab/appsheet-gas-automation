/**

 * @fileoverview AppSheetからのWebhookを受け取り、Gemini APIで回答を生成し、AppSheetに書き戻すスクリプト。

 * 詳細なデバッグログ機能、設定のコード内定義、動的なモデル選択機能を搭載。

 */

// --- 1. 基本設定 ---

const SETTINGS = {

  // --- APIキー関連 ---

  GEMINI_API_KEY: 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY', // Gemini APIキー

  APP_ID: '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f',       // AppSheetのアプリID

  ACCESS_KEY: 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT', // AppSheet APIのアクセスキー

  // --- AppSheetテーブル名 ---

  QUERIES_TABLE_NAME: 'Call_Queries', // 質疑応答テーブル

  // --- デバッグ & ログ機能 ---

  DEBUG_MODE: true, // trueにするとデバッグメールが送信されます。不要な場合は false にしてください。

  LOG_EMAIL: 't.asai@fractal-group.co.jp', // デバッグログを送信するメールアドレス

  // --- メール件名用設定 ---

  SCRIPT_NAME: '通話関連クエリ', // メール件名に表示するスクリリプトの名前

  ID_LABEL: 'query_id',         // メール件名に表示するIDの名称 (例: QueryID, RecordID など)

  // --- Geminiモデル設定 ---

  // Webhookで指定するキーワードと、実際に使用するGeminiのモデル名を定義します。

  MODEL_MAPPING: {

    "しっかり": "gemini-2.5-pro", // 2.5-proはまだ一般公開されていないため1.5-proにしています

    "はやい": "gemini-2.5-flash" // 2.5-flashはまだ一般公開されていないため1.5-flashにしています

  },

  // Webhookでモデルのキーワード指定がなかった場合に使用する、上記のMODEL_MAPPINGで定義したキーワードです。

  DEFAULT_MODEL_KEYWORD: "しっかり"

};

/**

 * ログを収集し、コンソールに出力する。

 * @param {Array<string>} logCollector - ログを格納する配列。

 * @param {string} message - ログメッセージ。

 */

function log(logCollector, message) {

  const timestamp = new Date().toLocaleString('ja-JP');

  const logMessage = `[${timestamp}] ${message}`;

  console.log(logMessage);

  logCollector.push(logMessage);

}

/**

 * ログ出力用に、オブジェクト内にある指定されたキーの長文テキストを切り詰める。

 * 元のオブジェクトは変更しない。

 * @param {object} obj - 対象のオブジェクト。

 * @param {Array<string>} keysToTruncate - 値を切り詰めるキーのリスト。

 * @param {number} maxLength - 最大文字数。

 * @returns {object} - 値が切り詰められた新しいオブジェクト。

 */

function truncateObjectValuesForLogging(obj, keysToTruncate, maxLength) {

  // 元のオブジェクトを変更しないように、シャローコピーを作成

  const newObj = { ...obj }; 

  for (const key of keysToTruncate) {

    if (typeof newObj[key] === 'string' && newObj[key].length > maxLength) {

      newObj[key] = newObj[key].substring(0, maxLength) + '... (省略)';

    }

  }

  return newObj;

}

/**

 * 収集したログを指定されたメールアドレスに送信する。

 * @param {Array<string>} logCollector - ログが格納された配列。

 * @param {string} subject - メールの件名。

 */

function sendDebugLog(logCollector, subject) {

  if (!SETTINGS.DEBUG_MODE || !SETTINGS.LOG_EMAIL) return;

  try {

    const body = logCollector.join('\n');

    // Email removed - using execution log instead

  } catch (e) {

    console.error(`ログメールの送信に失敗しました: ${e.toString()}`);

  }

}

/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 * @param {object} e - Webhookイベントオブジェクト

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_通話_クエリ';
    return processRequest(params);
  });
}

/**
 * メイン処理関数
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  const logCollector = [];

  const startTime = new Date();

  let queryId = 'N/A';

  let status = '成功';

  try {

    log(logCollector, '--- 処理開始 ---');

    const keysToTruncate = ['promptText', 'callSummary', 'callTranscript', 'call_info'];

    const paramsForLog = truncateObjectValuesForLogging(params, keysToTruncate, 200);

    log(logCollector, `受信したWebhookペイロード: ${JSON.stringify(paramsForLog, null, 2)}`);
    const { promptText, callSummary, callTranscript, call_info, modelKeyword } = params;

    if (!queryId || !promptText) {

      throw new Error('必須パラメータ (queryId, promptText) が不足しています。');

    }

    log(logCollector, `処理対象: ${SETTINGS.ID_LABEL} = ${queryId}`);

    const selectedKeyword = modelKeyword && SETTINGS.MODEL_MAPPING[modelKeyword] ? modelKeyword : SETTINGS.DEFAULT_MODEL_KEYWORD;

    const model = SETTINGS.MODEL_MAPPING[selectedKeyword];

    if (!model) {

        throw new Error(`モデルキーワード '${selectedKeyword}' に対応するモデルがSETTINGS.MODEL_MAPPING内に見つかりません。`);

    }

    log(logCollector, `使用モデル: ${model} (キーワード: ${selectedKeyword})`);

    const answerText = generateAnswerWithGemini(logCollector, promptText, callSummary, callTranscript, call_info, model);

    if (!answerText) {

      throw new Error('AIからの応答が空でした。');

    }

    log(logCollector, `AIからの生成回答（先頭100文字）: ${answerText.substring(0, 100)}...`);

    updateQueryResponse(logCollector, queryId, answerText);

  } catch (error) {

    status = 'エラー';

    log(logCollector, `[重大なエラー] 処理が中断されました: ${error.toString()}\nスタックトレース: ${error.stack || 'N/A'}`);

    if (queryId !== 'N/A') {

      try {

        updateQueryStatusToError(logCollector, queryId, error.toString());

      } catch (updateError) {

        log(logCollector, `[追加エラー] AppSheetへのエラーステータス更新に失敗しました: ${updateError.toString()}`);

      }

    }

  } finally {

    const endTime = new Date();

    const elapsedTime = (endTime.getTime() - startTime.getTime()) / 1000;

    log(logCollector, `--- 処理終了 (ステータス: ${status}, 処理時間: ${elapsedTime}秒) ---`);

    const subject = `[GASログ] ${SETTINGS.SCRIPT_NAME} (${status}) - ${SETTINGS.ID_LABEL}: ${queryId}`;

    sendDebugLog(logCollector, subject);

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

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_通話_クエリ');
}

/**

 * Gemini APIを呼び出し、回答を生成する

 */

function generateAnswerWithGemini(logCollector, promptText, callSummary, callTranscript, call_info, model) {

  log(logCollector, 'Gemini API 処理開始...');

  const prompt = `

# 指示

以下の#参照情報に基づいて、#ユーザーからの質問に的確に回答してください。

**重要: 回答には「はい、わかりました」などの前置きや挨拶を含めず、質問に対する答えそのものだけを生成してください。**

# 参照情報

## 通話の要約

${callSummary || '要約はありません。'}

## 通話の全文文字起こし

${callTranscript || '全文文字起こしはありません。'}

## 通話関連情報

${call_info || '関連する通話はありません。'}

---

# ユーザーからの質問

${promptText}

`;

  const requestBody = {

    contents: [{ parts: [{ text: prompt }] }],

    generationConfig: {

      "temperature": 0.3,

      "maxOutputTokens": 20000,

    },

  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${SETTINGS.GEMINI_API_KEY}`;

  const options = {

    method: 'post',

    contentType: 'application/json',

    payload: JSON.stringify(requestBody),

    muteHttpExceptions: true

  };

  log(logCollector, `Gemini APIリクエストURL: ${url}`);

  const requestBodyForLog = {

    ...requestBody,

    contents: [{ parts: [{ text: `(プロンプトの長さ: ${prompt.length}文字)` }] }]

  };

  log(logCollector, `Gemini APIリクエストボディ: ${JSON.stringify(requestBodyForLog, null, 2)}`);

  const response = UrlFetchApp.fetch(url, options);

  const responseCode = response.getResponseCode();

  const responseText = response.getContentText();

  log(logCollector, `Gemini APIレスポンスコード: ${responseCode}`);

  log(logCollector, `Gemini APIレスポンスボディ (先頭500文字): ${responseText.substring(0, 500)}...`);

  if (responseCode !== 200) {

      throw new Error(`Gemini APIリクエストに失敗しました。ステータスコード: ${responseCode}, 応答: ${responseText}`);

  }

  const jsonResponse = JSON.parse(responseText);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0 || !jsonResponse.candidates[0].content || !jsonResponse.candidates[0].content.parts || jsonResponse.candidates[0].content.parts.length === 0) {

    const finishReason = jsonResponse.candidates && jsonResponse.candidates[0] ? jsonResponse.candidates[0].finishReason : 'N/A';

    log(logCollector, `AIからの応答に有効なコンテンツが含まれていませんでした。Finish Reason: ${finishReason}`);

    throw new Error("AIからの応答に有効なコンテンツが含まれていませんでした。APIの応答を確認してください。");

  }

  log(logCollector, 'Gemini API 処理正常終了。');

  return jsonResponse.candidates[0].content.parts[0].text.trim();

}

/**

 * AppSheet APIを呼び出して、生成した回答を書き込む

 */

function updateQueryResponse(logCollector, queryId, answerText) {

  log(logCollector, `AppSheetへの回答書き込み処理開始 (Query ID: ${queryId})`);

  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [{

      "query_id": queryId,

      "response_text": answerText,

      "status": "完了"

    }]

  };

  callAppSheetApi(logCollector, payload);

}

/**

 * エラー発生時にAppSheetのステータスを更新する

 */

function updateQueryStatusToError(logCollector, queryId, errorMessage) {

  log(logCollector, `AppSheetへのエラーステータス書き込み処理開始 (Query ID: ${queryId})`);

  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [{

      "query_id": queryId,

      "status": "エラー",

      "error_details": `GAS Script Error: ${errorMessage.substring(0, 255)}`

    }]

  };

  callAppSheetApi(logCollector, payload);

}

/**

 * AppSheet APIを呼び出す共通関数

 */

function callAppSheetApi(logCollector, payload) {

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${SETTINGS.APP_ID}/tables/${SETTINGS.QUERIES_TABLE_NAME}/Action`;

  const options = {

    method: 'post',

    contentType: 'application/json',

    headers: { 'ApplicationAccessKey': SETTINGS.ACCESS_KEY },

    payload: JSON.stringify(payload),

    muteHttpExceptions: true

  };

  const payloadForLog = JSON.parse(JSON.stringify(payload));

  if (payloadForLog.Rows && payloadForLog.Rows[0]) {

      const row = payloadForLog.Rows[0];

      if (row.response_text && row.response_text.length > 200) {

          row.response_text = row.response_text.substring(0, 200) + '... (省略)';

      }

      if (row.error_details && row.error_details.length > 200) {

          row.error_details = row.error_details.substring(0, 200) + '... (省略)';

      }

  }

  log(logCollector, `AppSheet APIリクエストURL: ${apiUrl}`);

  log(logCollector, `AppSheet APIリクエストペイロード: ${JSON.stringify(payloadForLog, null, 2)}`);

  const response = UrlFetchApp.fetch(apiUrl, options);

  const responseCode = response.getResponseCode();

  const responseText = response.getContentText();

  log(logCollector, `AppSheet APIレスポンスコード: ${responseCode}`);

  log(logCollector, `AppSheet APIレスポンスボディ: ${responseText}`);

  if (responseCode >= 300) {

    throw new Error(`AppSheet API Error: ${responseCode} - ${responseText}`);

  }

  log(logCollector, 'AppSheet API 呼び出し成功。');

}
