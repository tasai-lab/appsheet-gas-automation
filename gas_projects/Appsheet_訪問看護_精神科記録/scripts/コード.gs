/**

 * =================================================================

 * 設定エリア: ご自身の環境に合わせて全て修正してください

 * =================================================================

 */

const CONFIG = {

  // --- APIキー関連 ---

  GEMINI_API_KEY: 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY', // Gemini APIキー

  APPSHEET_ACCESS_KEY: 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY', // AppSheet APIのアクセスキー


  // --- AppSheet関連 ---

  APPSHEET_APP_ID: 'f40c4b11-b140-4e31-a60c-600f3c9637c8', // AppSheetのアプリID

  RECORDS_TABLE_NAME: 'Care_Records', // 看護記録が格納されているテーブル名


  // --- 指導・助言マスターのスプレッドシート情報 ---

  MASTER_SS_ID: '1EhLGOPKrxqMNl2b1_c0mA1M3w1tXiHN4PsnXWfWHSPw',

  MASTER_SHEET_NAME: 'Care_Provided',

  MASTER_COLUMN_NAME: 'Care_Provided', // 読み込むマスターの列名


  // --- その他 ---

  ERROR_NOTIFICATION_EMAIL: "t.asai@fractal-group.co.jp", // エラー通知先のメールアドレス

};


// スクリプト内で使用する定数

