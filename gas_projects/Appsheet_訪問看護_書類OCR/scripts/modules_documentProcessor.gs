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
  let isActive = null;
  if (data.effective_start_date) {
    const startDate = new Date(data.effective_start_date.replace(/\//g, '-'));
    const endDateStr = data.effective_end_date;
    const isEndDateValid = (!endDateStr || endDateStr === '9999/12/31' || new Date(endDateStr.replace(/\//g, '-')) >= todayJST);

    if (startDate <= todayJST && isEndDateValid) {
      isActive = true;
    } else {
      isActive = false;
    }
  }

  // 給付割合のデフォルト値
  let benefitRate = safeParseInt(data.benefit_rate);
  if (benefitRate === null) {
    benefitRate = 70; // デフォルトは3割負担
  }

  const nowJST = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  const newId = `MEDI-${Utilities.getUuid().substring(0, 8)}`;

  const rowData = {
    medical_insurance_id: newId,
    client_id: context.clientId,
    effective_start_date: data.effective_start_date ? data.effective_start_date.replace(/\//g, '-') : null,
    effective_end_date: data.effective_end_date ? data.effective_end_date.replace(/\//g, '-') : null,
    insurer_number: data.insurer_number,
    policy_symbol: data.policy_symbol,
    policy_number: data.policy_number,
    branch_number: data.branch_number,
    relationship_to_insured: data.relationship_to_insured,
    insurance_category: data.insurance_category,
    is_work_related_reason: data.is_work_related_reason,
    benefit_rate: benefitRate,
    income_category: data.income_category,
    certificate_number: data.certificate_number,
    fixed_copayment_amount: data.fixed_copayment_amount,
    reduction_category: data.reduction_category,
    reduction_rate_percent: data.reduction_rate_percent,
    reduction_amount: data.reduction_amount,
    reduction_cert_expiration_date: data.reduction_cert_expiration_date ? data.reduction_cert_expiration_date.replace(/\//g, '-') : null,
    is_active: isActive,
    created_at: nowJST,
    created_by: context.staffId,
    document_id: context.documentId
  };

  callAppSheetApi(TABLE_NAMES.medicalInsurance, 'Add', [rowData]);
  return newId;
}

// ============================================
// 介護保険証
// ============================================

function createLtciInsuranceRecord(context, data) {
  const nowJST = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  const newId = `LTCI-${Utilities.getUuid().substring(0, 8)}`;

  // 有効/無効判定
  const todayJSTStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const todayJST = new Date(todayJSTStr);
  let isActive = null;

  if (data.cert_start_date && data.cert_end_date) {
    const startDate = new Date(data.cert_start_date.replace(/\//g, '-'));
    const endDate = new Date(data.cert_end_date.replace(/\//g, '-'));

    if (startDate <= todayJST && endDate >= todayJST) {
      isActive = true;
    } else {
      isActive = false;
    }
  }

  const rowData = {
    ltci_insurance_id: newId,
    client_id: context.clientId,
    insured_person_number: data.insured_person_number,
    insurer_name: data.insurer_name,
    insurer_code: data.insurer_code,
    care_level: data.care_level,
    cert_start_date: data.cert_start_date ? data.cert_start_date.replace(/\//g, '-') : null,
    cert_end_date: data.cert_end_date ? data.cert_end_date.replace(/\//g, '-') : null,
    next_renewal_check_date: data.next_renewal_check_date ? data.next_renewal_check_date.replace(/\//g, '-') : null,
    is_active: isActive,
    created_at: nowJST,
    created_by: context.staffId,
    document_id: context.documentId
  };

  callAppSheetApi(TABLE_NAMES.ltciInsurance, 'Add', [rowData]);
  return newId;
}

// ============================================
// 公費
// ============================================

function createPublicSubsidyRecord(context, data) {
  const nowJST = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  const newId = `PSUB-${Utilities.getUuid().substring(0, 8)}`;

  // 有効/無効判定
  const todayJSTStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const todayJST = new Date(todayJSTStr);
  let isActive = null;

  if (data.subsidy_start_date && data.subsidy_end_date) {
    const startDate = new Date(data.subsidy_start_date.replace(/\//g, '-'));
    const endDate = new Date(data.subsidy_end_date.replace(/\//g, '-'));

    if (startDate <= todayJST && endDate >= todayJST) {
      isActive = true;
    } else {
      isActive = false;
    }
  }

  const rowData = {
    public_subsidy_id: newId,
    client_id: context.clientId,
    subsidy_number: data.subsidy_number,
    subsidy_name: data.subsidy_name,
    recipient_number: data.recipient_number,
    subsidy_start_date: data.subsidy_start_date ? data.subsidy_start_date.replace(/\//g, '-') : null,
    subsidy_end_date: data.subsidy_end_date ? data.subsidy_end_date.replace(/\//g, '-') : null,
    burden_limit_amount: data.burden_limit_amount,
    is_active: isActive,
    created_at: nowJST,
    created_by: context.staffId,
    document_id: context.documentId
  };

  callAppSheetApi(TABLE_NAMES.publicSubsidy, 'Add', [rowData]);
  return newId;
}

// ============================================
// 口座情報
// ============================================

function createBankAccountRecord(context, data) {
  const nowJST = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  const newId = `BANK-${Utilities.getUuid().substring(0, 8)}`;

  const rowData = {
    bank_account_id: newId,
    client_id: context.clientId,
    bank_name: data.bank_name,
    bank_code: data.bank_code,
    branch_name: data.branch_name,
    branch_code: data.branch_code,
    account_type: data.account_type,
    account_number: data.account_number,
    account_holder_name: data.account_holder_name,
    is_primary: false, // デフォルトfalse
    created_at: nowJST,
    created_by: context.staffId,
    document_id: context.documentId
  };

  callAppSheetApi(TABLE_NAMES.bankAccount, 'Add', [rowData]);
  return newId;
}

// ============================================
// 負担割合証
// ============================================

function createCopayCertRecord(context, data) {
  const nowJST = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  const newId = `COPAY-${Utilities.getUuid().substring(0, 8)}`;

  // 有効/無効判定
  const todayJSTStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const todayJST = new Date(todayJSTStr);
  let isActive = null;

  if (data.copay_cert_start_date && data.copay_cert_end_date) {
    const startDate = new Date(data.copay_cert_start_date.replace(/\//g, '-'));
    const endDate = new Date(data.copay_cert_end_date.replace(/\//g, '-'));

    if (startDate <= todayJST && endDate >= todayJST) {
      isActive = true;
    } else {
      isActive = false;
    }
  }

  const rowData = {
    copay_cert_id: newId,
    client_id: context.clientId,
    copayment_rate: data.copayment_rate,
    copay_cert_start_date: data.copay_cert_start_date ? data.copay_cert_start_date.replace(/\//g, '-') : null,
    copay_cert_end_date: data.copay_cert_end_date ? data.copay_cert_end_date.replace(/\//g, '-') : null,
    is_active: isActive,
    created_at: nowJST,
    created_by: context.staffId,
    document_id: context.documentId
  };

  callAppSheetApi(TABLE_NAMES.copaymentCert, 'Add', [rowData]);
  return newId;
}

// ============================================
// 指示書
// ============================================

function createInstructionRecord(context, data) {
  const nowJST = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  const newId = `INST-${Utilities.getUuid().substring(0, 8)}`;

  // 有効/無効判定
  const todayJSTStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const todayJST = new Date(todayJSTStr);
  let isActive = null;

  if (data.instruction_period_start && data.instruction_period_end) {
    const startDate = new Date(data.instruction_period_start.replace(/\//g, '-'));
    const endDate = new Date(data.instruction_period_end.replace(/\//g, '-'));

    if (startDate <= todayJST && endDate >= todayJST) {
      isActive = true;
    } else {
      isActive = false;
    }
  }

  const rowData = {
    instruction_id: newId,
    client_id: context.clientId,
    instruction_period_start: data.instruction_period_start ? data.instruction_period_start.replace(/\//g, '-') : null,
    instruction_period_end: data.instruction_period_end ? data.instruction_period_end.replace(/\//g, '-') : null,
    medical_institution_name: data.medical_institution_name,
    doctor_name: data.doctor_name,
    disease_name: data.disease_name,
    instructions_summary: data.instructions_summary,
    is_active: isActive,
    created_at: nowJST,
    created_by: context.staffId,
    document_id: context.documentId
  };

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
  logStructured(LOG_LEVEL.INFO, '提供票: Gemini APIによる情報抽出を開始');

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

  const perfStop = perfStart('Gemini_API_FormData');

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.model}:generateContent?key=${GEMINI_CONFIG.apiKey}`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: GEMINI_CONFIG.temperature,
      maxOutputTokens: GEMINI_CONFIG.maxOutputTokens
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();

  const duration = perfStop();
  logApiCall('Gemini_API_FormData', apiUrl, responseCode, duration);

  if (responseCode >= 400) {
    const errorMsg = `Gemini API Error: ${responseCode} - ${response.getContentText()}`;
    logStructured(LOG_LEVEL.ERROR, errorMsg);
    throw new Error(errorMsg);
  }

  const jsonResponse = JSON.parse(response.getContentText());

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    throw new Error('Gemini APIからの応答にcandidatesが含まれていません');
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

    const formPayload = {
      Action: "Add",
      Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
      Rows: [formRow]
    };

    callAppSheetApi(TABLE_NAMES.provisionForm, formPayload);
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

  const payload = {
    Action: action,
    Properties: {
      Locale: 'ja-JP',
      Timezone: 'Asia/Tokyo'
    },
    Rows: rows
  };

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

  return JSON.parse(response.getContentText());
}
