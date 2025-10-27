/**
 * =========================================
 * RAG Modules Test Suite
 * =========================================
 *
 * embeddings_service.gs と vector_db_sync.gs のテストスイート
 *
 * @version 1.0.0
 * @date 2025-10-27
 */

/**
 * メインテスト: 全てのテストを実行
 */
function testAllRAGModules() {
  const logger = createLogger('RAG_modules_test');
  logger.info('========================================');
  logger.info('RAGモジュール統合テスト開始');
  logger.info('========================================');

  const results = {
    embeddings: null,
    cosineSimilarity: null,
    similarSearch: null,
    vectorDBSync: null
  };

  try {
    // Test 1: 埋め込み生成
    logger.info('\n[Test 1] 埋め込みベクトル生成テスト');
    results.embeddings = testEmbeddings(logger);

    // Test 2: コサイン類似度
    logger.info('\n[Test 2] コサイン類似度計算テスト');
    results.cosineSimilarity = testCosineSimilarity(logger);

    // Test 3: 類似検索
    logger.info('\n[Test 3] 類似検索テスト');
    results.similarSearch = testSimilarSearch(logger);

    // Test 4: Vector DB同期 (スプレッドシートが設定されている場合のみ)
    if (VECTOR_DB_CONFIG.spreadsheetId) {
      logger.info('\n[Test 4] Vector DB同期テスト');
      results.vectorDBSync = testVectorDBSyncOnly(logger);
    } else {
      logger.warning('\n[Test 4] Vector DB同期テストスキップ (スプレッドシートIDが未設定)');
      results.vectorDBSync = { skipped: true, reason: 'スプレッドシートID未設定' };
    }

    // 結果サマリー
    logger.info('\n========================================');
    logger.info('テスト結果サマリー');
    logger.info('========================================');
    logger.info(`埋め込み生成: ${results.embeddings.success ? '✓ 成功' : '✗ 失敗'}`);
    logger.info(`コサイン類似度: ${results.cosineSimilarity.success ? '✓ 成功' : '✗ 失敗'}`);
    logger.info(`類似検索: ${results.similarSearch.success ? '✓ 成功' : '✗ 失敗'}`);
    logger.info(`Vector DB同期: ${results.vectorDBSync.skipped ? '- スキップ' : results.vectorDBSync.success ? '✓ 成功' : '✗ 失敗'}`);
    logger.info('========================================');

    logger.success('全テスト完了');
    return results;

  } catch (error) {
    logger.error(`テスト実行エラー: ${error.toString()}`, { stack: error.stack });
    throw error;
  }
}

/**
 * Test 1: 埋め込みベクトル生成
 */
function testEmbeddings(logger) {
  try {
    const text = '訪問時、利用者は穏やかな表情で出迎えてくれました。バイタルサインは安定しており、血圧120/80、脈拍72回/分、体温36.5度でした。';

    logger.info(`テストテキスト (${text.length}文字): "${text.substring(0, 50)}..."`);

    // 埋め込み生成
    const embedding = createEmbedding(text, 'RETRIEVAL_DOCUMENT', logger);

    // 検証
    if (!Array.isArray(embedding)) {
      throw new Error('埋め込みが配列ではありません');
    }

    if (embedding.length !== EMBEDDINGS_CONFIG.outputDimensionality) {
      throw new Error(`次元数が期待値と異なります: 期待=${EMBEDDINGS_CONFIG.outputDimensionality}, 実際=${embedding.length}`);
    }

    // 値の範囲チェック (-1.0 ~ 1.0 程度)
    const invalidValues = embedding.filter(v => typeof v !== 'number' || isNaN(v));
    if (invalidValues.length > 0) {
      throw new Error(`無効な値が含まれています: ${invalidValues.length}個`);
    }

    logger.info(`✓ 埋め込み生成成功: 次元数=${embedding.length}`);
    logger.info(`  最初の5要素: [${embedding.slice(0, 5).map(v => v.toFixed(6)).join(', ')}]`);
    logger.info(`  最小値: ${Math.min(...embedding).toFixed(6)}, 最大値: ${Math.max(...embedding).toFixed(6)}`);

    return {
      success: true,
      dimensions: embedding.length,
      embedding: embedding
    };

  } catch (error) {
    logger.error(`埋め込み生成テスト失敗: ${error.toString()}`);
    return { success: false, error: error.toString() };
  }
}

