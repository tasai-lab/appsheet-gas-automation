/**
 * AI処理モジュール
 *
 * Vertex AI（Gemini）を使用した利用者情報の抽出処理
 *
 * @version 1.0.0
 * @date 2025-10-21
 */

// ========================================
// 定数
// ========================================

// USD to JPY為替レート（Vertex AI料金計算用）
const EXCHANGE_RATE_USD_TO_JPY_VERTEX = 150;

// ========================================
// AI処理
// ========================================

/**
 * Vertex AI (Gemini) を使用して、依頼情報から利用者情報を抽出する
 *
 * @param {string} clientInfoTemp - 利用者に関するメモ
 * @param {string} requestReason - 依頼理由
 * @return {Object} { extractedInfo: 抽出された利用者情報, usageMetadata: コスト情報 }
 */
function extractClientInfoWithGemini(clientInfoTemp, requestReason) {
  const prompt = buildExtractionPrompt(clientInfoTemp, requestReason);
  const parts = buildRequestParts(prompt);
  const requestBody = buildVertexAIRequest(parts);

  const response = callVertexAI(requestBody);

  return parseVertexAIResponse(response);
}

/**
 * 情報抽出用のプロンプトを構築
 * @private
 */
function buildExtractionPrompt(clientInfoTemp, requestReason) {
  return `
# あなたの役割

あなたは、訪問看護ステーションの優秀な医療事務スタッフです。以下の#依頼情報を精査し、新しい利用者（クライアント）の基本情報を日本の公的書類の形式に準拠して、極めて正確に抽出してください。

# 依頼情報

## 依頼理由

${requestReason || '記載なし'}

## 利用者に関するメモ

${clientInfoTemp}

# 抽出ルールと出力形式

- 全ての情報を元に、以下のJSONオブジェクトのキーに対応する値を抽出・推測してください。

- 該当する情報がない場合は、値にnullを設定してください。

- JSON以外の説明文は一切含めないでください。

{

  "last_name": "姓",

  "first_name": "名",

  "last_name_kana": "セイ（カタカナ）",

  "first_name_kana": "メイ（カタカナ）",

  "gender": "性別（「男性」「女性」「その他」のいずれか）",

  "birth_date": "生年月日を西暦のYYYY/MM/DD形式で抽出。例えば「昭和6年2月1日」は「1931/02/01」と変換。",

  "birth_date_nengo": "生年月日の年号を「大正」「昭和」「平成」「令和」のいずれかで抽出。",

  "birth_date_nengo_year": "生年月日の年号の年数を数値で抽出。例えば「昭和6年」なら 6。",

  "is_welfare_recipient": "生活保護を受給している事実があれば true, なければ false のブール値。",

  "care_level_name": "要介護度を抽出。必ず「要支援１」「要介護５」のように数字を全角にしてください。",

  "phone1": "可能な限り利用者本人の電話番号を抽出。",

  "phone1_destination": "phone1の電話番号の持ち主（例：「本人」「自宅」「妻」「長男」）",

  "phone2": "本人以外の緊急連絡先など、2つ目の電話番号を抽出。",

  "phone2_destination": "phone2の電話番号の持ち主（例：「長女」「キーパーソン」）",

  "special_notes": "特記事項（ADL、アレルギー、キーパーソン、その他注意点など）を要約"

}

`;
}

/**
 * リクエストパーツを構築（テキストのみ）
 * @private
 */
function buildRequestParts(prompt) {
  const textPart = { text: prompt };
  return [textPart];
}

/**
 * Vertex AIリクエストボディを構築
 * @private
 */
function buildVertexAIRequest(parts) {
  const generationConfig = {
    responseMimeType: "application/json",
    temperature: VERTEX_AI_CONFIG.temperature,
    maxOutputTokens: VERTEX_AI_CONFIG.maxOutputTokens
  };

  return {
    contents: [{ parts: parts }],
    generationConfig: generationConfig
  };
}

/**
 * Vertex AI APIを呼び出す
 * @private
 */
function callVertexAI(requestBody) {
  const url = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${VERTEX_AI_MODEL}:generateContent`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${ScriptApp.getOAuthToken()}` },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  Logger.log('[Vertex AI] API呼び出し開始');
  const startTime = new Date().getTime();

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  const endTime = new Date().getTime();
  const responseTime = endTime - startTime;

  Logger.log(`[Vertex AI] API応答: ${responseCode}, 処理時間: ${responseTime}ms`);

  if (responseCode !== 200) {
    Logger.log(`[Vertex AI] エラーレスポンス: ${responseText}`);
    throw new Error(`Vertex AI API Error: ${responseCode} - ${responseText.substring(0, 200)}`);
  }

  return responseText;
}

/**
 * Vertex AIのレスポンスをパースして抽出情報を返す
 * @private
 */
