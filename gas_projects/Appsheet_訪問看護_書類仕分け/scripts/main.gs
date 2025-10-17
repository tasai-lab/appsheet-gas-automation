/**
 * 実行ログモジュール
 */
const ExecutionLogger = {
  SPREADSHEET_ID: '15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE',
  SHEET_NAME: 'シート1',
  
  /**
   * ログを記録
   * @param {string} scriptName - スクリプト名
   * @param {string} status - ステータス (SUCCESS/ERROR/WARNING)
   * @param {string} processId - 処理ID
   * @param {string} message - メッセージ
   * @param {string} errorDetail - エラー詳細
   * @param {number} executionTime - 実行時間(秒)
   * @param {Object} inputData - 入力データ
   */
  log: function(scriptName, status, processId, message, errorDetail, executionTime, inputData) {
    try {
      const ss = SpreadsheetApp.openById(this.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(this.SHEET_NAME);
      
      const timestamp = new Date();
      const user = Session.getActiveUser().getEmail();
      const inputDataStr = inputData ? JSON.stringify(inputData).substring(0, 1000) : '';
      
      sheet.appendRow([
        timestamp,
        scriptName,
        status,
        processId || '',
        message || '',
        errorDetail || '',
        executionTime || 0,
        user,
        inputDataStr
      ]);
    } catch (e) {
      Logger.log(`ログ記録エラー: ${e.message}`);
    }
  },
  
  /**
   * 成功ログ
   */
  success: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'SUCCESS', processId, message, '', executionTime, inputData);
  },
  
  /**
   * エラーログ
   */
  error: function(scriptName, processId, message, error, executionTime, inputData) {
    const errorDetail = error ? `${error.message}\n${error.stack}` : '';
    this.log(scriptName, 'ERROR', processId, message, errorDetail, executionTime, inputData);
  },
  
  /**
   * 警告ログ
   */
  warning: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'WARNING', processId, message, '', executionTime, inputData);
  }
};


/**
 * Webhook重複実行防止モジュール
 */
const DuplicationPrevention = {
  LOCK_TIMEOUT: 300000, // 5分
  CACHE_EXPIRATION: 3600, // 1時間
  
  /**
   * リクエストの重複チェック
   * @param {string} requestId - リクエストID（webhookデータのハッシュ値）
   * @return {boolean} - 処理を続行する場合はtrue
   */
  checkDuplicate: function(requestId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `processed_${requestId}`;
    
    // キャッシュチェック
    if (cache.get(cacheKey)) {
      Logger.log(`重複リクエストを検出: ${requestId}`);
      return false;
    }
    
    // ロック取得
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(this.LOCK_TIMEOUT);
      
      // 再度キャッシュチェック（ダブルチェック）
      if (cache.get(cacheKey)) {
        Logger.log(`ロック取得後、重複リクエストを検出: ${requestId}`);
        return false;
      }
      
      // 処理済みマークを設定
      cache.put(cacheKey, 'processed', this.CACHE_EXPIRATION);
      return true;
    } catch (e) {
      Logger.log(`ロック取得エラー: ${e.message}`);
      return false;
    } finally {
      lock.releaseLock();
    }
  },
  
  /**
   * リクエストIDを生成
   * @param {Object} data - Webhookデータ
   * @return {string} - リクエストID
   */
  generateRequestId: function(data) {
    const str = JSON.stringify(data);
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      str,
      Utilities.Charset.UTF_8
    ).map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
  }
};


/**

 * ===================================================================================

 * 1. 基本設定 (★ご自身の環境に合わせて全て修正してください)

 * ===================================================================================

 */

const GEMINI_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY'; // ★ Gemini APIキー

const APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';           // ★ AppSheet アプリID

const ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';      // ★ AppSheet API アクセスキー

const APP_NAME = '訪問看護_利用者管理-575936796'; // ★ AppSheetのアプリ名



// --- メール通知設定 ---

// エラー発生時や処理全体のログを送信する宛先

const ERROR_NOTIFICATION_EMAIL = "t.asai@fractal-group.co.jp"; 

// 処理完了時に確認を促すHTMLメールを送信する宛先（カンマ区切りで複数指定可）

const COMPLETION_NOTIFICATION_EMAILS = "t.asai@fractal-group.co.jp, m.iwaizako@fractal-group.co.jp"; 



// --- AppSheet テーブル名 ---

const DOCUMENTS_TABLE_NAME = 'Client_Documents';                     // 書類管理テーブル

const MEDICAL_INSURANCE_TABLE_NAME = 'Client_Medical_Insurances';    // 医療保険証テーブル

const LTCI_INSURANCE_TABLE_NAME = 'Client_LTCI_Insurances';          // 介護保険証テーブル

const PUBLIC_SUBSIDY_TABLE_NAME = 'Client_Public_Subsidies';         // 公費受給者証テーブル

const BANK_ACCOUNTS_TABLE_NAME = 'Client_Bank_Accounts';             // 口座情報テーブル

const INSTRUCTIONS_TABLE_NAME = 'VN_Instructions';                   // 訪問看護指示書テーブル

const FORMS_TABLE_NAME = 'Service_Provision_Form';               // サービス提供票（ヘッダー）テーブル

const DETAILS_TABLE_NAME = 'Service_Form_Details';                 // サービス提供票（明細）テーブル

const COPAYMENT_TABLE_NAME = 'Client_LTCI_Copayment_Certificates';   // 介護保険負担割合証テーブル



// --- 外部マスタースプレッドシート設定 ---

// ★★★【新規追加】提供票のデータが格納されているスプレッドシート ★★★

const SERVICE_PROVISION_FORM_SS_ID = '11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc';

// 公費マスター

const PUBLIC_SUBSIDY_MASTER_SS_ID = '1ZUDnN-gkgfC0BMuwdZp2hP6yQhhMp3bCt_VA-NqTl9g';

const PUBLIC_SUBSIDY_MASTER_SHEET_NAME = 'Public_Subsidy_Master';

// 介護サービスマスター

const SERVICE_MASTER_SS_ID = '1r-ehIg7KMrSPBCI3K1wA8UFvBnKvqp1kmb8r7MCH1tQ';

const SERVICE_MASTER_SHEET_NAME = '介護_基本・加算マスター';



// --- AppSheetの各詳細ビューへのディープリンク設定 ---

// ※キー（'医療保険証'など）はdocumentTypeの値と一致させ、値はご自身のAppSheetアプリのビュー名を正確に設定してください。

const VIEW_NAME_MAP = {

  '医療保険証': 'Medical_Insurance_Detail',

  '介護保険証': 'LTCI_Insurance_Detail',

  '公費': 'Public_Subsidy_Detail',

  '口座情報': 'Bank_Account_Detail',

  '指示書': 'Instruction_Detail',

  '提供票': 'Service_Form_Detail',

  '負担割合証': 'Copay_Cert_Detail'

};



/**

 * ===================================================================================

 * 1. 基本設定 (★ご自身の環境に合わせて全て修正してください)

 * ===================================================================================

 */



// (既存の VIEW_NAME_MAP の下などに追加)



// ★★★【新規追加】メールに表示する項目名を日本語に変換するためのマップ ★★★

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

  'next_renewal_check_date': '次回更新確認日',



  // 公費

  'subsidy_name': '公費制度名',

  'payer_number': '負担者番号',

  'recipient_number': '受給者番号',

  'subsidy_category_number': '公費区分番号',

  'copayment_category': '一部負担金区分',

  'benefit_rate_percent': '公費給付率（％）',

  'limit_unit_type': '上限単位',

  'monthly_limit_amount': '月額上限額',

  'per_service_limit_amount': '1回あたり上限額',

  'monthly_visit_limit': '月間上限回数',

  

  // 口座情報

  'bank_code': '金融機関コード',

  'bank_name_kana': '金融機関名（カナ）',

  'branch_code': '支店コード',

  'account_type': '預金種目',

  'account_number': '口座番号',

  'account_holder_name_kana': '口座名義人（カナ）',

  

  // 指示書

  'instructionType': '指示書区分',

  'instructionStartDate': '指示期間（開始）',

  'instructionEndDate': '指示期間（終了）',

  'dripInfusionStartDate': '点滴指示期間（開始）',

  'dripInfusionEndDate': '点滴指示期間（終了）',

  'issueDate': '交付年月日',

  'clinicAddress': '医療機関の住所',

  'specifiedDiseaseNoticeCode': '特疾告示コード',

  'specifiedDiseaseCodes': '特定疾病コード一覧',

  'diseaseNameList': '傷病名一覧',

  'diseaseMedicalCode1': '傷病名コード1',

  'diseaseMedicalCode2': '傷病名コード2',

  'diseaseMedicalCode3': '傷病名コード3',

  

  // 負担割合証

  'copayment_rate': '負担割合'

};



