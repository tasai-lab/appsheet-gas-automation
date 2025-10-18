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
  Logger.log(`[Vertex AI Text] 生成成功（${generatedText.length}文字）`);
  
  return generatedText;
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
  
  try {
    const jsonObject = JSON.parse(contentText);
    Logger.log('[Vertex AI JSON] JSON生成・パース成功');
    return jsonObject;
  } catch (error) {
    Logger.log(`[Vertex AI JSON] JSON解析エラー: ${contentText.substring(0, 500)}`);
    throw new Error(`JSON解析エラー: ${error.message}`);
  }
}

/**
 * 後方互換性のための関数（旧名称）
 */
function callGeminiAPI(prompt, apiKey, modelName, options = {}) {
  Logger.log('[警告] callGeminiAPI は非推奨です。generateTextWithVertex を使用してください。');
  const config = getConfig(); // core_config.gs の設定を取得
  return generateTextWithVertex(prompt, config, {
    modelName: modelName,
    ...options
  });
}

function generateText(prompt, apiKey, modelName, options = {}) {
  Logger.log('[警告] generateText は非推奨です。generateTextWithVertex を使用してください。');
  const config = getConfig();
  return generateTextWithVertex(prompt, config, {
    modelName: modelName,
    ...options
  });
}

function generateJSON(prompt, apiKey, modelName, options = {}) {
  Logger.log('[警告] generateJSON は非推奨です。generateJSONWithVertex を使用してください。');
  const config = getConfig();
  return generateJSONWithVertex(prompt, config, {
    modelName: modelName,
    ...options
  });
}
