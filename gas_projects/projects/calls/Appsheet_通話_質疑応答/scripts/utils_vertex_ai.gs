/**
 * Vertex AI Gemini テキスト生成モジュール
 * 通話プロジェクト全体でVertex AIに統一
 *
 * @author Fractal Group
 * @version 3.0.0
 * @date 2025-10-17
 */

/**
 * Gemini モデル定義（Vertex AI用）
 */
const VERTEX_GEMINI_MODELS = {
  // Flash: 高速・コスト効率重視（通常タスク向け）
  FLASH: 'gemini-2.5-flash',

  // Pro: 高度な推論が必要なタスク向け
  PRO: 'gemini-2.5-pro',

  // Flash Lite: 最軽量・最速（シンプルなタスク向け）
  FLASH_LITE: 'gemini-2.5-flash-lite'
};

/**
 * デフォルト設定
 */
const VERTEX_DEFAULTS = {
  temperature: 0.3,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192
};

/**
 * 為替レート設定（USD -> JPY）
 * 2025年1月時点の想定レート
 */
const EXCHANGE_RATE_USD_TO_JPY_VERTEX_TEXT = 150;

/**
 * タスクタイプ別の推奨モデル
 */
const VERTEX_TASK_TYPE_MODELS = {
  simple: VERTEX_GEMINI_MODELS.FLASH_LITE,    // シンプルなタスク
  moderate: VERTEX_GEMINI_MODELS.FLASH,        // 中程度のタスク
  complex: VERTEX_GEMINI_MODELS.PRO            // 複雑なタスク
};

/**
 * タスクタイプに基づいて推奨モデルを取得
 * @param {string} taskType - 'simple', 'moderate', 'complex'
 * @return {string} モデル名
 */
function getRecommendedVertexModel(taskType = 'moderate') {
  return VERTEX_TASK_TYPE_MODELS[taskType] || VERTEX_GEMINI_MODELS.FLASH;
}

/**
 * Vertex AI でテキスト生成を実行（思考モード対応）
 * @param {string} prompt - プロンプト
 * @param {Object} config - 設定オブジェクト（GCPプロジェクトID、リージョンなど）
 * @param {Object} options - オプション設定
 * @param {string} options.modelName - 使用するモデル名
 * @param {string} options.taskType - タスクタイプ（'simple', 'moderate', 'complex'）
 * @param {boolean} options.enableThinking - 思考モードの有効化（デフォルト: true）
 * @param {number} options.thinkingBudget - 思考バジェット（-1: 動的、0: 無効、数値: 固定）
 * @param {number} options.temperature - 温度パラメータ
 * @param {number} options.maxOutputTokens - 最大出力トークン数
 * @return {string} 生成されたテキスト
 */
