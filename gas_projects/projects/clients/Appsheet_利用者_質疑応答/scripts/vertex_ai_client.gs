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
 * @param {string} promptText - ユーザーの質問（必須）
 * @param {string} documentText - 参照ドキュメント（オプション）
 * @return {Object} 回答と要約を含むオブジェクト
 * @return {string} return.answer - 詳細な回答
 * @return {string} return.summary - 回答の要約
 * @return {Object} return.usageMetadata - API使用量情報（トークン数、料金）
 */
function generateAnswerAndSummaryWithGemini(promptText, documentText = null) {
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] === 関数開始 ===`);

  // パラメータ情報ログ
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] パラメータ:`);
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - promptText: ${promptText ? promptText.length + '文字' : 'なし'}`);
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - documentText: ${documentText ? documentText.length + '文字' : 'なし'}`);

  if (promptText) {
    Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - promptTextプレビュー: ${promptText.substring(0, 200)}...`);
  }
  if (documentText) {
    Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - documentTextプレビュー: ${documentText.substring(0, 200)}...`);
  }

  // プロンプト生成
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] プロンプト生成中...`);
  const prompt = _createGeminiPrompt(promptText, documentText);
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] プロンプト生成完了: ${prompt.length}文字`);

  const config = CONFIG.GEMINI;

  // リクエストボディ構築
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] リクエストボディ構築中...`);
  const requestBody = {
    contents: [{
      role: "user",
      parts: [{ text: prompt }]
    }],
    generationConfig: config.GENERATION_CONFIG
  };

  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] リクエストボディ詳細:`);
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - contents.length: ${requestBody.contents.length}`);
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - generationConfig: ${JSON.stringify(config.GENERATION_CONFIG)}`);

  // Vertex AI APIエンドポイント（OAuth2認証）
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] API URL構築中...`);
  const url = `https://${config.GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${config.GCP_PROJECT_ID}/locations/${config.GCP_LOCATION}/publishers/google/models/${config.MODEL_NAME}:generateContent`;

  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] API設定:`);
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - GCP_PROJECT_ID: ${config.GCP_PROJECT_ID}`);
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - GCP_LOCATION: ${config.GCP_LOCATION}`);
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - MODEL_NAME: ${config.MODEL_NAME}`);
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - URL: ${url}`);

  // OAuth2トークン取得
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] OAuth2トークン取得中...`);
  const oauthToken = ScriptApp.getOAuthToken();
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] OAuth2トークン取得成功: ${oauthToken ? oauthToken.substring(0, 20) + '...' : 'なし'}`);

  // リクエストオプション構築
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${oauthToken}` },
    payload: JSON.stringify(requestBody)
  };

  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] リクエストオプション:`);
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - method: ${options.method}`);
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - contentType: ${options.contentType}`);
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - payload長: ${options.payload.length}文字`);

  // API呼び出し実行
  Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] fetchWithRetry実行中...`);
  const startTime = new Date();

  try {
    const response = fetchWithRetry(url, options, "Vertex AI API");
    const duration = new Date() - startTime;

    Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] ✅ API呼び出し成功 (${duration}ms)`);

    const responseText = response.getContentText();
    Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] レスポンステキスト長: ${responseText.length}文字`);
    Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] レスポンステキストプレビュー: ${responseText.substring(0, 500)}...`);

    // レスポンスパース
    Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] レスポンスパース開始...`);
    const result = _parseGeminiResponse(responseText);
    Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] ✅ レスポンスパース成功`);
    Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] === 関数終了 ===`);

    return result;

  } catch (error) {
    const duration = new Date() - startTime;
    Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] ❌ エラー発生 (${duration}ms)`);
    Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini] エラー詳細:`);
    Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - エラーメッセージ: ${error.message}`);
    Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - エラータイプ: ${error.name}`);
    if (error.stack) {
      Logger.log(`[DEBUG][generateAnswerAndSummaryWithGemini]   - スタックトレース: ${error.stack}`);
    }
    throw error;
  }
}

/**
 * Gemini APIプロンプト生成
 * 参照資料がある場合とない場合で異なるプロンプトを作成
 *
 * @private
 * @param {string} promptText - ユーザーの質問（必須）
 * @param {string} documentText - 参照ドキュメント（オプション）
 * @return {string} 構造化プロンプト
 */
function _createGeminiPrompt(promptText, documentText = null) {
  // 参照資料がある場合
  if (documentText && documentText.trim()) {
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

  // 参照資料がない場合（通常の質疑応答）
  return `
