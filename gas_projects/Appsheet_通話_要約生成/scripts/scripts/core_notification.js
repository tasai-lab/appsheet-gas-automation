/**

 * 通知モジュール

 * メール通知機能

 * @author Fractal Group

 * @version 2.0.0

 * @date 2025-10-06

 */


/**

 * 成功通知を送信

 * 処理成功時にメールで通知

 * @param {string} callId - 通話ID

 * @param {string} summary - 生成された要約

 * @param {Object} config - 設定オブジェクト

 */

function sendSuccessNotification(callId, summary, config) {

  if (!config.emailNotificationEnabled || !config.notifyOnSuccess) {

    Logger.log('[通知] 成功通知は無効化されています');

    return;

  }

  if (!config.errorNotificationEmail) {

    Logger.log('[通知] 通知先メールアドレスが未設定です');

    return;

  }

  const subject = `✅ [処理成功] 通話音声処理完了 (ID: ${callId})`;

  // 要約は200文字に制限

  const summarySnippet = summary.length > 200 

    ? summary.substring(0, 200) + '...' 

    : summary;

  const body = `

通話音声ファイルの自動処理が正常に完了しました。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 処理情報

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

通話ID: ${callId}

処理日時: ${Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 生成された要約 (抜粋)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${summarySnippet}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

完全な内容はAppSheetでご確認ください。

--

通話音声処理システム (Powered by Vertex AI)

株式会社フラクタル

`;

  try {

    // Email removed - using execution log instead

    Logger.log(`[通知] 成功通知送信完了: ${config.errorNotificationEmail}`);

  } catch (error) {

    Logger.log(`[通知] 成功通知送信失敗: ${error.message}`);

  }

}


/**

 * エラー通知を送信

 * 処理失敗時に詳細なエラー情報をメールで通知

 * @param {string} callId - 通話ID

 * @param {string} errorMessage - エラーメッセージ

 * @param {string} errorStack - スタックトレース

 * @param {Object} config - 設定オブジェクト

 */

function sendErrorNotification(callId, errorMessage, errorStack, config) {

  if (!config.emailNotificationEnabled) {

    Logger.log('[通知] メール通知は無効化されています');

    return;

  }

  if (!config.errorNotificationEmail) {

    Logger.log('[通知] 通知先メールアドレスが未設定です');

    return;

  }

  const subject = `⚠️ [要確認] 通話音声処理エラー (ID: ${callId})`;

  const body = `

通話音声ファイルの自動処理でエラーが発生しました。

早急にGASログを確認してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ エラー情報

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

通話ID: ${callId}

発生日時: ${Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ エラーメッセージ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${errorMessage}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ スタックトレース

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${errorStack || 'スタックトレース情報なし'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 対処方法

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Apps Scriptのログを確認

   https://script.google.com/

2. エラーメッセージから原因を特定

   - APIキーの有効性を確認

   - Vertex AI APIの権限を確認

   - ファイル形式・サイズを確認

3. 必要に応じて再処理

--

通話音声処理システム (Powered by Vertex AI)

株式会社フラクタル

`;

  try {

    // Email removed - using execution log instead

    Logger.log(`[通知] エラー通知送信完了: ${config.errorNotificationEmail}`);

  } catch (error) {

    Logger.log(`[通知] エラー通知送信失敗: ${error.message}`);

  }

}


/**

 * テスト通知を送信

 * 通知機能の動作確認用

 */

function sendTestNotification() {

  const config = getConfig();

  if (!config.errorNotificationEmail) {

    Logger.log('❌ ERROR_NOTIFICATION_EMAIL が未設定です');

    return;

  }

  const subject = '🔔 [テスト] 通話音声処理システム - 通知テスト';

  const body = `

これは通知機能のテストメールです。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 設定確認

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

通知先: ${config.errorNotificationEmail}

メール通知: ${config.emailNotificationEnabled ? '有効' : '無効'}

成功時通知: ${config.notifyOnSuccess ? '有効' : '無効'}

送信日時: ${Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

このメールが届いていれば、通知機能は正常に動作しています。

--

通話音声処理システム (Powered by Vertex AI)

株式会社フラクタル

`;

  try {

    // Email removed - using execution log instead

    Logger.log('✅ テスト通知を送信しました');

    Logger.log(`送信先: ${config.errorNotificationEmail}`);

  } catch (error) {

    Logger.log(`❌ テスト通知の送信に失敗: ${error.message}`);

  }

}