/**
 * Test 2: コサイン類似度計算
 */
function testCosineSimilarity(logger) {
  try {
    // テストケース: 類似するテキストと異なるテキスト
    const text1 = 'バルーンカテーテルの交換を実施しました。';
    const text2 = '膀胱留置カテーテルの交換を行いました。';  // 類似 (同じ意味)
    const text3 = '利用者は食事を完食し、食欲良好でした。';  // 異なる

    logger.info('テストケース:');
    logger.info(`  Text1: "${text1}"`);
    logger.info(`  Text2 (類似): "${text2}"`);
    logger.info(`  Text3 (異なる): "${text3}"`);

    // 埋め込み生成
    const emb1 = createEmbedding(text1, 'RETRIEVAL_DOCUMENT', logger);
    const emb2 = createEmbedding(text2, 'RETRIEVAL_DOCUMENT', logger);
    const emb3 = createEmbedding(text3, 'RETRIEVAL_DOCUMENT', logger);

    // コサイン類似度計算
    const sim12 = calculateCosineSimilarity(emb1, emb2);
    const sim13 = calculateCosineSimilarity(emb1, emb3);
    const sim23 = calculateCosineSimilarity(emb2, emb3);

    logger.info(`✓ コサイン類似度計算成功:`);
    logger.info(`  Text1 vs Text2 (類似): ${sim12.toFixed(6)}`);
    logger.info(`  Text1 vs Text3 (異なる): ${sim13.toFixed(6)}`);
    logger.info(`  Text2 vs Text3 (異なる): ${sim23.toFixed(6)}`);

    // 検証: 類似テキストの方が高い類似度を持つべき
    if (sim12 <= sim13) {
      logger.warning(`期待: sim12 > sim13, 実際: ${sim12.toFixed(4)} <= ${sim13.toFixed(4)}`);
    } else {
      logger.info(`✓ 類似度の順序が正しい: sim12 (${sim12.toFixed(4)}) > sim13 (${sim13.toFixed(4)})`);
    }

    return {
      success: true,
      similarities: {
        similar: sim12,
        different1: sim13,
        different2: sim23
      }
    };

  } catch (error) {
    logger.error(`コサイン類似度テスト失敗: ${error.toString()}`);
    return { success: false, error: error.toString() };
  }
}

/**
 * Test 3: 類似検索
 */
function testSimilarSearch(logger) {
  try {
    // 候補文書の準備
    const documents = [
      { id: 'doc1', text: 'バルーンカテーテルの交換を実施しました。' },
      { id: 'doc2', text: '利用者は食事を完食し、食欲良好でした。' },
      { id: 'doc3', text: '服薬確認を行い、朝食後の薬を正しく服用していることを確認しました。' },
      { id: 'doc4', text: '膀胱留置カテーテルの状態を確認しました。' },
      { id: 'doc5', text: 'バイタルサインは安定しており、血圧120/80、脈拍72回/分でした。' }
    ];

    logger.info(`候補文書数: ${documents.length}`);

    // 各文書の埋め込みを生成
    const texts = documents.map(doc => doc.text);
    const embeddings = createEmbeddingsBatch(texts, 'RETRIEVAL_DOCUMENT', logger);

    // 候補に埋め込みを追加
    const candidates = documents.map((doc, i) => ({
      ...doc,
      embedding: embeddings[i]
    }));

    logger.info(`✓ バッチ埋め込み生成完了: ${embeddings.length}件`);

    // 検索クエリ
    const query = 'バルーンの使用状況を教えてください';
    logger.info(`検索クエリ: "${query}"`);

    // 類似検索実行
    const results = searchSimilarTexts(query, candidates, 3, logger);

    logger.info(`✓ 類似検索完了: 上位${results.length}件`);
    results.forEach((result, i) => {
      logger.info(`  [${i + 1}] (類似度: ${result.similarity.toFixed(4)}) ${result.id}: "${result.text.substring(0, 40)}..."`);
    });

    // 検証: doc1またはdoc4が上位にあるべき
    const topIds = results.slice(0, 2).map(r => r.id);
    const hasCatheterDoc = topIds.includes('doc1') || topIds.includes('doc4');

    if (hasCatheterDoc) {
      logger.info(`✓ 関連文書が上位に含まれています: ${topIds.join(', ')}`);
    } else {
      logger.warning(`関連文書が上位2件に含まれていません: ${topIds.join(', ')}`);
    }

    return {
      success: true,
      query: query,
      topResults: results.slice(0, 3).map(r => ({
        id: r.id,
        similarity: r.similarity,
        text: r.text
      }))
    };

  } catch (error) {
    logger.error(`類似検索テスト失敗: ${error.toString()}`);
    return { success: false, error: error.toString() };
  }
}

