/*******************************************************************************
* 設定・定数
*******************************************************************************/
// ★★★ Google AI Studio API → Vertex AIに変更 ★★★
// 修正日: 2025-10-22
// Vertex AI設定
// const GEMINI_API_KEY = '';  // ★削除済み - Vertex AIはOAuth2認証を使用
const GEMINI_MODEL = 'gemini-2.5-flash-lite';  // ★ コスト最適化のためFlash-Liteを使用
const GCP_PROJECT_ID = 'macro-shadow-458705-v8';
const GCP_LOCATION = 'us-central1';
const GEMINI_API_ENDPOINT = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

// 為替レート（USD -> JPY）
const EXCHANGE_RATE_USD_TO_JPY = 150;

// 実行ログスプレッドシート
const EXECUTION_LOG_SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';
const EXECUTION_LOG_SHEET_NAME = '実行履歴';

// 処理制御の定数
const LOCK_TIMEOUT_MS = 300000; // 5分 = 300,000ミリ秒
const ID_LENGTH = 8; // 生成するユニークIDの長さ
const MAX_ID_GENERATION_ATTEMPTS = 10; // ID生成の最大試行回数

// スクリプトプロパティキー
const PROP_KEYS = {
  RECEIPT_FOLDER_ID: 'RECEIPT_FOLDER_ID',
  TARGET_FOLDER_ID: 'TARGET_FOLDER_ID',
  CORPORATE_RECEIPT_FOLDER_ID: 'CORPORATE_RECEIPT_FOLDER_ID',
  CORPORATE_TARGET_FOLDER_ID: 'CORPORATE_TARGET_FOLDER_ID',
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  SHEET_NAME: 'SHEET_NAME',
};

// Gemini APIがサポートするMIMEタイプ
const SUPPORTED_MIME_TYPES = [ 'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif' ];

// スプレッドシート列定義
const SHEET_COLUMNS = [
  'ステータス', 'ID', '区分', '勘定科目', '支払方法', '口座情報', '年月日', '時間', '時間帯',
  '支払先', '支払先_支店名', '支払金額', '税区分', '払戻金額', '支払者',
  'レシート_ファイル_名称', 'レシート_ファイル_パス', 'レシート_ファイル_ID', 'レシート_ファイル_URL',
  '購入品_内訳', '作成日時',
  '食事該当', '経費取消', '共有フォルダー格納', '備考'
];
const ID_COLUMN_INDEX = SHEET_COLUMNS.indexOf('ID');
const DATE_COLUMN_INDEX = SHEET_COLUMNS.indexOf('年月日');
const TIME_COLUMN_INDEX = SHEET_COLUMNS.indexOf('時間');
const AMOUNT_COLUMN_INDEX = SHEET_COLUMNS.indexOf('支払金額');
const PAYER_COLUMN_INDEX = SHEET_COLUMNS.indexOf('支払者');

// ★修正点: 欠落していた以下の定数を再追加しました。
// 勘定科目リスト
const ACCOUNT_TITLES = ["建物", "機械装置", "車両運搬具", "工具器具備品", "一括償却資産", "減価償却累計額", "土地", "電話加入権", "ソフトウェア", "敷金", "差入保証金", "長期貸付金", "創立費", "開業費", "売上値引高", "外注加工費", "期首商品棚卸高", "期首製品棚卸高", "仕入高", "支払利息", "雑損失", "前期利益修正損", "固定資産売却損", "法人税･住民税及び事業税", "給料手当", "役員報酬", "役員賞与", "雑給", "賞与", "退職金", "法定福利費", "福利厚生費", "採用教育費", "通信費", "荷造運賃", "水道光熱費", "旅費交通費", "広告宣伝費", "販売手数料", "交際費", "少額交際費", "会議費", "消耗品費", "事務用品費", "新聞図書費", "修繕費", "地代家賃", "車両費", "保険料", "租税公課", "諸会費", "賃借料", "支払手数料", "減価償却費", "研究開発費", "寄附金", "雑費"];
// 税区分リスト
const TAX_CATEGORIES = ["対象外", "不明", "課税仕入 10%", "課税仕入 (軽)8%", "課税仕入 8%", "非課税仕入", "対象外仕入"];

/*******************************************************************************
* メイン処理 (個人用)
*******************************************************************************/
function mainProcessPersonalReceipts() {
  const FN = 'mainProcessPersonalReceipts';
  const timer = new ExecutionTimer();
  const requestId = Utilities.getUuid();
  
  Logger.log(`情報 [${FN}]: 個人用レシート処理を開始します。RequestID: ${requestId}`);
  
  // 重複実行チェック（スクリプトプロパティで実行中フラグを使用）
  const lockKey = 'personal_receipt_processing';
  const scriptProperties = PropertiesService.getScriptProperties();
  const existingLock = scriptProperties.getProperty(lockKey);
  
  if (existingLock) {
    const lockTime = new Date(existingLock);
    const now = new Date();
    if ((now - lockTime) < LOCK_TIMEOUT_MS) {
      Logger.log(`警告 [${FN}]: 処理実行中のためスキップします`);
      logToExecutionSheet('Automation_レシート(個人)', 'スキップ', requestId, {
        summary: '他の処理が実行中のためスキップ',
        processingTime: timer.getElapsedSeconds()
      });
      return;
    }
  }
  
  // ロック設定
  scriptProperties.setProperty(lockKey, new Date().toISOString());
  
  try {
    const props = getScriptProperties_();
    if (!props) {
      logToExecutionSheet('Automation_レシート(個人)', '失敗', requestId, {
        errorMessage: 'スクリプトプロパティが未設定',
        processingTime: timer.getElapsedSeconds()
      });
      return;
    }

    const config = {
      sourceFolderId: props.receiptFolderId,
      targetFolderId: props.targetFolderId,
      spreadsheetId: props.spreadsheetId,
      sheetName: props.sheetName,
    };

    if (!config.sourceFolderId || config.sourceFolderId.startsWith('YOUR_')) {
      Logger.log(`エラー [${FN}]: 個人用のレシートフォルダID (RECEIPT_FOLDER_ID) が正しく設定されていません。`);
      logToExecutionSheet('Automation_レシート(個人)', '失敗', requestId, {
        errorMessage: 'レシートフォルダIDが未設定',
        processingTime: timer.getElapsedSeconds()
      });
      return;
    }
    if (!config.targetFolderId || config.targetFolderId.startsWith('YOUR_')) {
      Logger.log(`エラー [${FN}]: 個人用の移動先フォルダID (TARGET_FOLDER_ID) が正しく設定されていません。`);
      logToExecutionSheet('Automation_レシート(個人)', '失敗', requestId, {
        errorMessage: '移動先フォルダIDが未設定',
        processingTime: timer.getElapsedSeconds()
      });
      return;
    }
    
    processReceiptsByType_(config, "personal", requestId, timer);
    
    logToExecutionSheet('Automation_レシート(個人)', '成功', requestId, {
      summary: '個人用レシート処理完了',
      processingTime: timer.getElapsedSeconds()
    });
    
  } catch (e) {
    Logger.log(`エラー [${FN}]: ${e.message}\n${e.stack}`);
    logToExecutionSheet('Automation_レシート(個人)', '失敗', requestId, {
      errorMessage: e.message,
      processingTime: timer.getElapsedSeconds()
    });
  } finally {
    // ロック解除
    scriptProperties.deleteProperty(lockKey);
  }
}

