/**
 * =========================================
 * Vector DB Sync Service
 * =========================================
 *
 * 統合Vector DBスプレッドシートへの同期サービス
 *
 * 主な機能:
 * - KnowledgeBaseシートへのデータ登録
 * - Embeddingsシートへのベクトル登録
 * - 医療用語キーワード抽出
 * - バッチ同期対応
 *
 * 使用例:
 * ```javascript
 * syncToVectorDB({
 *   domain: 'nursing',
 *   sourceType: 'care_record',
 *   sourceTable: 'Care_Records',
 *   sourceId: 'rec_123',
 *   userId: 'user_001',
 *   title: '2025-10-27 訪問看護記録',
 *   content: '訪問時の状態...',
 *   structuredData: { vital_signs: {...} },
 *   metadata: { audioFileId: '...' },
 *   tags: 'バルーン交換,服薬確認',
 *   date: '2025-10-27'
 * });
 * ```
 *
 * @version 1.0.0
 * @date 2025-10-27
 */

/**
 * Vector DB設定
 *
 * 注意: VECTOR_DB_SPREADSHEET_IDは実際のスプレッドシートID作成後に設定してください
 */
const VECTOR_DB_CONFIG = {
  spreadsheetId: '',  // TODO: 作成後にスプレッドシートIDを設定
  sheets: {
    knowledgeBase: 'KnowledgeBase',
    embeddings: 'Embeddings',
    medicalTerms: 'MedicalTerms',
    chatHistory: 'ChatHistory'
  },
  // KB ID生成用カウンター (PropertiesServiceに保存)
  kbIdCounterKey: 'VECTOR_DB_KB_ID_COUNTER'
};

/**
 * KB IDを生成
 *
 * @param {string} domain - ドメイン (clients/calls/nursing/sales)
 * @returns {string} KB_ドメイン_YYYYMMDD_連番
 */
function generateKbId(domain) {
  const props = PropertiesService.getScriptProperties();

  // カウンターを取得 (存在しない場合は0)
  let counter = parseInt(props.getProperty(VECTOR_DB_CONFIG.kbIdCounterKey) || '0');
  counter++;

  // カウンターを保存
  props.setProperty(VECTOR_DB_CONFIG.kbIdCounterKey, counter.toString());

  // 日付フォーマット
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyyMMdd');

  // 連番を5桁ゼロパディング
  const seqStr = counter.toString().padStart(5, '0');

  return `KB_${domain}_${dateStr}_${seqStr}`;
}

/**
 * テキストから医療用語キーワードを抽出
 *
 * @param {string} content - テキストコンテンツ
 * @returns {string} カンマ区切りキーワード
 */
function extractMedicalKeywords(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // 基本的な医療用語パターン (簡易実装)
  const medicalPatterns = [
    // バイタルサイン
    /血圧[\s:：]*\d+[\/\/]\d+/g,
    /脈拍[\s:：]*\d+/g,
    /体温[\s:：]*\d+\.\d+/g,
    /SpO2[\s:：]*\d+/g,

    // 医療処置・機器
    /バルーン/g,
    /カテーテル/g,
    /膀胱留置カテーテル/g,
    /尿道カテーテル/g,
    /点滴/g,
    /吸引/g,
    /酸素/g,

    // 服薬関連
    /服薬/g,
    /内服/g,
    /薬剤/g,
    /処方/g,

    // 看護記録用語
    /訪問/g,
    /状態/g,
    /観察/g,
    /清拭/g,
    /入浴/g,
    /排泄/g,
    /食事/g,

    // 症状
    /疼痛/g,
    /発熱/g,
    /浮腫/g,
    /褥瘡/g
  ];

  const keywords = new Set();

  medicalPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => keywords.add(match.trim()));
    }
  });

  return Array.from(keywords).join(',');
}

/**
 * テキストからBM25用正規化キーワードを生成
 *
 * @param {string} content - テキストコンテンツ
 * @param {string} tags - タグ (カンマ区切り)
 * @returns {string} セミコロン区切り正規化キーワード
 */
