/**
 * modules_documentProcessor.gs - 書類種類別処理モジュール
 *
 * 構造化データを受け取り、種類別テーブルにレコードを作成
 *
 * @version 2.0.0
 * @date 2025-10-18
 */

/**
 * documentType別に構造化データを処理してテーブルに書き込み
 * @param {string} documentType - 書類種類
 * @param {Object} structuredData - Geminiから抽出された構造化データ
 * @param {Object} context - コンテキスト情報（clientId, documentId, staffId, ocrText等）
 * @returns {string} 作成されたレコードID（またはnull）
 */
function processStructuredData(documentType, structuredData, context) {
  logStructured(LOG_LEVEL.INFO, `書類仕分け処理開始: ${documentType}`, { documentId: context.documentId });

  try {
    let recordId = null;

    // 提供票は特殊処理（別途Gemini API呼び出し）
    if (documentType === '提供票') {
      if (!context.ocrText) {
        throw new Error('提供票処理にはocrTextが必要です');
      }
      recordId = createServiceProvisionFormRecord(context, context.ocrText);

      if (recordId) {
        logStructured(LOG_LEVEL.INFO, `提供票レコード作成完了`, { recordId });
      }

      return recordId;
    }

    // structured_dataがnullの場合は何もしない（汎用ドキュメント等）
    if (!structuredData) {
      logStructured(LOG_LEVEL.INFO, 'structured_dataがnullのためスキップ', { documentType });
      return null;
    }

    // Geminiから返された生データをログ出力
    logStructured(LOG_LEVEL.INFO, `Gemini抽出データ（生データ）: ${documentType}`, {
      structuredData: JSON.stringify(structuredData, null, 2)
    });

    switch (documentType) {
      case '医療保険証':
        recordId = createMedicalInsuranceRecord(context, structuredData);
        break;

      case '介護保険証':
        recordId = createLtciInsuranceRecord(context, structuredData);
        break;

      case '公費':
        recordId = createPublicSubsidyRecord(context, structuredData);
        break;

      case '口座情報':
        recordId = createBankAccountRecord(context, structuredData);
        break;

      case '負担割合証':
        recordId = createCopayCertRecord(context, structuredData);
        break;

      default:
        // 指示書系（包含マッチ）
        if (documentType.includes('指示書')) {
          recordId = createInstructionRecord(context, structuredData);
        } else {
          logStructured(LOG_LEVEL.WARN, `未対応の書類タイプ: ${documentType}`);
        }
        break;
    }

    if (recordId) {
      logStructured(LOG_LEVEL.INFO, `レコード作成完了: ${documentType}`, { recordId });
    }

    return recordId;

  } catch (error) {
    logStructured(LOG_LEVEL.ERROR, `書類仕分け処理エラー: ${documentType}`, {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// ============================================
// 医療保険証
// ============================================

function createMedicalInsuranceRecord(context, data) {
  const safeParseInt = (value) => {
    if (value === null || value === undefined) return null;
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  };

  const todayJSTStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const todayJST = new Date(todayJSTStr);

  // 有効/無効判定
  let isCurrentlyActive = null;
  if (data.effective_start_date) {
    const startDate = new Date(data.effective_start_date);
    const endDateStr = data.effective_end_date;
    const isEndDateValid = (!endDateStr || new Date(endDateStr) >= todayJST);

    if (startDate <= todayJST && isEndDateValid) {
      isCurrentlyActive = true;
    } else {
      isCurrentlyActive = false;
    }
  }

  // 給付割合のデフォルト値設定
  let benefitRate = safeParseInt(data.benefit_rate);
  if (benefitRate === null) {
    benefitRate = 70; // デフォルトは3割負担
    logStructured(LOG_LEVEL.INFO, "給付割合が不明のため、デフォルト値の'70' (3割負担)に設定しました");
  }

  // 本人・家族区分と所得区分の判定ロジック
  let finalIncomeCategory = data.income_category;
  let finalRelationship = data.relationship_to_insured;
  const insurerNumber = data.insurer_number;

  // 後期高齢者医療の場合、優先的に判定を実行
  if (insurerNumber && String(insurerNumber).startsWith('39')) {
    logStructured(LOG_LEVEL.INFO, "後期高齢者医療の保険証として検出。優先判定ロジックを適用します");

    // 本人・家族区分を'本人'に設定
    finalRelationship = '本人';
    logStructured(LOG_LEVEL.INFO, `本人・家族区分を'${finalRelationship}'に設定しました`);

    // 所得区分の判定
    if (benefitRate === 80) { // 2割負担
      finalIncomeCategory = '41';
      logStructured(LOG_LEVEL.INFO, `2割負担のため、所得区分を'${finalIncomeCategory}'に設定しました`);
    } else if (benefitRate === 90) { // 1割負担
      finalIncomeCategory = '42';
      logStructured(LOG_LEVEL.INFO, `1割負担のため、所得区分を'${finalIncomeCategory}'に設定しました`);
    }
  }

  const nowJST = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  const newId = `MEDI-${Utilities.getUuid().substring(0, 8)}`;

  // 終了日のデフォルト値設定
  let effectiveEndDate = data.effective_end_date;
  if (data.effective_start_date && !effectiveEndDate) {
    effectiveEndDate = '2999/12/31';
  }

  const rowData = {
    medical_insurance_id: newId,
    status: '編集中',
    client_id: context.clientId,
    source_document_id: context.documentId,
    created_at: nowJST,
    created_by: context.staffId,
    updated_at: nowJST,
    updated_by: context.staffId,
    is_currently_active: isCurrentlyActive,
    effective_start_date: data.effective_start_date,
    effective_end_date: effectiveEndDate,
    insurer_number: data.insurer_number,
    policy_symbol: data.policy_symbol,
    policy_number: data.policy_number,
    branch_number: data.branch_number,
    relationship_to_insured: finalRelationship,
    insurance_category: data.insurance_category,
    is_work_related_reason: data.is_work_related_reason,
    benefit_rate: benefitRate,
    income_category: finalIncomeCategory,
    copayment_category: data.copayment_category,
    certificate_number: data.certificate_number,
    fixed_copayment_amount: safeParseInt(data.fixed_copayment_amount),
    reduction_category: data.reduction_category,
    reduction_rate_percent: safeParseInt(data.reduction_rate_percent),
    reduction_amount: safeParseInt(data.reduction_amount),
    reduction_cert_expiration_date: data.reduction_cert_expiration_date,
    remarks: null
  };

  callAppSheetApi(TABLE_NAMES.medicalInsurance, 'Add', [rowData]);
  return newId;
}

// ============================================
// 介護保険証
// ============================================

function createLtciInsuranceRecord(context, data) {
  const newId = `LTCI-${Utilities.getUuid().substring(0, 8)}`;

  // care_levelのデータ正規化（Geminiが文字列を返した場合の対策）
  let careLevel = data.care_level;
  if (careLevel && typeof careLevel === 'string') {
    // 文字列の場合、コードに変換
    const careLevelMap = {
      '非該当': '01',
      '要支援１': '12', '要支援1': '12',
      '要支援２': '13', '要支援2': '13',
      '要介護１': '21', '要介護1': '21',
      '要介護２': '22', '要介護2': '22',
      '要介護３': '23', '要介護3': '23',
      '要介護４': '24', '要介護4': '24',
      '要介護５': '25', '要介護5': '25'
    };

    if (careLevelMap[careLevel]) {
      careLevel = careLevelMap[careLevel];
      logStructured(LOG_LEVEL.INFO, `care_levelを変換: ${data.care_level} → ${careLevel}`);
    } else if (!/^\d{2}$/.test(careLevel)) {
      // 2桁の数字でもマップにもない場合は警告
      logStructured(LOG_LEVEL.WARN, `未知のcare_level形式: ${careLevel}`);
    }
  }

  // 終了日が設定されていない場合のデフォルト値
  let finalCertEndDate = data.cert_end_date;
  if (data.cert_start_date && !finalCertEndDate) {
    finalCertEndDate = '2999/12/31';
  }

  const rowData = {
    ltci_insurance_id: newId,
    client_id: context.clientId,
    source_document_id: context.documentId,
    status: '編集中',
    created_by: context.staffId,
    updated_by: context.staffId,
    insured_person_number: data.insured_person_number,
    insurer_number: data.insurer_number,
    insurer_name: data.insurer_name,
    care_level: careLevel,
    cert_start_date: data.cert_start_date,
    cert_end_date: finalCertEndDate,
    benefit_rate: data.benefit_rate,
    next_renewal_check_date: data.next_renewal_check_date
  };

  callAppSheetApi(TABLE_NAMES.ltciInsurance, 'Add', [rowData]);
  return newId;
}

// ============================================
// 公費
// ============================================

function createPublicSubsidyRecord(context, data) {
  const parseIntStrict = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const digitsOnly = String(value).replace(/[^0-9]/g, '');
    if (digitsOnly === '') return null;
    return parseInt(digitsOnly, 10);
  };

  const todayJSTStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const todayJST = new Date(todayJSTStr);

  // Geminiが異なるスキーマで返す場合があるため、データを正規化
  let subsidyName = data.subsidy_name;
  let payerNumber = data.payer_number;
  let recipientNumber = data.recipient_number;
  let subsidyCategoryNumber = data.subsidy_category_number;
  let copaymentCategory = data.copayment_category;
  let incomeCategory = data.income_category;
  let benefitRatePercent = data.benefit_rate_percent;
  let limitUnitType = data.limit_unit_type;
  let monthlyLimitAmount = data.monthly_limit_amount;
  let perServiceLimitAmount = data.per_service_limit_amount;
  let monthlyVisitLimit = data.monthly_visit_limit;
  let effectiveStartDate = data.effective_start_date;
  let effectiveEndDate = data.effective_end_date;

  // ネストされた構造の変換
  if (!subsidyName && data.subsidy && data.subsidy.name) {
    subsidyName = data.subsidy.name;
  }
  if (!recipientNumber && data.recipient && data.recipient.number) {
    recipientNumber = data.recipient.number;
  }
  if (!effectiveStartDate && data.validity_period && data.validity_period.start_date) {
    effectiveStartDate = data.validity_period.start_date;
  }
  if (!effectiveEndDate && data.validity_period && data.validity_period.end_date) {
    effectiveEndDate = data.validity_period.end_date;
  }

  // 有効性判定（元のスクリプトと同じロジック）
  let isCurrentlyActive = null;
  if (effectiveStartDate) {
    const startDate = new Date(effectiveStartDate);
    const endDateStr = effectiveEndDate;
    const isEndDateValid = (!endDateStr || new Date(endDateStr) >= todayJST);

    if (startDate <= todayJST && isEndDateValid) {
      isCurrentlyActive = true;
    } else {
      isCurrentlyActive = false;
    }
  }

  // 終了日が設定されていない場合のデフォルト値
  if (effectiveStartDate && !effectiveEndDate) {
    effectiveEndDate = '2999/12/31';
  }

  const nowJST = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  const newId = `CLPB-${Utilities.getUuid().substring(0, 8)}`;

  const rowData = {
    // --- システム項目 ---
    public_subsidy_id: newId,
    status: '編集中',
    client_id: context.clientId,
    source_document_id: context.documentId,
    created_at: nowJST,
    created_by: context.staffId,
    updated_at: nowJST,
    updated_by: context.staffId,

    // --- スクリプトによる判定項目 ---
    is_currently_active: isCurrentlyActive,

    // --- AIによる抽出項目 ---
    subsidy_name: subsidyName,
    payer_number: payerNumber,
    recipient_number: recipientNumber,
    subsidy_category_number: subsidyCategoryNumber,
    copayment_category: copaymentCategory,
    income_category: incomeCategory,
    benefit_rate_percent: parseIntStrict(benefitRatePercent),
    limit_unit_type: limitUnitType,
    monthly_limit_amount: parseIntStrict(monthlyLimitAmount),
    per_service_limit_amount: parseIntStrict(perServiceLimitAmount),
    monthly_visit_limit: parseIntStrict(monthlyVisitLimit),
    effective_start_date: effectiveStartDate,
    effective_end_date: effectiveEndDate,

    // --- 手動入力項目 (今回はnull) ---
    priority_rank: null,
    remarks: null
  };

  callAppSheetApi(TABLE_NAMES.publicSubsidy, 'Add', [rowData]);
  return newId;
}

// ============================================
// 口座情報
// ============================================

function createBankAccountRecord(context, data) {
  const newId = `BACC-${Utilities.getUuid().substring(0, 8)}`;

  // 半角カナ変換関数
  const toHalfWidthKana = (str) => str ? String(str).replace(/[\u30A1-\u30F6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60)) : null;

  const bankNameKana = toHalfWidthKana(data.bank_name_kana);
  const accountHolderNameKana = toHalfWidthKana(data.account_holder_name_kana);
  const billerNameKana = toHalfWidthKana(data.biller_name_kana);

  // 口座番号の調整（ゆうちょ銀行などの特殊処理）
  let adjustedAccountNumber = data.account_number ? String(data.account_number).trim() : null;
  if (adjustedAccountNumber && adjustedAccountNumber.length === 8) {
    const originalNumber = adjustedAccountNumber;
    if (data.bank_code === '9900') {
      // ゆうちょ銀行の場合
      if (adjustedAccountNumber.endsWith('1')) {
        adjustedAccountNumber = adjustedAccountNumber.substring(0, 7);
        logStructured(LOG_LEVEL.INFO, `口座番号調整(ゆうちょ): ${originalNumber} -> ${adjustedAccountNumber}`);
      }
    } else {
      // その他の銀行の場合
      adjustedAccountNumber = adjustedAccountNumber.slice(-7);
      logStructured(LOG_LEVEL.INFO, `口座番号調整(その他): ${originalNumber} -> ${adjustedAccountNumber}`);
    }
  }

  // extractedInfoのその他のフィールドもすべて含める（元のスクリプトと同じ）
  var extractedInfo = {};
  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      extractedInfo[key] = data[key];
    }
  }
  extractedInfo.bank_name_kana = bankNameKana;
  extractedInfo.account_holder_name_kana = accountHolderNameKana;
  extractedInfo.biller_name_kana = billerNameKana;
  extractedInfo.account_number = adjustedAccountNumber;

  var rowData = {
    bank_account_id: newId,
    client_id: context.clientId,
    source_document_id: context.documentId,
    status: '編集中',
    created_by: context.staffId,
    updated_by: context.staffId
  };

  for (var key in extractedInfo) {
    if (extractedInfo.hasOwnProperty(key)) {
      rowData[key] = extractedInfo[key];
    }
  }

  callAppSheetApi(TABLE_NAMES.bankAccount, 'Add', [rowData]);
  return newId;
}

// ============================================
// 負担割合証
// ============================================

function createCopayCertRecord(context, data) {
  const newId = `COPAY-${Utilities.getUuid().substring(0, 8)}`;

  let effectiveEndDate = data.effective_end_date;
  if (data.effective_start_date && !effectiveEndDate) {
    effectiveEndDate = '2999/12/31';
  }

  const rowData = {
    copay_cert_id: newId,
    client_id: context.clientId,
    source_document_id: context.documentId,
    status: '編集中',
    created_by: context.staffId,
    updated_by: context.staffId,
    copayment_rate: data.copayment_rate,
    benefit_rate: data.benefit_rate,
    effective_start_date: data.effective_start_date,
    effective_end_date: effectiveEndDate,
    issue_date: data.issue_date
  };

  callAppSheetApi(TABLE_NAMES.copaymentCert, 'Add', [rowData]);
  return newId;
}

// ============================================
// 指示書
// ============================================

/**
 * 都道府県コードを取得
 * @param {string} address - 住所
 * @returns {string|null} - 都道府県コード（01-47）
 */
function getPrefectureCode(address) {
  if (!address || typeof address !== 'string') return null;

  const prefMap = {
    '北海道': '01', '青森県': '02', '岩手県': '03', '宮城県': '04', '秋田県': '05',
    '山形県': '06', '福島県': '07', '茨城県': '08', '栃木県': '09', '群馬県': '10',
    '埼玉県': '11', '千葉県': '12', '東京都': '13', '神奈川県': '14', '新潟県': '15',
    '富山県': '16', '石川県': '17', '福井県': '18', '山梨県': '19', '長野県': '20',
    '岐阜県': '21', '静岡県': '22', '愛知県': '23', '三重県': '24', '滋賀県': '25',
    '京都府': '26', '大阪府': '27', '兵庫県': '28', '奈良県': '29', '和歌山県': '30',
    '鳥取県': '31', '島根県': '32', '岡山県': '33', '広島県': '34', '山口県': '35',
    '徳島県': '36', '香川県': '37', '愛媛県': '38', '高知県': '39', '福岡県': '40',
    '佐賀県': '41', '長崎県': '42', '熊本県': '43', '大分県': '44', '宮崎県': '45',
    '鹿児島県': '46', '沖縄県': '47'
  };

  for (const pref in prefMap) {
    if (address.includes(pref)) {
      return prefMap[pref];
    }
  }

  return null;
}

function createInstructionRecord(context, data) {
  const newId = `ODR-${Utilities.getUuid().substring(0, 8)}`;

  const prefectureCode = getPrefectureCode(data.clinicAddress);

  let instructionEndDate = data.instructionEndDate;
  if (data.instructionStartDate && !instructionEndDate) {
    instructionEndDate = '2999/12/31';
  }

  let dripEndDate = data.dripInfusionEndDate;
  if (data.dripInfusionStartDate && !dripEndDate) {
    dripEndDate = '2999/12/31';
  }

  const rowData = {
    instruction_id: newId,
    client_id: context.clientId,
    source_document_id: context.documentId,
    status: '適用前（編集中）',
    created_by: context.staffId,
    updated_by: context.staffId,
    instruction_type: data.instructionType,
    start_date: data.instructionStartDate,
    end_date: instructionEndDate,
    iv_drip_start_date: data.dripInfusionStartDate,
    iv_drip_end_date: dripEndDate,
    issue_date: data.issueDate,
    clinic_prefecture_code: prefectureCode
  };

  const instructionType = data.instructionType;
  if (instructionType !== '02' && instructionType !== '04') {
    rowData.notified_disease_category = data.specifiedDiseaseNoticeCode;
    rowData.notified_disease_codes = (data.specifiedDiseaseCodes || []).join(', ');
    rowData.disease_1_code = data.diseaseMedicalCode1;
    rowData.disease_2_code = data.diseaseMedicalCode2;
    rowData.disease_3_code = data.diseaseMedicalCode3;

    rowData.disease_1_unlisted_name = data.diseaseMedicalCode1 ? null : (data.diseaseNameList && data.diseaseNameList.length > 0 ? data.diseaseNameList[0] : null);
    rowData.disease_2_unlisted_name = data.diseaseMedicalCode2 ? null : (data.diseaseNameList && data.diseaseNameList.length > 1 ? data.diseaseNameList[1] : null);
    rowData.disease_3_unlisted_name = data.diseaseMedicalCode3 ? null : (data.diseaseNameList && data.diseaseNameList.length > 2 ? data.diseaseNameList[2] : null);
  }

  callAppSheetApi(TABLE_NAMES.instruction, 'Add', [rowData]);
  return newId;
}

// ============================================
// 提供票（特殊処理：別途Gemini API呼び出し）
// ============================================

/**
 * 提供票のレコードを作成（ハイブリッド方式）
 * @param {Object} context - コンテキスト情報
 * @param {string} ocrText - OCRテキスト
 * @returns {string} 作成されたform_id
 */
function createServiceProvisionFormRecord(context, ocrText) {
  logStructured(LOG_LEVEL.INFO, '提供票処理開始（ハイブリッド方式）', { documentId: context.documentId });

  // 1. サービスマスターを取得
  const serviceMasterMap = getServiceMasterAsMap();

  // 2. Gemini APIで提供票データを抽出（★別のAPI呼び出し）
  const extractedFormData = extractFormDataFromOCR(ocrText);

  // 3. FormとDetailsレコードを作成
  const formResult = createNewServiceFormAndDetails(context, extractedFormData, serviceMasterMap);

  logStructured(LOG_LEVEL.INFO, '提供票処理完了', {
    formId: formResult.formId,
    message: formResult.message
  });

  return formResult.formId;
}

/**
 * OCRテキストから提供票データを抽出（Gemini API呼び出し）
 * @param {string} ocrText - OCRテキスト
 * @returns {Object} - { formHeader, formDetails }
 */
function extractFormDataFromOCR(ocrText) {
  // ★★★ Vertex AI APIのみ使用（Google AI Studio APIは完全廃止）
  // 修正日: 2025-10-18

  // API呼び出し制限チェック
  incrementApiCallCounter('Vertex_AI_Form');

  logStructured(LOG_LEVEL.INFO, '提供票: Vertex AI APIによる情報抽出を開始');

  const prompt = `
# あなたの役割

あなたは日本の介護保険制度に精通し、複雑なフォーマットの介護給付費サービス提供票を解析するエキスパートです。

あなたの仕事は、以下のOCRテキストから、「月間サービス計画及び実績の記録」と「サービス提供票別表」の情報を正確に関連付け、指定された項目を厳密なJSON形式で出力することです。

# 思考プロセス

1.  まず、「フラクタル訪問看護」に関連するサービスを特定します。

2.  次に、「サービス提供票別表」から、該当サービスの「サービスコード」と「回数」を抽出します。

3.  その後、「月間サービス計画及び実績の記録」のカレンダー形式の表を探します。

4.  カレンダー表で、該当するサービス内容の行ブロックを見つけます。

5.  まず「実績」行に注目し、日付部分に数字が記載されていれば、その日付を\`service_dates\`のリストとして抽出します。

6.  もし「実績」行の日付部分に一つも数字がない場合は、代わりに「予定」行に注目し、そこに記載されている日付を\`service_dates\`のリストとして抽出してください。

7.  最後に、ヘッダー情報と、全てのサービス明細情報を結合してJSONを生成します。

# 抽出ルール

- **フィルタリング**: 「フラクタル訪問看護」に関連するサービス行のみを抽出します。

- **ヘッダー情報**:

    - \`applicable_month\`: 「令和yy年mm月分」から\`yyyymm\`形式で抽出。

    - \`creation_date\`: 「作成年月日」から\`yyyy/mm/dd\`形式で抽出。

- **明細情報 (formDetails)**:

    - \`service_code\`, \`service_count\`: 「サービス提供票別表」から抽出。

    - \`service_dates\`: 「月間サービス計画及び実績の記録」から抽出します。まず「実績」行を確認し、日付があればそれを優先してください。もし「実績」行に日付が一つもない場合は、代わりに「予定」行の日付を抽出してください。 どちらにも日付がないサービス（多くの加算など）の場合は、空のリスト \`[]\` としてください。

    - \`planned_start_time\`, \`planned_end_time\`: 「提供時間帯」から抽出。

- 該当情報がない場合は \`null\` または \`[]\` を設定してください。

- JSON以外の説明文は一切含めないでください。

# OCRテキスト

${ocrText}

# 出力形式 (このJSONフォーマットを厳守してください)

{
  "formHeader": {
    "applicable_month": "string (yyyymm形式) or null",
    "creation_date": "string (yyyy/mm/dd) or null"
  },
  "formDetails": [
    {
      "service_dates": [1, 8, 15, 22],
      "planned_start_time": "string (HH:mm:ss形式) or null",
      "planned_end_time": "string (HH:mm:ss形式) or null",
      "service_code": "string or null",
      "service_count": "number or null"
    }
  ]
}
`;

  const perfStop = perfStart('Vertex_AI_FormData');

  // ★★★ Vertex AI APIエンドポイント使用
  const gcpConfig = getGCPConfig();
  const endpoint = getVertexAIEndpoint();
  const token = getOAuth2Token();

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
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

  const duration = perfStop();
  logApiCall('Vertex_AI_FormData', endpoint, responseCode, duration);

  if (responseCode >= 400) {
    const errorMsg = `Vertex AI API Error: ${responseCode} - ${response.getContentText()}`;
    logStructured(LOG_LEVEL.ERROR, errorMsg);
    throw new Error(errorMsg);
  }

  const jsonResponse = JSON.parse(response.getContentText());

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    throw new Error('Vertex AIからの応答にcandidatesが含まれていません');
  }

  const candidate = jsonResponse.candidates[0];
  const textContent = candidate.content.parts[0].text;

  return JSON.parse(textContent);
}

