/**
 * Appsheet_名刺取り込み - OCRサービス
 * 
 * Vertex AI Gemini 2.5 Flashを使用した名刺OCR処理
 * 
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-23
 */

// グローバルなコスト計算機（各実行セッションで初期化）
let globalCostCalculator = null;

/**
 * コスト計算機を初期化
 */
function initializeCostCalculator() {
  globalCostCalculator = new VertexAICostCalculator();
  return globalCostCalculator;
}

/**
 * コスト計算機を取得（未初期化の場合は初期化）
 */
function getCostCalculator() {
  if (!globalCostCalculator) {
    globalCostCalculator = new VertexAICostCalculator();
  }
  return globalCostCalculator;
}

/**
 * 名刺画像から情報を抽出（Vertex AI使用）
 * 表面優先、表面で氏名が取得できない場合は表裏を入れ替え
 * 
 * @param {GoogleAppsScript.Drive.File} frontFile - 名刺表面画像
 * @param {GoogleAppsScript.Drive.File} [backFile] - 名刺裏面画像（オプション）
 * @returns {Object} 抽出された連絡先情報 + swapped フラグ
 * @throws {Error} API呼び出しまたはJSON解析エラー
 */
function extractBusinessCardInfo(frontFile, backFile = null) {
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logInfo(`📸 名刺OCR処理開始: ${frontFile.getName()}`);
  if (backFile) {
    logInfo(`   裏面あり: ${backFile.getName()}`);
  }
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  try {
    // 表面画像のOCR処理
    logInfo(`[1/2] 表面画像を処理中...`);
    const frontInfo = extractSingleSide(frontFile, '表面');
    
    // 表面に氏名があるかチェック
    const hasFrontName = frontInfo.last_name && frontInfo.first_name;
    
    if (!hasFrontName) {
      logInfo(`⚠️  表面から氏名を取得できませんでした`);
    }
    
    // 裏面画像のOCR処理
    let backInfo = null;
    let swapped = false; // 表裏を入れ替えたかどうか
    
    if (backFile) {
      logInfo(`[2/2] 裏面画像を処理中...`);
      backInfo = extractSingleSide(backFile, '裏面');
      
      const hasBackName = backInfo.last_name && backInfo.first_name;
      
      // 表面に氏名がなく、裏面に氏名がある場合は表裏を入れ替え
      if (!hasFrontName && hasBackName) {
        logInfo(`✅ 裏面に氏名を発見 - 表裏を入れ替えます`);
        logInfo(`   新しい表面: ${backInfo.last_name} ${backInfo.first_name}`);
        
        // 表裏を入れ替え
        const temp = frontInfo;
        frontInfo = backInfo;
        backInfo = temp;
        swapped = true;
      }
    } else {
      logInfo(`[2/2] 裏面画像なし - スキップ`);
    }
    
    // 表面と裏面の情報をマージ（この時点で正しい順序）
    const mergedInfo = mergeBusinessCardInfo(frontInfo, backInfo, false);
    
    // swappedフラグを追加
    mergedInfo._swapped = swapped;
    
    // バリデーション
    validateExtractedInfo(mergedInfo);
    
    logInfo(`✅ OCR成功: ${mergedInfo.last_name} ${mergedInfo.first_name}`);
    if (swapped) {
      logInfo(`   ※表裏入れ替え済み`);
    }
    logDebug('抽出データ（マージ後）', mergedInfo);
    
    return mergedInfo;
    
  } catch (error) {
    logError(`❌ OCR処理エラー: ${frontFile.getName()}`, error);
    throw error;
  }
}

/**
 * 単一面（表面または裏面）の情報を抽出
 * 
 * @param {GoogleAppsScript.Drive.File} file - 画像ファイル
 * @param {string} side - '表面' または '裏面'
 * @returns {Object} 抽出された情報
 */
function extractSingleSide(file, side) {
  logDebug(`${side}画像を処理: ${file.getName()}`);
  
  // プロンプト構築
  const prompt = buildOCRPrompt();
  
  // 画像パーツ構築（単一画像）
  const imageParts = buildImageParts(file, null);
  
  // Vertex AI API呼び出し
  const extractedInfo = callVertexAIForOCR(prompt, imageParts);
  
  // 単一面では氏名を必須としない（バリデーションスキップ）
  // マージ後に最終チェック
  
  logDebug(`${side}の抽出完了`, extractedInfo);
  
  return extractedInfo;
}

