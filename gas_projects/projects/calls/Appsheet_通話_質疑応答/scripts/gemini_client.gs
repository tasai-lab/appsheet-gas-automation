/**
 * Vertex AI Gemini クライアント（統合版）
 * Google AI Studio APIからVertex AIに完全移行
 *
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-22
 */

/**
 * Vertex AI設定
 */
const VERTEX_AI_CONFIG = {
  // GCP設定
  projectId: 'macro-shadow-458705-v8',
  location: 'us-central1',

  // モデル定義
  models: {
    PRO: 'gemini-2.5-pro',
    FLASH: 'gemini-2.5-flash',
    FLASH_LITE: 'gemini-2.5-flash-lite'
  },

  // デフォルト設定
  defaults: {
    temperature: 0.3,
    maxOutputTokens: 8192,
    topP: 0.95,
    topK: 40
  }
};

/**
 * Vertex AI Gemini クライアントクラス
 */
class VertexAIGeminiClient {

  /**
   * コンストラクタ
   * @param {string} model - 使用するモデル
   * @param {Object} options - オプション設定
   */
  constructor(model = VERTEX_AI_CONFIG.models.FLASH, options = {}) {
    this.model = model;
    this.projectId = options.projectId || VERTEX_AI_CONFIG.projectId;
    this.location = options.location || VERTEX_AI_CONFIG.location;
    this.temperature = options.temperature ?? VERTEX_AI_CONFIG.defaults.temperature;
    this.maxOutputTokens = options.maxOutputTokens ?? VERTEX_AI_CONFIG.defaults.maxOutputTokens;
    this.topP = options.topP ?? VERTEX_AI_CONFIG.defaults.topP;
    this.topK = options.topK ?? VERTEX_AI_CONFIG.defaults.topK;
    this.enableThinking = options.enableThinking !== false; // デフォルト true
    this.thinkingBudget = options.thinkingBudget !== undefined ? options.thinkingBudget : -1; // 動的思考
  }

