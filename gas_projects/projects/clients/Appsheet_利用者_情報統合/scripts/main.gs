/**
 * =====================================================================================
 * Appsheet_利用者_情報統合 - 利用者基本情報＋家族情報の統合処理
 *
 * OCRテキストから利用者基本情報と家族情報を抽出し、AppSheetに登録・更新します。
 *
 * 機能:
 * - 利用者基本情報の更新（Clientsテーブル）
 * - 家族情報の追加・更新（Client_Family_Membersテーブル、重複チェック付き）
 * - 直接実行用関数（個別引数）
 * - JSON形式の戻り値
 *
 * @version 1.0.0
 * @date 2025-10-21
 * =====================================================================================
 */

// ================================================================================================
// 定数定義
// ================================================================================================

const APPSHEET_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';
const APPSHEET_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';

// 利用者テーブルで更新対象外のカラム
const EXCLUDED_CLIENT_COLUMNS = [
  'status', 'date_of_death', 'initial_visit_date', 'contract_office',
  'full_name', 'full_name_kana', 'provider_office', 'insurance_type',
  'is_welfare_recipient', 'mhlw_annex7_disease', 'independence_level',
  'billing_code', 'address_label', 'address_id', 'clinic_id', 'doctor_id',
  'support_office_id', 'care_manager_id', 'service_type', 'main_staff', 'sub_staff'
];

// テーブル名
const CLIENTS_TABLE_NAME = 'Clients';
const FAMILY_TABLE_NAME = 'Client_Family_Members';

// ================================================================================================
// メインエントリーポイント（直接実行用関数）
// ================================================================================================

/**
 * 利用者基本情報のみを更新
 *
 * @param {string} clientId - 利用者ID（例: "CLI-12345678"）
 * @param {string} ocrText - OCRで読み取ったテキスト
 * @returns {Object} JSON形式の処理結果
 *
 * @example
 * const result = updateClientInfo("CLI-12345678", "氏名: 山田太郎\n生年月日: 1950-01-01...");
 * Logger.log(JSON.stringify(result, null, 2));
 */
