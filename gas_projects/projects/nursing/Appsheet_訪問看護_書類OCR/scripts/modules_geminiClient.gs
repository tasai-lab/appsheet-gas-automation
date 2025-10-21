/**
 * modules_geminiClient.gs - Gemini API統合モジュール
 *
 * 書類OCR + 構造化データ抽出を1回のAPI呼び出しで実現
 *
 * @version 2.0.0
 * @date 2025-10-18
 */

/**
 * ファイルを解析してOCR + 構造化データを取得
 *
 * ★★★ 重要: Vertex AI APIのみ使用（Google AI Studio APIは完全廃止）
 *
 * @param {string} fileId - Google DriveファイルID
 * @param {string} documentType - 書類種類
 * @param {string} [customInstructions] - カスタム指示（音声/動画用）
 * @param {string} [clientContextInfo] - 利用者コンテキスト情報（音声/動画用）
 * @param {string} [clientBirthDate] - 利用者生年月日（医療保険証・公費で使用）
 * @returns {Object} {ocr_text, summary, title, structured_data}
 */
function analyzeDocumentWithGemini(fileId, documentType, customInstructions, clientContextInfo, clientBirthDate) {
  // ★★★ Vertex AI APIのみ使用（リトライなし、フォールバックなし）
  // 修正日: 2025-10-18
  // 理由: Google AI Studio API無料枠超過（90%エラー）により完全廃止

  logStructured(LOG_LEVEL.INFO, 'Vertex AI APIを使用します（Vertex AIのみ・フォールバックなし）');

  // Vertex AIのみ使用（エラー時は即座にスロー、リトライなし）
  return analyzeDocumentWithVertexAI(fileId, documentType, customInstructions, clientContextInfo, clientBirthDate);
}

/**
 * Vertex AI APIでファイルを解析（MAX_TOKENS時に自動Proモデルリトライ）
 * @private
 */
function analyzeDocumentWithVertexAI(fileId, documentType, customInstructions, clientContextInfo, clientBirthDate) {
  const gcpConfig = getGCPConfig();

  // ファイル情報を取得（共通処理）
  const file = DriveApp.getFileById(fileId);
  const fileBlob = file.getBlob();
  const fileName = file.getName();
  const driveMimeType = fileBlob.getContentType();
  const mimeType = determineMimeType(fileName, driveMimeType);
  const fileCategory = getFileCategory(mimeType, fileName);

  // プロンプト生成（共通処理）
  const prompt = generatePrompt(documentType, fileCategory, customInstructions, clientContextInfo, clientBirthDate);

  logStructured(LOG_LEVEL.INFO, `解析開始 (Vertex AI): ${fileName}`, {
    documentType: documentType,
    fileCategory: fileCategory,
    mimeType: mimeType
  });

  // デバッグ: プロンプトをログ出力
  logStructured(LOG_LEVEL.INFO, `生成されたプロンプト（先頭500文字）: ${prompt.substring(0, 500)}`);
  logStructured(LOG_LEVEL.INFO, `生成されたプロンプト（末尾500文字）: ${prompt.substring(prompt.length - 500)}`);

  // コスト累積用変数
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostJPY = 0;
  let executionCount = 0;

  // 音声ファイルの場合は最初からFallbackモデル（Pro）を使用
  // 理由: 音声の文字起こしは通常大量のトークンを消費するため、MAX_TOKENS回避
  if (fileCategory === 'AUDIO_VISUAL') {
    logStructured(LOG_LEVEL.INFO, `[音声ファイル検出] 最初からFallbackモデルを使用: ${gcpConfig.fallbackModel} (max_tokens=${gcpConfig.fallbackMaxOutputTokens})`);

    // API呼び出し制限チェックは callVertexAIInternal 内で実行される
    const result = callVertexAIInternal(
      gcpConfig.fallbackModel,
      gcpConfig.fallbackMaxOutputTokens,
      gcpConfig.temperature,
      prompt,
      fileBlob,
      mimeType,
      documentType
    );

    // コスト集計
    executionCount++;
    if (result.usageMetadata) {
      totalInputTokens += result.usageMetadata.inputTokens;
      totalOutputTokens += result.usageMetadata.outputTokens;
      totalCostJPY += result.usageMetadata.totalCostJPY;

      // usageMetadataに実行回数を追加
      result.usageMetadata.executionCount = executionCount;
    }

    logStructured(LOG_LEVEL.INFO, '✅ 音声ファイル: Fallbackモデルで正常完了');
    return result;
  }

  // 通常のファイル（画像・PDF）: 1回目はPrimaryモデルで実行
  try {
    logStructured(LOG_LEVEL.INFO, `[1回目] Primaryモデル実行: ${gcpConfig.model} (max_tokens=${gcpConfig.maxOutputTokens})`);

    const result = callVertexAIInternal(
      gcpConfig.model,
      gcpConfig.maxOutputTokens,
      gcpConfig.temperature,
      prompt,
      fileBlob,
      mimeType,
      documentType
    );

    // コスト集計
    executionCount++;
    if (result.usageMetadata) {
      totalInputTokens += result.usageMetadata.inputTokens;
      totalOutputTokens += result.usageMetadata.outputTokens;
      totalCostJPY += result.usageMetadata.totalCostJPY;
    }

    logStructured(LOG_LEVEL.INFO, '✅ Primaryモデルで正常完了');
    return result;

  } catch (error) {
    // Primary失敗時でもコストを記録（errorオブジェクトにusageMetadataが含まれている場合）
    executionCount++;
    if (error.usageMetadata) {
      totalInputTokens += error.usageMetadata.inputTokens;
      totalOutputTokens += error.usageMetadata.outputTokens;
      totalCostJPY += error.usageMetadata.totalCostJPY;

      logStructured(LOG_LEVEL.WARN, `Primaryモデル失敗時のコスト`, {
        model: gcpConfig.model,
        inputTokens: error.usageMetadata.inputTokens,
        outputTokens: error.usageMetadata.outputTokens,
        totalCostJPY: `¥${error.usageMetadata.totalCostJPY.toFixed(2)}`
      });
    }

    // MAX_TOKENSエラーの場合のみFallbackモデルでリトライ
    if (error.message && error.message.includes('MAX_TOKENS')) {
      logStructured(LOG_LEVEL.WARN, `⚠️ MAX_TOKENS検出 - Fallbackモデルでリトライします`, {
        primaryModel: gcpConfig.model,
        primaryMaxTokens: gcpConfig.maxOutputTokens,
        fallbackModel: gcpConfig.fallbackModel,
        fallbackMaxTokens: gcpConfig.fallbackMaxOutputTokens
      });

      // 2回目: Fallbackモデル（Pro）で実行
      logStructured(LOG_LEVEL.INFO, `[2回目] Fallbackモデル実行: ${gcpConfig.fallbackModel} (max_tokens=${gcpConfig.fallbackMaxOutputTokens})`);

      const result = callVertexAIInternal(
        gcpConfig.fallbackModel,
        gcpConfig.fallbackMaxOutputTokens,
        gcpConfig.temperature,
        prompt,
        fileBlob,
        mimeType,
        documentType
      );

      // Fallbackのコスト集計
      executionCount++;
      if (result.usageMetadata) {
        totalInputTokens += result.usageMetadata.inputTokens;
        totalOutputTokens += result.usageMetadata.outputTokens;
        totalCostJPY += result.usageMetadata.totalCostJPY;
      }

      // 合計コストをログ出力
      logStructured(LOG_LEVEL.INFO, `✅ Fallbackモデルで正常完了 - 合計コスト`, {
        executions: executionCount,
        totalInputTokens: totalInputTokens,
        totalOutputTokens: totalOutputTokens,
        totalCostJPY: `¥${totalCostJPY.toFixed(2)}`
      });

      // 合計usageMetadataを上書き
      result.usageMetadata.totalInputTokens = totalInputTokens;
      result.usageMetadata.totalOutputTokens = totalOutputTokens;
      result.usageMetadata.totalCostJPY = totalCostJPY;
      result.usageMetadata.executionCount = executionCount;

      return result;
    }

    // MAX_TOKENS以外のエラーはそのままスロー（コストは既に記録済み）
    throw error;
  }
}