  /**
   * テキスト生成
   * @param {string} prompt - プロンプト
   * @param {Object} logger - ロガーインスタンス（オプション）
   * @return {Object} {text: 生成されたテキスト, usageMetadata: 使用量情報}
   */
  generateText(prompt, logger = null) {
    if (logger) {
      logger.info(`Vertex AI呼び出し開始（モデル: ${this.model}, 思考: ${this.enableThinking ? '有効' : '無効'}）`);
    }

    const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.model}:generateContent`;

    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: this.maxOutputTokens,
        topP: this.topP,
        topK: this.topK
      }
    };

    // 思考モード設定
    if (this.enableThinking) {
      requestBody.generationConfig.thinkingConfig = {
        thinkingBudget: this.thinkingBudget
      };
    }

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      headers: {
        'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
      },
      muteHttpExceptions: true
    };

    if (logger) {
      logger.info(`リクエスト送信（プロンプト長: ${prompt.length}文字）`);
    }

    try {
      const response = UrlFetchApp.fetch(endpoint, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (logger) {
        logger.info(`レスポンス受信（ステータス: ${responseCode}）`);
      }

      let jsonResponse = null;
      try {
        jsonResponse = JSON.parse(responseText);
      } catch (parseError) {
        // JSON解析失敗時は元のレスポンステキストをエラーに含める
        const error = `Vertex AI APIエラー（ステータス: ${responseCode}）: ${responseText}`;
        if (logger) {
          logger.error(error);
        }
        throw new Error(error);
      }

      // エラーレスポンスでもusageMetadataが存在する可能性があるため先に抽出
      const usageMetadata = this._extractUsageMetadata(jsonResponse, this.model);

      // エラー時：usageMetadataをloggerに記録してからthrow（エラー後は取得不可）
      if (responseCode !== 200) {
        if (usageMetadata && logger) {
          logger.setUsageMetadata(usageMetadata);
          logger.info(`使用量（エラー時）: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
        }

        const error = `Vertex AI APIエラー（ステータス: ${responseCode}）: ${responseText}`;
        if (logger) {
          logger.error(error);
        }
        throw new Error(error);
      }

      // レスポンス検証
      if (!jsonResponse.candidates ||
          jsonResponse.candidates.length === 0 ||
          !jsonResponse.candidates[0].content ||
          !jsonResponse.candidates[0].content.parts ||
          jsonResponse.candidates[0].content.parts.length === 0) {

        const finishReason = jsonResponse.candidates?.[0]?.finishReason || 'UNKNOWN';

        // エラー時：usageMetadataをloggerに記録してからthrow（エラー後は取得不可）
        if (usageMetadata && logger) {
          logger.setUsageMetadata(usageMetadata);
          logger.info(`使用量（エラー時）: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
        }

        const error = `Vertex AIレスポンスに有効なコンテンツが含まれていません（finishReason: ${finishReason}）`;
        if (logger) {
          logger.error(error, { response: jsonResponse });
        }
        throw new Error(error);
      }

      const generatedText = jsonResponse.candidates[0].content.parts[0].text.trim();

      // 成功時：usageMetadataをloggerに記録
      if (usageMetadata && logger) {
        logger.setUsageMetadata(usageMetadata);
        logger.success(`テキスト生成成功（生成文字数: ${generatedText.length}）`);
        logger.info(`使用量: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
      } else if (logger) {
        logger.success(`テキスト生成成功（生成文字数: ${generatedText.length}）`);
      }

      return {
        text: generatedText,
        usageMetadata: usageMetadata
      };

    } catch (error) {
      if (logger) {
        logger.error(`Vertex AI呼び出しエラー: ${error.toString()}`, {
          model: this.model,
          promptLength: prompt.length,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  /**
   * JSONフォーマットでテキスト生成
   * @param {string} prompt - プロンプト
   * @param {Object} logger - ロガーインスタンス（オプション）
   * @return {Object} {data: パース済みJSONオブジェクト, usageMetadata: 使用量情報}
   */
  generateJSON(prompt, logger = null) {
    if (logger) {
      logger.info('JSON生成モードで実行');
    }

    const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.model}:generateContent`;

    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: "application/json", // JSON出力を強制
        temperature: this.temperature,
        maxOutputTokens: this.maxOutputTokens,
        topP: this.topP,
        topK: this.topK
      }
    };

    // 思考モード設定
    if (this.enableThinking) {
      requestBody.generationConfig.thinkingConfig = {
        thinkingBudget: this.thinkingBudget
      };
    }

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      headers: {
        'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
      },
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(endpoint, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      let jsonResponse = null;
      try {
        jsonResponse = JSON.parse(responseText);
      } catch (parseError) {
        const error = `Vertex AI APIエラー（ステータス: ${responseCode}）: ${responseText}`;
        if (logger) {
          logger.error(error);
        }
        throw new Error(error);
      }

      // エラーレスポンスでもusageMetadataが存在する可能性があるため先に抽出
      const usageMetadata = this._extractUsageMetadata(jsonResponse, this.model);

      // エラー時：usageMetadataをloggerに記録してからthrow（エラー後は取得不可）
      if (responseCode !== 200) {
        if (usageMetadata && logger) {
          logger.setUsageMetadata(usageMetadata);
          logger.info(`使用量（エラー時）: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
        }

        const error = `Vertex AI APIエラー（ステータス: ${responseCode}）: ${responseText}`;
        if (logger) {
          logger.error(error);
        }
        throw new Error(error);
      }

      // レスポンス検証とJSON解析
      if (!jsonResponse.candidates ||
          jsonResponse.candidates.length === 0 ||
          !jsonResponse.candidates[0].content ||
          !jsonResponse.candidates[0].content.parts ||
          jsonResponse.candidates[0].content.parts.length === 0) {

        const finishReason = jsonResponse.candidates?.[0]?.finishReason || 'UNKNOWN';

        // エラー時：usageMetadataをloggerに記録してからthrow（エラー後は取得不可）
        if (usageMetadata && logger) {
          logger.setUsageMetadata(usageMetadata);
          logger.info(`使用量（エラー時）: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
        }

        const error = `Vertex AIレスポンスに有効なコンテンツが含まれていません（finishReason: ${finishReason}）`;
        if (logger) {
          logger.error(error, { response: jsonResponse });
        }
        throw new Error(error);
      }

      const contentText = jsonResponse.candidates[0].content.parts[0].text;
      const jsonObject = JSON.parse(contentText);

      // 成功時：usageMetadataをloggerに記録
      if (usageMetadata && logger) {
        logger.setUsageMetadata(usageMetadata);
        logger.success('JSON生成・パース成功');
        logger.info(`使用量: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
      } else if (logger) {
        logger.success('JSON生成・パース成功');
      }

      return {
        data: jsonObject,
        usageMetadata: usageMetadata
      };

    } catch (error) {
      if (logger) {
        logger.error(`JSON生成エラー: ${error.toString()}`);
      }
      throw error;
    }
  }

  /**
   * モデル設定を変更
   * @param {Object} config - 変更する設定
   */
  updateConfig(config) {
    if (config.temperature !== undefined) this.temperature = config.temperature;
    if (config.maxOutputTokens !== undefined) this.maxOutputTokens = config.maxOutputTokens;
    if (config.topP !== undefined) this.topP = config.topP;
    if (config.topK !== undefined) this.topK = config.topK;
    if (config.enableThinking !== undefined) this.enableThinking = config.enableThinking;
    if (config.thinkingBudget !== undefined) this.thinkingBudget = config.thinkingBudget;
  }

  /**
   * usageMetadataを抽出して金額計算（USD・JPY両方）
   * @param {Object} jsonResponse - APIレスポンス
   * @param {string} model - モデル名
   * @return {Object|null} {inputTokens, outputTokens, inputCostJPY, outputCostJPY, totalCostJPY, model}
   * @private
   */
  _extractUsageMetadata(jsonResponse, model) {
    if (!jsonResponse.usageMetadata) {
      return null;
    }

    const usage = jsonResponse.usageMetadata;
    const inputTokens = usage.promptTokenCount || 0;
    const outputTokens = usage.candidatesTokenCount || 0;

    // モデル別の価格を取得（テキスト入力）
    const pricing = getVertexAIPricing(model, 'text');
    const inputCostUSD = (inputTokens / 1000000) * pricing.inputPer1M;
    const outputCostUSD = (outputTokens / 1000000) * pricing.outputPer1M;
    const totalCostUSD = inputCostUSD + outputCostUSD;

    // 日本円に換算
    const inputCostJPY = inputCostUSD * EXCHANGE_RATE_USD_TO_JPY_VERTEX;
    const outputCostJPY = outputCostUSD * EXCHANGE_RATE_USD_TO_JPY_VERTEX;
    const totalCostJPY = totalCostUSD * EXCHANGE_RATE_USD_TO_JPY_VERTEX;

    return {
      model: model,
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      inputCostJPY: inputCostJPY,
      outputCostJPY: outputCostJPY,
      totalCostJPY: totalCostJPY
    };
  }
}

/**
 * 為替レート設定（USD -> JPY）
 */
const EXCHANGE_RATE_USD_TO_JPY_VERTEX = 150;

/**
 * Vertex AIモデルの価格情報を取得
 * @param {string} modelName - モデル名
 * @param {string} inputType - 入力タイプ ('audio' | 'text')
 * @return {Object} {inputPer1M, outputPer1M}
 */
function getVertexAIPricing(modelName, inputType = 'text') {
  const pricingTable = {
    'gemini-2.5-flash': {
      text: { inputPer1M: 0.075, outputPer1M: 0.30 },
      audio: { inputPer1M: 1.00, outputPer1M: 2.50 }
    },
    'gemini-2.5-pro': {
      text: { inputPer1M: 1.25, outputPer1M: 10.00 },
      audio: { inputPer1M: 1.25, outputPer1M: 10.00 }
    },
    'gemini-2.5-flash-lite': {
      text: { inputPer1M: 0.10, outputPer1M: 0.40 },
      audio: { inputPer1M: 0.10, outputPer1M: 0.40 }
    }
  };

  // モデル名を正規化
  const normalized = modelName.toLowerCase().replace(/^.*\//, '').replace(/-\d{3}$/, '');

  if (!pricingTable[normalized]) {
    Logger.log(`[価格取得] ⚠️ 未知のモデル: ${modelName}, デフォルト価格（gemini-2.5-flash）を使用`);
    return pricingTable['gemini-2.5-flash'][inputType] || pricingTable['gemini-2.5-flash']['text'];
  }

  if (!pricingTable[normalized][inputType]) {
    Logger.log(`[価格取得] ⚠️ 未知の入力タイプ: ${inputType}, テキスト価格を使用`);
    return pricingTable[normalized]['text'];
  }

  return pricingTable[normalized][inputType];
}

/**
 * ヘルパー関数: PROモデルクライアント作成
 * @param {Object} options - オプション設定
 * @return {VertexAIGeminiClient} クライアントインスタンス
 */
function createGeminiProClient(options = {}) {
  return new VertexAIGeminiClient(VERTEX_AI_CONFIG.models.PRO, options);
}

/**
 * ヘルパー関数: FLASHモデルクライアント作成
 * @param {Object} options - オプション設定
 * @return {VertexAIGeminiClient} クライアントインスタンス
 */
function createGeminiFlashClient(options = {}) {
  return new VertexAIGeminiClient(VERTEX_AI_CONFIG.models.FLASH, options);
}

/**
 * ヘルパー関数: FLASH-LITEモデルクライアント作成
 * @param {Object} options - オプション設定
 * @return {VertexAIGeminiClient} クライアントインスタンス
 */
function createGeminiFlashLiteClient(options = {}) {
  return new VertexAIGeminiClient(VERTEX_AI_CONFIG.models.FLASH_LITE, options);
}

/**
 * ヘルパー関数: カスタムモデルクライアント作成
 * @param {string} model - モデル名
 * @param {Object} options - オプション設定
 * @return {VertexAIGeminiClient} クライアントインスタンス
 */
function createGeminiClient(model, options = {}) {
  return new VertexAIGeminiClient(model, options);
}
