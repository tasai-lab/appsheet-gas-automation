// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

// ★★★ Google AI Studio APIキー削除済み ★★★
// 修正日: 2025-10-18
// 理由: ユーザー指示「今後gemini apiを使用することが無いようにお願いします。今後、全てvertex apiを使用すること。」
// Vertex AI（OAuth2認証）を使用するため、APIキー不要
// const GEMINI_API_KEY = '';  // ★削除済み

const APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8'; // AppSheetのアプリID

const ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY'; // AppSheet APIのアクセスキー

const ERROR_NOTIFICATION_EMAIL = "t.asai@fractal-group.co.jp"; // ★ エラー通知先のメールアドレス

// テーブル名

const PROBLEMS_TABLE_NAME = 'VN_Plan_Problems';

/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_訪問看護_計画書問題点';
    return processRequest(params.problemId || params.data?.problemId, params.contextText || params.data?.contextText, params.problemPoint || params.data?.problemPoint, params.problemIdentifiedDate || params.data?.problemIdentifiedDate);
  });
}

/**
 * メイン処理関数（2段階処理：Flash-Lite → Pro）
 * 各モデルのコストを個別の行としてスプレッドシートに記録
 * @param {string} problemId - 問題レコードID
 * @param {string} contextText - 利用者様の基本情報と看護記録
 * @param {string} problemPoint - 問題点
 * @param {string} problemIdentifiedDate - 問題が明らかになった日付
 * @returns {Object} - 処理結果
 */
