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

  // usageMetadataを抽出して追加（料金計算）
  const usageMetadata = extractVertexAIUsageMetadata(jsonResponse, gcpConfig.model, 'text');
  if (usageMetadata) {
    resultData.usageMetadata = usageMetadata;
    logStructured(LOG_LEVEL.INFO, 'API使用量', {
      inputTokens: usageMetadata.inputTokens,
      outputTokens: usageMetadata.outputTokens,
      totalCostJPY: `¥${usageMetadata.totalCostJPY.toFixed(2)}`
    });
  }

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
# あなたの役割

あなたは医療保険証、高齢受給者証、限度額適用認定証、減額認定証などを統合的に解析し、指定されたコード体系に従って情報を変換するエキスパートです。

以下のOCRテキストから、指定された項目を抽出し、厳密なJSON形式で出力してください。

# 前提情報

- 利用者の年齢: ${clientBirthDate ? new Date(new Date() - new Date(clientBirthDate)).getFullYear() - 1970 : '不明'} 歳

# 抽出・変換ルール

- **日付**: 全て西暦の「yyyy/mm/dd」形式に変換してください。

- **保険分類 (insurance_category)**: 社会保険なら "1"、国民健康保険なら "2" を返してください。

- **給付割合 (benefit_rate)**: 自己負担割合（一部負担金割合）が「3割」であれば給付割合は「7割」となり 70、「9割」であれば 90 のように、**整数**で返してください。

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

- **減免区分 (reduction_category) - 別表９**:

  - 減免に関する記載を読み取り、以下の対応表に基づいて**コード**を返してください。

  - 「減額」と読める記載がある場合 → "1"

  - 「免除」と読める記載がある場合 → "2"

  - 「支払猶予」と読める記載がある場合 → "3"

- 該当する情報が見つからない項目の値は null にしてください。

