/**
 * 通話関連クエリ処理
 * AppSheetからのWebhookを受け取り、Gemini APIで回答を生成し、AppSheetに書き戻す
 * 
 * @version 2.0.0
 * @date 2025-10-16
 * @description 共通モジュール使用、重複防止機能、スプレッドシートログ対応
 */

/**
 * スクリプト設定
 */
const CONFIG = {
  // スクリプト識別
  SCRIPT_NAME: '通話関連クエリ',
  
  // AppSheet設定
  APP_ID: '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f',
  ACCESS_KEY: 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT',
  TABLE_NAME: 'Call_Queries',
  
  // レコードID列名
  KEY_COLUMN: 'query_id',
  
  // Geminiモデル（標準処理なのでFlash使用）
  USE_PRO_MODEL: false  // false: Flash, true: Pro
};

/**
 * Webhookエントリポイント
 * @param {Object} e - Webhookイベント
 * @return {TextOutput} レスポンス
 */
/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_通話_クエリ';
    return processRequest(params.queryId || params.data?.queryId, params.promptText || params.data?.promptText, params.callSummary || params.data?.callSummary, params.callTranscript || params.data?.callTranscript, params.call_info || params.data?.call_info, params.modelKeyword || params.data?.modelKeyword);
  });
}

/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(queryId, promptText, callSummary, callTranscript, call_info, modelKeyword) {
  // ロガー初期化
  const logger = createLogger(CONFIG.SCRIPT_NAME);
  logger.info('=== Webhook受信 ===');
  
  let recordId = null;
  let status = '成功';
  
  try {
    // パラメータ情報をログ出力
    logger.info('リクエストパース成功', {
      queryId: queryId,
      hasPrompt: !!promptText
    });
    
    recordId = queryId;
    
    // 必須パラメータチェック
    if (!recordId || !promptText) {
      throw new Error('必須パラメータ不足: queryId, promptText が必要です');
    }
    
    // 重複実行防止
    const dupPrevention = createDuplicationPrevention(CONFIG.SCRIPT_NAME);
    const result = dupPrevention.executeWithRetry(recordId, (id) => {
      return processQuery(id, params, logger);
    }, logger);
    
    // 重複チェック結果
    if (result.isDuplicate) {
      status = '重複';
      logger.warning('重複実行を検出しました');
      return ContentService.createTextOutput('DUPLICATE').setMimeType(ContentService.MimeType.TEXT);
    }
    
    if (!result.success) {
      status = 'エラー';
      throw new Error(result.error);
    }
    
    logger.success('処理完了');
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
    
  } catch (error) {
    status = 'エラー';
    logger.error(`処理エラー: ${error.toString()}`, { stack: error.stack });
    
    // AppSheetにエラーステータスを反映
    if (recordId) {
      try {
        const appsheet = createAppSheetClient(CONFIG.APP_ID, CONFIG.ACCESS_KEY);
        appsheet.updateErrorStatus(
          CONFIG.TABLE_NAME,
          recordId,
          CONFIG.KEY_COLUMN,
          error.toString(),
          'status',
          'error_details',
          logger
        );
      } catch (updateError) {
        logger.error(`エラーステータス更新失敗: ${updateError.toString()}`);
      }
    }
    
    return ContentService.createTextOutput('ERROR').setMimeType(ContentService.MimeType.TEXT);
    
  } finally {
    // ログをスプレッドシートに保存
    logger.saveToSpreadsheet(status, recordId);
  }
}

/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  // TODO: テストデータを設定してください
  const testParams = {
    // 例: action: "test",
    // 例: data: "sample"
  };

  return CommonTest.runTest((params) => processRequest(params.queryId, params.promptText, params.callSummary, params.callTranscript, params.call_info, params.modelKeyword), testParams, 'Appsheet_通話_クエリ');
}

/**
 * クエリ処理メイン
 * @param {string} queryId - クエリID
 * @param {Object} params - リクエストパラメータ
 * @param {Object} logger - ロガー
 * @return {string} 生成された回答
 */
function processQuery(queryId, params, logger) {
  logger.info(`クエリ処理開始: ${queryId}`);
  
  const { promptText, callSummary, callTranscript, call_info, modelKeyword } = params;
  
  // モデル選択
  const usePro = modelKeyword === 'しっかり' || CONFIG.USE_PRO_MODEL;
  logger.info(`使用モデル (Vertex AI): ${usePro ? 'gemini-2.5-pro' : 'gemini-2.5-flash'} + 思考モード`);
  
  // Vertex AIクライアント作成
  const gemini = usePro ? 
    createGeminiProClient({ temperature: 0.3, maxOutputTokens: 20000, enableThinking: true, thinkingBudget: -1 }) :
    createGeminiFlashClient({ temperature: 0.3, maxOutputTokens: 20000, enableThinking: true, thinkingBudget: -1 });
  
  // プロンプト構築
  const prompt = buildPrompt(promptText, callSummary, callTranscript, call_info);
  logger.info(`プロンプト構築完了（${prompt.length}文字）`);
  
  // Gemini APIで回答生成
  const response = gemini.generateText(prompt, logger);
  const answer = response.text;

  // API使用量情報をloggerに記録
  if (response.usageMetadata) {
    logger.setUsageMetadata(response.usageMetadata);
  }

  if (!answer) {
    throw new Error('AIからの応答が空です');
  }

  logger.info(`回答生成成功（${answer.length}文字）`);
  
  // AppSheetに書き戻し
  const appsheet = createAppSheetClient(CONFIG.APP_ID, CONFIG.ACCESS_KEY);
  appsheet.updateSuccessStatus(
    CONFIG.TABLE_NAME,
    queryId,
    CONFIG.KEY_COLUMN,
    { response_text: answer },
    'status',
    logger
  );
  
  return answer;
}

/**
 * プロンプト構築
 * @param {string} promptText - ユーザーの質問
 * @param {string} callSummary - 通話要約
 * @param {string} callTranscript - 通話文字起こし
 * @param {string} callInfo - 通話関連情報
 * @return {string} 構築されたプロンプト
 */
function buildPrompt(promptText, callSummary, callTranscript, callInfo) {
  return `
# 指示
以下の#参照情報に基づいて、#ユーザーからの質問に的確に回答してください。
**重要: 回答には「はい、わかりました」などの前置きや挨拶を含めず、質問に対する答えそのものだけを生成してください。**

# 参照情報
## 通話の要約
${callSummary || '要約はありません。'}

## 通話の全文文字起こし
${callTranscript || '全文文字起こしはありません。'}

## 通話関連情報
${callInfo || '関連する通話はありません。'}

---
# ユーザーからの質問
${promptText}
`.trim();
}

/**
 * テスト実行用関数
 */
function testQuery() {
  const logger = createLogger('TEST_' + CONFIG.SCRIPT_NAME);
  
  const testParams = {
    queryId: 'test_' + new Date().getTime(),
    promptText: 'テスト質問: 通話の主な内容は何ですか？',
    callSummary: 'これはテスト用の要約です。',
    callTranscript: 'これはテスト用の文字起こしです。',
    call_info: 'これはテスト用の関連情報です。',
    modelKeyword: 'はやい'
  };
  
  try {
    const result = processQuery(testParams.queryId, testParams, logger);
    logger.success('テスト実行成功');
    logger.info('生成結果:', { result: result });
  } catch (error) {
    logger.error('テスト実行失敗', { error: error.toString() });
  } finally {
    logger.saveToSpreadsheet('テスト', testParams.queryId);
  }
}