/**

 * ===================================================================================

 * 2. メイン処理 (Webhookトリガー) - 最終版

 * ===================================================================================

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  return processRequest(params);
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  let documentId = "N/A";

  const logCollector = [];

  let context = {}; // エラー時にも参照できるよう、スコープの先頭で定義



  const log = (message, details = null) => {

    const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    let logMessage = `[${timestamp}] ${message}`;

    if (details) {

      try {

        logMessage += `\n${JSON.stringify(details, null, 2)}`;

      } catch (err) {

        logMessage += `\n[ログ出力エラー: 詳細情報の文字列化に失敗しました]`;

      }

    }

    console.log(logMessage);

    logCollector.push(logMessage);

  };



  try {

    log("処理開始: WebhookからのPOSTリクエストを受信");



    const rawParams = params;

    const parsedData = parseCompositeOcrText(rawParams.ocrText);

    log("複合テキストの分解結果:", parsedData);



    context = {

      documentId: parsedData.documentId || rawParams.documentId,

      clientId: parsedData.clientId || rawParams.clientId,

      documentType: parsedData.documentType || rawParams.documentType,

      staffId: parsedData.staffId || rawParams.staffId,

      driveFileId: parsedData.driveFileId || rawParams.driveFileId,

      ocrText: parsedData.rawOcrText, 

      clientBirthDate: rawParams.clientBirthDate,

      clientName: rawParams.clientName,

      staffName: rawParams.staffName

    };

    

    documentId = context.documentId || "N/A";

    if (documentId === "N/A") throw new Error("必須パラメータ documentId が分解後も不明です。");



    const lock = LockService.getScriptLock();

    try {

      lock.waitLock(30000);

      const properties = PropertiesService.getScriptProperties();

      const status = properties.getProperty(documentId);



      if (status === 'completed' || status === 'processing') {

        log(`重複リクエスト検知: ID ${documentId} は処理中または完了済みです。スキップします。`);

        return ContentService.createTextOutput("Request is processing or already completed.");

      }

      properties.setProperty(documentId, 'processing');

      log(`新規リクエスト受付: ID ${documentId} を処理中に設定しました。`, context);



    } finally {

      lock.releaseLock();

    }

    

    const { documentType, ocrText, staffId, clientId } = context;

    if (!ocrText || !staffId || !clientId || !documentType) {

      throw new Error("必須パラメータが分解後も不足しています。（ocrText, staffId, clientId, documentType）");

    }



    let newRecordStatus = "登録済";

    let processSkipped = false;

    // ★★★ `提供票` の場合のみ、処理が分岐します ★★★

    if (documentType === '提供票') {

      log("分岐: 提供票の処理をバックグラウンドで予約します。");

      // 重い処理は直接実行せず、トリガーをセットして即時応答する

      ScriptApp.newTrigger('processProvisionForm')

        .timeBased()

        .after(3000) // 3秒後に実行

        .create();

      

      // トリガーに渡すために、contextオブジェクトを一時的に保存

      PropertiesService.getScriptProperties().setProperty(`CONTEXT_${documentId}`, JSON.stringify(context));

      

      // AppSheetへの応答を返すため、ここでは処理を終了

      return ContentService.createTextOutput("提供票の処理をバックグラウンドで開始しました。");



    } else if (documentType === '医療保険証') {

      log("分岐: 医療保険証の処理を開始");

      // ★★★ 修正: 第2引数に clientBirthDate を追加 ★★★

      const medicalInfo = extractMedicalInsuranceInfo(ocrText, context.clientBirthDate, log);

      const newRecordId = createMedicalInsuranceRecord(context, medicalInfo, log);

      sendCompletionNotificationEmail(context, '医療保険証', medicalInfo, newRecordId, VIEW_NAME_MAP['医療保険証'], log);

    } else if (documentType === '介護保険証') {

      log("分岐: 介護保険証の処理を開始");

      const ltciInfo = extractLtciInsuranceInfo(ocrText, log);

      const newRecordId = createLtciInsuranceRecord(context, ltciInfo, log);

      sendCompletionNotificationEmail(context, '介護保険証', ltciInfo, newRecordId, VIEW_NAME_MAP['介護保険証'], log);

    } else if (documentType === '公費') {

      log("分岐: 公費受給者証の処理を開始");

      const subsidyInfo = extractSubsidyInfo(ocrText, context.clientBirthDate, log);

      const newRecordId = createSubsidyRecord(context, subsidyInfo, log);

      sendCompletionNotificationEmail(context, '公費', subsidyInfo, newRecordId, VIEW_NAME_MAP['公費'], log);

    } else if (documentType === '口座情報') {

      log("分岐: 口座振替依頼書の処理を開始");

      const bankInfo = extractBankAccountInfo(ocrText, log);

      const newRecordId = createBankAccountRecord(context, bankInfo, log);

      sendCompletionNotificationEmail(context, '口座情報', bankInfo, newRecordId, VIEW_NAME_MAP['口座情報'], log);

    } else if (documentType.includes('指示書')) {

      log("分岐: 指示書を含むドキュメントの処理を開始");

      const instructionInfo = extractInstructionInfo(ocrText, log);

      const newRecordId = createInstructionRecord(context, instructionInfo, log);

      sendCompletionNotificationEmail(context, documentType, instructionInfo, newRecordId, VIEW_NAME_MAP['指示書'], log);

    } else if (documentType === '提供票') {

      log("分岐: 介護サービス提供票の処理を開始");

      const serviceMasterMap = getServiceMasterAsMap(log);

      const extractedFormData = extractFormData(ocrText, log);

      const formResult = createNewServiceFormAndDetails(context, extractedFormData, serviceMasterMap, log);

      if (formResult.message.includes("スキップ")) {

        processSkipped = true;

        PropertiesService.getScriptProperties().setProperty(documentId, 'completed');

      } else {

        sendCompletionNotificationEmail(context, '提供票', formResult.extractedData, formResult.formId, VIEW_NAME_MAP['提供票'], log);

      }

    } else if (documentType === '負担割合証') {

      log("分岐: 介護保険負担割合証の処理を開始");

      const copayInfo = extractCopayInfo(ocrText, log);

      const newRecordId = createCopayCertificateRecord(context, copayInfo, log);

      sendCompletionNotificationEmail(context, '負担割合証', copayInfo, newRecordId, VIEW_NAME_MAP['負担割合証'], log);

    } else {

      throw new Error(`未知のドキュメント種別です: ${documentType}`);

    }

    

    if (!processSkipped) {

      log("メイン処理完了。ドキュメントステータスを更新します。");

      updateDocumentStatus(documentId, newRecordStatus, null, log);

    }

    

    PropertiesService.getScriptProperties().setProperty(documentId, 'completed');

    log(`ステータス更新: ID ${documentId} を 'completed' に設定しました。`);



    // ★★★ 修正: context.documentTypeを渡す ★★★

    sendProcessLogEmail(documentId, context.documentType, "成功", null, logCollector);



  } catch (error) {

    const errorMessage = error.stack || error.toString();

    log(`[!!! エラー発生 !!!] ${errorMessage}`);

    

    if (documentId !== "N/A") {

      updateDocumentStatus(documentId, "エラー", error.toString(), log);

      const errorLock = LockService.getScriptLock();

      try {

        errorLock.waitLock(10000);

        PropertiesService.getScriptProperties().deleteProperty(documentId);

        log(`ステータスリセット: ID ${documentId} でエラーが発生したため、'processing'状態を解除しました。`);

      } finally {

        errorLock.releaseLock();

      }

    }

    

    // ★★★ 修正: context.documentTypeを渡す (contextが存在しない場合も考慮) ★★★

    sendProcessLogEmail(documentId, (context ? context.documentType : '種別不明'), "失敗", errorMessage, logCollector);

  }

  

  return ContentService.createTextOutput("Process finished.");
}


/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  // TODO: テストデータを設定してください
  const testParams = {
    // 例: callId: "test-123",
    // 例: recordId: "rec-456",
    // 例: action: "CREATE"
  };

  console.log('=== テスト実行: Appsheet_訪問看護_書類仕分け ===');
  console.log('入力パラメータ:', JSON.stringify(testParams, null, 2));

  try {
    const result = processRequest(testParams);
    console.log('処理成功:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('処理エラー:', error.message);
    console.error('スタックトレース:', error.stack);
    throw error;
  }
}




/**

 * ===================================================================================

 * 3. 各種別ごとの処理関数

 * ===================================================================================

 */