/**
 * FormとDetailsレコードを作成
 * @param {Object} context - コンテキスト情報
 * @param {Object} extractedData - { formHeader, formDetails }
 * @param {Map} serviceMasterMap - サービスマスターMap
 * @returns {Object} - { formId, extractedData, message }
 */
function createNewServiceFormAndDetails(context, extractedData, serviceMasterMap) {
  const { clientId, staffId, documentId } = context;
  const { formHeader, formDetails } = extractedData;

  if (!formHeader || !formDetails) {
    throw new Error("AIからの応答が不正、または必要なデータ(formHeader, formDetails)が含まれていませんでした。");
  }

  if (!formHeader.applicable_month || !/^\d{6}$/.test(formHeader.applicable_month)) {
    throw new Error(`AIが対象月(applicable_month)を不正な形式(yyyymm)で抽出しました: ${formHeader.applicable_month}`);
  }

  // 既存の提供票を検索
  const existingForms = getServiceFormsFromSheet(clientId, formHeader.applicable_month);

  let targetFormId = null;
  let returnMessage = "";

  const formattedCreationDate = formHeader.creation_date
      ? Utilities.formatDate(new Date(formHeader.creation_date), "Asia/Tokyo", "MM/dd/yyyy")
      : null;

  if (existingForms.length > 0) {
    if (!formattedCreationDate) {
      throw new Error(`既存の提供票が見つかりましたが、比較すべき作成日(creation_date)をAIが抽出できませんでした。処理を中断します。`);
    }

    const existingForm = existingForms[0];
    const newCreationDate = new Date(formattedCreationDate);
    const existingCreationDate = new Date(existingForm.creation_date);

    newCreationDate.setHours(0, 0, 0, 0);
    existingCreationDate.setHours(0, 0, 0, 0);

    if (newCreationDate >= existingCreationDate) {
      targetFormId = existingForm.form_id;
      returnMessage = `作成日が新しいか同じため、既存の提供票(${targetFormId})を上書きします。（新: ${newCreationDate.toLocaleDateString()} >= 旧: ${existingCreationDate.toLocaleDateString()}）`;

      logStructured(LOG_LEVEL.INFO, returnMessage);

      // 既存のDetailsを削除
      const detailsToDeletePayload = {
        Action: "Delete",
        Properties: {},
        Selector: `FILTER(Service_Form_Details, [form_id] = "${targetFormId}")`
      };

      callAppSheetApi(TABLE_NAMES.provisionFormDetails, detailsToDeletePayload);

      // Formを更新
      const formUpdateRow = {
        "form_id": targetFormId,
        "creation_date": formattedCreationDate,
        "status": "編集中",
        "updated_by": staffId
      };

      const formUpdatePayload = {
        Action: "Edit",
        Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
        Rows: [formUpdateRow]
      };

      callAppSheetApi(TABLE_NAMES.provisionForm, formUpdatePayload);

    } else {
      returnMessage = `既存の提供票の方が新しいため、処理をスキップしました。（新: ${newCreationDate.toLocaleDateString()} < 旧: ${existingCreationDate.toLocaleDateString()}）`;

      logStructured(LOG_LEVEL.WARN, returnMessage);

      return { formId: existingForms[0].form_id, extractedData: extractedData, message: returnMessage };
    }

  } else {
    // 新規作成
    targetFormId = `FORM-${Utilities.getUuid().substring(0, 8)}`;
    returnMessage = `新しい提供票を作成します: ${targetFormId}`;

    logStructured(LOG_LEVEL.INFO, returnMessage);

    const formRow = {
      "form_id": targetFormId,
      "client_id": clientId,
      "source_document_id": documentId,
      "status": "編集中",
      "created_by": staffId,
      "updated_by": staffId,
      "applicable_month": formHeader.applicable_month,
      "creation_date": formattedCreationDate
    };

    // 提供票Formレコードを作成
    callAppSheetApi(TABLE_NAMES.provisionForm, 'Add', [formRow]);
  }

  // Detailsレコードを作成
  const newDetailsToCreate = [];
  const year = formHeader.applicable_month.substring(0, 4);
  const month = formHeader.applicable_month.substring(4, 6);

  formDetails.forEach(detailGroup => {
    if (!detailGroup.service_code) return;

    const masterInfo = serviceMasterMap.get(String(detailGroup.service_code).trim());

    if (!masterInfo) {
      logStructured(LOG_LEVEL.WARN, `マスターにサービスコードが見つかりません: ${detailGroup.service_code}`);
      return;
    }

    let itemCategory = masterInfo.name.includes("加算") ? "加算" : masterInfo.name.includes("減算") ? "減算" : "サービス";

    if (detailGroup.service_dates && detailGroup.service_dates.length > 0) {
      detailGroup.service_dates.forEach(day => {
        const serviceDateStr = Utilities.formatDate(new Date(year, month - 1, day), "Asia/Tokyo", "yyyy-MM-dd");

        newDetailsToCreate.push({
          service_date: serviceDateStr,
          planned_start_time: itemCategory === "サービス" ? detailGroup.planned_start_time : null,
          planned_end_time: itemCategory === "サービス" ? detailGroup.planned_end_time : null,
          service_code: detailGroup.service_code,
          item_category: itemCategory,
          service_name: masterInfo.name,
          service_units: masterInfo.units,
          service_count: 1
        });
      });

    } else if (detailGroup.service_count && detailGroup.service_count > 0) {
      for (let i = 0; i < detailGroup.service_count; i++) {
        newDetailsToCreate.push({
          service_date: null,
          planned_start_time: detailGroup.planned_start_time,
          planned_end_time: detailGroup.planned_end_time,
          service_code: detailGroup.service_code,
          item_category: itemCategory,
          service_name: masterInfo.name,
          service_units: masterInfo.units,
          service_count: 1
        });
      }

    } else if (itemCategory === "加算" || itemCategory === "減算") {
      newDetailsToCreate.push({
        service_date: null,
        planned_start_time: null,
        planned_end_time: null,
        service_code: detailGroup.service_code,
        item_category: itemCategory,
        service_name: masterInfo.name,
        service_units: masterInfo.units,
        service_count: 1
      });
    }
  });

  if (newDetailsToCreate.length > 0) {
    const detailRows = newDetailsToCreate.map(d => ({
      "detail_id": `DET-${Utilities.getUuid().substring(0, 8)}`,
      "form_id": targetFormId,
      "client_id": clientId,
      "status": "編集中",
      "created_by": staffId,
      "updated_by": staffId,
      ...d
    }));

    const detailPayload = {
      Action: "Add",
      Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
      Rows: detailRows
    };

    callAppSheetApi(TABLE_NAMES.provisionFormDetails, detailPayload);

    logStructured(LOG_LEVEL.INFO, `${detailRows.length}件のサービス明細を作成しました`);
  }

  return { formId: targetFormId, extractedData: extractedData, message: returnMessage };
}

