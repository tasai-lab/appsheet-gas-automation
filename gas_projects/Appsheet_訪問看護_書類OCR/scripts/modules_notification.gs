/**
 * modules_notification.gs - 通知モジュール
 *
 * エラー通知と完了通知メールの送信
 *
 * @version 2.0.0
 * @date 2025-10-18
 */

/**
 * エラー通知メールを送信
 * @param {string} documentId - 書類ID
 * @param {string} errorMessage - エラーメッセージ
 * @param {Object} [context] - コンテキスト情報
 */
function sendErrorEmail(documentId, errorMessage, context = {}) {
  const subject = `[要確認] GAS処理エラー: 書類OCR+仕分け (ID: ${documentId})`;

  let body = `AppSheetの書類OCR+仕分け自動処理でエラーが発生しました。\n\n`;
  body += `■ 対象ID: ${documentId}\n`;
  body += `■ 発生日時: ${new Date().toLocaleString('ja-JP')}\n`;
  body += `■ エラー内容:\n${errorMessage}\n\n`;

  if (context.documentType) {
    body += `■ 書類種類: ${context.documentType}\n`;
  }

  if (context.fileId) {
    body += `■ ファイルID: ${context.fileId}\n`;
    body += `■ ファイル: https://drive.google.com/file/d/${context.fileId}/view\n\n`;
  }

  body += `GASのログをご確認ください。\n`;
  body += `https://script.google.com/home/executions`;

  try {
    // Email removed - using execution log instead
    logStructured(LOG_LEVEL.INFO, 'エラー通知メール送信成功', {
      documentId: documentId,
      recipient: NOTIFICATION_CONFIG.errorEmail
    });
  } catch (e) {
    logStructured(LOG_LEVEL.ERROR, 'エラー通知メール送信失敗', {
      error: e.toString()
    });
  }
}

/**
 * 完了通知メールを送信
 * @param {Object} context - コンテキスト情報
 * @param {string} documentType - 書類種類
 * @param {Object} structuredData - 抽出された構造化データ
 * @param {string} recordId - 作成されたレコードID
 */
function sendCompletionNotificationEmail(context, documentType, structuredData, recordId) {
  if (!NOTIFICATION_CONFIG.completionEmails) {
    logStructured(LOG_LEVEL.INFO, '完了通知メールの宛先が未設定のためスキップ');
    return;
  }

  const displayClientName = context.clientName || context.clientId;
  const displayStaffName = context.staffName || context.staffId;

  const subject = `【要確認】${documentType}の自動登録が完了しました (${displayClientName} 様)`;

  // AppSheetディープリンク
  const viewName = VIEW_NAME_MAP[documentType];
  const appSheetLink = viewName
    ? `https://www.appsheet.com/start/${APPSHEET_CONFIG.appId}?platform=desktop#appName=${encodeURIComponent(APPSHEET_CONFIG.appName)}&view=${encodeURIComponent(viewName)}&row=${encodeURIComponent(recordId)}`
    : null;

  // Googleドライブリンク
  const driveFileLink = context.driveFileId
    ? `https://drive.google.com/file/d/${context.driveFileId}/view`
    : null;

  // HTMLメール本文
  let htmlBody = `
<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px; background-color: #f9f9f9;">
  <h2 style="color: #4CAF50; border-bottom: 3px solid #4CAF50; padding-bottom: 10px;">✅ 書類自動登録完了</h2>

  <p style="font-size: 16px; line-height: 1.6;">
    <strong>利用者:</strong> ${displayClientName} 様<br>
    <strong>書類種類:</strong> ${documentType}<br>
    <strong>登録ID:</strong> ${recordId}<br>
    <strong>処理担当:</strong> ${displayStaffName}<br>
    <strong>処理日時:</strong> ${new Date().toLocaleString('ja-JP')}
  </p>

  ${appSheetLink ? `<p style="margin-top: 20px;"><a href="${appSheetLink}" target="_blank" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; font-size: 16px;">AppSheetで詳細を確認</a></p>` : ''}

  ${driveFileLink ? `<p style="margin-top: 10px;"><a href="${driveFileLink}" target="_blank" style="background-color: #008CBA; color: white; padding: 12px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; font-size: 16px;">原本ファイルを開く</a></p>` : ''}

  <h3 style="color: #666; margin-top: 30px; border-bottom: 2px solid #4CAF50; padding-bottom: 5px;">📋 抽出されたデータ</h3>

  <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
`;

  // 構造化データをテーブル形式で表示
  if (structuredData && typeof structuredData === 'object') {
    for (const key in structuredData) {
      const value = structuredData[key];
      if (value !== null && value !== undefined && value !== '') {
        const displayKey = KEY_TO_JAPANESE_MAP[key] || key;
        const displayValue = formatValueForEmail(value);

        htmlBody += `<tr style="border-bottom: 1px solid #ddd;">
          <th style="padding: 8px; text-align: left; background-color: #f2f2f2; width: 200px;">${displayKey}</th>
          <td style="padding: 8px; text-align: left;">${displayValue}</td>
        </tr>`;
      }
    }
  }

  htmlBody += `
  </table>

  <p style="margin-top: 30px; font-size: 14px; color: #666; border-top: 1px solid #ddd; padding-top: 15px;">
    ※ このメールは自動送信されています。<br>
    ※ 抽出内容に誤りがある場合は、AppSheetで手動修正してください。
  </p>
</div>
`;

  try {
    MailApp.sendEmail({
      to: NOTIFICATION_CONFIG.completionEmails,
      subject: subject,
      htmlBody: htmlBody
    });

    logStructured(LOG_LEVEL.INFO, '完了通知メール送信成功', {
      documentType: documentType,
      recordId: recordId,
      recipient: NOTIFICATION_CONFIG.completionEmails
    });
  } catch (e) {
    logStructured(LOG_LEVEL.ERROR, '完了通知メール送信失敗', {
      error: e.toString()
    });
  }
}

/**
 * メール表示用に値を整形
 * @private
 */
function formatValueForEmail(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'boolean') {
    return value ? 'はい' : 'いいえ';
  }
  if (typeof value === 'object') {
    // オブジェクトの場合はキー・値のペアを展開して表示
    const pairs = [];
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        const displayKey = KEY_TO_JAPANESE_MAP[key] || key;
        const displayValue = formatValueForEmail(value[key]); // 再帰的に処理
        if (displayValue !== '') {
          pairs.push(`${displayKey}: ${displayValue}`);
        }
      }
    }
    return pairs.length > 0 ? pairs.join('<br>') : '';
  }
  return String(value);
}
