/**
 * テスト関数モジュール
 * 書類OCR処理の各書類タイプをテストするための関数群
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-20
 */

// ============================================
// 🚨 初回セットアップ関数（最初に1回だけ実行）
// ============================================

/**
 * 書類OCRプロジェクトのScript Propertiesを初期化
 *
 * ⚠️ 重要: テスト実行前に必ずこの関数を1回実行してください
 *
 * この関数を実行すると以下が設定されます:
 * - GCP設定（プロジェクトID、モデル、温度など）
 * - 重複回避機能（有効）
 * - ログレベル、タイムゾーン
 *
 * 実行方法:
 * 1. この関数を選択
 * 2. 「実行」ボタンをクリック
 * 3. 実行ログで設定内容を確認
 */
function setupScriptPropertiesForDocumentOCR() {
  Logger.log('='.repeat(60));
  Logger.log('書類OCR - Script Properties 初期化');
  Logger.log('='.repeat(60));

  initializeScriptPropertiesForProject({
    // GCP設定（必須）
    GCP_PROJECT_ID: 'macro-shadow-458705-v8',
    GCP_LOCATION: 'us-central1',

    // Primary Model (1回目 - デフォルト実行)
    VERTEX_AI_MODEL: 'gemini-2.5-flash',
    VERTEX_AI_MAX_OUTPUT_TOKENS: '8192',  // Flashの推奨上限
    VERTEX_AI_TEMPERATURE: '0.1',

    // Fallback Model (2回目 - MAX_TOKENS超過時の自動リトライ)
    VERTEX_AI_FALLBACK_MODEL: 'gemini-2.5-pro',
    VERTEX_AI_FALLBACK_MAX_OUTPUT_TOKENS: '20000',

    USE_VERTEX_AI: 'true',

    // 機能ON/OFF
    ENABLE_DUPLICATION_PREVENTION: 'true',  // 重複回避機能
    ENABLE_FULL_TEXT_OUTPUT: 'false',       // 書類全文出力（デフォルト: OFF）

    // その他の設定
    LOG_LEVEL: 'INFO',
    TIMEZONE: 'Asia/Tokyo'
  });

  Logger.log('\n✅ 初期化完了！');
  Logger.log('\n次のステップ:');
  Logger.log('1. checkScriptPropertiesSetup() を実行して設定を確認');
  Logger.log('2. testMedicalInsurance() などのテスト関数を実行');
}

/**
 * Script Properties の設定状態を確認
 *
 * セットアップが正しく行われたかを確認するための関数
 */
function checkScriptPropertiesSetup() {
  Logger.log('='.repeat(60));
  Logger.log('Script Properties 設定確認');
  Logger.log('='.repeat(60));

  // 必須プロパティのチェック
  const requiredKeys = [
    'GCP_PROJECT_ID',
    'GCP_LOCATION',
    'VERTEX_AI_MODEL',
    'VERTEX_AI_MAX_OUTPUT_TOKENS',
    'VERTEX_AI_TEMPERATURE',
    'VERTEX_AI_FALLBACK_MODEL',
    'VERTEX_AI_FALLBACK_MAX_OUTPUT_TOKENS',
    'USE_VERTEX_AI',
    'ENABLE_DUPLICATION_PREVENTION'
  ];

  Logger.log('\n【必須プロパティのチェック】');
  let allSet = true;

  requiredKeys.forEach(key => {
    const value = getScriptProperty(key);
    const isSet = value && value !== '';
    Logger.log(`${isSet ? '✅' : '❌'} ${key}: ${isSet ? value : '未設定'}`);
    if (!isSet) allSet = false;
  });

  // GCP設定の詳細確認
  Logger.log('\n【GCP設定の詳細】');
  try {
    const config = getGCPConfig();
    Logger.log(`Project ID: ${config.projectId || '❌ 未設定'}`);
    Logger.log(`Location: ${config.location}`);
    Logger.log(`Use Vertex AI: ${config.useVertexAI}`);
    Logger.log(`Temperature: ${config.temperature}`);

    Logger.log('\n【Primary Model (1回目)】');
    Logger.log(`Model: ${config.model || '❌ 未設定'}`);
    Logger.log(`Max Output Tokens: ${config.maxOutputTokens}`);

    Logger.log('\n【Fallback Model (MAX_TOKENS超過時の2回目)】');
    Logger.log(`Model: ${config.fallbackModel || '❌ 未設定'}`);
    Logger.log(`Max Output Tokens: ${config.fallbackMaxOutputTokens}`);
  } catch (error) {
    Logger.log(`❌ GCP設定の取得エラー: ${error.message}`);
    allSet = false;
  }

  // 結果サマリー
  Logger.log('\n' + '='.repeat(60));
  if (allSet) {
    Logger.log('✅ 全ての設定が完了しています！');
    Logger.log('テスト関数を実行できます。');
  } else {
    Logger.log('❌ 設定が不完全です。');
    Logger.log('setupScriptPropertiesForDocumentOCR() を実行してください。');
  }
  Logger.log('='.repeat(60));

  return allSet;
}

