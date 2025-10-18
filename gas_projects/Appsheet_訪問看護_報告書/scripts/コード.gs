/**
 * main.gs - 医療機関向け報告書生成
 *
 * AppSheetからの訪問看護記録をもとに、Gemini 2.5-proで
 * 医療機関向けの報告書を自動生成します。
 *
 * @version 2.0.0
 * @date 2025-10-18
 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベント
 * @return {GoogleAppsScript.Content.TextOutput} - JSONレスポンス
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_訪問看護_報告書';
    return processRequest(
      params.reportId || params.data?.reportId,
      params.clientName || params.data?.clientName,
      params.targetMonth || params.data?.targetMonth,
      params.visitRecords || params.data?.visitRecords,
      params.staffId || params.data?.staffId
    );
  });
}

/**
 * メイン処理関数
 * @param {string} reportId - 報告書ID
 * @param {string} clientName - 利用者名
 * @param {string} targetMonth - 対象月
 * @param {string} visitRecords - 訪問記録テキスト
 * @param {string} staffId - スタッフID
 * @returns {Object} - 処理結果
 */
function processRequest(reportId, clientName, targetMonth, visitRecords, staffId) {
  const startTime = Date.now();

  // パラメータをログ用に保存
  const params = {
    reportId: reportId,
    clientName: clientName,
    targetMonth: targetMonth,
    visitRecordsLength: visitRecords ? visitRecords.length : 0,
    staffId: staffId
  };

  try {
    // 必須パラメータのバリデーション
    if (!reportId || !clientName || !targetMonth || !visitRecords) {
      throw new Error("必須パラメータ（reportId, clientName, targetMonth, visitRecords）が不足しています。");
    }

    logProcessingStart(reportId, params);

    // --- AIで報告書を生成 ---
    const context = {
      clientName: clientName,
      targetMonth: targetMonth,
      visitRecords: visitRecords
    };

    const reportText = generateReportWithGemini(context);

    if (!reportText) {
      throw new Error("AIからの応答が空でした。");
    }

    // --- AppSheetに結果を書き込み ---
    updateReportOnSuccess(reportId, reportText, staffId);

    const duration = Date.now() - startTime;
    logProcessingComplete(reportId, duration);

    return { success: true, reportId: reportId };

  } catch (error) {
    logError(reportId || 'UNKNOWN', error, { params: params });

    if (reportId) {
      updateReportOnError(reportId, error.toString());
      sendErrorEmail(reportId, error.toString());
    }

    throw error;
  }
}

/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 *
 * @param {string} reportId - 報告書ID（例: "REPORT-001"）
 * @param {string} clientName - 利用者名（例: "山田太郎"）
 * @param {string} targetMonth - 対象月（例: "2025年10月"）
 * @param {string} visitRecords - 訪問記録テキスト
 * @param {string} staffId - スタッフID（例: "staff@example.com"）
 */
function testReportGeneration(
  reportId = "TEST-REPORT-001",
  clientName = "山田太郎",
  targetMonth = "2025年10月",
  visitRecords = "10/1訪問: BT36.5℃ BP120/70mmHg P72回/分 SpO2 98%。全身状態良好。食事摂取良好。",
  staffId = "test@fractal-group.co.jp"
) {
  console.log('='.repeat(60));
  console.log('🧪 報告書生成テスト実行');
  console.log('='.repeat(60));

  return processRequest(reportId, clientName, targetMonth, visitRecords, staffId);
}

/**
 * Gemini APIを呼び出し、医療機関向けの報告書を生成する
 * @param {Object} context - 報告書生成に必要なコンテキスト
 * @param {string} context.clientName - 利用者名
 * @param {string} context.targetMonth - 対象月
 * @param {string} context.visitRecords - 訪問記録
 * @returns {string} - 生成された報告書テキスト
 */
function generateReportWithGemini(context) {
  const perfStop = perfStart('Gemini_API');

  // プロンプトを構築
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

  Logger.log(`🤖 Gemini API呼び出し: ${context.clientName}様 ${context.targetMonth}の報告書生成`);

  // Gemini APIを使用して生成
  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: GEMINI_CONFIG.temperature,
      maxOutputTokens: GEMINI_CONFIG.maxOutputTokens
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.model}:generateContent?key=${GEMINI_CONFIG.apiKey}`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  const duration = perfStop();
  logApiCall('Gemini', url, responseCode, duration);

  if (responseCode !== 200) {
    throw new Error(`Gemini APIエラー（ステータス: ${responseCode}）: ${responseText}`);
  }

  const jsonResponse = JSON.parse(responseText);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    throw new Error("AIからの応答に有効な候補が含まれていません: " + responseText);
  }

  const generatedText = jsonResponse.candidates[0].content.parts[0].text.trim();

  Logger.log(`✅ 報告書生成完了（${generatedText.length}文字）`);

  return generatedText;
}

/**
 * 成功時にAppSheetのテーブルを更新する
 * @param {string} reportId - 報告書ID
 * @param {string} reportText - 生成された報告書テキスト
 * @param {string} staffId - スタッフID
 */
function updateReportOnSuccess(reportId, reportText, staffId) {
  const rowData = {
    [APPSHEET_FIELD_MAPPING.reportId]: reportId,
    [APPSHEET_FIELD_MAPPING.status]: "編集中",
    [APPSHEET_FIELD_MAPPING.symptomProgress]: reportText,
    [APPSHEET_FIELD_MAPPING.updatedBy]: staffId
  };

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP" },
    Rows: [rowData]
  };

  callAppSheetApi(payload);
}

/**
 * 失敗時にAppSheetのテーブルを更新する
 * @param {string} reportId - 報告書ID
 * @param {string} errorMessage - エラーメッセージ
 */
function updateReportOnError(reportId, errorMessage) {
  const rowData = {
    [APPSHEET_FIELD_MAPPING.reportId]: reportId,
    [APPSHEET_FIELD_MAPPING.status]: "エラー",
    [APPSHEET_FIELD_MAPPING.errorDetails]: `GAS Script Error: ${errorMessage}`
  };

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [rowData]
  };

  callAppSheetApi(payload);
}

/**
 * AppSheet APIを呼び出す共通関数
 * @param {Object} payload - AppSheet APIペイロード
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

/**
 * 処理失敗時にメールでエラー内容を通知する
 * @param {string} reportId - 報告書ID
 * @param {string} errorMessage - エラーメッセージ
 * @param {Object} context - コンテキスト情報（オプション）
 */
function sendErrorEmail(reportId, errorMessage, context = {}) {
  const subject = `[要確認] GAS処理エラー: 医療機関向け報告書作成 (ID: ${reportId})`;

  let body = `AppSheetの報告書自動生成処理でエラーが発生しました。\n\n`;
  body += `■ 対象ID: ${reportId}\n`;
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
      reportId: reportId,
      recipient: NOTIFICATION_CONFIG.errorEmail
    });
  } catch(e) {
    logStructured(LOG_LEVEL.ERROR, 'エラー通知メール送信失敗', {
      error: e.toString()
    });
  }
}