function updateClientInfo(clientId, ocrText) {
  const timer = new ExecutionTimer();
  let usageMetadata = null;
  let clientName = '';

  try {
    // パラメータ検証
    if (!clientId || typeof clientId !== 'string') {
      throw new Error('clientIdは必須です（文字列）');
    }
    if (!ocrText || typeof ocrText !== 'string') {
      throw new Error('ocrTextは必須です（文字列）');
    }

    Logger.log(`[INFO] 利用者基本情報更新開始: ClientID=${clientId}`);

    // 既存の利用者情報を取得
    const existingClientInfo = getClientInfo(clientId);

    // OCRテキストから情報を抽出（既存情報を提供）
    const result = extractClientInfoWithGemini(ocrText, existingClientInfo);
    const extractedData = result.extractedData;
    usageMetadata = result.usageMetadata;

    if (!extractedData) {
      throw new Error('AI応答から有効なデータを抽出できませんでした');
    }

    // 利用者名を取得（ログ用）
    clientName = `${extractedData.last_name || ''} ${extractedData.first_name || ''}`.trim();

    // 家族情報を除外
    const clientInfo = { ...extractedData };
    delete clientInfo.family_members;

    // 利用者情報を更新
    const clientUpdated = updateClientData(clientId, clientInfo);

    Logger.log('[SUCCESS] 利用者基本情報の更新が完了しました');

    // 成功ログを記録
    logSuccess(clientId, {
      clientName: clientName,
      processType: '利用者基本情報更新',
      updatedCount: clientUpdated ? 1 : 0,
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(4) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(4) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(4) : ''
    });

    return {
      status: 'success',
      clientUpdated: clientUpdated,
      familyMembersAdded: 0,
      familyMembersUpdated: 0,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    Logger.log(`[ERROR] 処理失敗: ${error.message}\n${error.stack}`);

    // エラーにもusageMetadataが存在すればそれを使用
    if (error.usageMetadata) {
      usageMetadata = error.usageMetadata;
    }

    // 失敗ログを記録
    logFailure(clientId, error, {
      clientName: clientName,
      processType: '利用者基本情報更新',
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(4) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(4) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(4) : ''
    });

    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 家族情報のみを更新（重複チェック付き）
 *
 * @param {string} clientId - 利用者ID
 * @param {string} ocrText - OCRで読み取ったテキスト
 * @returns {Object} JSON形式の処理結果
 *
 * @example
 * const result = updateFamilyInfo("CLI-12345678", "家族: 山田花子（妻）\n電話: 090-1234-5678...");
 * Logger.log(JSON.stringify(result, null, 2));
 */
function updateFamilyInfo(clientId, ocrText) {
  const timer = new ExecutionTimer();
  let usageMetadata = null;

  try {
    // パラメータ検証
    if (!clientId || typeof clientId !== 'string') {
      throw new Error('clientIdは必須です（文字列）');
    }
    if (!ocrText || typeof ocrText !== 'string') {
      throw new Error('ocrTextは必須です（文字列）');
    }

    Logger.log(`[INFO] 家族情報更新開始: ClientID=${clientId}`);

    // 既存の家族情報を取得
    const existingFamilyMembers = getFamilyMembers(clientId);

    // OCRテキストから家族情報を抽出（既存情報を提供）
    const result = extractFamilyInfoWithGemini(ocrText, existingFamilyMembers);
    const extractedData = result.extractedData;
    usageMetadata = result.usageMetadata;

    if (!extractedData || !extractedData.family_members || extractedData.family_members.length === 0) {
      Logger.log('[INFO] 抽出対象の家族情報が見つかりませんでした');

      // ログを記録（家族情報なし）
      logSuccess(clientId, {
        processType: '家族情報更新',
        updatedCount: 0,
        processingTime: timer.getElapsedSeconds(),
        modelName: usageMetadata ? usageMetadata.model : '',
        inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
        outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
        inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(4) : '',
        outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(4) : '',
        totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(4) : '',
        notes: '家族情報が見つかりませんでした'
      });

      return {
        status: 'success',
        clientUpdated: false,
        familyMembersAdded: 0,
        familyMembersUpdated: 0,
        message: '家族情報が見つかりませんでした',
        timestamp: new Date().toISOString()
      };
    }

    // 家族情報を処理（Geminiの判断に基づいて追加/更新）
    const { added, updated } = processFamilyMembersWithAction(clientId, extractedData.family_members);

    Logger.log(`[SUCCESS] 家族情報の更新が完了しました（追加: ${added}件、更新: ${updated}件）`);

    // 成功ログを記録
    logSuccess(clientId, {
      processType: '家族情報更新',
      updatedCount: added + updated,
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(4) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(4) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(4) : ''
    });

    return {
      status: 'success',
      clientUpdated: false,
      familyMembersAdded: added,
      familyMembersUpdated: updated,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    Logger.log(`[ERROR] 処理失敗: ${error.message}\n${error.stack}`);

    // エラーにもusageMetadataが存在すればそれを使用
    if (error.usageMetadata) {
      usageMetadata = error.usageMetadata;
    }

    // 失敗ログを記録
    logFailure(clientId, error, {
      processType: '家族情報更新',
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(4) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(4) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(4) : ''
    });

    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 利用者基本情報＋家族情報の両方を更新
 *
 * @param {string} clientId - 利用者ID
 * @param {string} ocrText - OCRで読み取ったテキスト
 * @returns {Object} JSON形式の処理結果
 *
 * @example
 * const result = updateClientAndFamily("CLI-12345678", "【基本情報】\n氏名: 山田太郎...\n【家族情報】\n妻: 山田花子...");
 * Logger.log(JSON.stringify(result, null, 2));
 */
function updateClientAndFamily(clientId, ocrText) {
  const timer = new ExecutionTimer();
  let usageMetadata = null;
  let clientName = '';

  try {
    // パラメータ検証
    if (!clientId || typeof clientId !== 'string') {
      throw new Error('clientIdは必須です（文字列）');
    }
    if (!ocrText || typeof ocrText !== 'string') {
      throw new Error('ocrTextは必須です（文字列）');
    }

    Logger.log(`[INFO] 利用者情報＋家族情報の統合更新開始: ClientID=${clientId}`);

    // 既存の利用者情報と家族情報を取得
    const existingClientInfo = getClientInfo(clientId);
    const existingFamilyMembers = getFamilyMembers(clientId);

    // OCRテキストから情報を抽出（既存情報を提供）
    const result = extractClientAndFamilyInfoWithGemini(ocrText, existingClientInfo, existingFamilyMembers);
    const extractedData = result.extractedData;
    usageMetadata = result.usageMetadata;

    if (!extractedData) {
      throw new Error('AI応答から有効なデータを抽出できませんでした');
    }

    // 利用者名を取得（ログ用）
    clientName = `${extractedData.last_name || ''} ${extractedData.first_name || ''}`.trim();

    // 利用者基本情報を更新
    const clientInfo = { ...extractedData };
    delete clientInfo.family_members;
    const clientUpdated = updateClientData(clientId, clientInfo);

    // 家族情報を処理
    let familyAdded = 0;
    let familyUpdated = 0;

    if (extractedData.family_members && extractedData.family_members.length > 0) {
      const familyResult = processFamilyMembersWithAction(clientId, extractedData.family_members);
      familyAdded = familyResult.added;
      familyUpdated = familyResult.updated;
    }

    Logger.log(`[SUCCESS] 統合更新が完了しました（利用者更新: ${clientUpdated}, 家族追加: ${familyAdded}件, 家族更新: ${familyUpdated}件）`);

    // 成功ログを記録
    logSuccess(clientId, {
      clientName: clientName,
      processType: '利用者＋家族統合更新',
      updatedCount: (clientUpdated ? 1 : 0) + familyAdded + familyUpdated,
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(4) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(4) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(4) : ''
    });

    return {
      status: 'success',
      clientUpdated: clientUpdated,
      familyMembersAdded: familyAdded,
      familyMembersUpdated: familyUpdated,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    Logger.log(`[ERROR] 処理失敗: ${error.message}\n${error.stack}`);

    // エラーにもusageMetadataが存在すればそれを使用
    if (error.usageMetadata) {
      usageMetadata = error.usageMetadata;
    }

    // 失敗ログを記録
    logFailure(clientId, error, {
      clientName: clientName,
      processType: '利用者＋家族統合更新',
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(4) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(4) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(4) : ''
    });

    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ================================================================================================
// テーブル構造取得関数
// ================================================================================================

/**
 * テーブルのカラム名を取得
 *
 * FindアクションでTOP 1件を取得し、レスポンスのキーからカラム名を抽出します
 *
 * @param {string} tableName - テーブル名
 * @returns {Array<string>} カラム名の配列
 */
function getTableColumns(tableName) {
  try {
    const findPayload = {
      Action: "Find",
      Properties: { "Locale": "ja-JP" },
      Selector: `TOP(${tableName}, 1)` // 1件だけ取得
    };

    const responseText = callAppSheetApi(tableName, findPayload);
    const rows = JSON.parse(responseText);

    if (rows && rows.length > 0) {
      const columns = Object.keys(rows[0]);
      Logger.log(`[INFO] ${tableName}テーブルのカラム: ${columns.length}件`);
      return columns;
    } else {
      Logger.log(`[INFO] ${tableName}テーブルにデータがありません`);
      return [];
    }
  } catch (error) {
    Logger.log(`[ERROR] ${tableName}テーブルのカラム取得エラー: ${error.message}`);
    return [];
  }
}

/**
 * 利用者テーブル（Clients）のカラム名を取得
 *
 * @returns {Array<string>} カラム名の配列
 */
function getClientsTableColumns() {
  return getTableColumns(CLIENTS_TABLE_NAME);
}

/**
 * 家族情報テーブル（Client_Family_Members）のカラム名を取得
 *
 * @returns {Array<string>} カラム名の配列
 */
function getFamilyTableColumns() {
  return getTableColumns(FAMILY_TABLE_NAME);
}

/**
 * 両方のテーブルのカラム情報を取得してログ出力
 *
 * @returns {Object} { clients: [...], family: [...] }
 */
function getAllTableColumns() {
  Logger.log('[INFO] ========== テーブル構造取得開始 ==========');

  const clientsColumns = getClientsTableColumns();
  Logger.log('[INFO] Clientsテーブルのカラム:');
  Logger.log(JSON.stringify(clientsColumns, null, 2));

  const familyColumns = getFamilyTableColumns();
  Logger.log('[INFO] Client_Family_Membersテーブルのカラム:');
  Logger.log(JSON.stringify(familyColumns, null, 2));

  Logger.log('[INFO] ========== テーブル構造取得完了 ==========');

  return {
    clients: clientsColumns,
    family: familyColumns
  };
}

// ================================================================================================
// 既存データ取得関数
// ================================================================================================

/**
 * clientIdから既存の利用者情報を取得
 *
 * @param {string} clientId - 利用者ID
 * @returns {Object|null} 利用者情報、存在しない場合はnull
 */
function getClientInfo(clientId) {
  try {
    const findPayload = {
      Action: "Find",
      Properties: { "Locale": "ja-JP" },
      Selector: `FILTER(Clients, [client_id] = "${clientId}")`
    };

    const responseText = callAppSheetApi(CLIENTS_TABLE_NAME, findPayload);
    const clients = JSON.parse(responseText);

    if (clients && clients.length > 0) {
      Logger.log(`[INFO] 既存の利用者情報を取得: ${clientId}`);
      return clients[0];
    } else {
      Logger.log(`[INFO] 利用者情報が見つかりません: ${clientId}`);
      return null;
    }
  } catch (error) {
    Logger.log(`[ERROR] 利用者情報取得エラー: ${error.message}`);
    return null;
  }
}

/**
 * clientIdから既存の家族情報を取得
 *
 * @param {string} clientId - 利用者ID
 * @returns {Array} 家族情報の配列（存在しない場合は空配列）
 */
function getFamilyMembers(clientId) {
  try {
    const findPayload = {
      Action: "Find",
      Properties: { "Locale": "ja-JP" },
      Selector: `FILTER(Client_Family_Members, [client_id] = "${clientId}")`
    };

    const responseText = callAppSheetApi(FAMILY_TABLE_NAME, findPayload);
    const familyMembers = JSON.parse(responseText);

    Logger.log(`[INFO] 既存の家族情報を取得: ${familyMembers.length}件`);
    return familyMembers || [];
  } catch (error) {
    Logger.log(`[ERROR] 家族情報取得エラー: ${error.message}`);
    return [];
  }
}

// ================================================================================================
// AI情報抽出関数
// ================================================================================================

/**
 * OCRテキストから利用者基本情報を抽出（Gemini使用）
 *
 * @param {string} ocrText - OCRテキスト
 * @param {Object|null} existingClientInfo - 既存の利用者情報
 * @returns {Object} 更新すべき情報
 */
function extractClientInfoWithGemini(ocrText, existingClientInfo) {
  const existingDataText = existingClientInfo
    ? `\n【既存の利用者情報】\n${JSON.stringify(existingClientInfo, null, 2)}\n\n既存情報とOCRテキストを比較して、更新が必要なフィールドのみを抽出してください。\nOCRテキストに新しい情報がある場合は優先的に採用し、既存情報が空で新しい情報がある場合も含めてください。\n既存情報と同じ内容の場合はnullを設定してください。`
    : '\n既存の利用者情報はありません。すべての情報を抽出してください。';

  const prompt = `
あなたは医療・介護サービスの事務スタッフです。以下のOCRテキストから、利用者様の基本情報を抽出してください。
結果は必ず指定されたキーを持つJSON形式のみで出力してください。余計な説明やマーカーは不要です。
${existingDataText}

氏名のフリガナ（last_name_kana, first_name_kana）は、必ず**カタカナ**で出力してください。
情報が見つからない項目、または既存情報と同じ項目の値は null にしてください。
日付は必ず "YYYY-MM-DD" 形式にしてください。
**今日（${new Date().toLocaleDateString('ja-JP')}）の時点での満年齢を計算して "age" に含めてください。**

【抽出対象のキー】
{
  "end_of_visit_date": "（訪問終了日）",
  "care_level_name": "（要介護度・要支援度 例:要介護１ 数字は全角数字）",
  "last_name": "（利用者の姓）",
  "first_name": "（利用者の名）",
  "last_name_kana": "（利用者の姓のカタカナ）",
  "first_name_kana": "（利用者の名のカタカナ）",
  "gender": "（性別 男性か女性）",
  "birth_date": "（生年月日、西暦）",
  "birth_date_nengo": "（生年月日の元号 例:昭和）",
  "birth_date_nengo_year": "（生年月日の元号の年 例:45）",
  "age": "（今日時点の満年齢 例:80）",
  "phone1": "（主な電話番号）",
  "phone1_destination": "（電話番号1の宛先 例:自宅,携帯）",
  "phone2": "（その他の電話番号）",
  "phone2_destination": "（電話番号2の宛先 例:キーパーソン）",
  "email": "（連絡用メールアドレス）",
  "primary_contact_person": "（主要連絡者の氏名）",
  "special_notes": "（特記事項やアレルギーなど、ケアで最優先で確認すべき重要事項）"
}

【OCRテキスト】
${ocrText}
`;

  const result = callGeminiAPI(prompt);
  return result; // { extractedData, usageMetadata }を返す
}

/**
 * OCRテキストから家族情報のみを抽出（Gemini使用）
 *
 * @param {string} ocrText - OCRテキスト
 * @param {Array} existingFamilyMembers - 既存の家族情報配列
 * @returns {Object} 追加・更新すべき家族情報
 */
function extractFamilyInfoWithGemini(ocrText, existingFamilyMembers) {
  const existingDataText = existingFamilyMembers && existingFamilyMembers.length > 0
    ? `\n【既存の家族情報】\n${JSON.stringify(existingFamilyMembers, null, 2)}\n\n既存の家族情報とOCRテキストを比較してください。\n- 名前が一致する（表記揺れや漢字・カナの違いも考慮）家族は、空欄フィールドのみ補完する形で更新してください。\n- 既存にない新しい家族は追加してください。\n- 各家族について、"action"フィールドを追加し、"add"（新規追加）または"update"（既存更新）を指定してください。\n- 更新の場合は、既存の"family_member_id"を含めてください。`
    : '\n既存の家族情報はありません。すべての家族を新規追加として抽出してください。';

  const prompt = `
あなたは医療・介護サービスの事務スタッフです。以下のOCRテキストから、ご家族の情報のみを抽出してください。
利用者本人の情報は含めないでください。結果は必ず指定されたキーを持つJSON形式のみで出力してください。
フリガナはカタカナで出力してください。家族情報が見つからない場合は、"family_members"には空の配列 [] を設定してください。
${existingDataText}

【抽出対象のキー】
{
  "family_members": [
    {
      "action": "（add または update）",
      "family_member_id": "（updateの場合のみ、既存のID）",
      "relationship": "（続柄 例:妻,長男）",
      "last_name": "（家族の姓）",
      "first_name": "（家族の名）",
      "last_name_kana": "（姓カナ）",
      "first_name_kana": "（名カナ）",
      "is_cohabiting": "（同居の有無を「同居」または「別居」で回答）",
      "living_area": "（在住エリア）",
      "phone1": "（電話番号1）",
      "phone2": "（電話番号2）",
      "email": "（メールアドレス）",
      "preferred_contact_method": "（希望連絡手段）",
      "available_contact_time": "（連絡可能時間帯）",
      "wants_email_updates": "（メール配信希望 Y/N）",
      "emergency_contact_priority": "（緊急連絡優先順位）",
      "is_key_person": "（キーパーソンか Y/N）",
      "relationship_details": "（関係性詳細）",
      "has_caution_notes": "（注意点有無 Y/N）",
      "caution_notes": "（注意点詳細）"
    }
  ]
}

【OCRテキスト】
${ocrText}
`;

  const result = callGeminiAPI(prompt);
  return result; // { extractedData, usageMetadata }を返す
}

/**
 * OCRテキストから利用者基本情報＋家族情報を統合抽出（Gemini使用）
 *
 * @param {string} ocrText - OCRテキスト
 * @param {Object|null} existingClientInfo - 既存の利用者情報
 * @param {Array} existingFamilyMembers - 既存の家族情報配列
 * @returns {Object} 更新すべき利用者情報と家族情報
 */
function extractClientAndFamilyInfoWithGemini(ocrText, existingClientInfo, existingFamilyMembers) {
  const existingClientText = existingClientInfo
    ? `\n【既存の利用者情報】\n${JSON.stringify(existingClientInfo, null, 2)}`
    : '\n既存の利用者情報はありません。';

  const existingFamilyText = existingFamilyMembers && existingFamilyMembers.length > 0
    ? `\n【既存の家族情報】\n${JSON.stringify(existingFamilyMembers, null, 2)}`
    : '\n既存の家族情報はありません。';

  const prompt = `
あなたは医療・介護サービスの事務スタッフです。以下のOCRテキストから、利用者様の情報と、そのご家族の情報を抽出してください。

結果は必ず指定されたキーを持つJSON形式のみで出力してください。余計な説明やマーカーは不要です。
${existingClientText}
${existingFamilyText}

【利用者情報について】
- 既存情報とOCRテキストを比較して、更新が必要なフィールドのみを抽出してください。
- OCRテキストに新しい情報がある場合は優先的に採用してください。
- 既存情報と同じ内容の場合はnullを設定してください。

【家族情報について】
- 既存の家族情報とOCRテキストを比較してください。
- 名前が一致する（表記揺れや漢字・カナの違いも考慮）家族は、空欄フィールドのみ補完する形で更新してください。
- 既存にない新しい家族は追加してください。
- 各家族について、"action"フィールドを追加し、"add"（新規追加）または"update"（既存更新）を指定してください。
- 更新の場合は、既存の"family_member_id"を含めてください。

氏名のフリガナ（last_name_kana, first_name_kana）は、必ず**カタカナ**で出力してください。
情報が見つからない項目の値は null にしてください。日付は必ず "YYYY-MM-DD" 形式にしてください。
**今日（${new Date().toLocaleDateString('ja-JP')}）の時点での満年齢を計算して "age" に含めてください。**
家族情報が見つからない場合は、"family_members"には空の配列 [] を設定してください。

【抽出対象のキー】
{
  "end_of_visit_date": "（訪問終了日）",
  "care_level_name": "（要介護度・要支援度 例:要介護１ 数字は全角数字）",
  "last_name": "（利用者の姓）",
  "first_name": "（利用者の名）",
  "last_name_kana": "（利用者の姓のカタカナ）",
  "first_name_kana": "（利用者の名のカタカナ）",
  "gender": "（性別 男性か女性）",
  "birth_date": "（生年月日、西暦）",
  "birth_date_nengo": "（生年月日の元号 例:昭和）",
  "birth_date_nengo_year": "（生年月日の元号の年 例:45）",
  "age": "（今日時点の満年齢 例:80）",
  "phone1": "（主な電話番号）",
  "phone1_destination": "（電話番号1の宛先 例:自宅,携帯）",
  "phone2": "（その他の電話番号）",
  "phone2_destination": "（電話番号2の宛先 例:キーパーソン）",
  "email": "（連絡用メールアドレス）",
  "primary_contact_person": "（主要連絡者の氏名）",
  "special_notes": "（特記事項やアレルギーなど、ケアで最優先で確認すべき重要事項）",
  "family_members": [
    {
      "action": "（add または update）",
      "family_member_id": "（updateの場合のみ、既存のID）",
      "relationship": "（続柄 例:妻,長男）",
      "last_name": "（家族の姓）",
      "first_name": "（家族の名）",
      "is_cohabiting": "（同居の有無を「同居」または「別居」で回答）",
      "phone1": "（家族の電話番号）",
      "is_key_person": "（キーパーソンか Y/N）"
    }
  ]
}

【OCRテキスト】
${ocrText}
`;

  const result = callGeminiAPI(prompt);
  return result; // { extractedData, usageMetadata }を返す
}

/**
 * Gemini API呼び出し（Vertex AI経由）
 * @return {Object} { extractedData: 抽出データ, usageMetadata: コスト情報 }
 */
function callGeminiAPI(prompt) {
  const GCP_PROJECT_ID = PropertiesService.getScriptProperties().getProperty('GCP_PROJECT_ID') || 'macro-shadow-458705-v8';
  const GCP_LOCATION = PropertiesService.getScriptProperties().getProperty('GCP_LOCATION') || 'us-central1';
  const MODEL = PropertiesService.getScriptProperties().getProperty('VERTEX_AI_MODEL') || 'gemini-2.5-flash';

  const url = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${MODEL}:generateContent`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 8192
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${ScriptApp.getOAuthToken()}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    throw new Error(`Vertex AI APIエラー (${responseCode}): ${responseText}`);
  }

  const jsonResponse = JSON.parse(responseText);

  // usageMetadataを先に抽出（エラー時でもコストを記録するため）
  const usageMetadata = extractUsageMetadataFromResponse(jsonResponse, MODEL);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    const error = new Error("AI応答に有効な候補が含まれていません: " + responseText);
    error.usageMetadata = usageMetadata;
    throw error;
  }

  let content = jsonResponse.candidates[0].content.parts[0].text;

  // JSON抽出（マーカー除去）
  const startIndex = content.indexOf('{');
  const endIndex = content.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1) {
    const error = new Error("AI応答からJSONを抽出できませんでした");
    error.usageMetadata = usageMetadata;
    throw error;
  }

  const extractedData = JSON.parse(content.substring(startIndex, endIndex + 1));

  if (usageMetadata) {
    Logger.log(`[Vertex AI] 使用量: Input ${usageMetadata.inputTokens} tokens, Output ${usageMetadata.outputTokens} tokens, 合計 ¥${usageMetadata.totalCostJPY.toFixed(2)}`);
  }

  return {
    extractedData: extractedData,
    usageMetadata: usageMetadata
  };
}

/**
 * Vertex AIレスポンスからusageMetadataを抽出してコスト計算
 * @private
 */
function extractUsageMetadataFromResponse(jsonResponse, modelName) {
  if (!jsonResponse.usageMetadata) {
    return null;
  }

  const usage = jsonResponse.usageMetadata;
  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = usage.candidatesTokenCount || 0;

  // 価格情報（2025年1月時点のVertex AI価格、USD/100万トークン）
  const pricingTable = {
    'gemini-2.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
    'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10.00 },
    'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
    'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.00 }
  };

  // モデル名を正規化（バージョン番号削除）
  const normalizedModelName = modelName.match(/(gemini-[\d.]+-(?:flash|pro))/i)?.[1].toLowerCase() || 'gemini-2.5-flash';
  const pricing = pricingTable[normalizedModelName] || pricingTable['gemini-2.5-flash'];

  const inputCostUSD = (inputTokens / 1000000) * pricing.inputPer1M;
  const outputCostUSD = (outputTokens / 1000000) * pricing.outputPer1M;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  // 日本円に換算（為替レート150円）
  const EXCHANGE_RATE = 150;
  const inputCostJPY = inputCostUSD * EXCHANGE_RATE;
  const outputCostJPY = outputCostUSD * EXCHANGE_RATE;
  const totalCostJPY = totalCostUSD * EXCHANGE_RATE;

  return {
    model: modelName,
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    inputCostJPY: inputCostJPY,
    outputCostJPY: outputCostJPY,
    totalCostJPY: totalCostJPY
  };
}

// ================================================================================================
// データ処理関数
// ================================================================================================

/**
 * 利用者基本情報をClientsテーブルに更新
 *
 * @param {string} clientId - 利用者ID
 * @param {Object} clientInfo - 抽出した利用者情報
 * @returns {boolean} 更新が実行されたかどうか
 */
function updateClientData(clientId, clientInfo) {
  // 要介護度の数字を全角に変換
  if (clientInfo.care_level_name) {
    clientInfo.care_level_name = clientInfo.care_level_name.replace(/[0-9]/g, s =>
      String.fromCharCode(s.charCodeAt(0) + 0xFEE0)
    );
  }

  // 除外カラムを削除
  EXCLUDED_CLIENT_COLUMNS.forEach(key => delete clientInfo[key]);

  // client_idを追加
  clientInfo.client_id = clientId;

  // null値を削除
  Object.keys(clientInfo).forEach(key => {
    if (clientInfo[key] == null) {
      delete clientInfo[key];
    }
  });

  // client_id以外に更新するデータがあるか確認
  if (Object.keys(clientInfo).length > 1) {
    const payload = {
      Action: 'Edit',
      Properties: { "Locale": "ja-JP" },
      Rows: [clientInfo]
    };

    callAppSheetApi(CLIENTS_TABLE_NAME, payload);
    Logger.log('[INFO] Clientsテーブルの更新に成功');
    return true;
  } else {
    Logger.log('[INFO] Clientsテーブルで更新すべきデータがありませんでした');
    return false;
  }
}

/**
 * 家族情報を処理（重複チェック＋追加/更新）
 * ※後方互換性のために残しています
 *
 * @param {string} clientId - 利用者ID
 * @param {Array} extractedMembers - 抽出した家族情報の配列
 * @returns {Object} { added: 追加件数, updated: 更新件数 }
 */
function processFamilyMembers(clientId, extractedMembers) {
  // 既存の家族情報を取得
  const findPayload = {
    Action: "Find",
    Properties: { "Locale": "ja-JP" },
    Selector: `FILTER(Client_Family_Members, [client_id] = "${clientId}")`
  };

  const existingMembersText = callAppSheetApi(FAMILY_TABLE_NAME, findPayload);
  const existingMembers = JSON.parse(existingMembersText);

  const rowsToAdd = [];
  const rowsToUpdate = [];

  // 各抽出データについて、既存データとマッチングして追加/更新を判定
  for (const extractedMember of extractedMembers) {
    // 姓・名が一致する既存レコードを検索
    const existingMember = existingMembers.find(em =>
      em.last_name === extractedMember.last_name &&
      em.first_name === extractedMember.first_name
    );

    if (existingMember) {
      // 既存レコードあり → 空欄のみ補完
      const updatePayload = { "family_member_id": existingMember.family_member_id };
      let needsUpdate = false;

      for (const key in extractedMember) {
        // 既存が空で、抽出データに値があれば補完
        if (!existingMember[key] && extractedMember[key]) {
          updatePayload[key] = extractedMember[key];
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        rowsToUpdate.push(updatePayload);
      }
    } else {
      // 既存レコードなし → 新規追加
      extractedMember.family_member_id = `CLFM-${Utilities.getUuid().substring(0, 8)}`;
      extractedMember.client_id = clientId;
      rowsToAdd.push(extractedMember);
    }
  }

  // 追加処理
  if (rowsToAdd.length > 0) {
    Logger.log(`[INFO] ${rowsToAdd.length}件の新しい家族情報を追加します`);
    const addPayload = {
      Action: 'Add',
      Properties: { "Locale": "ja-JP" },
      Rows: rowsToAdd
    };
    callAppSheetApi(FAMILY_TABLE_NAME, addPayload);
  }

  // 更新処理
  if (rowsToUpdate.length > 0) {
    Logger.log(`[INFO] ${rowsToUpdate.length}件の既存家族情報を補完します`);
    const updatePayload = {
      Action: 'Edit',
      Properties: { "Locale": "ja-JP" },
      Rows: rowsToUpdate
    };
    callAppSheetApi(FAMILY_TABLE_NAME, updatePayload);
  }

  return {
    added: rowsToAdd.length,
    updated: rowsToUpdate.length
  };
}

/**
 * 家族情報を処理（Geminiのactionフィールドに基づいて追加/更新）
 *
 * @param {string} clientId - 利用者ID
 * @param {Array} extractedMembers - Geminiが判断した家族情報の配列（actionフィールド含む）
 * @returns {Object} { added: 追加件数, updated: 更新件数 }
 */
function processFamilyMembersWithAction(clientId, extractedMembers) {
  const rowsToAdd = [];
  const rowsToUpdate = [];

  for (const member of extractedMembers) {
    const action = member.action;
    delete member.action; // actionフィールドは削除

    if (action === 'add') {
      // 新規追加
      member.family_member_id = `CLFM-${Utilities.getUuid().substring(0, 8)}`;
      member.client_id = clientId;

      // null値を削除
      Object.keys(member).forEach(key => {
        if (member[key] == null) {
          delete member[key];
        }
      });

      rowsToAdd.push(member);

    } else if (action === 'update') {
      // 既存レコード更新
      if (!member.family_member_id) {
        Logger.log(`[WARNING] 更新対象の家族にfamily_member_idがありません: ${JSON.stringify(member)}`);
        continue;
      }

      // null値を削除（空欄補完のみ）
      Object.keys(member).forEach(key => {
        if (member[key] == null) {
          delete member[key];
        }
      });

      // family_member_id以外に更新データがあるか確認
      if (Object.keys(member).length > 1) {
        rowsToUpdate.push(member);
      }
    } else {
      Logger.log(`[WARNING] 不明なactionです: ${action}、スキップします`);
    }
  }

  // 追加処理
  if (rowsToAdd.length > 0) {
    Logger.log(`[INFO] ${rowsToAdd.length}件の新しい家族情報を追加します`);
    const addPayload = {
      Action: 'Add',
      Properties: { "Locale": "ja-JP" },
      Rows: rowsToAdd
    };
    callAppSheetApi(FAMILY_TABLE_NAME, addPayload);
  }

  // 更新処理
  if (rowsToUpdate.length > 0) {
    Logger.log(`[INFO] ${rowsToUpdate.length}件の既存家族情報を補完します`);
    const updatePayload = {
      Action: 'Edit',
      Properties: { "Locale": "ja-JP" },
      Rows: rowsToUpdate
    };
    callAppSheetApi(FAMILY_TABLE_NAME, updatePayload);
  }

  return {
    added: rowsToAdd.length,
    updated: rowsToUpdate.length
  };
}

// ================================================================================================
// AppSheet API呼び出し
// ================================================================================================

/**
 * AppSheet API呼び出し
 *
 * @param {string} tableName - テーブル名
 * @param {Object} payload - APIペイロード
 * @returns {string} レスポンスボディ
 */
function callAppSheetApi(tableName, payload) {
  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APPSHEET_APP_ID}/tables/${tableName}/Action`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'ApplicationAccessKey': APPSHEET_ACCESS_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode >= 400) {
    throw new Error(`AppSheet API (${tableName}) エラー (${responseCode}): ${responseBody}`);
  }

  return responseBody;
}

// ================================================================================================
// テスト関数
// ================================================================================================

/**
 * テスト: 利用者基本情報のみ更新
 */
function testUpdateClientInfo() {
  // ⚠️ 以下の値を実際の環境に合わせて変更してください
  const clientId = "CLI-xxxxxxxx";  // 実際の利用者ID
  const ocrText = `
    氏名: 山田太郎（ヤマダタロウ）
    生年月日: 1950年1月1日（昭和25年）
    性別: 男性
    電話番号: 03-1234-5678（自宅）
    携帯電話: 090-1234-5678
  `;

  Logger.log('[TEST] 利用者基本情報更新テスト開始');
  const result = updateClientInfo(clientId, ocrText);
  Logger.log('[TEST] 結果:');
  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

/**
 * テスト: 家族情報のみ更新
 */
function testUpdateFamilyInfo() {
  // ⚠️ 以下の値を実際の環境に合わせて変更してください
  const clientId = "CLI-xxxxxxxx";  // 実際の利用者ID
  const ocrText = `
    家族情報:
    - 妻: 山田花子（ヤマダハナコ）
      電話: 090-9876-5432
      同居: 同居
      キーパーソン: Y

    - 長男: 山田一郎（ヤマダイチロウ）
      電話: 080-1111-2222
      同居: 別居
  `;

  Logger.log('[TEST] 家族情報更新テスト開始');
  const result = updateFamilyInfo(clientId, ocrText);
  Logger.log('[TEST] 結果:');
  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

/**
 * テスト: 利用者＋家族情報の統合更新
 */
function testUpdateClientAndFamily() {
  // ⚠️ 以下の値を実際の環境に合わせて変更してください
  const clientId = "CLI-xxxxxxxx";  // 実際の利用者ID
  const ocrText = `
    【基本情報】
    氏名: 山田太郎（ヤマダタロウ）
    生年月日: 1950年1月1日（昭和25年）
    性別: 男性
    電話番号: 03-1234-5678（自宅）
    要介護度: 要介護3

    【家族情報】
    - 妻: 山田花子（ヤマダハナコ）
      電話: 090-9876-5432
      同居: 同居
      キーパーソン: Y
  `;

  Logger.log('[TEST] 統合更新テスト開始');
  const result = updateClientAndFamily(clientId, ocrText);
  Logger.log('[TEST] 結果:');
  Logger.log(JSON.stringify(result, null, 2));

  return result;
}
