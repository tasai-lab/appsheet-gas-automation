// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

const APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8'; // AppSheetのアプリID

const ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY'; // AppSheet APIのアクセスキー

// テーブル名
const PROBLEMS_TABLE_NAME = 'VN_Plan_Problems';

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_訪問看護_計画書問題点_評価';
    return processRequest(
      params.problemId || params.data?.problemId,
      params.planText || params.data?.planText,
      params.latestRecords || params.data?.latestRecords,
      params.statusToSet || params.data?.statusToSet,
      params.staffId || params.data?.staffId
    );
  });
}

/**
 * メイン処理関数（2段階処理：Flash-Lite → Pro）
 * 各モデルのコストを個別の行としてスプレッドシートに記録
 * @param {string} problemId - 問題レコードID
 * @param {string} planText - 看護計画テキスト
 * @param {string} latestRecords - 最新の看護記録
 * @param {string} statusToSet - 設定するステータス
 * @param {string} staffId - スタッフID
 * @returns {Object} - 処理結果
 */
function processRequest(problemId, planText, latestRecords, statusToSet, staffId) {
  const mainLogger = createLogger('Appsheet_訪問看護_計画書問題点_評価');

  try {
    mainLogger.info('=== 2段階AI処理開始（評価文生成） ===', { problemId: problemId });

    // パラメータ検証
    if (!problemId || !planText || !latestRecords || !staffId) {
      throw new Error("必須パラメータ（problemId, planText, latestRecords, staffId）が不足しています。");
    }

    mainLogger.info(`処理開始: Problem ID = ${problemId}, Staff ID = ${staffId}`);

    // ========================================
    // Step 1: Flash-Liteで要点抽出
    // ========================================
    mainLogger.info('--- Step 1: Flash-Liteで要点抽出 ---');

    // Flash-Lite専用のloggerを作成
    const flashLiteLogger = createLogger('Appsheet_訪問看護_計画書問題点_評価');
    let flashLiteStatus = '成功';

    let keyPoints;
    try {
      keyPoints = extractKeyPointsWithFlashLite(planText, latestRecords, flashLiteLogger);

      if (!keyPoints || !keyPoints.text) {
        throw new Error("Flash-Liteからの応答が不正でした。");
      }

      // Flash-Liteのコストを記録
      if (keyPoints.usageMetadata) {
        flashLiteLogger.setUsageMetadata(keyPoints.usageMetadata);
        mainLogger.info(`Flash-Lite (${keyPoints.usageMetadata.model}):`, {
          inputTokens: keyPoints.usageMetadata.inputTokens,
          inputCost: `¥${keyPoints.usageMetadata.inputCostJPY.toFixed(4)}`,
          outputTokens: keyPoints.usageMetadata.outputTokens,
          outputCost: `¥${keyPoints.usageMetadata.outputCostJPY.toFixed(4)}`,
          totalCost: `¥${keyPoints.usageMetadata.totalCostJPY.toFixed(4)}`
        });
      }

      flashLiteLogger.success('Flash-Lite: 要点抽出完了');
      mainLogger.info('要点抽出完了', { extractedLength: keyPoints.text.length });

    } catch (error) {
      flashLiteStatus = 'エラー';
      flashLiteLogger.error(`Flash-Liteエラー: ${error.toString()}`, { stack: error.stack });
      throw error;
    } finally {
      // Flash-Liteのログを個別に保存
      flashLiteLogger.saveToSpreadsheet(flashLiteStatus, problemId);
    }

    // ========================================
    // Step 2: Proで評価文生成
    // ========================================
    mainLogger.info('--- Step 2: Proで評価文生成 ---');

    // Pro専用のloggerを作成
    const proLogger = createLogger('Appsheet_訪問看護_計画書問題点_評価');
    let proStatus = '成功';

    let evaluationResult;
    try {
      evaluationResult = generateEvaluationWithPro(keyPoints.text, planText, proLogger);

      if (!evaluationResult || !evaluationResult.evaluationText) {
        throw new Error("Proからの応答が不正でした。");
      }

      // Proのコストを記録
      if (evaluationResult.usageMetadata) {
        proLogger.setUsageMetadata(evaluationResult.usageMetadata);
        mainLogger.info(`Pro (${evaluationResult.usageMetadata.model}):`, {
          inputTokens: evaluationResult.usageMetadata.inputTokens,
          inputCost: `¥${evaluationResult.usageMetadata.inputCostJPY.toFixed(4)}`,
          outputTokens: evaluationResult.usageMetadata.outputTokens,
          outputCost: `¥${evaluationResult.usageMetadata.outputCostJPY.toFixed(4)}`,
          totalCost: `¥${evaluationResult.usageMetadata.totalCostJPY.toFixed(4)}`
        });
      }

      proLogger.success('Pro: 評価文生成完了');
      mainLogger.info('評価文生成完了', {
        evaluationText: evaluationResult.evaluationText
      });

    } catch (error) {
      proStatus = 'エラー';
      proLogger.error(`Proエラー: ${error.toString()}`, { stack: error.stack });
      throw error;
    } finally {
      // Proのログを個別に保存
      proLogger.saveToSpreadsheet(proStatus, problemId);
    }

    // 合計コスト計算とコンソール出力
    const totalCost = (keyPoints.usageMetadata?.totalCostJPY || 0) + (evaluationResult.usageMetadata?.totalCostJPY || 0);
    mainLogger.info(`=== 2段階処理完了 ===`);
    mainLogger.info('コスト合計:', {
      flashLiteModel: keyPoints.usageMetadata?.model || 'N/A',
      flashLiteCost: `¥${keyPoints.usageMetadata?.totalCostJPY.toFixed(4) || '0.0000'}`,
      proModel: evaluationResult.usageMetadata?.model || 'N/A',
      proCost: `¥${evaluationResult.usageMetadata?.totalCostJPY.toFixed(4) || '0.0000'}`,
      total: `¥${totalCost.toFixed(4)}`
    });

    // ========================================
    // Step 3: AppSheetテーブルを更新
    // ========================================
    updateEvaluationInAppSheet(problemId, evaluationResult.evaluationText, statusToSet, staffId, mainLogger);

    mainLogger.success(`処理完了。ID ${problemId} の評価を更新しました。`);

    return {
      success: true,
      evaluation: evaluationResult.evaluationText,
      costs: {
        flashLite: keyPoints.usageMetadata,
        pro: evaluationResult.usageMetadata,
        total: totalCost
      }
    };

  } catch (error) {
    mainLogger.error(`エラーが発生しました: ${error.toString()}`, {
      problemId: problemId,
      stack: error.stack
    });

    // AppSheetにエラーステータス更新
    if (problemId) {
      try {
        updateErrorStatusInAppSheet(problemId, error.toString(), staffId, mainLogger);
      } catch (updateError) {
        mainLogger.error(`エラーステータス更新失敗: ${updateError.toString()}`);
      }
    }

    throw error;
  }
}

