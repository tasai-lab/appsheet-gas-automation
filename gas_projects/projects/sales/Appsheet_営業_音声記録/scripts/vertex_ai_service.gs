/**
 * Vertex AI音声解析モジュール（最適化版 v2.0）
 * - 1回のAPI呼び出しで要約+全文+アクション+依頼情報を取得
 * - base64 inlineData使用でCloud Storageのオーバーヘッド削減
 * - コスト削減: 約28%（API呼び出し2回→1回、Storage料金ゼロ）
 * 
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-17
 */

/**
 * Vertex AIで音声ファイルを解析（統合版）
 * 要約、全文、アクション、依頼情報を1回のAPI呼び出しで取得
 * 
 * @param {string} fileId - Google DriveのファイルID
 * @param {string} callDatetime - 通話日時 (ISO 8601形式)
 * @param {string} callContextText - 通話の背景情報
 * @param {string} userInfoText - 利用者・関係機関の事前情報
 * @param {Object} config - 設定オブジェクト
 * @param {Object} requestOptions - 依頼情報のオプション
 * @return {Object} {summary, transcript, actions, request_details, fileSize}
 */
function analyzeAudioWithVertexAI(fileId, callDatetime, callContextText, userInfoText, config, requestOptions = {}) {
  // ファイル取得とMIMEタイプ判定
  const audioFile = getAudioFile(fileId);
  const fileSizeMB = (audioFile.blob.getBytes().length / 1024 / 1024).toFixed(2);
  Logger.log(`[Vertex AI] ファイルサイズ: ${fileSizeMB}MB`);

  // ファイルサイズチェック（20MB制限）
  if (fileSizeMB > 20) {
    throw new Error(`ファイルサイズが大きすぎます: ${fileSizeMB}MB（上限20MB）`);
  }

  // 依頼情報抽出の設定
  const includeRequestDetails = requestOptions.enable !== false; // デフォルトtrue
  const existingRequest = requestOptions.existingRequest || null;

  // プロンプト生成（統合版）
  const prompt = generateUnifiedPrompt(
    callDatetime, 
    callContextText, 
    userInfoText, 
    includeRequestDetails, 
    existingRequest
  );

  // Vertex AI APIリクエスト（inlineData使用）
  Logger.log('[Vertex AI] base64 inlineData で処理開始');
  const apiResponse = callVertexAIAPIWithInlineData(audioFile, prompt, config);

  // JSON抽出と検証
  const result = extractAndValidateJSON(apiResponse, includeRequestDetails);

  // ファイルサイズ情報を追加
  result.fileSize = `${fileSizeMB}MB`;

  Logger.log(`[Vertex AI] 解析完了 - アクション: ${result.actions.length}件, 依頼情報: ${result.request_details ? 'あり' : 'なし'}`);

  return result;
}

/**
 * 音声ファイルを取得してMIMEタイプを判定
 */
function getAudioFile(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const fileName = file.getName();
    
    // 拡張子からMIMEタイプを判定
    const mimeType = determineMimeType(fileName, blob);
    
    return {
      blob: blob,
      fileName: fileName,
      mimeType: mimeType
    };
  } catch (error) {
    throw new Error(`ファイル取得エラー: ${error.message}`);
  }
}

/**
 * ファイル名と拡張子からMIMEタイプを判定
 */
function determineMimeType(fileName, blob) {
  const extension = fileName.includes('.') 
    ? fileName.split('.').pop().toLowerCase() 
    : '';
  
  const mimeTypeMap = {
    'm4a': 'audio/mp4',
    'mp4': 'audio/mp4',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    '3gp': 'video/3gpp',
    '3gpp': 'video/3gpp'
  };
  
  let mimeType = mimeTypeMap[extension];
  
  // マップになければBlobのMIMEタイプを使用
  if (!mimeType) {
    mimeType = blob.getContentType();
  }
  
  // 音声/動画形式チェック
  if (!mimeType || (!mimeType.startsWith('audio/') && !mimeType.startsWith('video/'))) {
    throw new Error(
      `非対応のファイル形式: ${fileName} (MIME Type: ${mimeType})\n` +
      `対応形式: m4a, mp3, wav, ogg, flac, 3gp`
    );
  }
  
  return mimeType;
}

/**
 * 統合プロンプトを生成（要約+全文+アクション+依頼情報）
 */