// ============================================
// 📝 書類タイプ別テスト関数
// ============================================

/**
 * テスト結果をログ出力用に整形（全文テキストを省略）
 * @param {Object} result - processRequest()の結果
 * @return {Object} ログ出力用の結果オブジェクト
 */
function formatTestResultForLogging(result) {
  if (!result) {
    return result;
  }

  const logResult = Object.assign({}, result);

  // OCR全文テキストを省略版に変換
  if (logResult.ocr_text) {
    logResult.ocr_text_preview = truncateOcrText(logResult.ocr_text, 100, 100);
    logResult.ocr_text_length = logResult.ocr_text.length;
    delete logResult.ocr_text; // 全文は削除してプレビューのみ表示
  }

  return logResult;
}

/**
 * テスト用関数: 医療保険証のOCR処理
 * GASエディタから直接実行してテスト可能
 *
 * 【重要】実行前に以下を確認してください:
 * 1. Google Driveの基準フォルダー配下にテスト用PDFをアップロード
 * 2. 下記の TEST_FILE_PATH を実際のファイルパスに置き換え
 *
 * 【指定方法】以下のいずれかの形式で指定可能:
 * 1. ファイル名のみ: "医療保険証サンプル.pdf"
 * 2. フォルダパス: "テスト書類/医療保険証サンプル.pdf"
 * 3. Drive URL: "https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i/view"
 * 4. ファイルID: "1a2b3c4d5e6f7g8h9i"
 *
 * @return {Object} 処理結果
 */