// --- A: 医療保険証 ---

function extractMedicalInsuranceInfo(ocrText, birthDate, log) {

  log("医療保険証: Gemini APIによる情報抽出を開始 (コード変換ロジック追加)");

  

  // ★★★ 追加: 年齢計算ロジック ★★★

  const age = birthDate ? new Date(new Date() - new Date(birthDate)).getFullYear() - 1970 : null;



  const prompt = `

# あなたの役割

あなたは医療保険証、高齢受給者証、限度額適用認定証、減額認定証などを統合的に解析し、指定されたコード体系に従って情報を変換するエキスパートです。

以下のOCRテキストから、指定された項目を抽出し、厳密なJSON形式で出力してください。



# 前提情報

- 利用者の年齢: ${age || '不明'} 歳



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



// ★★★ ここからが新しい変換ルール ★★★

- **一部負担金区分 (copayment_category) - 別表７**:

  - **利用者の年齢が70歳以上の場合にのみ**、認定証の記載から以下のルールでコードを返してください。

  - 「低所得者Ⅱ」または「区Ⅱ」の記載がある場合 → \`"1"\`

  - 「低所得者Ⅰ」または「区Ⅰ」の記載がある場合 → \`"3"\`

  - 上記以外で70歳未満の場合はnullを返してください。



- **職務上の事由 (is_work_related_reason) - 別表８**:

  - 職務上の事由に関する記載を読み取り、以下の対応表に基づいて**コード**を返してください。

  - 「職上」または「職務上」と読める記載がある場合 → \`"1"\`

  - 「下３」または「下船後３月以内」と読める記載がある場合 → \`"2"\`

  - 「通災」または「通勤災害」と読める記載がある場合 → \`"3"\`



- **減免区分 (reduction_category) - 別表９**:

  - 減免に関する記載を読み取り、以下の対応表に基づいて**コード**を返してください。

  - 「減額」と読める記載がある場合 → \`"1"\`

  - 「免除」と読める記載がある場合 → \`"2"\`

  - 「支払猶予」と読める記載がある場合 → \`"3"\`

// ★★★ 新しい変換ルールここまで ★★★



- 該当する情報が見つからない項目の値は \`null\` にしてください。

- **禁止事項**: JSON以外の説明文や\`\`\`jsonマーカーは絶対に含めないでください。



# OCRテキスト

${ocrText}



# 出力形式 (このJSONフォーマットを厳守してください)

{

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

`;

  return callGeminiApi(prompt, log);

}