/*******************************************************************************
* メイン処理 (法人用)
*******************************************************************************/
function mainProcessCorporateReceipts() {
  const FN = 'mainProcessCorporateReceipts';
  const timer = new ExecutionTimer();
  const requestId = Utilities.getUuid();
  
  Logger.log(`情報 [${FN}]: 法人用レシート処理を開始します。RequestID: ${requestId}`);
  
  // 重複実行チェック
  const lockKey = 'corporate_receipt_processing';
  const scriptProperties = PropertiesService.getScriptProperties();
  const existingLock = scriptProperties.getProperty(lockKey);
  
  if (existingLock) {
    const lockTime = new Date(existingLock);
    const now = new Date();
    if ((now - lockTime) < LOCK_TIMEOUT_MS) {
      Logger.log(`警告 [${FN}]: 処理実行中のためスキップします`);
      logToExecutionSheet('Automation_レシート(法人)', 'スキップ', requestId, {
        summary: '他の処理が実行中のためスキップ',
        processingTime: timer.getElapsedSeconds()
      });
      return;
    }
  }
  
  // ロック設定
  scriptProperties.setProperty(lockKey, new Date().toISOString());
  
  try {
    const props = getScriptProperties_();
    if (!props) {
      logToExecutionSheet('Automation_レシート(法人)', '失敗', requestId, {
        errorMessage: 'スクリプトプロパティが未設定',
        processingTime: timer.getElapsedSeconds()
      });
      return;
    }

    const config = {
      sourceFolderId: props.corporateReceiptFolderId,
      targetFolderId: props.corporateTargetFolderId,
      spreadsheetId: props.spreadsheetId,
      sheetName: props.sheetName,
    };

    if (!config.sourceFolderId || config.sourceFolderId.startsWith('YOUR_')) {
      Logger.log(`エラー [${FN}]: 法人用のレシートフォルダID (CORPORATE_RECEIPT_FOLDER_ID) が正しく設定されていません。`);
      logToExecutionSheet('Automation_レシート(法人)', '失敗', requestId, {
        errorMessage: 'レシートフォルダIDが未設定',
        processingTime: timer.getElapsedSeconds()
      });
      return;
    }
    if (!config.targetFolderId || config.targetFolderId.startsWith('YOUR_')) {
      Logger.log(`エラー [${FN}]: 法人用の移動先フォルダID (CORPORATE_TARGET_FOLDER_ID) が正しく設定されていません。`);
      logToExecutionSheet('Automation_レシート(法人)', '失敗', requestId, {
        errorMessage: '移動先フォルダIDが未設定',
        processingTime: timer.getElapsedSeconds()
      });
      return;
    }
    
    processReceiptsByType_(config, "corporate", requestId, timer);
    
    logToExecutionSheet('Automation_レシート(法人)', '成功', requestId, {
      summary: '法人用レシート処理完了',
      processingTime: timer.getElapsedSeconds()
    });
    
  } catch (e) {
    Logger.log(`エラー [${FN}]: ${e.message}\n${e.stack}`);
    logToExecutionSheet('Automation_レシート(法人)', '失敗', requestId, {
      errorMessage: e.message,
      processingTime: timer.getElapsedSeconds()
    });
  } finally {
    // ロック解除
    scriptProperties.deleteProperty(lockKey);
  }
}


/*******************************************************************************
* 共通レシート処理ロジック
* ★変更点: 処理結果をユーザーごとに集計し、最後にメールを送信するロジックを追加
*******************************************************************************/
function processReceiptsByType_(config, processingType, requestId, timer) {
  const FN = 'processReceiptsByType_';
  Logger.log(`情報 [${FN}]: タイプ '${processingType}' の処理を開始。ソースフォルダ: ${config.sourceFolderId}`);

  const { existingIds, existingData } = getExistingDataFromSheet_(config.spreadsheetId, config.sheetName);
  if (existingIds === null) {
    logToExecutionSheet(`Automation_レシート(${processingType})`, '失敗', requestId, {
      errorMessage: '既存データの取得に失敗',
      processingTime: timer.getElapsedSeconds()
    });
    return;
  }
  Logger.log(`情報 [${FN}]: ${existingIds.size} 件の既存ID、${existingData.length} 件の既存データを取得しました。`);

  const files = getFilesInFolder_(config.sourceFolderId);
  if (!files || files.length === 0) {
    Logger.log(`情報 [${FN}]: フォルダ [${config.sourceFolderId}] 内に処理対象ファイルはありませんでした。`);
    logToExecutionSheet(`Automation_レシート(${processingType})`, '成功', requestId, {
      summary: '処理対象ファイルなし',
      processingTime: timer.getElapsedSeconds()
    });
    return;
  }
  Logger.log(`情報 [${FN}]: フォルダ [${config.sourceFolderId}] 内に ${files.length} 件のファイルが見つかりました。`);

  const processedResultsByUser = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostJPY = 0;
  let apiCallCount = 0;

  for (const file of files) {
    const result = processSingleFile_(
      { id: file.getId(), name: file.getName() },
      config,
      processingType,
      existingIds,
      existingData
    );

    if (result && result.payerEmail) {
      if (!processedResultsByUser[result.payerEmail]) {
        processedResultsByUser[result.payerEmail] = { processed: [], skipped: [] };
      }
      if (result.status === 'processed') {
        processedResultsByUser[result.payerEmail].processed.push(result.data);
      } else if (result.status === 'skipped') {
        processedResultsByUser[result.payerEmail].skipped.push(result.data);
      }

      // API使用量を集計
      if (result.usageMetadata) {
        totalInputTokens += result.usageMetadata.inputTokens || 0;
        totalOutputTokens += result.usageMetadata.outputTokens || 0;
        totalCostJPY += result.usageMetadata.totalCostJPY || 0;
        apiCallCount++;
      }
    }
  }

  // ユーザー別にメール送信とログ記録
  for (const email in processedResultsByUser) {
    const results = processedResultsByUser[email];
    if (results.processed.length > 0 || results.skipped.length > 0) {
      // ユーザーごとのレシート総額を計算
      const userTotalAmount = results.processed.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);

      // HTMLメール送信
      sendReceiptSummaryEmail_(email, results, userTotalAmount, processingType);

      // 実行ログに記録
      logToExecutionSheet(`Automation_レシート(${processingType})`, '成功', requestId, {
        summary: `処理完了: 成功${results.processed.length}件, スキップ${results.skipped.length}件`,
        user: email,
        processingTime: timer.getElapsedSeconds(),
        outputSummary: `成功: ${results.processed.map(r => r.fileName).join(', ')}`,
        modelName: GEMINI_MODEL,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalCost: totalCostJPY.toFixed(2),
        apiCallCount: apiCallCount
      });
    }
  }

  Logger.log(`情報 [${FN}]: タイプ '${processingType}' の全てのファイルの処理が完了しました。`);
  Logger.log(`💰 合計API使用量: Input=${totalInputTokens}tokens, Output=${totalOutputTokens}tokens, 合計=¥${totalCostJPY.toFixed(2)} (${apiCallCount}回呼び出し)`);
}


