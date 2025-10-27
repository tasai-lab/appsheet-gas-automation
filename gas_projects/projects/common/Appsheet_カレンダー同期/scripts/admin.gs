/**
 * 管理者機能 - Appsheet_カレンダー同期
 * スプレッドシートのメニューとスタッフへの承認依頼メール送信
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-27
 */

/**
 * スプレッドシートが開かれたときに実行され、管理者用メニューを追加する
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔧 管理者ツール')
    .addItem('承認依頼メールを送信', 'sendAuthorizationEmails')
    .addToUi();
}

/**
 * 【管理者メニュー実行】スタッフに承認依頼メールを送信する
 */
function sendAuthorizationEmails() {
  const ui = SpreadsheetApp.getUi();
  const logger = createLogger(PROJECT_NAME);
  let status = '成功';

  try {
    // ウェブアプリのURLを取得
    const webAppUrl = ScriptApp.getService().getUrl();

    if (!webAppUrl) {
      ui.alert(
        '⚠️ エラー',
        'ウェブアプリがまだデプロイされていません。デプロイを実行してください。',
        ui.ButtonSet.OK
      );
      logger.error('ウェブアプリが未デプロイ');
      return;
    }

    const confirm = ui.alert(
      '確認',
      'Staff_Membersに登録されている全スタッフに、ウェブアプリへのリンクを含む承認依頼メールを送信しますか？',
      ui.ButtonSet.YES_NO
    );

    if (confirm !== ui.Button.YES) {
      logger.info('メール送信をキャンセル');
      return;
    }

    const staffMap = getStaffMap();
    const recipients = Array.from(staffMap.keys()); // メールアドレスリスト

    if (recipients.length === 0) {
      ui.alert('情報', '送信対象のスタッフが見つかりませんでした。', ui.ButtonSet.OK);
      logger.warning('送信対象のスタッフが見つからない');
      return;
    }

    const subject = "【重要・要対応】カレンダー同期システムの利用開始設定のお願い";
    const body = `
スタッフ各位

業務効率化のため、GoogleカレンダーとAppSheet（Schedule_Plan）の自動連携システムを導入しました。
このシステムを利用開始するには、ご自身での設定（権限承認）が必要です。

以下のリンクをクリックし、表示される画面の指示に従って設定を完了してください。

▼設定用リンク（クリックして設定を開始）
${webAppUrl}

手順：
1. 上記リンクをクリックして設定ページを開きます。
2. Googleの認証画面が表示された場合は「許可」を選択します。
3. 「同期を有効化 (Activate)」ボタンをクリックします。
4. 「✅ 設定完了」と表示されれば完了です。

※本システムは、今日から${CONFIG.PROCESS_WINDOW_DAYS_PAST}日前以降の予定変更のみを同期対象とします。

よろしくお願いいたします。
`;

    // メールを送信
    MailApp.sendEmail({
      to: recipients.join(','),
      subject: subject,
      body: body
    });

    logger.success('承認依頼メールを送信しました', {
      recipientCount: recipients.length,
      recipients: recipients.join(', ')
    });

    ui.alert('送信完了', `${recipients.length}名に承認依頼メールを送信しました。`, ui.ButtonSet.OK);

  } catch (error) {
    status = 'エラー';
    logger.error(`メール送信中にエラー: ${error.toString()}`, {
      stack: error.stack
    });

    ui.alert(
      '⚠️ エラー',
      `メール送信中にエラーが発生しました。管理者のメール送信権限を確認してください。\n詳細: ${error.message}`,
      ui.ButtonSet.OK
    );

  } finally {
    logger.saveToSpreadsheet(status, 'ADMIN_EMAIL_SEND');
  }
}