function testMedicalInsurance() {
  // ⚠️ 以下のファイルパス/名を実際のものに置き換えてください
  const TEST_FILE_PATH = '医療保険証サンプル.pdf';

  if (!TEST_FILE_PATH || TEST_FILE_PATH === '医療保険証サンプル.pdf') {
    throw new Error('❌ エラー: テスト用ファイルが設定されていません。\n\n' +
      '【手順】\n' +
      '1. Google Driveにテスト用PDFをアップロード（基準フォルダー配下）\n' +
      '2. ファイル名またはパスを確認\n' +
      '3. この関数の TEST_FILE_PATH 変数を設定\n\n' +
      '【例】\n' +
      '  const TEST_FILE_PATH = "保険証_山田太郎.pdf";  // ファイル名のみ\n' +
      '  const TEST_FILE_PATH = "テスト書類/保険証_山田太郎.pdf";  // フォルダパス\n' +
      '  const TEST_FILE_PATH = "https://drive.google.com/file/d/.../view";  // URL');
  }

  // ファイルパスからファイルIDを取得
  let fileId;
  try {
    fileId = getFileIdFromPath(TEST_FILE_PATH);
    Logger.log(`[テスト] ファイル検索成功: ${TEST_FILE_PATH} → ${fileId}`);
  } catch (error) {
    throw new Error(`❌ ファイルが見つかりません: ${TEST_FILE_PATH}\n\n` +
      `エラー詳細: ${error.message}\n\n` +
      '【確認事項】\n' +
      '1. ファイル名が正しいか\n' +
      '2. 基準フォルダー配下に配置されているか\n' +
      `3. 基準フォルダーID: ${DRIVE_CONFIG.baseFolderId}`);
  }

  const testParams = {
    config: {
      tableName: 'Client_Documents',
      keyColumn: 'document_id',
      titleColumn: 'title',
      summaryColumn: 'summary',
      ocrColumn: 'ocr_text',
      statusColumn: 'status'
    },
    data: {
      keyValue: 'TEST_MEDICAL_' + new Date().getTime(),
      fileId: fileId,
      document_type: '医療保険証',
      client_id: 'TEST_CLIENT_001',
      staff_id: 'test@fractal-group.co.jp',
      client_name: 'テスト利用者',
      staff_name: 'テスト担当者',
      client_birth_date: '1950/01/01'
    }
  };

  Logger.log('[テスト:医療保険証] パラメータ:', JSON.stringify(testParams, null, 2));

  const result = processRequest(testParams);

  // ログ出力用に全文テキストを省略
  Logger.log('[テスト:医療保険証] 結果:', JSON.stringify(formatTestResultForLogging(result), null, 2));

  return result;
}

/**
 * テスト用関数: 介護保険証のOCR処理
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 処理結果
 */
function testLTCIInsurance() {
  const TEST_FILE_PATH = '介護保険証サンプル.pdf';  // ← 実際のファイル名/パスに置き換え

  if (!TEST_FILE_PATH || TEST_FILE_PATH === '介護保険証サンプル.pdf') {
    throw new Error('❌ ファイルパスが未設定です。testMedicalInsurance() の手順を参照してください。');
  }

  const fileId = getFileIdFromPath(TEST_FILE_PATH);

  const testParams = {
    config: {
      tableName: 'Client_Documents',
      keyColumn: 'document_id',
      titleColumn: 'title',
      summaryColumn: 'summary',
      ocrColumn: 'ocr_text',
      statusColumn: 'status'
    },
    data: {
      keyValue: 'TEST_LTCI_' + new Date().getTime(),
      fileId: fileId,
      document_type: '介護保険証',
      client_id: 'TEST_CLIENT_001',
      staff_id: 'test@fractal-group.co.jp',
      client_name: 'テスト利用者',
      staff_name: 'テスト担当者'
    }
  };

  Logger.log('[テスト:介護保険証] パラメータ:', JSON.stringify(testParams, null, 2));

  const result = processRequest(testParams);

  Logger.log('[テスト:介護保険証] 結果:', JSON.stringify(result, null, 2));

  return result;
}

/**
 * テスト用関数: 公費受給者証のOCR処理
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 処理結果
 */
function testPublicSubsidy() {
  const TEST_FILE_PATH = '公費受給者証サンプル.pdf';  // ← 実際のファイル名/パスに置き換え

  if (!TEST_FILE_PATH || TEST_FILE_PATH === '公費受給者証サンプル.pdf') {
    throw new Error('❌ ファイルパスが未設定です。testMedicalInsurance() の手順を参照してください。');
  }

  const fileId = getFileIdFromPath(TEST_FILE_PATH);

  const testParams = {
    config: {
      tableName: 'Client_Documents',
      keyColumn: 'document_id',
      titleColumn: 'title',
      summaryColumn: 'summary',
      ocrColumn: 'ocr_text',
      statusColumn: 'status'
    },
    data: {
      keyValue: 'TEST_PUBLIC_' + new Date().getTime(),
      fileId: fileId,
      document_type: '公費',
      client_id: 'TEST_CLIENT_001',
      staff_id: 'test@fractal-group.co.jp',
      client_name: 'テスト利用者',
      staff_name: 'テスト担当者',
      client_birth_date: '1950/01/01'
    }
  };

  Logger.log('[テスト:公費] パラメータ:', JSON.stringify(testParams, null, 2));

  const result = processRequest(testParams);

  Logger.log('[テスト:公費] 結果:', JSON.stringify(result, null, 2));

  return result;
}