function createMedicalInsuranceRecord(context, extractedInfo, log) {

  log("医療保険証: AppSheetへのレコード作成を開始 (v8 - 本人区分デフォルト値設定)");



  const safeParseInt = (value) => {

    if (value === null || value === undefined) return null;

    const num = parseInt(value, 10);

    return isNaN(num) ? null : num;

  };

  

  const isWorkRelated = typeof extractedInfo.is_work_related_reason === 'string' && extractedInfo.is_work_related_reason.length > 0;



  const todayJSTStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

  const todayJST = new Date(todayJSTStr);



  let isActive = null;

  if (extractedInfo.effective_start_date) {

    const startDate = new Date(extractedInfo.effective_start_date);

    const endDateStr = extractedInfo.effective_end_date;

    const isEndDateValid = (!endDateStr || new Date(endDateStr) >= todayJST);

    

    if (startDate <= todayJST && isEndDateValid) {

      isActive = true;

    } else {

      isActive = false;

    }

  }



  // --- 給付割合・所得区分・本人区分の判定ロジック ---



  // 1. 給付割合のデフォルト値を設定

  let benefitRate = safeParseInt(extractedInfo.benefit_rate);

  if (benefitRate === null) {

    benefitRate = 70;

    log("給付割合が不明のため、デフォルト値の'70' (3割負担)に設定しました。");

  }



  // 2. AIの抽出結果をデフォルト値として変数を初期化

  let finalIncomeCategory = extractedInfo.income_category;

  let finalRelationship = extractedInfo.relationship_to_insured; // ★★★ 本人区分の変数を初期化 ★★★

  const insurerNumber = extractedInfo.insurer_number;



  // 3. 後期高齢者医療の場合、優先的に判定を実行

  if (insurerNumber && insurerNumber.startsWith('39')) {

    log("後期高齢者医療の保険証として検出。優先判定ロジックを適用します。");



    // ★★★ 本人・家族区分を'本人'に設定 ★★★

    finalRelationship = '本人';

    log(`-> 本人・家族区分を'${finalRelationship}'に設定しました。`);



    // 所得区分の判定

    if (benefitRate === 80) { // 2割負担

      finalIncomeCategory = '41';

      log(`-> 2割負担のため、所得区分を'${finalIncomeCategory}'に設定しました。`);

    } else if (benefitRate === 90) { // 1割負担

      finalIncomeCategory = '42';

      log(`-> 1割負担のため、所得区分を'${finalIncomeCategory}'に設定しました。`);

    }

  }



  const nowJST = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

  const newId = `MEDI-${Utilities.getUuid().substring(0, 8)}`;

  

  let effectiveEndDate = extractedInfo.effective_end_date;

  if (extractedInfo.effective_start_date && !effectiveEndDate) {

    effectiveEndDate = '2999/12/31';

  }



  const rowData = {

    "medical_insurance_id": newId,

    "status": "編集中",

    "client_id": context.clientId,

    "source_document_id": context.documentId,

    "created_at": nowJST,

    "created_by": context.staffId,

    "updated_at": nowJST,

    "updated_by": context.staffId,

    "is_currently_active": isActive,

    "effective_start_date": extractedInfo.effective_start_date,

    "effective_end_date": effectiveEndDate,

    "insurer_number": extractedInfo.insurer_number,

    "policy_symbol": extractedInfo.policy_symbol,

    "policy_number": extractedInfo.policy_number,

    "branch_number": extractedInfo.branch_number,

    "relationship_to_insured": finalRelationship,

    "insurance_category": extractedInfo.insurance_category,

    "is_work_related_reason": extractedInfo.is_work_related_reason, // ★★★ 修正: AIが返したコードをそのまま使用 ★★★

    "benefit_rate": benefitRate,

    "income_category": finalIncomeCategory,

    "copayment_category": extractedInfo.copayment_category, // ★★★ 追加 ★★★

    "certificate_number": extractedInfo.certificate_number,

    "fixed_copayment_amount": safeParseInt(extractedInfo.fixed_copayment_amount),

    "reduction_category": extractedInfo.reduction_category, // ★★★ AIが返したコードを使用 ★★★

    "reduction_rate_percent": safeParseInt(extractedInfo.reduction_rate_percent),

    "reduction_amount": safeParseInt(extractedInfo.reduction_amount),

    "reduction_cert_expiration_date": extractedInfo.reduction_cert_expiration_date,

    "remarks": null 

  };

  

  const payload = { Action: "Add", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(MEDICAL_INSURANCE_TABLE_NAME, payload, log);



  return newId;

}



// --- B: 介護保険証 ---

function extractLtciInsuranceInfo(ocrText, log) {

  log("介護保険証: Gemini APIによる情報抽出を開始");

  const prompt = `

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

- **給付率 (benefit_rate)**: 「9割」であれば 90、「8割」であれば 80 のように、**整数**で返してください。

- **次回更新確認日 (next_renewal_check_date)**: 「認定有効期間（終了）」の日付を読み取り、その**1ヶ月前の日付**を計算して「yyyy/mm/dd」形式で返してください。

- 該当する情報が見つからない項目の値は null にしてください。

- JSON以外の説明文や\`\`\`jsonマーカーは不要です。



# OCRテキスト

${ocrText}



# 出力形式 (このJSONフォーマットを厳守してください)

{

  "insured_person_number": "string or null",

  "insurer_number": "string or null",

  "insurer_name": "string or null",

  "care_level": "string ('12', '21'など) or null",

  "cert_start_date": "string (yyyy/mm/dd) or null",

  "cert_end_date": "string (yyyy/mm/dd) or null",

  "benefit_rate": "number (90, 80, 70など) or null",

  "next_renewal_check_date": "string (yyyy/mm/dd) or null"

}

`;

  return callGeminiApi(prompt, log);

}

function createLtciInsuranceRecord(context, extractedInfo, log) {

  log("介護保険証: AppSheetへのレコード作成を開始");

  const newId = `LTCI-${Utilities.getUuid().substring(0, 8)}`;



  let certEndDate = extractedInfo.cert_end_date;

  if (extractedInfo.cert_start_date && !certEndDate) {

    certEndDate = '2999/12/31';

  }



  const rowData = {

    "ltci_insurance_id": newId,

    "client_id": context.clientId,

    "source_document_id": context.documentId,

    "status": "編集中",

    "created_by": context.staffId,

    "updated_by": context.staffId,

    "insured_person_number": extractedInfo.insured_person_number,

    "insurer_number": extractedInfo.insurer_number,

    "insurer_name": extractedInfo.insurer_name,

    "care_level": extractedInfo.care_level,

    "cert_start_date": extractedInfo.cert_start_date,

    "cert_end_date": certEndDate,

    "benefit_rate": extractedInfo.benefit_rate,

    "next_renewal_check_date": extractedInfo.next_renewal_check_date

  };

  const payload = { Action: "Add", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(LTCI_INSURANCE_TABLE_NAME, payload, log);



  return newId;

}



// --- C: 公費受給者証 ---

function extractSubsidyInfo(ocrText, birthDate, log) {

  log("公費: Gemini APIによる情報抽出を開始");

  const subsidyMasterText = getPublicSubsidyMasterAsText(log);

  const age = birthDate ? new Date(new Date() - new Date(birthDate)).getFullYear() - 1970 : null;



  const prompt = `

# あなたの役割

あなたは公費負担医療受給者証および限度額適用認定証を解析するエキスパートです。

以下のOCRテキストから、指定された項目を抽出し、厳密なJSON形式で出力してください。



# 前提情報

- 利用者の年齢: ${age || '不明'} 歳



# 抽出ルール

- **公費制度名 (subsidy_name)**: OCRテキストの内容と#公費マスターを照合し、最も一致する制度の**law_number**を返してください。

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



// ★★★ ここからが新しい指示 ★★★

- **「無料」の特別ルール**:

  - 自己負担金に関する記載で、主に「通院」の項目が「無料」と書かれている場合、それは自己負担が0円であることを意味します。

  - その場合は、\`benefit_rate_percent\`（公費給付率）を \`100\` に、\`monthly_limit_amount\`（月額上限額）を \`0\` に設定してください。

  - 他の上限額の記載（例: \`5,000円\`）よりも、この「無料」という記載を優先して判断してください。

// ★★★ 新しい指示ここまで ★★★



- **禁止事項**: JSON以外の説明文や\`\`\`jsonマーカーは絶対に含めないでください。



# 公費マスター (コード: 正式名称)

${subsidyMasterText}



# OCRテキスト

${ocrText}



# 出力形式 (このJSONフォーマットを厳守してください)

{

  "subsidy_name": "string (マスターのlaw_number) or null",

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

`;

  return callGeminiApi(prompt, log);

}

function createSubsidyRecord(context, extractedInfo, log) {

  log("公費: AppSheetへのレコード作成を開始 (新仕様)");

  

  const parseIntStrict = (value) => {

    if (value === null || value === undefined || value === '') return null;

    const digitsOnly = String(value).replace(/[^0-9]/g, '');

    if (digitsOnly === '') return null;

    return parseInt(digitsOnly, 10);

  };



  const todayJSTStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

  const todayJST = new Date(todayJSTStr);



  let isActive = null;

  if (extractedInfo.effective_start_date) {

    const startDate = new Date(extractedInfo.effective_start_date);

    const endDateStr = extractedInfo.effective_end_date;

    const isEndDateValid = (!endDateStr || new Date(endDateStr) >= todayJST);

    if (startDate <= todayJST && isEndDateValid) {

      isActive = true;

    } else {

      isActive = false;

    }

  }



  const nowJST = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

  const newId = `CLPB-${Utilities.getUuid().substring(0, 8)}`;



  let effectiveEndDate = extractedInfo.effective_end_date;

  if (extractedInfo.effective_start_date && !effectiveEndDate) {

    effectiveEndDate = '2999/12/31';

  }



  const rowData = {

    // --- システム項目 ---

    "public_subsidy_id": newId,

    "status": "編集中",

    "client_id": context.clientId,

    "source_document_id": context.documentId,

    "created_at": nowJST,

    "created_by": context.staffId,

    "updated_at": nowJST,

    "updated_by": context.staffId,

    

    // --- スクリプトによる判定項目 ---

    "is_currently_active": isActive,

    

    // --- AIによる抽出項目 ---

    "subsidy_name": extractedInfo.subsidy_name,

    "payer_number": extractedInfo.payer_number,

    "recipient_number": extractedInfo.recipient_number,

    "subsidy_category_number": extractedInfo.subsidy_category_number,

    "copayment_category": extractedInfo.copayment_category,

    "income_category": extractedInfo.income_category,

    "benefit_rate_percent": parseIntStrict(extractedInfo.benefit_rate_percent),

    "limit_unit_type": extractedInfo.limit_unit_type,

    "monthly_limit_amount": parseIntStrict(extractedInfo.monthly_limit_amount),

    "per_service_limit_amount": parseIntStrict(extractedInfo.per_service_limit_amount),

    "monthly_visit_limit": parseIntStrict(extractedInfo.monthly_visit_limit),

    "effective_start_date": extractedInfo.effective_start_date,

    "effective_end_date": effectiveEndDate,

    

    // --- 手動入力項目 (今回はnull) ---

    "priority_rank": null,

    "remarks": null

  };

  

  const payload = { Action: "Add", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(PUBLIC_SUBSIDY_TABLE_NAME, payload, log);

  

  return newId;

}



// --- D: 口座振替依頼書 ---

function extractBankAccountInfo(ocrText, log) {

  log("口座: Gemini APIによる情報抽出を開始");

  const prompt = `

# あなたの役割

あなたは、金融機関の帳票を読み取る専門のOCR AIです。提供された「預金口座振替依頼書」のOCRテキストから、データベース登録に必要な情報を極めて正確に抽出してください。



# 思考プロセス

1.  まず、OCRテキスト全体を注意深く読み、どの金融機関が指定されているか（ゆうちょ銀行か、それ以外の銀行か）を特定します。取消線が引かれている金融機関は無視します。

2.  **ゆうちょ銀行の場合:**

    * \`bank_name_kana\`には「ﾕｳﾁﾖｷﾞﾝｺｳ」と設定します。

    * \`bank_code\`には「9900」と設定します。

    * OCRテキスト内の「記号」（通常5桁の数字）を探します。

    * **【重要】記号から支店コードを生成します。記号の真ん中の3桁（左から2桁目, 3桁目, 4桁目）をそのまま抜き出し、3桁の支店コードとして\`branch_code\`に設定します。（例：記号が「12345」なら、真ん中の3桁「234」を支店コードとします）**

    * \`account_number\`にはOCRテキスト内の「番号」（通常8桁）を抽出します。

    * \`account_type\`は「普通」と設定します。

3.  **ゆうちょ銀行以外の場合:**

    * OCRテキスト内の「金融機関番号」を\`bank_code\`として抽出します。

    * 「店舗番号」を\`branch_code\`として抽出します。

    * 「口座番号」を\`account_number\`として抽出します。

    * 「預金種目」から「普通」または「当座」を判断し、\`account_type\`に設定します。

4.  上記で特定した金融機関情報に加え、以下の共通項目を抽出します。

    * \`account_holder_name_kana\`: 「カナ預金者名」を抽出します。

    * \`biller_number\`: 「委託者番号」を抽出します。

    * その他、対応する項目があれば抽出します。

5.  全ての抽出が完了したら、最終的な結果を指示されたJSON形式で出力します。



# 参照情報 (OCRテキスト)

${ocrText}



# 抽出ルールと出力形式

- 上記の思考プロセスに従って、参照情報から以下のJSONオブジェクトのキーに対応する値を抽出してください。

- **重要**: カナ名称は、必ず**半角カタカナ**で記述してください。

- 該当する情報がない場合や、読み取れない場合は、値に\`null\`を設定してください。

- JSON以外の説明文は一切含めないでください。



{

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

}`;

  return callGeminiApi(prompt, log, 'gemini-2.5-pro');

}

function createBankAccountRecord(context, extractedInfo, log) {

  log("口座: AppSheetへのレコード作成を開始");

  const toHalfWidthKana = (str) => str ? String(str).replace(/[\u30A1-\u30F6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60)) : null;

  

  extractedInfo.bank_name_kana = toHalfWidthKana(extractedInfo.bank_name_kana);

  extractedInfo.account_holder_name_kana = toHalfWidthKana(extractedInfo.account_holder_name_kana);

  extractedInfo.biller_name_kana = toHalfWidthKana(extractedInfo.biller_name_kana);



  let accountNumber = extractedInfo.account_number ? String(extractedInfo.account_number).trim() : null;

  if (accountNumber && accountNumber.length === 8) {

    const originalNumber = accountNumber;

    if (extractedInfo.bank_code === '9900') {

      if (accountNumber.endsWith('1')) {

        accountNumber = accountNumber.substring(0, 7);

        log(`口座番号調整(ゆうちょ): ${originalNumber} -> ${accountNumber}`);

      }

    } else {

      accountNumber = accountNumber.slice(-7);

      log(`口座番号調整(その他): ${originalNumber} -> ${accountNumber}`);

    }

    extractedInfo.account_number = accountNumber;

  }



  const status = "編集中";

  const newId = `BACC-${Utilities.getUuid().substring(0, 8)}`;

  

  const rowData = {

    "bank_account_id": newId,

    "client_id": context.clientId,

    "source_document_id": context.documentId,

    "status": status,

    "created_by": context.staffId,

    "updated_by": context.staffId,

    ...extractedInfo

  };



  const payload = { Action: "Add", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(BANK_ACCOUNTS_TABLE_NAME, payload, log);

  

  return newId;

}



// --- E: 訪問看護指示書 ---

function extractInstructionInfo(ocrText, log) {

  log("訪問看護指示書: Gemini APIによる情報抽出を開始");

  const prompt = `

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

- 傷病名コード (diseaseMedicalCode1, 2, 3): \`diseaseNameList\` の各傷病名に対応するコードを、指示書テキスト内から抽出して返してください。テキスト内にコードの記載がない傷病名については、nullを返してください。3つに満たない場合も同様にnullを返してください。



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



# OCRテキスト

${ocrText}



# 出力形式 (このJSONフォーマットを厳守してください)

{

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

`;

  return callGeminiApi(prompt, log);

}

function createInstructionRecord(context, extractedInfo, log) {

  log("訪問看護指示書: AppSheetへのレコード作成を開始");

  const prefectureCode = getPrefectureCode(extractedInfo.clinicAddress);

  const newId = `ODR-${Utilities.getUuid().substring(0, 8)}`;



  let instructionEndDate = extractedInfo.instructionEndDate;

  if (extractedInfo.instructionStartDate && !instructionEndDate) {

    instructionEndDate = '2999/12/31';

  }

  let dripEndDate = extractedInfo.dripInfusionEndDate;

  if (extractedInfo.dripInfusionStartDate && !dripEndDate) {

    dripEndDate = '2999/12/31';

  }



  const rowData = {

    "instruction_id": newId,

    "client_id": context.clientId,

    "source_document_id": context.documentId,

    "status": "適用前（編集中）",

    "created_by": context.staffId,

    "updated_by": context.staffId,

    "instruction_type": extractedInfo.instructionType,

    "start_date": extractedInfo.instructionStartDate,

    "end_date": instructionEndDate,

    "iv_drip_start_date": extractedInfo.dripInfusionStartDate,

    "iv_drip_end_date": dripEndDate,

    "issue_date": extractedInfo.issueDate,

    "clinic_prefecture_code": prefectureCode,

  };



  const instructionType = extractedInfo.instructionType;

  if (instructionType !== '02' && instructionType !== '04') {

    rowData.notified_disease_category = extractedInfo.specifiedDiseaseNoticeCode;

    rowData.notified_disease_codes = (extractedInfo.specifiedDiseaseCodes || []).join(', ');

    rowData.disease_1_code = extractedInfo.diseaseMedicalCode1;

    rowData.disease_2_code = extractedInfo.diseaseMedicalCode2;

    rowData.disease_3_code = extractedInfo.diseaseMedicalCode3;

    rowData.disease_1_unlisted_name = extractedInfo.diseaseMedicalCode1 ? null : (extractedInfo.diseaseNameList && extractedInfo.diseaseNameList.length > 0 ? extractedInfo.diseaseNameList[0] : null);

    rowData.disease_2_unlisted_name = extractedInfo.diseaseMedicalCode2 ? null : (extractedInfo.diseaseNameList && extractedInfo.diseaseNameList.length > 1 ? extractedInfo.diseaseNameList[1] : null);

    rowData.disease_3_unlisted_name = extractedInfo.diseaseMedicalCode3 ? null : (extractedInfo.diseaseNameList && extractedInfo.diseaseNameList.length > 2 ? extractedInfo.diseaseNameList[2] : null);

  }



  const payload = { Action: "Add", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(INSTRUCTIONS_TABLE_NAME, payload, log);



  return newId;

}



// --- F: 介護サービス提供票 ---

function extractFormData(ocrText, log) {

  log("サービス提供票: Gemini APIによる情報抽出を開始");

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

  return callGeminiApi(prompt, log);

}

// --- F: 介護サービス提供票 ---

function createNewServiceFormAndDetails(context, extractedData, serviceMasterMap, log) {

  const { clientId, staffId, documentId } = context;

  const { formHeader, formDetails } = extractedData;



  if (!formHeader || !formDetails) {

    throw new Error("AIからの応答が不正、または必要なデータ(formHeader, formDetails)が含まれていませんでした。");

  }

  if (!formHeader.applicable_month || !/^\d{6}$/.test(formHeader.applicable_month)) {

    throw new Error(`AIが対象月(applicable_month)を不正な形式(yyyymm)で抽出しました: ${formHeader.applicable_month}`);

  }

  

  // ★★★ 修正: AppSheet API検索からスプレッドシート検索に変更 ★★★

  const existingForms = getServiceFormsFromSheet(clientId, formHeader.applicable_month, log);



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

      log(returnMessage);

      

      const detailsToDeletePayload = { Action: "Delete", Properties: {}, Selector: `FILTER(Service_Form_Details, [form_id] = "${targetFormId}")` };

      callAppSheetApi(DETAILS_TABLE_NAME, detailsToDeletePayload, log);

      

      const formUpdateRow = { "form_id": targetFormId, "creation_date": formattedCreationDate, "status": "編集中", "updated_by": staffId };

      const formUpdatePayload = { Action: "Edit", Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: [formUpdateRow] };

      callAppSheetApi(FORMS_TABLE_NAME, formUpdatePayload, log);

    } else {

      returnMessage = `既存の提供票の方が新しいため、処理をスキップしました。（新: ${newCreationDate.toLocaleDateString()} < 旧: ${existingCreationDate.toLocaleDateString()}）`;

      log(returnMessage);

      updateDocumentStatus(documentId, "スキップ", `既存の提供票(作成日: ${existingCreationDate.toLocaleDateString()})の方が新しいため`, log);

      return { formId: existingForms[0].form_id, extractedData: extractedData, message: returnMessage };

    }

  } else {

    // 新規作成のロジック

    targetFormId = `FORM-${Utilities.getUuid().substring(0, 8)}`;

    returnMessage = `新しい提供票を作成します: ${targetFormId}`;

    log(returnMessage);

    const formRow = {

      "form_id": targetFormId, "client_id": clientId, "source_document_id": documentId,

      "status": "編集中", "created_by": staffId, "updated_by": staffId,

      "applicable_month": formHeader.applicable_month,  

      "creation_date": formattedCreationDate

    };

    const formPayload = { Action: "Add", Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: [formRow] };

    callAppSheetApi(FORMS_TABLE_NAME, formPayload, log);

  }

  

  const newDetailsToCreate = [];

  const year = formHeader.applicable_month.substring(0, 4);

  const month = formHeader.applicable_month.substring(4, 6);



  formDetails.forEach(detailGroup => {

    if (!detailGroup.service_code) return;

    const masterInfo = serviceMasterMap.get(String(detailGroup.service_code).trim());

    if (!masterInfo) {

      log(`警告: マスターにサービスコード 「${detailGroup.service_code}」 が見つかりません。スキップします。`);

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

          service_code: detailGroup.service_code, item_category: itemCategory,

          service_name: masterInfo.name, service_units: masterInfo.units, service_count: 1

        });

      });

    } else if (detailGroup.service_count && detailGroup.service_count > 0) {

      for (let i = 0; i < detailGroup.service_count; i++) {

        newDetailsToCreate.push({

          service_date: null,

          planned_start_time: detailGroup.planned_start_time, planned_end_time: detailGroup.planned_end_time,

          service_code: detailGroup.service_code, item_category: itemCategory,

          service_name: masterInfo.name, service_units: masterInfo.units, service_count: 1

        });

      }

    } else if (itemCategory === "加算" || itemCategory === "減算") {

      newDetailsToCreate.push({

        service_date: null, planned_start_time: null, planned_end_time: null,

        service_code: detailGroup.service_code, item_category: itemCategory,

        service_name: masterInfo.name, service_units: masterInfo.units, service_count: 1

      });

    }

  });



  if (newDetailsToCreate.length > 0) {

    const detailRows = newDetailsToCreate.map(d => ({

      "detail_id": `DET-${Utilities.getUuid().substring(0, 8)}`,

      "form_id": targetFormId, "client_id": clientId, "status": "編集中",

      "created_by": staffId, "updated_by": staffId, ...d

    }));

    const detailPayload = { Action: "Add", Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: detailRows };

    callAppSheetApi(DETAILS_TABLE_NAME, detailPayload, log);

    log(`${detailRows.length}件のサービス明細を作成しました。`);

  }

  

  return { formId: targetFormId, extractedData: extractedData, message: returnMessage };

}