function processRequest(problemId, contextText, problemPoint, problemIdentifiedDate) {
  const mainLogger = createLogger('Appsheet_訪問看護_計画書問題点');

  try {
    mainLogger.info('=== 2段階AI処理開始 ===', { problemId: problemId });

    // パラメータ検証
    if (!problemId || !contextText || !problemPoint || !problemIdentifiedDate) {
      throw new Error("必須パラメータ（problemId, contextText, problemPoint, problemIdentifiedDate）が不足しています。");
    }

    mainLogger.info(`処理開始: Problem ID = ${problemId}, 問題点 = ${problemPoint}`);

    // ========================================
    // Step 1: Flash-Liteで要点抽出
    // ========================================
    mainLogger.info('--- Step 1: Flash-Liteで要点抽出 ---');

    // Flash-Lite専用のloggerを作成
    const flashLiteLogger = createLogger('Appsheet_訪問看護_計画書問題点');
    let flashLiteStatus = '成功';

    let keyPoints;
    try {
      keyPoints = extractKeyPointsWithFlashLite(contextText, problemPoint, problemIdentifiedDate, flashLiteLogger);

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
    // Step 2: Proで看護計画生成
    // ========================================
    mainLogger.info('--- Step 2: Proで看護計画生成 ---');

    // Pro専用のloggerを作成
    const proLogger = createLogger('Appsheet_訪問看護_計画書問題点');
    let proStatus = '成功';

    let plan;
    try {
      plan = generateCarePlanWithPro(keyPoints.text, problemPoint, problemIdentifiedDate, proLogger);

      if (!plan) {
        throw new Error("Proからの応答が不正でした。");
      }

      // Proのコストを記録
      if (plan.usageMetadata) {
        proLogger.setUsageMetadata(plan.usageMetadata);
        mainLogger.info(`Pro (${plan.usageMetadata.model}):`, {
          inputTokens: plan.usageMetadata.inputTokens,
          inputCost: `¥${plan.usageMetadata.inputCostJPY.toFixed(4)}`,
          outputTokens: plan.usageMetadata.outputTokens,
          outputCost: `¥${plan.usageMetadata.outputCostJPY.toFixed(4)}`,
          totalCost: `¥${plan.usageMetadata.totalCostJPY.toFixed(4)}`
        });
      }

      proLogger.success('Pro: 看護計画生成完了');
      mainLogger.info('看護計画生成完了', {
        problemStatement: plan.problem_statement,
        goal: plan.goal
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
    const totalCost = (keyPoints.usageMetadata?.totalCostJPY || 0) + (plan.usageMetadata?.totalCostJPY || 0);
    mainLogger.info(`=== 2段階処理完了 ===`);
    mainLogger.info('コスト合計:', {
      flashLiteModel: keyPoints.usageMetadata?.model || 'N/A',
      flashLiteCost: `¥${keyPoints.usageMetadata?.totalCostJPY.toFixed(4) || '0.0000'}`,
      proModel: plan.usageMetadata?.model || 'N/A',
      proCost: `¥${plan.usageMetadata?.totalCostJPY.toFixed(4) || '0.0000'}`,
      total: `¥${totalCost.toFixed(4)}`
    });

    // ========================================
    // Step 3: AppSheetテーブルを更新
    // ========================================
    updatePlanInAppSheet(problemId, plan, mainLogger);

    mainLogger.success(`処理完了。ID ${problemId} の看護計画を更新しました。`);

    return {
      success: true,
      plan: plan,
      costs: {
        flashLite: keyPoints.usageMetadata,
        pro: plan.usageMetadata,
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
        updateErrorStatusInAppSheet(problemId, error.toString(), mainLogger);
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
 *
 * 注意: より詳細なテストには directProcessCarePlan() または directTestAIGeneration() を使用してください。
 */
function testProcessRequest() {
  const testParams = {
    problemId: 'TEST-001',
    contextText: `
【利用者様基本情報】
氏名: テスト太郎
年齢: 80歳
性別: 男性
診断名: 心不全、糖尿病
ADL: 一部介助必要

【これまでの看護記録】
- 2025/10/20: 血圧140/90、心拍数72回/分。息切れの訴えあり。
- 2025/10/22: 食事摂取量やや低下。水分摂取を促す。
- 2025/10/25: 下肢浮腫（+1）を確認。利尿剤の効果を観察中。
`,
    problemPoint: '排便コントロール不良',
    problemIdentifiedDate: '2025-10-26'
  };

  return CommonTest.runTest((params) => processRequest(params.problemId, params.contextText, params.problemPoint, params.problemIdentifiedDate), testParams, 'Appsheet_訪問看護_計画書問題点');
}

/**
 * Step 1: Flash-Liteで要点抽出
 * 利用者様の基本情報と看護記録から、問題点に関連する重要な情報を抽出
 * @param {string} contextText - 利用者様の基本情報と看護記録
 * @param {string} problemPoint - 問題点
 * @param {string} identifiedDate - 問題が明らかになった日付
 * @param {Object} logger - ロガーインスタンス
 * @return {Object} {text: 抽出された要点, usageMetadata: 使用量情報}
 */
function extractKeyPointsWithFlashLite(contextText, problemPoint, identifiedDate, logger = null) {
  if (logger) {
    logger.info('Flash-Lite: 要点抽出開始');
  }

  const prompt = `
あなたは、訪問看護記録を分析する専門家です。

以下の#参照情報から、#問題点に関連する重要な情報を詳細かつ適切に抽出してください。

# 参照情報

- **問題が明らかになった日付**: ${identifiedDate}

- **利用者様の基本情報と看護記録**:

${contextText}

# 問題点

${problemPoint}

# 抽出指示

以下の観点から、問題点に関連する情報を**箇条書き形式**で抽出してください：

1. **利用者様の基本情報**: 年齢、性別、診断名、ADL状態など
2. **問題点に直接関連する記録**: 最近の観察記録、バイタルサイン、症状の変化
3. **関連する過去の経過**: 同様の問題の発生履歴、対処方法、効果
4. **現在の治療・ケア内容**: 服薬状況、処置内容、ケア方法
5. **家族・環境因子**: 家族のサポート状況、生活環境、本人の意向

**重要**:
- 抽象的な表現は避け、具体的な数値や状態を含めてください
- 問題点の理解に必要な情報を漏れなく抽出してください
- 情報は簡潔にまとめつつ、詳細さを保ってください
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
 * Step 2: Proで看護計画生成
 * Flash-Liteで抽出された要点から、規定の書式で看護計画を生成
 * @param {string} keyPoints - Flash-Liteで抽出された要点
 * @param {string} problemPoint - 問題点
 * @param {string} identifiedDate - 問題が明らかになった日付
 * @param {Object} logger - ロガーインスタンス
 * @return {Object} 看護計画データ（problem_statement, goal, solutions_observation, solutions_implementation, usageMetadata）
 */
function generateCarePlanWithPro(keyPoints, problemPoint, identifiedDate, logger = null) {
  if (logger) {
    logger.info('Pro: 看護計画生成開始');
  }

  const prompt = `
あなたは、日本の訪問看護ステーションに勤務する、経験豊富な看護師（Registered Nurse）です。

これから提供される情報に基づき、質の高い訪問看護計画（O-P, E-P/C-P）を立案してください。

# 指示

提供された#抽出された要点と、特に注目している#問題点を専門的に分析し、以下の#出力形式（JSON）に従って、看護計画を生成してください。

# 抽出された要点

- **問題が明らかになった日付**: ${identifiedDate}

- **問題点に関連する重要情報**:

${keyPoints}

# 問題点

${problemPoint}

# 看護計画作成のルール

- **視点**: 常に利用者様の個別性を尊重し、安全・安楽を最優先する視点で記述してください。

- **表現**: 医療専門職が使う、簡潔明瞭な記録様式の表現（常体、「～である」「～する」）を厳守してください。丁寧語（「です」「ます」）は絶対に使用しないでください。

- **具体性**: 抽象的な表現は避け、誰が読んでも具体的に何をすべきか理解できるレベルで記述してください。

# 出力形式（JSON）

以下の形式で、日本語のJSON文字列を生成してください。

{
  "problem_statement": "提供された情報から最も重要と考えられる看護上の問題点を一つだけ選び、簡潔なキーワードで表現してください。例: '排便コントロール不良'、'皮膚トラブル'、'栄養・水分摂取不足'、'内服コントロール不良'。",
  "goal": "上記の問題点に対し、計画期間内に達成可能で、具体的かつ測定可能な長期目標（Goal）を「～できる」「～することができる」といった主観的な目標で記述してください。",
  "solutions_observation": "提示された問題点に直接関連する観察項目（O-P）を、具体的なポイントを読点「、」で繋いだ、簡潔で一つの文章として記述してください。改行やビュレットは含めないでください。",
  "solutions_implementation": "提示された問題点に直接関連する実施項目（E-P/C-P）を、具体的なケア内容を**体言止め（名詞形）のキーワード**として読点「、」で繋ぎ、一つの文章として記述してください。改行やビュレットは含めないでください。"
}
`;

  // Proクライアント作成
  const proClient = createVertexAIProClient({
    temperature: 0.3,
    maxOutputTokens: 8192,
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

  const planData = JSON.parse(content.substring(startIndex, endIndex + 1));

  // usageMetadataを追加
  planData.usageMetadata = result.usageMetadata;

  if (logger) {
    logger.success('Pro: 看護計画生成完了');
  }

  return planData;
}

/**
 * AppSheetのVN_Plan_Problemsテーブルを更新する
 * @param {string} problemId - 問題レコードID
 * @param {Object} planData - 看護計画データ
 * @param {Object} logger - ロガーインスタンス
 */
function updatePlanInAppSheet(problemId, planData, logger = null) {
  if (logger) {
    logger.info('AppSheetテーブル更新開始', { problemId: problemId });
  }

  const solutionsText = `△ 観察項目\n${planData.solutions_observation}\n\n△ 実施項目\n${planData.solutions_implementation}`;

  const rowData = {
    "status": '編集中',
    "problem_id": problemId,
    "problem_statement": planData.problem_statement,
    "goal": planData.goal,
    "solutions": solutionsText
  };

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP" },
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
 * @param {Object} logger - ロガーインスタンス
 */
function updateErrorStatusInAppSheet(problemId, errorMessage, logger = null) {
  if (logger) {
    logger.info('AppSheetエラーステータス更新開始', { problemId: problemId });
  }

  const rowData = {
    "status": 'エラー',
    "problem_id": problemId,
    "error_message": errorMessage.substring(0, 500) // エラーメッセージは500文字まで
  };

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP" },
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
 *
 * 使い方：
 * 1. この関数をGASエディタで開く
 * 2. 下記のパラメータを実際の値に変更
 * 3. 関数を選択して実行
 * 4. ログでFlash-LiteとProのコストを確認
 */
function directProcessCarePlan() {
  // ★★★ 以下のパラメータを実際の値に変更してください ★★★

  const problemId = 'TEST-001'; // 問題レコードID

  const contextText = `
【利用者様基本情報】
氏名: テスト太郎
年齢: 80歳
性別: 男性
診断名: 心不全、糖尿病
ADL: 一部介助必要

【これまでの看護記録】
- 2025/10/20: 血圧140/90、心拍数72回/分。息切れの訴えあり。
- 2025/10/22: 食事摂取量やや低下。水分摂取を促す。
- 2025/10/25: 下肢浮腫（+1）を確認。利尿剤の効果を観察中。
`;

  const problemPoint = '排便コントロール不良'; // 問題点

  const problemIdentifiedDate = '2025-10-26'; // 問題が明らかになった日付

  // ★★★ ここまで ★★★

  console.log('=== 2段階AI処理テスト開始 ===');
  console.log(`Problem ID: ${problemId}`);
  console.log(`問題点: ${problemPoint}`);
  console.log(`日付: ${problemIdentifiedDate}`);
  console.log('');

  try {
    // メイン処理を実行（2段階処理）
    const result = processRequest(problemId, contextText, problemPoint, problemIdentifiedDate);

    console.log('=== 処理成功 ===');
    console.log('');
    console.log('【コスト詳細】');
    console.log(`Flash-Lite: ¥${result.costs.flashLite.totalCostJPY.toFixed(4)} (入力: ${result.costs.flashLite.inputTokens}, 出力: ${result.costs.flashLite.outputTokens})`);
    console.log(`Pro: ¥${result.costs.pro.totalCostJPY.toFixed(4)} (入力: ${result.costs.pro.inputTokens}, 出力: ${result.costs.pro.outputTokens})`);
    console.log(`合計: ¥${result.costs.total.toFixed(4)}`);
    console.log('');
    console.log('【生成された看護計画】');
    console.log(JSON.stringify(result.plan, null, 2));

    return result;

  } catch (error) {
    console.error('=== 処理エラー ===');
    console.error(error.toString());
    console.error(error.stack);

    throw error;
  }
}

/**
 * 直接実行可能な関数（2段階AI生成のみテスト）
 * AppSheet更新をスキップして、AI生成のみをテスト
 * Flash-Lite → Pro の2段階処理を確認
 */
function directTestAIGeneration() {
  // ★★★ 以下のパラメータを実際の値に変更してください ★★★

  const contextText = `
【利用者様基本情報】
氏名: テスト太郎
年齢: 80歳
性別: 男性
診断名: 心不全、糖尿病
ADL: 一部介助必要

【これまでの看護記録】
- 2025/10/20: 血圧140/90、心拍数72回/分。息切れの訴えあり。
- 2025/10/22: 食事摂取量やや低下。水分摂取を促す。
- 2025/10/25: 下肢浮腫（+1）を確認。利尿剤の効果を観察中。
`;

  const problemPoint = '排便コントロール不良';

  const problemIdentifiedDate = '2025-10-26';

  // ★★★ ここまで ★★★

  const logger = createLogger('Appsheet_訪問看護_計画書問題点');

  console.log('=== 2段階AI生成テスト開始 ===');
  console.log(`問題点: ${problemPoint}`);
  console.log(`日付: ${problemIdentifiedDate}`);
  console.log('');

  try {
    // Step 1: Flash-Liteで要点抽出
    console.log('--- Step 1: Flash-Liteで要点抽出 ---');
    const keyPoints = extractKeyPointsWithFlashLite(contextText, problemPoint, problemIdentifiedDate, logger);

    console.log('【抽出された要点】');
    console.log(keyPoints.text);
    console.log('');
    console.log(`Flash-Lite (${keyPoints.usageMetadata.model}):`);
    console.log(`  入力: ${keyPoints.usageMetadata.inputTokens} tokens (¥${keyPoints.usageMetadata.inputCostJPY.toFixed(4)})`);
    console.log(`  出力: ${keyPoints.usageMetadata.outputTokens} tokens (¥${keyPoints.usageMetadata.outputCostJPY.toFixed(4)})`);
    console.log(`  合計: ¥${keyPoints.usageMetadata.totalCostJPY.toFixed(4)}`);
    console.log('');

    // Flash-Liteのコスト記録
    logger.setUsageMetadata(keyPoints.usageMetadata);

    // Step 2: Proで看護計画生成
    console.log('--- Step 2: Proで看護計画生成 ---');
    const plan = generateCarePlanWithPro(keyPoints.text, problemPoint, problemIdentifiedDate, logger);

    console.log('【生成された看護計画】');
    console.log('問題点: ' + plan.problem_statement);
    console.log('目標: ' + plan.goal);
    console.log('観察項目: ' + plan.solutions_observation);
    console.log('実施項目: ' + plan.solutions_implementation);
    console.log('');
    console.log(`Pro (${plan.usageMetadata.model}):`);
    console.log(`  入力: ${plan.usageMetadata.inputTokens} tokens (¥${plan.usageMetadata.inputCostJPY.toFixed(4)})`);
    console.log(`  出力: ${plan.usageMetadata.outputTokens} tokens (¥${plan.usageMetadata.outputCostJPY.toFixed(4)})`);
    console.log(`  合計: ¥${plan.usageMetadata.totalCostJPY.toFixed(4)}`);
    console.log('');

    // Proのコスト記録
    logger.setUsageMetadata(plan.usageMetadata);

    // 合計コスト
    const totalCost = keyPoints.usageMetadata.totalCostJPY + plan.usageMetadata.totalCostJPY;
    console.log('='.repeat(60));
    console.log(`Flash-Lite: ¥${keyPoints.usageMetadata.totalCostJPY.toFixed(4)}`);
    console.log(`Pro:        ¥${plan.usageMetadata.totalCostJPY.toFixed(4)}`);
    console.log(`---`);
    console.log(`合計:       ¥${totalCost.toFixed(4)}`);
    console.log('='.repeat(60));

    // ログ保存
    logger.saveToSpreadsheet('成功', 'TEST-2STAGE-AI');

    return {
      keyPoints: keyPoints,
      plan: plan,
      totalCost: totalCost
    };

  } catch (error) {
    console.error('=== AI生成エラー ===');
    console.error(error.toString());
    console.error(error.stack);

    // エラーログ保存
    logger.error(error.toString());
    logger.saveToSpreadsheet('エラー', 'TEST-2STAGE-AI');

    throw error;
  }
}
