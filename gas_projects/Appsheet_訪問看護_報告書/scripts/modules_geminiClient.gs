/**
 * modules_geminiClient.gs - Gemini API統合モジュール
 *
 * 医療機関向け報告書生成のためのGemini API連携
 *
 * @version 1.0.0
 * @date 2025-10-18
 */

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
  const prompt = buildReportPrompt(context);

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
 * 報告書生成用のプロンプトを構築
 * @param {Object} context - コンテキスト
 * @returns {string} - プロンプト
 * @private
 */
function buildReportPrompt(context) {
  return `
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

    -   各トピックは、3〜4文程度の文章量で記述してください。

5.  **結びの挨拶**

    「以上となります。
ご確認よろしくお願いいたします。」

# 遵守事項

-   報告書全体が冗長にならないよう意識しつつも、必要な情報やニュアンスは省略しないでください。

-   客観的な事実に基づき、専門的かつ分かりやすい言葉で記述してください。

-   提供された資料に記載されている情報のみを忠実に反映させてください。

-   入力情報に「テア」や「スキンテア」という記述がある場合、報告書では「表皮剥離」という言葉に統一してください。

-   マークダウン記法は一切使用しないでください。
`;
}