function generateTextWithVertex(prompt, config, options = {}) {
  // オプション設定のデフォルト値
  const modelName = options.modelName || getRecommendedVertexModel(options.taskType || 'moderate');
  const enableThinking = options.enableThinking !== false; // デフォルト true
  const thinkingBudget = options.thinkingBudget !== undefined ? options.thinkingBudget : -1; // 動的思考
  const temperature = options.temperature !== undefined ? options.temperature : VERTEX_DEFAULTS.temperature;
  const maxOutputTokens = options.maxOutputTokens || VERTEX_DEFAULTS.maxOutputTokens;
  
  // エンドポイントURL構築
  const endpoint = `https://${config.gcpLocation}-aiplatform.googleapis.com/v1/projects/${config.gcpProjectId}/locations/${config.gcpLocation}/publishers/google/models/${modelName}:generateContent`;
  
  Logger.log(`[Vertex AI Text] モデル: ${modelName}, タスク: ${options.taskType || 'moderate'}, 思考: ${enableThinking ? '有効' : '無効'}`);
  
  // リクエストボディ構築
  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: temperature,
      topP: options.topP || VERTEX_DEFAULTS.topP,
      topK: options.topK || VERTEX_DEFAULTS.topK,
      maxOutputTokens: maxOutputTokens
    }
  };
  
  // 思考モード設定
  if (enableThinking) {
    requestBody.generationConfig.thinkingConfig = {
      thinkingBudget: thinkingBudget
    };
  }
  
  // API呼び出しオプション
  const fetchOptions = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    headers: {
      'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
    },
    muteHttpExceptions: true
  };
  
  // API実行
  Logger.log('[Vertex AI Text] API呼び出し開始');
  const response = UrlFetchApp.fetch(endpoint, fetchOptions);
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  // エラーハンドリング
  if (statusCode !== 200) {
    Logger.log(`[Vertex AI Text] エラー: ${statusCode} - ${responseText}`);
    throw new Error(`Vertex AI API Error: ${statusCode} - ${responseText}`);
  }
  
  // レスポンス解析
  const jsonResponse = JSON.parse(responseText);
  
  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    throw new Error("Vertex AIからの応答に有効な候補が含まれていません");
  }
  
  const candidate = jsonResponse.candidates[0];
  
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    let errorMsg = 'AIの応答にコンテンツがありません';
    if (candidate.finishReason) {
      errorMsg += ` [終了理由: ${candidate.finishReason}]`;
    }
    throw new Error(errorMsg);
  }
  
  const generatedText = candidate.content.parts[0].text;

  // usageMetadataを抽出（料金計算）
  const usageMetadata = extractVertexAIUsageMetadata(jsonResponse, modelName, 'text');

  Logger.log(`[Vertex AI Text] 生成成功（${generatedText.length}文字）`);
  if (usageMetadata) {
    Logger.log(`[Vertex AI Text] 使用量: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
  }

  // 結果とusageMetadataを返す
  return {
    text: generatedText,
    usageMetadata: usageMetadata
  };
}

/**
 * Vertex AI でJSON生成を実行（思考モード対応）
 * @param {string} prompt - プロンプト
 * @param {Object} config - 設定オブジェクト
 * @param {Object} options - オプション設定（generateTextWithVertexと同じ）
 * @return {Object} パース済みJSONオブジェクト
 */
function generateJSONWithVertex(prompt, config, options = {}) {
  // JSON出力を強制
  const modelName = options.modelName || getRecommendedVertexModel(options.taskType || 'moderate');
  const enableThinking = options.enableThinking !== false;
  const thinkingBudget = options.thinkingBudget !== undefined ? options.thinkingBudget : -1;
  const temperature = options.temperature !== undefined ? options.temperature : VERTEX_DEFAULTS.temperature;
  const maxOutputTokens = options.maxOutputTokens || VERTEX_DEFAULTS.maxOutputTokens;
  
  // エンドポイントURL構築
  const endpoint = `https://${config.gcpLocation}-aiplatform.googleapis.com/v1/projects/${config.gcpProjectId}/locations/${config.gcpLocation}/publishers/google/models/${modelName}:generateContent`;
  
  Logger.log(`[Vertex AI JSON] モデル: ${modelName}, タスク: ${options.taskType || 'moderate'}, 思考: ${enableThinking ? '有効' : '無効'}`);
  
  // リクエストボディ構築
  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseMimeType: "application/json", // JSON出力を強制
      temperature: temperature,
      topP: options.topP || VERTEX_DEFAULTS.topP,
      topK: options.topK || VERTEX_DEFAULTS.topK,
      maxOutputTokens: maxOutputTokens
    }
  };
  
  // 思考モード設定
  if (enableThinking) {
    requestBody.generationConfig.thinkingConfig = {
      thinkingBudget: thinkingBudget
    };
  }
  
  // API呼び出しオプション
  const fetchOptions = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    headers: {
      'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
    },
    muteHttpExceptions: true
  };
  
  // API実行
  const response = UrlFetchApp.fetch(endpoint, fetchOptions);
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  // エラーハンドリング
  if (statusCode !== 200) {
    Logger.log(`[Vertex AI JSON] エラー: ${statusCode} - ${responseText}`);
    throw new Error(`Vertex AI API Error: ${statusCode} - ${responseText}`);
  }
  
  // レスポンス解析
  const jsonResponse = JSON.parse(responseText);
  
  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    throw new Error("Vertex AIからの応答に有効な候補が含まれていません");
  }
  
  const candidate = jsonResponse.candidates[0];
  
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    throw new Error("AIの応答にコンテンツがありません");
  }
  
  const contentText = candidate.content.parts[0].text;

  // usageMetadataを抽出（料金計算）
  const usageMetadata = extractVertexAIUsageMetadata(jsonResponse, modelName, 'text');

  try {
    const jsonObject = JSON.parse(contentText);
    Logger.log('[Vertex AI JSON] JSON生成・パース成功');
    if (usageMetadata) {
      Logger.log(`[Vertex AI JSON] 使用量: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
    }

    // 結果とusageMetadataを返す
    return {
      data: jsonObject,
      usageMetadata: usageMetadata
    };
  } catch (error) {
    Logger.log(`[Vertex AI JSON] JSON解析エラー: ${contentText.substring(0, 500)}`);
    throw new Error(`JSON解析エラー: ${error.message}`);
  }
}

/**
 * Vertex AI APIレスポンスからusageMetadataを抽出（日本円計算付き）
 * @param {Object} jsonResponse - APIレスポンス
 * @param {string} modelName - 使用したモデル名
 * @param {string} inputType - 入力タイプ ('audio' | 'text')
 * @return {Object|null} {inputTokens, outputTokens, inputCostJPY, outputCostJPY, totalCostJPY, model}
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
  const inputCostJPY = inputCostUSD * EXCHANGE_RATE_USD_TO_JPY_VERTEX_TEXT;
  const outputCostJPY = outputCostUSD * EXCHANGE_RATE_USD_TO_JPY_VERTEX_TEXT;
  const totalCostJPY = totalCostUSD * EXCHANGE_RATE_USD_TO_JPY_VERTEX_TEXT;

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
  const match = modelName.match(/(gemini-[\d.]+-(?:flash|pro|flash-lite))/i);
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
    'gemini-2.5-flash-lite': {
      text: { inputPer1M: 0.0188, outputPer1M: 0.075 },  // Flash Lite
      audio: { inputPer1M: 0.0188, outputPer1M: 0.075 }
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

  Logger.log(`[価格取得] モデル: ${normalizedModelName}, 入力タイプ: ${inputType}, Input: $${pricingTable[normalizedModelName][inputType].inputPer1M}/1M, Output: $${pricingTable[normalizedModelName][inputType].outputPer1M}/1M`);
  return pricingTable[normalizedModelName][inputType];
}

/**
 * 後方互換性のための関数（旧名称）
 */
function callGeminiAPI(prompt, apiKey, modelName, options = {}) {
  Logger.log('[警告] callGeminiAPI は非推奨です。generateTextWithVertex を使用してください。');
  const config = getConfig(); // core_config.gs の設定を取得
  const result = generateTextWithVertex(prompt, config, {
    modelName: modelName,
    ...options
  });
  return result.text; // 後方互換性のためtextのみ返す
}

function generateText(prompt, apiKey, modelName, options = {}) {
  Logger.log('[警告] generateText は非推奨です。generateTextWithVertex を使用してください。');
  const config = getConfig();
  const result = generateTextWithVertex(prompt, config, {
    modelName: modelName,
    ...options
  });
  return result.text; // 後方互換性のためtextのみ返す
}

function generateJSON(prompt, apiKey, modelName, options = {}) {
  Logger.log('[警告] generateJSON は非推奨です。generateJSONWithVertex を使用してください。');
  const config = getConfig();
  const result = generateJSONWithVertex(prompt, config, {
    modelName: modelName,
    ...options
  });
  return result.data; // 後方互換性のためdataのみ返す
}
