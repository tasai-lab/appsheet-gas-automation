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
 * Vertex AI APIでファイルを解析
 * @private
 */
function analyzeDocumentWithVertexAI(fileId, documentType, customInstructions, clientContextInfo, clientBirthDate) {
  // API呼び出し制限チェック
  incrementApiCallCounter('Vertex_AI');

  const perfStop = perfStart('Vertex_AI_API');

  // ファイル取得とMIMEタイプ判定
  const file = DriveApp.getFileById(fileId);
  const fileBlob = file.getBlob();
  const fileName = file.getName();
  const driveMimeType = fileBlob.getContentType();
  const mimeType = determineMimeType(fileName, driveMimeType);
  const fileCategory = getFileCategory(mimeType, fileName);

  logStructured(LOG_LEVEL.INFO, `解析開始 (Vertex AI): ${fileName}`, {
    documentType: documentType,
    fileCategory: fileCategory,
    mimeType: mimeType
  });

  // プロンプト生成
  const prompt = generatePrompt(documentType, fileCategory, customInstructions, clientContextInfo, clientBirthDate);

  // GCP設定取得
  const gcpConfig = getGCPConfig();
  const endpoint = getVertexAIEndpoint();
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
      temperature: gcpConfig.temperature,
      max_output_tokens: gcpConfig.maxOutputTokens
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

  // finishReasonを確認
  const finishReason = candidate.finishReason;
  if (finishReason === 'MAX_TOKENS') {
    logStructured(LOG_LEVEL.ERROR, 'Vertex AIの出力がトークン制限に達しました', {
      finishReason: finishReason,
      maxOutputTokens: gcpConfig.maxOutputTokens
    });
    throw new Error(`Vertex AIの出力がトークン制限（${gcpConfig.maxOutputTokens}）に達しました。書類が長すぎる可能性があります。`);
  }

  // JSON抽出
  let content = candidate.content.parts[0].text;
  const resultData = extractJSONFromText(content);

  logStructured(LOG_LEVEL.INFO, '解析完了 (Vertex AI)', {
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
 * テキストからJSONを抽出（2段階戦略）
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
      return JSON.parse(match[1].trim());
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
      return JSON.parse(jsonString);
    } catch (error) {
      logStructured(LOG_LEVEL.ERROR, 'JSON解析エラー', {
        error: error.message,
        jsonPreview: jsonString.substring(0, 500)
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
  const basePrompt = `
# あなたの役割

あなたは、日本の医療・介護分野で使われる書類「${documentType}」を分析し、OCRテキストと構造化データを1回で生成する高度なAIエキスパートです。

# 実行タスク

提供された書類の画像/PDFから、以下の情報を正確に抽出してください：

1. **構造化OCRテキスト (ocr_text)**: Markdown形式で全文を構造化
2. **要約 (summary)**: 200文字程度の要約
3. **推奨タイトル (title)**: ファイル名（形式: YYYY-MM-DD_書類種類_主要名）
4. **構造化データ (structured_data)**: ${documentType}から抽出すべき項目の構造化データ

# 共通ルール

- **日付**: すべて「yyyy/mm/dd」形式に統一（和暦→西暦変換）
- **判読不能**: 読めない文字は [判読不能] と記述（推測禁止）
- **null値**: 該当情報がない項目は null
- **整数**: 給付割合等は整数（例: 70, 80, 90）

`;

  // documentType別のスキーマ定義
  const schema = getStructuredDataSchema(documentType, clientBirthDate);

  return basePrompt + schema;
}

/**
 * documentType別の構造化データスキーマを取得
 */
function getStructuredDataSchema(documentType, clientBirthDate) {
  const schemas = {
    '医療保険証': `
# 医療保険証の構造化データ抽出ルール

**重要**: 後期高齢者医療（保険者番号が39で始まる）の場合：
- relationship_to_insured は必ず「本人」
- 給付割合が80（2割負担）なら income_category は「41」
- 給付割合が90（1割負担）なら income_category は「42」

${clientBirthDate ? `**利用者生年月日**: ${clientBirthDate}（年齢計算に使用）` : ''}

**有効期限終了日がない場合**: effective_end_date は「9999/12/31」

# 出力形式

{
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "effective_start_date": "yyyy/mm/dd or null",
    "effective_end_date": "yyyy/mm/dd or null (なければ9999/12/31)",
    "insurer_number": "string or null",
    "policy_symbol": "string or null",
    "policy_number": "string or null",
    "branch_number": "string or null",
    "relationship_to_insured": "本人 or 家族 or null",
    "insurance_category": "string or null",
    "is_work_related_reason": "string or null",
    "benefit_rate": 70,
    "income_category": "string or null",
    "certificate_number": "string or null",
    "fixed_copayment_amount": "string or null",
    "reduction_category": "string or null",
    "reduction_rate_percent": "string or null",
    "reduction_amount": "string or null",
    "reduction_cert_expiration_date": "yyyy/mm/dd or null"
  }
}
`,

    '介護保険証': `
# 介護保険証の構造化データ抽出ルール

**被保険者番号 (insured_person_number)** - ★最重要項目★:
- 介護保険証の最も重要な識別情報です
- 通常10桁の数字で表示されます（例: 1234567890）
- 「被保険者番号」というラベルの近くに記載されています
- OCR認識が困難な場合でも、数字の並びを注意深く読み取ってください
- 複数行に分かれている場合は連結してください
- ハイフンやスペースは除去して数字のみを抽出してください

**要介護状態区分 (care_level)**: 以下のコードに変換
- "非該当" → "01", "要支援１" → "12", "要支援２" → "13"
- "要介護１" → "21", "要介護２" → "22", "要介護３" → "23"
- "要介護４" → "24", "要介護５" → "25"

**次回更新確認日 (next_renewal_check_date)**: 認定有効期間（終了）の1ヶ月前

# 出力形式

{
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "insured_person_number": "string or null (10桁程度の数字、ハイフン・スペース除去)",
    "insurer_name": "string or null",
    "insurer_code": "string or null",
    "care_level": "01 or 12 or 13 or 21-25 or null",
    "cert_start_date": "yyyy/mm/dd or null",
    "cert_end_date": "yyyy/mm/dd or null",
    "next_renewal_check_date": "yyyy/mm/dd or null (cert_end_dateの1ヶ月前)"
  }
}
`,

    '公費': `
# 公費受給者証の構造化データ抽出ルール

${clientBirthDate ? `**利用者生年月日**: ${clientBirthDate}（年齢計算・公費名称判定に使用）` : ''}

**公費番号から公費名称を判定**:
- "12" → "生活保護"
- "25" → "中国残留邦人等"
- "51" → "特定疾患（指定難病）"
- "54" → "小児慢性特定疾患"

# 出力形式

{
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "subsidy_number": "string or null",
    "subsidy_name": "string or null",
    "recipient_number": "string or null",
    "subsidy_start_date": "yyyy/mm/dd or null",
    "subsidy_end_date": "yyyy/mm/dd or null",
    "burden_limit_amount": "string or null"
  }
}
`,

    '口座情報': `
# 口座振替依頼書の構造化データ抽出ルール

**口座種目**: 「普通」「当座」「貯蓄」等

# 出力形式

{
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "bank_name": "string or null",
    "bank_code": "string or null",
    "branch_name": "string or null",
    "branch_code": "string or null",
    "account_type": "普通 or 当座 or 貯蓄 or null",
    "account_number": "string or null",
    "account_holder_name": "string or null"
  }
}
`,

    '負担割合証': `
# 負担割合証の構造化データ抽出ルール

**被保険者番号 (insured_person_number)** - ★最重要項目★:
- 介護保険の被保険者を識別する重要な情報です
- 通常10桁の数字で表示されます（例: 1234567890）
- 「被保険者番号」というラベルの近くに記載されています
- OCR認識が困難な場合でも、数字の並びを注意深く読み取ってください
- 複数行に分かれている場合は連結してください
- ハイフンやスペースは除去して数字のみを抽出してください

**負担割合 (copayment_rate)** - ★最重要項目★:
- 「1割」→ 10, 「2割」→ 20, 「3割」→ 30 (整数で返す)
- 「利用者負担の割合」「負担割合」などのラベルの近くに記載されています
- 必ず整数値で返してください（10, 20, 30のいずれか）

**適用期間 (copay_cert_start_date, copay_cert_end_date)** - ★最重要項目★:
- 「適用期間」「有効期間」「認定有効期間」などのラベルで記載されています
- 通常「令和○年○月○日から令和○年○月○日まで」のような形式です
- 和暦（令和・平成等）は必ず西暦に変換してください
  - 令和1年 = 2019年
  - 令和2年 = 2020年
  - 令和3年 = 2021年
  - 令和4年 = 2022年
  - 令和5年 = 2023年
  - 令和6年 = 2024年
  - 令和7年 = 2025年
- 出力形式は「yyyy/mm/dd」で統一してください（例: 2025/04/01）
- 両方の日付を必ず抽出してください

# 出力形式

{
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "insured_person_number": "string or null (10桁程度の数字、ハイフン・スペース除去)",
    "copayment_rate": 10 or 20 or 30 or null (必ず整数),
    "copay_cert_start_date": "yyyy/mm/dd or null (和暦を西暦に変換)",
    "copay_cert_end_date": "yyyy/mm/dd or null (和暦を西暦に変換)"
  }
}
`
  };

  // 指示書系（包含マッチ）
  if (documentType.includes('指示書')) {
    return `
# 訪問看護指示書の構造化データ抽出ルール

**指示期間**: 開始日と終了日を必ず抽出
**病名・主たる傷病名**: すべての記載を抽出

# 出力形式

{
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "instruction_period_start": "yyyy/mm/dd or null",
    "instruction_period_end": "yyyy/mm/dd or null",
    "medical_institution_name": "string or null",
    "doctor_name": "string or null",
    "disease_name": "string or null",
    "instructions_summary": "string or null"
  }
}
`;
  }

  // デフォルト（汎用ドキュメント）
  return `
# 汎用ドキュメントの処理

構造化データ抽出は不要です。ocr_text, summary, titleのみを生成してください。

# 出力形式

{
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": null
}
`;
}

/**
 * 音声/動画用プロンプト（文字起こし + 構造化）
 * ※書類仕分けでは使用しないため、シンプルな実装
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
音声/動画の内容を文字起こしし、要約を作成してください。
構造化データは不要です（structured_dataはnullで返してください）。
`;

  return `
# あなたの役割

医療・介護現場の音声/動画を分析し、文字起こしと要約を生成するAIアシスタントです。

${contextSection}

# 指示

${specificInstructions}

# 出力形式

{
  "ocr_text": "（文字起こしテキスト、Markdown形式）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名: YYYY-MM-DD_種類_名前）",
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