/**
 * Vertex AI API内部呼び出し（共通処理）
 * @private
 */
function callVertexAIInternal(modelName, maxOutputTokens, temperature, prompt, fileBlob, mimeType, documentType) {
  // API呼び出し制限チェック
  incrementApiCallCounter('Vertex_AI');

  const perfStop = perfStart('Vertex_AI_API');

  const endpoint = getVertexAIEndpoint(modelName);
  const token = getOAuth2Token();

  // リクエストボディ構築
  const textPart = { text: prompt };
  const filePart = {
    inline_data: {
      mime_type: mimeType,
      data: Utilities.base64Encode(fileBlob.getBytes())
    }
  };

  const requestBody = {
    contents: [{ role: 'user', parts: [textPart, filePart] }],
    generation_config: {
      response_mime_type: 'application/json',
      temperature: temperature,
      max_output_tokens: maxOutputTokens
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(endpoint, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  const duration = perfStop();
  logApiCall('Vertex_AI', endpoint, responseCode, duration);

  if (responseCode !== 200) {
    throw new Error(`Vertex AI APIエラー（ステータス: ${responseCode}）: ${responseText}`);
  }

  const jsonResponse = JSON.parse(responseText);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    throw new Error("Vertex AIからの応答に有効な候補が含まれていません: " + responseText);
  }

  const candidate = jsonResponse.candidates[0];

  // usageMetadataを先に抽出（失敗時でもコスト記録のため）
  const usageMetadata = extractVertexAIUsageMetadata(jsonResponse, modelName, 'text');
  if (usageMetadata) {
    logStructured(LOG_LEVEL.INFO, 'API使用量', {
      model: modelName,
      inputTokens: usageMetadata.inputTokens,
      outputTokens: usageMetadata.outputTokens,
      totalCostJPY: `¥${usageMetadata.totalCostJPY.toFixed(2)}`
    });
  }

  // finishReasonを確認
  const finishReason = candidate.finishReason;
  logStructured(LOG_LEVEL.INFO, `Vertex AI finishReason: ${finishReason}`, {
    model: modelName,
    maxOutputTokens: maxOutputTokens
  });

  if (finishReason === 'MAX_TOKENS') {
    // MAX_TOKENSエラー時もusageMetadataを付加してスロー
    const error = new Error(`MAX_TOKENS: 出力がトークン制限（${maxOutputTokens}）に達しました。`);
    error.usageMetadata = usageMetadata;
    throw error;
  }

  // JSON抽出
  let content = candidate.content.parts[0].text;
  const resultData = extractJSONFromText(content);

  // usageMetadataを結果に追加
  if (usageMetadata) {
    resultData.usageMetadata = usageMetadata;
  }

  logStructured(LOG_LEVEL.INFO, '解析完了 (Vertex AI)', {
    model: modelName,
    documentType: documentType,
    hasStructuredData: !!resultData.structured_data
  });

  return resultData;
}

/**
 * ★★★ Google AI Studio API関数は完全廃止 ★★★
 *
 * 理由: 無料枠超過により90%エラー発生、200K+リクエスト問題の原因
 * 修正日: 2025-10-18
 * 今後はVertex AI APIのみ使用
 *
 * この関数は削除済みです。analyzeDocumentWithGoogleAI()を呼び出そうとすると
 * エラーが発生します。
 */

/**
 * テキストからJSONを抽出（2段階戦略 + 制御文字サニタイズ）
 * @param {string} text - AIの応答テキスト
 * @returns {Object} - 抽出されたJSONオブジェクト
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
      logStructured(LOG_LEVEL.INFO, 'JSON抽出: Strategy 1 (Markdown) 使用');
      const sanitizedJson = sanitizeJsonString(match[1].trim());
      return JSON.parse(sanitizedJson);
    } catch (error) {
      logStructured(LOG_LEVEL.INFO, `JSON抽出: Strategy 1 失敗: ${error.message}`);
    }
  }

  // Strategy 2: 括弧抽出
  logStructured(LOG_LEVEL.INFO, 'JSON抽出: Strategy 2 (括弧) 使用');
  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const jsonString = text.substring(startIndex, endIndex + 1);
    try {
      const sanitizedJson = sanitizeJsonString(jsonString);
      return JSON.parse(sanitizedJson);
    } catch (error) {
      logStructured(LOG_LEVEL.ERROR, 'JSON解析エラー', {
        error: error.message,
        jsonPreview: jsonString.substring(0, 500),
        position: error.message.match(/position (\d+)/) ? error.message.match(/position (\d+)/)[1] : 'unknown'
      });
      if (error.message.includes('Unexpected end')) {
        throw new Error('AIの応答が途中で終了 (トークン不足の可能性)');
      }
      throw new Error(`JSON解析エラー: ${error.message}`);
    }
  }

  // 両方失敗
  logStructured(LOG_LEVEL.ERROR, 'JSON抽出失敗', {
    textPreview: text.substring(0, 500)
  });
  throw new Error('有効なJSONが見つかりませんでした');
}

/**
 * JSON文字列をサニタイズ（不正な制御文字を削除）
 * @private
 * @param {string} jsonString - サニタイズ対象のJSON文字列
 * @returns {string} サニタイズ済みのJSON文字列
 */
function sanitizeJsonString(jsonString) {
  // 不正な制御文字（\x00-\x1F）を削除
  // ただし、以下の文字は許可する：
  // - \t (0x09): タブ（JSON内で許可）
  // - \n (0x0A): 改行（JSON内で許可）
  // - \r (0x0D): キャリッジリターン（JSON内で許可）

  // 文字列リテラル内の不正な制御文字を削除
  // JSON仕様では、文字列内の制御文字（\x00-\x1F）はエスケープが必要
  let sanitized = jsonString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  return sanitized;
}

/**
 * プロンプト生成（ファイルカテゴリとdocumentType別）
 */
function generatePrompt(documentType, fileCategory, customInstructions, clientContextInfo, clientBirthDate) {
  if (fileCategory === 'DOCUMENT') {
    return generateDocumentPrompt(documentType, clientBirthDate);
  } else if (fileCategory === 'AUDIO_VISUAL') {
    return generateAudioVisualPrompt(documentType, customInstructions, clientContextInfo);
  }

  throw new Error(`予期しないファイルカテゴリ: ${fileCategory}`);
}

/**
 * 画像/PDF用プロンプト（OCR + 構造化データ抽出）
 */
function generateDocumentPrompt(documentType, clientBirthDate) {
  // documentType別の完全なプロンプトを取得（basePromptは使用しない）
  const schema = getStructuredDataSchema(documentType, clientBirthDate);

  // schemasがnull/undefinedの場合は汎用プロンプト
  if (!schema) {
    return `
# 汎用ドキュメントの処理

構造化データ抽出は不要です。ocr_text, summary, titleのみを生成してください。

# 出力形式

{
  "ocr_text": "（重要情報をMarkdown箇条書き形式で記載）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": null
}
`;
  }

  return schema;
}

/**
 * documentType別の構造化データスキーマを取得
 */
function getStructuredDataSchema(documentType, clientBirthDate) {
  // デバッグ: documentTypeの値を確認
  logStructured(LOG_LEVEL.INFO, `getStructuredDataSchema() called with documentType: "${documentType}"`);

  const schemas = {
    '医療保険証': `
# あなたの役割

あなたは、日本の医療保険証・高齢受給者証・限度額適用認定証・減額認定証の画像/PDFを分析し、OCRテキストと構造化データを1回で生成する高度なAIエキスパートです。

# 実行タスク

提供された医療保険証等の画像/PDFから、以下の情報を正確に抽出してください：

1. **重要情報の箇条書き (ocr_text)**: 書類から抽出した重要な情報を、漏れなくMarkdown箇条書き形式で記載
2. **要約 (summary)**: 200文字程度の要約
3. **推奨タイトル (title)**: ファイル名（形式: YYYY-MM-DD_医療保険証_氏名）
4. **構造化データ (structured_data)**: 以下の18項目を抽出

# ocr_textの作成ルール

**重要**: ocr_textには「OCRした全文」を記載するのではなく、「書類から抽出した重要な情報のみ」をMarkdown箇条書き形式でまとめてください。

書類の重要な項目を以下の形式で箇条書きにしてください：

- **保険者番号**: [値]
- **記号**: [値]
- **番号**: [値]
- **有効期間**: [開始日] ～ [終了日]
- **本人・家族区分**: [値]
- **給付割合**: [値]%
- **所得区分**: [値]
- （その他の重要項目も同様に列挙）

**注意点**:
- OCRした文字列を全て出力するのではなく、意味のある項目と値のペアのみを抽出してください
- 不要な罫線、余白、印刷情報などは含めないでください
- 重要な情報（保険番号、日付、金額、区分など）を漏らさず抽出してください

# 前提情報

- 利用者の年齢: ${clientBirthDate ? new Date(new Date() - new Date(clientBirthDate)).getFullYear() - 1970 : '不明'} 歳

# 抽出・変換ルール

- **日付**: 全て西暦の「yyyy/mm/dd」形式に変換してください。和暦は正しく西暦に変換してください。

- **有効期間開始日 (effective_start_date)**: 「yyyy/mm/dd」形式。保険証の有効期間開始日を読み取ってください。

- **有効期間終了日 (effective_end_date)**: 「yyyy/mm/dd」形式。保険証の有効期間終了日を読み取ってください。

- **保険者番号 (insurer_number)**: 保険者番号を文字列として読み取ってください。

- **証記号 (policy_symbol)**: 保険証の記号を文字列として読み取ってください。

- **証番号 (policy_number)**: 保険証の番号を文字列として読み取ってください。

- **枝番 (branch_number)**: 枝番がある場合は読み取ってください。

- **本人・家族区分 (relationship_to_insured)**: 「本人」または「家族」を判別してください。

- **保険分類 (insurance_category)**: 社会保険なら "1"、国民健康保険なら "2" を返してください。

- **給付割合 (benefit_rate)**: 自己負担割合（一部負担金割合）が「3割」であれば給付割合は「7割」となり 70、「2割」であれば 80、「1割」であれば 90 のように、**整数**で返してください。

- **所得区分 (income_category)**: 記載の区分を読み取り、以下の対応表に基づいて**2桁のコード**を返してください。

  - "区ア" / "ア" / "現役並Ⅲ" → "26"
  - "区イ" / "イ" / "現役並Ⅱ" → "27"
  - "区ウ" / "ウ" / "現役並Ⅰ" → "28"
  - "区エ" / "エ" / "一般" / "一般所得者" → "29"
  - "区オ" / "オ" / "低所得者Ⅱ" / "区Ⅱ" → "30"
  - "低所得者Ⅰ" / "区Ⅰ" → "30"
  - "一般Ⅱ" → "41"
  - "一般Ⅰ" → "42"

- **一部負担金区分 (copayment_category) - 別表７**:
  - **利用者の年齢が70歳以上の場合にのみ**、認定証の記載から以下のルールでコードを返してください。
  - 「低所得者Ⅱ」または「区Ⅱ」の記載がある場合 → "1"
  - 「低所得者Ⅰ」または「区Ⅰ」の記載がある場合 → "3"
  - 上記以外で70歳未満の場合はnullを返してください。

- **職務上の事由 (is_work_related_reason) - 別表８**:
  - 職務上の事由に関する記載を読み取り、以下の対応表に基づいて**コード**を返してください。
  - 「職上」または「職務上」と読める記載がある場合 → "1"
  - 「下３」または「下船後３月以内」と読める記載がある場合 → "2"
  - 「通災」または「通勤災害」と読める記載がある場合 → "3"
  - 該当しない場合は null

- **認定証番号 (certificate_number)**: 限度額適用認定証の認定証番号を読み取ってください。

- **固定自己負担額 (fixed_copayment_amount)**: 限度額適用認定証に記載の固定自己負担額を整数で返してください。

- **減免区分 (reduction_category) - 別表９**:
  - 減免に関する記載を読み取り、以下の対応表に基づいて**コード**を返してください。
  - 「減額」と読める記載がある場合 → "1"
  - 「免除」と読める記載がある場合 → "2"
  - 「支払猶予」と読める記載がある場合 → "3"
  - 該当しない場合は null

- **減免率 (reduction_rate_percent)**: 減免率がある場合、整数（%）で返してください。

- **減免額 (reduction_amount)**: 減免額がある場合、整数（円）で返してください。

- **減額認定証有効期限 (reduction_cert_expiration_date)**: 「yyyy/mm/dd」形式。減額認定証の有効期限を読み取ってください。

- 該当する情報が見つからない項目の値は null にしてください。

- **禁止事項**: JSON以外の説明文や\`\`\`jsonマーカーは絶対に含めないでください。

# 出力形式 (このJSONフォーマットを厳守してください)

{
  "ocr_text": "（重要情報をMarkdown箇条書き形式で記載）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "effective_start_date": "string (yyyy/mm/dd) or null",
    "effective_end_date": "string (yyyy/mm/dd) or null",
    "insurer_number": "string or null",
    "policy_symbol": "string or null",
    "policy_number": "string or null",
    "branch_number": "string or null",
    "relationship_to_insured": "string ('本人', '家族'など) or null",
    "insurance_category": "string ('1' or '2') or null",
    "is_work_related_reason": "string ('1', '2', '3') or null",
    "benefit_rate": "number (70, 80, 90など) or null",
    "income_category": "string ('26', '27', '28', '29', '30', '41', '42'のいずれか) or null",
    "copayment_category": "string ('1', '3') or null",
    "certificate_number": "string or null",
    "fixed_copayment_amount": "number or null",
    "reduction_category": "string ('1', '2', '3') or null",
    "reduction_rate_percent": "number or null",
    "reduction_amount": "number or null",
    "reduction_cert_expiration_date": "string (yyyy/mm/dd) or null"
  }
}

# 重要な注意事項

- **すべてのフィールドを必ず出力してください**。書類に記載がない場合は null を設定してください。
- フィールドを省略しないでください。18個すべてのフィールドが必要です。
- コード値は必ず指定された形式（"1", "2", "26"など）で返してください。
`,

    '介護保険証': `
# あなたの役割

あなたは、日本の介護保険被保険者証の画像/PDFを分析し、OCRテキストと構造化データを1回で生成する高度なAIエキスパートです。

# 実行タスク

提供された介護保険被保険者証の画像/PDFから、以下の情報を正確に抽出してください：

1. **重要情報の箇条書き (ocr_text)**: 書類から抽出した重要な情報を、漏れなくMarkdown箇条書き形式で記載
2. **要約 (summary)**: 200文字程度の要約
3. **推奨タイトル (title)**: ファイル名（形式: YYYY-MM-DD_介護保険被保険者証_氏名）
4. **構造化データ (structured_data)**: 以下の8項目を抽出

# ocr_textの作成ルール

**重要**: ocr_textには「OCRした全文」を記載するのではなく、「書類から抽出した重要な情報のみ」をMarkdown箇条書き形式でまとめてください。

書類の重要な項目を以下の形式で箇条書きにしてください：

- **被保険者番号**: [値]
- **保険者番号**: [値]
- **保険者名称**: [値]
- **要介護状態区分**: [値]
- **認定有効期間**: [開始日] ～ [終了日]
- **給付率**: [値]%
- （その他の重要項目も同様に列挙）

**注意点**:
- OCRした文字列を全て出力するのではなく、意味のある項目と値のペアのみを抽出してください
- 不要な罫線、余白、印刷情報などは含めないでください
- 重要な情報（被保険者番号、認定日、要介護度など）を漏らさず抽出してください

# 抽出ルール

- 日付はすべて西暦の「yyyy/mm/dd」形式に変換してください。和暦は正しく西暦に変換してください。

- **被保険者番号 (insured_person_number)**: 10桁の数字。書類から正確に読み取ってください。

- **保険者番号 (insurer_number)**: 6桁の数字。書類から正確に読み取ってください。

- **保険者名称 (insurer_name)**: 市区町村名（例: 八千代市）。書類から正確に読み取ってください。

- **要介護状態区分 (care_level)**: テキストから要介護度を読み取り、以下の対応表に基づいて**2桁のコード**を返してください。

  - "非該当" → "01"

  - "要支援１" または "要支援1" → "12"

  - "要支援２" または "要支援2" → "13"

  - "要介護１" または "要介護1" → "21"

  - "要介護２" または "要介護2" → "22"

  - "要介護３" または "要介護3" → "23"

  - "要介護４" または "要介護4" → "24"

  - "要介護５" または "要介護5" → "25"

  **重要**: 必ず2桁のコード（"01", "12", "21"など）を返してください。文字列（"要介護3"など）は絶対に返さないでください。

- **認定有効期間（開始）(cert_start_date)**: 「yyyy/mm/dd」形式。書類の「認定有効期間」欄から開始日を読み取ってください。

- **認定有効期間（終了）(cert_end_date)**: 「yyyy/mm/dd」形式。書類の「認定有効期間」欄から終了日を読み取ってください。

- **給付率 (benefit_rate)**: 書類から給付率または負担割合を読み取り、以下のように**整数**で返してください。
  - 書類に「9割」「九割」「給付率90%」などの記載がある場合 → 90
  - 書類に「8割」「八割」「給付率80%」などの記載がある場合 → 80
  - 書類に「7割」「七割」「給付率70%」などの記載がある場合 → 70
  - 書類に「1割負担」「一割負担」などの記載がある場合 → 90（9割給付）
  - 書類に「2割負担」「二割負担」などの記載がある場合 → 80（8割給付）
  - 書類に「3割負担」「三割負担」などの記載がある場合 → 70（7割給付）
  - 該当する記載が見つからない場合 → null

- **次回更新確認日 (next_renewal_check_date)**: 「認定有効期間（終了）」の日付を読み取り、その**1ヶ月前の日付**を計算して「yyyy/mm/dd」形式で返してください。

- 該当する情報が見つからない項目の値は null にしてください。

- JSON以外の説明文や\`\`\`jsonマーカーは不要です。

# 出力形式 (このJSONフォーマットを厳守してください)

{
  "ocr_text": "（重要情報をMarkdown箇条書き形式で記載）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "insured_person_number": "string or null",
    "insurer_number": "string or null",
    "insurer_name": "string or null",
    "care_level": "string ('01', '12', '21', '22', '23', '24', '25'のいずれか) or null",
    "cert_start_date": "string (yyyy/mm/dd) or null",
    "cert_end_date": "string (yyyy/mm/dd) or null",
    "benefit_rate": "number (90, 80, 70など) or null",
    "next_renewal_check_date": "string (yyyy/mm/dd) or null"
  }
}

# 重要な注意事項

- **すべてのフィールドを必ず出力してください**。書類に記載がない場合は null を設定してください。
- フィールドを省略しないでください。8つすべてのフィールドが必要です。
- care_levelは必ず2桁のコード形式（"23"など）で返してください。
`,

    '公費': `
# あなたの役割

あなたは、日本の公費負担医療受給者証および限度額適用認定証の画像/PDFを分析し、OCRテキストと構造化データを1回で生成する高度なAIエキスパートです。

# 実行タスク

提供された公費受給者証の画像/PDFから、以下の情報を正確に抽出してください：

1. **重要情報の箇条書き (ocr_text)**: 書類から抽出した重要な情報を、漏れなくMarkdown箇条書き形式で記載
2. **要約 (summary)**: 200文字程度の要約
3. **推奨タイトル (title)**: ファイル名（形式: YYYY-MM-DD_公費受給者証_氏名）
4. **構造化データ (structured_data)**: 以下の13項目を抽出

# ocr_textの作成ルール

**重要**: ocr_textには「OCRした全文」を記載するのではなく、「書類から抽出した重要な情報のみ」をMarkdown箇条書き形式でまとめてください。

書類の重要な項目を以下の形式で箇条書きにしてください：

- **公費制度名**: [値]
- **負担者番号**: [値]
- **受給者番号**: [値]
- **有効期間**: [開始日] ～ [終了日]
- **給付率**: [値]%
- **上限額**: [値]円
- （その他の重要項目も同様に列挙）

**注意点**:
- OCRした文字列を全て出力するのではなく、意味のある項目と値のペアのみを抽出してください
- 不要な罫線、余白、印刷情報などは含めないでください
- 重要な情報（受給者番号、有効期間、上限額など）を漏らさず抽出してください

# 前提情報

- 利用者の年齢: ${clientBirthDate ? new Date(new Date() - new Date(clientBirthDate)).getFullYear() - 1970 : '不明'} 歳

# 抽出ルール

- **日付**: 全て西暦の「yyyy/mm/dd」形式に変換してください。和暦は正しく西暦に変換してください。

- **公費制度名 (subsidy_name)**: OCRテキストの内容と以下の公費マスターを照合し、最も一致する制度の**法別番号（2桁コード）**を返してください。

- **負担者番号 (payer_number)**: 8桁の負担者番号を文字列として読み取ってください。

- **受給者番号 (recipient_number)**: 受給者番号を文字列として読み取ってください。

- **公費負担者番号種別 (subsidy_category_number)**: 種別番号がある場合は読み取ってください。

- **一部負担金区分 (copayment_category)**: **70歳以上の場合にのみ**、記載からルールに従いコードを返してください。
  - "低所得者Ⅱ" or "区Ⅱ" → "1"
  - "低所得者Ⅰ" or "区Ⅰ" → "3"
  - 該当しない場合は null

- **所得区分 (income_category)**: 記載の区分を読み取り、以下の対応表に基づいて**2桁のコード**を返してください。
  - "区ア" / "ア" / "現役並Ⅲ" → "26"
  - "区イ" / "イ" / "現役並Ⅱ" → "27"
  - "区ウ" / "ウ" / "現役並Ⅰ" → "28"
  - "区エ" / "エ" / "一般" / "一般所得者" → "29"
  - "区オ" / "オ" / "低所得者Ⅱ" / "区Ⅱ" → "30"
  - "低所得者Ⅰ" / "区Ⅰ" → "30"
  - "一般Ⅱ" → "41"
  - "一般Ⅰ" → "42"

- **公費給付率 (benefit_rate_percent)**: 給付率を**整数**で返してください（例: 100, 90, 80）。

- **上限単位区分 (limit_unit_type)**: 上限が「月」「日」「回」のいずれか該当する場合、その文字列を返してください。

- **月額上限額 (monthly_limit_amount)**: 月額の上限額を**整数**（円）で返してください。

- **1回あたり上限額 (per_service_limit_amount)**: 1回あたりの上限額を**整数**（円）で返してください。

- **月上限回数 (monthly_visit_limit)**: 月の上限回数を**整数**で返してください。

- **有効期間開始日 (effective_start_date)**: 「yyyy/mm/dd」形式。公費の有効期間開始日を読み取ってください。

- **有効期間終了日 (effective_end_date)**: 「yyyy/mm/dd」形式。公費の有効期間終了日を読み取ってください。

- **数値項目**: 給付率、各種上限額、上限回数は必ず**整数**で返してください。「%」「円」「回」などの記号は含めないでください。

- 該当情報がない場合は null を返してください。

- **「無料」の特別ルール**:
  - 自己負担金に関する記載で、主に「通院」の項目が「無料」と書かれている場合、それは自己負担が0円であることを意味します。
  - その場合は、benefit_rate_percent（公費給付率）を 100 に、monthly_limit_amount（月額上限額）を 0 に設定してください。
  - 他の上限額の記載（例: 5,000円）よりも、この「無料」という記載を優先して判断してください。

- **禁止事項**: JSON以外の説明文や\`\`\`jsonマーカーは絶対に含めないでください。

# 公費マスター（主要な制度）

- "12": 生活保護
- "21": 戦傷病者特別援護法
- "25": 中国残留邦人等
- "51": 特定疾患（指定難病）
- "52": スモン
- "54": 小児慢性特定疾患
- "80": 原子爆弾被爆者援護法

# 出力形式 (このJSONフォーマットを厳守してください)

{
  "ocr_text": "（重要情報をMarkdown箇条書き形式で記載）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "subsidy_name": "string (マスターの法別番号2桁) or null",
    "payer_number": "string (負担者番号8桁) or null",
    "recipient_number": "string (受給者番号) or null",
    "subsidy_category_number": "string or null",
    "copayment_category": "string ('1', '3') or null",
    "income_category": "string ('26', '27', '28', '29', '30', '41', '42'のいずれか) or null",
    "benefit_rate_percent": "number (100, 90, 80など) or null",
    "limit_unit_type": "string ('月', '日', '回') or null",
    "monthly_limit_amount": "number or null",
    "per_service_limit_amount": "number or null",
    "monthly_visit_limit": "number or null",
    "effective_start_date": "string (yyyy/mm/dd) or null",
    "effective_end_date": "string (yyyy/mm/dd) or null"
  }
}

# 重要な注意事項

- **すべてのフィールドを必ず出力してください**。書類に記載がない場合は null を設定してください。
- フィールドを省略しないでください。13個すべてのフィールドが必要です。
- コード値は必ず指定された形式（"12", "26"など）で返してください。
- 数値項目には記号（%、円、回）を含めないでください。
`,

    '口座情報': `
# あなたの役割

あなたは、日本の金融機関の預金口座振替依頼書の画像/PDFを分析し、OCRテキストと構造化データを1回で生成する高度なAIエキスパートです。

# 実行タスク

提供された預金口座振替依頼書の画像/PDFから、以下の情報を正確に抽出してください：

1. **重要情報の箇条書き (ocr_text)**: 書類から抽出した重要な情報を、漏れなくMarkdown箇条書き形式で記載
2. **要約 (summary)**: 200文字程度の要約
3. **推奨タイトル (title)**: ファイル名（形式: YYYY-MM-DD_口座振替依頼書_名義人名）
4. **構造化データ (structured_data)**: 以下の13項目を抽出

# ocr_textの作成ルール

**重要**: ocr_textには「OCRした全文」を記載するのではなく、「書類から抽出した重要な情報のみ」をMarkdown箇条書き形式でまとめてください。

書類の重要な項目を以下の形式で箇条書きにしてください：

- **金融機関名**: [値]
- **支店名**: [値]
- **預金種目**: [値]
- **口座番号**: [値]
- **口座名義人**: [値]
- **委託者番号**: [値]
- （その他の重要項目も同様に列挙）

**注意点**:
- OCRした文字列を全て出力するのではなく、意味のある項目と値のペアのみを抽出してください
- 不要な罫線、余白、印刷情報などは含めないでください
- 重要な情報（口座番号、金融機関コード、名義人など）を漏らさず抽出してください

# 思考プロセス

1.  まず、OCRテキスト全体を注意深く読み、どの金融機関が指定されているか（ゆうちょ銀行か、それ以外の銀行か）を特定します。取消線が引かれている金融機関は無視します。

2.  **ゆうちょ銀行の場合:**

    * bank_name_kana には「ﾕｳﾁﾖｷﾞﾝｺｳ」と設定します。

    * bank_code には「9900」と設定します。

    * OCRテキスト内の「記号」（通常5桁の数字）を探します。

    * **【重要】記号から支店コードを生成します。記号の真ん中の3桁（左から2桁目, 3桁目, 4桁目）をそのまま抜き出し、3桁の支店コードとしてbranch_codeに設定します。（例：記号が「12345」なら、真ん中の3桁「234」を支店コードとします）**

    * account_number にはOCRテキスト内の「番号」（通常8桁）を抽出します。

    * account_type は「普通」と設定します。

3.  **ゆうちょ銀行以外の場合:**

    * OCRテキスト内の「金融機関番号」をbank_codeとして抽出します。

    * 「店舗番号」をbranch_codeとして抽出します。

    * 「口座番号」をaccount_numberとして抽出します。

    * 「預金種目」から「普通」または「当座」を判断し、account_typeに設定します。

4.  上記で特定した金融機関情報に加え、以下の共通項目を抽出します。

    * account_holder_name_kana: 「カナ預金者名」を抽出します。

    * biller_number: 「委託者番号」を抽出します。

    * その他、対応する項目があれば抽出します。

5.  全ての抽出が完了したら、最終的な結果を指示されたJSON形式で出力します。

# 抽出ルールと出力形式

- 上記の思考プロセスに従って、参照情報から以下のJSONオブジェクトのキーに対応する値を抽出してください。

- **金融機関コード (bank_code)**: 4桁の金融機関コード。ゆうちょ銀行の場合は「9900」。

- **金融機関名カナ (bank_name_kana)**: 金融機関名を**半角カタカナ**で返してください。

- **支店コード (branch_code)**: 3桁の支店コード。ゆうちょ銀行の場合は記号の真ん中3桁。

- **預金種目 (account_type)**: 「普通」または「当座」などの文字列。

- **口座番号 (account_number)**: 口座番号を文字列として返してください。

- **口座名義人カナ (account_holder_name_kana)**: 口座名義人を**半角カタカナ**で返してください。

- **取扱日 (handling_date)**: 取扱日を「yyyy/mm/dd」形式で抽出してください（YYYY-MM-DD形式ではなく、yyyy/mm/dd形式）。

- **端末番号 (terminal_number)**: 端末番号を抽出してください。

- **伝票番号 (voucher_number)**: 伝票番号を抽出してください。

- **お客様番号 (biller_client_number)**: お客様番号を抽出してください。

- **委託者カナ氏名 (biller_name_kana)**: 委託者名を**半角カタカナ**で返してください。

- **委託者番号 (biller_number)**: 委託者番号を抽出してください。

- **委託者特定コード (biller_specific_code)**: 委託者特定コードを抽出してください。

- **重要**: カナ名称は、必ず**半角カタカナ**で記述してください。全角カタカナは使用しないでください。

- 該当する情報がない場合や、読み取れない場合は、値に null を設定してください。

- JSON以外の説明文は一切含めないでください。

{
  "ocr_text": "（重要情報をMarkdown箇条書き形式で記載）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "bank_code": "string (4桁) or null",
    "bank_name_kana": "string (半角カナ) or null",
    "branch_code": "string (3桁) or null",
    "account_type": "string (「普通」「当座」など) or null",
    "account_number": "string or null",
    "account_holder_name_kana": "string (半角カナ) or null",
    "handling_date": "string (yyyy/mm/dd) or null",
    "terminal_number": "string or null",
    "voucher_number": "string or null",
    "biller_client_number": "string or null",
    "biller_name_kana": "string (半角カナ) or null",
    "biller_number": "string or null",
    "biller_specific_code": "string or null"
  }
}

# 重要な注意事項

- **すべてのフィールドを必ず出力してください**。書類に記載がない場合は null を設定してください。
- フィールドを省略しないでください。13個すべてのフィールドが必要です。
- カナ名称は必ず半角カタカナで返してください（例: ﾕｳﾁﾖｷﾞﾝｺｳ）。
- 日付は「yyyy/mm/dd」形式で返してください（YYYY-MM-DDではありません）。
`,

    '負担割合証': `
# あなたの役割

あなたは、日本の介護保険負担割合証の画像/PDFを分析し、OCRテキストと構造化データを1回で生成する高度なAIエキスパートです。

# 実行タスク

提供された介護保険負担割合証の画像/PDFから、以下の情報を正確に抽出してください：

1. **重要情報の箇条書き (ocr_text)**: 書類から抽出した重要な情報を、漏れなくMarkdown箇条書き形式で記載
2. **要約 (summary)**: 200文字程度の要約
3. **推奨タイトル (title)**: ファイル名（形式: YYYY-MM-DD_負担割合証_氏名）
4. **構造化データ (structured_data)**: 以下の5項目を抽出

# ocr_textの作成ルール

**重要**: ocr_textには「OCRした全文」を記載するのではなく、「書類から抽出した重要な情報のみ」をMarkdown箇条書き形式でまとめてください。

書類の重要な項目を以下の形式で箇条書きにしてください：

- **負担割合**: [値]割
- **有効期間**: [開始日] ～ [終了日]
- **交付年月日**: [値]
- （その他の重要項目も同様に列挙）

**注意点**:
- OCRした文字列を全て出力するのではなく、意味のある項目と値のペアのみを抽出してください
- 不要な罫線、余白、印刷情報などは含めないでください
- 重要な情報（負担割合、有効期間など）を漏らさず抽出してください

# 抽出ルール

- **日付**: 全て西暦の「yyyy/mm/dd」形式に変換してください。和暦は正しく西暦に変換してください。

- **負担割合 (copayment_rate)**: 書類から負担割合を読み取り、「1割」「2割」「3割」のいずれかの文字列で返してください。

- **給付率 (benefit_rate)**: 負担割合に応じて、以下のように**整数**で返してください。
  - 「1割」の場合 → 90
  - 「2割」の場合 → 80
  - 「3割」の場合 → 70

- **有効期間開始日 (effective_start_date)**: 「yyyy/mm/dd」形式。負担割合証の有効期間開始日を読み取ってください。

- **有効期間終了日 (effective_end_date)**: 「yyyy/mm/dd」形式。負担割合証の有効期間終了日を読み取ってください。

- **交付年月日 (issue_date)**: 「yyyy/mm/dd」形式。負担割合証の交付年月日を読み取ってください。

- 該当する情報が見つからない項目の値は null にしてください。

- JSON以外の説明文や\`\`\`jsonマーカーは不要です。

# 出力形式 (このJSONフォーマットを厳守してください)

{
  "ocr_text": "（重要情報をMarkdown箇条書き形式で記載）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "copayment_rate": "string ('1割', '2割', '3割'のいずれか) or null",
    "benefit_rate": "number (90, 80, 70のいずれか) or null",
    "effective_start_date": "string (yyyy/mm/dd) or null",
    "effective_end_date": "string (yyyy/mm/dd) or null",
    "issue_date": "string (yyyy/mm/dd) or null"
  }
}

# 重要な注意事項

- **すべてのフィールドを必ず出力してください**。書類に記載がない場合は null を設定してください。
- フィールドを省略しないでください。5個すべてのフィールドが必要です。
- copayment_rateは必ず「1割」「2割」「3割」のいずれかの形式で返してください。
- benefit_rateは必ず整数（90, 80, 70）で返してください。
`
  };

  // 指示書系（包含マッチ）
  if (documentType.includes('指示書')) {
    logStructured(LOG_LEVEL.INFO, `プロンプト選択: 指示書用プロンプト（包含マッチ）`);
    return `
# あなたの役割

あなたは、日本の訪問看護指示書の画像/PDFを分析し、OCRテキストと構造化データを1回で生成する高度なAIエキスパートです。

# 実行タスク

提供された訪問看護指示書の画像/PDFから、以下の情報を正確に抽出してください：

1. **重要情報の箇条書き (ocr_text)**: 書類から抽出した重要な情報を、漏れなくMarkdown箇条書き形式で記載
2. **要約 (summary)**: 200文字程度の要約
3. **推奨タイトル (title)**: ファイル名（形式: YYYY-MM-DD_訪問看護指示書_患者名）
4. **構造化データ (structured_data)**: 以下の13項目を抽出

# ocr_textの作成ルール

**重要**: ocr_textには「OCRした全文」を記載するのではなく、「書類から抽出した重要な情報のみ」をMarkdown箇条書き形式でまとめてください。

書類の重要な項目を以下の形式で箇条書きにしてください：

- **指示区分**: [値]
- **指示期間**: [開始日] ～ [終了日]
- **交付年月日**: [値]
- **医療機関名**: [値]
- **医師名**: [値]
- **傷病名**: [一覧]
- **指示内容**: [詳細]
- （その他の重要項目も同様に列挙）

**注意点**:
- OCRした文字列を全て出力するのではなく、意味のある項目と値のペアのみを抽出してください
- 不要な罫線、余白、印刷情報などは含めないでください
- 重要な情報（指示期間、傷病名、指示内容など）を漏らさず抽出してください

# 抽出ルール

- **日付**: 全て西暦の「yyyy/mm/dd」形式に変換してください。和暦（令和、昭和など）は正しく西暦に変換してください。

- **指示区分 (instructionType)**: テキストの内容から最も適切なものを以下のマスターから選び、2桁のコードを返してください。
  - 在宅患者訪問点滴注射指示書については、instructionStartDateの値が存在しない場合のみ適用とする。

  - "01": 訪問看護指示
  - "02": 特別訪問看護指示
  - "03": 精神科訪問看護指示
  - "04": 精神科特別訪問看護指示
  - "05": 医療観察精神科訪問看護指示
  - "06": 医療観察精神科特別訪問看護指示
  - "00": 在宅患者訪問点滴注射指示書

- **指示期間開始日 (instructionStartDate)**: 「yyyy/mm/dd」形式。指示期間の開始日を読み取ってください。

- **指示期間終了日 (instructionEndDate)**: 「yyyy/mm/dd」形式。指示期間の終了日を読み取ってください。

- **点滴注射開始日 (dripInfusionStartDate)**: 「yyyy/mm/dd」形式。点滴注射の開始日を読み取ってください。

- **点滴注射終了日 (dripInfusionEndDate)**: 「yyyy/mm/dd」形式。点滴注射の終了日を読み取ってください。

- **交付年月日 (issueDate)**: 「yyyy/mm/dd」形式。指示書の交付年月日を読み取ってください。

- **医療機関住所 (clinicAddress)**: 指示書を発行した医療機関の**都道府県名から始まる完全な住所**を抽出してください。

- **基準告示第２の１に規定する疾病 (specifiedDiseaseNoticeCode)**:
  - 傷病名が以下の「疾病等マスター」に一つでも該当する場合、その疾病のコードを specifiedDiseaseCodes にリストで返し、specifiedDiseaseNoticeCode は "01" を返す。
  - 一つも該当しない場合、specifiedDiseaseCodes は空の配列([])を返し、specifiedDiseaseNoticeCode は "03" を返す。

- **傷病一覧 (diseaseNameList)**: 指示書に記載されている「主たる傷病名」を、記載されている順番を厳守してリスト化してください。番号や「(コード: ...」のような付随情報は含めず、傷病名そのものだけを抽出してください。

- **傷病名コード (diseaseMedicalCode1, diseaseMedicalCode2, diseaseMedicalCode3)**: diseaseNameList の各傷病名に対応するコードを、指示書テキスト内から抽出して返してください。テキスト内にコードの記載がない傷病名については、nullを返してください。3つに満たない場合も同様にnullを返してください。

- 該当する情報がない場合は null を返してください。

# 疾病等マスター

- "001": 末期の悪性腫瘍 (胃癌末期、肺癌末期なども含む)

- "002": 多発性硬化症

- "003": 重症筋無力症

- "004": スモン

- "005": 筋萎縮性側索硬化症

- "006": 脊髄小脳変性症

- "007": ハンチントン病

- "008": 進行性筋ジストロフィー症

- "009": パーキンソン病関連疾患（進行性核上性麻痺、大脳皮質基底核変性症、パーキンソン病（ホーエン・ヤールの重症度分類がステージ３以上であって生活機能障害度が２度又は３度のものに限る。））

- "010": 多系統萎縮症（線条体黒質変性症、オリーブ橋小脳萎縮症、シャイ・ドレーガー症候群）

- "011": プリオン病

- "012": 亜急性硬化性全脳炎

- "013": ライソゾーム病

- "014": 副腎白質ジストロフィー

- "015": 脊髄性筋萎縮症

- "016": 球脊髄性筋萎縮症

- "017": 慢性炎症性脱髄性多発神経炎

- "018": 後天性免疫不全症候群

- "019": 頸髄損傷

# 出力形式 (このJSONフォーマットを厳守してください)

{
  "ocr_text": "（重要情報をMarkdown箇条書き形式で記載）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "instructionType": "string ('01', '02', '03', '04', '05', '06', '00'のいずれか)",
    "instructionStartDate": "string (yyyy/mm/dd) or null",
    "instructionEndDate": "string (yyyy/mm/dd) or null",
    "dripInfusionStartDate": "string (yyyy/mm/dd) or null",
    "dripInfusionEndDate": "string (yyyy/mm/dd) or null",
    "issueDate": "string (yyyy/mm/dd) or null",
    "clinicAddress": "string (都道府県名から始まる完全な住所) or null",
    "specifiedDiseaseNoticeCode": "string ('01' or '03')",
    "specifiedDiseaseCodes": ["string (疾病コードのリスト)"] or [],
    "diseaseNameList": ["string (傷病名のリスト)"],
    "diseaseMedicalCode1": "string or null",
    "diseaseMedicalCode2": "string or null",
    "diseaseMedicalCode3": "string or null"
  }
}

# 重要な注意事項

- **すべてのフィールドを必ず出力してください**。書類に記載がない場合は null を設定してください（配列の場合は空配列[]）。
- フィールドを省略しないでください。13個すべてのフィールドが必要です。
- instructionTypeは必ず2桁のコード（"01", "02"など）で返してください。
- specifiedDiseaseNoticeCodeは必ず "01" または "03" のいずれかを返してください。
- specifiedDiseaseCodesとdiseaseNameListは配列形式で返してください。
- JSON以外の説明文や\`\`\`jsonマーカーは絶対に含めないでください。
`;
  }

  // schemas から該当するプロンプトを返す
  if (schemas[documentType]) {
    logStructured(LOG_LEVEL.INFO, `プロンプト選択: "${documentType}"用の専用プロンプト`);
    return schemas[documentType];
  }

  // デフォルト（汎用ドキュメント）
  logStructured(LOG_LEVEL.WARN, `プロンプト選択: 汎用プロンプト（マッチなし）。documentType="${documentType}", 利用可能なキー=[${Object.keys(schemas).join(', ')}]`);
  return `
# 汎用ドキュメントの処理

構造化データ抽出は不要です。書類から重要な情報のみを箇条書きで抽出してください。

# ocr_textの作成ルール

**重要**: ocr_textには「OCRした全文」を記載するのではなく、「書類から抽出した重要な情報のみ」をMarkdown箇条書き形式でまとめてください。

書類の重要な項目を以下の形式で箇条書きにしてください：

- **[項目名1]**: [値]
- **[項目名2]**: [値]
- **[項目名3]**: [値]
- （その他の重要項目も同様に列挙）

**注意点**:
- OCRした文字列を全て出力するのではなく、意味のある項目と値のペアのみを抽出してください
- 不要な罫線、余白、印刷情報などは含めないでください
- 書類に記載されている重要な情報を漏らさず抽出してください

# 出力形式

{
  "ocr_text": "（重要情報をMarkdown箇条書き形式で記載）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": null
}
`;
}

/**
 * 音声/動画用プロンプト（議事録形式での要点まとめ）
 */
function generateAudioVisualPrompt(documentType, customInstructions, clientContextInfo) {
  let contextSection = '';
  if (clientContextInfo && clientContextInfo.trim() !== '') {
    contextSection = `
# コンテキスト情報

${clientContextInfo}

---
`;
  }

  let specificInstructions = customInstructions || `
音声/動画の内容を分析し、議事録形式で要点をまとめてください。
`;

  return `
# あなたの役割

医療・介護現場の音声/動画を分析し、議事録形式で要点をまとめる専門のAIアシスタントです。

${contextSection}

# 指示

音声/動画の内容を聞き取り、以下の形式で議事録を作成してください：

${specificInstructions}

# 議事録の構成

ocr_textフィールドには、以下の構成でMarkdown形式の議事録を作成してください：

## 1. 基本情報
- 日時（音声から推測できる場合）
- 参加者（音声から推測できる場合）
- 場所・形式（音声から推測できる場合）

## 2. 主な議題・トピック
- 話し合われた主要なテーマを箇条書きで列挙

## 3. 議論の内容
- 各議題について話し合われた内容を要約
- 重要な発言や意見を引用
- 賛否や異なる意見があればそれも記録

## 4. 決定事項
- 会議で決まったこと
- 合意された内容

## 5. アクションアイテム（TODO）
- 誰が何をいつまでにするか
- 担当者と期限が明確な場合は記載

## 6. 次回予定・その他
- 次回の予定
- その他の重要事項や備考

# 重要な注意事項

- 音声の内容を忠実に反映しつつ、冗長な部分は省略して要点を抽出してください
- 発言の主旨を損なわないように注意してください
- 専門用語や固有名詞は正確に記録してください
- 数値や日付などの具体的な情報は漏らさず記載してください
- 議論の流れが分かるように、論理的な順序で整理してください

# 出力形式

{
  "ocr_text": "（議事録、Markdown形式）",
  "summary": "（200文字程度の要約。会議の目的と主な結論を簡潔に）",
  "title": "（推奨ファイル名: YYYY-MM-DD_議事録_テーマ）",
  "structured_data": null
}
`;
}

// ============================================
// ヘルパー関数
// ============================================

/**
 * MIMEタイプ決定
 */
function determineMimeType(fileName, driveMimeType) {
  const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';

  const extensionMap = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
    'gif': 'image/gif', 'webp': 'image/webp', 'pdf': 'application/pdf',
    'm4a': 'audio/mp4', 'mp3': 'audio/mpeg', 'wav': 'audio/wav',
    'ogg': 'audio/ogg', 'flac': 'audio/flac',
    'mp4': 'video/mp4', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo',
    '3gp': 'video/3gpp', '3gpp': 'video/3gpp', 'webm': 'video/webm'
  };

  const mimeFromExtension = extensionMap[extension];

  if (mimeFromExtension) {
    if (mimeFromExtension !== driveMimeType && driveMimeType !== 'application/octet-stream') {
      logStructured(LOG_LEVEL.INFO, `MIMEタイプ補正: ${driveMimeType} → ${mimeFromExtension}`);
    }
    return mimeFromExtension;
  }

  return driveMimeType;
}

/**
 * ファイルカテゴリ判定
 */
function getFileCategory(mimeType, fileName) {
  if (!mimeType) {
    throw new Error(`ファイル「${fileName}」のMIMEタイプを取得できませんでした`);
  }

  const lowerMimeType = mimeType.toLowerCase();

  // 汎用バイナリ形式のチェック
  const genericMimeTypes = ['application/octet-stream', 'binary/octet-stream'];
  if (genericMimeTypes.includes(lowerMimeType)) {
    throw new Error(`ファイル「${fileName}」のMIMEタイプを特定できませんでした (${mimeType})`);
  }

  // ドキュメント（画像・PDF）
  if (lowerMimeType.startsWith('image/') || lowerMimeType.includes('pdf')) {
    return 'DOCUMENT';
  }

  // 音声・動画
  if (lowerMimeType.startsWith('audio/') || lowerMimeType.startsWith('video/')) {
    return 'AUDIO_VISUAL';
  }

  throw new Error(`ファイル「${fileName}」はサポートされていない形式です (${mimeType})`);
}

// ============================================
// 料金計算機能
// ============================================

/**
 * 為替レート設定（USD → JPY）
 * 2025年1月時点の想定レート
 */
const EXCHANGE_RATE_USD_TO_JPY_OCR = 150;

/**
 * Vertex AI APIレスポンスからusageMetadataを抽出（日本円計算付き）
 * @param {Object} jsonResponse - APIレスポンス
 * @param {string} modelName - 使用したモデル名
 * @param {string} inputType - 入力タイプ ('audio' | 'text' | 'image')
 * @return {Object|null} {inputTokens, outputTokens, inputCostJPY, outputCostJPY, totalCostJPY, model}
 */
function extractVertexAIUsageMetadata(jsonResponse, modelName, inputType = 'text') {
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
  const inputCostJPY = inputCostUSD * EXCHANGE_RATE_USD_TO_JPY_OCR;
  const outputCostJPY = outputCostUSD * EXCHANGE_RATE_USD_TO_JPY_OCR;
  const totalCostJPY = totalCostUSD * EXCHANGE_RATE_USD_TO_JPY_OCR;

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
function normalizeModelNameOCR(modelName) {
  // undefinedやnullの場合はデフォルト値を返す
  if (!modelName) {
    logStructured(LOG_LEVEL.WARN, '[正規化] モデル名が未定義です。デフォルト値を使用します。');
    return 'gemini-2.5-flash';
  }

  // 'gemini-2.5-flash-001' → 'gemini-2.5-flash'
  // 'publishers/google/models/gemini-2.5-flash' → 'gemini-2.5-flash'
  const match = modelName.match(/(gemini-[\d.]+-(?:flash|pro|flash-lite))/i);
  return match ? match[1].toLowerCase() : modelName.toLowerCase();
}

/**
 * Vertex AIモデルの価格情報を取得（モデル名と入力タイプに応じて動的に決定）
 * @param {string} modelName - モデル名
 * @param {string} inputType - 入力タイプ ('audio' | 'text' | 'image')
 * @return {Object} {inputPer1M, outputPer1M}
 */
function getVertexAIPricing(modelName, inputType = 'text') {
  // 2025年1月時点のVertex AI価格（USD/100万トークン）
  // 実際の価格はGCPドキュメントを参照: https://cloud.google.com/vertex-ai/generative-ai/pricing
  const pricingTable = {
    'gemini-2.5-flash': {
      text: { inputPer1M: 0.075, outputPer1M: 0.30 },
      image: { inputPer1M: 0.075, outputPer1M: 0.30 },  // 画像・PDF入力
      audio: { inputPer1M: 1.00, outputPer1M: 2.50 }  // 音声入力（GA版）
    },
    'gemini-2.5-flash-lite': {
      text: { inputPer1M: 0.0188, outputPer1M: 0.075 },
      image: { inputPer1M: 0.0188, outputPer1M: 0.075 },
      audio: { inputPer1M: 0.0188, outputPer1M: 0.075 }
    },
    'gemini-2.5-pro': {
      text: { inputPer1M: 1.25, outputPer1M: 10.00 },
      image: { inputPer1M: 1.25, outputPer1M: 10.00 },  // 画像・PDF入力
      audio: { inputPer1M: 1.25, outputPer1M: 10.00 }  // 音声入力
    },
    'gemini-1.5-flash': {
      text: { inputPer1M: 0.075, outputPer1M: 0.30 },
      image: { inputPer1M: 0.075, outputPer1M: 0.30 },
      audio: { inputPer1M: 0.075, outputPer1M: 0.30 }
    },
    'gemini-1.5-pro': {
      text: { inputPer1M: 1.25, outputPer1M: 5.00 },
      image: { inputPer1M: 1.25, outputPer1M: 5.00 },
      audio: { inputPer1M: 1.25, outputPer1M: 5.00 }
    }
  };

  // モデル名を正規化
  const normalizedModelName = normalizeModelNameOCR(modelName);

  // モデルが見つからない場合はデフォルト価格を使用
  if (!pricingTable[normalizedModelName]) {
    logStructured(LOG_LEVEL.WARN, `[価格取得] 未知のモデル: ${modelName}, デフォルト価格（gemini-2.5-flash）を使用`);
    return pricingTable['gemini-2.5-flash'][inputType] || pricingTable['gemini-2.5-flash']['text'];
  }

  // 入力タイプが見つからない場合はテキスト価格を使用
  if (!pricingTable[normalizedModelName][inputType]) {
    logStructured(LOG_LEVEL.WARN, `[価格取得] 未知の入力タイプ: ${inputType}, テキスト価格を使用`);
    return pricingTable[normalizedModelName]['text'];
  }

  logStructured(LOG_LEVEL.INFO, `[価格取得] モデル: ${normalizedModelName}, 入力タイプ: ${inputType}`);
  return pricingTable[normalizedModelName][inputType];
}
