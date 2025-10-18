/**
 * main.gs - メイン処理
 *
 * 書類OCR + 書類仕分け統合システムのエントリーポイント
 *
 * @version 2.0.0
 * @date 2025-10-18
 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_訪問看護_書類OCR';
    return processRequest(params);
  });
}

/**
 * メイン処理関数
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  const startTime = Date.now();

  // パラメータ抽出
  const config = params.config;
  const data = params.data;

  if (!config || !data) {
    const errorMessage = "WebhookのBodyの形式が不正です。'config'と'data'オブジェクトが必要です。";
    logStructured(LOG_LEVEL.ERROR, errorMessage);
    sendErrorEmail("Unknown", errorMessage);
    throw new Error(errorMessage);
  }

  const rowKey = data.keyValue;
  const fileId = data.fileId;
  const documentType = data.document_type || "汎用ドキュメント";
  const customInstructions = data.custom_instructions;
  const clientContextInfo = data.client_context_info;
  const clientBirthDate = data.client_birth_date; // 医療保険証・公費で使用
  const clientId = data.client_id; // 書類仕分け用
  const staffId = data.staff_id; // 書類仕分け用
  const clientName = data.client_name; // 通知用
  const staffName = data.staff_name; // 通知用

  if (!rowKey || !fileId) {
    const errorMessage = `必須パラメータ（keyValue, fileId）がWebhookの'data'オブジェクトに含まれていません。`;
    logStructured(LOG_LEVEL.ERROR, errorMessage);
    updateDocumentOnError(config, rowKey || "Unknown", errorMessage);
    sendErrorEmail(rowKey || "Unknown", errorMessage);
    throw new Error(errorMessage);
  }

  // 重複実行防止ロジック
  const properties = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000); // 最大15秒待機

    const status = properties.getProperty(rowKey);

    // 既に処理中または完了済みの場合はスキップ
    if (status === 'processing' || status === 'completed') {
      logStructured(LOG_LEVEL.INFO, `重複リクエスト検知: ${rowKey}をスキップ`, {
        status: status
      });
      lock.releaseLock();
      return { success: true, message: 'Skipped: Already processing or completed' };
    }

    // 状態を「処理中」に更新
    properties.setProperty(rowKey, 'processing');
    lock.releaseLock();

  } catch (lockError) {
    logStructured(LOG_LEVEL.ERROR, 'ロック取得エラー', {
      rowKey: rowKey,
      error: lockError.toString()
    });
    sendErrorEmail(rowKey, `ロック取得エラー: ${lockError.toString()}`);
    throw new Error(`Could not acquire lock: ${lockError.message}`);
  }

  // メイン処理
  try {
    logProcessingStart(rowKey, {
      documentType: documentType,
      fileId: fileId,
      clientId: clientId
    });

    // 1. Gemini APIでOCR + 構造化データ抽出（★1回の呼び出しで完結）
    const resultData = analyzeDocumentWithGemini(
      fileId,
      documentType,
      customInstructions,
      clientContextInfo,
      clientBirthDate
    );

    // 2. 書類管理テーブルを更新
    updateDocumentOnSuccess(config, rowKey, resultData);

    // 3. ファイル名を変更
    renameFile(fileId, resultData.title);

    // 4. 書類仕分け処理（構造化データがある場合のみ）
    let recordId = null;
    if (resultData.structured_data && clientId && staffId) {
      const context = {
        documentId: rowKey,
        clientId: clientId,
        staffId: staffId,
        driveFileId: fileId,
        clientName: clientName,
        staffName: staffName
      };

      recordId = processStructuredData(documentType, resultData.structured_data, context);

      // 5. 完了通知メール送信
      if (recordId) {
        sendCompletionNotificationEmail(context, documentType, resultData.structured_data, recordId);
      }
    } else {
      logStructured(LOG_LEVEL.INFO, '書類仕分けスキップ', {
        reason: !resultData.structured_data ? 'No structured_data' : 'Missing clientId/staffId'
      });
    }

    // 処理完了
    properties.setProperty(rowKey, 'completed');

    const duration = Date.now() - startTime;
    logProcessingComplete(rowKey, duration);

    return {
      success: true,
      documentId: rowKey,
      recordId: recordId
    };

  } catch (error) {
    logError(rowKey, error, {
      documentType: documentType,
      fileId: fileId
    });

    // エラー時の処理
    updateDocumentOnError(config, rowKey, error.toString());
    sendErrorEmail(rowKey, error.stack, {
      documentType: documentType,
      fileId: fileId
    });

    // 再実行できるようにプロパティを削除
    properties.deleteProperty(rowKey);

    throw error;
  }
}

/**
 * 成功時に書類管理テーブルを更新
 */
