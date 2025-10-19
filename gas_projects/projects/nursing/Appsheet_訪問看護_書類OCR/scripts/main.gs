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
  const timer = new ExecutionTimer();

  // パラメータ抽出
  const config = params.config;
  const data = params.data;

  if (!config || !data) {
    const errorMessage = "WebhookのBodyの形式が不正です。'config'と'data'オブジェクトが必要です。";
    logStructured(LOG_LEVEL.ERROR, errorMessage);
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
    throw new Error(errorMessage);
  }

  // メイン処理
  try {
    // 処理開始をログ記録
    logStartExec(rowKey, {
      fileId: fileId,
      documentType: documentType,
      fileName: data.file_name || ''
    });

    // 1. Gemini APIでOCR + 構造化データ抽出（★1回の呼び出しで完結）
    const resultData = analyzeDocumentWithGemini(
      fileId,
      documentType,
      customInstructions,
      clientContextInfo,
      clientBirthDate
    );

    // 2. 書類管理テーブルを更新（file_id, file_urlも含む）
    updateDocumentOnSuccess(config, rowKey, resultData, fileId);

    // 3. ファイル名を変更
    renameFile(fileId, resultData.title);

    // 4. 書類仕分け処理
    let recordId = null;

    // 提供票は特殊処理（OCRテキストが必要）
    if (documentType === '提供票' && clientId && staffId) {
      const context = {
        documentId: rowKey,
        clientId: clientId,
        staffId: staffId,
        driveFileId: fileId,
        clientName: clientName,
        staffName: staffName,
        ocrText: resultData.ocr_text  // 提供票用にOCRテキストを渡す
      };

      recordId = processStructuredData(documentType, null, context);

      // 5. 完了通知メール送信（提供票は別途実装が必要）
      if (recordId) {
        // TODO: 提供票用の通知メール
        logStructured(LOG_LEVEL.INFO, '提供票の完了通知はスキップ', { recordId });
      }

    } else if (resultData.structured_data && clientId && staffId) {
      // 提供票以外の書類仕分け処理
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

    // API使用量情報を取得
    const usageMetadata = resultData.usageMetadata || null;

    // 処理完了
    const fileSize = usageMetadata && usageMetadata.fileSize ? usageMetadata.fileSize : '';

    // 成功ログを記録
    logSuccessExec(rowKey, {
      fileId: fileId,
      documentType: documentType,
      fileName: resultData.title || '',
      summary: (resultData.summary || '').substring(0, 200),
      processingTime: timer.getElapsedSeconds(),
      modelName: usageMetadata ? usageMetadata.model : '',
      fileSize: fileSize,
      inputTokens: usageMetadata ? usageMetadata.inputTokens : '',
      outputTokens: usageMetadata ? usageMetadata.outputTokens : '',
      inputCost: usageMetadata ? usageMetadata.inputCostJPY.toFixed(2) : '',
      outputCost: usageMetadata ? usageMetadata.outputCostJPY.toFixed(2) : '',
      totalCost: usageMetadata ? usageMetadata.totalCostJPY.toFixed(2) : '',
      notes: recordId ? `書類仕分け完了 (Record ID: ${recordId})` : '書類仕分けスキップ'
    });

    return {
      success: true,
      documentId: rowKey,
      recordId: recordId,
      usageMetadata: usageMetadata
    };

  } catch (error) {
    // エラーログを記録
    logFailureExec(rowKey, error, {
      documentType: documentType,
      fileId: fileId,
      processingTime: timer.getElapsedSeconds()
    });

    // エラー時の処理
    updateDocumentOnError(config, rowKey, error.toString());

    throw error;
  }
}

/**
 * 成功時に書類管理テーブルを更新
 */
function updateDocumentOnSuccess(config, keyValue, resultData, fileId) {
  const fileUrl = 'https://drive.google.com/file/d/' + fileId + '/view';

  var rowData = {};
  rowData[config.keyColumn] = keyValue;
  rowData[config.titleColumn] = resultData.title;
  rowData[config.summaryColumn] = resultData.summary;
  rowData[config.ocrColumn] = resultData.ocr_text;
  rowData[config.statusColumn] = "完了";
  rowData["file_id"] = fileId;
  rowData["file_url"] = fileUrl;

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [rowData]
  };

  // テストレコードの場合、404エラーを許可（レコードが存在しない可能性がある）
  const isTestRecord = keyValue && keyValue.toString().indexOf('TEST_') === 0;
  callDocumentTableApi(config.tableName, payload, isTestRecord);
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

  var rowData = {};
  rowData[config.keyColumn] = keyValue;
  rowData[config.statusColumn] = "エラー";
  rowData["error_details"] = 'GAS Script Error: ' + errorMessage;

  const payload = {
    Action: "Edit",
    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },
    Rows: [rowData]
  };

  // テストレコードの場合、404エラーを許可（レコードが存在しない可能性がある）
  const isTestRecord = keyValue && keyValue.toString().indexOf('TEST_') === 0;
  callDocumentTableApi(config.tableName, payload, isTestRecord);
}

