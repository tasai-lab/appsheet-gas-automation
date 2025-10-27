/**
 * テスト関数モジュール
 * 不在イベントの終了時刻修正用ユーティリティ
 *
 * このファイルには既存の不在イベントを検査・修正するためのテスト関数が含まれています。
 * 主な用途: 23:59:59で終了している不在イベントを翌日00:00:00に修正
 *
 * スプレッドシートベースの自動実行機能も含まれています。
 *
 * @version 2.0.0
 * @date 2025-10-27
 */

/**
 * スプレッドシート設定
 */
const OOO_FIX_CONFIG = {
  // スプレッドシート格納先（実行ログと同じフォルダー）
  folderId: '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX',
  spreadsheetName: '不在イベント修正管理',
  sheetName: '修正対象リスト',

  // 列インデックス（0始まり）
  columns: {
    year: 0,           // A列: 年
    month: 1,          // B列: 月
    email: 2,          // C列: ユーザーメールアドレス
    status: 3,         // D列: 実行ステータス
    executedAt: 4,     // E列: 実行日時
    totalEvents: 5,    // F列: 全イベント数
    targets: 6,        // G列: 修正対象数
    updated: 7,        // H列: 更新成功数
    errors: 8,         // I列: エラー数
    errorMessage: 9    // J列: エラーメッセージ
  },

  // ステータス値
  status: {
    pending: '未実行',
    running: '実行中',
    completed: '完了',
    error: 'エラー'
  }
};


/**
 * 指定年月の不在イベントを取得
 *
 * @private
 * @param {string} ownerEmail - イベント保有者のメールアドレス
 * @param {number} year - 年（例: 2025）
 * @param {number} month - 月（1〜12）
 * @returns {Array<Object>} 不在イベントのリスト
 *
 * @example
 * const events = _getOutOfOfficeEvents('user@example.com', 2025, 10);
 */
function _getOutOfOfficeEvents(ownerEmail, year, month) {
  try {
    // OAuth2でownerEmailユーザーのアクセストークンを取得
    const accessToken = AuthService.getAccessTokenForUser(ownerEmail);

    // 指定月の開始日と終了日を計算
    const timeMin = new Date(year, month - 1, 1);
    const timeMax = new Date(year, month, 1);

    // Calendar APIエンドポイント
    const calendarId = 'primary';
    const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events` +
      `?timeMin=${timeMin.toISOString()}` +
      `&timeMax=${timeMax.toISOString()}` +
      `&eventTypes=outOfOffice` +
      `&singleEvents=true` +
      `&orderBy=startTime`;

    const options = {
      method: 'get',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode >= 200 && responseCode < 300) {
      const result = JSON.parse(responseBody);
      return result.items || [];
    } else {
      throw new Error(`Calendar API エラー: Status ${responseCode}, Body: ${responseBody}`);
    }

  } catch (error) {
    throw new Error(`不在イベント取得失敗: ${error.toString()}`);
  }
}


/**
 * イベントの終了時刻を更新
 *
 * @private
 * @param {string} ownerEmail - イベント保有者のメールアドレス
 * @param {string} eventId - イベントID
 * @param {Date} newEndDateTime - 新しい終了日時
 * @param {string} timeZone - タイムゾーン
 * @returns {boolean} 更新成功ならtrue
 *
 * @example
 * const newEndTime = new Date('2025-10-26T00:00:00');
 * _updateEventEndTime('user@example.com', 'event123', newEndTime, 'Asia/Tokyo');
 */
function _updateEventEndTime(ownerEmail, eventId, newEndDateTime, timeZone) {
  try {
    // OAuth2でownerEmailユーザーのアクセストークンを取得
    const accessToken = AuthService.getAccessTokenForUser(ownerEmail);

    // Calendar APIエンドポイント
    const calendarId = 'primary';
    const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`;

    // PATCH リクエストで終了時刻のみ更新
    const payload = {
      end: {
        dateTime: newEndDateTime.toISOString(),
        timeZone: timeZone
      }
    };

    const options = {
      method: 'patch',
      contentType: 'application/json',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode >= 200 && responseCode < 300) {
      return true;
    } else {
      throw new Error(`Calendar API エラー: Status ${responseCode}, Body: ${responseBody}`);
    }

  } catch (error) {
    throw new Error(`イベント更新失敗: ${error.toString()}`);
  }
}