/*******************************************************************************
* 個別ファイル処理コア関数
*******************************************************************************/
// ★変更点: メタデータ参照をv3 APIのプロパティ名（name, lastModifyingUser）に戻す
function processSingleFile_(fileObject, config, processingType, existingIds, existingData) {
  const FN = 'processSingleFile_';
  Logger.log(`--------------------`);
  Logger.log(`情報 [${FN}]: ファイル [${fileObject.id}] (${fileObject.name}) の処理を開始 (タイプ: ${processingType})。`);
  let originalFileNameForCatch = fileObject.name;

  try {
    const metadata = getFileMetadata_(fileObject.id);
    // プロパティ名をv3の 'lastModifyingUser' に戻す
    if (!metadata || !metadata.lastModifyingUser || !metadata.lastModifyingUser.emailAddress) {
      Logger.log(`警告 [${FN}]: ファイル [${fileObject.id}] メタデータまたは最終更新者情報を取得できませんでした。スキップします。`);
      return null;
    }
    // プロパティ名をv3の 'name' に戻す
    originalFileNameForCatch = metadata.name;
    // プロパティ名をv3の 'lastModifyingUser' に戻す
    const payerEmail = metadata.lastModifyingUser.emailAddress;
    Logger.log(`情報 [${FN}]: ファイル [${fileObject.id}] の最終更新者: ${payerEmail}`);

    const mimeType = metadata.mimeType;
    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
      Logger.log(`警告 [${FN}]: ファイル [${fileObject.id}] MIMEタイプ(${mimeType})非対応。スキップ。`);
      return null;
    }
    Logger.log(`情報 [${FN}]: ファイル [${fileObject.id}] MIMEタイプ(${mimeType})対応。`);

    const fileContentBase64 = getDriveFileContentAsBase64_(fileObject.id);
    if (!fileContentBase64) {
      Logger.log(`警告 [${FN}]: ファイル [${fileObject.id}] 内容取得失敗。スキップ。`);
      return null;
    }
    Logger.log(`情報 [${FN}]: ファイル [${fileObject.id}] 内容取得成功。`);

    const apiResult = extractInfoWithGemini_(fileContentBase64, mimeType, originalFileNameForCatch);
    if (!apiResult || !apiResult.data) {
      Logger.log(`警告 [${FN}]: ファイル [${fileObject.id}] 情報抽出失敗。スキップ。`);
      return null;
    }

    const extractedInfo = apiResult.data;
    const usageMetadata = apiResult.usageMetadata;

    Logger.log(`情報 [${FN}]: ファイル [${fileObject.id}] 情報抽出成功。デバッグ: ${JSON.stringify(extractedInfo)}`);

    // API使用量をログ出力
    if (usageMetadata) {
      Logger.log(`💰 API使用量: Input=${usageMetadata.inputTokens}tokens, Output=${usageMetadata.outputTokens}tokens, 合計=¥${usageMetadata.totalCostJPY.toFixed(2)}`);
    }

    // データ整形
    const paymentDate = extractedInfo.date || '';
    let paymentTime = extractedInfo.time || '';
    if (paymentTime.toLowerCase() === '不明' || (paymentTime && !/^\d{1,2}:\d{2}$/.test(paymentTime))) { paymentTime = ''; }
    let totalAmount = 0;
    if (extractedInfo.totalAmount !== null && extractedInfo.totalAmount !== undefined && !isNaN(Number(extractedInfo.totalAmount))) {
      totalAmount = Number(extractedInfo.totalAmount);
    } else {
      Logger.log(`警告 [${FN}]: 抽出支払金額が数値でない: ${extractedInfo.totalAmount}。0として処理。`);
    }

    // 重複チェック
    if (isDuplicateEntry_(paymentDate, paymentTime, totalAmount, payerEmail, existingData)) {
      Logger.log(`警告 [${FN}]: ファイル [${originalFileNameForCatch}] は重複データのためスキップします。`);
      
      try {
        DriveApp.getFileById(fileObject.id).setTrashed(true);
        Logger.log(`情報 [${FN}]: 重複ファイル [${originalFileNameForCatch}] をゴミ箱に移動しました。`);
      } catch (e) {
        Logger.log(`エラー [${FN}]: 重複ファイル [${originalFileNameForCatch}] のゴミ箱への移動中にエラーが発生しました: ${e.message}`);
      }
      
      return {
        status: 'skipped',
        payerEmail: payerEmail,
        data: {
          fileName: originalFileNameForCatch,
          date: paymentDate,
          amount: totalAmount,
          reason: '支払日、時間、金額、支払者が一致するデータが既に存在します。'
        }
      };
    }

    // 以下、重複がない場合の処理
    const uniqueId = generateUniqueId_(existingIds);
    let timeOfDay = determineTimeOfDay_(paymentTime);
    if (timeOfDay === '不明') { timeOfDay = ''; }
    const storeName = extractedInfo.storeName || '不明';

    const formattedDate = paymentDate.replace(/-/g, '');
    const safeStoreName = storeName.replace(/[\\/:*?"<>|]/g, '_');
    // プロパティ名をv3の 'name' に戻す
    const fileExtension = metadata.name.includes('.') ? metadata.name.split('.').pop() : '';
    const newFileName = `${formattedDate}_${safeStoreName}_${totalAmount}${fileExtension ? '.' + fileExtension : ''}`;
    const newFilePath = `明細管理/承認前/${newFileName}`;

    const dataRow = new Array(SHEET_COLUMNS.length).fill('');
    dataRow[SHEET_COLUMNS.indexOf('ステータス')] = '申請前';
    dataRow[ID_COLUMN_INDEX] = uniqueId;
    if (processingType === 'corporate') {
      dataRow[SHEET_COLUMNS.indexOf('区分')] = '法人';
      dataRow[SHEET_COLUMNS.indexOf('払戻金額')] = 0;
      const paymentMethod = extractedInfo.paymentMethod || '';
      if (paymentMethod.includes('クレジット') || paymentMethod.includes('カード')) {
        dataRow[SHEET_COLUMNS.indexOf('支払方法')] = '未払金';
      } else {
        dataRow[SHEET_COLUMNS.indexOf('支払方法')] = '普通預金';
      }
    } else {
      dataRow[SHEET_COLUMNS.indexOf('区分')] = '個人';
      dataRow[SHEET_COLUMNS.indexOf('払戻金額')] = totalAmount;
      dataRow[SHEET_COLUMNS.indexOf('支払方法')] = '立替金';
    }
    dataRow[SHEET_COLUMNS.indexOf('勘定科目')] = extractedInfo.accountTitle || '不明';
    dataRow[SHEET_COLUMNS.indexOf('年月日')] = paymentDate;
    dataRow[SHEET_COLUMNS.indexOf('時間')] = paymentTime;
    dataRow[SHEET_COLUMNS.indexOf('時間帯')] = timeOfDay;
    dataRow[SHEET_COLUMNS.indexOf('支払先')] = storeName;
    dataRow[SHEET_COLUMNS.indexOf('支払先_支店名')] = extractedInfo.storeBranchName || '';
    dataRow[SHEET_COLUMNS.indexOf('支払金額')] = totalAmount;
    dataRow[SHEET_COLUMNS.indexOf('税区分')] = extractedInfo.taxCategory || '不明';
    dataRow[SHEET_COLUMNS.indexOf('支払者')] = payerEmail;
    dataRow[SHEET_COLUMNS.indexOf('レシート_ファイル_名称')] = newFileName;
    dataRow[SHEET_COLUMNS.indexOf('レシート_ファイル_パス')] = newFilePath;
    dataRow[SHEET_COLUMNS.indexOf('購入品_内訳')] = extractedInfo.items || '';
    const now = new Date();
    const formattedCreationDateTime = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss');
    dataRow[SHEET_COLUMNS.indexOf('作成日時')] = formattedCreationDateTime;
    dataRow[SHEET_COLUMNS.indexOf('食事該当')] = 'FALSE';
    dataRow[SHEET_COLUMNS.indexOf('経費取消')] = 'FALSE';
    dataRow[SHEET_COLUMNS.indexOf('共有フォルダー格納')] = 'FALSE';
    
    const moveResult = moveFile_(fileObject.id, config.targetFolderId, newFileName);
    let finalFileId = fileObject.id;
    let finalFileWebViewLink = metadata.webViewLink || '';

    if (moveResult && moveResult.success) {
      finalFileWebViewLink = moveResult.movedFileWebViewLink;
      Logger.log(`情報 [${FN}]: ファイル [${originalFileNameForCatch}] をリネームし、移動成功。新ID [${finalFileId}]`);
    } else {
      Logger.log(`警告 [${FN}]: ファイル [${originalFileNameForCatch}] の移動失敗。${moveResult ? moveResult.error : '不明なエラー'}`);
    }

    dataRow[SHEET_COLUMNS.indexOf('レシート_ファイル_ID')] = finalFileId;
    dataRow[SHEET_COLUMNS.indexOf('レシート_ファイル_URL')] = finalFileWebViewLink;

    const appendSuccess = appendDataToSpreadsheet_(config.spreadsheetId, config.sheetName, dataRow);
    if (appendSuccess) {
      existingIds.add(uniqueId);
      existingData.push(dataRow);
      Logger.log(`情報 [${FN}]: ファイル [${originalFileNameForCatch}] (処理後ID: ${finalFileId}) 情報記録成功。シート内ID: ${uniqueId}`);
      return {
        status: 'processed',
        payerEmail: payerEmail,
        usageMetadata: usageMetadata,  // API使用量情報を追加
        data: {
          fileName: newFileName,
          date: paymentDate,
          storeName: storeName,
          amount: totalAmount
        }
      };
    } else {
      Logger.log(`エラー [${FN}]: ファイル [${originalFileNameForCatch}] 情報記録失敗。`);
      return { status: 'error', payerEmail: payerEmail, usageMetadata: usageMetadata };
    }

  } catch (error) {
    Logger.log(`エラー [${FN}]: ファイル [${fileObject.id}] (${originalFileNameForCatch}) 処理中例外: ${error}\n${error.stack}`);
    return null;
  } finally {
    Logger.log(`--------------------`);
  }
}

// ★追加: 重複チェック関数
/*******************************************************************************
* 指定されたデータがスプレッドシートに既に存在するかチェックする
*******************************************************************************/
// ★変更点: 日付、時刻、金額の比較方法をより厳密で確実な方式に改良
function isDuplicateEntry_(date, time, amount, payer, existingData) {
  const FN = 'isDuplicateEntry_';
  try {
    if (!date || date.toLowerCase() === '不明') {
      return false; // 日付がなければ比較対象外
    }

    // --- 比較元となる新しいデータの値を正規化 ---
    const newAmount = Number(amount);
    const newPayer = payer;
    const newTime = time || ''; // 時間が空文字列の場合もあるため

    // 新しい日付をタイムスタンプに変換（時刻を0にリセットして日付のみで比較）
    const newDateObj = new Date(date);
    newDateObj.setHours(0, 0, 0, 0);
    const newDateTimestamp = newDateObj.getTime();

    // --- スプレッドシートの既存データと比較 ---
    for (const row of existingData) {
      // 1. 支払者を比較（違うなら次の行へ）
      const existingPayer = row[PAYER_COLUMN_INDEX];
      if (existingPayer !== newPayer) {
        continue;
      }

      // 2. 金額を数値として比較（違うなら次の行へ）
      const existingAmount = Number(row[AMOUNT_COLUMN_INDEX]);
      if (existingAmount !== newAmount) {
        continue;
      }

      // 3. 日付をタイムスタンプで比較（違うなら次の行へ）
      const existingDateValue = row[DATE_COLUMN_INDEX];
      if (!existingDateValue) {
        continue;
      }
      const existingDateObj = new Date(existingDateValue);
      existingDateObj.setHours(0, 0, 0, 0);
      const existingDateTimestamp = existingDateObj.getTime();

      if (existingDateTimestamp !== newDateTimestamp) {
        continue;
      }
      
      // 4. 時刻を比較（書式を揃えてから比較）
      let existingTime = '';
      const existingTimeValue = row[TIME_COLUMN_INDEX];
      if (existingTimeValue) {
        if (existingTimeValue instanceof Date) {
          // セルの書式が「時刻」の場合、Dateオブジェクトになっているため文字列に変換
          existingTime = Utilities.formatDate(existingTimeValue, Session.getScriptTimeZone(), 'HH:mm');
        } else {
          // それ以外（文字列など）の場合
          existingTime = String(existingTimeValue);
        }
      }
      
      if (existingTime !== newTime) {
        continue;
      }

      // ここまで到達した場合、全ての条件が一致＝重複と判断
      Logger.log(`情報 [${FN}]: 重複データを発見。Date: ${date}, Time: ${time}, Amount: ${amount}, Payer: ${payer}`);
      return true;
    }

    // ループが終了しても一致するものがなければ、重複なし
    return false;

  } catch (e) {
    Logger.log(`エラー [${FN}]: 重複チェック中に例外発生: ${e.message}\n${e.stack}`);
    return false; // エラー時は処理を続行させる
  }
}

/*******************************************************************************
* 設定関連ヘルパー関数
*******************************************************************************/
function setScriptProperties_() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty(PROP_KEYS.RECEIPT_FOLDER_ID, 'YOUR_PERSONAL_RECEIPT_FOLDER_ID');
  scriptProperties.setProperty(PROP_KEYS.TARGET_FOLDER_ID, 'YOUR_PERSONAL_TARGET_FOLDER_ID');
  scriptProperties.setProperty(PROP_KEYS.CORPORATE_RECEIPT_FOLDER_ID, 'YOUR_CORPORATE_RECEIPT_FOLDER_ID');
  scriptProperties.setProperty(PROP_KEYS.CORPORATE_TARGET_FOLDER_ID, 'YOUR_CORPORATE_TARGET_FOLDER_ID');
  scriptProperties.setProperty(PROP_KEYS.SPREADSHEET_ID, 'YOUR_SPREADSHEET_ID');
  scriptProperties.setProperty(PROP_KEYS.SHEET_NAME, '経費');

  Logger.log('スクリプトプロパティを設定しました。');
}

