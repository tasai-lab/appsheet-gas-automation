/**
 * Gemini モデル定義モジュール
 * Gemini API のモデル名と設定を統一管理
 * @author Fractal Group
 * @version 1.1.0
 * @date 2025-10-17
 * 
 * 参考: https://ai.google.dev/gemini-api/docs/thinking?hl=ja
 * 参考: https://ai.google.dev/gemini-api/docs/models/gemini?hl=ja
 */

/**
 * Gemini モデル定義
 */
const GEMINI_MODELS = {
  // Flash モデル（高速・軽量タスク向け）
  // バランスの取れた機能を提供する、価格とパフォーマンスの面で最適なモデル
  FLASH: 'gemini-2.5-flash',
  
  // Pro モデル（高度な推論向け）
  // コード、数学、STEMの複雑な問題を推論できる最先端の思考モデル
  PRO: 'gemini-2.5-pro',
  
  // Flash-Lite モデル（費用対効果重視）
  // 費用対効果と高スループットを重視して最適化された、最も高速なFlashモデル
  FLASH_LITE: 'gemini-2.5-flash-lite'
};

/**
 * タスクタイプに応じた推奨モデルを取得
 * @param {string} taskType - タスクタイプ ('simple', 'moderate', 'complex')
 * @return {string} モデル名
 */
function getRecommendedModel(taskType) {
  switch (taskType) {
    case 'simple':
      // シンプルなタスク: Flash-Lite モデル（最速）
      return GEMINI_MODELS.FLASH_LITE;
    
    case 'moderate':
      // 中等度の思考力が必要: Flash モデル（思考モード有効）
      return GEMINI_MODELS.FLASH;
    
    case 'complex':
      // 複雑な推論が必要: Pro モデル
      return GEMINI_MODELS.PRO;
    
    default:
      // デフォルトは Flash（バランス重視）
      return GEMINI_MODELS.FLASH;
  }
}

/**
 * モデルに応じた推奨 GenerationConfig を取得
 * @param {string} modelName - モデル名
 * @param {Object} options - オプション設定
 * @return {Object} GenerationConfig
 */
function getGenerationConfig(modelName, options = {}) {
  const baseConfig = {
    temperature: options.temperature || 0.3,
    topP: options.topP || 1.0,
    topK: options.topK || 32,
    maxOutputTokens: options.maxOutputTokens || 8192
  };
  
  // 思考モードを有効化する場合（Gemini 2.5シリーズでサポート）
  // thinkingBudget: -1 で動的思考（モデルが自動で調整）
  // thinkingBudget: 0 で思考無効
  // thinkingBudget: 数値 で思考トークン数を指定
  if (options.enableThinking) {
    baseConfig.thinkingConfig = {
      thinkingBudget: options.thinkingBudget || -1  // -1 = 動的思考
    };
    
    // 思考の要約を含める場合
    if (options.includeThoughts) {
      baseConfig.thinkingConfig.includeThoughts = true;
    }
  }
  
  // JSON出力を要求する場合
  if (options.jsonMode) {
    baseConfig.responseMimeType = 'application/json';
  }
  
  return baseConfig;
}

/**
 * Gemini API を呼び出す統一関数
 * @param {string} prompt - プロンプト
 * @param {string} apiKey - Gemini API キー
 * @param {Object} options - オプション
 * @return {Object} API レスポンス
 */
function callGeminiAPI(prompt, apiKey, options = {}) {
  // タスクタイプからモデルを決定（指定がない場合）
  const modelName = options.modelName || getRecommendedModel(options.taskType || 'moderate');
  
  // 中等度・複雑タスクの場合は思考モードを自動で有効化
  if (!options.hasOwnProperty('enableThinking')) {
    options.enableThinking = (options.taskType === 'moderate' || options.taskType === 'complex');
  }
  
  // GenerationConfig を生成
  const generationConfig = getGenerationConfig(modelName, options);
  
  // リクエストボディを構築
  const textPart = { text: prompt };
  const requestBody = {
    contents: [{ parts: [textPart] }],
    generationConfig: generationConfig
  };
  
  // Safety Settings（オプション）
  if (options.safetySettings) {
    requestBody.safetySettings = options.safetySettings;
  }
  
  // API URL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  // HTTP リクエスト
  const httpOptions = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };
  
  Logger.log(`[Gemini API] モデル: ${modelName}, タスクタイプ: ${options.taskType || 'moderate'}, 思考モード: ${options.enableThinking ? '有効' : '無効'}`);
  
  const response = UrlFetchApp.fetch(url, httpOptions);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  if (responseCode >= 400) {
    Logger.log(`[Gemini API] エラー: ${responseCode} - ${responseText}`);
    throw new Error(`Gemini API Error: ${responseCode} - ${responseText}`);
  }
  
  const jsonResponse = JSON.parse(responseText);
  
  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    throw new Error("Gemini APIからの応答に有効な候補が含まれていません");
  }
  
  return jsonResponse;
}

