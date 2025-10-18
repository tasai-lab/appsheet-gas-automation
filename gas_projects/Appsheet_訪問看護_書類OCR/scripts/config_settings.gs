/**
 * config_settings.gs - 設定ファイル
 *
 * 書類OCR + 書類仕分け統合システムの全設定を一元管理
 *
 * @version 1.0.0
 * @date 2025-10-18
 */

// ============================================
// ログレベル定義
// ============================================

const LOG_LEVEL = {
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  WARN: 'WARNING',
  ERROR: 'ERROR'
};

// ============================================
// システム設定
// ============================================

const SYSTEM_CONFIG = {
  debugMode: false  // デバッグモード（詳細ログ出力）
};

// ============================================
// Gemini API設定
// ============================================

const GEMINI_CONFIG = {
  apiKey: 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY',
  model: 'gemini-2.5-pro',
  temperature: 0.3,
  maxOutputTokens: 8192,
  responseMimeType: 'application/json'
};

// ============================================
// AppSheet API設定
// ============================================

const APPSHEET_CONFIG = {
  appId: 'f40c4b11-b140-4e31-a60c-600f3c9637c8',
  accessKey: 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY',
  appName: '訪問看護_利用者管理-575936796'
};

// ============================================
// AppSheet テーブル名
// ============================================

const TABLE_NAMES = {
  // 書類管理（OCR結果を格納）
  documents: 'Client_Documents',

  // 種類別テーブル（構造化データを格納）
  medicalInsurance: 'Client_Medical_Insurances',
  ltciInsurance: 'Client_LTCI_Insurances',
  publicSubsidy: 'Client_Public_Subsidies',
  bankAccount: 'Client_Bank_Accounts',
  instruction: 'VN_Instructions',
  provisionForm: 'Service_Provision_Form',
  provisionFormDetails: 'Service_Form_Details',
  copaymentCert: 'Client_LTCI_Copayment_Certificates'
};

// ============================================
// 外部マスタースプレッドシート設定
// ============================================

const MASTER_SPREADSHEETS = {
  // 提供票データ
  serviceProvisionForm: {
    id: '11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc'
  },

  // 公費マスター
  publicSubsidy: {
    id: '1ZUDnN-gkgfC0BMuwdZp2hP6yQhhMp3bCt_VA-NqTl9g',
    sheetName: 'Public_Subsidy_Master'
  },

  // 介護サービスマスター
  service: {
    id: '1r-ehIg7KMrSPBCI3K1wA8UFvBnKvqp1kmb8r7MCH1tQ',
    sheetName: '介護_基本・加算マスター'
  }
};

// ============================================
// Google Drive設定
// ============================================

const DRIVE_CONFIG = {
  // 書類ファイルの基準フォルダーID
  baseFolderId: '18Fwwm7lsBMy5BMFL_TnnFDh9lNVyAX04'
};

// ============================================
// 通知設定
// ============================================

const NOTIFICATION_CONFIG = {
  errorEmail: 't.asai@fractal-group.co.jp',
  completionEmails: 't.asai@fractal-group.co.jp, m.iwaizako@fractal-group.co.jp'
};

// ============================================
// AppSheet詳細ビュー名マッピング
// ============================================

const VIEW_NAME_MAP = {
  '医療保険証': 'Medical_Insurance_Detail',
  '介護保険証': 'LTCI_Insurance_Detail',
  '公費': 'Public_Subsidy_Detail',
  '口座情報': 'Bank_Account_Detail',
  '指示書': 'Instruction_Detail',
  '提供票': 'Service_Form_Detail',
  '負担割合証': 'Copay_Cert_Detail'
};

// ============================================
// フィールド名マッピング（日本語表示用）
// ============================================

const KEY_TO_JAPANESE_MAP = {
  // 医療保険証
  'effective_start_date': '適用開始日',
  'effective_end_date': '適用終了日',
  'insurer_number': '保険者番号',
  'policy_symbol': '記号',
  'policy_number': '番号',
  'branch_number': '枝番',
  'relationship_to_insured': '本人・家族区分',
  'insurance_category': '保険分類',
  'is_work_related_reason': '職務上の事由',
  'benefit_rate': '給付割合',
  'income_category': '所得区分',
  'certificate_number': '認定証番号',
  'fixed_copayment_amount': '一部負担金（定額）',
  'reduction_category': '減免区分',
  'reduction_rate_percent': '減免割合（％）',
  'reduction_amount': '減免金額',
  'reduction_cert_expiration_date': '減免証明書有効期限',

  // 介護保険証
  'insured_person_number': '被保険者番号',
  'insurer_name': '保険者名',
  'care_level': '要介護状態区分',
  'cert_start_date': '認定有効期間（開始）',
  'cert_end_date': '認定有効期間（終了）',
  'insurer_code': '保険者番号',

  // 公費
  'subsidy_name': '公費名称',
  'recipient_number': '受給者番号',
  'subsidy_start_date': '有効期間（開始）',
  'subsidy_end_date': '有効期間（終了）',
  'burden_limit_amount': '負担上限月額',

  // 口座情報
  'bank_name': '金融機関名',
  'bank_code': '金融機関コード',
  'branch_name': '支店名',
  'branch_code': '支店コード',
  'account_type': '預金種目',
  'account_number': '口座番号',
  'account_holder_name': '口座名義人',

  // 指示書
  'instruction_period_start': '指示期間（開始）',
  'instruction_period_end': '指示期間（終了）',
  'medical_institution_name': '医療機関名',
  'doctor_name': '医師名',
  'disease_name': '病名',
  'instructions_summary': '指示内容',

  // 負担割合証
  'copayment_rate': '負担割合',
  'copay_cert_start_date': '適用期間（開始）',
  'copay_cert_end_date': '適用期間（終了）'
};

// ============================================
// サポートされている書類タイプ
// ============================================

const SUPPORTED_DOCUMENT_TYPES = [
  '医療保険証',
  '介護保険証',
  '公費',
  '口座情報',
  '指示書',
  '訪問看護指示書',
  '在宅患者訪問点滴注射指示書',
  '提供票',
  '負担割合証',
  '汎用ドキュメント'
];