/**
 * テスト用関数: 口座情報のOCR処理
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 処理結果
 */
function testBankAccount() {
  const TEST_FILE_PATH = '口座情報サンプル.pdf';  // ← 実際のファイル名/パスに置き換え

  if (!TEST_FILE_PATH || TEST_FILE_PATH === '口座情報サンプル.pdf') {
    throw new Error('❌ ファイルパスが未設定です。testMedicalInsurance() の手順を参照してください。');
  }

  const fileId = getFileIdFromPath(TEST_FILE_PATH);

  const testParams = {
    config: {
      tableName: 'Client_Documents',
      keyColumn: 'document_id',
      titleColumn: 'title',
      summaryColumn: 'summary',
      ocrColumn: 'ocr_text',
      statusColumn: 'status'
    },
    data: {
      keyValue: 'TEST_BANK_' + new Date().getTime(),
      fileId: TEST_FILE_ID,
      document_type: '口座情報',
      client_id: 'TEST_CLIENT_001',
      staff_id: 'test@fractal-group.co.jp',
      client_name: 'テスト利用者',
      staff_name: 'テスト担当者'
    }
  };

  Logger.log('[テスト:口座情報] パラメータ:', JSON.stringify(testParams, null, 2));

  const result = processRequest(testParams);

  Logger.log('[テスト:口座情報] 結果:', JSON.stringify(result, null, 2));

  return result;
}

/**
 * テスト用関数: 指示書のOCR処理
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 処理結果
 */
function testInstruction() {
  const TEST_FILE_PATH = '指示書サンプル.pdf';  // ← 実際のファイル名/パスに置き換え

  if (!TEST_FILE_PATH || TEST_FILE_PATH === '指示書サンプル.pdf') {
    throw new Error('❌ ファイルパスが未設定です。testMedicalInsurance() の手順を参照してください。');
  }

  const fileId = getFileIdFromPath(TEST_FILE_PATH);

  const testParams = {
    config: {
      tableName: 'Client_Documents',
      keyColumn: 'document_id',
      titleColumn: 'title',
      summaryColumn: 'summary',
      ocrColumn: 'ocr_text',
      statusColumn: 'status'
    },
    data: {
      keyValue: 'TEST_INSTRUCTION_' + new Date().getTime(),
      fileId: TEST_FILE_ID,
      document_type: '指示書',
      client_id: 'TEST_CLIENT_001',
      staff_id: 'test@fractal-group.co.jp',
      client_name: 'テスト利用者',
      staff_name: 'テスト担当者'
    }
  };

  Logger.log('[テスト:指示書] パラメータ:', JSON.stringify(testParams, null, 2));

  const result = processRequest(testParams);

  Logger.log('[テスト:指示書] 結果:', JSON.stringify(result, null, 2));

  return result;
}

/**
 * テスト用関数: 負担割合証のOCR処理
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 処理結果
 */
function testCopayCert() {
  const TEST_FILE_PATH = '負担割合証サンプル.pdf';  // ← 実際のファイル名/パスに置き換え

  if (!TEST_FILE_PATH || TEST_FILE_PATH === '負担割合証サンプル.pdf') {
    throw new Error('❌ ファイルパスが未設定です。testMedicalInsurance() の手順を参照してください。');
  }

  const fileId = getFileIdFromPath(TEST_FILE_PATH);

  const testParams = {
    config: {
      tableName: 'Client_Documents',
      keyColumn: 'document_id',
      titleColumn: 'title',
      summaryColumn: 'summary',
      ocrColumn: 'ocr_text',
      statusColumn: 'status'
    },
    data: {
      keyValue: 'TEST_COPAY_' + new Date().getTime(),
      fileId: TEST_FILE_ID,
      document_type: '負担割合証',
      client_id: 'TEST_CLIENT_001',
      staff_id: 'test@fractal-group.co.jp',
      client_name: 'テスト利用者',
      staff_name: 'テスト担当者'
    }
  };

  Logger.log('[テスト:負担割合証] パラメータ:', JSON.stringify(testParams, null, 2));

  const result = processRequest(testParams);

  Logger.log('[テスト:負担割合証] 結果:', JSON.stringify(result, null, 2));

  return result;
}

