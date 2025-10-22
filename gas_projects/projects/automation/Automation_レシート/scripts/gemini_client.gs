/**
 * Gemini API統合クライアント
 * 全てのGASプロジェクトで共通使用するGemini API連携モジュール
 * 
 * @version 1.0.0
 * @date 2025-10-16
 */

/**
 * Gemini API設定
 */
const GEMINI_API_CONFIG = {
  // APIキー（全プロジェクトで統一）
  apiKey: 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY',
  
  // ベースURL
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
  
  // モデル定義
  models: {
    // 複雑な思考が必要なタスク向け
    PRO: 'gemini-2.5-pro',

    // 標準処理向け（コスト効率重視）
    FLASH: 'gemini-2.5-flash',

    // 軽量処理向け（最小コスト）
    FLASH_LITE: 'gemini-2.5-flash-lite'
  },
  
  // デフォルト設定
  defaults: {
    temperature: 0.3,
    maxOutputTokens: 8192,
    topP: 0.95,
    topK: 40
  },
  
  // タイムアウト設定
  timeout: 120000 // 120秒
};

/**
 * Gemini APIクライアントクラス
 */
class GeminiClient {
  
  /**
   * コンストラクタ
   * @param {string} model - 使用するモデル（GEMINI_API_CONFIG.modelsから選択）
   * @param {Object} options - オプション設定
   */
  constructor(model = GEMINI_API_CONFIG.models.FLASH, options = {}) {
    this.model = model;
    this.apiKey = options.apiKey || GEMINI_API_CONFIG.apiKey;
    this.temperature = options.temperature ?? GEMINI_API_CONFIG.defaults.temperature;
    this.maxOutputTokens = options.maxOutputTokens ?? GEMINI_API_CONFIG.defaults.maxOutputTokens;
    this.topP = options.topP ?? GEMINI_API_CONFIG.defaults.topP;
    this.topK = options.topK ?? GEMINI_API_CONFIG.defaults.topK;
  }