// --- G: 介護保険負担割合証 ---

function extractCopayInfo(ocrText, log) {

  log("介護保険負担割合証: Gemini APIによる情報抽出を開始");

  const prompt = `

# あなたの役割

あなたは介護保険負担割合証を解析するエキスパートです。

以下のOCRテキストから、指定された項目を抽出し、厳密なJSON形式で出力してください。



# 抽出ルール

- 日付はすべて西暦の「yyyy/mm/dd」形式に変換してください。和暦は正しく西暦に変換してください。

- **負担割合 (copayment_rate)**: 「1割」「2割」「3割」のいずれかの文字列で返してください。

- **給付率 (benefit_rate)**: 負担割合に応じて、90, 80, 70 のいずれかの**整数**で返してください。

- 該当する情報が見つからない項目の値は null にしてください。

- JSON以外の説明文や\`\`\`jsonマーカーは不要です。



# OCRテキスト

${ocrText}



# 出力形式 (このJSONフォーマットを厳守してください)

{

  "copayment_rate": "string ('1割', '2割', '3割') or null",

  "benefit_rate": "number (90, 80, 70) or null",

  "effective_start_date": "string (yyyy/mm/dd) or null",

  "effective_end_date": "string (yyyy/mm/dd) or null",

  "issue_date": "string (yyyy/mm/dd) or null"

}

`;

  return callGeminiApi(prompt, log);

}

