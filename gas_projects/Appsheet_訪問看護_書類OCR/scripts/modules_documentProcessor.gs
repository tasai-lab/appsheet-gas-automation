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
 * @param {Object} context - コンテキスト情報（clientId, documentId, staffId等）
 * @returns {string} 作成されたレコードID（またはnull）
 */
function processStructuredData(documentType, structuredData, context) {
  // structured_dataがnullの場合は何もしない（汎用ドキュメント等）
  if (!structuredData) {
    logStructured(LOG_LEVEL.INFO, 'structured_dataがnullのためスキップ', { documentType });
    return null;
  }

  logStructured(LOG_LEVEL.INFO, `書類仕分け処理開始: ${documentType}`, { documentId: context.documentId });

  try {
    let recordId = null;

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