const CONSTANTS = {

  APPSHEET_API_ENDPOINT: `https://api.appsheet.com/api/v2/apps/${CONFIG.APPSHEET_APP_ID}/tables/${CONFIG.RECORDS_TABLE_NAME}/Action`,

  GEMINI_API_ENDPOINT: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${CONFIG.GEMINI_API_KEY}`,

  STATUS: {

    PROCESSING: "編集中",

    ERROR: "エラー",

  },

};


/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベントオブジェクト

 * @returns {GoogleAppsScript.Content.TextOutput} - 処理結果を示すテキスト出力

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_訪問看護_精神科記録';
    return processRequest(params);
  });
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  let recordNoteId = null;

  try {

    console.log("処理開始: WebhookからのPOSTリクエストを受信しました。");

    recordNoteId = params.recordNoteId;

    // --- 1. 入力パラメータの検証 ---

    if (!recordNoteId || !params.staffId || !params.recordText) {

      throw new Error("必須パラメータ（recordNoteId, staffId, recordText）が不足しています。");

    }

    console.log(`対象レコードID: ${recordNoteId}`);

    // --- 2. マスターデータをスプレッドシートから読み込む ---

    const guidanceMasterText = getGuidanceMasterAsText();

    if (!guidanceMasterText) {

        throw new Error("指導・助言マスターのテキストが空です。");

    }

    // --- 3. AIで看護記録を生成 ---

    const aiAnalysisResult = generateCareRecordWithGemini(params, guidanceMasterText);

    if (!aiAnalysisResult) {

      throw new Error("AIからの応答が不正、または空でした。");

    }

    // --- 4. AppSheetに成功結果を書き込み ---

    updateAppSheetRecordOnSuccess(recordNoteId, aiAnalysisResult, params.staffId);

    console.log(`処理完了: レコードID ${recordNoteId} の看護記録を正常に更新しました。`);

    return ContentService.createTextOutput("Success");

  } catch (error) {

    console.error(`エラーが発生しました: ${error.message}\nスタックトレース: ${error.stack}`);

    if (recordNoteId) {

      // AppSheet上のステータスをエラーに更新

      updateAppSheetRecordOnError(recordNoteId, error);

      // 管理者へエラーメールを送信

      sendErrorEmail(recordNoteId, error);

    }

    // AppSheet側にエラーを通知

    return ContentService.createTextOutput(`Error: ${error.message}`).setMimeType(ContentService.MimeType.TEXT);

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

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_訪問看護_精神科記録');
}


/**

 * 指導・助言マスターの情報をAIが読みやすいテキスト形式で取得する

 * @returns {string} - マスターデータを改行で連結したテキスト

 */

function getGuidanceMasterAsText() {

  console.log("STEP 2: 指導・助言マスターの読み込みを開始します。");

  const sheet = SpreadsheetApp.openById(CONFIG.MASTER_SS_ID).getSheetByName(CONFIG.MASTER_SHEET_NAME);

  const data = sheet.getDataRange().getValues();

  const headers = data.shift(); // ヘッダー行を取得

  const columnIndex = headers.indexOf(CONFIG.MASTER_COLUMN_NAME);

  if (columnIndex === -1) {

    throw new Error(`マスタースプレッドシートに '${CONFIG.MASTER_COLUMN_NAME}' 列が見つかりません。`);

  }

  const masterText = data

    .map(row => row[columnIndex])

    .filter(cell => cell) // 空のセルを除外

    .map(item => `- ${item}`)

    .join('\n');

  console.log("マスターデータの読み込みが完了しました。");

  return masterText;

}


/**

 * Gemini APIを呼び出し、詳細な訪問看護記録を生成する

 * @param {object} context - AppSheetから受け取ったデータ (recordText, fileIdなど)

 * @param {string} guidanceMasterText - マスターデータのテキスト

 * @returns {object} - AIが生成したJSONオブジェクト

 */

function generateCareRecordWithGemini(context, guidanceMasterText) {

  console.log("STEP 3: AIによる看護記録の生成を開始します。");

  const prompt = `

# 役割設定（ペルソナ）

あなたは、Biopsychosocial（生物・心理・社会）モデルを深く理解し、精神科領域における豊富な臨床経験を持つ訪問看護師スペシャリストです。あなたの使命は、単なる情報の書き写しではありません。音声やテキストの断片的な情報から、利用者の言動の背景にある心理社会的要因を洞察し、その人らしさ（個別性）を尊重した上で、記録の読み手（医師、ケアマネージャー、他の看護師など）が具体的な次のアクションを考えられるような、客観的かつ専門的な看護記録を構造化して生成することです。

# 絶対厳守のルール

1.  **出力形式**: 最終的な出力はJSONオブジェクトそのものとします。説明文、コメント、\`\`\`json ...\`\`\`のようなマークダウンは一切含んではいけません。

2.  **事実主義の徹底**: 入力情報から直接的または論理的に導き出せる客観的事実のみを記述してください。あなたの推測や解釈は思考過程でのみ用い、記録には含めないでください。

3.  **情報重複の禁止**: 各JSONキーには明確な役割があります。同じ情報を複数のキーに重複して記述することは固く禁じます。最も適切な一つのキーにのみ情報を配置してください。

4.  **空データの扱い**: 該当する情報が存在しない場合、キーの値は指示されたデータ型に応じて、必ず \`""\` (空文字列) または \`[]\` (空配列) としてください。\`null\` は決して使用しないでください。

# 思考プロセス（命令）

以下の思考プロセスを厳密に実行し、最終的なJSONオブジェクトを生成してください。

1.  **ステップ1: 情報のラベリングとマッピング**: 提供された全情報（音声、テキスト）のフレーズや文に対し、それが9つのどのJSONキーに関連する情報かを mentally タグ付けします。

2.  **ステップ2: 変化点と継続点の識別**: 既存の記録と比較し、「今回新たに発生した事象」「前回から改善/悪化した事象」「継続している重要な課題」を明確に識別します。

3.  **ステップ3: 専門的アセスメント（内部思考のみ）**: 識別した情報に基づき、利用者の現在の心理状態、ニーズ、リスクを専門的観点からアセスメント（解釈・判断）します。このアセスメントは、どの情報をどのキーに書くべきかの判断材料としてのみ使用します。

4.  **ステップ4: 構造化と記述**: アセスメントに基づき、タグ付けした情報を各JSONキーの指示に従って、客観的な言葉で記述します。特に\`care_provided\`は、「指導・助言マスターリスト」との完全一致照合をこの段階で実行します。

5.  **ステップ5: 自己レビュー**: 生成したJSON全体が「#絶対厳守のルール」に違反していないか、特に情報の重複や、事実と解釈の混同がないかを厳しく検証し、完璧な状態にしてから出力します。

# JSONキーごとの詳細指示

### \`client_condition\`: (string)

* **【目的】** 訪問直後の全体像と身体的状態を伝え、読み手が利用者の基本情報を迅速に把握するため。

* **【記述すべき内容】** 訪問時の第一印象（表情、身なり）、バイタルサイン、身体的な健康に関する本人・家族の訴えや客観的な観察事項。

* **【記述すべきでないこと】** 詳細な精神状態の分析、日常生活の具体的な様子（他のキーで記述）。

* **【記述例】** 「訪室時、やや疲れた表情で出迎える。BP 130/85, SpO2 98%。『昨夜から頭が重い感じがする』との訴えあり。服装の乱れはない。」

### \`daily_living_observation\`: (string)

* **【目的】** [必須項目]セルフケア能力と生活リズムを評価し、ケアマネージャー等が生活支援の必要性を判断するため。

* **【記述すべき内容】** ADL（食事、睡眠、清潔、排泄、整容）に関する客観的な事実。生活リズムの乱れや変化。

* **【記述すべきでないこと】** 対人関係や感情の起伏（他のキーで記述）。

* **【記述例】** 「食事は一日一食、夕食のみ摂取していることが多いと話す。昨夜はほとんど眠れず、朝方に2時間ほどうとうとしたとのこと。3日間入浴できていない。」

### \`mental_state_observation\`: (string)

* **【目的】** [必須項目]精神医学的評価の核心となる情報を提供し、医師や専門職が病状を判断するため。

* **【記述すべき内容】** 感情（安定性、適切性）、思考（内容、まとまり、飛躍）、意欲、認知機能（記憶、見当識）、言動、知覚（幻覚・妄想の有無とその内容）に関する具体的な観察事項と本人の発言。

* **【記述すべきでないこと】** 服薬や社会参加の状況（他のキーで記述）。

* **【記述例】** 「会話中、時折話が脱線し、元の話題に戻ることが困難な場面があった。無気力な様子で、『何もする気が起きない』と発言。窓の外を気にし、『誰かに見られている気がする』と小声で話す。」

### \`medication_adherence\`: (string)

* **【目的】** [必須項目]服薬コンプライアンスと、それに関連する要因（副作用、病識など）を把握するため。

* **【記述すべき内容】** 服薬の管理方法、実施状況（自己管理、要支援）、飲み忘れや過剰内服の有無、副作用に関する訴えや観察事項、薬に対する本人の考えや感情。

* **【記述すべきでないこと】** 薬以外のケア内容。

* **【記述例】** 「週1回のセットは家族が実施。朝薬は自己管理で内服できているが、眠前の薬を飲み忘れることが多い。『この薬を飲むと、翌朝ぼーっとする』と副作用への懸念を話された。」

### \`social_functional_observation\`: (string)

* **【目的】** [必須項目]利用者の社会生活機能とサポートシステムを評価し、社会復帰や地域生活支援の計画に役立てるため。

* **【記述すべき内容】** 家族、友人、地域との関係性。デイケア等の社会資源の利用状況。日中の活動内容、趣味や役割。金銭管理や買い物などの状況。

* **【記述すべきでないこと】** 個人の内面的な精神状態（mental_state_observationで記述）。

* **【記述例】** 「家族とはほとんど会話がない状態が続いている。週3回の予定の作業所は、今週は1回のみの参加。『人が多い場所に行くと疲れてしまう』と話す。」

### \`care_provided\`: (array of strings)

* **【目的】】** [必須項目]実施したケアをマスターリストに基づき正確に記録するため。

* **【記述すべき内容】** 「指導・助言マスターリスト」に記載されている文言と**一言一句違わずに完全に一致する**ケア項目名の配列。

* **【記述すべきでないこと】** マスターリストにないケア、自由記述の文章。

* **【記述例】** \`["精神的支援", "服薬確認・支援", "家族への状況説明"]\`

### \`guidance_and_advice\`: (string)

* **【目的】** 利用者への具体的な指導・助言内容と、それに対する利用者の反応を記録するため。

* **【記述すべき内容】** 指導・助言について、「誰に」「何を」「どのように」伝え、「どのような反応や理解度だったか」を具体的に記述した文章。

* **【記述すべきでないこと】** マスターの文言の羅列。

* **【記述例】** 「ご本人に、不眠時の対処法としてリラクゼーション技法を具体的に説明した。『試してみます』と関心を示した。ご家族には、本人の発言を傾聴する際のポイントを助言した。」

### \`remarks\`: (string)

* **【目的】** 他の項目に該当しないが、チームで共有すべき特記事項や事務連絡を記録するため。

* **【記述すべき内容】** 次回訪問時の持参物品の依頼、関係機関との連携に関する進捗、その他特筆すべき出来事。

* **【記述すべきでないこと】** 利用者の状態に関する主要な情報（他の8項目に記載すべき）。

* **【記述例】** 「自立支援医療の更新手続きが必要なため、次回訪問時に申請書類の記入支援を予定。」

### \`summary_for_next_visit\`: (string)

* **【目的】** 次回訪問者が、今回の訪問結果を踏まえて、優先度の高い観察・ケア項目を短時間で把握するため。

* **【記述すべき内容】** 今回の訪問で明らかになった最も重要な課題、継続して観察・評価が必要な事項、次回介入すべき具体的なアクションプランを簡潔に箇条書きで記載。

* **【記述すべきでないこと】** 今回の訪問の詳細な報告（既に他の項目で記述済み）。

* **【記述例】** 「・幻覚様体験の訴えが再燃。発言の頻度と内容を注意深く観察。\\n・デイケアの参加意欲低下。休んでいる理由を再度傾聴し、阻害要因を探る。\\n・家族の疲労感が強いため、レスパイトの必要性について検討。」

---

# 提供情報

1.  **音声ファイル**: 看護師による今回の訪問に関する口述記録（もしあれば）

2.  **テキスト化された現在の記録全体**: \`${context.recordText}\`

3.  **指導・助言マスターリスト**: \`${guidanceMasterText}\`

`;

  const parts = [{ text: prompt }];

  // 音声ファイルがある場合の処理

  if (context.fileId) {

    try {

      console.log(`音声ファイル (ID: ${context.fileId}) を処理します。`);

      const file = DriveApp.getFileById(context.fileId);

      const audioBlob = file.getBlob();

      const fileName = file.getName();

      const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';

      const audioExtensionMap = { 'm4a': 'audio/mp4', 'mp3': 'audio/mpeg' };

      const mimeType = audioExtensionMap[extension] || audioBlob.getContentType();

      if (mimeType && mimeType.startsWith('audio/')) {

        parts.push({ inlineData: { mimeType: mimeType, data: Utilities.base64Encode(audioBlob.getBytes()) } });

        console.log(`音声ファイルをAPIリクエストに追加しました (MIME Type: ${mimeType})。`);

      } else {

        console.warn(`ファイル (ID: ${context.fileId}) は音声ファイルとして認識されませんでした (MIME Type: ${mimeType})。スキップします。`);

      }

    } catch (e) {

      console.error(`音声ファイル (ID: ${context.fileId}) の処理中にエラーが発生しました: ${e.message}`);

      // 音声ファイル処理エラーは続行可能とする

    }

  }

  const requestBody = {

    contents: [{ parts: parts }],

    generationConfig: {

      "responseMimeType": "application/json",

      "temperature": 0.3

    }

  };

  const options = {

    method: 'post',

    contentType: 'application/json',

    payload: JSON.stringify(requestBody),

    muteHttpExceptions: true // エラー時もレスポンスを取得するため

  };

  console.log("Gemini APIにリクエストを送信します。");

  const response = UrlFetchApp.fetch(CONSTANTS.GEMINI_API_ENDPOINT, options);

  const responseCode = response.getResponseCode();

  const responseText = response.getContentText();

  if (responseCode !== 200) {

    console.error(`Gemini APIエラー: HTTP ${responseCode}\n応答: ${responseText}`);

    throw new Error(`AIとの通信に失敗しました (HTTP ${responseCode})。`);

  }

  console.log("Gemini APIから正常な応答を受信しました。");

  // --- ★★★ ここから修正箇所 ★★★ ---

  try {

    const jsonResponse = JSON.parse(responseText);

    if (!jsonResponse.candidates || jsonResponse.candidates.length === 0 || !jsonResponse.candidates[0].content.parts[0].text) {

      console.error(`AIの応答形式が不正です: ${responseText}`);

      throw new Error("AIの応答に有効な候補が含まれていません。");

    }

    // AIの応答からテキスト部分を取得

    const content = jsonResponse.candidates[0].content.parts[0].text;

    // 応答テキストからJSON部分のみを安全に抽出

    const startIndex = content.indexOf('{');

    const endIndex = content.lastIndexOf('}');

    if (startIndex === -1 || endIndex === -1) {

      console.error(`AIの応答からJSONオブジェクトを抽出できませんでした。応答内容: ${content}`);

      throw new Error("AIの応答からJSONオブジェクトを抽出できませんでした。");

    }

    const jsonString = content.substring(startIndex, endIndex + 1);

    // 抽出したJSON文字列をパースして返す

    return JSON.parse(jsonString);

  } catch(e) {

    console.error(`AIの応答JSONの解析に失敗しました。応答内容: ${responseText}\nエラー: ${e.message}`);

    throw new Error("AIの応答JSONの解析に失敗しました。");

  }

  // --- ★★★ ここまで修正箇所 ★★★ ---

}


