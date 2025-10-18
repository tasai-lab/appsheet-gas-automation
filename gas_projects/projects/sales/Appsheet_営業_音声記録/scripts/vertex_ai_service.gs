/**
 * Vertex AI音声解析サービス（営業音声分析用）
 * base64 inlineData使用でCloud Storageのオーバーヘッド削減
 * 
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-17
 */

/**
 * Vertex AIで営業音声を分析・評価
 * 
 * @param {Object} context - 分析コンテキスト
 * @param {string} context.filePath - 音声ファイルのGoogle Driveパス（優先）
 * @param {string} context.fileId - 音声ファイルのGoogle Drive ID（filePathが無い場合）
 * @param {string} context.salespersonName - 営業担当者名
 * @param {string} context.contactName - 面会相手名
 * @param {string} context.orgName - 訪問先機関名
 * @returns {Object} - 分析結果のJSONオブジェクト
 */
function analyzeSalesCallWithVertexAI(context) {
  Logger.log('[Vertex AI] 営業音声分析開始');
  
  // 設定を取得
  const config = validateConfig();
  
  // 音声ファイルを取得（drive_utils.gsのgetAudioFile使用）
  const audioFile = getAudioFile(context.filePath, context.fileId);
  
  // ファイルサイズチェック
  validateFileSize(audioFile.blob, config.maxFileSizeMB);
  
  const fileSizeMB = getFileSizeMB(audioFile.blob).toFixed(2);
  Logger.log(`[Vertex AI] ファイル準備完了: ${audioFile.fileName} (${fileSizeMB}MB)`);
  Logger.log(`[Vertex AI] MIMEタイプ: ${audioFile.mimeType}`);
  
  // Base64エンコード
  const base64Data = encodeAudioToBase64(audioFile.blob);
  
  // プロンプト生成
  const prompt = buildSalesAnalysisPrompt(context);
  
  // Vertex AI APIを呼び出し
  const analysisResult = callVertexAIAPIForSalesAnalysis(
    prompt,
    base64Data,
    audioFile.mimeType,
    config
  );
  
  Logger.log('[Vertex AI] 営業音声分析完了');
  
  return analysisResult;
}

/**
 * Vertex AI APIを呼び出して営業分析を実行（inlineData方式）
 * 
 * @param {string} prompt - プロンプト
 * @param {string} base64Data - Base64エンコードされた音声データ
 * @param {string} mimeType - MIMEタイプ
 * @param {Object} config - 設定オブジェクト
 * @returns {Object} - 分析結果のJSONオブジェクト
 */
