/*******************************************************************************
* 設定・定数
*******************************************************************************/
// スクリプトプロパティキー
const PROP_KEYS = {
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  RECEIPT_FOLDER_ID: 'RECEIPT_FOLDER_ID',
  TARGET_FOLDER_ID: 'TARGET_FOLDER_ID',
  CORPORATE_RECEIPT_FOLDER_ID: 'CORPORATE_RECEIPT_FOLDER_ID',
  CORPORATE_TARGET_FOLDER_ID: 'CORPORATE_TARGET_FOLDER_ID',
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  SHEET_NAME: 'SHEET_NAME',
};

// APIエンドポイント (Geminiのみ)
const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

// Gemini APIがサポートするMIMEタイプ
const SUPPORTED_MIME_TYPES = [ 'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif' ];

// メール送付用の定数
const EXPENSE_APP_URL = 'https://www.appsheet.com/start/2b3450d2-a819-426e-a853-8517371cf6d7';

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
  Logger.log(`情報 [${FN}]: 個人用レシート処理を開始します。`);
  const props = getScriptProperties_();
  if (!props) return;

  const config = {
    geminiApiKey: props.geminiApiKey,
    sourceFolderId: props.receiptFolderId,
    targetFolderId: props.targetFolderId,
    spreadsheetId: props.spreadsheetId,
    sheetName: props.sheetName,
  };

  if (!config.sourceFolderId || config.sourceFolderId.startsWith('YOUR_')) {
    Logger.log(`エラー [${FN}]: 個人用のレシートフォルダID (RECEIPT_FOLDER_ID) が正しく設定されていません。`);
    return;
  }
  if (!config.targetFolderId || config.targetFolderId.startsWith('YOUR_')) {
    Logger.log(`エラー [${FN}]: 個人用の移動先フォルダID (TARGET_FOLDER_ID) が正しく設定されていません。`);
    return;
  }
  processReceiptsByType_(config, "personal");
}

/*******************************************************************************
* メイン処理 (法人用)
*******************************************************************************/
function mainProcessCorporateReceipts() {
  const FN = 'mainProcessCorporateReceipts';
  Logger.log(`情報 [${FN}]: 法人用レシート処理を開始します。`);
  const props = getScriptProperties_();
  if (!props) return;

  const config = {
    geminiApiKey: props.geminiApiKey,
    sourceFolderId: props.corporateReceiptFolderId,
    targetFolderId: props.corporateTargetFolderId,
    spreadsheetId: props.spreadsheetId,
    sheetName: props.sheetName,
  };

  if (!config.sourceFolderId || config.sourceFolderId.startsWith('YOUR_')) {
    Logger.log(`エラー [${FN}]: 法人用のレシートフォルダID (CORPORATE_RECEIPT_FOLDER_ID) が正しく設定されていません。`);
    return;
  }
  if (!config.targetFolderId || config.targetFolderId.startsWith('YOUR_')) {
    Logger.log(`エラー [${FN}]: 法人用の移動先フォルダID (CORPORATE_TARGET_FOLDER_ID) が正しく設定されていません。`);
    return;
  }
  processReceiptsByType_(config, "corporate");
}