# あなたの役割

あなたは、ユーザーからの質問に的確に答える、優秀なAIアシスタントです。

# ユーザーからの質問

${promptText}

---

# 出力指示

- ユーザーからの質問に対する**詳細な回答**と、その回答を**簡潔に要約したもの**の両方を生成してください。

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
 * @private
 * @param {string} responseText - APIレスポンステキスト
 * @return {Object} パース結果
 * @return {string} return.answer - 詳細な回答
 * @return {string} return.summary - 回答の要約
 * @return {Object} return.usageMetadata - API使用量情報
 * @throws {Error} レスポンスのパースまたはバリデーションに失敗した場合
 */
function _parseGeminiResponse(responseText) {
  Logger.log(`[DEBUG][parseGeminiResponse] === 関数開始 ===`);
  Logger.log(`[DEBUG][parseGeminiResponse] レスポンステキスト長: ${responseText.length}文字`);

  let jsonResponse;

  // JSONパース（第1段階）
  Logger.log(`[DEBUG][parseGeminiResponse] レスポンステキストのJSONパース開始...`);
  try {
    jsonResponse = JSON.parse(responseText);
    Logger.log(`[DEBUG][parseGeminiResponse] ✅ JSONパース成功`);
  } catch (e) {
    Logger.log(`[DEBUG][parseGeminiResponse] ❌ JSONパースエラー: ${e.message}`);
    throw new Error("AIからの応答（JSON）の解析に失敗しました。");
  }

  // エラーチェック
  Logger.log(`[DEBUG][parseGeminiResponse] エラーチェック開始...`);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    Logger.log(`[DEBUG][parseGeminiResponse] ❌ 候補が存在しない`);

    if (jsonResponse.error) {
      Logger.log(`[DEBUG][parseGeminiResponse] APIエラー検出: ${jsonResponse.error.message}`);
      throw new Error(`AIプラットフォームでエラーが発生しました: ${jsonResponse.error.message}`);
    }

    if (jsonResponse.promptFeedback && jsonResponse.promptFeedback.blockReason) {
      Logger.log(`[DEBUG][parseGeminiResponse] プロンプトブロック検出: ${jsonResponse.promptFeedback.blockReason}`);
      throw new Error(`AIへのリクエストがブロックされました。理由: ${jsonResponse.promptFeedback.blockReason}`);
    }

    throw new Error("AIからの応答に有効な候補が含まれていません。");
  }

  Logger.log(`[DEBUG][parseGeminiResponse] 候補数: ${jsonResponse.candidates.length}`);

  const candidate = jsonResponse.candidates[0];
  Logger.log(`[DEBUG][parseGeminiResponse] 候補[0]取得完了`);

  // 完了理由チェック
  Logger.log(`[DEBUG][parseGeminiResponse] 完了理由チェック...`);
  const finishReason = candidate.finishReason || 'なし';
  Logger.log(`[DEBUG][parseGeminiResponse] 完了理由: ${finishReason}`);

  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    Logger.log(`[DEBUG][parseGeminiResponse] ❌ 不完全な完了理由: ${candidate.finishReason}`);
    throw new Error(`AIの生成が不完全な状態で終了しました。理由: ${candidate.finishReason}`);
  }
  Logger.log(`[DEBUG][parseGeminiResponse] ✅ 完了理由OK`);

  // テキストコンテンツ抽出
  Logger.log(`[DEBUG][parseGeminiResponse] テキストコンテンツ抽出開始...`);
  if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0].text) {
    Logger.log(`[DEBUG][parseGeminiResponse] ❌ テキストコンテンツが存在しない`);
    throw new Error("AIからの応答にテキストコンテンツが含まれていません。");
  }

  let contentText = candidate.content.parts[0].text;
  Logger.log(`[DEBUG][parseGeminiResponse] コンテンツテキスト長: ${contentText.length}文字`);
  Logger.log(`[DEBUG][parseGeminiResponse] コンテンツテキストプレビュー: ${contentText.substring(0, 300)}...`);

  // マークダウン記法のJSON除去
  Logger.log(`[DEBUG][parseGeminiResponse] マークダウン記法チェック...`);
  const jsonMatch = contentText.match(/```json\s*([\s\S]*?)\s*```/m);
  if (jsonMatch && jsonMatch[1]) {
    Logger.log(`[DEBUG][parseGeminiResponse] マークダウン記法検出、除去中...`);
    contentText = jsonMatch[1];
    Logger.log(`[DEBUG][parseGeminiResponse] マークダウン除去後のテキスト長: ${contentText.length}文字`);
  } else {
    Logger.log(`[DEBUG][parseGeminiResponse] マークダウン記法なし`);
  }

  // JSON抽出
  Logger.log(`[DEBUG][parseGeminiResponse] JSON抽出開始...`);
  const startIndex = contentText.indexOf('{');
  const endIndex = contentText.lastIndexOf('}');

  Logger.log(`[DEBUG][parseGeminiResponse] JSON開始位置: ${startIndex}, 終了位置: ${endIndex}`);

  if (startIndex === -1 || endIndex === -1) {
    Logger.log(`[DEBUG][parseGeminiResponse] ❌ JSON開始または終了が見つからない`);
    throw new Error("AIの応答から有効なJSON形式を抽出できませんでした。");
  }

  const jsonString = contentText.substring(startIndex, endIndex + 1);
  Logger.log(`[DEBUG][parseGeminiResponse] JSON文字列抽出完了: ${jsonString.length}文字`);
  Logger.log(`[DEBUG][parseGeminiResponse] JSON文字列プレビュー: ${jsonString.substring(0, 200)}...`);

  // JSONパース（第2段階：コンテンツ部分）
  Logger.log(`[DEBUG][parseGeminiResponse] コンテンツJSONパース開始...`);
  try {
    const result = JSON.parse(jsonString);
    Logger.log(`[DEBUG][parseGeminiResponse] ✅ コンテンツJSONパース成功`);

    Logger.log(`[DEBUG][parseGeminiResponse] 結果検証...`);
    Logger.log(`[DEBUG][parseGeminiResponse]   - answerキー存在: ${!!result.answer}, タイプ: ${typeof result.answer}`);
    Logger.log(`[DEBUG][parseGeminiResponse]   - summaryキー存在: ${!!result.summary}, タイプ: ${typeof result.summary}`);

    if (result.answer) {
      Logger.log(`[DEBUG][parseGeminiResponse]   - answer長: ${result.answer.length}文字`);
      Logger.log(`[DEBUG][parseGeminiResponse]   - answerプレビュー: ${result.answer.substring(0, 100)}...`);
    }

    if (result.summary) {
      Logger.log(`[DEBUG][parseGeminiResponse]   - summary長: ${result.summary.length}文字`);
      Logger.log(`[DEBUG][parseGeminiResponse]   - summaryプレビュー: ${result.summary.substring(0, 100)}...`);
    }

    if (result && typeof result.answer === 'string' && typeof result.summary === 'string') {
      Logger.log(`[DEBUG][_parseGeminiResponse] ✅ 必須キー検証OK`);

      // usageMetadataを抽出して追加
      Logger.log(`[DEBUG][_parseGeminiResponse] usageMetadata抽出開始...`);
      const usageMetadata = _extractUsageMetadata(jsonResponse);

      if (usageMetadata) {
        Logger.log(`[DEBUG][_parseGeminiResponse] usageMetadata:`);
        Logger.log(`[DEBUG][parseGeminiResponse]   - model: ${usageMetadata.model}`);
        Logger.log(`[DEBUG][parseGeminiResponse]   - inputTokens: ${usageMetadata.inputTokens}`);
        Logger.log(`[DEBUG][parseGeminiResponse]   - outputTokens: ${usageMetadata.outputTokens}`);
        Logger.log(`[DEBUG][parseGeminiResponse]   - totalCostJPY: ¥${usageMetadata.totalCostJPY.toFixed(4)}`);
      } else {
        Logger.log(`[DEBUG][parseGeminiResponse] usageMetadataなし`);
      }

      Logger.log(`[DEBUG][parseGeminiResponse] === 関数終了 ===`);
      return {
        ...result,
        usageMetadata: usageMetadata
      };
    } else {
      Logger.log(`[DEBUG][parseGeminiResponse] ❌ 必須キーが不足`);
      throw new Error("AIの応答に必要なキー（answer, summary）が含まれていません。");
    }

  } catch (e) {
    Logger.log(`[DEBUG][parseGeminiResponse] ❌ コンテンツJSONパースエラー: ${e.message}`);
    throw new Error(`AIが生成したコンテンツの解析に失敗しました: ${e.message}`);
  }
}

