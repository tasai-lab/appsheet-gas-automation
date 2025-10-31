/**
 * =========================================
 * Vertex AI 汎用クライアント
 * =========================================
 *
 * Vertex AI Gemini APIを使用した汎用クライアント
 * Flash-Lite、Flash、Proモデルをサポート
 *
 * 主な機能:
 * - 複数モデルのサポート（Pro、Flash、Flash-Lite）
 * - OAuth2認証
 * - コスト計算と記録
 * - エラーハンドリング
 * - 1回のみAPI呼び出し保証
 *
 * 使用例:
 * ```javascript
 * const client = createVertexAIClient('gemini-2.5-flash-lite', { temperature: 0.5 });
 * const result = client.generateText(prompt, logger);
 * console.log(result.text);
 * console.log(result.usageMetadata);
 * ```
 *
 * @version 1.0.0
 * @date 2025-10-31
 */

/**
 * Vertex AI設定
 */
const VERTEX_AI_CONFIG = {
  // GCPプロジェクト設定
  GCP_PROJECT_ID: 'macro-shadow-458705-v8',
  GCP_LOCATION: 'us-central1',

  // モデル定義
  MODELS: {
    PRO: 'gemini-2.5-pro',
    FLASH: 'gemini-2.5-flash',
    FLASH_LITE: 'gemini-2.5-flash-lite'
  },

  // モデル別価格（USD/100万トークン）
  PRICING: {
    'gemini-2.5-pro': {
      inputPer1M: 1.25,    // $1.25/1M tokens
      outputPer1M: 10.0    // $10/1M tokens
    },
    'gemini-2.5-flash': {
      inputPer1M: 0.30,    // $0.30/1M tokens
      outputPer1M: 2.50    // $2.50/1M tokens
    },
    'gemini-2.5-flash-lite': {
      inputPer1M: 0.10,    // $0.10/1M tokens
      outputPer1M: 0.40    // $0.40/1M tokens
    }
  },

  // 為替レート（USD -> JPY）
  EXCHANGE_RATE: 150,

  // デフォルト設定
  DEFAULTS: {
    temperature: 0.3,
    maxOutputTokens: 8192,
    topP: 0.95,
    topK: 40
  }
};

/**
 * Vertex AIクライアントクラス
 */
class VertexAIClient {
  /**
   * コンストラクタ
   * @param {string} model - 使用するモデル名（例: 'gemini-2.5-pro'）
   * @param {Object} options - オプション設定
   */
  constructor(model, options = {}) {
    this.model = model;
    this.temperature = options.temperature ?? VERTEX_AI_CONFIG.DEFAULTS.temperature;
    this.maxOutputTokens = options.maxOutputTokens ?? VERTEX_AI_CONFIG.DEFAULTS.maxOutputTokens;
    this.topP = options.topP ?? VERTEX_AI_CONFIG.DEFAULTS.topP;
    this.topK = options.topK ?? VERTEX_AI_CONFIG.DEFAULTS.topK;
    this.responseMimeType = options.responseMimeType || 'text/plain';
  }