/**
 * 書類管理テーブル用のAPI呼び出し
 * @param {string} tableName - テーブル名
 * @param {Object} payload - リクエストペイロード
 * @param {boolean} allowNotFound - 404エラーを許可するか（デフォルト: false）
 */
function callDocumentTableApi(tableName, payload, allowNotFound) {
  if (allowNotFound === undefined) {
    allowNotFound = false;
  }

  const perfStop = perfStart('AppSheet_Documents');

  const apiUrl = 'https://api.appsheet.com/api/v2/apps/' + APPSHEET_CONFIG.appId + '/tables/' + encodeURIComponent(tableName) + '/Action';

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

  // 404エラーを許可する場合（テストモードなど）
  if (responseCode === 404 && allowNotFound) {
    logStructured(LOG_LEVEL.WARN, 'レコードが見つかりません（404）。新規作成が必要です。', {
      tableName: tableName,
      action: payload.Action
    });
    return; // エラーをスローせずに戻る
  }

  if (responseCode >= 400) {
    const errorMsg = 'AppSheet API Error: ' + responseCode + ' - ' + response.getContentText();
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
 * ファイルパス、ファイル名、またはURLからファイルIDを取得
 * @param {string} filePathOrUrl - ファイルパス、ファイル名、Drive URL、またはファイルID
 * @returns {string} - ファイルID
 */
function getFileIdFromPath(filePathOrUrl) {
  // すでにファイルIDの形式の場合（英数字とハイフン、アンダースコア）
  if (/^[a-zA-Z0-9_-]+$/.test(filePathOrUrl) && filePathOrUrl.length > 20) {
    return filePathOrUrl;
  }

  // Drive URLからファイルIDを抽出
  // https://drive.google.com/file/d/{fileId}/view
  // https://drive.google.com/open?id={fileId}
  const urlPatterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of urlPatterns) {
    const match = filePathOrUrl.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // パス区切り文字が含まれている場合はパスとして解釈
  if (filePathOrUrl.includes('/')) {
    const fileId = getFileIdFromFolderPath(filePathOrUrl);
    if (fileId) {
      logStructured(LOG_LEVEL.INFO, 'ファイルパスからファイルIDを取得', {
        filePath: filePathOrUrl,
        fileId: fileId,
        baseFolderId: DRIVE_CONFIG.baseFolderId
      });
      return fileId;
    }
    throw new Error(`ファイルが見つかりません（パス指定）: ${filePathOrUrl}`);
  }

  // ファイル名で検索（基準フォルダー配下を再帰的に検索）
  const fileId = searchFileInFolder(DRIVE_CONFIG.baseFolderId, filePathOrUrl);
  if (fileId) {
    logStructured(LOG_LEVEL.INFO, 'ファイル名からファイルIDを取得', {
      fileName: filePathOrUrl,
      fileId: fileId,
      baseFolderId: DRIVE_CONFIG.baseFolderId
    });
    return fileId;
  }

  throw new Error(`ファイルが見つかりません: ${filePathOrUrl}（基準フォルダー: ${DRIVE_CONFIG.baseFolderId}）`);
}

/**
 * フォルダパスからファイルIDを取得
 * @param {string} path - フォルダパス（例: "フォルダA/フォルダB/ファイル.pdf"）
 * @returns {string|null} - ファイルID（見つからない場合はnull）
 */
function getFileIdFromFolderPath(path) {
  // パスを正規化（先頭の'/'を削除）
  const normalizedPath = path.replace(/^\/+/, '');

  // パスを分割
  const parts = normalizedPath.split('/');

  // 基準フォルダーから開始
  let currentFolder = DriveApp.getFolderById(DRIVE_CONFIG.baseFolderId);

  // フォルダー階層をたどる（最後の要素はファイル名）
  for (let i = 0; i < parts.length - 1; i++) {
    const folderName = parts[i];
    const folders = currentFolder.getFoldersByName(folderName);

    if (!folders.hasNext()) {
      logStructured(LOG_LEVEL.WARN, 'フォルダーが見つかりません', {
        folderName: folderName,
        currentPath: parts.slice(0, i + 1).join('/')
      });
      return null;
    }

    currentFolder = folders.next();
  }

  // 最後の要素をファイル名として取得
  const fileName = parts[parts.length - 1];
  const files = currentFolder.getFilesByName(fileName);

  if (files.hasNext()) {
    return files.next().getId();
  }

  return null;
}

/**
 * フォルダー内のファイルを再帰的に検索
 * @param {string} folderId - 検索対象フォルダーID
 * @param {string} fileName - 検索するファイル名
 * @returns {string|null} - ファイルID（見つからない場合はnull）
 */
function searchFileInFolder(folderId, fileName) {
  const folder = DriveApp.getFolderById(folderId);

  // 現在のフォルダー内でファイルを検索
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    return files.next().getId();
  }

  // サブフォルダーを再帰的に検索
  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    const subfolder = subfolders.next();
    const fileId = searchFileInFolder(subfolder.getId(), fileName);
    if (fileId) {
      return fileId;
    }
  }

  return null;
}