/**
 * テスト用関数（推奨）
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  const testParams = {
    problemId: 'TEST-001',
    planText: `
△ 問題点
排便コントロール不良

△ 目標
定期的な排便リズムを確立することができる

△ 観察項目
排便回数、便の性状、水分摂取量、食事内容、腹部症状

△ 実施項目
水分摂取の促進、食物繊維の摂取指導、排便時間の習慣化支援、緩下剤の服用確認
`,
    latestRecords: `
【最新の看護記録】
- 2025/10/28: 排便あり、普通便。水分摂取1500ml。食事摂取良好。
- 2025/10/29: 排便なし。水分摂取やや少なめ（1200ml）。
- 2025/10/30: 排便あり、軟便。緩下剤服用確認。水分摂取促す。
`,
    statusToSet: '評価済み',
    staffId: 'TEST-STAFF-001'
  };

  return CommonTest.runTest(
    (params) => processRequest(
      params.problemId,
      params.planText,
      params.latestRecords,
      params.statusToSet,
      params.staffId
    ),
    testParams,
    'Appsheet_訪問看護_計画書問題点_評価'
  );
}

/**
 * Step 1: Flash-Liteで要点抽出
 * 看護計画と最新記録から、評価に必要な重要情報を抽出
 * @param {string} planText - 看護計画テキスト
 * @param {string} latestRecords - 最新の看護記録
 * @param {Object} logger - ロガーインスタンス
 * @return {Object} {text: 抽出された要点, usageMetadata: 使用量情報}
 */