function createCopayCertificateRecord(context, extractedInfo, log) {

  log("介護保険負担割合証: AppSheetへのレコード作成を開始");

  const newId = `COPAY-${Utilities.getUuid().substring(0, 8)}`;



  let effectiveEndDate = extractedInfo.effective_end_date;

  if (extractedInfo.effective_start_date && !effectiveEndDate) {

    effectiveEndDate = '2999/12/31';

  }



  const rowData = {

    "copay_cert_id": newId,

    "client_id": context.clientId,

    "source_document_id": context.documentId,

    "status": "編集中",

    "created_by": context.staffId,

    "updated_by": context.staffId,

    "copayment_rate": extractedInfo.copayment_rate,

    "benefit_rate": extractedInfo.benefit_rate,

    "effective_start_date": extractedInfo.effective_start_date,

    "effective_end_date": effectiveEndDate,

    "issue_date": extractedInfo.issue_date

  };

  const payload = { Action: "Add", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

  callAppSheetApi(COPAYMENT_TABLE_NAME, payload, log);

  

  return newId;

}





/**

 * ===================================================================================

 * 4. 共通ヘルパー関数

 * ===================================================================================

 */



/**

 * メタデータとOCRテキストが混在した文字列を分解し、オブジェクトとして返す

 * @param {string} compositeText - Webhookで受信した混在テキスト

 * @returns {object} - 分解されたデータのオブジェクト

 */

function parseCompositeOcrText(compositeText) {

  const parsedData = {

    documentId: null,

    clientId: null,

    documentType: null,

    staffId: null,

    driveFileId: null,

    rawOcrText: '' // AIに渡す純粋なOCRテキスト

  };



  if (!compositeText) return parsedData;



  // ★★★ ここが修正点 ★★★

  // "\n" という文字列を、本物の改行コードに置換してから分割する

  const lines = compositeText.replace(/\\n/g, '\n').split('\n');

  const ocrStartIndex = lines.findIndex(line => line.startsWith('OCRテキスト:'));



  // AIに渡す純粋なOCRテキストを抽出

  if (ocrStartIndex !== -1) {

    parsedData.rawOcrText = lines.slice(ocrStartIndex).join('\n').substring('OCRテキスト:'.length).trim();

  } else {

    // "OCRテキスト:" の区切りが見つからない場合は、全体をOCRテキストとみなす

    parsedData.rawOcrText = compositeText;

  }

  

  // メタデータを抽出

  const metadataLines = (ocrStartIndex !== -1) ? lines.slice(0, ocrStartIndex) : lines;

  metadataLines.forEach(line => {

    const parts = line.split(':');

    if (parts.length < 2) return;

    

    const key = parts[0].trim();

    const value = parts.slice(1).join(':').trim();



    switch (key) {

      case '書類ID':

        parsedData.documentId = value;

        break;

      case '利用者ID':

        parsedData.clientId = value;

        break;

      case '書類の種類':

        parsedData.documentType = value;

        break;

      case 'ファイルID':

        parsedData.driveFileId = value;

        break;

      case '最終更新者': // staffIdとして利用

        parsedData.staffId = value;

        break;

    }

  });



  return parsedData;

}



// --- Gemini API 呼び出し共通関数 ---

function callGeminiApi(prompt, log, model = 'gemini-2.5-pro') {

  const textPart = { text: prompt };

  const generationConfig = { "responseMimeType": "application/json", "temperature": 0.3 };

  const requestBody = { contents: [{ parts: [textPart] }], generationConfig: generationConfig };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(requestBody), muteHttpExceptions: true };



  const response = UrlFetchApp.fetch(url, options);

  const responseText = response.getContentText();

  const responseCode = response.getResponseCode();

  log(`Gemini API 応答: ${responseCode}`);

  

  if (responseCode >= 400) throw new Error(`Gemini API Error (${responseCode}): ${responseText}`);

  

  const jsonResponse = JSON.parse(responseText);

  if (!jsonResponse.candidates || !jsonResponse.candidates[0].content || !jsonResponse.candidates[0].content.parts[0].text) {

    throw new Error("AIからの応答に有効な候補が含まれていません: " + responseText);

  }



  const content = jsonResponse.candidates[0].content.parts[0].text;

  const startIndex = content.indexOf('{');

  const endIndex = content.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1) {

     throw new Error("AIの応答からJSONを抽出できませんでした。応答内容: " + content);

  }

  

  return JSON.parse(content.substring(startIndex, endIndex + 1));

}