/**
 * 指定年月の不在イベントで23:39以降に終了しているものを00:00に修正
 *
 * @param {number} year - 年（例: 2025）
 * @param {number} month - 月（1〜12）
 * @param {string} ownerEmail - イベント保有者のメールアドレス
 * @param {boolean} dryRun - trueの場合は実際の更新は行わず、対象イベントのみ表示（デフォルト: true）
 * @returns {Object} 実行結果 {total, targets, updated, errors}
 *
 * @example
 * // ドライラン（実際の更新なし）
 * testFixOutOfOfficeEndTime(2025, 10, 'user@example.com', true);
 *
 * @example
 * // 実際に更新を実行
 * testFixOutOfOfficeEndTime(2025, 10, 'user@example.com', false);
 */
function testFixOutOfOfficeEndTime(year, month, ownerEmail, dryRun = true) {
  const logger = createLogger('Appsheet_汎用_イベント作成_テスト');
  let status = '成功';

  try {
    logger.info('=== 不在イベント終了時刻修正テスト開始 ===', {
      year: year,
      month: month,
      ownerEmail: ownerEmail,
      dryRun: dryRun
    });

    // 不在イベントを取得
    const events = _getOutOfOfficeEvents(ownerEmail, year, month);
    logger.info(`取得した不在イベント数: ${events.length}件`);

    // 23:39以降に終了しているイベントを抽出
    const targetEvents = [];
    events.forEach(event => {
      if (!event.end || !event.end.dateTime) {
        return; // dateTimeがない場合はスキップ
      }

      const endDateTime = new Date(event.end.dateTime);
      const endHour = endDateTime.getHours();
      const endMinute = endDateTime.getMinutes();

      // 23:39以降かつ00:00でない場合
      if ((endHour === 23 && endMinute >= 39) || (endHour === 23 && endMinute === 59)) {
        targetEvents.push({
          id: event.id,
          summary: event.summary,
          currentEndTime: event.end.dateTime,
          endDateTime: endDateTime,
          timeZone: event.end.timeZone || 'Asia/Tokyo'
        });
      }
    });

    logger.info(`修正対象の不在イベント: ${targetEvents.length}件`);

    // 対象イベントの詳細をログ出力
    targetEvents.forEach((target, index) => {
      Logger.log(`[${index + 1}] ${target.summary}`);
      Logger.log(`    現在の終了時刻: ${target.currentEndTime}`);
      Logger.log(`    イベントID: ${target.id}`);
    });

    // ドライランモードの場合はここで終了
    if (dryRun) {
      logger.info('=== ドライランモード: 実際の更新は行いません ===');
      logger.success('テスト完了（ドライラン）');
      return {
        total: events.length,
        targets: targetEvents.length,
        updated: 0,
        errors: 0,
        dryRun: true,
        targetEvents: targetEvents
      };
    }

    // 実際の更新処理
    logger.info('=== 実際の更新を開始します ===');
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];

    targetEvents.forEach((target, index) => {
      try {
        // 翌日00:00:00の日時を計算
        const currentEndDate = new Date(target.endDateTime);
        const newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() + 1);
        newEndDate.setHours(0, 0, 0, 0);

        logger.info(`[${index + 1}/${targetEvents.length}] 更新中: ${target.summary}`, {
          eventId: target.id,
          oldEndTime: target.currentEndTime,
          newEndTime: newEndDate.toISOString()
        });

        // イベントの終了時刻を更新
        _updateEventEndTime(ownerEmail, target.id, newEndDate, target.timeZone);

        updatedCount++;
        Logger.log(`✓ 更新成功: ${target.summary}`);
        Logger.log(`  新しい終了時刻: ${newEndDate.toISOString()}`);

      } catch (error) {
        errorCount++;
        const errorMsg = `更新エラー: ${target.summary} - ${error.toString()}`;
        logger.error(errorMsg, { eventId: target.id });
        errors.push(errorMsg);
        Logger.log(`✗ ${errorMsg}`);
      }

      // API レート制限を考慮して少し待機
      if (index < targetEvents.length - 1) {
        Utilities.sleep(500); // 0.5秒待機
      }
    });

    logger.success(`更新完了: ${updatedCount}件成功, ${errorCount}件エラー`);
    status = errorCount > 0 ? '一部エラー' : '成功';

    return {
      total: events.length,
      targets: targetEvents.length,
      updated: updatedCount,
      errors: errorCount,
      dryRun: false,
      errorMessages: errors
    };

  } catch (error) {
    status = 'エラー';
    logger.error(`テスト実行エラー: ${error.toString()}`, {
      stack: error.stack,
      year: year,
      month: month,
      ownerEmail: ownerEmail
    });
    throw error;

  } finally {
    logger.saveToSpreadsheet(status, `${year}-${String(month).padStart(2, '0')}`);
  }
}