function extractKeyPointsWithFlashLite(planText, latestRecords, logger = null) {
  if (logger) {
    logger.info('Flash-Lite: 要点抽出開始');
  }

  const prompt = `
あなたは、訪問看護記録を分析する専門家です。

以下の#看護計画と#最新の看護記録を比較分析し、評価に必要な重要情報を抽出してください。

# 看護計画

${planText}

# 最新の看護記録

${latestRecords}

# 抽出指示

以下の観点から、評価に必要な情報を**箇条書き形式**で抽出してください：

1. **目標の達成状況**: 計画の目標に対して、記録に記載された内容から達成度を判断できる情報
2. **観察項目の確認**: 観察項目に関連する具体的な記録内容
3. **実施項目の実行状況**: 実施項目が実際に行われたか、効果があったかの情報
4. **変化・改善点**: 前回からの変化、改善傾向、悪化傾向
5. **今後の課題**: 引き続き注意が必要な点、新たな課題

**重要**:
- 抽象的な表現は避け、記録に記載された具体的な内容を抽出してください
- 評価文の作成に必要な情報を漏れなく抽出してください
- 情報は簡潔にまとめつつ、評価の根拠となる詳細さを保ってください
`;

  // Flash-Liteクライアント作成
  const flashLiteClient = createVertexAIFlashLiteClient({
    temperature: 0.5,  // 要点抽出には少し高めの温度
    maxOutputTokens: 4096
  });

  // テキスト生成
  const result = flashLiteClient.generateText(prompt, logger);

  if (logger) {
    logger.success('Flash-Lite: 要点抽出完了');
  }

  return result;
}

/**
 * Step 2: Proで評価文生成
 * Flash-Liteで抽出された要点から、50文字未満の評価文を生成
 * @param {string} keyPoints - Flash-Liteで抽出された要点
 * @param {string} planText - 看護計画テキスト（参考用）
 * @param {Object} logger - ロガーインスタンス
 * @return {Object} 評価結果（evaluationText, usageMetadata）
 */
function generateEvaluationWithPro(keyPoints, planText, logger = null) {
  if (logger) {
    logger.info('Pro: 評価文生成開始');
  }

  const prompt = `
あなたは経験豊富な訪問看護師です。

以下の#抽出された要点に基づき、看護計画に対する評価文を生成してください。

# 抽出された要点

${keyPoints}

# 参考：看護計画（全体像）

${planText}

# 指示

- 抽出された要点を基に、看護計画の目標がどの程度達成されたか、計画は適切であったかを評価してください。
- 評価文は**50文字未満**で、簡潔明瞭な記録様式の表現（常体、「～である」「～する」）を厳守してください。
- 出力は必ず指定されたJSON形式に従ってください。

# 出力形式（JSON）

以下の形式で、日本語のJSON文字列を生成してください。

{
  "evaluationText": "（ここに50文字未満の評価文を記述）"
}
`;

  // Proクライアント作成
  const proClient = createVertexAIProClient({
    temperature: 0.2,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json'
  });

  // テキスト生成
  const result = proClient.generateText(prompt, logger);

  // JSONコンテンツ抽出
  let content = result.text;
  const startIndex = content.indexOf('{');
  const endIndex = content.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1) {
    throw new Error("AIの応答からJSONを抽出できませんでした。");
  }

  const evaluationData = JSON.parse(content.substring(startIndex, endIndex + 1));

  // usageMetadataを追加
  evaluationData.usageMetadata = result.usageMetadata;

  if (logger) {
    logger.success('Pro: 評価文生成完了');
  }

  return evaluationData;
}

/**
 * AppSheetのVN_Plan_Problemsテーブルを更新する
 * @param {string} problemId - 問題レコードID
 * @param {string} evaluationText - 評価文
 * @param {string} status - ステータス
 * @param {string} staffId - スタッフID
 * @param {Object} logger - ロガーインスタンス
 */