/**
 * Gemini API レスポンスからテキストを抽出
 * @param {Object} response - Gemini API レスポンス
 * @return {string} 抽出されたテキスト
 */
function extractTextFromResponse(response) {
  if (!response.candidates || response.candidates.length === 0) {
    throw new Error("応答に有効な候補が含まれていません");
  }
  
  const candidate = response.candidates[0];
  
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    throw new Error("応答にテキストが含まれていません");
  }
  
  return candidate.content.parts[0].text;
}

/**
 * Gemini API を呼び出してテキストを取得する簡易関数
 * @param {string} prompt - プロンプト
 * @param {string} apiKey - Gemini API キー
 * @param {Object} options - オプション
 * @return {string} 生成されたテキスト
 */
function generateText(prompt, apiKey, options = {}) {
  const response = callGeminiAPI(prompt, apiKey, options);
  return extractTextFromResponse(response);
}

/**
 * Gemini API を呼び出して JSON を取得する簡易関数
 * @param {string} prompt - プロンプト
 * @param {string} apiKey - Gemini API キー
 * @param {Object} options - オプション
 * @return {Object} パース済み JSON
 */
function generateJSON(prompt, apiKey, options = {}) {
  options.jsonMode = true;
  const response = callGeminiAPI(prompt, apiKey, options);
  const text = extractTextFromResponse(response);
  
  try {
    return JSON.parse(text);
  } catch (e) {
    Logger.log(`[Gemini API] JSON解析エラー: ${text}`);
    throw new Error(`Gemini応答がJSON形式ではありません: ${e.message}`);
  }
}

/**
 * テスト関数
 */
function testGeminiModels() {
  const config = getConfig();
  
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('Gemini モデル定義テスト');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  Logger.log('\n[モデル一覧]');
  Logger.log(`Flash: ${GEMINI_MODELS.FLASH}`);
  Logger.log(`Pro: ${GEMINI_MODELS.PRO}`);
  Logger.log(`Flash-Lite: ${GEMINI_MODELS.FLASH_LITE}`);
  
  Logger.log('\n[推奨モデル]');
  Logger.log(`Simple タスク: ${getRecommendedModel('simple')}`);
  Logger.log(`Moderate タスク: ${getRecommendedModel('moderate')}`);
  Logger.log(`Complex タスク: ${getRecommendedModel('complex')}`);
  
  Logger.log('\n[GenerationConfig]');
  const config1 = getGenerationConfig(GEMINI_MODELS.FLASH, { enableThinking: false });
  Logger.log(`Flash (思考なし): ${JSON.stringify(config1, null, 2)}`);
  
  const config2 = getGenerationConfig(GEMINI_MODELS.FLASH, { enableThinking: true });
  Logger.log(`Flash (思考モード): ${JSON.stringify(config2, null, 2)}`);
  
  const config3 = getGenerationConfig(GEMINI_MODELS.PRO, { enableThinking: true, thinkingBudget: 1024 });
  Logger.log(`Pro (思考モード・予算指定): ${JSON.stringify(config3, null, 2)}`);
  
  Logger.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 実際の API 呼び出しテスト（オプション）
  if (config.geminiApiKey) {
    Logger.log('\n[API 呼び出しテスト]');
    try {
      const result = generateText(
        '「こんにちは」を英語に翻訳してください。',
        config.geminiApiKey,
        { taskType: 'simple' }
      );
      Logger.log(`結果: ${result}`);
    } catch (e) {
      Logger.log(`エラー: ${e.message}`);
    }
  }
}
