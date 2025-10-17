





﻿/**

 * Vertex AI連携モジュール

 * Gemini APIを使用した看護記録生成

 */



/**

 * Vertex AIを使用して看護記録を生成（再試行ロジック付き）

 * @param {string} gsUri - Cloud StorageのGS URI

 * @param {string} mimeType - ファイルのMIMEタイプ

 * @param {string} prompt - 使用するプロンプト

 * @param {string} recordType - 記録タイプ ('normal' or 'psychiatry')

 * @return {Object} 生成された看護記録のJSON

 */

function callVertexAIWithPrompt(gsUri, mimeType, prompt, recordType = 'normal') {

  const maxRetries = 3;

  const retryDelays = [30000, 60000, 120000]; // 30秒, 1分, 2分

  

  for (let attempt = 1; attempt <= maxRetries; attempt++) {

    try {

      return callVertexAIWithPromptInternal(gsUri, mimeType, prompt, recordType);

    } catch (error) {

      const errorMessage = error.message || '';

      

      // Service Agent プロビジョニングエラーの場合は再試行

      if (errorMessage.includes('Service agents are being provisioned') || 

          errorMessage.includes('FAILED_PRECONDITION')) {

        

        if (attempt < maxRetries) {

          const delaySeconds = retryDelays[attempt - 1] / 1000;

          Logger.log(`⏳ サービスエージェントプロビジョニング中。${delaySeconds}秒後に再試行します... (試行 ${attempt}/${maxRetries})`);

          Utilities.sleep(retryDelays[attempt - 1]);

          continue;

        } else {

          Logger.log(`❌ ${maxRetries}回の再試行後も失敗しました`);

          throw new Error(`サービスエージェントのプロビジョニングが完了していません。数分後に再度お試しください。\n詳細: https://cloud.google.com/vertex-ai/docs/general/access-control#service-agents`);

        }

      }

      

      // その他のエラーは即座にスロー

      throw error;

    }

  }

}



/**

 * Vertex AIを使用して看護記録を生成（内部実装）

 * @param {string} gsUri - Cloud StorageのGS URI

 * @param {string} mimeType - ファイルのMIMEタイプ

 * @param {string} prompt - 使用するプロンプト

 * @param {string} recordType - 記録タイプ ('normal' or 'psychiatry')

 * @return {Object} 生成された看護記録のJSON

 */

function callVertexAIWithPromptInternal(gsUri, mimeType, prompt, recordType = 'normal') {

  try {

    const url = `https://${GCP_CONFIG.location}-aiplatform.googleapis.com/v1/projects/${GCP_CONFIG.projectId}/locations/${GCP_CONFIG.location}/publishers/google/models/${GCP_CONFIG.vertexAI.model}:generateContent`;

    

    const requestBody = {

      contents: [{

        role: 'user',

        parts: [

          { text: prompt },

          {

            fileData: {

              mimeType: mimeType,

              fileUri: gsUri

            }

          }

        ]

      }],

      generationConfig: {

        temperature: GCP_CONFIG.vertexAI.temperature,

        maxOutputTokens: GCP_CONFIG.vertexAI.maxOutputTokens,

        responseMimeType: 'application/json'

      }

    };

    

    Logger.log(`Vertex AI API呼び出し開始: ${GCP_CONFIG.vertexAI.model}`);

    

    const options = {

      method: 'post',

      contentType: 'application/json',

      payload: JSON.stringify(requestBody),

      headers: {

        'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`

      },

      muteHttpExceptions: true

    };

    

    const startTime = new Date().getTime();

    const response = UrlFetchApp.fetch(url, options);

    const endTime = new Date().getTime();

    const duration = ((endTime - startTime) / 1000).toFixed(2);

    

    const responseCode = response.getResponseCode();

    const responseText = response.getContentText();

    

    Logger.log(`Vertex AI API応答: ${responseCode}, 処理時間: ${duration}秒`);

    

    if (responseCode !== 200) {

      throw new Error(`Vertex AI API Error: ${responseCode} - ${responseText}`);

    }

    

    const jsonResponse = JSON.parse(responseText);

    

    if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {

      throw new Error('Vertex AIからの応答に有効な候補が含まれていません');

    }

    

    const candidate = jsonResponse.candidates[0];

    

    // セーフティフィルターチェック

    if (candidate.finishReason && candidate.finishReason !== 'STOP') {

      Logger.log(`警告: 生成が完了しませんでした。理由: ${candidate.finishReason}`);

    }

    

    const generatedText = candidate.content.parts[0].text;

    

    // JSONパース

    const result = parseGeneratedJSON(generatedText);

    

    Logger.log('Vertex AI処理成功');

    return result;

    

  } catch (error) {

    Logger.log(`Vertex AI処理エラー: ${error.toString()}`);

    throw new Error(`Vertex AIでの処理に失敗しました: ${error.message}`);

  }

}



