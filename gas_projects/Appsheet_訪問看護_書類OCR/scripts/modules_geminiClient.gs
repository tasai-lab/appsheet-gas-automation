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
 * @param {string} fileId - Google DriveファイルID
 * @param {string} documentType - 書類種類
 * @param {string} [customInstructions] - カスタム指示（音声/動画用）
 * @param {string} [clientContextInfo] - 利用者コンテキスト情報（音声/動画用）
 * @param {string} [clientBirthDate] - 利用者生年月日（医療保険証・公費で使用）
 * @returns {Object} {ocr_text, summary, title, structured_data}
 */
function analyzeDocumentWithGemini(fileId, documentType, customInstructions, clientContextInfo, clientBirthDate) {
  const perfStop = perfStart('Gemini_API');

  // ファイル取得とMIMEタイプ判定
  const file = DriveApp.getFileById(fileId);
  const fileBlob = file.getBlob();
  const fileName = file.getName();
  const driveMimeType = fileBlob.getContentType();
  const mimeType = determineMimeType(fileName, driveMimeType);
  const fileCategory = getFileCategory(mimeType, fileName);

  logStructured(LOG_LEVEL.INFO, `解析開始: ${fileName}`, {
    documentType: documentType,
    fileCategory: fileCategory,
    mimeType: mimeType
  });

  // プロンプト生成
  const prompt = generatePrompt(documentType, fileCategory, customInstructions, clientContextInfo, clientBirthDate);

  // Gemini API呼び出し
  const textPart = { text: prompt };
  const filePart = {
    inlineData: {
      mimeType: mimeType,
      data: Utilities.base64Encode(fileBlob.getBytes())
    }
  };

  const requestBody = {
    contents: [{ parts: [textPart, filePart] }],
    generationConfig: {
      responseMimeType: GEMINI_CONFIG.responseMimeType,
      temperature: GEMINI_CONFIG.temperature,
      maxOutputTokens: GEMINI_CONFIG.maxOutputTokens
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.model}:generateContent?key=${GEMINI_CONFIG.apiKey}`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  const duration = perfStop();
  logApiCall('Gemini', url, responseCode, duration);

  if (responseCode !== 200) {
    throw new Error(`Gemini APIエラー（ステータス: ${responseCode}）: ${responseText}`);
  }

  const jsonResponse = JSON.parse(responseText);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    throw new Error("AIからの応答に有効な候補が含まれていません: " + responseText);
  }

  // JSON抽出
  let content = jsonResponse.candidates[0].content.parts[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    logStructured(LOG_LEVEL.ERROR, 'JSONの抽出に失敗', { content: content.substring(0, 500) });
    throw new Error("AIの応答からJSONを抽出できませんでした");
  }

  const resultData = JSON.parse(jsonMatch[0]);

  logStructured(LOG_LEVEL.INFO, '解析完了', {
    documentType: documentType,
    hasStructuredData: !!resultData.structured_data
  });

  return resultData;
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

**負担割合 (copayment_rate)**: 「1割」→ 10, 「2割」→ 20, 「3割」→ 30 (整数)

# 出力形式

{
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "insured_person_number": "string or null (10桁程度の数字、ハイフン・スペース除去)",
    "copayment_rate": 10,
    "copay_cert_start_date": "yyyy/mm/dd or null",
    "copay_cert_end_date": "yyyy/mm/dd or null"
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