/**
 * 直接実行用関数（個別引数版）
 * GASエディタから直接実行してテスト可能
 *
 * @param {string} driveFileName - ファイル名、ファイルパス、Drive URL、またはファイルID（fileIdが指定されていない場合に使用）
 * @param {string} documentType - 書類種類（医療保険証/介護保険証/公費/口座情報/指示書/負担割合証/汎用ドキュメント）
 * @param {string} clientId - 利用者ID（書類仕分け用）
 * @param {string} staffId - スタッフID（書類仕分け用）
 * @param {string} clientName - 利用者名（通知用）
 * @param {string} staffName - スタッフ名（通知用）
 * @param {string} clientBirthDate - 利用者生年月日（yyyy/mm/dd形式、医療保険証・公費で使用）
 * @param {string} documentId - 書類ID（省略時は自動生成）
 * @param {string} fileId - ファイルID（指定時はdriveFileNameより優先、ファイル名変更後も確実に実行可能）
 * @returns {Object} - 処理結果（success, documentId, recordId, fileId, fileUrl）
 */
function directProcessRequest(
  driveFileName = 'テスト用ファイル名.pdf',
  documentType = '医療保険証',
  clientId = 'TEST-CLIENT-001',
  staffId = 'test@fractal-group.co.jp',
  clientName = '山田太郎',
  staffName = 'テスト担当者',
  clientBirthDate = '1950/01/01',
  documentId = null,
  fileId = null
) {
  console.log('='.repeat(60));
  console.log('🚀 書類OCR+仕分け 直接実行');
  console.log('='.repeat(60));

  // ファイルIDを取得（fileId優先、なければdriveFileNameから検索）
  let finalFileId;

  if (fileId) {
    // ファイルIDが指定されている場合はそれを使用（優先）
    finalFileId = fileId;
    console.log(`🆔 ファイルID指定（優先）: ${fileId}`);
  } else if (driveFileName) {
    // ファイル名/パスから検索
    finalFileId = getFileIdFromPath(driveFileName);
    console.log(`📁 ファイル名/パス指定: ${driveFileName}`);
    console.log(`🆔 取得したファイルID: ${finalFileId}`);
  } else {
    // どちらも指定されていない場合はエラー
    throw new Error('driveFileNameまたはfileIdのいずれかを指定してください');
  }

  const fileUrl = `https://drive.google.com/file/d/${finalFileId}/view`;

  // 書類IDを生成（省略時）
  const finalDocumentId = documentId || `DIRECT-${new Date().getTime()}`;

  console.log(`📄 書類種類: ${documentType}`);
  console.log(`🔗 ファイルURL: ${fileUrl}`);
  console.log(`📋 書類ID: ${finalDocumentId}`);
  console.log(`👤 利用者: ${clientName} (${clientId})`);
  console.log(`👨‍💼 スタッフ: ${staffName} (${staffId})`);
  console.log('='.repeat(60));

  // processRequest用のパラメータを構築
  const params = {
    config: {
      tableName: 'Client_Documents',
      keyColumn: 'document_id',
      titleColumn: 'title',
      summaryColumn: 'summary',
      ocrColumn: 'ocr_text',
      statusColumn: 'status'
    },
    data: {
      keyValue: finalDocumentId,
      fileId: finalFileId,
      document_type: documentType,
      client_id: clientId,
      staff_id: staffId,
      client_name: clientName,
      staff_name: staffName,
      client_birth_date: clientBirthDate
    }
  };

  // メイン処理を実行
  const result = processRequest(params);

  // 戻り値にfileIdとfileUrlを追加
  return {
    ...result,
    fileId: finalFileId,
    fileUrl: fileUrl
  };
}