function getScriptProperties_() {
  const FN = 'getScriptProperties_';
  const props = PropertiesService.getScriptProperties().getProperties();
  const baseRequiredKeys = [
    PROP_KEYS.SPREADSHEET_ID, PROP_KEYS.SHEET_NAME,
  ];

  for (const key of baseRequiredKeys) {
    if (!props[key] || props[key].startsWith('YOUR_')) {
      Logger.log(`エラー [${FN}]: 必須プロパティ '${key}' 未設定または初期値。setScriptProperties_を実行し設定要。`);
      return null;
    }
  }

  Logger.log(`情報 [${FN}]: スクリプトプロパティ正常読み込み。`);
  return {
    receiptFolderId: props[PROP_KEYS.RECEIPT_FOLDER_ID],
    targetFolderId: props[PROP_KEYS.TARGET_FOLDER_ID],
    corporateReceiptFolderId: props[PROP_KEYS.CORPORATE_RECEIPT_FOLDER_ID],
    corporateTargetFolderId: props[PROP_KEYS.CORPORATE_TARGET_FOLDER_ID],
    spreadsheetId: props[PROP_KEYS.SPREADSHEET_ID],
    sheetName: props[PROP_KEYS.SHEET_NAME]
  };
}

/**
 * 実行時間計測クラス
 */