function generateUnifiedPrompt(callDatetime, callContextText, userInfoText, includeRequestDetails = true, existingRequest = null) {
  const date = new Date(callDatetime);
  const formattedDate = Utilities.formatDate(date, "Asia/Tokyo", "yyyy/MM/dd(E) HH:mm");

  const userInfoSection = userInfoText 
    ? `# 利用者・関係機関の事前情報\n${userInfoText}\n\n`
    : '';

  const contextSection = callContextText
    ? `# この通話に関する背景情報\n${callContextText}\n\n`
    : '';

  // 依頼情報の抽出指示を条件付きで追加
  let requestSection = '';
  let jsonSchema = '';
  
  if (includeRequestDetails) {
    if (existingRequest) {
      // 既存依頼の更新
      requestSection = `
# 依頼情報の更新（既存依頼あり）

以下の既存の依頼情報を、今回の通話内容で得られた新しい情報で更新してください:

- **依頼理由**: ${existingRequest.request_reason || '未記載'}
- **利用者情報**: ${existingRequest.client_info_temp || '未記載'}
- **次回アクション**: ${existingRequest.next_action_details || '未記載'}

変更がない項目は既存の情報を維持してください。
`;
      jsonSchema = `
{
  "summary": "Markdown形式の要約（文字列型、必須）",
  "transcript": "話者別の全文文字起こし（文字列型、必須）",
  "actions": [アクション配列（配列型、必須、空配列可）],
  "request_details": {
    "priority": "最新の状況を反映した緊急度を「高」「中」「低」で再判断",
    "request_type": "最新の状況を反映した依頼の種類を「相談案件」「新規依頼」で再判断",
    "request_reason": "最新の状況を反映した依頼の経緯や理由",
    "client_name_temp": "変更があれば更新、なければ既存のまま",
    "client_info_temp": "最新の状況を反映した利用者情報の箇条書きテキスト",
    "next_action_date": "最新の状況を反映した次回対応日をYYYY-MM-DD形式で推測(不明ならnull)",
    "next_action_details": "最新の状況を反映した次回アクションの内容",
    "service_start_date": "最新の状況を反映したサービス開始希望日をYYYY-MM-DD形式で推測(不明ならnull)"
  }
}`;
    } else {
      // 新規依頼の作成
      requestSection = `
# 依頼情報の抽出（新規依頼）

この通話から「訪問看護依頼」に関する情報を抽出してください:

- **client_name_temp**: 依頼対象の利用者名が分かれば記載。不明なら「通話相手からのご依頼」と記載
- 該当する情報がない場合はnullを設定
`;
      jsonSchema = `
{
  "summary": "Markdown形式の要約（文字列型、必須）",
  "transcript": "話者別の全文文字起こし（文字列型、必須）",
  "actions": [アクション配列（配列型、必須、空配列可）],
  "request_details": {
    "priority": "依頼の緊急度を「高」「中」「低」で判断",
    "request_type": "依頼の種類を「相談案件」「新規依頼」で判断",
    "request_reason": "依頼の経緯や理由を要約",
    "client_name_temp": "依頼対象の利用者名（不明なら「通話相手からのご依頼」）",
    "client_info_temp": "新規利用者に関する情報を箇条書きテキストで要約",
    "next_action_date": "次回対応すべき日付をYYYY-MM-DD形式で推測(不明ならnull)",
    "next_action_details": "次に行うべきアクションの内容",
    "service_start_date": "サービス開始希望日をYYYY-MM-DD形式で推測(不明ならnull)"
  }
}`;
    }
  } else {
    // 依頼情報なし（従来の3項目のみ）
    jsonSchema = `
{
  "summary": "Markdown形式の要約（文字列型、必須）",
  "transcript": "話者別の全文文字起こし（文字列型、必須）",
  "actions": [アクション配列（配列型、必須、空配列可）]
}`;
  }

  return `
# 指示

提供された音声ファイルと以下の情報を総合的に分析し、医療・介護分野の文脈を正確に理解した上で、厳格なルールに従ってJSONオブジェクトを生成してください。

${contextSection}${userInfoSection}${requestSection}

# 専門用語のヒント

医療・介護分野の略語を正しく解釈してください:

- ADL: 日常生活動作, IADL: 手段的日常生活動作
- BP: 血圧, SpO2: 経皮的動脈血酸素飽和度, vital: バイタルサイン
- Dx: 診断名, Dr.: 医師, Ns.: 看護師
- PT: 理学療法士, OT: 作業療法士, ST: 言語聴覚士
- CM, ケアマネ: ケアマネジャー, cw: ケースワーカー
- 包括: 地域包括支援センター, サ担会議: サービス担当者会議

# JSON出力仕様（厳守）

**重要: 必ず以下のキーすべてを含むJSONを返してください**

${jsonSchema}

# 要約作成ルール (summaryキー)

Markdown形式で以下のグループごとに整理:

**通話の概要**
- **日時**: ${formattedDate}
- **対応者**: (背景情報から読み取り)
- **通話相手**: (名前と種別)
- **目的**: (通話の目的)
- **背景**: (経緯や関連する出来事)

**話し合った内容**
- (要点を箇条書き)

**決定事項と次のアクション**
- **決定事項**: (確定した事柄)
- **アクションアイテム**: (誰が、いつまでに、何をするか)

重要な部分は\`バッククオート\`で囲んでマーカー表示。
該当情報がないグループは省略。

# 全文文字起こしルール (transcriptキー)

- 話者を明確に区別
- 話者ラベル: 「スタッフ：」「通話相手：」
- 発言ごとに改行

# アクション抽出ルール (actionsキー)

株式会社フラクタル、フラクタル訪問看護が主体のタスク・イベントのみ抽出:

{
  "title": "タスク名",
  "details": "詳細",
  "action_type": "タスク" | "イベント",
  "assignee_id": "担当者ID" | null,
  "start_datetime": "YYYY-MM-DDTHH:MM:SSZ" | null,
  "duration_minutes": 数値 | null
}

アクションがなければ空配列 [] を返す。

# 最終確認

出力前に必ず確認してください:
✓ "summary" キーが存在し、文字列型である
✓ "transcript" キーが存在し、文字列型である  
✓ "actions" キーが存在し、配列型である（空配列可）
${includeRequestDetails ? '✓ "request_details" キーが存在し、オブジェクト型である' : ''}
✓ 全ての必須キーが含まれている
✓ 有効なJSON形式である

`;
}

