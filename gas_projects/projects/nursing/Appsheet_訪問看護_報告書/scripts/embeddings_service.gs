/**
 * =========================================
 * Vertex AI Embeddings Service
 * =========================================
 *
 * Vertex AI gemini-embedding-001 を使用した埋め込みベクトル生成サービス
 *
 * 主な機能:
 * - テキストの埋め込みベクトル生成 (3072次元)
 * - バッチ処理対応 (最大250テキスト/リクエスト)
 * - タスクタイプ指定 (RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY)
 * - OAuth2認証 (ScriptApp.getOAuthToken)
 * - 1回のみAPI呼び出し保証 (リトライループなし)
 *
 * 使用例:
 * ```javascript
 * const embedding = createEmbedding("看護記録のテキスト", "RETRIEVAL_DOCUMENT");
 * console.log(embedding.length); // 3072
 *
 * const embeddings = createEmbeddingsBatch([
 *   "テキスト1",
 *   "テキスト2"
 * ]);
 * ```
 *
 * @version 1.0.0
 * @date 2025-10-27
 */

/**
 * Vertex AI Embeddings API 設定
 */
const EMBEDDINGS_CONFIG = {
  projectId: 'fractal-ecosystem',  // GCPプロジェクトID
  location: 'us-central1',
  model: 'gemini-embedding-001',  // Gemini Embedding モデル
  outputDimensionality: 3072,  // 出力次元数 (デフォルト3072次元、推奨値: 768, 1536, 3072)
  maxTokensPerText: 2048,  // 1テキストの最大トークン数
  maxTextsPerBatch: 250,  // バッチ処理の最大テキスト数
  maxTokensPerBatch: 20000  // バッチ処理の最大合計トークン数
};

/**
 * 単一テキストの埋め込みベクトルを生成
 *
 * @param {string} text - 埋め込み対象のテキスト (最大2048トークン)
 * @param {string} taskType - タスクタイプ ("RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY")
 * @param {Object} logger - ロガーインスタンス (オプション)
 * @returns {Array<number>} 埋め込みベクトル (3072次元)
 * @throws {Error} API呼び出しエラー
 */
function createEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT', logger = null) {
  if (!text || typeof text !== 'string') {
    throw new Error('テキストが指定されていません');
  }

  // トークン制限を考慮してテキストを切り詰め (簡易実装: 文字数で概算)
  const maxChars = EMBEDDINGS_CONFIG.maxTokensPerText * 4;  // 1トークン ≈ 4文字
  const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text;

  if (logger && text.length > maxChars) {
    logger.warning(`テキストが${maxChars}文字を超過したため切り詰めました (元: ${text.length}文字)`);
  }

  const url = `https://${EMBEDDINGS_CONFIG.location}-aiplatform.googleapis.com/v1/projects/${EMBEDDINGS_CONFIG.projectId}/locations/${EMBEDDINGS_CONFIG.location}/publishers/google/models/${EMBEDDINGS_CONFIG.model}:predict`;

  const payload = {
    instances: [{
      task_type: taskType,
      content: truncatedText
    }],
    parameters: {
      outputDimensionality: EMBEDDINGS_CONFIG.outputDimensionality
    }
  };

  if (logger) {
    logger.info(`Vertex AI Embeddings API呼び出し (タスクタイプ: ${taskType}, 文字数: ${truncatedText.length})`);
  }

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      throw new Error(`Vertex AI Embeddings API Error: ${statusCode} - ${responseText}`);
    }

    const result = JSON.parse(responseText);

    if (!result.predictions || !result.predictions[0] || !result.predictions[0].embeddings) {
      throw new Error(`予期しないレスポンス形式: ${responseText}`);
    }

    const embedding = result.predictions[0].embeddings.values;

    if (logger) {
      logger.info(`埋め込みベクトル生成成功 (次元数: ${embedding.length})`);
    }

    return embedding;

  } catch (error) {
    if (logger) {
      logger.error(`Vertex AI Embeddings API呼び出しエラー: ${error.toString()}`, {
        taskType: taskType,
        textLength: truncatedText.length
      });
    }
    throw error;
  }
}

/**
 * 複数テキストの埋め込みベクトルをバッチ生成
 *
 * @param {Array<string>} texts - 埋め込み対象のテキスト配列 (最大250件)
 * @param {string} taskType - タスクタイプ ("RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY")
 * @param {Object} logger - ロガーインスタンス (オプション)
 * @returns {Array<Array<number>>} 埋め込みベクトルの配列
 * @throws {Error} API呼び出しエラー
 */