/**
 * スプレッドシートから既存の提供票を検索
 * @param {string} clientId - 利用者ID
 * @param {string} applicableMonth - 対象月(YYYYMM形式)
 * @returns {Array} - 一致した提供票の配列
 */
function getServiceFormsFromSheet(clientId, applicableMonth) {
  logStructured(LOG_LEVEL.INFO, 'スプレッドシートから提供票データを検索', {
    clientId,
    applicableMonth
  });

  try {
    const sheet = SpreadsheetApp.openById(MASTER_SPREADSHEETS.serviceProvisionForm.id)
      .getSheetByName('Service_Provision_Form');

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const clientIdIndex = headers.indexOf('client_id');
    const monthIndex = headers.indexOf('applicable_month');

    if (clientIdIndex === -1 || monthIndex === -1) {
      throw new Error("提供票スプレッドシートに見出し'client_id'または'applicable_month'が見つかりません。");
    }

    const matchingRows = data.filter(row =>
      row[clientIdIndex] === clientId &&
      String(row[monthIndex]) === String(applicableMonth)
    );

    const resultObjects = matchingRows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    logStructured(LOG_LEVEL.INFO, `スプレッドシートから ${resultObjects.length} 件の一致データが見つかりました`);

    return resultObjects;

  } catch (error) {
    logStructured(LOG_LEVEL.ERROR, 'スプレッドシート検索エラー', { error: error.message });
    throw error;
  }
}