function generateBM25Keywords(content, tags) {
  const keywords = new Set();

  // タグを追加
  if (tags) {
    tags.split(',').forEach(tag => {
      keywords.add(tag.trim());
    });
  }

  // 医療用語シノニム辞書参照 (将来実装)
  // 現時点では基本的なキーワード抽出のみ

  // コンテンツから抽出
  const medicalKeywords = extractMedicalKeywords(content);
  if (medicalKeywords) {
    medicalKeywords.split(',').forEach(kw => {
      keywords.add(kw);
    });
  }

  return Array.from(keywords).join(';');
}

/**
 * Vector DBに同期
 *
 * @param {Object} params - 同期パラメータ
 * @param {string} params.domain - ドメイン (clients/calls/nursing/sales)
 * @param {string} params.sourceType - ソースタイプ (care_record/call_summary/user_info等)
 * @param {string} params.sourceTable - AppSheetテーブル名
 * @param {string} params.sourceId - 元レコードID
 * @param {string} params.userId - 利用者ID (オプション)
 * @param {string} params.title - 見出し
 * @param {string} params.content - 全文テキスト
 * @param {Object} params.structuredData - 構造化データ (オプション)
 * @param {Object} params.metadata - メタデータ (オプション)
 * @param {string} params.tags - タグ (カンマ区切り、オプション)
 * @param {string} params.date - 記録日付 (YYYY-MM-DD)
 * @param {Object} logger - ロガーインスタンス (オプション)
 * @returns {string} 生成されたKB ID
 * @throws {Error} 同期エラー
 */
function syncToVectorDB(params, logger = null) {
  if (!params || !params.domain || !params.content) {
    throw new Error('必須パラメータが不足しています (domain, content)');
  }

  if (!VECTOR_DB_CONFIG.spreadsheetId) {
    throw new Error('VECTOR_DB_SPREADSHEET_IDが設定されていません。vector_db_sync.gsのVECTOR_DB_CONFIGを更新してください。');
  }

  try {
    if (logger) {
      logger.info(`Vector DB同期開始 (domain: ${params.domain}, sourceType: ${params.sourceType})`);
    }

    // スプレッドシート取得
    const ss = SpreadsheetApp.openById(VECTOR_DB_CONFIG.spreadsheetId);

    // KB ID生成
    const kbId = generateKbId(params.domain);

    // KnowledgeBaseシートに登録
    const kbSheet = ss.getSheetByName(VECTOR_DB_CONFIG.sheets.knowledgeBase);
    if (!kbSheet) {
      throw new Error(`${VECTOR_DB_CONFIG.sheets.knowledgeBase}シートが見つかりません`);
    }

    const now = new Date();
    const bm25Keywords = generateBM25Keywords(params.content, params.tags || '');

    kbSheet.appendRow([
      kbId,
      params.domain,
      params.sourceType,
      params.sourceTable,
      params.sourceId,
      params.userId || '',
      params.title,
      params.content,
      params.structuredData ? JSON.stringify(params.structuredData) : '',
      params.metadata ? JSON.stringify(params.metadata) : '',
      params.tags || '',
      bm25Keywords,
      params.date,
      now,
      now
    ]);

    if (logger) {
      logger.info(`KnowledgeBase登録完了 (KB ID: ${kbId})`);
    }

    // 埋め込みベクトル生成
    const embedding = createEmbedding(params.content, 'RETRIEVAL_DOCUMENT', logger);

    // Embeddingsシートに登録
    const embSheet = ss.getSheetByName(VECTOR_DB_CONFIG.sheets.embeddings);
    if (!embSheet) {
      throw new Error(`${VECTOR_DB_CONFIG.sheets.embeddings}シートが見つかりません`);
    }

    embSheet.appendRow([
      kbId,
      JSON.stringify(embedding),
      EMBEDDINGS_CONFIG.model,
      'RETRIEVAL_DOCUMENT',
      now
    ]);

    if (logger) {
      logger.info(`Embeddings登録完了 (次元数: ${embedding.length})`);
      logger.success(`Vector DB同期成功 (KB ID: ${kbId})`);
    }

    return kbId;

  } catch (error) {
    if (logger) {
      logger.error(`Vector DB同期エラー: ${error.toString()}`, {
        domain: params.domain,
        sourceType: params.sourceType,
        sourceId: params.sourceId
      });
    }
    throw error;
  }
}