function callVertexAIAPIForSalesAnalysis(prompt, base64Data, mimeType, config) {
  const endpoint = getVertexAIEndpoint();
  const token = getOAuth2Token();
  
  // リクエストボディを構築（inlineData方式）
  const requestBody = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Data
          }
        }
      ]
    }],
    generation_config: {
      response_mime_type: 'application/json',
      temperature: config.temperature,
      max_output_tokens: config.maxOutputTokens
    }
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };
  
  Logger.log('[Vertex AI] API呼び出し開始');
  const startTime = new Date().getTime();
  
  const response = UrlFetchApp.fetch(endpoint, options);
  
  const endTime = new Date().getTime();
  const responseTime = endTime - startTime;
  
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  Logger.log(`[Vertex AI] API応答: ${responseCode}, 処理時間: ${responseTime}ms`);
  
  if (responseCode !== 200) {
    Logger.log(`[Vertex AI] エラーレスポンス: ${responseText}`);
    throw new Error(`Vertex AI API Error: ${responseCode} - ${responseText.substring(0, 200)}`);
  }
  
  // レスポンスを解析
  const jsonResponse = JSON.parse(responseText);
  
  // Vertex AI APIのレスポンス構造から分析結果を抽出
  // 非ストリーミングAPIの構造: { candidates: [...] }
  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    Logger.log(`[Vertex AI] デバッグ - レスポンス: ${responseText.substring(0, 500)}`);
    throw new Error('Vertex AIからの応答に有効な候補が含まれていません: ' + responseText.substring(0, 200));
  }
  
  const candidate = jsonResponse.candidates[0];
  
  // finishReasonをチェック
  if (candidate.finishReason) {
    Logger.log(`[Vertex AI] finishReason: ${candidate.finishReason}`);
    if (candidate.finishReason === 'MAX_TOKENS') {
      throw new Error('Vertex AIの応答がトークン制限により途中で終了しました。maxOutputTokensを増やすか、プロンプトを短くしてください。');
    }
  }
  
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    throw new Error('Vertex AIからの応答に有効なコンテンツが含まれていません');
  }
  
  // 分析結果を抽出してパース
  const analysisText = candidate.content.parts[0].text;
  Logger.log(`[Vertex AI] 応答テキスト長: ${analysisText.length}文字`);
  Logger.log(`[Vertex AI] 応答テキスト全文:\n${analysisText}`);
  
  // JSON抽出関数を使用（2段階戦略）
  let analysisResult;
  try {
    analysisResult = extractJSONFromText(analysisText);
  } catch (parseError) {
    Logger.log(`[Vertex AI] JSON抽出エラー: ${parseError.message}`);
    Logger.log(`[Vertex AI] 問題のテキスト（最初の1000文字）: ${analysisText.substring(0, 1000)}`);
    throw new Error(`JSON解析エラー: ${parseError.message}`);
  }
  
  Logger.log(`[Vertex AI] JSON解析完了: ${Object.keys(analysisResult).length}個のフィールド`);
  
  return analysisResult;
}

/**
 * テキストからJSONを抽出（2段階戦略）
 * 通話_要約生成と同じロジック
 * 
 * @param {string} text - AIの応答テキスト
 * @returns {Object} - 抽出されたJSONオブジェクト
 */
function extractJSONFromText(text) {
  if (!text) {
    throw new Error('AIの応答テキストが空です');
  }

  // Strategy 1: Markdownコードブロック抽出
  const markdownRegex = /```(?:json)?\s*([\s\S]+?)\s*```/i;
  const match = text.match(markdownRegex);
  
  if (match && match[1]) {
    try {
      Logger.log('[JSON抽出] Strategy 1 (Markdown) 使用');
      return JSON.parse(match[1].trim());
    } catch (error) {
      Logger.log(`[JSON抽出] Strategy 1 失敗: ${error.message}`);
    }
  }

  // Strategy 2: 括弧抽出
  Logger.log('[JSON抽出] Strategy 2 (括弧) 使用');
  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const jsonString = text.substring(startIndex, endIndex + 1);
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      Logger.log(`[JSON抽出] パースエラー: ${error.message}`);
      Logger.log(`抽出文字列 (先頭500文字): ${jsonString.substring(0, 500)}`);
      if (error.message.includes('Unexpected end')) {
        throw new Error('AIの応答が途中で終了 (トークン不足の可能性)');
      }
      throw new Error(`JSON解析エラー: ${error.message}`);
    }
  }

  // 両方失敗
  Logger.log(`[JSON抽出] 失敗\nテキスト (先頭500文字): ${text.substring(0, 500)}`);
  throw new Error('有効なJSONが見つかりませんでした');
}

/**
 * 営業音声分析用のプロンプトを生成
 * 
 * @param {Object} context - コンテキスト情報
 * @returns {string} - Vertex AI用プロンプト
 */