function parseVertexAIResponse(responseText) {
  const jsonResponse = JSON.parse(responseText);

  // usageMetadataを先に抽出（エラー時でもコストを記録するため）
  const usageMetadata = extractVertexAIUsageMetadata(jsonResponse, VERTEX_AI_MODEL, 'text');

  // 非ストリーミングAPIの構造: { candidates: [...] }
  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    const error = new Error("AIからの応答に有効な候補が含まれていません: " + responseText.substring(0, 200));
    error.usageMetadata = usageMetadata; // エラーにもusageMetadataを添付
    throw error;
  }

  const candidate = jsonResponse.candidates[0];

  // finishReasonチェック
  if (candidate.finishReason) {
    Logger.log(`[Vertex AI] finishReason: ${candidate.finishReason}`);
    if (candidate.finishReason === 'MAX_TOKENS') {
      const error = new Error('Vertex AIの応答がトークン制限により途中で終了しました。');
      error.usageMetadata = usageMetadata;
      throw error;
    }
  }

  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    const error = new Error('Vertex AIからの応答に有効なコンテンツが含まれていません');
    error.usageMetadata = usageMetadata;
    throw error;
  }

  const extractedText = candidate.content.parts[0].text;
  Logger.log(`[Vertex AI] 応答テキスト長: ${extractedText.length}文字`);

  if (usageMetadata) {
    Logger.log(`[Vertex AI] 使用量: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
  }

  const extractedInfo = JSON.parse(extractedText);

  return {
    extractedInfo: extractedInfo,
    usageMetadata: usageMetadata
  };
}

// ========================================
// コスト計算
// ========================================

/**
 * Vertex AI APIレスポンスからusageMetadataを抽出（日本円計算）
 * @param {Object} jsonResponse - Vertex AI APIレスポンス
 * @param {string} modelName - モデル名
 * @param {string} inputType - 入力タイプ ('text' | 'audio')
 * @return {Object|null} {model, inputTokens, outputTokens, inputCostJPY, outputCostJPY, totalCostJPY}
 */
function extractVertexAIUsageMetadata(jsonResponse, modelName, inputType = 'text') {
  if (!jsonResponse.usageMetadata) {
    return null;
  }

  const usage = jsonResponse.usageMetadata;
  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = usage.candidatesTokenCount || 0;

  // モデル名と入力タイプに応じた価格を取得
  const pricing = getVertexAIPricing(modelName, inputType);
  const inputCostUSD = (inputTokens / 1000000) * pricing.inputPer1M;
  const outputCostUSD = (outputTokens / 1000000) * pricing.outputPer1M;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  // 日本円に換算
  const inputCostJPY = inputCostUSD * EXCHANGE_RATE_USD_TO_JPY_VERTEX;
  const outputCostJPY = outputCostUSD * EXCHANGE_RATE_USD_TO_JPY_VERTEX;
  const totalCostJPY = totalCostUSD * EXCHANGE_RATE_USD_TO_JPY_VERTEX;

  return {
    model: modelName,
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    inputCostJPY: inputCostJPY,
    outputCostJPY: outputCostJPY,
    totalCostJPY: totalCostJPY
  };
}

/**
 * モデル名を正規化（バージョン番号やプレフィックスを削除）
 * @param {string} modelName - モデル名
 * @return {string} 正規化されたモデル名
 */
function normalizeModelName(modelName) {
  // 'gemini-2.5-flash-001' → 'gemini-2.5-flash'
  // 'publishers/google/models/gemini-2.5-flash' → 'gemini-2.5-flash'
  const match = modelName.match(/(gemini-[\d.]+-(?:flash|pro))/i);
  return match ? match[1].toLowerCase() : modelName.toLowerCase();
}

/**
 * Vertex AIモデルの価格情報を取得（モデル名と入力タイプに応じて動的に決定）
 * @param {string} modelName - モデル名
 * @param {string} inputType - 入力タイプ ('audio' | 'text')
 * @return {Object} {inputPer1M, outputPer1M}
 */
function getVertexAIPricing(modelName, inputType = 'text') {
  // 2025年1月時点のVertex AI価格（USD/100万トークン）
  // 実際の価格はGCPドキュメントを参照: https://cloud.google.com/vertex-ai/generative-ai/pricing
  const pricingTable = {
    'gemini-2.5-flash': {
      text: { inputPer1M: 0.075, outputPer1M: 0.30 },
      audio: { inputPer1M: 1.00, outputPer1M: 2.50 }  // 音声入力（GA版）
    },
    'gemini-2.5-pro': {
      text: { inputPer1M: 1.25, outputPer1M: 10.00 },
      audio: { inputPer1M: 1.25, outputPer1M: 10.00 }  // 音声入力
    },
    'gemini-1.5-flash': {
      text: { inputPer1M: 0.075, outputPer1M: 0.30 },
      audio: { inputPer1M: 0.075, outputPer1M: 0.30 }  // 音声入力
    },
    'gemini-1.5-pro': {
      text: { inputPer1M: 1.25, outputPer1M: 5.00 },
      audio: { inputPer1M: 1.25, outputPer1M: 5.00 }  // 音声入力
    }
  };

  // モデル名を正規化
  const normalizedModelName = normalizeModelName(modelName);

  // モデルが見つからない場合はデフォルト価格を使用
  if (!pricingTable[normalizedModelName]) {
    Logger.log(`[価格取得] ⚠️ 未知のモデル: ${modelName}, デフォルト価格（gemini-2.5-flash）を使用`);
    return pricingTable['gemini-2.5-flash'][inputType] || pricingTable['gemini-2.5-flash']['text'];
  }

  // 入力タイプが見つからない場合はテキスト価格を使用
  if (!pricingTable[normalizedModelName][inputType]) {
    Logger.log(`[価格取得] ⚠️ 未知の入力タイプ: ${inputType}, テキスト価格を使用`);
    return pricingTable[normalizedModelName]['text'];
  }

  return pricingTable[normalizedModelName][inputType];
}