  /**
   * テキスト生成
   * @param {string} prompt - プロンプト
   * @param {Object} logger - ロガーインスタンス（オプション）
   * @return {Object} {text: 生成されたテキスト, usageMetadata: 使用量情報}
   */
  generateText(prompt, logger = null) {
    if (logger) {
      logger.info(`Vertex AI API呼び出し開始（モデル: ${this.model}）`);
    }

    const generationConfig = {
      temperature: this.temperature,
      maxOutputTokens: this.maxOutputTokens,
      topP: this.topP,
      topK: this.topK
    };

    // JSON形式の場合はresponseMimeTypeを追加
    if (this.responseMimeType === 'application/json') {
      generationConfig.responseMimeType = 'application/json';
    }

    const requestBody = {
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }],
      generationConfig: generationConfig
    };

    // Vertex AI APIエンドポイント（OAuth2認証）
    const url = `https://${VERTEX_AI_CONFIG.GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_AI_CONFIG.GCP_PROJECT_ID}/locations/${VERTEX_AI_CONFIG.GCP_LOCATION}/publishers/google/models/${this.model}:generateContent`;

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${ScriptApp.getOAuthToken()}` },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    if (logger) {
      logger.info(`Vertex AI APIリクエスト送信（モデル: ${this.model}、プロンプト長: ${prompt.length}文字）`);
    }

    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (logger) {
        logger.info(`Vertex AI APIレスポンス受信（ステータス: ${responseCode}）`);
      }

      if (responseCode !== 200) {
        const error = `Vertex AI APIエラー（ステータス: ${responseCode}）: ${responseText}`;
        if (logger) {
          logger.error(error);
        }
        throw new Error(error);
      }

      const jsonResponse = JSON.parse(responseText);

      // レスポンス検証
      if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
        throw new Error("AIからの応答に有効な候補が含まれていません: " + responseText);
      }

      // テキスト抽出
      const generatedText = jsonResponse.candidates[0].content.parts[0].text.trim();

      // usageMetadataを計算
      const usageMetadata = this._calculateUsageMetadata(jsonResponse);

      if (logger && usageMetadata) {
        logger.info(`使用量: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
      }

      if (logger) {
        logger.success('テキスト生成成功');
      }

      return {
        text: generatedText,
        usageMetadata: usageMetadata
      };

    } catch (error) {
      if (logger) {
        logger.error(`Vertex AI API呼び出しエラー: ${error.toString()}`, {
          model: this.model,
          promptLength: prompt.length,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  /**
   * usageMetadataを計算（USD・JPY両方）
   * @param {Object} jsonResponse - APIレスポンス
   * @return {Object|null} {inputTokens, outputTokens, inputCostUSD, outputCostUSD, totalCostUSD, inputCostJPY, outputCostJPY, totalCostJPY, model}
   * @private
   */
  _calculateUsageMetadata(jsonResponse) {
    if (!jsonResponse.usageMetadata) {
      return null;
    }

    const usage = jsonResponse.usageMetadata;
    const inputTokens = usage.promptTokenCount || 0;
    const outputTokens = usage.candidatesTokenCount || 0;

    // モデル別の価格を取得
    const pricing = this._getPricing();
    const inputCostUSD = (inputTokens / 1000000) * pricing.inputPer1M;
    const outputCostUSD = (outputTokens / 1000000) * pricing.outputPer1M;
    const totalCostUSD = inputCostUSD + outputCostUSD;

    // 日本円に換算
    const inputCostJPY = inputCostUSD * VERTEX_AI_CONFIG.EXCHANGE_RATE;
    const outputCostJPY = outputCostUSD * VERTEX_AI_CONFIG.EXCHANGE_RATE;
    const totalCostJPY = totalCostUSD * VERTEX_AI_CONFIG.EXCHANGE_RATE;

    return {
      model: this.model,
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

  /**
   * モデルの価格情報を取得
   * @return {Object} {inputPer1M, outputPer1M}
   * @private
   */
  _getPricing() {
    // モデル名をキーとして検索
    if (VERTEX_AI_CONFIG.PRICING[this.model]) {
      return VERTEX_AI_CONFIG.PRICING[this.model];
    }

    // デフォルト（Flash価格）
    return VERTEX_AI_CONFIG.PRICING['gemini-2.5-flash'];
  }
}

/**
 * ヘルパー関数: Vertex AIクライアント作成
 * @param {string} model - モデル名（'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'）
 * @param {Object} options - オプション設定
 * @return {VertexAIClient} クライアントインスタンス
 */
function createVertexAIClient(model, options = {}) {
  return new VertexAIClient(model, options);
}

/**
 * ヘルパー関数: Proモデルクライアント作成
 * @param {Object} options - オプション設定
 * @return {VertexAIClient} クライアントインスタンス
 */
function createVertexAIProClient(options = {}) {
  return new VertexAIClient(VERTEX_AI_CONFIG.MODELS.PRO, options);
}

/**
 * ヘルパー関数: Flashモデルクライアント作成
 * @param {Object} options - オプション設定
 * @return {VertexAIClient} クライアントインスタンス
 */
function createVertexAIFlashClient(options = {}) {
  return new VertexAIClient(VERTEX_AI_CONFIG.MODELS.FLASH, options);
}

/**
 * ヘルパー関数: Flash-Liteモデルクライアント作成
 * @param {Object} options - オプション設定
 * @return {VertexAIClient} クライアントインスタンス
 */
function createVertexAIFlashLiteClient(options = {}) {
  return new VertexAIClient(VERTEX_AI_CONFIG.MODELS.FLASH_LITE, options);
}