/**
 * サービスマスターをMapとして取得（キャッシュ付き）
 * @returns {Map} - サービスコード → { name, units }
 */
function getServiceMasterAsMap() {
  const cache = CacheService.getScriptCache();
  const CACHE_KEY = 'SERVICE_MASTER_MAP_CACHE';
  const cached = cache.get(CACHE_KEY);

  if (cached) {
    logStructured(LOG_LEVEL.INFO, 'サービスマスター: キャッシュから取得');
    return new Map(JSON.parse(cached));
  }

  logStructured(LOG_LEVEL.INFO, 'サービスマスター: スプレッドシートから読み込み');

  const sheet = SpreadsheetApp.openById(MASTER_SPREADSHEETS.service.id)
    .getSheetByName(MASTER_SPREADSHEETS.service.sheetName);

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const typeIndex = headers.indexOf('種類');
  const itemIndex = headers.indexOf('項目');
  const nameIndex = headers.indexOf('サービス内容略称');
  const unitIndex = headers.indexOf('単位');

  if ([typeIndex, itemIndex, nameIndex, unitIndex].includes(-1)) {
    throw new Error("マスタースプレッドシートに必要な列（種類, 項目, サービス内容略称, 単位）が見つかりません。");
  }

  const map = new Map();

  for (const row of data) {
    const key = `${row[typeIndex]}${row[itemIndex]}`.trim();
    if (key) {
      map.set(key, { name: row[nameIndex], units: row[unitIndex] });
    }
  }

  cache.put(CACHE_KEY, JSON.stringify(Array.from(map.entries())), 21600); // 6時間キャッシュ

  return map;
}