/**
 * 表面と裏面の情報をマージ
 * 通常は表面を優先、表面に氏名がない場合は裏面を優先
 * 
 * @param {Object} frontInfo - 表面から抽出した情報
 * @param {Object} backInfo - 裏面から抽出した情報（nullの場合あり）
 * @param {boolean} preferBack - 裏面を優先するか（表面に氏名がない場合）
 * @returns {Object} マージされた情報
 */
function mergeBusinessCardInfo(frontInfo, backInfo, preferBack = false) {
  if (!backInfo) {
    logDebug('裏面情報なし - 表面情報のみ使用');
    return frontInfo;
  }
  
  logDebug('表面と裏面の情報をマージ中...');
  
  // 裏面優先モード（表面に氏名がない場合）
  if (preferBack) {
    logDebug('  モード: 裏面優先（表面に氏名なし）');
    const merged = { ...backInfo };  // 裏面をベースに
    
    // 表面から追加情報を補完
    for (const key in frontInfo) {
      if (frontInfo[key] !== null && frontInfo[key] !== '') {
        // 裏面の値が空またはnullの場合、表面の値を使用
        if (merged[key] === null || merged[key] === '' || merged[key] === undefined) {
          merged[key] = frontInfo[key];
          logDebug(`  ${key}: 表面から補完 → ${frontInfo[key]}`);
        }
        // special_notesは追加情報として結合
        else if (key === 'special_notes' && frontInfo[key] !== merged[key]) {
          merged[key] = merged[key] + ' / ' + frontInfo[key];
          logDebug(`  ${key}: 裏面と表面を結合 → ${merged[key]}`);
        }
      }
    }
    
    logDebug('マージ完了（裏面ベース）', merged);
    return merged;
  }
  
  // 通常モード（表面優先）
  logDebug('  モード: 表面優先');
  const merged = { ...frontInfo };
  
  // 裏面から追加情報を補完
  // 表面にない情報のみ裏面から取得
  for (const key in backInfo) {
    if (backInfo[key] !== null && backInfo[key] !== '') {
      // 表面の値が空またはnullの場合、裏面の値を使用
      if (merged[key] === null || merged[key] === '' || merged[key] === undefined) {
        merged[key] = backInfo[key];
        logDebug(`  ${key}: 裏面から補完 → ${backInfo[key]}`);
      }
      // special_notesは追加情報として結合
      else if (key === 'special_notes' && backInfo[key] !== merged[key]) {
        merged[key] = merged[key] + ' / ' + backInfo[key];
        logDebug(`  ${key}: 表面と裏面を結合 → ${merged[key]}`);
      }
    }
  }
  
  logDebug('マージ完了', merged);
  
  return merged;
}

/**
 * OCR用プロンプトを構築
 * @returns {string} プロンプト文字列
 */
function buildOCRPrompt() {
  return `
# 指示

提供された名刺の画像（表面または裏面）から、可能な限り以下の#ルールに従って連絡先情報を抽出し、一つのJSONオブジェクトとして出力してください。

# 重要な注意事項

- この画像は名刺の「表面のみ」または「裏面のみ」の可能性があります。
- 画像に記載されている情報のみを抽出してください。
- 記載されていない項目は必ずnullにしてください。
- **氏名が見つからない場合でも、他の情報を抽出してnullで返してください（エラーにしない）**。

# 職種と役職のルール

- **職種**: 名刺の記載から、必ず「医師」「看護師」「理学療法士」「作業療法士」「言語聴覚士」「介護支援専門員」「相談員」「事務職」など、いずれか一つに分類してください。
  - 例: 「院長」→「医師」
  - 例: 「主任ケアマネージャー」→「介護支援専門員」
  - 例: 「事務長」→「事務職」

- **役職**: 「主任」「課長」「所長」「院長」などの役職名が読み取れた場合はそれを記載し、なければ「一般」と記載してください。

- **氏名カナ**: 名刺に氏名の読み仮名が存在した場合にはカタカナで記載してください。読み仮名が存在しない場合で氏名が判明している時は、最も適切な読み仮名を推測し、カタカナで出力してください。

- **特記事項**: 上記の職種分類の過程で失われた元の詳細な職名（例: "退院支援看護師"）や、その他特筆すべき情報（例: 「担当エリア: ○○区」「営業時間」「サービス内容」）をここに記述してください。

# 出力指示

- 以下のキーを持つJSONオブジェクトを生成してください。
- 該当する情報がない場合や画像に記載されていない場合は、値にnullを設定してください。
- JSON以外の説明文は一切含めないでください。
- 必ずJSON形式で返してください（Markdownコードブロック不要）。

{
  "last_name": "姓",
  "first_name": "名",
  "last_name_kana": "セイ（カタカナ）",
  "first_name_kana": "メイ（カタカナ）",
  "job_type": "（ルールに従った職種）",
  "job_title": "（ルールに従った役職）",
  "phone_number": "個人の直通電話番号や携帯電話番号",
  "email": "メールアドレス",
  "card_org_name": "事業所名",
  "card_org_postal_code": "郵便番号（XXX-XXXX形式）",
  "card_org_address": "所在地",
  "card_org_phone": "事業所の代表電話番号",
  "card_org_fax": "FAX番号",
  "card_org_website": "ウェブサイトURL",
  "special_notes": "（ルールに従った特記事項）"
}

# フォーマット規則

- 郵便番号は必ずXXX-XXXX形式で出力してください。
- 電話番号、FAX番号はハイフン区切りで出力してください。
`;
}