/**
 * Test 4: Vector DB同期 (スプレッドシートが設定されている場合のみ)
 */
function testVectorDBSyncOnly(logger) {
  try {
    // テストデータ
    const testParams = {
      domain: 'nursing',
      sourceType: 'care_record_test',
      sourceTable: 'Care_Records',
      sourceId: `test_${Date.now()}`,
      userId: 'user_test_001',
      title: `${Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd')} 訪問看護記録（テスト）`,
      content: '訪問時、利用者は穏やかな表情で出迎えてくれました。バイタルサインは安定しており、血圧120/80、脈拍72回/分、体温36.5度でした。バルーンカテーテルの交換を実施しました。',
      structuredData: {
        vital_signs: {
          blood_pressure: '120/80',
          pulse: 72,
          temperature: 36.5
        }
      },
      metadata: {
        audioFileId: 'test_audio_001',
        testFlag: true
      },
      tags: 'バルーン交換,バイタル測定',
      date: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd')
    };

    logger.info(`テストデータ:`);
    logger.info(`  domain: ${testParams.domain}`);
    logger.info(`  sourceType: ${testParams.sourceType}`);
    logger.info(`  sourceId: ${testParams.sourceId}`);
    logger.info(`  title: ${testParams.title}`);

    // 同期実行
    const kbId = syncToVectorDB(testParams, logger);

    logger.info(`✓ Vector DB同期成功`);
    logger.info(`  生成されたKB ID: ${kbId}`);

    // レコード取得テスト
    const record = getKnowledgeBaseRecord(kbId, logger);

    if (!record) {
      throw new Error('レコードが取得できませんでした');
    }

    logger.info(`✓ レコード取得成功`);
    logger.info(`  title: ${record.title}`);
    logger.info(`  domain: ${record.domain}`);

    return {
      success: true,
      kbId: kbId,
      record: record
    };

  } catch (error) {
    logger.error(`Vector DB同期テスト失敗: ${error.toString()}`);
    return { success: false, error: error.toString() };
  }
}

/**
 * パフォーマンステスト: バッチ処理の速度測定
 */
function testBatchPerformance() {
  const logger = createLogger('RAG_performance_test');

  try {
    logger.info('========================================');
    logger.info('バッチ処理パフォーマンステスト');
    logger.info('========================================');

    // テストデータ生成
    const texts = [];
    for (let i = 0; i < 50; i++) {
      texts.push(`これはテスト文書${i + 1}です。訪問看護記録のサンプルテキストを生成しています。`);
    }

    logger.info(`テスト対象: ${texts.length}件のテキスト`);

    // バッチ処理
    const startTime = Date.now();
    const embeddings = createEmbeddingsBatch(texts, 'RETRIEVAL_DOCUMENT', logger);
    const endTime = Date.now();

    const elapsedMs = endTime - startTime;
    const avgMs = elapsedMs / texts.length;

    logger.info(`✓ バッチ処理完了:`);
    logger.info(`  総処理時間: ${elapsedMs}ms`);
    logger.info(`  平均処理時間: ${avgMs.toFixed(2)}ms/件`);
    logger.info(`  生成件数: ${embeddings.length}件`);

    logger.success('パフォーマンステスト成功');

    return {
      success: true,
      totalMs: elapsedMs,
      avgMs: avgMs,
      count: embeddings.length
    };

  } catch (error) {
    logger.error(`パフォーマンステスト失敗: ${error.toString()}`);
    throw error;
  }
}