// ============================================
// AppSheet API共通関数
// ============================================

/**
 * AppSheet APIを呼び出す
 * @param {string} tableName - テーブル名
 * @param {string} action - アクション (Add/Edit/Delete)
 * @param {Array} rows - 行データ配列
 */
function callAppSheetApi(tableName, action, rows) {
  const perfStop = perfStart(`AppSheet_${tableName}`);

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APPSHEET_CONFIG.appId}/tables/${encodeURIComponent(tableName)}/Action`;

  // 引数チェック: rowsがundefinedの場合、actionが実はpayloadオブジェクトの可能性
  let payload;
  if (rows === undefined && typeof action === 'object') {
    // 後方互換性: callAppSheetApi(tableName, payloadObject) の形式
    payload = action;
    logStructured(LOG_LEVEL.INFO, 'AppSheet APIリクエスト送信（完全ペイロード）', {
      tableName: tableName,
      action: payload.Action,
      payload: JSON.stringify(payload)
    });
  } else {
    // 標準形式: callAppSheetApi(tableName, action, rows)
    payload = {
      Action: action,
      Properties: {
        Locale: 'ja-JP',
        Timezone: 'Asia/Tokyo'
      },
      Rows: rows
    };

    logStructured(LOG_LEVEL.INFO, 'AppSheet APIリクエスト送信', {
      tableName: tableName,
      action: action,
      rowCount: rows ? rows.length : 0,
      payload: JSON.stringify(payload)
    });
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'ApplicationAccessKey': APPSHEET_CONFIG.accessKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();

  const duration = perfStop();
  logApiCall(`AppSheet_${tableName}`, apiUrl, responseCode, duration);

  if (responseCode >= 400) {
    const errorMsg = `AppSheet API Error: ${responseCode} - ${response.getContentText()}`;
    logStructured(LOG_LEVEL.ERROR, errorMsg, {
      tableName: tableName,
      action: action,
      responseCode: responseCode
    });
    throw new Error(errorMsg);
  }

  // レスポンスボディを取得
  const responseText = response.getContentText();

  // 空レスポンスの場合は空オブジェクトを返す
  if (!responseText || responseText.trim() === '') {
    logStructured(LOG_LEVEL.WARN, 'AppSheet APIから空レスポンス', {
      tableName: tableName,
      action: action,
      responseCode: responseCode
    });
    return {};
  }

  return JSON.parse(responseText);
}