/**
 * 画像パーツを構築
 * @param {GoogleAppsScript.Drive.File} frontFile - 表面画像
 * @param {GoogleAppsScript.Drive.File} [backFile] - 裏面画像
 * @returns {Array<Object>} 画像パーツ配列
 */
function buildImageParts(frontFile, backFile) {
  logDebug(`画像準備: 表面=${frontFile.getName()}`, { hasBack: !!backFile });
  
  const parts = [];
  
  // 表面画像
  const frontBytes = frontFile.getBlob().getBytes();
  parts.push({
    inlineData: {
      mimeType: 'image/jpeg',
      data: Utilities.base64Encode(frontBytes)
    }
  });
  
  logDebug(`表面画像: ${Math.round(frontBytes.length / 1024)} KB`);
  
  // 裏面画像（オプション）
  if (backFile) {
    const backBytes = backFile.getBlob().getBytes();
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: Utilities.base64Encode(backBytes)
      }
    });
    
    logDebug(`裏面画像: ${Math.round(backBytes.length / 1024)} KB`);
  }
  
  return parts;
}

/**
 * Vertex AI APIを呼び出してOCR実行（リトライロジック付き）
 * @param {string} prompt - プロンプト
 * @param {Array<Object>} imageParts - 画像パーツ
 * @returns {Object} 抽出された情報
 * @throws {Error} API呼び出しエラー
 */
