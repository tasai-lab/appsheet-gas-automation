/**
 * 質疑応答サービスモジュール
 * Vertex AI (gemini-2.5-flash) を使用してテキストベースの質問に回答
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-22
 */

/**
 * 質疑応答のメイン処理（個別引数版）
 * 利用者情報と参照データを基に、ユーザーの質問に回答する
 *
 * @param {string} queryId - クエリID（一意の識別子）
 * @param {string} promptText - ユーザーからの質問文
 * @param {string} userInfoText - 利用者情報（背景情報）
 * @param {string} referenceDataText - 参照データ（関連情報）
 * @return {Object} {success, queryId, answer, processingTime, usageMetadata}
 */
function answerQueryDirect(queryId, promptText, userInfoText, referenceDataText) {
  const timer = new ExecutionTimer();
  const config = getConfig();

  Logger.log(`[質疑応答開始] Query ID: ${queryId}`);
  Logger.log(`[質疑応答] 質問: ${promptText}`);

  // パラメータ検証
  if (!queryId || !promptText) {
    throw new Error('必須パラメータが不足: queryId, promptText');
  }

  // Vertex AIで回答生成
  const result = answerQueryWithVertexAI(
    promptText,
    userInfoText || '',
    referenceDataText || '',
    config
  );

  const processingTime = timer.getElapsedSeconds();

  Logger.log(`[質疑応答完了] Query ID: ${queryId}, 処理時間: ${processingTime}秒`);

  // 実行ログに記録
  logSuccess(queryId, {
    query: promptText.substring(0, 100) + '...',
    answerLength: result.answer.length,
    processingTime: processingTime,
    modelName: config.vertexAIModel,
    inputTokens: result.usageMetadata ? result.usageMetadata.inputTokens : '',
    outputTokens: result.usageMetadata ? result.usageMetadata.outputTokens : '',
    totalCost: result.usageMetadata ? result.usageMetadata.totalCostJPY.toFixed(2) : ''
  });

  return {
    success: true,
    queryId: queryId,
    answer: result.answer,
    processingTime: processingTime,
    usageMetadata: result.usageMetadata
  };
}

/**
 * Vertex AIで質疑応答を実行（テキストモード）
 *
 * @param {string} promptText - ユーザーからの質問文
 * @param {string} userInfoText - 利用者情報（背景情報）
 * @param {string} referenceDataText - 参照データ（関連情報）
 * @param {Object} config - 設定オブジェクト
 * @return {Object} {answer, usageMetadata}
 */