/**
 * Vertex AI APIを呼び出し（inlineData使用）
 * base64エンコードで音声データを送信（20MB以下のファイル用）
 */
function callVertexAIAPIWithInlineData(audioFile, prompt, config) {
  // エンドポイントURL構築
  const endpoint = `https://${config.gcpLocation}-aiplatform.googleapis.com/v1/projects/${config.gcpProjectId}/locations/${config.gcpLocation}/publishers/google/models/${config.vertexAIModel}:generateContent`;
  
  Logger.log(`[Vertex AI] モデル: ${config.vertexAIModel}, リージョン: ${config.gcpLocation}`);

  // リクエストボディ構築
  const requestBody = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { 
          inlineData: { 
            mimeType: audioFile.mimeType,
            data: Utilities.base64Encode(audioFile.blob.getBytes())
          } 
        }
      ]
    }],
    generationConfig: {
      responseMimeType: "application/json",
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
  Logger.log('[Vertex AI] API呼び出し開始');
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
 * APIレスポンスからJSONを抽出して検証
 */
function extractAndValidateJSON(responseText, includeRequestDetails = false) {
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

  const contentText = candidate.content.parts[0].text;

  // JSON抽出（2段階戦略）
  const result = extractJSONFromText(contentText);

  // 構造検証と修復
  const validatedResult = validateAndFixJSONStructure(result, contentText, includeRequestDetails);

  // usageMetadataを抽出
  const usageMetadata = extractVertexAIUsageMetadata(jsonResponse);
  validatedResult.usageMetadata = usageMetadata;

  Logger.log(`[Vertex AI] JSON抽出成功 (アクション数: ${validatedResult.actions.length})`);
  if (usageMetadata) {
    Logger.log(`[Vertex AI] 使用量: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
  }

  return validatedResult;
}

/**
 * Vertex AI APIレスポンスからusageMetadataを抽出（日本円計算付き）
 * @param {Object} jsonResponse - APIレスポンス
 * @param {string} modelName - 使用したモデル名
 * @param {string} inputType - 入力タイプ ('audio' | 'text')
 * @return {Object|null} {inputTokens, outputTokens, inputCostJPY, outputCostJPY, totalCostJPY, model}
 */
function extractVertexAIUsageMetadata(jsonResponse, modelName, inputType = 'audio') {
  if (!jsonResponse.usageMetadata) {
    return null;
  }

  const usage = jsonResponse.usageMetadata;
  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = usage.candidatesTokenCount || 0;

  // モデル名と入力タイプに応じた価格を取得
  const pricing = getVertexAIPricing(modelName, inputType);
  const inputCostUSD = (inputTokens / 1000000) * pricing.inputPer1M;
  const outputCostUSD = (outputTokens / 1000000) * pricing.outputPer1M;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  // 日本円に換算
  const inputCostJPY = inputCostUSD * EXCHANGE_RATE_USD_TO_JPY;
  const outputCostJPY = outputCostUSD * EXCHANGE_RATE_USD_TO_JPY;
  const totalCostJPY = totalCostUSD * EXCHANGE_RATE_USD_TO_JPY;

  return {
    model: modelName,
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    inputCostJPY: inputCostJPY,
    outputCostJPY: outputCostJPY,
    totalCostJPY: totalCostJPY
  };
}

/**
 * モデル名を正規化（バージョン番号やプレフィックスを削除）
 * @param {string} modelName - モデル名
 * @return {string} 正規化されたモデル名
 */
function normalizeModelName(modelName) {
  // 'gemini-2.5-flash-001' → 'gemini-2.5-flash'
  // 'publishers/google/models/gemini-2.5-flash' → 'gemini-2.5-flash'
  const match = modelName.match(/(gemini-[\d.]+-(?:flash|pro))/i);
  return match ? match[1].toLowerCase() : modelName.toLowerCase();
}

/**
 * Vertex AIモデルの価格情報を取得（モデル名と入力タイプに応じて動的に決定）
 * @param {string} modelName - モデル名
 * @param {string} inputType - 入力タイプ ('audio' | 'text')
 * @return {Object} {inputPer1M, outputPer1M}
 */
function getVertexAIPricing(modelName, inputType = 'text') {
  // 2025年1月時点のVertex AI価格（USD/100万トークン）
  // 実際の価格はGCPドキュメントを参照: https://cloud.google.com/vertex-ai/generative-ai/pricing
  const pricingTable = {
    'gemini-2.5-flash': {
      text: { inputPer1M: 0.075, outputPer1M: 0.30 },
      audio: { inputPer1M: 1.00, outputPer1M: 2.50 }  // 音声入力（GA版）
    },
    'gemini-2.5-pro': {
      text: { inputPer1M: 1.25, outputPer1M: 10.00 },
      audio: { inputPer1M: 1.25, outputPer1M: 10.00 }  // 音声入力
    },
    'gemini-1.5-flash': {
      text: { inputPer1M: 0.075, outputPer1M: 0.30 },
      audio: { inputPer1M: 0.075, outputPer1M: 0.30 }  // 音声入力
    },
    'gemini-1.5-pro': {
      text: { inputPer1M: 1.25, outputPer1M: 5.00 },
      audio: { inputPer1M: 1.25, outputPer1M: 5.00 }  // 音声入力
    }
  };

  // モデル名を正規化
  const normalizedModelName = normalizeModelName(modelName);

  // モデルが見つからない場合はデフォルト価格を使用
  if (!pricingTable[normalizedModelName]) {
    Logger.log(`[価格取得] ⚠️ 未知のモデル: ${modelName}, デフォルト価格（gemini-2.5-flash）を使用`);
    return pricingTable['gemini-2.5-flash'][inputType] || pricingTable['gemini-2.5-flash']['text'];
  }

  // 入力タイプが見つからない場合はテキスト価格を使用
  if (!pricingTable[normalizedModelName][inputType]) {
    Logger.log(`[価格取得] ⚠️ 未知の入力タイプ: ${inputType}, テキスト価格を使用`);
    return pricingTable[normalizedModelName]['text'];
  }

  Logger.log(`[価格取得] モデル: ${normalizedModelName}, 入力タイプ: ${inputType}, Input: $${pricingTable[normalizedModelName][inputType].inputPer1M}/1M, Output: $${pricingTable[normalizedModelName][inputType].outputPer1M}/1M`);
  return pricingTable[normalizedModelName][inputType];
}

/**
 * 営業音声記録を分析（営業活動専用）
 * @param {Object} context - コンテキスト情報
 * @param {string} context.filePath - ファイルパス
 * @param {string} context.fileId - ファイルID
 * @param {string} context.salespersonName - 営業担当者名
 * @param {string} context.contactName - 面会相手名
 * @param {string} context.orgName - 訪問先機関名
 * @return {Object} {summary, key_points, next_actions, customer_feedback, fileSize, usageMetadata}
 */
function analyzeSalesCallWithVertexAI(context) {
  const config = getConfig();

  // ファイルID解決
  let fileId = context.fileId;
  if (!fileId && context.filePath) {
    Logger.log(`[営業音声分析] ファイルパス から解決: ${context.filePath}`);

    // ベースフォルダーIDを取得
    const baseFolderId = config.sharedDriveFolderId;
    if (!baseFolderId) {
      throw new Error('SHARED_DRIVE_FOLDER_ID が設定されていません。Script Properties で設定してください。');
    }

    // drive_utils.gs の getFileIdFromPath を使用
    const fileInfo = getFileIdFromPath(context.filePath, baseFolderId);
    fileId = fileInfo.fileId;
    Logger.log(`[営業音声分析] ファイルID解決成功: ${fileId}`);
  }

  if (!fileId) {
    throw new Error('fileId または filePath が必要です');
  }

  Logger.log(`[営業音声分析] ファイルID: ${fileId}`);

  // ファイル取得
  const audioFile = getAudioFile(fileId);  // fileIdのみ渡す
  const fileSizeMB = (audioFile.blob.getBytes().length / 1024 / 1024).toFixed(2);
  Logger.log(`[営業音声分析] ファイルサイズ: ${fileSizeMB}MB`);

  // ファイルサイズチェック（20MB制限）
  if (fileSizeMB > 20) {
    throw new Error(`ファイルサイズが大きすぎます: ${fileSizeMB}MB（上限20MB）`);
  }

  // 営業活動専用プロンプト生成
  const prompt = generateSalesAnalysisPrompt(
    context.salespersonName,
    context.contactName,
    context.orgName
  );

  // Vertex AI API呼び出し
  Logger.log('[営業音声分析] Vertex AI API呼び出し開始');
  const apiResponse = callVertexAIAPIWithInlineData(audioFile, prompt, config);

  // JSON抽出と検証（モデル名を渡す）
  const result = extractSalesAnalysisJSON(apiResponse, config.vertexAIModel);

  // ファイルサイズ情報を追加
  result.fileSize = `${fileSizeMB}MB`;

  Logger.log(`[営業音声分析] 分析完了 - 重要ポイント: ${result.key_points ? result.key_points.length : 0}件`);

  return result;
}

/**
 * 営業活動専用のプロンプトを生成（詳細な評価指標版）
 * @param {string} salespersonName - 営業担当者名
 * @param {string} contactName - 面会相手名
 * @param {string} orgName - 訪問先機関名
 * @return {string} プロンプト
 */
function generateSalesAnalysisPrompt(salespersonName, contactName, orgName) {
  return `
# あなたの役割
あなたは、営業コンサルタント兼データアナリストです。提供された営業担当者と面会相手との音声記録を分析し、以下の#評価指標に基づいて、営業活動の評価とサマリーを作成してください。

# 背景情報
- 営業担当者: ${salespersonName || '不明'}
- 訪問先（機関）: ${orgName || '不明'}
- 面会相手: ${contactName || '不明'}

# 評価指標
## 関心度 (interest_level)
- **INT-01**: 非常に関心がある - 具体的な検討段階に入っており、前向きな発言や質問が多い。サービス導入に意欲的。
- **INT-02**: 関心がある - 依頼の可能性が高い。サービス内容に強い関心を示し、質問や確認が多い。
- **INT-03**: 普通 - 興味はあるが、判断材料が不足している状態。情報収集段階。
- **INT-04**: あまり関心がない - 関心が薄い、または現状では必要性を感じていない。
- **INT-05**: 関心がない - 全く関心がない、または否定的な状態。

## 当社を知っているか (knows_us)
- **AWR-01**: よく知っている - ステーション名、所在地など基本情報を正確に認知。
- **AWR-02**: 聞いたことがある - ステーション名は聞いたことがあるが、詳細は曖昧。
- **AWR-03**: ほとんど知らない - ほとんど、または全く知らない。

## 当社の印象 (our_impression)
- **IMP-01**: 非常に良い - 信頼感、専門性、対応力など、総合的に非常に高い評価。パートナーとして強く認識。
- **IMP-02**: 良い - 信頼感、専門性、対応力など、全体的に良い評価。連携に前向き。
- **IMP-03**: 普通 - 特に良いとも悪いとも思われていない状態。可もなく不可もなく。
- **IMP-04**: あまり良くない - 何らかの懸念点や不満がある状態。改善を求める点がある。
- **IMP-05**: 非常に悪い - 強い不満や不信感がある状態。重大な問題がある。

## 営業時間を知っているか (knows_hours)
- **HRS-01**: 正確に把握 - 平日の営業時間、土日祝の対応、緊急時連絡体制などを正確に把握。
- **HRS-02**: 大体知っている - 平日の大体の営業時間は知っているが、時間外等の対応は不確か。
- **HRS-03**: ほとんど知らない - ほとんど知らない、または誤解している。

## 当社の専門職の種別を知っているか (knows_job_types)
- **STF-01**: 具体的に知っている - 看護師に加え、配置しているリハビリ専門職（PT/OT/ST）の種類や構成まで具体的に知っている。
- **STF-02**: なんとなく知っている - 看護師とリハビリ専門職がいることは知っているが、職種の詳細までは知らない。
- **STF-03**: ほとんど知らない - 看護師のみと思っている、またはスタッフ構成についてほとんど知らない。

## 看護とリハで訪問可能時間が異なることを知っているか (knows_time_diff)
- **TIM-01**: 理解している - 時間帯の違いやその背景（例: リハ職の勤務体系）を理解している。
- **TIM-02**: 知っている - 異なる場合があることは知っているが、具体的な時間帯や理由は不明確。
- **TIM-03**: 知らない - 全く知らない、または同じだと思っている。
- **TIM-04**: 該当しない/不明 - 該当しない/不明。

## 提供サービスへの理解度 (understands_services)
- **UND-01**: よく理解している - 健康管理、医療処置、リハビリ、ターミナルケアなど、訪問看護の多様な役割を広く正しく理解している。
- **UND-02**: 部分的に理解 - 日常的な健康管理等が中心というイメージが強いなど、理解が限定的・部分的。
- **UND-03**: ほとんど知らない - ヘルパーサービスとの違いが不明瞭、またはサービス内容についてほとんど知らない・誤解がある。

## 訪問看護全体の印象 (overall_vhns_impression)
- **OVL-01**: 高く評価 - 在宅療養支援の重要なパートナーとして高く評価し、積極的に連携・活用したいという明確な意向がある。
- **OVL-02**: 必要性は認識 - 必要性は認識しているが、連携の手間や過去の経験から、利用や連携に多少の障壁を感じている様子。
- **OVL-03**: ネガティブ - あまり重要視していない、または訪問看護全体に対してネガティブな印象を持っている。

## 連携における悩みの有無 (has_coop_issues)
- **CWP-01**: なし - 悩みや不満、課題はない。
- **CWP-02**: ある - 何らかの悩みや不満、課題があることが表明される。

## 業務における悩み (has_work_issues)
- **WKP-01**: ある（具体的） - 自身の業務上の課題や困りごとについて、具体的な相談や意見交換を持ちかけてくる。
- **WKP-02**: ありそう - 一般的な業界の動向や当たり障りのない業務の話はするが、具体的な相談には至らない。
- **WKP-03**: なし - 業務に関する個人的な悩みや相談は全くされない。

## その他の悩み (has_other_issues)
- **OTH-01**: あり - 業務外の個人的なことや、業界全般に関する雑談・相談など、何らかの話がある。
- **OTH-02**: なし - 業務に関する話以外はほとんどしない、または全くない。

## 営業頻度 (sales_frequency_plan)
- **FRQ-01**: 週1回 - 非常に高い頻度での情報交換を希望。
- **FRQ-02**: 2週間に1回程度 - 定期的な情報交換を希望。
- **FRQ-03**: 月1回程度 - 一定の頻度での情報交換を希望。
- **FRQ-04**: 2-3ヶ月に1回、または必要時 - 情報提供は必要だが、頻度は高くない。
- **FRQ-05**: 営業の希望なし - 現時点では情報提供を希望していない。

# 出力指示
- 音声記録の内容を分析し、以下のキーを持つJSONオブジェクトを生成してください。
- **重要**: 定量評価項目には**評価指標ID**（例：「INT-02」）を文字列として設定してください。
- 定性評価項目には、会話から推測される内容を要約して記述してください。
- 該当する情報が会話にない場合は、値にnullを設定してください。
- **特に指定がない限り、詳細記述用の項目（..._details）は、対応する悩みや宿題が会話中に存在した場合にのみ内容を記述し、存在しない場合はnullにしてください。**

{
  "office_impression": "訪問した事業所の雰囲気や状況など、感じたこと",
  "contact_impression": "面会した担当者の反応や人柄など、感じたこと",
  "hearing_details": "面会中にヒアリングした内容の要点（箇条書きテキスト）",
  "knows_us": "（評価指標ID）",
  "our_impression": "（評価指標ID）",
  "knows_hours": "（評価指標ID）",
  "knows_job_types": "（評価指標ID）",
  "knows_time_diff": "（評価指標ID）",
  "understands_services": "（評価指標ID）",
  "main_partner_vhns": "現在、主に連携している訪問看護ステーション名",
  "partner_vhns_impression": "連携先の印象について、具体的な内容",
  "overall_vhns_impression": "（評価指標ID）",
  "coop_issue_details": "もし連携における悩みについて話があれば、その具体的な内容",
  "expectations_for_vhns": "訪問看護というサービスに期待すること",
  "info_needs_from_vhns": "訪問看護からどのような情報が欲しいか",
  "info_needs_from_sales": "営業担当者からどのような情報が欲しいか",
  "work_issue_details": "もし業務における悩みについて話があれば、その具体的な内容",
  "other_issue_details": "もしその他の悩みについて話があれば、その具体的な内容",
  "follow_up_task_details": "もし営業先からの宿題（依頼事項）があれば、その具体的な内容",
  "task_deadline": "もし宿題の対応期限について話があれば、その日付をISO 8601形式（YYYY-MM-DD）で推測",
  "next_approach": "次回どのようなアプローチをすべきか、具体的な方針や計画",
  "next_action_date": "次にアプローチすべき日付をISO 8601形式（YYYY-MM-DD）で推測",
  "interest_level": "（評価指標ID）",
  "sales_frequency_plan": "（評価指標ID）",
  "summary": "今回の営業活動全体の要約"
}

## 最終確認
出力前に必ず確認してください：
✓ 全ての必須キーが含まれている
✓ 評価指標IDは正しい形式（例: INT-01, AWR-02）で設定されている
✓ 有効なJSON形式である
✓ nullを設定すべき項目に適切にnullが設定されている
`;
}

/**
 * 営業分析のJSONレスポンスを抽出・検証
 * @param {string} responseText - API レスポンステキスト
 * @param {string} modelName - 使用したモデル名
 * @return {Object} 抽出・検証済みのJSON
 */
function extractSalesAnalysisJSON(responseText, modelName) {
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
    throw new Error('AIの応答にコンテンツがありません');
  }

  const contentText = candidate.content.parts[0].text;

  // JSON抽出
  const result = extractJSONFromText(contentText);

  // 営業分析用の構造検証
  const validatedResult = validateSalesAnalysisStructure(result);

  // usageMetadataを抽出（モデル名と入力タイプ='audio'を渡す）
  const usageMetadata = extractVertexAIUsageMetadata(jsonResponse, modelName, 'audio');
  validatedResult.usageMetadata = usageMetadata;

  Logger.log(`[営業音声分析] JSON抽出成功`);
  if (usageMetadata) {
    Logger.log(`[営業音声分析] 使用量: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
  }

  return validatedResult;
}

/**
 * 営業分析JSONの構造を検証・修復（詳細な評価指標版）
 * @param {Object} result - 抽出されたJSONオブジェクト
 * @return {Object} 検証・修復済みのJSONオブジェクト
 */
function validateSalesAnalysisStructure(result) {
  Logger.log('[営業JSON検証] 構造チェック開始');

  if (!result || typeof result !== 'object') {
    throw new Error('JSONの構造が不正です');
  }

  // 必須フィールドのリスト（全て文字列またはnull許容）
  const requiredStringFields = [
    'office_impression',
    'contact_impression',
    'hearing_details',
    'knows_us',
    'our_impression',
    'knows_hours',
    'knows_job_types',
    'knows_time_diff',
    'understands_services',
    'main_partner_vhns',
    'partner_vhns_impression',
    'overall_vhns_impression',
    'coop_issue_details',
    'expectations_for_vhns',
    'info_needs_from_vhns',
    'info_needs_from_sales',
    'work_issue_details',
    'other_issue_details',
    'follow_up_task_details',
    'task_deadline',
    'next_approach',
    'next_action_date',
    'interest_level',
    'sales_frequency_plan',
    'summary'
  ];

  // 修復処理
  const repairedResult = { ...result };
  let missingCount = 0;

  // 各フィールドの存在と型チェック
  requiredStringFields.forEach(field => {
    if (!result.hasOwnProperty(field)) {
      Logger.log(`[営業JSON修復] ${field} を補完（null）`);
      repairedResult[field] = null;
      missingCount++;
    } else if (result[field] !== null && typeof result[field] !== 'string') {
      Logger.log(`[営業JSON修復] ${field} の型を修正（文字列変換）`);
      repairedResult[field] = String(result[field]);
    }
  });

  if (missingCount > 0) {
    Logger.log(`[営業JSON検証] ⚠️ ${missingCount}個のフィールドを補完しました`);
  } else {
    Logger.log('[営業JSON検証] ✓ 全てのフィールドが存在します');
  }

  // 利用可能なキーを表示
  const availableKeys = Object.keys(repairedResult);
  Logger.log(`[営業JSON検証] 利用可能なキー数: ${availableKeys.length}`);

  return repairedResult;
}

/**
 * テキストからJSONを抽出（2段階戦略）
 */
function extractJSONFromText(text) {
  if (!text) {
    throw new Error('AIの応答テキストが空です');
  }

  // Strategy 1: Markdownコードブロック抽出
  const markdownRegex = /```(?:json)?\s*([\s\S]+?)\s*```/i;
  const match = text.match(markdownRegex);
  
  if (match && match[1]) {
    try {
      Logger.log('[JSON抽出] Strategy 1 (Markdown) 使用');
      return JSON.parse(match[1].trim());
    } catch (error) {
      Logger.log(`[JSON抽出] Strategy 1 失敗: ${error.message}`);
    }
  }

  // Strategy 2: 括弧抽出
  Logger.log('[JSON抽出] Strategy 2 (括弧) 使用');
  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');
  
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const jsonString = text.substring(startIndex, endIndex + 1);
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      Logger.log(`[JSON抽出] パースエラー: ${error.message}`);
      Logger.log(`抽出文字列 (先頭500文字): ${jsonString.substring(0, 500)}`);
      if (error.message.includes('Unexpected end')) {
        throw new Error('AIの応答が途中で終了 (トークン不足の可能性)');
      }
      throw new Error(`JSON解析エラー: ${error.message}`);
    }
  }

  // 両方失敗
  Logger.log(`[JSON抽出] 失敗\nテキスト (先頭500文字): ${text.substring(0, 500)}`);
  throw new Error('有効なJSONが見つかりませんでした');
}