function buildSalesAnalysisPrompt(context) {
  return `
# あなたの役割

あなたは、営業コンサルタント兼データアナリストです。提供された営業担当者と面会相手との音声記録を分析し、以下の#評価指標に基づいて、営業活動の評価とサマリーを作成してください。

# 背景情報

- 営業担当者: ${context.salespersonName}
- 訪問先（機関）: ${context.orgName}
- 面会相手: ${context.contactName}

# 評価指標

## 関心度 (interest_level)

- **INT-01**: 非常に関心がある - 具体的な検討段階に入っており、前向きな発言や質問が多い。サービス導入に意欲的。
- **INT-02**: 関心がある - 依頼の可能性が高い。サービス内容に強い関心を示し、質問や確認が多い。
- **INT-03**: 普通 - 興味はあるが、判断材料が不足している状態。情報収集段階。
- **INT-04**: あまり関心がない - 関心が薄い、または現状では必要性を感じていない。
- **INT-05**: 関心がない - 全く関心がない、または否定的な状態。

## 当社を知っているか (knows_us)

- **AWR-01**: よく知っている - ステーション名、所在地など基本情報を正確に認知。
- **AWR-02**: 聞いたことがある - ステーション名は聞いたことがあるが、詳細は曖昧。
- **AWR-03**: ほとんど知らない - ほとんど、または全く知らない。

## 当社の印象 (our_impression)

- **IMP-01**: 非常に良い - 信頼感、専門性、対応力など、総合的に非常に高い評価。パートナーとして強く認識。
- **IMP-02**: 良い - 信頼感、専門性、対応力など、全体的に良い評価。連携に前向き。
- **IMP-03**: 普通 - 特に良いとも悪いとも思われていない状態。可もなく不可もなく。
- **IMP-04**: あまり良くない - 何らかの懸念点や不満がある状態。改善を求める点がある。
- **IMP-05**: 非常に悪い - 強い不満や不信感がある状態。重大な問題がある。

## 営業時間を知っているか (knows_hours)

- **HRS-01**: 正確に把握 - 平日の営業時間、土日祝の対応、緊急時連絡体制などを正確に把握。
- **HRS-02**: 大体知っている - 平日の大体の営業時間は知っているが、時間外等の対応は不確か。
- **HRS-03**: ほとんど知らない - ほとんど知らない、または誤解している。

## 当社の専門職の種別を知っているか (knows_job_types)

- **STF-01**: 具体的に知っている - 看護師に加え、配置しているリハビリ専門職（PT/OT/ST）の種類や構成まで具体的に知っている。
- **STF-02**: なんとなく知っている - 看護師とリハビリ専門職がいることは知っているが、職種の詳細までは知らない。
- **STF-03**: ほとんど知らない - 看護師のみと思っている、またはスタッフ構成についてほとんど知らない。

## 看護とリハで訪問可能時間が異なることを知っているか (knows_time_diff)

- **TIM-01**: 理解している - 時間帯の違いやその背景（例: リハ職の勤務体系）を理解している。
- **TIM-02**: 知っている - 異なる場合があることは知っているが、具体的な時間帯や理由は不明確。
- **TIM-03**: 知らない - 全く知らない、または同じだと思っている。
- **TIM-04**: 該当しない/不明 - 該当しない/不明。

## 提供サービスへの理解度 (understands_services)

- **UND-01**: よく理解している - 健康管理、医療処置、リハビリ、ターミナルケアなど、訪問看護の多様な役割を広く正しく理解している。
- **UND-02**: 部分的に理解 - 日常的な健康管理等が中心というイメージが強いなど、理解が限定的・部分的。
- **UND-03**: ほとんど知らない - ヘルパーサービスとの違いが不明瞭、またはサービス内容についてほとんど知らない・誤解がある。

## 訪問看護全体の印象 (overall_vhns_impression)

- **OVL-01**: 高く評価 - 在宅療養支援の重要なパートナーとして高く評価し、積極的に連携・活用したいという明確な意向がある。
- **OVL-02**: 必要性は認識 - 必要性は認識しているが、連携の手間や過去の経験から、利用や連携に多少の障壁を感じている様子。
- **OVL-03**: ネガティブ - あまり重要視していない、または訪問看護全体に対してネガティブな印象を持っている。

## 連携における悩みの有無 (has_coop_issues)

- **CWP-01**: なし - 悩みや不満、課題はない。
- **CWP-02**: ある - 何らかの悩みや不満、課題があることが表明される。

## 業務における悩み (has_work_issues)

- **WKP-01**: ある（具体的） - 自身の業務上の課題や困りごとについて、具体的な相談や意見交換を持ちかけてくる。
- **WKP-02**: ありそう - 一般的な業界の動向や当たり障りのない業務の話はするが、具体的な相談には至らない。
- **WKP-03**: なし - 業務に関する個人的な悩みや相談は全くされない。

## その他の悩み (has_other_issues)

- **OTH-01**: あり - 業務外の個人的なことや、業界全般に関する雑談・相談など、何らかの話がある。
- **OTH-02**: なし - 業務に関する話以外はほとんどしない、または全くない。

## 営業頻度 (sales_frequency_plan)

- **FRQ-01**: 週1回 - 非常に高い頻度での情報交換を希望。
- **FRQ-02**: 2週間に1回程度 - 定期的な情報交換を希望。
- **FRQ-03**: 月1回程度 - 一定の頻度での情報交換を希望。
- **FRQ-04**: 2-3ヶ月に1回、または必要時 - 情報提供は必要だが、頻度は高くない。
- **FRQ-05**: 営業の希望なし - 現時点では情報提供を希望していない。

# 出力指示

- 音声記録の内容を分析し、以下のキーを持つJSONオブジェクトを生成してください。
- **重要**: 定量評価項目には**評価指標ID**（例：「INT-02」）を文字列として設定してください。
- 定性評価項目には、会話から推測される内容を要約して記述してください。
- 該当する情報が会話にない場合は、値にnullを設定してください。
- **特に指定がない限り、詳細記述用の項目（..._details）は、対応する悩みや宿題が会話中に存在した場合にのみ内容を記述し、存在しない場合はnullにしてください。**

{
  "office_impression": "訪問した事業所の雰囲気や状況など、感じたこと",
  "contact_impression": "面会した担当者の反応や人柄など、感じたこと",
  "hearing_details": "面会中にヒアリングした内容の要点（箇条書きテキスト）",
  "knows_us": "（評価指標ID）",
  "our_impression": "（評価指標ID）",
  "knows_hours": "（評価指標ID）",
  "knows_job_types": "（評価指標ID）",
  "knows_time_diff": "（評価指標ID）",
  "understands_services": "（評価指標ID）",
  "main_partner_vhns": "現在、主に連携している訪問看護ステーション名",
  "partner_vhns_impression": "連携先の印象について、具体的な内容",
  "overall_vhns_impression": "（評価指標ID）",
  "coop_issue_details": "もし連携における悩みについて話があれば、その具体的な内容",
  "expectations_for_vhns": "訪問看護というサービスに期待すること",
  "info_needs_from_vhns": "訪問看護からどのような情報が欲しいか",
  "info_needs_from_sales": "営業担当者からどのような情報が欲しいか",
  "work_issue_details": "もし業務における悩みについて話があれば、その具体的な内容",
  "other_issue_details": "もしその他の悩みについて話があれば、その具体的な内容",
  "follow_up_task_details": "もし営業先からの宿題（依頼事項）があれば、その具体的な内容",
  "task_deadline": "もし宿題の対応期限について話があれば、その日付をISO 8601形式（YYYY-MM-DD）で推測",
  "next_approach": "次回どのようなアプローチをすべきか、具体的な方針や計画",
  "next_action_date": "次にアプローチすべき日付をISO 8601形式（YYYY-MM-DD）で推測",
  "interest_level": "（評価指標ID）",
  "sales_frequency_plan": "（評価指標ID）",
  "summary": "今回の営業活動全体の要約"
}
`;
}