// --- AppSheet API 呼び出し共通関数 ---

function callAppSheetApi(tableName, payload, log) {

  log(`AppSheet API 呼び出し: Table=${tableName}, Action=${payload.Action}`);

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${tableName}/Action`;

  const options = {

    method: 'post',

    contentType: 'application/json',

    headers: { 'ApplicationAccessKey': ACCESS_KEY },

    payload: JSON.stringify(payload),

    muteHttpExceptions: true

  };

  const response = UrlFetchApp.fetch(apiUrl, options);

  const responseText = response.getContentText();

  const responseCode = response.getResponseCode();

  log(`AppSheet API (${tableName}) 応答: ${responseCode}`);



  if (responseCode >= 400) {

    log(`AppSheet API Error Body: ${responseText}`);

    throw new Error(`AppSheet API Error (${tableName}, Code: ${responseCode})`);

  }

  return responseText;

}



// --- ドキュメントステータス更新関数 ---

function updateDocumentStatus(documentId, status, errorMessage, log) {

  const rowData = { "document_id": documentId, "status": status };

  if (errorMessage) {

    rowData.error_details = `GAS Script Error: ${errorMessage}`;

  }

  const payload = { Action: "Edit", Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: [rowData] };

  callAppSheetApi(DOCUMENTS_TABLE_NAME, payload, log);

}



/**

 * ログメール送信関数

 * @param {string} documentId - 書類ID

 * @param {string} documentTypeJP - 日本語の書類種別

 * @param {string} status - 処理ステータス ('成功' or '失敗')

 * @param {string} errorInfo - エラー情報

 * @param {Array} logCollector - 収集されたログ

 */

function sendProcessLogEmail(documentId, documentTypeJP, status, errorInfo, logCollector) {

  try {

    // ★★★ 修正: 件名に書類種別を追加 ★★★

    const subject = `[GAS Log][${status}] ${documentTypeJP || '種別不明'}の自動登録処理 (Doc ID: ${documentId})`;

    let body = `AppSheetの自動登録処理が完了しました。\n\n`;

    body += `■ 処理結果: ${status}\n`;

    body += `■ 対象ドキュメントID: ${documentId}\n`;

    if (status === "失敗" && errorInfo) {

      body += `\n■ エラー詳細:\n${errorInfo}\n`;

    }

    body += "\n---------- 実行ログ ----------\n\n";

    body += logCollector.join('\n');

    

    // Email removed - using execution log instead

    console.log(`処理ログメールを ${ERROR_NOTIFICATION_EMAIL} へ送信しました。`);

  } catch(e) {

    console.error(`[重大エラー] ログメールの送信自体に失敗しました: ${e.stack}`);

  }

}



// --- 公費マスター取得 ---

function getPublicSubsidyMasterAsText(log) {

  log("公費マスター: スプレッドシートから読み込み");

  const sheet = SpreadsheetApp.openById(PUBLIC_SUBSIDY_MASTER_SS_ID).getSheetByName(PUBLIC_SUBSIDY_MASTER_SHEET_NAME);

  const data = sheet.getDataRange().getValues();

  data.shift(); // ヘッダー行を削除

  // "law_number", "official_name" の形式でテキストを生成

  return data.map(row => `- "${row[0]}": ${row[3]}`).join('\n');

}



// --- サービスマスター取得 (キャッシュ付き) ---

function getServiceMasterAsMap(log) {

  const cache = CacheService.getScriptCache();

  const CACHE_KEY = 'SERVICE_MASTER_MAP_CACHE';

  

  const cached = cache.get(CACHE_KEY);

  if (cached) {

    log("サービスマスター: キャッシュから取得");

    return new Map(JSON.parse(cached));

  }



  log("サービスマスター: スプレッドシートから読み込み");

  const sheet = SpreadsheetApp.openById(SERVICE_MASTER_SS_ID).getSheetByName(SERVICE_MASTER_SHEET_NAME);

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



// --- 都道府県コード取得 ---

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

    if (address.startsWith(pref)) {

      return prefMap[pref];

    }

  }

  return null;

}



/**

 * 有効期限（終了日）がnullの場合にデフォルトの日付文字列を返す

 * @param {string | null} dateString - AIが抽出した日付文字列

 * @returns {string} - 有効な日付文字列、またはデフォルトの '2999/12/31'

 */

function getEndDateOrDefault(dateString) {

  if (dateString === null || dateString === undefined || dateString === '') {

    return '2999/12/31';

  }

  return dateString;

}



/**

 * 処理完了を知らせるHTMLメールを送信する

 * @param {object} context - Webhookで受信したパラメータ

 * @param {string} documentTypeJP - 日本語のドキュメント種別

 * @param {object} extractedData - AIが抽出したデータオブジェクト

 * @param {string} newRecordId - AppSheetで作成された新しいレコードのID

 * @param {string} viewName - AppSheetの詳細ビュー名

 * @param {function} log - ログ出力用の関数

 */

function sendCompletionNotificationEmail(context, documentTypeJP, extractedData, newRecordId, viewName, log) {

  if (!COMPLETION_NOTIFICATION_EMAILS) {

    log("完了通知メールの宛先が設定されていないため、送信をスキップします。");

    return;

  }



  const { clientId, staffId, driveFileId, clientName, staffName } = context;

  const displayClientName = clientName || clientId;

  const displayStaffName = staffName || staffId;

  const subject = `【要確認】${documentTypeJP}の自動登録が完了しました (${displayClientName} 様)`;



  const encodedAppName = encodeURIComponent(APP_NAME);

  const encodedViewName = encodeURIComponent(viewName);

  const encodedRowId = encodeURIComponent(newRecordId);

  const appSheetLink = `https://www.appsheet.com/start/${APP_ID}?platform=desktop#appName=${encodedAppName}&view=${encodedViewName}&row=${encodedRowId}`;

  

  // ★★★ GoogleドライブへのリンクとボタンHTMLを生成 ★★★

  const driveFileLink = driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null;

  const driveLinkButtonHtml = driveFileLink 

    ? `<a href="${driveFileLink}" target="_blank" style="background-color: #008CBA; color: white; padding: 12px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; font-size: 16px; margin-left: 10px;">原本ファイルを開く</a>`

    : '';



  

  // ★★★ 値をメール表示用に整形するヘルパー関数 ★★★

  const formatValueForEmail = (value) => {

    if (value === null || value === undefined) return '';

    if (Array.isArray(value)) {

      return value.join(', '); // 配列をカンマ区切りの文字列に

    }

    return value; // 文字列や数値をそのまま返す

  };

  

  let dataContentHtml = '';



  // ★★★ 提供票の場合の特別なHTMLを生成 ★★★

  if (documentTypeJP === '提供票') {

    const { formHeader, formDetails } = extractedData;

    

    // フォームヘッダー情報

    dataContentHtml += '<h4 style="color: #666; margin-bottom: 5px; border-bottom: 2px solid #4CAF50; padding-bottom: 5px;">基本情報</h4><table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">';

    if(formHeader){

      for (const key in formHeader) {

        dataContentHtml += `<tr style="border-bottom: 1px solid #ddd;"><th style="padding: 8px; text-align: left; background-color: #f2f2f2; width: 150px;">${key}</th><td style="padding: 8px; text-align: left;">${formHeader[key]}</td></tr>`;

      }

    }

    dataContentHtml += '</table>';



    // サービス明細情報

    dataContentHtml += '<h4 style="color: #666; margin-bottom: 5px; border-bottom: 2px solid #008CBA; padding-bottom: 5px;">登録サービス明細</h4><table style="width: 100%; border-collapse: collapse;">';

    dataContentHtml += '<tr style="border-bottom: 1px solid #ddd; background-color: #f2f2f2;"><th style="padding: 8px; text-align: left;">サービスコード</th><th style="padding: 8px; text-align: left;">提供日</th><th style="padding: 8px; text-align: left;">予定時間</th><th style="padding: 8px; text-align: left;">回数</th></tr>';

    (formDetails || []).forEach(detail => {

      dataContentHtml += `<tr style="border-bottom: 1px solid #ddd;">

        <td style="padding: 8px;">${detail.service_code || ''}</td>

        <td style="padding: 8px;">${(detail.service_dates || []).join(', ')}</td>

        <td style="padding: 8px;">${detail.planned_start_time || ''}</td>

        <td style="padding: 8px;">${detail.service_count || ''}</td>

      </tr>`;

    });

    dataContentHtml += '</table>';



  } else {

    // 提供票以外の通常の処理

    dataContentHtml = '<table style="width: 100%; border-collapse: collapse;">';

    for (const key in extractedData) {

      const value = extractedData[key];

      // ★★★ 空の値は表示しないように修正 ★★★

      if (value !== null && value !== '' && JSON.stringify(value) !== '[]' && JSON.stringify(value) !== '{}' ) {

        // ★★★ 翻訳マップを使い、項目名を日本語に変換 ★★★

        const japaneseKey = KEY_TO_JAPANESE_MAP[key] || key;

        // ★★★ 新しいフォーマット関数を使い、ダブルクォーテーションを削除 ★★★

        const formattedValue = formatValueForEmail(value);



        dataContentHtml += `

          <tr style="border-bottom: 1px solid #ddd;">

            <th style="padding: 8px; text-align: left; background-color: #f2f2f2; width: 150px;">${japaneseKey}</th>

            <td style="padding: 8px; text-align: left;">${formattedValue}</td>

          </tr>`;

      }

    }

    dataContentHtml += '</table>';

  }



  const htmlBody = `

    <html lang="ja">

    <body>

      <div style="font-family: Arial, 'Helvetica Neue', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">

        <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">書類の自動登録が完了しました</h2>

        <p>${displayClientName} 様の${documentTypeJP}の自動登録処理が完了しましたので、内容のご確認をお願いいたします。</p>

        

        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-top: 20px;">

          <h3 style="margin-top: 0; color: #555;">処理概要</h3>

          <p style="margin: 5px 0;"><strong>書類種別:</strong> ${documentTypeJP}</p>

          <p style="margin: 5px 0;"><strong>担当者:</strong> ${displayStaffName} (ID: ${staffId})</p>

          <p style="margin: 5px 0;"><strong>利用者:</strong> ${displayClientName} (ID: ${clientId})</p>

        </div>



        <div style="margin-top: 20px;">

          <h3 style="color: #555;">登録された主な内容</h3>

          ${dataContentHtml}

        </div>



        <div style="margin-top: 30px; text-align: center;">

          <a href="${appSheetLink}" target="_blank" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; font-size: 16px;">AppSheetで内容を確認する</a>

          ${driveLinkButtonHtml}

        </div>

        

        <p style="margin-top: 30px; font-size: 12px; color: #888;">このメールはシステムによって自動的に送信されています。</p>

      </div>

    </body>

    </html>

  `;



  // ファイル添付ロジックはそのまま維持します

  const options = { htmlBody: htmlBody };

  if (driveFileId) {

    try {

      const file = DriveApp.getFileById(driveFileId);

      options.attachments = [file.getBlob()];

      log(`原本ファイル(ID: ${driveFileId})をメールに添付します。`);

    } catch (e) {

      log(`[エラー] ファイル(ID: ${driveFileId})の取得または添付に失敗しました: ${e.toString()}`);

    }

  }

  

  try {

    // Email removed - using execution log instead

    log(`完了通知メールを ${COMPLETION_NOTIFICATION_EMAILS} へ送信しました。`);

  } catch(e) {

    log(`[エラー] 完了通知メールの送信に失敗しました: ${e.toString()}`);

  }

}



