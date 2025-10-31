/**
 * main.gs - 医療機関向け報告書生成（2段階AI処理）
 *
 * AppSheetからの訪問看護記録をもとに、
 * Flash-Liteで要点抽出 → Proで報告書生成
 *
 * @version 3.0.0
 * @date 2025-10-31
 */

// AppSheet設定
const APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';
const ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';
const TABLE_NAME = 'VN_Reports';

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベント
 * @return {GoogleAppsScript.Content.TextOutput} - JSONレスポンス
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_訪問看護_報告書';
    return processRequest(
      params.reportId || params.data?.reportId,
      params.clientName || params.data?.clientName,
      params.targetMonth || params.data?.targetMonth,
      params.visitRecords || params.data?.visitRecords,
      params.staffId || params.data?.staffId
    );
  });
}

/**
 * メイン処理関数（2段階処理：Flash-Lite → Pro）
 * 各モデルのコストを個別の行としてスプレッドシートに記録
 * @param {string} reportId - 報告書ID
 * @param {string} clientName - 利用者名
 * @param {string} targetMonth - 対象月
 * @param {string} visitRecords - 訪問記録テキスト
 * @param {string} staffId - スタッフID
 * @returns {Object} - 処理結果
 */
function processRequest(reportId, clientName, targetMonth, visitRecords, staffId) {
  const mainLogger = createLogger('Appsheet_訪問看護_報告書');

  try {
    mainLogger.info('=== 2段階AI処理開始（報告書生成） ===', { reportId: reportId });

    // パラメータ検証
    if (!reportId || !clientName || !targetMonth || !visitRecords) {
      throw new Error("必須パラメータ（reportId, clientName, targetMonth, visitRecords）が不足しています。");
    }

    mainLogger.info(`処理開始: Report ID = ${reportId}, 利用者 = ${clientName}, 対象月 = ${targetMonth}`);

    // ========================================
    // Step 1: Flash-Liteで要点抽出
    // ========================================
    mainLogger.info('--- Step 1: Flash-Liteで要点抽出 ---');

    // Flash-Lite専用のloggerを作成
    const flashLiteLogger = createLogger('Appsheet_訪問看護_報告書');
    let flashLiteStatus = '成功';

    let keyPoints;
    try {
      keyPoints = extractKeyPointsWithFlashLite(clientName, targetMonth, visitRecords, flashLiteLogger);

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
      flashLiteLogger.saveToSpreadsheet(flashLiteStatus, reportId);
    }

    // ========================================
    // Step 2: Proで報告書生成
    // ========================================
    mainLogger.info('--- Step 2: Proで報告書生成 ---');

    // Pro専用のloggerを作成
    const proLogger = createLogger('Appsheet_訪問看護_報告書');
    let proStatus = '成功';

    let reportText;
    try {
      reportText = generateReportWithPro(keyPoints.text, clientName, targetMonth, proLogger);

      if (!reportText) {
        throw new Error("Proからの応答が空でした。");
      }

      // Proのコストを記録
      const proUsageMetadata = reportText.usageMetadata;
      if (proUsageMetadata) {
        proLogger.setUsageMetadata(proUsageMetadata);
        mainLogger.info(`Pro (${proUsageMetadata.model}):`, {
          inputTokens: proUsageMetadata.inputTokens,
          inputCost: `¥${proUsageMetadata.inputCostJPY.toFixed(4)}`,
          outputTokens: proUsageMetadata.outputTokens,
          outputCost: `¥${proUsageMetadata.outputCostJPY.toFixed(4)}`,
          totalCost: `¥${proUsageMetadata.totalCostJPY.toFixed(4)}`
        });
      }

      proLogger.success('Pro: 報告書生成完了');
      mainLogger.info('報告書生成完了', {
        reportLength: reportText.text.length
      });

    } catch (error) {
      proStatus = 'エラー';
      proLogger.error(`Proエラー: ${error.toString()}`, { stack: error.stack });
      throw error;
    } finally {
      // Proのログを個別に保存
      proLogger.saveToSpreadsheet(proStatus, reportId);
    }

    // 合計コスト計算とコンソール出力
    const totalCost = (keyPoints.usageMetadata?.totalCostJPY || 0) + (reportText.usageMetadata?.totalCostJPY || 0);
    mainLogger.info(`=== 2段階処理完了 ===`);
    mainLogger.info('コスト合計:', {
      flashLiteModel: keyPoints.usageMetadata?.model || 'N/A',
      flashLiteCost: `¥${keyPoints.usageMetadata?.totalCostJPY.toFixed(4) || '0.0000'}`,
      proModel: reportText.usageMetadata?.model || 'N/A',
      proCost: `¥${reportText.usageMetadata?.totalCostJPY.toFixed(4) || '0.0000'}`,
      total: `¥${totalCost.toFixed(4)}`
    });

    // ========================================
    // Step 3: AppSheetテーブルを更新
    // ========================================
    updateReportInAppSheet(reportId, reportText.text, staffId, mainLogger);

    mainLogger.success(`処理完了。ID ${reportId} の報告書を更新しました。`);

    return {
      success: true,
      reportId: reportId,
      reportText: reportText.text,
      costs: {
        flashLite: keyPoints.usageMetadata,
        pro: reportText.usageMetadata,
        total: totalCost
      }
    };

  } catch (error) {
    mainLogger.error(`エラーが発生しました: ${error.toString()}`, {
      reportId: reportId,
      stack: error.stack
    });

    // AppSheetにエラーステータス更新
    if (reportId) {
      try {
        updateErrorStatusInAppSheet(reportId, error.toString(), staffId, mainLogger);
      } catch (updateError) {
        mainLogger.error(`エラーステータス更新失敗: ${updateError.toString()}`);
      }
    }

    throw error;
  }
}