/**
 * バッチ同期 (複数レコードを一括登録)
 *
 * @param {Array<Object>} paramsArray - 同期パラメータの配列
 * @param {Object} logger - ロガーインスタンス (オプション)
 * @returns {Array<string>} 生成されたKB IDの配列
 */
function syncToVectorDBBatch(paramsArray, logger = null) {
  if (!Array.isArray(paramsArray) || paramsArray.length === 0) {
    throw new Error('パラメータ配列が不正です');
  }

  if (logger) {
    logger.info(`Vector DBバッチ同期開始 (件数: ${paramsArray.length})`);
  }

  const kbIds = [];
  const errors = [];

  paramsArray.forEach((params, index) => {
    try {
      const kbId = syncToVectorDB(params, logger);
      kbIds.push(kbId);
    } catch (error) {
      errors.push({
        index: index,
        params: params,
        error: error.toString()
      });
      if (logger) {
        logger.error(`バッチ同期エラー (インデックス: ${index}): ${error.toString()}`);
      }
    }
  });

  if (logger) {
    logger.info(`Vector DBバッチ同期完了 (成功: ${kbIds.length}件, 失敗: ${errors.length}件)`);
  }

  if (errors.length > 0) {
    throw new Error(`バッチ同期で${errors.length}件のエラーが発生しました: ${JSON.stringify(errors)}`);
  }

  return kbIds;
}

/**
 * Vector DBからKBレコードを取得
 *
 * @param {string} kbId - KB ID
 * @param {Object} logger - ロガーインスタンス (オプション)
 * @returns {Object|null} KBレコード
 */
function getKnowledgeBaseRecord(kbId, logger = null) {
  if (!VECTOR_DB_CONFIG.spreadsheetId) {
    throw new Error('VECTOR_DB_SPREADSHEET_IDが設定されていません');
  }

  try {
    const ss = SpreadsheetApp.openById(VECTOR_DB_CONFIG.spreadsheetId);
    const kbSheet = ss.getSheetByName(VECTOR_DB_CONFIG.sheets.knowledgeBase);

    if (!kbSheet) {
      throw new Error(`${VECTOR_DB_CONFIG.sheets.knowledgeBase}シートが見つかりません`);
    }

    const data = kbSheet.getDataRange().getValues();
    const headers = data[0];

    // KB IDで検索 (列0がID)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === kbId) {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = data[i][index];
        });
        return record;
      }
    }

    if (logger) {
      logger.warning(`KB ID ${kbId} が見つかりませんでした`);
    }

    return null;

  } catch (error) {
    if (logger) {
      logger.error(`KBレコード取得エラー: ${error.toString()}`);
    }
    throw error;
  }
}

/**
 * テスト関数: Vector DB同期
 */
function testVectorDBSync() {
  const logger = createLogger('vector_db_sync_test');

  try {
    logger.info('=== Vector DB同期テスト ===');

    // テストデータ
    const testParams = {
      domain: 'nursing',
      sourceType: 'care_record',
      sourceTable: 'Care_Records',
      sourceId: 'test_rec_001',
      userId: 'user_001',
      title: '2025-10-27 訪問看護記録（テスト）',
      content: '訪問時、利用者は穏やかな表情で出迎えてくれました。バイタルサインは安定しており、血圧120/80、脈拍72回/分、体温36.5度でした。バルーンカテーテルの交換を実施しました。',
      structuredData: {
        vital_signs: {
          blood_pressure: '120/80',
          pulse: 72,
          temperature: 36.5
        }
      },
      metadata: {
        audioFileId: 'test_audio_001'
      },
      tags: 'バルーン交換,バイタル測定',
      date: '2025-10-27'
    };

    // 同期実行
    const kbId = syncToVectorDB(testParams, logger);
    logger.info(`生成されたKB ID: ${kbId}`);

    // 取得テスト
    const record = getKnowledgeBaseRecord(kbId, logger);
    if (record) {
      logger.info(`レコード取得成功: title="${record.title}"`);
    }

    logger.success('テスト成功');
    return { success: true, kbId: kbId };

  } catch (error) {
    logger.error(`テスト失敗: ${error.toString()}`, { stack: error.stack });
    throw error;
  }
}