/*******************************************************************************
* 共通レシート処理ロジック
* ★変更点: 処理結果をユーザーごとに集計し、最後にメールを送信するロジックを追加
*******************************************************************************/
function processReceiptsByType_(config, processingType) {
  const FN = 'processReceiptsByType_';
  Logger.log(`情報 [${FN}]: タイプ '${processingType}' の処理を開始。ソースフォルダ: ${config.sourceFolderId}`);

  // ★変更点: IDだけでなくシートの全データを取得
  const { existingIds, existingData } = getExistingDataFromSheet_(config.spreadsheetId, config.sheetName);
  if (existingIds === null) return;
  Logger.log(`情報 [${FN}]: ${existingIds.size} 件の既存ID、${existingData.length} 件の既存データを取得しました。`);

  const files = getFilesInFolder_(config.sourceFolderId);
  if (!files || files.length === 0) {
    Logger.log(`情報 [${FN}]: フォルダ [${config.sourceFolderId}] 内に処理対象ファイルはありませんでした。`);
    return;
  }
  Logger.log(`情報 [${FN}]: フォルダ [${config.sourceFolderId}] 内に ${files.length} 件のファイルが見つかりました。`);

  // ★追加: ユーザーごとの処理結果を格納するオブジェクト
  const processedResultsByUser = {};

  for (const file of files) {
    const result = processSingleFile_(
      { id: file.getId(), name: file.getName() },
      config,
      processingType,
      existingIds,
      existingData // ★変更点: 既存データを渡す
    );

    // ★追加: 処理結果をユーザーごとに集計
    if (result && result.payerEmail) {
      if (!processedResultsByUser[result.payerEmail]) {
        processedResultsByUser[result.payerEmail] = { processed: [], skipped: [] };
      }
      if (result.status === 'processed') {
        processedResultsByUser[result.payerEmail].processed.push(result.data);
      } else if (result.status === 'skipped') {
        processedResultsByUser[result.payerEmail].skipped.push(result.data);
      }
    }
  }

  // ★追加: ユーザーごとに結果をメールで送信
  for (const email in processedResultsByUser) {
    const results = processedResultsByUser[email];
    if (results.processed.length > 0 || results.skipped.length > 0) {
      sendSummaryEmail_(email, results.processed, results.skipped);
    }
  }

  Logger.log(`情報 [${FN}]: タイプ '${processingType}' の全てのファイルの処理が完了しました。`);
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

    const extractedInfo = extractInfoWithGemini_(fileContentBase64, mimeType, originalFileNameForCatch, config.geminiApiKey);
    if (!extractedInfo) {
      Logger.log(`警告 [${FN}]: ファイル [${fileObject.id}] 情報抽出失敗。スキップ。`);
      return null;
    }
    Logger.log(`情報 [${FN}]: ファイル [${fileObject.id}] 情報抽出成功。デバッグ: ${JSON.stringify(extractedInfo)}`);

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
        data: {
          fileName: newFileName,
          date: paymentDate,
          storeName: storeName,
          amount: totalAmount
        }
      };
    } else {
      Logger.log(`エラー [${FN}]: ファイル [${originalFileNameForCatch}] 情報記録失敗。`);
      return { status: 'error', payerEmail: payerEmail };
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

// ★追加: 結果通知メール送信関数
/*******************************************************************************
* 処理結果をまとめたサマリーメールを送信する
*******************************************************************************/
function sendSummaryEmail_(recipientEmail, processedList, skippedList) {
  const FN = 'sendSummaryEmail_';
  try {
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd');
    const subject = `【F経費】レシート取込結果のご連絡 (${today})`;

    let htmlBody = `
      <html>
      <body style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
        <p>${recipientEmail} 様</p>
        <p>本日分のレシートの取り込み処理が完了しましたので、結果をご連絡いたします。</p>
        <p>内容をご確認の上、以下のボタンからF経費アプリで確認・申請処理をお願いいたします。</p>
        <a href="${EXPENSE_APP_URL}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px; margin: 10px 0;">F経費で確認申請する</a>
        <hr>
    `;

    // 正常に取り込まれたレシート
    if (processedList.length > 0) {
      htmlBody += `
        <h2>取り込みに成功したレシート (${processedList.length}件)</h2>
        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
          <tr style="background-color: #f2f2f2;">
            <th>支払日</th>
            <th>支払先</th>
            <th>支払金額</th>
            <th>ファイル名</th>
          </tr>
      `;
      processedList.forEach(item => {
        htmlBody += `
          <tr>
            <td>${item.date || '不明'}</td>
            <td>${item.storeName || '不明'}</td>
            <td style="text-align: right;">${item.amount ? item.amount.toLocaleString() : '0'} 円</td>
            <td>${item.fileName || '不明'}</td>
          </tr>
        `;
      });
      htmlBody += `</table>`;
    }

    // スキップされたレシート
    if (skippedList.length > 0) {
      htmlBody += `
        <h2 style="margin-top: 30px; color: #dc3545;">取り込みがスキップされたレシート (${skippedList.length}件)</h2>
        <p>以下のレシートは、既に同じ内容（支払日、時間、金額、支払者）のデータが存在したため、処理をスキップしました。</p>
        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
          <tr style="background-color: #f2f2f2;">
            <th>元ファイル名</th>
            <th>支払日</th>
            <th>支払金額</th>
          </tr>
      `;
      skippedList.forEach(item => {
        htmlBody += `
          <tr>
            <td>${item.fileName || '不明'}</td>
            <td>${item.date || '不明'}</td>
            <td style="text-align: right;">${item.amount ? item.amount.toLocaleString() : '0'} 円</td>
          </tr>
        `;
      });
      htmlBody += `</table>`;
    }

    htmlBody += `
        <hr style="margin-top: 30px;">
        <p style="font-size: 12px; color: #777;">※このメールはシステムにより自動送信されています。</p>
      </body>
      </html>
    `;

    MailApp.sendEmail({
      to: recipientEmail,
      subject: subject,
      htmlBody: htmlBody
    });

    Logger.log(`情報 [${FN}]: ${recipientEmail} 宛に結果通知メールを送信しました。`);

  } catch (e) {
    Logger.log(`エラー [${FN}]: メール送信中に例外発生: ${e.message}\n${e.stack}`);
  }
}

/*******************************************************************************
* 設定関連ヘルパー関数 (変更なし)
*******************************************************************************/
function setScriptProperties_() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty(PROP_KEYS.GEMINI_API_KEY, 'YOUR_GEMINI_API_KEY');
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
    PROP_KEYS.GEMINI_API_KEY, PROP_KEYS.SPREADSHEET_ID, PROP_KEYS.SHEET_NAME,
  ];

  for (const key of baseRequiredKeys) {
    if (!props[key] || props[key].startsWith('YOUR_')) {
      Logger.log(`エラー [${FN}]: 必須プロパティ '${key}' 未設定または初期値。setScriptProperties_を実行し設定要。`);
      return null;
    }
  }

  Logger.log(`情報 [${FN}]: スクリプトプロパティ正常読み込み。`);
  return {
    geminiApiKey: props[PROP_KEYS.GEMINI_API_KEY],
    receiptFolderId: props[PROP_KEYS.RECEIPT_FOLDER_ID],
    targetFolderId: props[PROP_KEYS.TARGET_FOLDER_ID],
    corporateReceiptFolderId: props[PROP_KEYS.CORPORATE_RECEIPT_FOLDER_ID],
    corporateTargetFolderId: props[PROP_KEYS.CORPORATE_TARGET_FOLDER_ID],
    spreadsheetId: props[PROP_KEYS.SPREADSHEET_ID],
    sheetName: props[PROP_KEYS.SHEET_NAME]
  };
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
* Gemini API 関連ヘルパー関数 (変更なし)
*******************************************************************************/
function extractInfoWithGemini_(fileContentBase64, mimeType, originalFileName, apiKey) {
  const FN = 'extractInfoWithGemini_';
  const url = `${GEMINI_API_ENDPOINT}?key=${apiKey}`;

  const promptText = `あなたは経費精算の専門家です。添付されたレシート（または請求書PDF）から以下の情報を抽出し、指定されたJSON形式で厳密に回答してください。JSON以外のテキスト（説明文、マークダウンなど）は一切含めないでください。駐車場代については、必ず旅費交通費としてください。\n\n抽出項目:\n- 年月日 (YYYY-MM-DD形式)\n- 時間 (HH:MM形式, 24時間表記)\n- 支払先 (店舗名のみ、支店名は含めない)\n- 支払先_支店名 (店舗の支店名、なければ空文字列 "")\n- 支払金額 (数値のみ、通貨記号やカンマなし。整数または小数点付き数値)\n- 購入品_内訳 (品目と金額を改行(\\n)区切りで記述。例: "食料品 500\\n雑貨 300")\n- 支払方法 (「現金」「クレジットカード」「電子マネー」など、具体的な支払い手段を文字列で記述)\n- 勘定科目 (以下のリストから最も適切なものを1つ選択):\n ${ACCOUNT_TITLES.join(', ')}\n- 税区分 (以下のリストから最も適切なものを1つ選択):\n ${TAX_CATEGORIES.join(', ')}\n\n勘定科目リスト:\n${ACCOUNT_TITLES.join('\n')}\n\n税区分リスト:\n${TAX_CATEGORIES.join('\n')}\n\n出力形式 (JSONのみ):\n{\n "date": "YYYY-MM-DD",\n "time": "HH:MM",\n "storeName": "支払先",\n "storeBranchName": "支払先_支店名",\n "totalAmount": 金額 (数値),\n "items": "購入品_内訳",\n "paymentMethod": "支払方法",\n "accountTitle": "勘定科目",\n "taxCategory": "税区分"\n}\n\n情報が読み取れない場合は、該当項目に "不明" または空文字列 "" を入れてください。\n支払金額は必ず数値で返してください。 カンマは含めないでください。\n元のファイル名は ${originalFileName} です。`;

  const payload = JSON.stringify({ contents: [ { parts: [ { text: promptText }, { inline_data: { mime_type: mimeType, data: fileContentBase64 } } ] } ], });
  const options = { method: 'post', contentType: 'application/json', payload: payload, muteHttpExceptions: true };
  try {
    Logger.log(`情報 [${FN}]: Gemini API 呼び出し: ${GEMINI_API_ENDPOINT}`);
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    if (responseCode === 200) {
      try {
        const result = JSON.parse(responseBody);
        if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0] && result.candidates[0].content.parts[0].text) {
          let jsonText = result.candidates[0].content.parts[0].text;
          Logger.log(`デバッグ [${FN}]: Gemini Raw Text: [\n${jsonText}\n]`);
          const jsonMatch = jsonText.match(/```(json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[2]) jsonText = jsonMatch[2];
          else Logger.log(`警告 [${FN}]: GeminiレスポンスからMarkdownコードブロックマーカーが見つかりませんでした。`);
          jsonText = jsonText.trim();
          Logger.log(`デバッグ [${FN}]: Processed JSON Text for parsing (length: ${jsonText.length}): [\n${jsonText}\n]`);
          try {
            return JSON.parse(jsonText);
          } catch (parseError) {
            Logger.log(`エラー [${FN}]: Gemini APIレスポンスJSONパース失敗。Text: [\n${jsonText}\n], Error: ${parseError.message}, Stack: ${parseError.stack}`);
            if(result.candidates[0].finishReason) Logger.log(`警告 [${FN}]: Gemini Finish Reason: ${result.candidates[0].finishReason}`);
            if(result.candidates[0].safetyRatings) Logger.log(`警告 [${FN}]: Gemini Safety Ratings: ${JSON.stringify(result.candidates[0].safetyRatings)}`);
            return null;
          }
        } else {
          Logger.log(`エラー [${FN}]: Gemini APIレスポンス構造不正。Resp: ${responseBody}`);
          if(result.candidates && result.candidates[0] && result.candidates[0].finishReason) Logger.log(`警告 [${FN}]: Gemini Finish Reason: ${result.candidates[0].finishReason}`);
          if(result.candidates && result.candidates[0].safetyRatings) Logger.log(`警告 [${FN}]: Gemini Safety Ratings: ${JSON.stringify(result.candidates[0].safetyRatings)}`);
          return null;
        }
      } catch (outerParseError) {
        Logger.log(`エラー [${FN}]: Gemini APIレスポンス全体JSONパース失敗。Resp Body: ${responseBody}, Error: ${outerParseError}`);
        return null;
      }
    } else {
      Logger.log(`エラー [${FN}]: Gemini API呼び出し失敗。Status: ${responseCode}, Resp: ${responseBody}, Payload size: ${payload.length} bytes`);
      return null;
    }
  } catch (e) {
    Logger.log(`エラー [${FN}]: Gemini API呼び出し中例外: ${e}\n${e.stack}`);
    return null;
  }
}

/*******************************************************************************
* その他のヘルパー関数 (変更なし)
*******************************************************************************/
function generateUniqueId_(existingIds) {
  const FN = 'generateUniqueId_';
  let newId, attempts = 0;
  const maxAttempts = 10;
  do {
    newId = Utilities.getUuid().substring(0, 8);
    attempts++;
    if (attempts > maxAttempts) {
      Logger.log(`エラー [${FN}]: ユニークID生成失敗(${maxAttempts}回)。既存ID数: ${existingIds.size}`);
      throw new Error(`Failed to generate unique ID after ${maxAttempts} attempts.`);
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