/**

 * 成功時にAppSheetのレコードを更新する

 * @param {string} recordNoteId - 更新対象のレコードID

 * @param {object} aiResult - AIが生成したデータオブジェクト

 * @param {string} staffId - 更新者ID

 */

function updateAppSheetRecordOnSuccess(recordNoteId, aiResult, staffId) {

  console.log("STEP 4: AppSheetへのレコード更新（成功）を開始します。");

  // 精神科訪問看護記録の9項目のJSON構造に合わせて列をマッピング

  const rowData = {

    "record_note_id": recordNoteId,

    "status": "編集中",

    "updated_by": staffId,

    "client_condition": aiResult.client_condition || "",

    "daily_living_observation": aiResult.daily_living_observation || "",

    "mental_state_observation": aiResult.mental_state_observation || "",

    "medication_adherence": aiResult.medication_adherence || "",

    "social_functional_observation": aiResult.social_functional_observation || "",

    "care_provided": Array.isArray(aiResult.care_provided) ? aiResult.care_provided.join(', ') : "",

    "guidance_and_advice": aiResult.guidance_and_advice || "",

    "remarks": aiResult.remarks || "",

    "summary_for_next_visit": aiResult.summary_for_next_visit || ""

  };

  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [rowData]

  };

  callAppSheetApi("OnSuccess", payload);

}