/**

 * Gemini API（フォールバック）を使用して看護記録を生成（プロンプト指定版）

 * @param {Object} fileData - {blob: Blob, mimeType: string} または null

 * @param {string} prompt - 使用するプロンプト

 * @param {string} recordType - 記録タイプ ('normal' or 'psychiatry')

 * @return {Object} 生成された看護記録のJSON

 */

function callGeminiAPIWithPrompt(fileData, prompt, recordType = 'normal') {

  try {

    const parts = [{ text: prompt }];

    

    // 音声ファイルを追加

    if (fileData && fileData.blob) {

      parts.push({

        inlineData: {

          mimeType: fileData.mimeType,

          data: Utilities.base64Encode(fileData.blob.getBytes())

        }

      });

    }

    

    const requestBody = {

      contents: [{ parts: parts }],

      generationConfig: {

        temperature: GEMINI_CONFIG.temperature,

        responseMimeType: 'application/json'

      }

    };

    

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.model}:generateContent?key=${GEMINI_CONFIG.apiKey}`;

    

    Logger.log(`Gemini API呼び出し開始: ${GEMINI_CONFIG.model}`);

    

    const options = {

      method: 'post',

      contentType: 'application/json',

      payload: JSON.stringify(requestBody),

      muteHttpExceptions: true

    };

    

    const startTime = new Date().getTime();

    const response = UrlFetchApp.fetch(url, options);

    const endTime = new Date().getTime();

    const duration = ((endTime - startTime) / 1000).toFixed(2);

    

    const responseCode = response.getResponseCode();

    const responseText = response.getContentText();

    

    Logger.log(`Gemini API応答: ${responseCode}, 処理時間: ${duration}秒`);

    

    if (responseCode !== 200) {

      throw new Error(`Gemini API Error: ${responseCode} - ${responseText}`);

    }

    

    const jsonResponse = JSON.parse(responseText);

    

    if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {

      throw new Error('Gemini APIからの応答に有効な候補が含まれていません');

    }

    

    const generatedText = jsonResponse.candidates[0].content.parts[0].text;

    const result = parseGeneratedJSON(generatedText, recordType);

    

    Logger.log('Gemini API処理成功');

    return result;

    

  } catch (error) {

    Logger.log(`Gemini API処理エラー: ${error.toString()}`);

    throw new Error(`Gemini APIでの処理に失敗しました: ${error.message}`);

  }

}



/**

 * 生成されたJSONテキストをパースする

 * @param {string} text - 生成されたテキスト

 * @param {string} recordType - 記録タイプ ('normal' or 'psychiatry')

 * @return {Object} パースされたJSON

 */

function parseGeneratedJSON(text, recordType = 'normal') {

  try {

    // JSONブロックの抽出

    const startIndex = text.indexOf('{');

    const endIndex = text.lastIndexOf('}');

    

    if (startIndex === -1 || endIndex === -1) {

      throw new Error('JSONブロックが見つかりません');

    }

    

    const jsonText = text.substring(startIndex, endIndex + 1);

    const result = JSON.parse(jsonText);

    

    // 記録タイプに応じた必須フィールドを取得

    const requiredFields = REQUIRED_FIELDS[recordType];

    

    // 必須フィールドの検証

    for (const field of requiredFields) {

      if (!(field in result)) {

        logStructured(LOG_LEVEL.WARN, '必須フィールド欠落', { 

          field: field,

          recordType: recordType 

        });

        // デフォルト値を設定

        if (field === 'vitalSigns') {

          result[field] = {};

        } else if (field.includes('Items') || field === 'careProvided' || field === 'nursingAndRehabilitationItems') {

          result[field] = [];

        } else {

          result[field] = '';

        }

      }

    }

    

    return result;

    

  } catch (error) {

    logStructured(LOG_LEVEL.ERROR, 'JSON解析エラー', { 

      error: error.message,

      recordType: recordType,

      textPreview: text.substring(0, 500)

    });

    throw new Error(`生成されたJSONの解析に失敗しました: ${error.message}`);

  }

}



/**

 * 通常の看護記録用プロンプトを構築する

 * @param {string} recordText - 既存の記録テキスト

 * @param {string} guidanceMasterText - 指導・助言マスターリスト

 * @return {string} 構築されたプロンプト

 */

function buildNormalPrompt(recordText, guidanceMasterText) {

  return `

# 役割設定

あなたは、経験豊富な訪問看護師の視点を持つ、記録作成支援のエキスパートAIです。

提供される断片的な情報（音声、テキスト）から、訪問看護記録に必要な要素を5W1H（いつ、どこで、誰が、何を、なぜ、どのように）を意識して過不足なく抽出し、客観的な事実に基づいた構造化された記録を作成します。



# タスク

看護師による口述音声、既存の記録テキスト、マスターリストを統合的に分析し、以下の詳細な指示に従って、訪問看護記録を生成してください。出力は、指定された英語キーを持つJSONオブジェクト形式で、値は日本語で記述してください。



# 入力情報

1.  **音声ファイル**: 看護師による今回の訪問に関する口述記録（存在する場合）

2.  **テキスト化された現在の記録全体**: ${recordText}

3.  **指導・助言マスターリスト**: ${guidanceMasterText}



# 出力形式と詳細な指示



## 全体ルール

- 出力は必ずJSONオブジェクト形式とします。

- 各項目の値は、入力情報に根拠のある事実のみを記述し、推測や憶測を含めないでください。

- 該当する情報がないキーの値は、データ型に応じて "" (空文字列)、{} (空オブジェクト)、[] (空の配列) のいずれかとしてください。

- 客観的な事実（Objective）と主観的な情報（Subjective）を明確に区別してください。



## JSONキーと各項目の要件



- processedAudioText: (string)

  - 【音声ファイルがある場合のみ】音声認識の結果を、看護記録として利用しやすいように要点を整理し、箇条書きで記述します。音声がない場合は "" とします。



- vitalSigns: (object)

  - 訪問時に測定されたバイタルサインを抽出・整理して格納します。測定されなかった項目はキー自体を含めないでください。

  - 例: { "bt": "36.5℃", "bp": "128/78mmHg", "hr": "72bpm", "spo2": "98%" }



- subjectiveInformation: (string)

  - 利用者本人や家族からの主観的な訴え、発言、様子の変化などを記述します。発言は「」で囲んでください。

  - 例: 「昨晩は胸が少し苦しくて眠りが浅かった」「足のむくみは昨日より良い気がする」とご本人の発言あり。



- userCondition: (string)

  - **入力情報（特に音声ファイルが存在する場合はその文脈やメモ）を深く理解し、観察された事象の背景や、なぜそうなったかの経過が記録の読み手に正しく伝わるように記述してください。**

  - 重要な健康上の問題やケアの焦点を「フォーカス」として特定し、そのフォーカスに対する**観察データ、実施したケア、利用者の反応**といった要素を自然な文章として盛り込み、看護記録を常体で記述します。

  - **フォーマットのルール（以下の記載例を厳密に守ってください）：**

    1.  各フォーカスの先頭には中点「・」を付けてください。

    2.  フォーカス名の後、改行し、行頭に全角スペースを1つ入れてから内容を記述してください。

    3.  1つのフォーカス内に、観察事項、実施ケア、利用者の反応、測定値などを自然な文章でありながらも詳細な記述してください。

    4.  文末は「～あり。」「～を実施。」「～と説明。」「～との発言あり。」のように、簡潔な述語で記述してください。

    5.  複数のフォーカスがある場合は、各フォーカスの記述の間に一行の改行（空行）を入れてください。

  - **記録例:**

    ・皮膚状態

    　仙骨部に直径2cmの発赤あり。熱感や浸出液はなし。微温湯で洗浄後、アズノール軟膏を塗布し保護パッドを貼付。処置中に痛み等の訴えは聞かれなかった。



    ・排便コントロール

    　3日間排便がない状況であり、腹部膨満と軽度の圧痛あり。本日、腹部マッサージを実施し水分摂取を促したところ、「少し楽になった」との発言あり。



- guidanceAndAdvice: (string)

  - 利用者本人や家族に対して実施した指導・助言内容を記述します。

  - 「誰に」「何を」「どのような方法で」指導し、「その結果、どのような理解や反応があったか（理解度）」までを具体的に記述してください。

  - 例: ご家族に対し、褥瘡予防のための体位交換方法について、実演を交えて説明した。ご家族は「2時間おきですね。圧がかからないようにクッションを使うのが大事なんですね」と復唱し、理解を示した。



- nursingAndRehabilitationItems: (array of strings)

  - 今回の訪問で実施した看護やリハビリの項目名を、提供された\`guidanceMasterText\`の中から**一言一句違わずに**選択し、配列形式でリストアップします。マスターに存在しない項目は含めないでください。



- specialNotes: (string)

  - **記録内や音声ファイルの内容から、今回の訪問で特に重要と判断される事項や、他のスタッフ・関係機関に共有すべき特記事項を記述します。** 報告・連絡・相談の観点から具体的に記述してください。該当がない場合は "" とします。

  - **記述の観点:**

    - **医療的側面:** 緊急性の高い症状変化、検査データの異常値、薬剤の副作用疑いなど。

    - **福祉的側面:** 状態変化に伴う区分変更の必要性、福祉用具の提案、他サービスの利用状況や課題など。

    - **他職種との連携:** リハビリ専門職や薬剤師への情報提供や相談事項。



- summaryForNextVisit: (string)

  - 次回の訪問担当者が、短時間で状況を把握し、具体的なアクションを取れるように、今回の訪問の要点と次回の観察・ケアのポイント（申し送り事項）をまとめます。

  - **より分かりやすいように、常体の箇条書き、もしくは簡潔な文章で記述してください。**

  - 例:

    ・3日間の便秘に対し腹部マッサージ実施。次回、排便状況（有無、性状）を最優先で確認。

    ・仙骨部の発赤は継続観察が必要。

    ・家族の介護負担に関する訴えが増加傾向。傾聴と精神的支援も考慮。





# 思考プロセス

1.  **Step 1 (情報整理):** 音声情報がある場合は、まずその内容を正確にテキスト化し、主要なトピック（バイタル、訴え、実施ケア、観察事項など）をキーワードとして抽出します。

2.  **Step 2 (情報統合):** 次に既存の記録テキストの内容と突き合わせ、今回の訪問での変化点（改善・悪化）、継続事項、新規発生事項を特定します。

3.  **Step 3 (項目特定):** 指導・助言マスターリストを厳密に参照し、実施されたケア項目を特定します。

4.  **Step 4 (生成):** 上記で整理・統合した情報をもとに、各JSONキーに対応する値を生成します。特に userCondition は、指示されたフォーマットと、含めるべき要素（背景、経過、観察、ケア、反応）を意識してください。

5.  **Step 5 (最終確認):** 生成したJSONオブジェクト全体を見直し、情報の重複や漏れ、矛盾がないかを確認してから最終的な出力を確定します。



---



以下に提供情報を示します。これらを総合的に判断して上記のJSONオブジェクトを作成してください。

`;

}