- **禁止事項**: JSON以外の説明文や\`\`\`jsonマーカーは絶対に含めないでください。

# 出力形式 (このJSONフォーマットを厳守してください)

{
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
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
    "benefit_rate": "number or null",
    "income_category": "string or null",
    "copayment_category": "string ('1', '3') or null",
    "certificate_number": "string or null",
    "fixed_copayment_amount": "number or null",
    "reduction_category": "string ('1', '2', '3') or null",
    "reduction_rate_percent": "number or null",
    "reduction_amount": "number or null",
    "reduction_cert_expiration_date": "string (yyyy/mm/dd) or null"
  }
}
`,

    '介護保険証': `
# あなたの役割

あなたは介護保険被保険者証を解析するエキスパートです。

以下のOCRテキストから、指定された項目を抽出し、厳密なJSON形式で出力してください。

# 抽出ルール

- 日付はすべて西暦の「yyyy/mm/dd」形式に変換してください。和暦は正しく西暦に変換してください。

- **要介護状態区分 (care_level)**: テキストから要介護度を読み取り、以下の対応表に基づいて**2桁のコード**を返してください。

  - "非該当" → "01"

  - "要支援１" → "12"

  - "要支援２" → "13"

  - "要介護１" → "21"

  - "要介護２" → "22"

  - "要介護３" → "23"

  - "要介護４" → "24"

  - "要介護５" → "25"

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
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "insured_person_number": "string or null",
    "insurer_number": "string or null",
    "insurer_name": "string or null",
    "care_level": "string ('12', '21'など) or null",
    "cert_start_date": "string (yyyy/mm/dd) or null",
    "cert_end_date": "string (yyyy/mm/dd) or null",
    "benefit_rate": "number (90, 80, 70など) or null",
    "next_renewal_check_date": "string (yyyy/mm/dd) or null"
  }
}
`,

    '公費': `
# あなたの役割

あなたは公費負担医療受給者証および限度額適用認定証を解析するエキスパートです。

以下のOCRテキストから、指定された項目を抽出し、厳密なJSON形式で出力してください。

# 前提情報

- 利用者の年齢: ${clientBirthDate ? new Date(new Date() - new Date(clientBirthDate)).getFullYear() - 1970 : '不明'} 歳

# 抽出ルール

- **公費制度名 (subsidy_name)**: OCRテキストの内容と以下の公費マスターを照合し、最も一致する制度の**法別番号（2桁コード）**を返してください。

- **所得区分 (income_category)**: 記載の区分を読み取り、以下の対応表に基づいて**2桁のコード**を返してください。

  - "区ア" / "ア" / "現役並Ⅲ" → "26"

  - "区イ" / "イ" / "現役並Ⅱ" → "27"

  - "区ウ" / "ウ" / "現役並Ⅰ" → "28"

  - "区エ" / "エ" / "一般" / "一般所得者" → "29"

  - "区オ" / "オ" / "低所得者Ⅱ" / "区Ⅱ" → "30"

  - "低所得者Ⅰ" / "区Ⅰ" → "30"

  - "一般Ⅱ" → "41"

  - "一般Ⅰ" → "42"

- **一部負担金区分 (copayment_category)**: **70歳以上の場合にのみ**、記載からルールに従いコードを返してください。

  - "低所得者Ⅱ" or "区Ⅱ" → "1"

  - "低所得者Ⅰ" or "区Ⅰ" → "3"

- **数値項目**: 給付率、各種上限額、上限回数は必ず**整数**で返してください。「%」「円」「回」などの記号は含めないでください。

- **日付**: 全て「yyyy/mm/dd」形式にしてください。

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
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "subsidy_name": "string (マスターの法別番号) or null",
    "payer_number": "string (負担者番号8桁) or null",
    "recipient_number": "string (受給者番号) or null",
    "subsidy_category_number": "string or null",
    "copayment_category": "string ('1', '3'など) or null",
    "income_category": "string ('26', '27'...) or null",
    "benefit_rate_percent": "number or null",
    "limit_unit_type": "string ('月', '日', '回') or null",
    "monthly_limit_amount": "number or null",
    "per_service_limit_amount": "number or null",
    "monthly_visit_limit": "number or null",
    "effective_start_date": "string (yyyy/mm/dd) or null",
    "effective_end_date": "string (yyyy/mm/dd) or null"
  }
}
`,

    '口座情報': `
# あなたの役割

あなたは、金融機関の帳票を読み取る専門のOCR AIです。提供された「預金口座振替依頼書」のOCRテキストから、データベース登録に必要な情報を極めて正確に抽出してください。

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

- **重要**: カナ名称は、必ず**半角カタカナ**で記述してください。

- 該当する情報がない場合や、読み取れない場合は、値に null を設定してください。

- JSON以外の説明文は一切含めないでください。

{
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "bank_code": "金融機関コード（4桁）",
    "bank_name_kana": "金融機関名（半角カナ）",
    "branch_code": "支店コード（3桁）",
    "account_type": "預金種目（「普通」「当座」など）",
    "account_number": "口座番号",
    "account_holder_name_kana": "口座名義人（半角カナ）",
    "handling_date": "取扱日をYYYY-MM-DD形式で抽出",
    "terminal_number": "端末番号",
    "voucher_number": "伝票番号",
    "biller_client_number": "お客様番号",
    "biller_name_kana": "委託者カナ氏名（半角カナ）",
    "biller_number": "委託者番号",
    "biller_specific_code": "委託者特定コード"
  }
}
`,

    '負担割合証': `
# あなたの役割

あなたは介護保険負担割合証を解析するエキスパートです。

以下のOCRテキストから、指定された項目を抽出し、厳密なJSON形式で出力してください。

# 抽出ルール

- 日付はすべて西暦の「yyyy/mm/dd」形式に変換してください。和暦は正しく西暦に変換してください。

- **負担割合 (copayment_rate)**: 「1割」「2割」「3割」のいずれかの文字列で返してください。

- **給付率 (benefit_rate)**: 負担割合に応じて、90, 80, 70 のいずれかの**整数**で返してください。

- 該当する情報が見つからない項目の値は null にしてください。

- JSON以外の説明文や\`\`\`jsonマーカーは不要です。

# 出力形式 (このJSONフォーマットを厳守してください)

{
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "copayment_rate": "string ('1割', '2割', '3割') or null",
    "benefit_rate": "number (90, 80, 70) or null",
    "effective_start_date": "string (yyyy/mm/dd) or null",
    "effective_end_date": "string (yyyy/mm/dd) or null",
    "issue_date": "string (yyyy/mm/dd) or null"
  }
}
`
  };

  // 指示書系（包含マッチ）
  if (documentType.includes('指示書')) {
    return `
あなたは医療文書を解析するエキスパートです。

以下の訪問看護指示書のテキストから、指定された項目を抽出し、厳密なJSON形式で出力してください。

# 指示ルール

- 指示区分 (instructionType): テキストの内容から最も適切なものを以下のマスターから選び、コードを返す。

- 在宅患者訪問点滴注射指示書については、instructionStartDateの値が存在しない場合のみ適用とする。

  - 01: 訪問看護指示

  - 02: 特別訪問看護指示

  - 03: 精神科訪問看護指示

  - 04: 精神科特別訪問看護指示

  - 05: 医療観察精神科訪問看護指示

  - 06: 医療観察精神科特別訪問看護指示

  - 00: 在宅患者訪問点滴注射指示書

- 日付 (instructionStartDate, instructionEndDate, dripInfusionStartDate, dripInfusionEndDate, issueDate): 日付はすべて西暦の「yyyy/mm/dd」形式に変換する。和暦（令和、昭和など）は正しく西暦に変換する。該当がない場合は null を返す。

- 基準告示第２の１に規定する疾病 (specifiedDiseaseNoticeCode):

  - 傷病名が以下の「疾病等マスター」に一つでも該当する場合、その疾病のコードを specifiedDiseaseCodes にリストで返し、specifiedDiseaseNoticeCode は "01" を返す。

  - 一つも該当しない場合、specifiedDiseaseCodes は空の配列([])を返し、specifiedDiseaseNoticeCode は "03" を返す。

- 傷病一覧 (diseaseNameList): 指示書に記載されている「主たる傷病名」を、記載されている順番を厳守してリスト化してください。番号や「(コード: ...」のような付随情報は含めず、傷病名そのものだけを抽出してください。

- 傷病名コード (diseaseMedicalCode1, 2, 3): diseaseNameList の各傷病名に対応するコードを、指示書テキスト内から抽出して返してください。テキスト内にコードの記載がない傷病名については、nullを返してください。3つに満たない場合も同様にnullを返してください。

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
  "ocr_text": "（Markdown形式の構造化OCRテキスト）",
  "summary": "（200文字程度の要約）",
  "title": "（推奨ファイル名）",
  "structured_data": {
    "instructionType": "string",
    "instructionStartDate": "string (yyyy/mm/dd) or null",
    "instructionEndDate": "string (yyyy/mm/dd) or null",
    "dripInfusionStartDate": "string (yyyy/mm/dd) or null",
    "dripInfusionEndDate": "string (yyyy/mm/dd) or null",
    "issueDate": "string (yyyy/mm/dd) or null",
    "clinicAddress": "指示書を発行した医療機関の【都道府県名から始まる完全な住所】",
    "specifiedDiseaseNoticeCode": "string ('01' or '03')",
    "specifiedDiseaseCodes": ["string"],
    "diseaseNameList": ["string"],
    "diseaseMedicalCode1": "string or null",
    "diseaseMedicalCode2": "string or null",
    "diseaseMedicalCode3": "string or null"
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