/**
 * JSON構造を検証して修復
 * 不足しているキーがあれば補完する
 * @param {Object} result - 抽出されたJSONオブジェクト
 * @param {string} originalText - 元のテキスト（デバッグ用）
 * @param {boolean} includeRequestDetails - 依頼情報を含むか
 * @return {Object} 検証・修復済みのJSONオブジェクト
 */
function validateAndFixJSONStructure(result, originalText, includeRequestDetails = false) {
  Logger.log('[JSON検証] 構造チェック開始');
  
  // 結果オブジェクトが存在しない場合
  if (!result || typeof result !== 'object') {
    Logger.log('[JSON検証] ❌ 結果がオブジェクトではありません');
    Logger.log(`元のテキスト (先頭1000文字): ${originalText.substring(0, 1000)}`);
    throw new Error('JSONの構造が不正です: オブジェクトが取得できません');
  }
  
  // 各必須キーの存在確認とログ出力
  const hasSummary = result.hasOwnProperty('summary');
  const hasTranscript = result.hasOwnProperty('transcript');
  const hasActions = result.hasOwnProperty('actions');
  const hasRequestDetails = result.hasOwnProperty('request_details');
  
  Logger.log(`[JSON検証] summary: ${hasSummary ? '✓' : '✗'} (型: ${typeof result.summary})`);
  Logger.log(`[JSON検証] transcript: ${hasTranscript ? '✓' : '✗'} (型: ${typeof result.transcript})`);
  Logger.log(`[JSON検証] actions: ${hasActions ? '✓' : '✗'} (型: ${typeof result.actions}, 配列: ${Array.isArray(result.actions)})`);
  if (includeRequestDetails) {
    Logger.log(`[JSON検証] request_details: ${hasRequestDetails ? '✓' : '✗'} (型: ${typeof result.request_details})`);
  }
  
  // 利用可能なキーを表示
  const availableKeys = Object.keys(result);
  Logger.log(`[JSON検証] 利用可能なキー: ${availableKeys.join(', ')}`);
  
  // 修復処理
  let fixed = false;
  const repairedResult = { ...result };
  
  // summaryの修復
  if (!hasSummary || typeof result.summary !== 'string') {
    Logger.log('[JSON修復] summary を補完');
    repairedResult.summary = '要約情報が取得できませんでした。';
    fixed = true;
  }
  
  // transcriptの修復
  if (!hasTranscript || typeof result.transcript !== 'string') {
    Logger.log('[JSON修復] transcript を補完');
    repairedResult.transcript = '文字起こし情報が取得できませんでした。';
    fixed = true;
  }
  
  // actionsの修復
  if (!hasActions || !Array.isArray(result.actions)) {
    Logger.log('[JSON修復] actions を補完');
    repairedResult.actions = [];
    fixed = true;
  }
  
  // request_detailsの修復（必要な場合のみ）
  if (includeRequestDetails && (!hasRequestDetails || typeof result.request_details !== 'object')) {
    Logger.log('[JSON修復] request_details を補完');
    repairedResult.request_details = {
      priority: null,
      request_type: null,
      request_reason: null,
      client_name_temp: null,
      client_info_temp: null,
      next_action_date: null,
      next_action_details: null,
      service_start_date: null
    };
    fixed = true;
  }
  
  // 修復が必要だった場合は警告ログを出力
  if (fixed) {
    Logger.log('[JSON修復] ⚠️ JSON構造を修復しました');
    Logger.log(`[JSON修復] 元のJSON: ${JSON.stringify(result).substring(0, 500)}`);
    Logger.log(`[JSON修復] 修復後のJSON: ${JSON.stringify(repairedResult).substring(0, 500)}`);
    Logger.log('[JSON修復] ⚠️ Vertex AIのレスポンスを確認してください');
    Logger.log(`[JSON修復] 元のテキスト (全文): ${originalText}`);
  } else {
    Logger.log('[JSON検証] ✓ 構造は正常です');
  }
  
  return repairedResult;
}