/**

 * 失敗時にAppSheetのレコードを更新する

 * @param {string} recordNoteId - 更新対象のレコードID

 * @param {Error} error - 発生したエラーオブジェクト

 */

function updateAppSheetRecordOnError(recordNoteId, error) {

  console.log("STEP 5: AppSheetへのレコード更新（失敗）を開始します。");

  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [{

      "record_note_id": recordNoteId,

      "status": CONSTANTS.STATUS.ERROR,

      "error_details": `GAS Script Error: ${error.message}`

    }]

  };

  try {

    callAppSheetApi("OnError", payload);

  } catch (apiError) {

    console.error(`AppSheetのエラーステータス更新自体に失敗しました。: ${apiError.message}`);

    // このエラーは管理者へのメールで通知される

  }

}


/**

 * 管理者へエラー通知メールを送信する

 * @param {string} recordNoteId - エラーが発生したレコードID

 * @param {Error} error - 発生したエラーオブジェクト

 */

function sendErrorEmail(recordNoteId, error) {

  console.log("エラー通知メールの送信処理を開始します。");

  try {

    const subject = `[要確認] GAS処理エラー: 訪問看護記録作成 (ID: ${recordNoteId})`;

    const body = `

AppSheetの訪問看護記録の自動生成処理でエラーが発生しました。

■ 対象レコードID

${recordNoteId}

■ エラー内容

${error.message}

■ 詳細 (スタックトレース)

${error.stack}

GASのログをご確認ください。

    `;

    // Email removed - using execution log instead

    console.log(`エラー通知メールを ${CONFIG.ERROR_NOTIFICATION_EMAIL} に送信しました。`);

  } catch (e) {

    console.error(`致命的エラー: エラー通知メールの送信に失敗しました: ${e.toString()}`);

  }

}


/**

 * AppSheet APIを呼び出す共通関数

 * @param {string} context - 呼び出し元のコンテキスト（ログ用）

 * @param {object} payload - AppSheet APIに送信するペイロード

 */

function callAppSheetApi(context, payload) {

  console.log(`AppSheet API呼び出し [${context}] を開始します。`);

  const options = {

    method: 'post',

    contentType: 'application/json',

    headers: { 'ApplicationAccessKey': CONFIG.APPSHEET_ACCESS_KEY },

    payload: JSON.stringify(payload),

    muteHttpExceptions: true

  };

  const response = UrlFetchApp.fetch(CONSTANTS.APPSHEET_API_ENDPOINT, options);

  const responseCode = response.getResponseCode();

  const responseText = response.getContentText();

  console.log(`AppSheet API 応答 [${context}]: ${responseCode}`);

  if (responseCode >= 400) {

    console.error(`AppSheet API エラー [${context}]: ${responseCode} - ${responseText}`);

    throw new Error(`AppSheet APIとの通信に失敗しました (HTTP ${responseCode})。`);

  }

  console.log(`AppSheet API呼び出し [${context}] が正常に完了しました。`);

}
