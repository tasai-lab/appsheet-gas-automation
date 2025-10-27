/**
 * Webアプリ機能 - Appsheet_カレンダー同期
 * ユーザーが自身のカレンダー同期を設定するためのWebインターフェース
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-27
 */

/**
 * ウェブアプリとしてアクセスされたときに実行される関数
 * @param {Object} e - GETリクエストイベント
 * @return {HtmlOutput} HTMLページ
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('WebApp.html')
      .setTitle('カレンダー同期システム設定');
}

/**
 * 【Web App】ユーザーの現在の同期状態を確認する
 * @return {Object} 同期状態情報
 */
function checkUserSyncStatusWebApp() {
  const userEmail = Session.getActiveUser().getEmail();
  const trigger = getUserCalendarTrigger();

  return {
    isActive: trigger !== null,
    email: userEmail
  };
}

/**
 * 【Web App】ユーザーが自身のカレンダー同期を有効化する
 * @return {Object} 処理結果
 */
function activateUserSyncWebApp() {
  const userEmail = Session.getActiveUser().getEmail();
  const logger = createLogger(PROJECT_NAME);
  let status = '成功';

  try {
    logger.info('カレンダー同期有効化リクエスト', { userEmail: userEmail });

    // 1. シートの初期化確認と権限確認
    getSheetsAndColumns();
    getStaffMap();

    // 2. 既存のトリガーを確認
    const existingTrigger = getUserCalendarTrigger();

    if (existingTrigger) {
      logger.info('カレンダー同期は既に有効です', { userEmail: userEmail });
      return {
        status: 'info',
        title: '設定済み',
        message: `あなたのカレンダー (${userEmail}) の同期は既に有効です。`,
        isActive: true
      };
    }

    // 3. カレンダートリガーを設定
    ScriptApp.newTrigger('onCalendarChanged')
      .forUserCalendar(userEmail)
      .onEventUpdated()
      .create();

    logger.success('カレンダー同期を有効化しました', { userEmail: userEmail });

    return {
      status: 'success',
      title: '✅ 設定完了',
      message: `あなたのカレンダー (${userEmail}) の同期が有効になりました。<br>予定を変更すると、自動的にログ記録とAppSheet連携が行われます。`,
      isActive: true
    };

  } catch (error) {
    status = 'エラー';
    logger.error(`カレンダー同期の有効化中にエラー: ${error.toString()}`, {
      userEmail: userEmail,
      stack: error.stack
    });

    return {
      status: 'error',
      title: '⚠️ エラー',
      message: `設定中にエラーが発生しました。必要なスプレッドシートへのアクセス権限（編集権限）があるか確認してください。<br>詳細: ${error.message}`,
      isActive: false
    };

  } finally {
    logger.saveToSpreadsheet(status, userEmail);
  }
}

/**
 * 【Web App】ユーザーが自身のカレンダー同期を無効化する
 * @return {Object} 処理結果
 */
function deactivateUserSyncWebApp() {
  const userEmail = Session.getActiveUser().getEmail();
  const logger = createLogger(PROJECT_NAME);
  let status = '成功';

  try {
    logger.info('カレンダー同期無効化リクエスト', { userEmail: userEmail });

    const trigger = getUserCalendarTrigger();

    if (trigger) {
      // トリガーを削除
      ScriptApp.deleteTrigger(trigger);

      // 同期トークンも削除
      PropertiesService.getUserProperties().deleteProperty(CONFIG.SYNC_TOKEN_PREFIX + userEmail);

      logger.success('カレンダー同期を無効化しました', { userEmail: userEmail });

      return {
        status: 'success',
        title: '🛑 設定解除完了',
        message: `あなたのカレンダー (${userEmail}) の同期を無効化しました。`,
        isActive: false
      };
    } else {
      logger.info('同期は既に無効です', { userEmail: userEmail });

      return {
        status: 'info',
        title: 'ℹ️ 情報',
        message: '同期は既に無効です。',
        isActive: false
      };
    }

  } catch (error) {
    status = 'エラー';
    logger.error(`カレンダー同期の無効化中にエラー: ${error.toString()}`, {
      userEmail: userEmail,
      stack: error.stack
    });

    return {
      status: 'error',
      title: '⚠️ エラー',
      message: `無効化中にエラーが発生しました。<br>詳細: ${error.message}`,
      isActive: null
    };

  } finally {
    logger.saveToSpreadsheet(status, userEmail);
  }
}