/**
 * 今月の不在イベントを修正（ドライランモード）
 * 最も簡単に実行できる関数
 *
 * @returns {Object} 実行結果
 *
 * @example
 * // GASエディタで直接実行
 * testFixCurrentMonthOutOfOffice();
 */
function testFixCurrentMonthOutOfOffice() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const ownerEmail = Session.getActiveUser().getEmail();

  Logger.log(`=== 今月の不在イベント修正テスト ===`);
  Logger.log(`年月: ${year}年${month}月`);
  Logger.log(`対象ユーザー: ${ownerEmail}`);
  Logger.log(`モード: ドライラン（実際の更新なし）`);
  Logger.log('');

  const result = testFixOutOfOfficeEndTime(year, month, ownerEmail, true);

  Logger.log('');
  Logger.log('=== 結果サマリー ===');
  Logger.log(`全不在イベント数: ${result.total}件`);
  Logger.log(`修正対象: ${result.targets}件`);
  Logger.log('');
  Logger.log('実際に更新を実行する場合は testFixCurrentMonthOutOfOfficeExecute() を実行してください');

  return result;
}


/**
 * 今月の不在イベントを修正（実行モード）
 * 確認後に実際の更新を実行します
 *
 * ⚠️ 警告: この関数は実際にイベントを更新します
 *
 * @returns {Object} 実行結果
 *
 * @example
 * // GASエディタで直接実行
 * testFixCurrentMonthOutOfOfficeExecute();
 */
function testFixCurrentMonthOutOfOfficeExecute() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const ownerEmail = Session.getActiveUser().getEmail();

  Logger.log(`=== 今月の不在イベント修正（実行モード） ===`);
  Logger.log(`年月: ${year}年${month}月`);
  Logger.log(`対象ユーザー: ${ownerEmail}`);
  Logger.log(`⚠️ 実際にイベントを更新します`);
  Logger.log('');

  // まずドライランで確認
  Logger.log('--- ドライランで対象を確認 ---');
  const dryRunResult = testFixOutOfOfficeEndTime(year, month, ownerEmail, true);

  if (dryRunResult.targets === 0) {
    Logger.log('修正対象のイベントがありません。');
    return dryRunResult;
  }

  Logger.log('');
  Logger.log(`${dryRunResult.targets}件のイベントを更新します...`);
  Logger.log('');

  // 実際の更新を実行
  const result = testFixOutOfOfficeEndTime(year, month, ownerEmail, false);

  Logger.log('');
  Logger.log('=== 更新結果 ===');
  Logger.log(`更新成功: ${result.updated}件`);
  Logger.log(`エラー: ${result.errors}件`);

  if (result.errors > 0) {
    Logger.log('');
    Logger.log('=== エラー詳細 ===');
    result.errorMessages.forEach((msg, index) => {
      Logger.log(`[${index + 1}] ${msg}`);
    });
  }

  return result;
}


/**
 * 特定の年月とユーザーの不在イベントを修正（実行モード）
 *
 * @param {number} year - 年（例: 2025）
 * @param {number} month - 月（1〜12）
 * @param {string} ownerEmail - イベント保有者のメールアドレス
 * @returns {Object} 実行結果
 *
 * @example
 * // 2025年10月のイベントを修正
 * testFixOutOfOfficeEndTimeExecute(2025, 10, 'user@example.com');
 */
function testFixOutOfOfficeEndTimeExecute(year, month, ownerEmail) {
  Logger.log(`=== 不在イベント修正（実行モード） ===`);
  Logger.log(`年月: ${year}年${month}月`);
  Logger.log(`対象ユーザー: ${ownerEmail}`);
  Logger.log(`⚠️ 実際にイベントを更新します`);
  Logger.log('');

  // まずドライランで確認
  Logger.log('--- ドライランで対象を確認 ---');
  const dryRunResult = testFixOutOfOfficeEndTime(year, month, ownerEmail, true);

  if (dryRunResult.targets === 0) {
    Logger.log('修正対象のイベントがありません。');
    return dryRunResult;
  }

  Logger.log('');
  Logger.log(`${dryRunResult.targets}件のイベントを更新します...`);
  Logger.log('');

  // 実際の更新を実行
  const result = testFixOutOfOfficeEndTime(year, month, ownerEmail, false);

  Logger.log('');
  Logger.log('=== 更新結果 ===');
  Logger.log(`更新成功: ${result.updated}件`);
  Logger.log(`エラー: ${result.errors}件`);

  if (result.errors > 0) {
    Logger.log('');
    Logger.log('=== エラー詳細 ===');
    result.errorMessages.forEach((msg, index) => {
      Logger.log(`[${index + 1}] ${msg}`);
    });
  }

  return result;
}
