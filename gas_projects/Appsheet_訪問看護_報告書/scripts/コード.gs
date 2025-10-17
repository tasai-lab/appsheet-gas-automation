





// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

const GEMINI_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY'; // Gemini APIキー

const APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8'; // AppSheetのアプリID

const ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY'; // AppSheet APIのアクセスキー

const ERROR_NOTIFICATION_EMAIL = "t.asai@fractal-group.co.jp"; // ★ エラー通知先のメールアドレス



// テーブル名

const REPORTS_TABLE_NAME = 'VN_Reports';



/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_訪問看護_報告書';
    return processRequest(params);
  });
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  const reportId = params.reportId;



  try {

    const { clientName, targetMonth, visitRecords } = params;

    if (!reportId || !clientName || !targetMonth || !visitRecords) {

      throw new Error("必須パラメータ（reportId, clientName, targetMonth, visitRecords）が不足しています。");

    }

    console.log(`処理開始: Report ID = ${reportId}`);



    // --- AIで報告書を生成 ---

    const reportText = generateReportWithGemini(params);

    if (!reportText) {

      throw new Error("AIからの応答が空でした。");

    }



    // --- AppSheetに結果を書き込み ---

    updateReportOnSuccess(reportId, reportText);

    console.log(`処理完了。ID ${reportId} の報告書を生成しました。`);



  } catch (error) {

    console.log(`エラーが発生しました: ${error.toString()}`);

    if (reportId) {

      updateReportOnError(reportId, error.toString());

      sendErrorEmail(reportId, error.toString());

    }

  }
}


/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
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

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_訪問看護_報告書');
}




/**

 * Gemini APIを呼び出し、医療機関向けの報告書を生成する

 */

function generateReportWithGemini(context) {

  // ★★★ ご提示のプロンプトをGAS側に配置 ★★★

  const prompt = `

あなたは、${context.clientName}さまの多様な情報を分析し、医療機関向けの要点を押さえつつ、現場感のある構造的な報告書を生成するプロフェッショナルです。



# 前提条件

あなたは経験豊富な訪問看護師の視点を持ち、報告先の医療機関が利用者の状態変化や重要なポイントを正確に把握できるよう配慮します。

提供された資料から、報告すべき最優先事項を的確に判断し、重要な経緯や観察内容は省略せずに要約する能力があります。



# 入力情報

${context.clientName}様に関する、以下の一連の資料。

${context.visitRecords}



# 実行タスク

提供された入力情報を全て精査し、${context.targetMonth}における${context.clientName}様の状態報告書を、医療機関向けに作成してください。



# 出力形式と構成

以下の構成と指示に従い、報告書を作成してください。



1.  **冒頭の挨拶**

    「いつもお世話になっております。」



2.  **報告の主旨**

    「${context.clientName}様の、${context.targetMonth}の状態報告をさせていただきます。」



3.  **バイタルサイン**

    指定された期間内の訪問看護記録から、各項目ごとに最小値～最大値で配置すること。

    [順序の指示] 記載する順番は「BT(体温)」「BP(血圧)」「P(脈拍)」「SpO2」の順とし、BS(血糖値)の記録がある場合は最後に記載してください。

    （例: BT:36.6～36.8℃ BP:100～132/56～76mmHg P:64～84回/分 SpO2:97～99% BS:150～152）改行せず一行とすること。



4.  **主要トピックの要約**

    （ここから下の項目は、見出しを出力せず、内容のみを記載してください）

    -   他に報告すべき重要な事項があれば補足し、全体で最大5つのトピックにまとめてください。

    -   抽出したトピックの中に「全身状態」に関するものが含まれる場合は、必ずそれを一番初めに配置してください。

    -   見出しは必ず使用し、体言止め（名詞形）のシンプルな単語（例：全身状態、皮膚状態、排泄状況）にしてください。

    -   各トピックは、『現在の状態』と『現在の対応』に焦点を当てて記述してください。

    -   「ご家族から〜とのお話あり」「〜と発語された」のような、具体的なエピソードや会話を効果的に引用してください。

    -   「〜で対応しています」「〜な状況です」といった、現場感のある適切な表現を用いてください。

    -   特に『皮膚状態』のトピックでは、問題のある部位ごとに、その状態と処置方法が明確にわかるように記述してください。（例）・右前腕：表皮剥離あり。ゲンタシン塗布＋絆創膏で保護。

    -   各トopicは、3〜4文程度の文章量で記述してください。



5.  **結びの挨拶**

    「以上となります。\nご確認よろしくお願いいたします。」



# 遵守事項

-   報告書全体が冗長にならないよう意識しつつも、必要な情報やニュアンスは省略しないでください。

-   客観的な事実に基づき、専門的かつ分かりやすい言葉で記述してください。

-   提供された資料に記載されている情報のみを忠実に反映させてください。

-   入力情報に「テア」や「スキンテア」という記述がある場合、報告書では「表皮剥離」という言葉に統一してください。

-   マークダウン記法は一切使用しないでください。

`;

  const textPart = { text: prompt };

  const model = 'gemini-2.5-pro';

  const generationConfig = { "temperature": 0.2 };

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

  return jsonResponse.candidates[0].content.parts[0].text.trim();

}



/**

 * 成功時にAppSheetのテーブルを更新する

 */

function updateReportOnSuccess(reportId, reportText) {

  const rowData = {

    "report_id": reportId,

    "status": "編集中",

    "symptom_progress": reportText // ★ 書き込み先の列

  };

  const payload = { Action: "Edit", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(payload);

}



/**

 * 失敗時にAppSheetのテーブルを更新する

 */

function updateReportOnError(reportId, errorMessage) {

  const rowData = {

    "report_id": reportId,

    "status": "エラー",

    "error_details": `GAS Script Error: ${errorMessage}` // ★ error_details列がある場合

  };

  const payload = { Action: "Edit", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(payload);

}



/**

 * AppSheet APIを呼び出す共通関数

 */

function callAppSheetApi(payload) {

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${REPORTS_TABLE_NAME}/Action`;

  const options = {

    method: 'post', contentType: 'application/json',

    headers: { 'ApplicationAccessKey': ACCESS_KEY },

    payload: JSON.stringify(payload), muteHttpExceptions: true

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

function sendErrorEmail(reportId, errorMessage) {

  const subject = `[要確認] GAS処理エラー: 医療機関向け報告書作成 (ID: ${reportId})`;

  const body = `AppSheetの報告書自動生成処理でエラーが発生しました。\n\n■ 対象ID\n${reportId}\n\n■ エラー内容\n${errorMessage}\n\nGASのログをご確認ください。`;

  try {

    // Email removed - using execution log instead

    console.log(`エラー通知メールを ${ERROR_NOTIFICATION_EMAIL} へ送信しました。`);

  } catch(e) {

    console.error(`エラー通知メールの送信に失敗しました: ${e.toString()}`);

  }

}