/**
 * APIレスポンスからusageMetadataを抽出（日本円計算）
 * モデル名と入力タイプに応じて動的に料金を計算
 *
 * @private
 * @param {Object} jsonResponse - Vertex AIのAPIレスポンス
 * @param {string} modelName - 使用したモデル名（デフォルト: CONFIG.GEMINI.MODEL_NAME）
 * @param {string} inputType - 入力タイプ ('audio' | 'text')
 * @return {Object|null} usageMetadata情報
 * @return {string} return.model - モデル名
 * @return {number} return.inputTokens - 入力トークン数
 * @return {number} return.outputTokens - 出力トークン数
 * @return {number} return.inputCostJPY - 入力コスト（円）
 * @return {number} return.outputCostJPY - 出力コスト（円）
 * @return {number} return.totalCostJPY - 合計コスト（円）
 */
function _extractUsageMetadata(jsonResponse, modelName = null, inputType = 'text') {
  if (!jsonResponse.usageMetadata) {
    return null;
  }

  // モデル名が指定されていない場合はCONFIGから取得
  if (!modelName) {
    modelName = CONFIG.GEMINI.MODEL_NAME || 'gemini-2.5-flash';
  }

  const usage = jsonResponse.usageMetadata;
  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = usage.candidatesTokenCount || 0;

  // モデル名と入力タイプに応じた価格を取得
  const pricing = _getVertexAIPricing(modelName, inputType);
  const inputCostUSD = (inputTokens / 1000000) * pricing.inputPer1M;
  const outputCostUSD = (outputTokens / 1000000) * pricing.outputPer1M;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  // 日本円に換算
  const inputCostJPY = inputCostUSD * EXCHANGE_RATE_USD_TO_JPY;
  const outputCostJPY = outputCostUSD * EXCHANGE_RATE_USD_TO_JPY;
  const totalCostJPY = totalCostUSD * EXCHANGE_RATE_USD_TO_JPY;

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
 * @private
 * @param {string} modelName - モデル名
 * @return {string} 正規化されたモデル名
 */
function _normalizeModelName(modelName) {
  // 'gemini-2.5-flash-001' → 'gemini-2.5-flash'
  // 'publishers/google/models/gemini-2.5-flash' → 'gemini-2.5-flash'
  const match = modelName.match(/(gemini-[\d.]+-(?:flash|pro|flash-lite))/i);
  return match ? match[1].toLowerCase() : modelName.toLowerCase();
}

/**
 * Vertex AIモデルの価格情報を取得（モデル名と入力タイプに応じて動的に決定）
 * @private
 * @param {string} modelName - モデル名
 * @param {string} inputType - 入力タイプ ('audio' | 'text')
 * @return {Object} {inputPer1M, outputPer1M}
 */
function _getVertexAIPricing(modelName, inputType = 'text') {
  // 2025年1月時点のVertex AI価格（USD/100万トークン）
  // 実際の価格はGCPドキュメントを参照: https://cloud.google.com/vertex-ai/generative-ai/pricing
  const pricingTable = {
    'gemini-2.5-flash': {
      text: { inputPer1M: 0.075, outputPer1M: 0.30 },
      audio: { inputPer1M: 1.00, outputPer1M: 2.50 }  // 音声入力（GA版）
    },
    'gemini-2.5-flash-lite': {
      text: { inputPer1M: 0.0188, outputPer1M: 0.075 },
      audio: { inputPer1M: 0.0188, outputPer1M: 0.075 }
    },
    'gemini-2.5-pro': {
      text: { inputPer1M: 1.25, outputPer1M: 10.00 },
      audio: { inputPer1M: 1.25, outputPer1M: 10.00 }  // 音声入力
    },
    'gemini-1.5-flash': {
      text: { inputPer1M: 0.075, outputPer1M: 0.30 },
      audio: { inputPer1M: 0.075, outputPer1M: 0.30 }
    },
    'gemini-1.5-pro': {
      text: { inputPer1M: 1.25, outputPer1M: 5.00 },
      audio: { inputPer1M: 1.25, outputPer1M: 5.00 }
    }
  };

  // モデル名を正規化
  const normalizedModelName = _normalizeModelName(modelName);

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

  Logger.log(`[価格取得] モデル: ${normalizedModelName}, 入力タイプ: ${inputType}, Input: $${pricingTable[normalizedModelName][inputType].inputPer1M}/1M, Output: $${pricingTable[normalizedModelName][inputType].outputPer1M}/1M`);
  return pricingTable[normalizedModelName][inputType];
}


/**
 * 思考の要約を抽出（思考モデル専用）
 * レスポンスのpartsから思考の要約（thought: true）を抽出
 *
 * @private
 * @param {Object} jsonResponse - APIレスポンス
 * @return {string|null} 思考の要約テキスト
 */
function _extractThoughtsSummary(jsonResponse) {
  try {
    if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
      return null;
    }

    const candidate = jsonResponse.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      return null;
    }

    // partsの中からthought: trueの部分を探す
    for (const part of candidate.content.parts) {
      if (part.thought === true && part.text) {
        return part.text;
      }
    }

    return null;

  } catch (error) {
    Logger.log(`[DEBUG][_extractThoughtsSummary] 思考要約の抽出エラー: ${error.message}`);
    return null;
  }
}