function answerQueryWithVertexAI(promptText, userInfoText, referenceDataText, config) {
  // プロンプト生成
  const fullPrompt = generateQueryPrompt(promptText, userInfoText, referenceDataText);

  Logger.log(`[Vertex AI] テキストモードで質疑応答を実行`);
  Logger.log(`[Vertex AI] モデル: ${config.vertexAIModel}`);

  // Vertex AI API呼び出し（テキストモード）
  const apiResponse = callVertexAIForTextQuery(fullPrompt, config);

  // レスポンスからテキストを抽出
  const result = extractTextFromVertexAIResponse(apiResponse);

  // usageMetadataを抽出（モデル名と入力タイプ='text'を渡す）
  const jsonResponse = JSON.parse(apiResponse);
  const usageMetadata = extractVertexAIUsageMetadata(jsonResponse, config.vertexAIModel, 'text');
  result.usageMetadata = usageMetadata;

  Logger.log(`[Vertex AI] 回答生成完了 (回答長: ${result.answer.length}文字)`);
  if (usageMetadata) {
    Logger.log(`[Vertex AI] 使用量: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
  }

  return result;
}

/**
 * 質疑応答用のプロンプトを生成
 *
 * @param {string} promptText - ユーザーからの質問文
 * @param {string} userInfoText - 利用者情報（背景情報）
 * @param {string} referenceDataText - 参照データ（関連情報）
 * @return {string} 完全なプロンプト
 */
function generateQueryPrompt(promptText, userInfoText, referenceDataText) {
  let prompt = '# 指示\n\n以下の情報を参考に、ユーザーの質問に正確かつ簡潔に回答してください。\n\n';

  // 利用者情報セクション
  if (userInfoText && userInfoText.trim() !== '') {
    prompt += '## 利用者情報\n\n' + userInfoText + '\n\n';
  }

  // 参照データセクション
  if (referenceDataText && referenceDataText.trim() !== '') {
    prompt += '## 参照データ\n\n' + referenceDataText + '\n\n';
  }

  // 質問セクション
  prompt += '## ユーザーの質問\n\n' + promptText + '\n\n';

  // 回答形式の指示
  prompt += `# 回答形式

以下のルールに従って回答してください:

1. **正確性**: 提供された情報に基づいて正確に回答する
2. **簡潔性**: 要点を明確に、過度に長くならないように
3. **構造化**: 必要に応じて箇条書きや見出しを使用
4. **推測の明示**: 情報が不足している場合は「不明」と明記
5. **Markdown形式**: 適切にMarkdown記法を使用して読みやすく

医療・介護分野の専門用語は正しく使用してください:
- ADL: 日常生活動作
- バイタルサイン: 生命徴候（血圧、脈拍、体温、呼吸など）
- ケアマネジャー: 介護支援専門員
- サービス担当者会議: 多職種連携のための会議

# 回答

上記の情報を踏まえて、質問に回答してください。`;

  return prompt;
}

/**
 * Vertex AI APIをテキストモードで呼び出し
 *
 * @param {string} promptText - プロンプトテキスト
 * @param {Object} config - 設定オブジェクト
 * @return {string} APIレスポンス（JSON文字列）
 */
function callVertexAIForTextQuery(promptText, config) {
  // エンドポイントURL構築
  const endpoint = `https://${config.gcpLocation}-aiplatform.googleapis.com/v1/projects/${config.gcpProjectId}/locations/${config.gcpLocation}/publishers/google/models/${config.vertexAIModel}:generateContent`;

  // リクエストボディ構築
  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{ text: promptText }]
    }],
    generationConfig: {
      temperature: config.temperature,
      topP: config.topP,
      topK: config.topK,
      maxOutputTokens: config.maxOutputTokens
    }
  };

  // API呼び出しオプション
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    headers: {
      'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
    },
    muteHttpExceptions: true
  };

  // API実行
  Logger.log('[Vertex AI] API呼び出し開始（テキストモード）');
  const response = UrlFetchApp.fetch(endpoint, options);
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  // ステータスコードチェック
  if (statusCode !== 200) {
    Logger.log(`[Vertex AI] APIエラー: ${statusCode}\n${responseText}`);
    throw new Error(
      `Vertex AI APIエラー (HTTP ${statusCode})\n` +
      `詳細はログを確認してください`
    );
  }

  Logger.log(`[Vertex AI] API呼び出し成功 (レスポンス: ${responseText.length}文字)`);
  return responseText;
}

/**
 * Vertex AIレスポンスからテキストを抽出
 *
 * @param {string} responseText - APIレスポンステキスト
 * @return {Object} {answer}
 */
function extractTextFromVertexAIResponse(responseText) {
  let jsonResponse;

  // JSONパース
  try {
    jsonResponse = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`APIレスポンスのJSON解析失敗: ${error.message}`);
  }

  // 候補(candidates)チェック
  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    let errorMsg = 'AIからの有効な応答がありません';
    if (jsonResponse.promptFeedback && jsonResponse.promptFeedback.blockReason) {
      errorMsg += ` [ブロック理由: ${jsonResponse.promptFeedback.blockReason}]`;
    }
    if (jsonResponse.error) {
      errorMsg += ` [APIエラー: ${jsonResponse.error.message}]`;
    }
    throw new Error(errorMsg);
  }

  // コンテンツチェック
  const candidate = jsonResponse.candidates[0];
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    let errorMsg = 'AIの応答にコンテンツがありません';
    if (candidate.finishReason) {
      errorMsg += ` [終了理由: ${candidate.finishReason}]`;
      if (candidate.finishReason === 'MAX_TOKENS') {
        errorMsg += ' (トークン上限到達)';
      } else if (candidate.finishReason === 'SAFETY') {
        errorMsg += ' (セーフティフィルターによるブロック)';
      }
    }
    throw new Error(errorMsg);
  }

  const answerText = candidate.content.parts[0].text;

  Logger.log(`[Vertex AI] テキスト抽出成功 (${answerText.length}文字)`);

  return {
    answer: answerText
  };
}