/**
 * テスト用関数: 提供票のOCR処理
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 処理結果
 */
function testServiceProvisionForm() {
  const TEST_FILE_PATH = '提供票サンプル.pdf';  // ← 実際のファイル名/パスに置き換え

  if (!TEST_FILE_PATH || TEST_FILE_PATH === '提供票サンプル.pdf') {
    throw new Error('❌ ファイルパスが未設定です。testMedicalInsurance() の手順を参照してください。');
  }

  const fileId = getFileIdFromPath(TEST_FILE_PATH);

  const testParams = {
    config: {
      tableName: 'Client_Documents',
      keyColumn: 'document_id',
      titleColumn: 'title',
      summaryColumn: 'summary',
      ocrColumn: 'ocr_text',
      statusColumn: 'status'
    },
    data: {
      keyValue: 'TEST_PROVISION_' + new Date().getTime(),
      fileId: TEST_FILE_ID,
      document_type: '提供票',
      client_id: 'TEST_CLIENT_001',
      staff_id: 'test@fractal-group.co.jp',
      client_name: 'テスト利用者',
      staff_name: 'テスト担当者'
    }
  };

  Logger.log('[テスト:提供票] パラメータ:', JSON.stringify(testParams, null, 2));

  const result = processRequest(testParams);

  Logger.log('[テスト:提供票] 結果:', JSON.stringify(result, null, 2));

  return result;
}

/**
 * テスト用関数: OCRのみ（書類仕分けなし）
 * client_idとstaff_idを省略して、OCR処理のみをテスト
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 処理結果
 */
function testOCROnly() {
  const TEST_FILE_PATH = '医療保険証サンプル.pdf';  // ← 実際のファイル名/パスに置き換え

  if (!TEST_FILE_PATH || TEST_FILE_PATH === '医療保険証サンプル.pdf') {
    throw new Error('❌ ファイルパスが未設定です。testMedicalInsurance() の手順を参照してください。');
  }

  const fileId = getFileIdFromPath(TEST_FILE_PATH);

  const testParams = {
    config: {
      tableName: 'Client_Documents',
      keyColumn: 'document_id',
      titleColumn: 'title',
      summaryColumn: 'summary',
      ocrColumn: 'ocr_text',
      statusColumn: 'status'
    },
    data: {
      keyValue: 'TEST_OCR_ONLY_' + new Date().getTime(),
      fileId: TEST_FILE_ID,
      document_type: '医療保険証',
      client_birth_date: '1950/01/01'
      // client_id, staff_id なし → 書類仕分けスキップ
    }
  };

  Logger.log('[テスト:OCRのみ] パラメータ:', JSON.stringify(testParams, null, 2));

  const result = processRequest(testParams);

  Logger.log('[テスト:OCRのみ] 結果:', JSON.stringify(result, null, 2));

  return result;
}

/**
 * テスト用関数: directProcessRequest関数のテスト
 * ファイル名から検索してOCR処理を実行
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 処理結果
 */
function testDirectProcessRequest() {
  const result = directProcessRequest(
    'テスト用ファイル名.pdf',  // driveFileName - ファイル名、パス、URL、またはファイルID
    '医療保険証',              // documentType
    'TEST_CLIENT_001',         // clientId
    'test@fractal-group.co.jp', // staffId
    'テスト利用者',            // clientName
    'テスト担当者',            // staffName
    '1950/01/01',              // clientBirthDate
    null,                      // documentId (省略時は自動生成)
    null                       // fileId (省略時はdriveFileNameから検索)
  );

  Logger.log('[テスト:直接実行] 結果:', JSON.stringify(result, null, 2));

  return result;
}