/**
 * 通常の質疑応答処理（2段階AI処理）
 * 1. flash-liteで利用者基本情報と参考資料から関連情報を抽出
 * 2. flash思考モデルで最終的な回答を生成
 *
 * @param {string} promptText - ユーザーの質問（必須）
 * @param {string} userId - 利用者ID（必須）
 * @param {string} userBasicInfo - 利用者の基本情報（必須）
 * @param {string} referenceData - 参考資料（必須）
 * @return {Object} 回答と要約を含むオブジェクト
 * @return {string} return.answer - 詳細な回答
 * @return {string} return.summary - 回答の要約
 * @return {Object} return.usageMetadata - API使用量情報（トークン数、料金）
 * @return {string} return.extractedInfo - 抽出された関連情報
 */
function processNormalQAWithTwoStage(promptText, userId, userBasicInfo, referenceData) {
  Logger.log(`[DEBUG][processNormalQAWithTwoStage] === 関数開始 ===`);
  Logger.log(`[DEBUG][processNormalQAWithTwoStage] userId: ${userId}`);
  Logger.log(`[DEBUG][processNormalQAWithTwoStage] promptText: ${promptText.substring(0, 100)}...`);
  Logger.log(`[DEBUG][processNormalQAWithTwoStage] userBasicInfo長: ${userBasicInfo.length}文字`);
  Logger.log(`[DEBUG][processNormalQAWithTwoStage] referenceData長: ${referenceData.length}文字`);

  const totalUsageMetadata = {
    model: 'gemini-2.5-flash + gemini-2.5-flash-thinking',
    inputTokens: 0,
    outputTokens: 0,
    inputCostJPY: 0,
    outputCostJPY: 0,
    totalCostJPY: 0
  };

  try {
    // ステップ1: flash-liteで関連情報抽出
    Logger.log(`[DEBUG][processNormalQAWithTwoStage] === ステップ1: 関連情報抽出 ===`);
    const extractedInfo = _extractRelevantInfo(promptText, userBasicInfo, referenceData);
    
    Logger.log(`[DEBUG][processNormalQAWithTwoStage] 抽出された情報長: ${extractedInfo.length}文字`);
    Logger.log(`[DEBUG][processNormalQAWithTwoStage] 抽出された情報プレビュー: ${extractedInfo.substring(0, 200)}...`);

    // ステップ2: flash思考モデルで最終回答生成
    Logger.log(`[DEBUG][processNormalQAWithTwoStage] === ステップ2: 最終回答生成 ===`);
    const finalResult = _generateAnswerWithThinkingModel(promptText, userId, extractedInfo);

    Logger.log(`[DEBUG][processNormalQAWithTwoStage] 最終回答長: ${finalResult.answer.length}文字`);
    Logger.log(`[DEBUG][processNormalQAWithTwoStage] 要約長: ${finalResult.summary.length}文字`);

    // 使用量メタデータを統合
    if (finalResult.usageMetadata) {
      totalUsageMetadata.inputTokens = finalResult.usageMetadata.inputTokens || 0;
      totalUsageMetadata.outputTokens = finalResult.usageMetadata.outputTokens || 0;
      totalUsageMetadata.inputCostJPY = finalResult.usageMetadata.inputCostJPY || 0;
      totalUsageMetadata.outputCostJPY = finalResult.usageMetadata.outputCostJPY || 0;
      totalUsageMetadata.totalCostJPY = finalResult.usageMetadata.totalCostJPY || 0;
    }

    Logger.log(`[DEBUG][processNormalQAWithTwoStage] === 関数終了 ===`);

    return {
      answer: finalResult.answer,
      summary: finalResult.summary,
      usageMetadata: totalUsageMetadata,
      extractedInfo: extractedInfo  // デバッグ用
    };

  } catch (error) {
    Logger.log(`[DEBUG][processNormalQAWithTwoStage] ❌ エラー発生: ${error.message}`);
    if (error.stack) {
      Logger.log(`[DEBUG][processNormalQAWithTwoStage] スタックトレース: ${error.stack}`);
    }
    throw error;
  }
}


