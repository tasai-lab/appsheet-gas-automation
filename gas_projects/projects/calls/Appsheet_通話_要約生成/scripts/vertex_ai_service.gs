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

  Logger.log(`[Vertex AI] JSON抽出成功 (アクション数: ${validatedResult.actions.length})`);
  
  return validatedResult;
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