function createEmbeddingsBatch(texts, taskType = 'RETRIEVAL_DOCUMENT', logger = null) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('テキスト配列が指定されていません');
  }

  if (texts.length > EMBEDDINGS_CONFIG.maxTextsPerBatch) {
    throw new Error(`バッチサイズが最大値(${EMBEDDINGS_CONFIG.maxTextsPerBatch})を超過: ${texts.length}件`);
  }

  const url = `https://${EMBEDDINGS_CONFIG.location}-aiplatform.googleapis.com/v1/projects/${EMBEDDINGS_CONFIG.projectId}/locations/${EMBEDDINGS_CONFIG.location}/publishers/google/models/${EMBEDDINGS_CONFIG.model}:predict`;

  // 各テキストを切り詰め
  const maxChars = EMBEDDINGS_CONFIG.maxTokensPerText * 4;
  const instances = texts.map(text => ({
    task_type: taskType,
    content: text.length > maxChars ? text.substring(0, maxChars) : text
  }));

  const payload = {
    instances: instances,
    parameters: {
      outputDimensionality: EMBEDDINGS_CONFIG.outputDimensionality
    }
  };

  if (logger) {
    logger.info(`Vertex AI Embeddings API バッチ呼び出し (件数: ${texts.length}, タスクタイプ: ${taskType})`);
  }

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      throw new Error(`Vertex AI Embeddings API Error: ${statusCode} - ${responseText}`);
    }

    const result = JSON.parse(responseText);

    if (!result.predictions || result.predictions.length !== texts.length) {
      throw new Error(`予期しないレスポンス形式: 期待件数=${texts.length}, 実際=${result.predictions ? result.predictions.length : 0}`);
    }

    const embeddings = result.predictions.map(pred => pred.embeddings.values);

    if (logger) {
      logger.info(`バッチ埋め込みベクトル生成成功 (件数: ${embeddings.length}, 次元数: ${embeddings[0].length})`);
    }

    return embeddings;

  } catch (error) {
    if (logger) {
      logger.error(`Vertex AI Embeddings API バッチ呼び出しエラー: ${error.toString()}`, {
        taskType: taskType,
        batchSize: texts.length
      });
    }
    throw error;
  }
}

/**
 * コサイン類似度を計算
 *
 * @param {Array<number>} vectorA - ベクトルA (768次元)
 * @param {Array<number>} vectorB - ベクトルB (768次元)
 * @returns {number} コサイン類似度 (-1.0 ~ 1.0)
 */
function calculateCosineSimilarity(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
    throw new Error('ベクトルが配列ではありません');
  }

  if (vectorA.length !== vectorB.length) {
    throw new Error(`ベクトルの次元数が一致しません: A=${vectorA.length}, B=${vectorB.length}`);
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * テキスト配列の中から最も類似度の高いものを検索
 *
 * @param {string} queryText - 検索クエリ
 * @param {Array<Object>} candidates - 候補オブジェクト配列 [{text: "...", embedding: [...], data: {...}}]
 * @param {number} topK - 上位K件を取得
 * @param {Object} logger - ロガーインスタンス (オプション)
 * @returns {Array<Object>} ランク付けされた候補配列 [{...候補データ, similarity: 0.95}]
 */
function searchSimilarTexts(queryText, candidates, topK = 10, logger = null) {
  if (!queryText || !Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('検索クエリまたは候補配列が不正です');
  }

  // クエリの埋め込みを生成
  const queryEmbedding = createEmbedding(queryText, 'RETRIEVAL_QUERY', logger);

  // 各候補との類似度を計算
  const results = candidates.map(candidate => {
    if (!candidate.embedding) {
      throw new Error('候補に埋め込みベクトルが含まれていません');
    }

    const similarity = calculateCosineSimilarity(queryEmbedding, candidate.embedding);

    return {
      ...candidate,
      similarity: similarity
    };
  });

  // 類似度でソート (降順)
  results.sort((a, b) => b.similarity - a.similarity);

  // 上位K件を返す
  const topResults = results.slice(0, topK);

  if (logger) {
    logger.info(`類似検索完了 (候補数: ${candidates.length}, 上位: ${topK}件, 最高類似度: ${topResults[0].similarity.toFixed(4)})`);
  }

  return topResults;
}

/**
 * テスト関数: 埋め込み生成とコサイン類似度計算
 */
function testEmbeddingsService() {
  const logger = createLogger('embeddings_service_test');

  try {
    // 単一テキストの埋め込み生成
    logger.info('=== 単一テキストテスト ===');
    const text1 = '訪問時、利用者は穏やかな表情で出迎えてくれました。バイタルサインは安定しており、血圧120/80、脈拍72回/分、体温36.5度でした。';
    const embedding1 = createEmbedding(text1, 'RETRIEVAL_DOCUMENT', logger);
    logger.info(`埋め込み生成成功: 次元数=${embedding1.length}, 最初の5要素=[${embedding1.slice(0, 5).join(', ')}]`);

    // バッチ処理テスト
    logger.info('=== バッチ処理テスト ===');
    const texts = [
      '利用者は食事を完食し、食欲良好でした。',
      '服薬確認を行い、朝食後の薬を正しく服用していることを確認しました。',
      'バルーンカテーテルの交換を実施しました。'
    ];
    const embeddings = createEmbeddingsBatch(texts, 'RETRIEVAL_DOCUMENT', logger);
    logger.info(`バッチ生成成功: ${embeddings.length}件`);

    // コサイン類似度テスト
    logger.info('=== コサイン類似度テスト ===');
    const similarity01 = calculateCosineSimilarity(embedding1, embeddings[0]);
    const similarity02 = calculateCosineSimilarity(embedding1, embeddings[1]);
    const similarity03 = calculateCosineSimilarity(embedding1, embeddings[2]);
    logger.info(`類似度計算成功: text1 vs text2[0]=${similarity01.toFixed(4)}, vs text2[1]=${similarity02.toFixed(4)}, vs text2[2]=${similarity03.toFixed(4)}`);

    // 類似検索テスト
    logger.info('=== 類似検索テスト ===');
    const candidates = texts.map((text, idx) => ({
      id: `doc-${idx}`,
      text: text,
      embedding: embeddings[idx]
    }));

    const query = 'バルーンの状態を確認してください';
    const searchResults = searchSimilarTexts(query, candidates, 3, logger);
    logger.info(`検索結果: Top 1 = "${searchResults[0].text}" (類似度: ${searchResults[0].similarity.toFixed(4)})`);

    logger.success('全てのテスト成功');
    return { success: true, results: searchResults };

  } catch (error) {
    logger.error(`テスト失敗: ${error.toString()}`, { stack: error.stack });
    throw error;
  }
}