/**
 * flash-liteで関連情報を抽出
 * 利用者基本情報と参考資料から、プロンプトに関連する要点を抽出
 *
 * @private
 * @param {string} promptText - ユーザーの質問
 * @param {string} userBasicInfo - 利用者の基本情報
 * @param {string} referenceData - 参考資料
 * @return {string} 抽出された関連情報
 */
function _extractRelevantInfo(promptText, userBasicInfo, referenceData) {
  Logger.log(`[DEBUG][extractRelevantInfo] === 関数開始 ===`);

  const config = CONFIG.GEMINI;

  // プロンプト生成
  const prompt = `
# あなたの役割

あなたは、大量のデータから質問に関連する重要な情報を抽出する専門家です。

# 利用者基本情報

${userBasicInfo}

# 参考資料

${referenceData}

---

# ユーザーからの質問

${promptText}

---

# 指示

上記の「利用者基本情報」と「参考資料」の中から、ユーザーの質問に回答するために**必要な情報だけ**を抽出してください。

- 質問に関連しない情報は除外してください
- 重要な数値、日付、状態、症状などは必ず含めてください
- 簡潔に要点をまとめてください
- 箇条書きで出力してください

出力形式はプレーンテキストで、説明文などは不要です。
`;

  Logger.log(`[DEBUG][extractRelevantInfo] プロンプト生成完了: ${prompt.length}文字`);

  // リクエストボディ構築
  const requestBody = {
    contents: [{
      role: "user",
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.2  // 抽出タスクなので低めの温度
    }
  };

  // Vertex AI APIエンドポイント（flash-lite使用）
  const url = `https://${config.GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${config.GCP_PROJECT_ID}/locations/${config.GCP_LOCATION}/publishers/google/models/${config.EXTRACTOR_MODEL_NAME}:generateContent`;

  Logger.log(`[DEBUG][extractRelevantInfo] API URL: ${url}`);

  // OAuth2トークン取得
  const oauthToken = ScriptApp.getOAuthToken();

  // リクエストオプション構築
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${oauthToken}` },
    payload: JSON.stringify(requestBody)
  };

  Logger.log(`[DEBUG][extractRelevantInfo] fetchWithRetry実行中...`);
  const startTime = new Date();

  try {
    const response = fetchWithRetry(url, options, "Vertex AI Extractor");
    const duration = new Date() - startTime;

    Logger.log(`[DEBUG][extractRelevantInfo] ✅ API呼び出し成功 (${duration}ms)`);

    const responseText = response.getContentText();
    const jsonResponse = JSON.parse(responseText);

    // エラーチェック
    if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
      throw new Error("関連情報の抽出に失敗しました（候補が空）");
    }

    const candidate = jsonResponse.candidates[0];
    
    if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0].text) {
      throw new Error("関連情報の抽出に失敗しました（テキストが空）");
    }

    const extractedText = candidate.content.parts[0].text;
    
    Logger.log(`[DEBUG][extractRelevantInfo] ✅ 抽出成功: ${extractedText.length}文字`);
    Logger.log(`[DEBUG][extractRelevantInfo] === 関数終了 ===`);

    return extractedText;

  } catch (error) {
    const duration = new Date() - startTime;
    Logger.log(`[DEBUG][extractRelevantInfo] ❌ エラー発生 (${duration}ms): ${error.message}`);
    throw new Error(`関連情報の抽出に失敗しました: ${error.message}`);
  }
}


/**
 * flash思考モデルで最終回答を生成
 * 抽出された関連情報と質問を使って、詳細な回答と要約を生成
 *
 * @private
 * @param {string} promptText - ユーザーの質問
 * @param {string} userId - 利用者ID
 * @param {string} extractedInfo - 抽出された関連情報
 * @return {Object} 回答と要約を含むオブジェクト
 * @return {string} return.answer - 詳細な回答
 * @return {string} return.summary - 回答の要約
 * @return {Object} return.usageMetadata - API使用量情報
 */
function _generateAnswerWithThinkingModel(promptText, userId, extractedInfo) {
  Logger.log(`[DEBUG][generateAnswerWithThinkingModel] === 関数開始 ===`);

  const config = CONFIG.GEMINI;

  // プロンプト生成（思考モデル用）
  const prompt = `
# あなたの役割

あなたは、利用者の質問に対して的確で丁寧な回答を提供する、優秀なAIアシスタントです。

# 利用者ID

${userId}

# 関連情報

以下は、質問に関連する利用者情報と参考資料から抽出された要点です。

${extractedInfo}

---

# ユーザーからの質問

${promptText}

---

# 指示

上記の関連情報を基に、ユーザーの質問に対する**詳細な回答**と、その**簡潔な要約**を生成してください。

**重要な注意事項**:
- 思考プロセスを使って、情報を深く分析してください
- 回答は具体的で実用的な内容にしてください
- 利用者IDを踏まえて、個別化された回答を心がけてください
- 関連情報に含まれていない事項については、推測であることを明示してください

**出力形式**:

回答と要約を以下のJSON形式で返してください。マークダウン記法や説明文は含めないでください。

{
  "answer": "（ここに、質問に対する詳細な回答を記述）",
  "summary": "（ここに、上記answerの内容を簡潔に要約したものを記述）"
}
`;

  Logger.log(`[DEBUG][generateAnswerWithThinkingModel] プロンプト生成完了: ${prompt.length}文字`);

  // リクエストボディ構築（思考モデル用設定）
  const requestBody = {
    contents: [{
      role: "user",
      parts: [{ text: prompt }]
    }],
    generationConfig: config.THINKING_CONFIG
  };

  // Vertex AI APIエンドポイント（flash思考モデル使用）
  const url = `https://${config.GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${config.GCP_PROJECT_ID}/locations/${config.GCP_LOCATION}/publishers/google/models/${config.THINKING_MODEL_NAME}:generateContent`;

  Logger.log(`[DEBUG][generateAnswerWithThinkingModel] API URL: ${url}`);

  // OAuth2トークン取得
  const oauthToken = ScriptApp.getOAuthToken();

  // リクエストオプション構築
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${oauthToken}` },
    payload: JSON.stringify(requestBody)
  };

  Logger.log(`[DEBUG][_generateAnswerWithThinkingModel] fetchWithRetry実行中...`);
  const startTime = new Date();

  try {
    const response = fetchWithRetry(url, options, "Vertex AI Thinking Model");
    const duration = new Date() - startTime;

    Logger.log(`[DEBUG][_generateAnswerWithThinkingModel] ✅ API呼び出し成功 (${duration}ms)`);

    const responseText = response.getContentText();
    Logger.log(`[DEBUG][_generateAnswerWithThinkingModel] レスポンステキスト長: ${responseText.length}文字`);

    const jsonResponse = JSON.parse(responseText);
    
    // 思考の要約を抽出（思考モデル専用）
    const thoughtsSummary = _extractThoughtsSummary(jsonResponse);
    if (thoughtsSummary) {
      Logger.log(`[DEBUG][_generateAnswerWithThinkingModel] 思考の要約: ${thoughtsSummary.substring(0, 200)}...`);
    }

    // レスポンスパース（_parseGeminiResponseを再利用）
    const result = _parseGeminiResponse(responseText);
    
    // 思考の要約を結果に追加
    if (thoughtsSummary) {
      result.thoughtsSummary = thoughtsSummary;
    }
    
    Logger.log(`[DEBUG][_generateAnswerWithThinkingModel] ✅ パース成功`);
    Logger.log(`[DEBUG][_generateAnswerWithThinkingModel] === 関数終了 ===`);

    return result;

  } catch (error) {
    const duration = new Date() - startTime;
    Logger.log(`[DEBUG][_generateAnswerWithThinkingModel] ❌ エラー発生 (${duration}ms): ${error.message}`);
    throw new Error(`最終回答の生成に失敗しました: ${error.message}`);
  }
}