function updateDocumentOnSuccess(config, keyValue, resultData) {
  const rowData = {
    [config.keyColumn]: keyValue,
    [config.titleColumn]: resultData.title,
    [config.summaryColumn]: resultData.summary,
    [config.ocrColumn]: resultData.ocr_text,
    [config.statusColumn]: "完了"
  };

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [rowData]
  };

  callDocumentTableApi(config.tableName, payload);
}

/**
 * 失敗時に書類管理テーブルを更新
 */
function updateDocumentOnError(config, keyValue, errorMessage) {
  // configが不正な場合に備える
  if (!config || !config.tableName || !config.keyColumn || !config.statusColumn) {
    logStructured(LOG_LEVEL.ERROR, 'config情報不足のため書類管理テーブル更新スキップ');
    return;
  }

  const rowData = {
    [config.keyColumn]: keyValue,
    [config.statusColumn]: "エラー",
    "error_details": `GAS Script Error: ${errorMessage}`
  };

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [rowData]
  };

  callDocumentTableApi(config.tableName, payload);
}

/**
 * 書類管理テーブル用のAPI呼び出し
 */
function callDocumentTableApi(tableName, payload) {
  const perfStop = perfStart('AppSheet_Documents');

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APPSHEET_CONFIG.appId}/tables/${encodeURIComponent(tableName)}/Action`;

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
  logApiCall('AppSheet_Documents', apiUrl, responseCode, duration);

  if (responseCode >= 400) {
    const errorMsg = `AppSheet API Error: ${responseCode} - ${response.getContentText()}`;
    logStructured(LOG_LEVEL.ERROR, errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Google Drive上のファイル名を変更
 */
function renameFile(fileId, newName) {
  try {
    const file = DriveApp.getFileById(fileId);

    // 拡張子を保持
    const originalName = file.getName();
    const extension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';

    // 不正な文字を置換
    const safeTitle = newName.replace(/[\\/?<>*:|"]/g, '_');
    const newFileName = safeTitle + extension;

    // ファイル名が同じ場合はスキップ
    if (file.getName() === newFileName) {
      logStructured(LOG_LEVEL.INFO, 'ファイル名は既に設定済み', { fileName: newFileName });
      return;
    }

    file.setName(newFileName);
    logStructured(LOG_LEVEL.INFO, 'ファイル名変更成功', {
      oldName: originalName,
      newName: newFileName
    });

  } catch (e) {
    logStructured(LOG_LEVEL.WARN, 'ファイル名変更失敗（非致命的）', {
      fileId: fileId,
      error: e.toString()
    });
  }
}

/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  console.log('='.repeat(60));
  console.log('🧪 書類OCR+仕分け 統合テスト実行');
  console.log('='.repeat(60));

  // TODO: テストデータを設定してください
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
      keyValue: 'TEST-DOC-001',
      fileId: 'YOUR_TEST_FILE_ID', // ★要変更
      document_type: '医療保険証',
      client_id: 'TEST-CLIENT-001',
      staff_id: 'test@fractal-group.co.jp',
      client_name: '山田太郎',
      staff_name: 'テスト担当者',
      client_birth_date: '1950/01/01'
    }
  };

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_訪問看護_書類OCR');
}