/**
 * テスト用関数: ファイルパス指定でのdirectProcessRequest
 * ファイル名が変更されても確実に実行できるテスト
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 処理結果
 */
function testDirectProcessRequestByFileId() {
  const TEST_FILE_PATH = '医療保険証サンプル.pdf';  // ← 実際のファイル名/パスに置き換え

  if (!TEST_FILE_PATH || TEST_FILE_PATH === '医療保険証サンプル.pdf') {
    throw new Error('❌ ファイルパスが未設定です。testMedicalInsurance() の手順を参照してください。');
  }

  const fileId = getFileIdFromPath(TEST_FILE_PATH);

  const result = directProcessRequest(
    null,                      // driveFileName - fileIdを優先
    '医療保険証',              // documentType
    'TEST_CLIENT_001',         // clientId
    'test@fractal-group.co.jp', // staffId
    'テスト利用者',            // clientName
    'テスト担当者',            // staffName
    '1950/01/01',              // clientBirthDate
    null,                      // documentId (省略時は自動生成)
    fileId                     // fileId
  );

  Logger.log('[テスト:ファイルID指定] 結果:', JSON.stringify(result, null, 2));

  return result;
}

/**
 * テスト用関数: 実行ログ機能のテスト
 * 実行ログが正しくスプレッドシートに記録されることを確認
 * GASエディタから直接実行してテスト可能
 */
function testExecutionLogger() {
  const testRowKey = 'TEST_LOG_' + new Date().getTime();

  Logger.log('[テスト:実行ログ] 開始ログを記録');
  logStartExec(testRowKey, {
    fileId: 'test_file_id',
    documentType: '医療保険証',
    fileName: 'テストファイル.pdf'
  });

  // 処理のシミュレーション
  Utilities.sleep(2000); // 2秒待機

  Logger.log('[テスト:実行ログ] 成功ログを記録');
  logSuccessExec(testRowKey, {
    fileId: 'test_file_id',
    documentType: '医療保険証',
    fileName: 'テストファイル.pdf',
    summary: 'テスト用の要約文です。実際のOCR処理では書類の内容が記録されます。',
    processingTime: '2.00',
    modelName: 'gemini-2.5-flash',
    fileSize: '1234567',
    inputTokens: '5000',
    outputTokens: '2000',
    inputCost: '0.56',
    outputCost: '0.90',
    totalCost: '1.46',
    notes: 'テスト実行完了'
  });

  Logger.log('[テスト:実行ログ] 実行ログシートを確認してください: https://docs.google.com/spreadsheets/d/' + EXECUTION_LOG_SPREADSHEET_ID);

  return { success: true, message: '実行ログテスト完了' };
}

/**
 * テスト用関数: エラーログ機能のテスト
 * エラー時の実行ログが正しく記録されることを確認
 * GASエディタから直接実行してテスト可能
 */
function testErrorLogger() {
  const testRowKey = 'TEST_ERROR_' + new Date().getTime();

  Logger.log('[テスト:エラーログ] 開始ログを記録');
  logStartExec(testRowKey, {
    fileId: 'test_file_id',
    documentType: '医療保険証',
    fileName: 'エラーテストファイル.pdf'
  });

  // エラーのシミュレーション
  Utilities.sleep(1000); // 1秒待機

  const testError = new Error('これはテスト用のエラーメッセージです');

  Logger.log('[テスト:エラーログ] 失敗ログを記録');
  logFailureExec(testRowKey, testError, {
    fileId: 'test_file_id',
    documentType: '医療保険証',
    processingTime: '1.00'
  });

  Logger.log('[テスト:エラーログ] 実行ログシートを確認してください: https://docs.google.com/spreadsheets/d/' + EXECUTION_LOG_SPREADSHEET_ID);

  return { success: true, message: 'エラーログテスト完了' };
}