class ExecutionTimer {
  constructor() {
    this.startTime = new Date();
  }
  
  getElapsedSeconds() {
    const endTime = new Date();
    return ((endTime - this.startTime) / 1000).toFixed(2);
  }
}

/**
 * 実行ログを記録
 */
function logToExecutionSheet(scriptName, status, requestId, details = {}) {
  try {
    const sheet = SpreadsheetApp.openById(EXECUTION_LOG_SPREADSHEET_ID)
      .getSheetByName(EXECUTION_LOG_SHEET_NAME);

    if (!sheet) {
      Logger.log(`警告: 実行ログシート "${EXECUTION_LOG_SHEET_NAME}" が見つかりません`);
      return;
    }

    const timestamp = new Date();
    const row = [
      Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss'),
      scriptName,
      status,
      requestId || '',
      details.summary || '',
      details.errorMessage || '',
      details.user || Session.getActiveUser().getEmail(),
      details.processingTime || '',
      'Vertex AI',  // APIタイプ
      details.modelName || GEMINI_MODEL,
      `Input: ${details.inputTokens || 0}, Output: ${details.outputTokens || 0}`,  // トークン数
      details.responseSize || '',
      details.inputSummary || '',
      details.outputSummary || '',
      `API呼び出し: ${details.apiCallCount || 0}回, 合計コスト: ¥${details.totalCost || '0.00'}`  // コスト情報
    ];

    sheet.appendRow(row);

  } catch (e) {
    Logger.log(`エラー: ログ記録失敗 - ${e.message}`);
  }
}

/*******************************************************************************
* Google Drive API 関連ヘルパー関数 (変更なし)
*******************************************************************************/
function getFilesInFolder_(folderId) {
  const FN = 'getFilesInFolder_';
  try {
    const folder = DriveApp.getFolderById(folderId);
    const fileIterator = folder.getFiles();
    const files = [];
    while (fileIterator.hasNext()) {
      files.push(fileIterator.next());
    }
    Logger.log(`情報 [${FN}]: フォルダ [${folderId}] から ${files.length} 件取得。`);
    return files;
  } catch (e) {
    Logger.log(`エラー [${FN}]: フォルダ [${folderId}] 内のファイル取得中に例外: ${e}\n${e.stack}`);
    return null;
  }
}