/**
 * Step 1: Flash-Liteで要点抽出
 * 訪問記録から報告書作成に必要な重要情報を抽出
 * @param {string} clientName - 利用者名
 * @param {string} targetMonth - 対象月
 * @param {string} visitRecords - 訪問記録テキスト
 * @param {Object} logger - ロガーインスタンス
 * @return {Object} {text: 抽出された要点, usageMetadata: 使用量情報}
 */
function extractKeyPointsWithFlashLite(clientName, targetMonth, visitRecords, logger = null) {
  if (logger) {
    logger.info('Flash-Lite: 要点抽出開始');
  }

  const prompt = `
あなたは、訪問看護記録を分析する専門家です。

以下の#訪問記録から、医療機関向け報告書の作成に必要な重要情報を抽出してください。

# 訪問記録

利用者名: ${clientName}
対象月: ${targetMonth}

${visitRecords}

# 抽出指示

以下の観点から、報告書作成に必要な情報を**箇条書き形式**で抽出してください：

1. **バイタルサイン**: BT（体温）、BP（血圧）、P（脈拍）、SpO2、BS（血糖値）の最小値～最大値
2. **全身状態**: 意識レベル、活動性、食事摂取、水分摂取、睡眠状況など
3. **主要な症状・問題点**: 痛み、浮腫、呼吸状態、排泄状況、皮膚トラブルなど
4. **実施されたケア**: 処置、投薬確認、リハビリ、生活支援など
5. **重要なエピソード**: 利用者やご家族の発言、状態変化、特記事項など

**重要**:
- 抽象的な表現は避け、記録に記載された具体的な数値や状態を抽出してください
- 「テア」「スキンテア」は「表皮剥離」と表記してください
- 報告書の作成に必要な情報を漏れなく抽出してください
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
 * Step 2: Proで報告書生成
 * Flash-Liteで抽出された要点から、医療機関向け報告書を生成
 * @param {string} keyPoints - Flash-Liteで抽出された要点
 * @param {string} clientName - 利用者名
 * @param {string} targetMonth - 対象月
 * @param {Object} logger - ロガーインスタンス
 * @return {Object} {text: 生成された報告書, usageMetadata: 使用量情報}
 */
function generateReportWithPro(keyPoints, clientName, targetMonth, logger = null) {
  if (logger) {
    logger.info('Pro: 報告書生成開始');
  }

  const prompt = `
あなたは、${clientName}さまの多様な情報を分析し、医療機関向けの要点を押さえつつ、現場感のある構造的な報告書を生成するプロフェッショナルです。

# 前提条件

あなたは経験豊富な訪問看護師の視点を持ち、報告先の医療機関が利用者の状態変化や重要なポイントを正確に把握できるよう配慮します。

提供された資料から、報告すべき最優先事項を的確に判断し、重要な経緯や観察内容は省略せずに要約する能力があります。

# 抽出された要点

${keyPoints}

# 実行タスク

提供された要点を基に、${targetMonth}における${clientName}様の状態報告書を、医療機関向けに作成してください。

# 出力形式と構成

以下の構成と指示に従い、報告書を作成してください。

1.  **冒頭の挨拶**

    「いつもお世話になっております。」

2.  **報告の主旨**

    「${clientName}様の、${targetMonth}の状態報告をさせていただきます。」

3.  **バイタルサイン**

    抽出された要点から、各項目ごとに最小値～最大値で配置すること。

    [順序の指示] 記載する順番は「BT(体温)」「BP(血圧)」「P(脈拍)」「SpO2」の順とし、BS(血糖値)の記録がある場合は最後に記載してください。

    （例: BT:36.6～36.8℃ BP:100～132/56～76mmHg P:64～84回/分 SpO2:97～99% BS:150～152）改行せず一行とすること。

4.  **主要トピックの要約**

    （ここから下の項目は、見出しを出力せず、内容のみを記載してください）

    -   他に報告すべき重要な事項があれば補足し、全体で最大5つのトピックにまとめてください。

    -   抽出したトピックの中に「全身状態」に関するものが含まれる場合は、必ずそれを一番初めに配置してください。

    -   見出しは必ず使用し、体言止め（名詞形）のシンプルな単語（例：全身状態、皮膚状態、排泄状況）にしてください。

    -   各トピックは、『現在の状態』と『現在の対応』に焦点を当てて記述してください。

    -   「ご家族から〜とのお話あり」「〜と発語された」のような、具体的なエピソードや会話を効果的に引用してください。

    -   「〜で対応しています」「〜な状況です」といった、現場感のある適切な表現を用いてください。

    -   特に『皮膚状態』のトピックでは、問題のある部位ごとに、その状態と処置方法が明確にわかるように記述してください。（例）・右前腕：表皮剥離あり。ゲンタシン塗布＋絆創膏で保護。

    -   各トピックは、3〜4文程度の文章量で記述してください。

5.  **結びの挨拶**

    「以上となります。
ご確認よろしくお願いいたします。」

# 遵守事項

-   報告書全体が冗長にならないよう意識しつつも、必要な情報やニュアンスは省略しないでください。

-   客観的な事実に基づき、専門的かつ分かりやすい言葉で記述してください。

-   提供された要点に記載されている情報のみを忠実に反映させてください。

-   マークダウン記法は一切使用しないでください。
`;

  // Proクライアント作成
  const proClient = createVertexAIProClient({
    temperature: 0.2,
    maxOutputTokens: 8192
  });

  // テキスト生成
  const result = proClient.generateText(prompt, logger);

  if (logger) {
    logger.success('Pro: 報告書生成完了');
  }

  return {
    text: result.text,
    usageMetadata: result.usageMetadata
  };
}

/**
 * AppSheetのVN_Reportsテーブルを更新する
 * @param {string} reportId - 報告書ID
 * @param {string} reportText - 報告書テキスト
 * @param {string} staffId - スタッフID
 * @param {Object} logger - ロガーインスタンス
 */
function updateReportInAppSheet(reportId, reportText, staffId, logger = null) {
  if (logger) {
    logger.info('AppSheetテーブル更新開始', { reportId: reportId });
  }

  const now = new Date();
  const formattedDateTime = Utilities.formatDate(now, "JST", "yyyy-MM-dd HH:mm:ss");

  const rowData = {
    "report_id": reportId,
    "symptom_progress": reportText,
    "status": '生成済み',
    "updated_at": formattedDateTime,
    "updated_by": staffId || 'system'
  };

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [rowData]
  };

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${TABLE_NAME}/Action`;

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
 * AppSheetのVN_Reportsテーブルにエラーステータスを記録
 * @param {string} reportId - 報告書ID
 * @param {string} errorMessage - エラーメッセージ
 * @param {string} staffId - スタッフID
 * @param {Object} logger - ロガーインスタンス
 */
function updateErrorStatusInAppSheet(reportId, errorMessage, staffId, logger = null) {
  if (logger) {
    logger.info('AppSheetエラーステータス更新開始', { reportId: reportId });
  }

  const now = new Date();
  const formattedDateTime = Utilities.formatDate(now, "JST", "yyyy-MM-dd HH:mm:ss");

  const rowData = {
    "report_id": reportId,
    "status": 'エラー',
    "error_details": errorMessage.substring(0, 500),
    "updated_at": formattedDateTime,
    "updated_by": staffId || 'system'
  };

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [rowData]
  };

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${TABLE_NAME}/Action`;

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
 * テスト用関数（推奨）
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  const testParams = {
    reportId: 'TEST-REPORT-001',
    clientName: '山田太郎',
    targetMonth: '2025年10月',
    visitRecords: `
10/1訪問: BT36.5℃ BP120/70mmHg P72回/分 SpO2 98%。全身状態良好。食事摂取良好。
10/5訪問: BT36.7℃ BP130/75mmHg P78回/分 SpO2 97%。右前腕に表皮剥離あり、ゲンタシン塗布。
10/10訪問: BT36.6℃ BP125/72mmHg P70回/分 SpO2 98%。排便あり、普通便。水分摂取促す。
10/15訪問: BT36.8℃ BP132/76mmHg P84回/分 SpO2 99%。「調子が良い」と発語。ご家族から「よく眠れている」とのお話あり。
    `,
    staffId: 'test@fractal-group.co.jp'
  };

  return CommonTest.runTest(
    (params) => processRequest(
      params.reportId,
      params.clientName,
      params.targetMonth,
      params.visitRecords,
      params.staffId
    ),
    testParams,
    'Appsheet_訪問看護_報告書'
  );
}

/**
 * 直接実行可能な関数（2段階処理テスト用）
 * GASエディタから引数を設定して直接実行できる
 */
function directTestReport() {
  // ★★★ 以下のパラメータを実際の値に変更してください ★★★

  const reportId = 'TEST-REPORT-001';
  const clientName = '山田太郎';
  const targetMonth = '2025年10月';
  const visitRecords = `
10/1訪問: BT36.5℃ BP120/70mmHg P72回/分 SpO2 98%。全身状態良好。食事摂取良好。
10/5訪問: BT36.7℃ BP130/75mmHg P78回/分 SpO2 97%。右前腕に表皮剥離あり、ゲンタシン塗布。
10/10訪問: BT36.6℃ BP125/72mmHg P70回/分 SpO2 98%。排便あり、普通便。水分摂取促す。
10/15訪問: BT36.8℃ BP132/76mmHg P84回/分 SpO2 99%。「調子が良い」と発語。ご家族から「よく眠れている」とのお話あり。
  `;
  const staffId = 'test@fractal-group.co.jp';

  // ★★★ ここまで ★★★

  console.log('=== 2段階AI処理テスト開始（報告書生成） ===');
  console.log(`Report ID: ${reportId}`);
  console.log(`利用者: ${clientName}`);
  console.log(`対象月: ${targetMonth}`);
  console.log('');

  try {
    // メイン処理を実行（2段階処理）
    const result = processRequest(reportId, clientName, targetMonth, visitRecords, staffId);

    console.log('=== 処理成功 ===');
    console.log('');
    console.log('【コスト詳細】');
    console.log(`Flash-Lite: ¥${result.costs.flashLite.totalCostJPY.toFixed(4)} (入力: ${result.costs.flashLite.inputTokens}, 出力: ${result.costs.flashLite.outputTokens})`);
    console.log(`Pro: ¥${result.costs.pro.totalCostJPY.toFixed(4)} (入力: ${result.costs.pro.inputTokens}, 出力: ${result.costs.pro.outputTokens})`);
    console.log(`合計: ¥${result.costs.total.toFixed(4)}`);
    console.log('');
    console.log('【生成された報告書】');
    console.log(result.reportText);

    return result;

  } catch (error) {
    console.error('=== 処理エラー ===');
    console.error(error.toString());
    console.error(error.stack);

    throw error;
  }
}