function updateEvaluationInAppSheet(problemId, evaluationText, status, staffId, logger = null) {
  if (logger) {
    logger.info('AppSheetテーブル更新開始', { problemId: problemId });
  }

  const now = new Date();
  const formattedDate = Utilities.formatDate(now, "JST", "yyyy-MM-dd");
  const formattedDateTime = Utilities.formatDate(now, "JST", "yyyy-MM-dd HH:mm:ss");

  const rowData = {
    "problem_id": problemId,
    "evaluation": evaluationText,
    "evaluation_date": formattedDate,
    "status": status,
    "updated_at": formattedDateTime,
    "updated_by": staffId
  };

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [rowData]
  };

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${PROBLEMS_TABLE_NAME}/Action`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'ApplicationAccessKey': ACCESS_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (logger) {
      logger.info(`AppSheet API 応答: ${responseCode}`);
    }

    if (responseCode >= 400) {
      throw new Error(`AppSheet API Error: ${responseCode} - ${responseText}`);
    }

    if (logger) {
      logger.success('AppSheetテーブル更新成功');
    }

  } catch (error) {
    if (logger) {
      logger.error(`AppSheet API呼び出しエラー: ${error.toString()}`);
    }
    throw error;
  }
}

/**
 * AppSheetのVN_Plan_Problemsテーブルにエラーステータスを記録
 * @param {string} problemId - 問題レコードID
 * @param {string} errorMessage - エラーメッセージ
 * @param {string} staffId - スタッフID
 * @param {Object} logger - ロガーインスタンス
 */
function updateErrorStatusInAppSheet(problemId, errorMessage, staffId, logger = null) {
  if (logger) {
    logger.info('AppSheetエラーステータス更新開始', { problemId: problemId });
  }

  const now = new Date();
  const formattedDateTime = Utilities.formatDate(now, "JST", "yyyy-MM-dd HH:mm:ss");

  const rowData = {
    "problem_id": problemId,
    "status": 'エラー',
    "evaluation": `エラー: ${errorMessage.substring(0, 450)}`, // 評価欄に短縮エラーメッセージ
    "updated_at": formattedDateTime,
    "updated_by": staffId
  };

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [rowData]
  };

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${PROBLEMS_TABLE_NAME}/Action`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'ApplicationAccessKey': ACCESS_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();

    if (logger) {
      logger.info(`AppSheetエラーステータス更新完了（ステータス: ${responseCode}）`);
    }

  } catch (error) {
    if (logger) {
      logger.error(`エラーステータス更新失敗: ${error.toString()}`);
    }
    // エラーステータスの更新失敗は致命的ではないのでthrowしない
  }
}

/**
 * 直接実行可能な関数（2段階処理テスト用）
 * GASエディタから引数を設定して直接実行できる
 */
function directTestEvaluation() {
  // ★★★ 以下のパラメータを実際の値に変更してください ★★★

  const problemId = 'TEST-001';

  const planText = `
△ 問題点
排便コントロール不良

△ 目標
定期的な排便リズムを確立することができる

△ 観察項目
排便回数、便の性状、水分摂取量、食事内容、腹部症状

△ 実施項目
水分摂取の促進、食物繊維の摂取指導、排便時間の習慣化支援、緩下剤の服用確認
`;

  const latestRecords = `
【最新の看護記録】
- 2025/10/28: 排便あり、普通便。水分摂取1500ml。食事摂取良好。
- 2025/10/29: 排便なし。水分摂取やや少なめ（1200ml）。
- 2025/10/30: 排便あり、軟便。緩下剤服用確認。水分摂取促す。
`;

  const statusToSet = '評価済み';
  const staffId = 'TEST-STAFF-001';

  // ★★★ ここまで ★★★

  console.log('=== 2段階AI処理テスト開始（評価文生成） ===');
  console.log(`Problem ID: ${problemId}`);
  console.log(`Staff ID: ${staffId}`);
  console.log('');

  try {
    // メイン処理を実行（2段階処理）
    const result = processRequest(problemId, planText, latestRecords, statusToSet, staffId);

    console.log('=== 処理成功 ===');
    console.log('');
    console.log('【コスト詳細】');
    console.log(`Flash-Lite: ¥${result.costs.flashLite.totalCostJPY.toFixed(4)} (入力: ${result.costs.flashLite.inputTokens}, 出力: ${result.costs.flashLite.outputTokens})`);
    console.log(`Pro: ¥${result.costs.pro.totalCostJPY.toFixed(4)} (入力: ${result.costs.pro.inputTokens}, 出力: ${result.costs.pro.outputTokens})`);
    console.log(`合計: ¥${result.costs.total.toFixed(4)}`);
    console.log('');
    console.log('【生成された評価文】');
    console.log(result.evaluation);

    return result;

  } catch (error) {
    console.error('=== 処理エラー ===');
    console.error(error.toString());
    console.error(error.stack);

    throw error;
  }
}