  /**
   * テキスト生成
   * @param {string} prompt - プロンプト
   * @param {Object} logger - ロガーインスタンス（オプション）
   * @return {Object} {text: 生成されたテキスト, usageMetadata: 使用量情報}
   */
  generateText(prompt, logger = null) {
    if (logger) {
      logger.info(`Gemini API呼び出し開始（モデル: ${this.model}）`);
    }

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: this.maxOutputTokens,
        topP: this.topP,
        topK: this.topK
      }
    };

    const url = `${GEMINI_API_CONFIG.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    if (logger) {
      logger.info(`リクエスト送信（プロンプト長: ${prompt.length}文字）`);
    }

    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (logger) {
        logger.info(`レスポンス受信（ステータス: ${responseCode}）`);
      }

      if (responseCode !== 200) {
        const error = `Gemini APIエラー（ステータス: ${responseCode}）: ${responseText}`;
        if (logger) {
          logger.error(error);
        }
        throw new Error(error);
      }

      const jsonResponse = JSON.parse(responseText);

      // レスポンス検証
      if (!jsonResponse.candidates ||
          jsonResponse.candidates.length === 0 ||
          !jsonResponse.candidates[0].content ||
          !jsonResponse.candidates[0].content.parts ||
          jsonResponse.candidates[0].content.parts.length === 0) {

        const finishReason = jsonResponse.candidates?.[0]?.finishReason || 'UNKNOWN';
        const error = `Gemini APIレスポンスに有効なコンテンツが含まれていません（finishReason: ${finishReason}）`;

        if (logger) {
          logger.error(error, { response: jsonResponse });
        }

        throw new Error(error);
      }

      const generatedText = jsonResponse.candidates[0].content.parts[0].text.trim();

      // usageMetadataを取得
      const usageMetadata = this._extractUsageMetadata(jsonResponse, this.model);

      if (logger) {
        logger.success(`テキスト生成成功（生成文字数: ${generatedText.length}）`);
        if (usageMetadata) {
          logger.info(`使用量: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
        }
      }

      return {
        text: generatedText,
        usageMetadata: usageMetadata
      };

    } catch (error) {
      if (logger) {
        logger.error(`Gemini API呼び出しエラー: ${error.toString()}`, {
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

    // JSONフォーマットを強制するプロンプト追記
    const jsonPrompt = `${prompt}\n\n**重要: 回答は必ずJSON形式で出力してください。説明文や前置きは不要です。**`;

    const response = this.generateText(jsonPrompt, logger);
    const responseText = response.text;

    try {
      // JSONブロックの抽出（```json ``` で囲まれている場合）
      let jsonText = responseText;
      const jsonBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        jsonText = jsonBlockMatch[1];
      } else {
        // ``` のみで囲まれている場合
        const codeBlockMatch = responseText.match(/```\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1];
        }
      }

      const jsonObject = JSON.parse(jsonText.trim());

      if (logger) {
        logger.success('JSONパース成功');
      }

      return {
        data: jsonObject,
        usageMetadata: response.usageMetadata
      };

    } catch (error) {
      const parseError = `JSONパースエラー: ${error.toString()}\nレスポンステキスト: ${responseText.substring(0, 500)}`;

      if (logger) {
        logger.error(parseError, { responseText: responseText });
      }

      throw new Error(parseError);
    }
  }

  /**
   * チャット形式でテキスト生成
   * @param {Array} messages - メッセージ履歴 [{role: 'user'|'model', text: 'メッセージ'}]
   * @param {Object} logger - ロガーインスタンス（オプション）
   * @return {Object} {text: 生成されたテキスト, usageMetadata: 使用量情報}
   */
  generateChat(messages, logger = null) {
    if (logger) {
      logger.info(`チャット形式でGemini API呼び出し（メッセージ数: ${messages.length}）`);
    }

    const contents = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const requestBody = {
      contents: contents,
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: this.maxOutputTokens,
        topP: this.topP,
        topK: this.topK
      }
    };

    const url = `${GEMINI_API_CONFIG.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (responseCode !== 200) {
        throw new Error(`Gemini APIエラー（ステータス: ${responseCode}）: ${responseText}`);
      }

      const jsonResponse = JSON.parse(responseText);
      const generatedText = jsonResponse.candidates[0].content.parts[0].text.trim();

      // usageMetadataを取得
      const usageMetadata = this._extractUsageMetadata(jsonResponse, this.model);

      if (logger) {
        logger.success(`チャット応答生成成功`);
        if (usageMetadata) {
          logger.info(`使用量: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
        }
      }

      return {
        text: generatedText,
        usageMetadata: usageMetadata
      };

    } catch (error) {
      if (logger) {
        logger.error(`チャット生成エラー: ${error.toString()}`);
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
  }

  /**
   * usageMetadataを抽出して金額計算（USD・JPY両方）
   * @param {Object} jsonResponse - APIレスポンス
   * @param {string} model - モデル名
   * @return {Object|null} {inputTokens, outputTokens, inputCostUSD, outputCostUSD, totalCostUSD, inputCostJPY, outputCostJPY, totalCostJPY, model}
   * @private
   */
  _extractUsageMetadata(jsonResponse, model) {
    if (!jsonResponse.usageMetadata) {
      return null;
    }

    const usage = jsonResponse.usageMetadata;
    const inputTokens = usage.promptTokenCount || 0;
    const outputTokens = usage.candidatesTokenCount || 0;

    // モデル別の価格を取得（USD）
    const pricing = getGeminiPricing(model);
    const inputCostUSD = (inputTokens / 1000000) * pricing.inputPer1M;
    const outputCostUSD = (outputTokens / 1000000) * pricing.outputPer1M;
    const totalCostUSD = inputCostUSD + outputCostUSD;

    // 日本円に換算
    const inputCostJPY = inputCostUSD * EXCHANGE_RATE_USD_TO_JPY;
    const outputCostJPY = outputCostUSD * EXCHANGE_RATE_USD_TO_JPY;
    const totalCostJPY = totalCostUSD * EXCHANGE_RATE_USD_TO_JPY;

    return {
      model: model,
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      inputCostUSD: inputCostUSD,
      outputCostUSD: outputCostUSD,
      totalCostUSD: totalCostUSD,
      inputCostJPY: inputCostJPY,
      outputCostJPY: outputCostJPY,
      totalCostJPY: totalCostJPY
    };
  }
}

/**
 * Geminiモデルの価格情報を取得（USD/100万トークン）
 * @param {string} model - モデル名
 * @return {Object} {inputPer1M, outputPer1M}
 *
 * 注: EXCHANGE_RATE_USD_TO_JPY は main.gs で定義されています
 */
function getGeminiPricing(model) {
  // 2025年1月時点のGemini 2.5 API価格（USD/100万トークン）
  // 出典: https://ai.google.dev/pricing
  // 注: ≤20万入力トークンの価格を使用（単一リクエストで20万トークン超えは稀）
  const pricingTable = {
    'gemini-2.5-pro': {
      inputPer1M: 1.25,    // $1.25/1M tokens (≤200K)
      outputPer1M: 10.0    // $10/1M tokens (テキスト出力: 回答と推論)
    },
    'gemini-2.5-flash-lite': {
      inputPer1M: 0.10,    // $0.10/1M tokens
      outputPer1M: 0.40    // $0.40/1M tokens (回答と推論)
    },
    'gemini-2.5-flash': {
      inputPer1M: 0.30,    // $0.30/1M tokens (テキスト/画像/動画)
      outputPer1M: 2.50    // $2.50/1M tokens (テキスト出力)
    }
  };

  // モデル名をキーとして検索（部分一致、長い名前を優先）
  const sortedKeys = Object.keys(pricingTable).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (model.includes(key)) {
      return pricingTable[key];
    }
  }

  // デフォルト（Flash価格）
  return { inputPer1M: 0.30, outputPer1M: 2.50 };
}

/**
 * ヘルパー関数: PROモデルクライアント作成
 * @param {Object} options - オプション設定
 * @return {GeminiClient} クライアントインスタンス
 */
function createGeminiProClient(options = {}) {
  return new GeminiClient(GEMINI_API_CONFIG.models.PRO, options);
}

/**
 * ヘルパー関数: FLASHモデルクライアント作成
 * @param {Object} options - オプション設定
 * @return {GeminiClient} クライアントインスタンス
 */
function createGeminiFlashClient(options = {}) {
  return new GeminiClient(GEMINI_API_CONFIG.models.FLASH, options);
}

/**
 * ヘルパー関数: FLASH-LITEモデルクライアント作成
 * @param {Object} options - オプション設定
 * @return {GeminiClient} クライアントインスタンス
 */
function createGeminiFlashLiteClient(options = {}) {
  return new GeminiClient(GEMINI_API_CONFIG.models.FLASH_LITE, options);
}

/**
 * ヘルパー関数: カスタムモデルクライアント作成
 * @param {string} model - モデル名
 * @param {Object} options - オプション設定
 * @return {GeminiClient} クライアントインスタンス
 */
function createGeminiClient(model, options = {}) {
  return new GeminiClient(model, options);
}
