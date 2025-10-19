/**
 * Vertex AI統合モジュール
 * Gemini 2.5 Proモデルによる質疑応答生成
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-20
 */

/**
 * Vertex AI Gemini APIで回答と要約を生成
 * OAuth2認証を使用したVertex AIエンドポイントを呼び出し
 *
 * @param {string} documentText - 参照ドキュメント
 * @param {string} promptText - ユーザーの質問
 * @return {Object} 回答と要約を含むオブジェクト
 * @return {string} return.answer - 詳細な回答
 * @return {string} return.summary - 回答の要約
 * @return {Object} return.usageMetadata - API使用量情報（トークン数、料金）
 */
function generateAnswerAndSummaryWithGemini(documentText, promptText) {
  const prompt = createGeminiPrompt(documentText, promptText);
  const config = CONFIG.GEMINI;

  const requestBody = {
    contents: [{
      role: "user",
      parts: [{ text: prompt }]
    }],
    generationConfig: config.GENERATION_CONFIG
  };

  // Vertex AI APIエンドポイント（OAuth2認証）
  const url = `https://${config.GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${config.GCP_PROJECT_ID}/locations/${config.GCP_LOCATION}/publishers/google/models/${config.MODEL_NAME}:generateContent`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${ScriptApp.getOAuthToken()}` },
    payload: JSON.stringify(requestBody)
  };

  const response = fetchWithRetry(url, options, "Vertex AI API");
  const responseText = response.getContentText();

  return parseGeminiResponse(responseText);
}

/**
 * Gemini APIプロンプト生成
 * 参照資料と質問を含む構造化プロンプトを作成
 *
 * @param {string} documentText - 参照ドキュメント
 * @param {string} promptText - ユーザーの質問
 * @return {string} 構造化プロンプト
 */
function createGeminiPrompt(documentText, promptText) {
  return `
# あなたの役割

あなたは、提供された#参照資料を深く理解し、#ユーザーからの質問に的確に答える、優秀なAIアシスタントです。

# 参照資料

${documentText}

---

# ユーザーからの質問

${promptText}

---

# 出力指示

- 上記の参照資料のみに基づいて、ユーザーからの質問に対する**詳細な回答**と、その回答を**簡潔に要約したもの**の両方を生成してください。

- 応答は、必ず以下の構造を持つ有効なJSONオブジェクト形式で返してください。マークダウン記法（例: \`\`\`json）や説明文などは一切含めないでください。

{
  "answer": "（ここに、質問に対する詳細な回答を記述）",
  "summary": "（ここに、上記answerの内容を簡潔に要約したものを記述）"
}
`;
}

/**
 * Gemini APIレスポンスをパース
 * JSON抽出、バリデーション、使用量メタデータの追加
 *
 * @param {string} responseText - APIレスポンステキスト
 * @return {Object} パース結果
 * @return {string} return.answer - 詳細な回答
 * @return {string} return.summary - 回答の要約
 * @return {Object} return.usageMetadata - API使用量情報
 * @throws {Error} レスポンスのパースまたはバリデーションに失敗した場合
 */
function parseGeminiResponse(responseText) {
  let jsonResponse;

  try {
    jsonResponse = JSON.parse(responseText);
  } catch (e) {
    throw new Error("AIからの応答（JSON）の解析に失敗しました。");
  }

  // エラーチェック
  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    if (jsonResponse.error) {
      throw new Error(`AIプラットフォームでエラーが発生しました: ${jsonResponse.error.message}`);
    }

    if (jsonResponse.promptFeedback && jsonResponse.promptFeedback.blockReason) {
      throw new Error(`AIへのリクエストがブロックされました。理由: ${jsonResponse.promptFeedback.blockReason}`);
    }

    throw new Error("AIからの応答に有効な候補が含まれていません。");
  }

  const candidate = jsonResponse.candidates[0];

  // 完了理由チェック
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`AIの生成が不完全な状態で終了しました。理由: ${candidate.finishReason}`);
  }

  // テキストコンテンツ抽出
  if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0].text) {
    throw new Error("AIからの応答にテキストコンテンツが含まれていません。");
  }

  let contentText = candidate.content.parts[0].text;

  // マークダウン記法のJSON除去
  const jsonMatch = contentText.match(/```json\s*([\s\S]*?)\s*```/m);
  if (jsonMatch && jsonMatch[1]) {
    contentText = jsonMatch[1];
  }

  // JSON抽出
  const startIndex = contentText.indexOf('{');
  const endIndex = contentText.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1) {
    throw new Error("AIの応答から有効なJSON形式を抽出できませんでした。");
  }

  const jsonString = contentText.substring(startIndex, endIndex + 1);

  try {
    const result = JSON.parse(jsonString);

    if (result && typeof result.answer === 'string' && typeof result.summary === 'string') {
      // usageMetadataを抽出して追加
      const usageMetadata = extractUsageMetadata(jsonResponse);
      return {
        ...result,
        usageMetadata: usageMetadata
      };
    } else {
      throw new Error("AIの応答に必要なキー（answer, summary）が含まれていません。");
    }

  } catch (e) {
    throw new Error(`AIが生成したコンテンツの解析に失敗しました: ${e.message}`);
  }
}

/**
 * APIレスポンスからusageMetadataを抽出（日本円計算）
 * Vertex AI Gemini 2.5 Flashの価格設定に基づいて料金を計算
 *
 * @param {Object} jsonResponse - Vertex AIのAPIレスポンス
 * @return {Object|null} usageMetadata情報
 * @return {string} return.model - モデル名
 * @return {number} return.inputTokens - 入力トークン数
 * @return {number} return.outputTokens - 出力トークン数
 * @return {number} return.inputCostJPY - 入力コスト（円）
 * @return {number} return.outputCostJPY - 出力コスト（円）
 * @return {number} return.totalCostJPY - 合計コスト（円）
 */
function extractUsageMetadata(jsonResponse) {
  if (!jsonResponse.usageMetadata) {
    return null;
  }

  const usage = jsonResponse.usageMetadata;
  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = usage.candidatesTokenCount || 0;

  // Vertex AI Gemini 2.5 Flash価格（USD/100万トークン）
  // 出典: https://cloud.google.com/vertex-ai/generative-ai/pricing
  const inputPer1M = 0.075;    // $0.075/1M tokens (≤128K)
  const outputPer1M = 0.30;    // $0.30/1M tokens (テキスト出力)

  const inputCostUSD = (inputTokens / 1000000) * inputPer1M;
  const outputCostUSD = (outputTokens / 1000000) * outputPer1M;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  // 日本円に換算
  const inputCostJPY = inputCostUSD * EXCHANGE_RATE_USD_TO_JPY;
  const outputCostJPY = outputCostUSD * EXCHANGE_RATE_USD_TO_JPY;
  const totalCostJPY = totalCostUSD * EXCHANGE_RATE_USD_TO_JPY;

  return {
    model: 'vertex-ai-gemini-2.5-flash',
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    inputCostJPY: inputCostJPY,
    outputCostJPY: outputCostJPY,
    totalCostJPY: totalCostJPY
  };
}
