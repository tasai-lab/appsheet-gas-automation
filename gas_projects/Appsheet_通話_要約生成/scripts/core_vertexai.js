/**
 * Vertex AI音声解析モジュール
 * Gemini 2.5 Flash/Proを使用して音声ファイルを解析
 * 
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-05
 */

/**
 * Vertex AIで音声ファイルを解析
 * 原則としてCloud Storage経由で処理（ファイルサイズ制限なし）
 * 
 * @param {string} fileId - Google DriveのファイルID
 * @param {string} callDatetime - 通話日時 (ISO 8601形式)
 * @param {string} callContextText - 通話の背景情報
 * @param {string} userInfoText - 利用者・関係機関の事前情報
 * @param {Object} config - 設定オブジェクト
 * @return {Object} {summary, transcript, actions}
 */
function analyzeAudioWithVertexAI(fileId, callDatetime, callContextText, userInfoText, config) {
  // ファイル取得とMIMEタイプ判定
  const audioFile = getAudioFile(fileId);
  
  Logger.log(`[Vertex AI] ファイルサイズ: ${(audioFile.blob.getBytes().length / 1024 / 1024).toFixed(2)}MB`);
  
  // プロンプト生成
  const prompt = generatePrompt(callDatetime, callContextText, userInfoText);
  
  // 原則Cloud Storage経由で処理
  Logger.log('[Vertex AI] Cloud Storage経由で処理開始');
  const gsUri = uploadToCloudStorage(audioFile, config);
  
  try {
    // Vertex AI APIリクエスト（Cloud Storage URI使用）
    const apiResponse = callVertexAIAPIWithStorage(gsUri, audioFile.mimeType, prompt, config);
    
    // JSON抽出と検証
    const result = extractAndValidateJSON(apiResponse);
    
    return result;
    
  } finally {
    // Cloud Storageから削除（処理成功・失敗に関わらず）
    deleteFromCloudStorage(gsUri, config);
  }
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
 * プロンプトを生成
 */
function generatePrompt(callDatetime, callContextText, userInfoText) {
  const date = new Date(callDatetime);
  const formattedDate = Utilities.formatDate(date, "Asia/Tokyo", "yyyy/MM/dd(E) HH:mm");
  
  const userInfoSection = userInfoText 
    ? `# 利用者・関係機関の事前情報\n${userInfoText}\n\n`
    : '';
    
  const contextSection = callContextText
    ? `# この通話に関する背景情報\n${callContextText}\n\n`
    : '';

  return `
# 指示
提供された音声ファイルと以下の情報を総合的に分析し、医療・介護分野の文脈を正確に理解した上で、厳格なルールに従ってJSONオブジェクトを生成してください。

${contextSection}${userInfoSection}
# 専門用語のヒント
医療・介護分野の略語を正しく解釈してください:
- ADL: 日常生活動作, IADL: 手段的日常生活動作
- BP: 血圧, SpO2: 経皮的動脈血酸素飽和度, vital: バイタルサイン
- Dx: 診断名, Dr.: 医師, Ns.: 看護師
- PT: 理学療法士, OT: 作業療法士, ST: 言語聴覚士
- CM, ケアマネ: ケアマネジャー, cw: ケースワーカー
- 包括: 地域包括支援センター, サ担会議: サービス担当者会議

# JSON出力仕様
以下の構造のJSONを生成:
{
  "summary": "Markdown形式の要約",
  "transcript": "話者別の全文文字起こし",
  "actions": [アクション配列]
}

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
`;
}

/**
 * Cloud Storageにファイルをアップロード
 */
function uploadToCloudStorage(audioFile, config) {
  const timestamp = new Date().getTime();
  const fileName = `call_audio_${timestamp}_${audioFile.fileName}`;
  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${config.gcpBucketName}/o?uploadType=media&name=${encodeURIComponent(fileName)}`;
  
  Logger.log(`[Cloud Storage] アップロード開始: ${fileName}`);
  
  const uploadOptions = {
    method: 'post',
    contentType: audioFile.mimeType,
    payload: audioFile.blob.getBytes(),
    headers: {
      'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(uploadUrl, uploadOptions);
  const statusCode = response.getResponseCode();
  
  if (statusCode !== 200) {
    const errorText = response.getContentText();
    Logger.log(`[Cloud Storage] アップロードエラー: ${statusCode}\n${errorText}`);
    throw new Error(`Cloud Storageアップロード失敗 (HTTP ${statusCode})`);
  }
  
  const gsUri = `gs://${config.gcpBucketName}/${fileName}`;
  Logger.log(`[Cloud Storage] アップロード成功: ${gsUri}`);
  
  return gsUri;
}

/**
 * Cloud Storageからファイルを削除
 */
function deleteFromCloudStorage(gsUri, config) {
  try {
    const fileName = gsUri.replace(`gs://${config.gcpBucketName}/`, '');
    const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${config.gcpBucketName}/o/${encodeURIComponent(fileName)}`;
    
    Logger.log(`[Cloud Storage] 削除開始: ${fileName}`);
    
    const deleteOptions = {
      method: 'delete',
      headers: {
        'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(deleteUrl, deleteOptions);
    const statusCode = response.getResponseCode();
    
    if (statusCode === 204) {
      Logger.log('[Cloud Storage] 削除成功');
    } else {
      Logger.log(`[Cloud Storage] 削除スキップ (HTTP ${statusCode})`);
    }
  } catch (error) {
    Logger.log(`[Cloud Storage] 削除時エラー（無視）: ${error.message}`);
  }
}

/**
 * Vertex AI APIを呼び出し（Cloud Storage URI使用）
 */
function callVertexAIAPIWithStorage(gsUri, mimeType, prompt, config) {
  // エンドポイントURL構築
  const endpoint = `https://${config.gcpLocation}-aiplatform.googleapis.com/v1/projects/${config.gcpProjectId}/locations/${config.gcpLocation}/publishers/google/models/${config.vertexAIModel}:generateContent`;
  
  Logger.log(`[Vertex AI] モデル: ${config.vertexAIModel}, リージョン: ${config.gcpLocation}`);
  
  // リクエストボディ構築（Cloud Storage URI使用）
  const requestBody = {
    contents: [{
      role: 'user',  // 重要: roleを明示的に指定
      parts: [
        { text: prompt },
        { 
          fileData: { 
            mimeType: mimeType,
            fileUri: gsUri
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
 * Vertex AI APIを呼び出し（非推奨: inlineData使用）
 * 小さいファイルの場合のみ使用可能
 */
function callVertexAIAPI(audioFile, prompt, config) {
  // エンドポイントURL構築
  const endpoint = `https://${config.gcpLocation}-aiplatform.googleapis.com/v1/projects/${config.gcpProjectId}/locations/${config.gcpLocation}/publishers/google/models/${config.vertexAIModel}:generateContent`;
  
  Logger.log(`[Vertex AI] モデル: ${config.vertexAIModel}, リージョン: ${config.gcpLocation}`);
  
  // リクエストボディ構築
  const requestBody = {
    contents: [{
      role: 'user',  // 重要: roleを明示的に指定
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
function extractAndValidateJSON(responseText) {
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
  
  // 構造検証
  if (!result.summary || !result.transcript || !Array.isArray(result.actions)) {
    throw new Error('JSONの構造が不正です (summary, transcript, actionsが必要)');
  }
  
  Logger.log(`[Vertex AI] JSON抽出成功 (アクション数: ${result.actions.length})`);
  
  return result;
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