function callVertexAIForOCR(prompt, imageParts) {
  const endpoint = getVertexAIEndpoint(VERTEX_AI_CONFIG.ocrModel);
  
  // 標準リクエストボディ生成（role: 'user'を保証）
  const requestBody = createVertexAIRequestBody(
    [{ text: prompt }, ...imageParts],
    {
      responseMimeType: 'application/json',
      temperature: VERTEX_AI_CONFIG.ocrTemperature,
      maxOutputTokens: VERTEX_AI_CONFIG.ocrMaxOutputTokens
    }
  );
  
  // 標準HTTPオプション生成
  const options = createVertexAIFetchOptions(requestBody);
  
  // リクエストボディの妥当性検証（開発時のみ）
  validateVertexAIRequestBody(requestBody);
  
  // リトライロジック
  let lastError = null;
  for (let attempt = 1; attempt <= VERTEX_AI_CONFIG.maxRetries; attempt++) {
    try {
      logInfo(`[Vertex AI] API呼び出し開始: ${VERTEX_AI_CONFIG.ocrModel} (試行 ${attempt}/${VERTEX_AI_CONFIG.maxRetries})`);
      const startTime = new Date().getTime();
      
      // API実行
      const response = UrlFetchApp.fetch(endpoint, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      const endTime = new Date().getTime();
      const responseTime = endTime - startTime;
      
      logInfo(`[Vertex AI] API応答: ${responseCode}, 処理時間: ${responseTime}ms`);
      
      // 成功
      if (responseCode === 200) {
        // API呼び出し間の待機（レート制限対策）
        if (VERTEX_AI_CONFIG.apiCallDelayMs > 0) {
          Utilities.sleep(VERTEX_AI_CONFIG.apiCallDelayMs);
        }
        return parseVertexAIResponse(responseText);
      }
      
      // 429エラー（レート制限）の場合はリトライ
      if (responseCode === 429) {
        logError(`[Vertex AI] レート制限エラー (試行 ${attempt}/${VERTEX_AI_CONFIG.maxRetries})`);
        if (attempt < VERTEX_AI_CONFIG.maxRetries) {
          const waitTime = VERTEX_AI_CONFIG.retryDelayMs * attempt;
          logInfo(`  ${waitTime}ms待機してリトライします...`);
          Utilities.sleep(waitTime);
          continue; // リトライ
        }
      }
      
      // その他のエラー
      logError(`[Vertex AI] APIエラー応答:\n${responseText.substring(0, 500)}`);
      
      // OAuth2認証エラーの特別処理
      if (responseCode === 403) {
        try {
          const errorObj = JSON.parse(responseText);
          if (errorObj.error && errorObj.error.message.includes('insufficient authentication scopes')) {
            throw new Error(
              'OAuth2認証エラー: cloud-platformスコープが不足しています。\n\n' +
              '解決方法:\n' +
              '1. GASエディターで testOAuth2Authorization() を実行\n' +
              '2. 「権限を確認」→「許可」をクリック\n' +
              '3. cloud-platformスコープを含む全権限を承認\n' +
              '4. 再度処理を実行'
            );
          }
        } catch (e) {
          // JSON解析失敗の場合はスルー
        }
      }
      
      throw new Error(`Vertex AI APIエラー: HTTP ${responseCode}`);
      
    } catch (error) {
      lastError = error;
      if (attempt < VERTEX_AI_CONFIG.maxRetries && error.message.includes('429')) {
        // 429エラーの場合のみリトライ
        const waitTime = VERTEX_AI_CONFIG.retryDelayMs * attempt;
        logInfo(`  ${waitTime}ms待機してリトライします...`);
        Utilities.sleep(waitTime);
        continue;
      }
      throw error; // その他のエラーは即座にスロー
    }
  }
  
  // 全てのリトライが失敗
  throw new Error(`API呼び出しが${VERTEX_AI_CONFIG.maxRetries}回失敗しました: ${lastError.message}`);
}

/**
 * Vertex AIレスポンスを解析
 * @param {string} responseText - API応答テキスト
 * @returns {Object} 抽出された情報
 * @throws {Error} 解析エラー
 */
function parseVertexAIResponse(responseText) {
  let jsonResponse;
  
  try {
    jsonResponse = JSON.parse(responseText);
  } catch (error) {
    logError('JSON解析エラー（レスポンス全体）', error);
    throw new Error(`APIレスポンスのJSON解析失敗: ${error.message}`);
  }
  
  // 使用統計情報を記録（コスト計算用）
  if (jsonResponse.usageMetadata) {
    const costCalc = getCostCalculator();
    const inputTokens = jsonResponse.usageMetadata.promptTokenCount || 0;
    const outputTokens = jsonResponse.usageMetadata.candidatesTokenCount || 0;
    
    costCalc.recordApiCall(VERTEX_AI_CONFIG.ocrModel, inputTokens, outputTokens);
    
    logDebug('トークン使用量', {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens
    });
  }
  
  // 候補チェック
  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    logError('候補なしエラー', { response: responseText.substring(0, 500) });
    throw new Error('AIからの応答に有効な候補が含まれていません');
  }
  
  const candidate = jsonResponse.candidates[0];
  
  // finishReasonチェック
  if (candidate.finishReason) {
    logDebug(`finishReason: ${candidate.finishReason}`);
    
    if (candidate.finishReason === 'MAX_TOKENS') {
      throw new Error('Vertex AIの応答がトークン制限により途中で終了しました');
    }
    
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('セーフティフィルターにより応答がブロックされました');
    }
  }
  
  // コンテンツチェック
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    throw new Error('AIの応答に有効なコンテンツが含まれていません');
  }
  
  const contentText = candidate.content.parts[0].text;
  logDebug(`応答テキスト長: ${contentText.length}文字`);
  
  if (LOG_CONFIG.logApiResponses) {
    logDebug('応答テキスト', contentText);
  }
  
  // JSON抽出（括弧で囲まれた部分）
  return extractJSONFromText(contentText);
}

