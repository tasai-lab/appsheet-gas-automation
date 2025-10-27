/**
 * メインロジック - Appsheet_カレンダー同期
 * カレンダートリガーとメイン処理のエントリーポイント
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-27
 */

/**
 * カレンダー変更トリガーによって呼び出されるメイン関数
 * @param {Object} e - トリガーイベント
 */
function onCalendarChanged(e) {
  const logger = createLogger(PROJECT_NAME);
  let status = '成功';
  const calendarId = e && e.calendarId ? e.calendarId : 'unknown';

  try {
    if (!e || !e.calendarId) {
      logger.warning('カレンダーIDが指定されていません');
      return;
    }

    logger.info(`=== カレンダー更新検知 ===`, {
      calendarId: e.calendarId,
      triggerSource: 'Calendar Trigger'
    });

    // UserLockを使用（ユーザーごとの実行）
    const lock = LockService.getUserLock();
    try {
      if (!lock.tryLock(15000)) {
        logger.error('ロック取得失敗。同一ユーザーによる処理が重複しています。');
        status = 'エラー';
        return;
      }

      // カレンダーイベントを同期
      syncCalendarEvents(e.calendarId);

      logger.success('カレンダー同期完了');

    } finally {
      if (lock.hasLock()) {
        lock.releaseLock();
      }
      // グローバルキャッシュをクリア
      GLOBAL_CACHE.staffMap = null;
    }

  } catch (error) {
    status = 'エラー';
    logger.error(`同期処理中にエラーが発生: ${error.toString()}`, {
      calendarId: calendarId,
      stack: error.stack
    });
    throw error;

  } finally {
    // ログをスプレッドシートに保存
    logger.saveToSpreadsheet(status, calendarId);
  }
}

/**
 * 現在のユーザーが設定したカレンダートリガーを取得
 * @return {Trigger|null} トリガーオブジェクト
 */
function getUserCalendarTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  const userEmail = Session.getActiveUser().getEmail();

  for (const trigger of triggers) {
    if (trigger.getTriggerSource() === ScriptApp.TriggerSource.CALENDAR &&
        trigger.getHandlerFunction() === 'onCalendarChanged' &&
        trigger.getTriggerSourceId() === userEmail) {
      return trigger;
    }
  }
  return null;
}