/**

 * ★★★【新規追加】提供票の重い処理を非同期で実行するワーカー関数 ★★★

 */

function processProvisionForm(event) {

  // 現在実行中のトリガーを削除し、再実行を防ぐ

  if (event && event.triggerUid) {

    const allTriggers = ScriptApp.getProjectTriggers();

    for (const trigger of allTriggers) {

      if (trigger.getUniqueId() === event.triggerUid) {

        ScriptApp.deleteTrigger(trigger);

        break;

      }

    }

  }



  // 保存されたcontextを検索して処理対象を決定する

  const properties = PropertiesService.getScriptProperties();

  const allKeys = properties.getKeys();

  const contextKey = allKeys.find(key => key.startsWith('CONTEXT_'));



  if (!contextKey) {

    console.log("処理対象のコンテキストが見つかりませんでした。処理を終了します。");

    return;

  }



  const context = JSON.parse(properties.getProperty(contextKey));

  properties.deleteProperty(contextKey); // 処理後に削除



  const { documentId } = context;

  const logCollector = [];

  const log = (message, details = null) => {

    const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    let logMessage = `[${timestamp}] ${message}`;

    if (details) {

      try {

        logMessage += `\n${JSON.stringify(details, null, 2)}`;

      } catch (err) {

        logMessage += `\n[ログ出力エラー: 詳細情報の文字列化に失敗しました]`;

      }

    }

    console.log(logMessage);

    logCollector.push(logMessage);

  };



  try {

    log(`バックグラウンド処理開始: 提供票 (ID: ${documentId})`);



    // doPostから移動してきた、提供票のビジネスロジック

    const serviceMasterMap = getServiceMasterAsMap(log);

    const extractedFormData = extractFormData(context.ocrText, log);

    const formResult = createNewServiceFormAndDetails(context, extractedFormData, serviceMasterMap, log);



    if (formResult.message.includes("スキップ")) {

      // updateDocumentStatusはcreateNewServiceFormAndDetails内で実行済み

    } else {

      sendCompletionNotificationEmail(context, '提供票', formResult.extractedData, formResult.formId, VIEW_NAME_MAP['提供票'], log);

      updateDocumentStatus(documentId, "登録済", null, log);

    }



    properties.setProperty(documentId, 'completed');

    log(`ステータス更新: ID ${documentId} を 'completed' に設定しました。`);

    sendProcessLogEmail(documentId, context.documentType, "成功", null, logCollector);



  } catch (error) {

    const errorMessage = error.stack || error.toString();

    log(`[!!! バックグラウンドエラー !!!] ID ${documentId}: ${errorMessage}`);

    updateDocumentStatus(documentId, "エラー", error.toString(), log);

    properties.deleteProperty(documentId); // エラー時は再実行を許可

    sendProcessLogEmail(documentId, context.documentType, "失敗", errorMessage, logCollector);

  }

}



/**

 * ★★★【新規追加】スプレッドシートから提供票データを検索する関数 ★★★

 * @param {string} clientId - 検索対象の利用者ID

 * @param {string} applicableMonth - 検索対象の年月 (YYYYMM形式)

 * @param {function} log - ログ出力用の関数

 * @returns {Array} - 条件に一致した行のオブジェクトの配列

 */

function getServiceFormsFromSheet(clientId, applicableMonth, log) {

  log(`スプレッドシートから提供票データを検索します (利用者ID: ${clientId}, 対象月: ${applicableMonth})`);

  try {

    const sheet = SpreadsheetApp.openById(SERVICE_PROVISION_FORM_SS_ID).getSheetByName('Service_Provision_Form');

    const data = sheet.getDataRange().getValues();

    const headers = data.shift(); // ヘッダー行を取得し、データ配列からは削除



    // 列名の完全一致で列番号を動的に検索

    const clientIdIndex = headers.indexOf('client_id');

    const monthIndex = headers.indexOf('applicable_month');



    if (clientIdIndex === -1 || monthIndex === -1) {

      throw new Error("提供票スプレッドシートに見出し'client_id'または'applicable_month'が見つかりません。");

    }



    // 指定されたclientIdとapplicableMonthに一致する行をフィルタリング

    const matchingRows = data.filter(row => 

      row[clientIdIndex] === clientId &&

      String(row[monthIndex]) === String(applicableMonth)

    );



    // フィルタリングされた行を、扱いやすいオブジェクトの配列に変換

    const resultObjects = matchingRows.map(row => {

      const obj = {};

      headers.forEach((header, index) => {

        obj[header] = row[index];

      });

      return obj;

    });

    

    log(`スプレッドシートから ${resultObjects.length} 件の一致データが見つかりました。`);

    return resultObjects;



  } catch (e) {

    log(`[エラー] 提供票スプレッドシートの読み込みに失敗しました: ${e.toString()}`);

    throw new Error(`提供票スプレッドシートの読み込みに失敗しました。IDやシート名、列名が正しいか確認してください。`);

  }

}