/**
 * テキストからJSONを抽出
 * @param {string} text - テキスト
 * @returns {Object} JSONオブジェクト
 * @throws {Error} JSON抽出エラー
 */
function extractJSONFromText(text) {
  // 最初の{から最後の}までを抽出
  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');
  
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    logError('JSON抽出失敗', { text: text.substring(0, 200) });
    throw new Error('AIの応答からJSONを抽出できませんでした');
  }
  
  const jsonString = text.substring(startIndex, endIndex + 1);
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logError('JSON解析エラー（抽出後）', { jsonString: jsonString.substring(0, 500) });
    throw new Error(`JSON解析エラー: ${error.message}`);
  }
}

/**
 * 抽出情報をバリデーション
 * @param {Object} info - 抽出された情報
 * @param {boolean} requireName - 氏名を必須とするか（デフォルト: true）
 * @throws {Error} バリデーションエラー
 */
function validateExtractedInfo(info, requireName = true) {
  const errors = [];
  
  // 必須フィールドチェック（マージ後のみ）
  if (requireName && (!info.last_name || !info.first_name)) {
    errors.push('氏名が抽出できませんでした');
  }
  
  // データ型チェック
  const requiredStringFields = ['last_name', 'first_name'];
  for (const field of requiredStringFields) {
    if (info[field] && typeof info[field] !== 'string') {
      errors.push(`${field}が文字列ではありません`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error('抽出データバリデーションエラー:\n' + errors.join('\n'));
  }
}

/**
 * 事業所の同一性をAIで判定
 * 
 * @param {string} existingOrgName - 既存事業所名
 * @param {string} existingOrgAddress - 既存事業所住所
 * @param {string} newOrgName - 新規事業所名（名刺から）
 * @param {string} newOrgAddress - 新規事業所住所（名刺から）
 * @returns {boolean} 同一事業所ならtrue
 */
function compareOrganizations(existingOrgName, existingOrgAddress, newOrgName, newOrgAddress) {
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logInfo(`🏢 事業所同一性判定開始`);
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logDebug('既存事業所', { name: existingOrgName, address: existingOrgAddress });
  logDebug('新規事業所', { name: newOrgName, address: newOrgAddress });
  
  try {
    const prompt = `
# 指示

以下の2つの事業所情報は、実質的に同じ事業所を指していますか？
表記の揺れや住所のわずかな違いは許容してください。

回答は必ず true または false のブール値のみで返してください。
JSON形式ではなく、プレーンテキストで "true" または "false" のみを返してください。

# 比較対象

**事業所1（既存データ）**:
- 名称: ${existingOrgName}
- 住所: ${existingOrgAddress}

**事業所2（今回の名刺データ）**:
- 名称: ${newOrgName}
- 住所: ${newOrgAddress}

# 判定基準

- 名称が完全一致または明らかな略称・正式名称の関係
- 住所が完全一致または番地違いのみ
- 上記のいずれかが成立すればtrue

回答: `;
    
    const endpoint = getVertexAIEndpoint(VERTEX_AI_CONFIG.comparisonModel);
    
    // 標準リクエストボディ生成（role: 'user'を保証）
    const requestBody = createVertexAIRequestBody(
      [{ text: prompt }],
      {
        temperature: VERTEX_AI_CONFIG.comparisonTemperature,
        maxOutputTokens: VERTEX_AI_CONFIG.comparisonMaxOutputTokens
      }
    );
    
    // 標準HTTPオプション生成
    const options = createVertexAIFetchOptions(requestBody);
    
    // リクエストボディの妥当性検証（開発時のみ）
    validateVertexAIRequestBody(requestBody);
    
    logInfo(`[Vertex AI] 事業所比較API呼び出し`);
    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode !== 200) {
      logError('事業所比較APIエラー', { responseCode, responseText: responseText.substring(0, 200) });
      throw new Error(`Vertex AI APIエラー: HTTP ${responseCode}`);
    }
    
    const jsonResponse = JSON.parse(responseText);
    
    if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
      throw new Error('AIからの応答に有効な候補が含まれていません');
    }
    
    const aiAnswer = jsonResponse.candidates[0].content.parts[0].text.trim().toLowerCase();
    logInfo(`✅ AI判定結果: ${aiAnswer}`);
    
    return aiAnswer === 'true';
    
  } catch (error) {
    logError('事業所同一性判定エラー（安全のため異なると判断）', error);
    return false;
  }
}