/*******************************************************************************
* Google Drive API 関連ヘルパー関数
*******************************************************************************/
// ★変更点: Drive拡張サービスの使用をやめ、Drive API v3を直接呼び出す方式に変更
function getFileMetadata_(fileId) {
  const FN = 'getFileMetadata_';
  try {
    // スクリプトを実行するユーザーの認証トークンを取得
    const token = ScriptApp.getOAuthToken();
    
    // Drive API v3のエンドポイントURLを構築。fieldsにご要望の 'lastModifyingUser' と 'name' を指定
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,parents,lastModifyingUser,webViewLink&supportsAllDrives=true`;

    const options = {
      method: 'get',
      headers: {
        // 認証トークンをヘッダーに含める
        'Authorization': 'Bearer ' + token
      },
      muteHttpExceptions: true // エラー時に例外を発生させず、レスポンス内容を確認する
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      // 成功した場合、JSON形式のレスポンスをパースして返す
      return JSON.parse(response.getContentText());
    } else {
      // 失敗した場合、エラーログを出力してnullを返す
      Logger.log(`エラー [${FN}]: Drive API v3でのメタデータ取得失敗。FileID: ${fileId}, Status: ${responseCode}, Response: ${response.getContentText()}`);
      return null;
    }
  } catch (e) {
    Logger.log(`エラー [${FN}]: Drive API v3呼び出し中に例外発生。FileID: ${fileId}, Error: ${e.message}`);
    return null;
  }
}
function getDriveFileContentAsBase64_(fileId) {
  const FN = 'getDriveFileContentAsBase64_';
  try {
    const file = DriveApp.getFileById(fileId);
    return Utilities.base64Encode(file.getBlob().getBytes());
  } catch (e) {
    Logger.log(`エラー [${FN}]: DriveAppでの内容取得失敗。FileID: ${fileId}, Error: ${e.message}`);
    return null;
  }
}

function moveFile_(originalFileId, targetParentFolderId, newFileName) {
  const FN = 'moveFile_';
  Logger.log(`情報 [${FN}]: ファイル [${originalFileId}] をフォルダ [${targetParentFolderId}] へ移動開始。新ファイル名: ${newFileName}`);
  try {
    const file = DriveApp.getFileById(originalFileId);
    const targetFolder = DriveApp.getFolderById(targetParentFolderId);

    file.setName(newFileName);
    Logger.log(`情報 [${FN}]: ファイル [${originalFileId}] の名称を「${newFileName}」に変更。`);

    file.moveTo(targetFolder);
    Logger.log(`情報 [${FN}]: ファイル [${originalFileId}] をフォルダ [${targetFolder.getName()}] へ移動成功。`);

    return {
      success: true,
      movedFileId: file.getId(),
      movedFileWebViewLink: file.getUrl()
    };
  } catch (e) {
    Logger.log(`エラー [${FN}]: ファイルのリネームまたは移動中に例外発生: ${e.message}\n${e.stack}`);
    return { success: false, error: e.message };
  }
}

/*******************************************************************************
* Google Sheets API 関連ヘルパー関数
* ★変更点: getExistingIdsFromSheet_ を getExistingDataFromSheet_ に変更
*******************************************************************************/
function appendDataToSpreadsheet_(spreadsheetId, sheetName, dataRow) {
  const FN = 'appendDataToSpreadsheet_';
  try {
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
    if (!sheet) {
      Logger.log(`エラー [${FN}]: シート [${sheetName}] が見つかりません。`);
      return false;
    }
    sheet.appendRow(dataRow);
    Logger.log(`情報 [${FN}]: スプレッドシートへのデータ追記成功。`);
    return true;
  } catch (e) {
    Logger.log(`エラー [${FN}]: スプレッドシートへの追記中に例外発生: ${e.message}\n${e.stack}`);
    return false;
  }
}

function getExistingDataFromSheet_(spreadsheetId, sheetName) {
  const FN = 'getExistingDataFromSheet_';
  if (ID_COLUMN_INDEX < 0) {
    Logger.log(`エラー [${FN}]: 列定義に 'ID' が見つかりません。`);
    return { existingIds: null, existingData: null };
  }
  try {
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) {
      Logger.log(`情報 [${FN}]: シート [${sheetName}] が存在しないかデータが空のため、既存データは0件です。`);
      return { existingIds: new Set(), existingData: [] };
    }
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    // 全データを取得
    const allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    // IDのSetを生成
    const idColumnValues = allData.map(row => row[ID_COLUMN_INDEX]).filter(String);
    const existingIds = new Set(idColumnValues);

    Logger.log(`情報 [${FN}]: スプレッドシートから ${existingIds.size} 件の既存IDと ${allData.length} 件のデータを取得。`);
    return { existingIds, existingData: allData };
  } catch (e) {
    Logger.log(`エラー [${FN}]: スプレッドシートからの既存データ取得中に例外発生: ${e.message}\n${e.stack}`);
    return { existingIds: null, existingData: null };
  }
}


/*******************************************************************************
* Gemini API 関連ヘルパー関数
*******************************************************************************/
function extractInfoWithGemini_(fileContentBase64, mimeType, originalFileName) {
  const FN = 'extractInfoWithGemini_';
  // ★★★ Vertex AI APIエンドポイント（OAuth2認証） ★★★
  const url = GEMINI_API_ENDPOINT;

  const promptText = `あなたは経費精算の専門家です。添付されたレシート（または請求書PDF）から以下の情報を抽出し、指定されたJSON形式で厳密に回答してください。JSON以外のテキスト（説明文、マークダウンなど）は一切含めないでください。駐車場代については、必ず旅費交通費としてください。\n\n抽出項目:\n- 年月日 (YYYY-MM-DD形式)\n- 時間 (HH:MM形式, 24時間表記)\n- 支払先 (店舗名のみ、支店名は含めない)\n- 支払先_支店名 (店舗の支店名、なければ空文字列 "")\n- 支払金額 (数値のみ、通貨記号やカンマなし。整数または小数点付き数値)\n- 購入品_内訳 (品目と金額を改行(\\n)区切りで記述。例: "食料品 500\\n雑貨 300")\n- 支払方法 (「現金」「クレジットカード」「電子マネー」など、具体的な支払い手段を文字列で記述)\n- 勘定科目 (以下のリストから最も適切なものを1つ選択):\n ${ACCOUNT_TITLES.join(', ')}\n- 税区分 (以下のリストから最も適切なものを1つ選択):\n ${TAX_CATEGORIES.join(', ')}\n\n勘定科目リスト:\n${ACCOUNT_TITLES.join('\n')}\n\n税区分リスト:\n${TAX_CATEGORIES.join('\n')}\n\n出力形式 (JSONのみ):\n{\n "date": "YYYY-MM-DD",\n "time": "HH:MM",\n "storeName": "支払先",\n "storeBranchName": "支払先_支店名",\n "totalAmount": 金額 (数値),\n "items": "購入品_内訳",\n "paymentMethod": "支払方法",\n "accountTitle": "勘定科目",\n "taxCategory": "税区分"\n}\n\n情報が読み取れない場合は、該当項目に "不明" または空文字列 "" を入れてください。\n支払金額は必ず数値で返してください。 カンマは含めないでください。\n元のファイル名は ${originalFileName} です。`;

  const payload = JSON.stringify({ contents: [ { parts: [ { text: promptText }, { inline_data: { mime_type: mimeType, data: fileContentBase64 } } ] } ], });
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${ScriptApp.getOAuthToken()}` },
    payload: payload,
    muteHttpExceptions: true
  };
  try {
    Logger.log(`情報 [${FN}]: Vertex AI 呼び出し: ${GEMINI_API_ENDPOINT}`);
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    if (responseCode === 200) {
      try {
        const result = JSON.parse(responseBody);
        if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0] && result.candidates[0].content.parts[0].text) {
          let jsonText = result.candidates[0].content.parts[0].text;
          Logger.log(`デバッグ [${FN}]: Vertex AI Raw Text: [\n${jsonText}\n]`);
          const jsonMatch = jsonText.match(/```(json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[2]) jsonText = jsonMatch[2];
          else Logger.log(`警告 [${FN}]: Vertex AIレスポンスからMarkdownコードブロックマーカーが見つかりませんでした。`);
          jsonText = jsonText.trim();
          Logger.log(`デバッグ [${FN}]: Processed JSON Text for parsing (length: ${jsonText.length}): [\n${jsonText}\n]`);

          try {
            const parsedData = JSON.parse(jsonText);

            // usageMetadataを抽出してコスト計算
            const usageMetadata = extractVertexAIUsageMetadata_(result, GEMINI_MODEL, 'image');

            // パース済みデータにusageMetadataを追加して返す
            return {
              data: parsedData,
              usageMetadata: usageMetadata
            };

          } catch (parseError) {
            const errorMsg = `Vertex AIレスポンスJSONパース失敗。Error: ${parseError.message}`;
            Logger.log(`エラー [${FN}]: ${errorMsg}`);

            // ログに記録
            logToExecutionSheet('Automation_レシート', '警告', '', {
              summary: `JSONパース失敗: ${originalFileName}`,
              errorMessage: errorMsg,
              inputSummary: `ファイル: ${originalFileName}`,
              notes: `レスポンステキスト: ${jsonText.substring(0, 200)}...`
            });

            if(result.candidates[0].finishReason) Logger.log(`警告 [${FN}]: Vertex AI Finish Reason: ${result.candidates[0].finishReason}`);
            if(result.candidates[0].safetyRatings) Logger.log(`警告 [${FN}]: Vertex AI Safety Ratings: ${JSON.stringify(result.candidates[0].safetyRatings)}`);
            return null;
          }
        } else {
          Logger.log(`エラー [${FN}]: Vertex AIレスポンス構造不正。Resp: ${responseBody}`);
          if(result.candidates && result.candidates[0] && result.candidates[0].finishReason) Logger.log(`警告 [${FN}]: Vertex AI Finish Reason: ${result.candidates[0].finishReason}`);
          if(result.candidates && result.candidates[0].safetyRatings) Logger.log(`警告 [${FN}]: Vertex AI Safety Ratings: ${JSON.stringify(result.candidates[0].safetyRatings)}`);
          return null;
        }
      } catch (outerParseError) {
        Logger.log(`エラー [${FN}]: Vertex AIレスポンス全体JSONパース失敗。Resp Body: ${responseBody}, Error: ${outerParseError}`);
        return null;
      }
    } else {
      Logger.log(`エラー [${FN}]: Vertex AI呼び出し失敗。Status: ${responseCode}, Resp: ${responseBody}, Payload size: ${payload.length} bytes`);
      return null;
    }
  } catch (e) {
    Logger.log(`エラー [${FN}]: Vertex AI呼び出し中例外: ${e}\n${e.stack}`);
    return null;
  }
}

/**
 * Vertex AI APIレスポンスからusageMetadataを抽出（日本円計算付き）
 * @param {Object} jsonResponse - APIレスポンス
 * @param {string} modelName - 使用したモデル名
 * @param {string} inputType - 入力タイプ ('image' | 'text')
 * @return {Object|null} {inputTokens, outputTokens, inputCostJPY, outputCostJPY, totalCostJPY, model}
 */
function extractVertexAIUsageMetadata_(jsonResponse, modelName, inputType = 'image') {
  if (!jsonResponse.usageMetadata) {
    return null;
  }

  const usage = jsonResponse.usageMetadata;
  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = usage.candidatesTokenCount || 0;

  // モデル名と入力タイプに応じた価格を取得
  const pricing = getVertexAIPricing_(modelName, inputType);
  const inputCostUSD = (inputTokens / 1000000) * pricing.inputPer1M;
  const outputCostUSD = (outputTokens / 1000000) * pricing.outputPer1M;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  // 日本円に換算
  const inputCostJPY = inputCostUSD * EXCHANGE_RATE_USD_TO_JPY;
  const outputCostJPY = outputCostUSD * EXCHANGE_RATE_USD_TO_JPY;
  const totalCostJPY = totalCostUSD * EXCHANGE_RATE_USD_TO_JPY;

  Logger.log(`[API使用量] モデル: ${modelName}, Input: ${inputTokens}tokens, Output: ${outputTokens}tokens, 合計: ¥${totalCostJPY.toFixed(2)}`);

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
 * Vertex AIモデルの価格情報を取得（モデル名と入力タイプに応じて動的に決定）
 * @param {string} modelName - モデル名
 * @param {string} inputType - 入力タイプ ('image' | 'text')
 * @return {Object} {inputPer1M, outputPer1M}
 */
function getVertexAIPricing_(modelName, inputType = 'text') {
  // 2025年1月時点のVertex AI価格（USD/100万トークン）
  const pricingTable = {
    'gemini-2.5-flash': {
      text: { inputPer1M: 0.075, outputPer1M: 0.30 },
      image: { inputPer1M: 1.00, outputPer1M: 2.50 }  // 画像・PDF入力
    },
    'gemini-2.5-flash-lite': {
      text: { inputPer1M: 0.01, outputPer1M: 0.04 },
      image: { inputPer1M: 0.10, outputPer1M: 0.40 }  // 画像・PDF入力
    },
    'gemini-2.5-pro': {
      text: { inputPer1M: 1.25, outputPer1M: 10.00 },
      image: { inputPer1M: 1.25, outputPer1M: 10.00 }
    },
    'gemini-1.5-flash': {
      text: { inputPer1M: 0.075, outputPer1M: 0.30 },
      image: { inputPer1M: 0.075, outputPer1M: 0.30 }
    },
    'gemini-1.5-pro': {
      text: { inputPer1M: 1.25, outputPer1M: 5.00 },
      image: { inputPer1M: 1.25, outputPer1M: 5.00 }
    }
  };

  // モデル名を正規化
  const normalizedModelName = normalizeModelName_(modelName);

  // モデルが見つからない場合はデフォルト価格を使用
  if (!pricingTable[normalizedModelName]) {
    Logger.log(`[価格取得] ⚠️ 未知のモデル: ${modelName}, デフォルト価格（gemini-2.5-flash-lite）を使用`);
    return pricingTable['gemini-2.5-flash-lite'][inputType] || pricingTable['gemini-2.5-flash-lite']['text'];
  }

  // 入力タイプが見つからない場合はテキスト価格を使用
  if (!pricingTable[normalizedModelName][inputType]) {
    Logger.log(`[価格取得] ⚠️ 未知の入力タイプ: ${inputType}, テキスト価格を使用`);
    return pricingTable[normalizedModelName]['text'];
  }

  Logger.log(`[価格取得] モデル: ${normalizedModelName}, 入力タイプ: ${inputType}, Input: $${pricingTable[normalizedModelName][inputType].inputPer1M}/1M, Output: $${pricingTable[normalizedModelName][inputType].outputPer1M}/1M`);
  return pricingTable[normalizedModelName][inputType];
}

/**
 * モデル名を正規化（バージョン番号やプレフィックスを削除）
 * @param {string} modelName - モデル名
 * @return {string} 正規化されたモデル名
 */
function normalizeModelName_(modelName) {
  // 'gemini-2.5-flash-001' → 'gemini-2.5-flash'
  // 'gemini-2.5-flash-lite-001' → 'gemini-2.5-flash-lite'
  const match = modelName.match(/(gemini-[\d.]+-(?:flash-lite|flash|pro))/i);
  return match ? match[1].toLowerCase() : modelName.toLowerCase();
}

/*******************************************************************************
* その他のヘルパー関数 (変更なし)
*******************************************************************************/
function generateUniqueId_(existingIds) {
  const FN = 'generateUniqueId_';
  let newId, attempts = 0;
  do {
    newId = Utilities.getUuid().substring(0, ID_LENGTH);
    attempts++;
    if (attempts > MAX_ID_GENERATION_ATTEMPTS) {
      Logger.log(`エラー [${FN}]: ユニークID生成失敗(${MAX_ID_GENERATION_ATTEMPTS}回)。既存ID数: ${existingIds.size}`);
      throw new Error(`Failed to generate unique ID after ${MAX_ID_GENERATION_ATTEMPTS} attempts.`);
    }
  } while (existingIds.has(newId));
  Logger.log(`情報 [${FN}]: 新ユニークID生成: ${newId} (${attempts}回試行)`);
  return newId;
}

function determineTimeOfDay_(timeString) {
  if (!timeString || !/^\d{1,2}:\d{2}$/.test(timeString)) return '不明';
  try {
    const hour = parseInt(timeString.split(':')[0], 10);
    if (isNaN(hour) || hour < 0 || hour > 23) return '不明';
    return (hour >= 10 && hour < 16) ? '昼' : '夕';
  } catch (e) {
    Logger.log(`エラー [determineTimeOfDay_]: 時間判定中エラー。timeString=${timeString}, Error=${e}`);
    return '不明';
  }
}

/**
 * レシート処理結果をHTMLメールで送信
 * @param {string} email - 送信先メールアドレス
 * @param {Object} results - 処理結果 {processed: [], skipped: []}
 * @param {number} totalAmount - レシート総額
 * @param {string} processingType - 処理タイプ（'personal' or 'corporate'）
 */
function sendReceiptSummaryEmail_(email, results, totalAmount, processingType) {
  const FN = 'sendReceiptSummaryEmail_';

  try {
    const processedCount = results.processed.length;
    const skippedCount = results.skipped.length;
    const processingTypeJP = processingType === 'corporate' ? '法人' : '個人';

    // 支払先別の集計
    const storeBreakdown = {};
    results.processed.forEach(receipt => {
      const storeName = receipt.storeName || '不明';
      if (!storeBreakdown[storeName]) {
        storeBreakdown[storeName] = { count: 0, amount: 0 };
      }
      storeBreakdown[storeName].count++;
      storeBreakdown[storeName].amount += receipt.amount || 0;
    });

    // 当月の合計金額をスプレッドシートから取得
    const monthlyTotal = getMonthlyTotalForUser_(email, processingType);

    // HTML本文を生成
    const htmlBody = generateReceiptEmailHTML_(
      processingTypeJP,
      processedCount,
      skippedCount,
      totalAmount,
      monthlyTotal,
      storeBreakdown,
      results.processed
    );

    // メール送信
    const subject = `【F経費】レシート処理完了通知 (${processingTypeJP}・${processedCount}件)`;

    GmailApp.sendEmail(email, subject, '', {
      htmlBody: htmlBody,
      name: 'F経費'
    });

    Logger.log(`情報 [${FN}]: メール送信成功 - 宛先: ${email}`);

  } catch (e) {
    Logger.log(`エラー [${FN}]: メール送信失敗 - ${e.message}\n${e.stack}`);
  }
}

/**
 * スプレッドシートから当該月のユーザーの合計金額を取得
 * @param {string} userEmail - ユーザーのメールアドレス
 * @param {string} processingType - 処理タイプ（'personal' or 'corporate'）
 * @return {number} 当月の合計金額
 */
function getMonthlyTotalForUser_(userEmail, processingType) {
  const FN = 'getMonthlyTotalForUser_';

  try {
    const props = getScriptProperties_();
    if (!props) {
      Logger.log(`警告 [${FN}]: スクリプトプロパティ取得失敗`);
      return 0;
    }

    const sheet = SpreadsheetApp.openById(props.spreadsheetId).getSheetByName(props.sheetName);
    if (!sheet) {
      Logger.log(`警告 [${FN}]: シート取得失敗`);
      return 0;
    }

    // 当月の年月を取得（YYYY-MM形式）
    const now = new Date();
    const currentMonth = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');

    const values = sheet.getDataRange().getValues();
    const headers = values.shift();

    // 必要な列のインデックスを取得
    const payerIndex = headers.indexOf('支払者');
    const amountIndex = headers.indexOf('支払金額');
    const dateIndex = headers.indexOf('年月日');
    const divisionIndex = headers.indexOf('区分');

    if (payerIndex === -1 || amountIndex === -1 || dateIndex === -1) {
      Logger.log(`警告 [${FN}]: 必要な列が見つかりません`);
      return 0;
    }

    const targetDivision = processingType === 'corporate' ? '法人' : '個人';
    let monthlyTotal = 0;

    values.forEach(row => {
      const rowDate = row[dateIndex];
      const rowPayer = row[payerIndex];
      const rowDivision = row[divisionIndex];
      const rowAmount = parseFloat(row[amountIndex]) || 0;

      // 日付を YYYY-MM 形式に変換
      if (rowDate && rowPayer === userEmail && rowDivision === targetDivision) {
        const rowMonth = Utilities.formatDate(new Date(rowDate), Session.getScriptTimeZone(), 'yyyy-MM');
        if (rowMonth === currentMonth) {
          monthlyTotal += rowAmount;
        }
      }
    });

    Logger.log(`情報 [${FN}]: ユーザー ${userEmail} の当月合計: ¥${monthlyTotal.toLocaleString()}`);
    return monthlyTotal;

  } catch (e) {
    Logger.log(`エラー [${FN}]: ${e.message}\n${e.stack}`);
    return 0;
  }
}

/**
 * レシート処理結果のHTMLメール本文を生成
 */
function generateReceiptEmailHTML_(processingType, processedCount, skippedCount, totalAmount, monthlyTotal, storeBreakdown, receipts) {
  // 支払先別の内訳HTML
  let storeBreakdownHTML = '';
  const sortedStores = Object.entries(storeBreakdown).sort((a, b) => b[1].amount - a[1].amount);

  sortedStores.forEach(([storeName, data]) => {
    storeBreakdownHTML += `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${storeName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${data.count}件</td>
        <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: 600;">¥${data.amount.toLocaleString()}</td>
      </tr>`;
  });

  // 処理済みレシート一覧HTML
  let receiptListHTML = '';
  receipts.forEach((receipt, index) => {
    receiptListHTML += `
      <tr style="background-color: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'};">
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${receipt.date || '不明'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${receipt.storeName || '不明'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: 500;">¥${(receipt.amount || 0).toLocaleString()}</td>
      </tr>`;
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>レシート処理完了通知</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 650px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">

    <!-- ヘッダー -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">F経費</h1>
      <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.95;">レシート処理完了通知</p>
    </div>

    <!-- サマリーセクション -->
    <div style="padding: 30px;">
      <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #2d3748; font-weight: 600;">処理サマリー（${processingType}）</h2>

        <div style="display: flex; justify-content: space-around; text-align: center; margin-bottom: 20px;">
          <div style="flex: 1;">
            <div style="font-size: 32px; font-weight: 700; color: #667eea; margin-bottom: 6px;">${processedCount}</div>
            <div style="font-size: 13px; color: #718096; font-weight: 500;">処理完了</div>
          </div>
          <div style="flex: 1; border-left: 2px solid rgba(0,0,0,0.1); border-right: 2px solid rgba(0,0,0,0.1);">
            <div style="font-size: 32px; font-weight: 700; color: #48bb78; margin-bottom: 6px;">¥${totalAmount.toLocaleString()}</div>
            <div style="font-size: 13px; color: #718096; font-weight: 500;">レシート総額</div>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 32px; font-weight: 700; color: #f56565; margin-bottom: 6px;">${skippedCount}</div>
            <div style="font-size: 13px; color: #718096; font-weight: 500;">重複スキップ</div>
          </div>
        </div>

        <!-- 当月合計 -->
        <div style="background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%); border-radius: 8px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="font-size: 14px; color: #2d3748; font-weight: 600; margin-bottom: 8px;">📊 当月合計（${processingType}）</div>
          <div style="font-size: 40px; font-weight: 700; color: #d63031; margin-bottom: 4px;">¥${monthlyTotal.toLocaleString()}</div>
          <div style="font-size: 12px; color: #636e72; font-weight: 500;">スプレッドシート集計値</div>
        </div>
      </div>

      <!-- 支払先別内訳 -->
      ${sortedStores.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #2d3748; font-weight: 600; border-bottom: 2px solid #667eea; padding-bottom: 8px;">支払先別内訳</h3>
        <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <thead>
            <tr style="background-color: #667eea; color: #ffffff;">
              <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 14px;">支払先</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; font-size: 14px;">件数</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; font-size: 14px;">金額</th>
            </tr>
          </thead>
          <tbody style="background-color: #ffffff;">
            ${storeBreakdownHTML}
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- レシート一覧 -->
      ${receipts.length > 0 ? `
      <div>
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #2d3748; font-weight: 600; border-bottom: 2px solid #667eea; padding-bottom: 8px;">処理済みレシート一覧</h3>
        <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <thead>
            <tr style="background-color: #667eea; color: #ffffff;">
              <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 14px;">日付</th>
              <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 14px;">支払先</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; font-size: 14px;">金額</th>
            </tr>
          </thead>
          <tbody>
            ${receiptListHTML}
          </tbody>
        </table>
      </div>
      ` : ''}
    </div>

    <!-- フッター -->
    <div style="background-color: #f7fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; font-size: 13px; color: #718096;">
        このメールは自動送信されています。<br>
        <span style="font-weight: 600; color: #667eea;">F経費</span> powered by Vertex AI
      </p>
    </div>

  </div>
</body>
</html>
  `;
}