/**

 * 精神科訪問看護記録用プロンプトを構築する

 * @param {string} recordText - 既存の記録テキスト

 * @param {string} guidanceMasterText - 指導・助言マスターリスト

 * @return {string} 構築されたプロンプト

 */

function buildPsychiatryPrompt(recordText, guidanceMasterText) {

  return `

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

4.  **ステップ4: 構造化と記述**: アセスメントに基づき、タグ付けした情報を各JSONキーの指示に従って、客観的な言葉で記述します。特に\`careProvided\`は、「指導・助言マスターリスト」との完全一致照合をこの段階で実行します。

5.  **ステップ5: 自己レビュー**: 生成したJSON全体が「#絶対厳守のルール」に違反していないか、特に情報の重複や、事実と解釈の混同がないかを厳しく検証し、完璧な状態にしてから出力します。



# JSONキーごとの詳細指示



### \`clientCondition\`: (string)

* **【目的】** 訪問直後の全体像と身体的状態を伝え、読み手が利用者の基本情報を迅速に把握するため。

* **【記述すべき内容】** 訪問時の第一印象（表情、身なり）、バイタルサイン、身体的な健康に関する本人・家族の訴えや客観的な観察事項。

* **【記述すべきでないこと】** 詳細な精神状態の分析、日常生活の具体的な様子（他のキーで記述）。

* **【記述例】** 「訪室時、やや疲れた表情で出迎える。BP 130/85, SpO2 98%。『昨夜から頭が重い感じがする』との訴えあり。服装の乱れはない。」



### \`dailyLivingObservation\`: (string)

* **【目的】** [必須項目]セルフケア能力と生活リズムを評価し、ケアマネージャー等が生活支援の必要性を判断するため。

* **【記述すべき内容】** ADL（食事、睡眠、清潔、排泄、整容）に関する客観的な事実。生活リズムの乱れや変化。

* **【記述すべきでないこと】** 対人関係や感情の起伏（他のキーで記述）。

* **【記述例】** 「食事は一日一食、夕食のみ摂取していることが多いと話す。昨夜はほとんど眠れず、朝方に2時間ほどうとうとしたとのこと。3日間入浴できていない。」



### \`mentalStateObservation\`: (string)

* **【目的】** [必須項目]精神医学的評価の核心となる情報を提供し、医師や専門職が病状を判断するため。

* **【記述すべき内容】** 感情（安定性、適切性）、思考（内容、まとまり、飛躍）、意欲、認知機能（記憶、見当識）、言動、知覚（幻覚・妄想の有無とその内容）に関する具体的な観察事項と本人の発言。

* **【記述すべきでないこと】** 服薬や社会参加の状況（他のキーで記述）。

* **【記述例】** 「会話中、時折話が脱線し、元の話題に戻ることが困難な場面があった。無気力な様子で、『何もする気が起きない』と発言。窓の外を気にし、『誰かに見られている気がする』と小声で話す。」



### \`medicationAdherence\`: (string)

* **【目的】** [必須項目]服薬コンプライアンスと、それに関連する要因（副作用、病識など）を把握するため。

* **【記述すべき内容】** 服薬の管理方法、実施状況（自己管理、要支援）、飲み忘れや過剰内服の有無、副作用に関する訴えや観察事項、薬に対する本人の考えや感情。

* **【記述すべきでないこと】** 薬以外のケア内容。

* **【記述例】** 「週1回のセットは家族が実施。朝薬は自己管理で内服できているが、眠前の薬を飲み忘れることが多い。『この薬を飲むと、翌朝ぼーっとする』と副作用への懸念を話された。」



### \`socialFunctionalObservation\`: (string)

* **【目的】** [必須項目]利用者の社会生活機能とサポートシステムを評価し、社会復帰や地域生活支援の計画に役立てるため。

* **【記述すべき内容】** 家族、友人、地域との関係性。デイケア等の社会資源の利用状況。日中の活動内容、趣味や役割。金銭管理や買い物などの状況。

* **【記述すべきでないこと】** 個人の内面的な精神状態（mentalStateObservationで記述）。

* **【記述例】** 「家族とはほとんど会話がない状態が続いている。週3回の予定の作業所は、今週は1回のみの参加。『人が多い場所に行くと疲れてしまう』と話す。」



### \`careProvided\`: (array of strings)

* **【目的】】** [必須項目]実施したケアをマスターリストに基づき正確に記録するため。

* **【記述すべき内容】** 「指導・助言マスターリスト」に記載されている文言と**一言一句違わずに完全に一致する**ケア項目名の配列。

* **【記述すべきでないこと】** マスターリストにないケア、自由記述の文章。

* **【記述例】** \`["精神的支援", "服薬確認・支援", "家族への状況説明"]\`



### \`guidanceAndAdvice\`: (string)

* **【目的】** 利用者への具体的な指導・助言内容と、それに対する利用者の反応を記録するため。

* **【記述すべき内容】** 指導・助言について、「誰に」「何を」「どのように」伝え、「どのような反応や理解度だったか」を具体的に記述した文章。

* **【記述すべきでないこと】** マスターの文言の羅列。

* **【記述例】** 「ご本人に、不眠時の対処法としてリラクゼーション技法を具体的に説明した。『試してみます』と関心を示した。ご家族には、本人の発言を傾聴する際のポイントを助言した。」



### \`remarks\`: (string)

* **【目的】** 他の項目に該当しないが、チームで共有すべき特記事項や事務連絡を記録するため。

* **【記述すべき内容】** 次回訪問時の持参物品の依頼、関係機関との連携に関する進捗、その他特筆すべき出来事。

* **【記述すべきでないこと】** 利用者の状態に関する主要な情報（他の8項目に記載すべき）。

* **【記述例】** 「自立支援医療の更新手続きが必要なため、次回訪問時に申請書類の記入支援を予定。」



### \`summaryForNextVisit\`: (string)

* **【目的】** 次回訪問者が、今回の訪問結果を踏まえて、優先度の高い観察・ケア項目を短時間で把握するため。

* **【記述すべき内容】** 今回の訪問で明らかになった最も重要な課題、継続して観察・評価が必要な事項、次回介入すべき具体的なアクションプランを簡潔に箇条書きで記載。

* **【記述すべきでないこと】** 今回の訪問の詳細な報告（既に他の項目で記述済み）。

* **【記述例】** 「・幻覚様体験の訴えが再燃。発言の頻度と内容を注意深く観察。\\n・デイケアの参加意欲低下。休んでいる理由を再度傾聴し、阻害要因を探る。\\n・家族の疲労感が強いため、レスパイトの必要性について検討。」



---

# 提供情報

1.  **音声ファイル**: 看護師による今回の訪問に関する口述記録（もしあれば）

2.  **テキスト化された現在の記録全体**: ${recordText}

3.  **指導・助言マスターリスト**: ${guidanceMasterText}

`;

}



/**

 * 記録タイプを判定する

 * @param {string} recordType - Webhookからのrecord Type（「通常」または「精神」）

 * @return {string} 'normal' または 'psychiatry'

 */

function determineRecordType(recordType) {

  if (!recordType) {

    Logger.log('記録タイプ判定: 通常（デフォルト）');

    return 'normal';

  }

  

  // 日本語での完全一致で判定

  if (recordType === '精神' || recordType === RECORD_TYPE_CONFIG.psychiatry.matchText) {

    logDebug('記録タイプ判定: 精神科', { input: recordType });

    return 'psychiatry';

  }

  

  if (recordType === '通常' || recordType === RECORD_TYPE_CONFIG.normal.matchText) {

    logDebug('記録タイプ判定: 通常', { input: recordType });

    return 'normal';

  }

  

  // 一致しない場合は警告してデフォルト

  logStructured(LOG_LEVEL.WARN, '不明な記録タイプ', { input: recordType, defaultTo: 'normal' });

  return 'normal';

}

