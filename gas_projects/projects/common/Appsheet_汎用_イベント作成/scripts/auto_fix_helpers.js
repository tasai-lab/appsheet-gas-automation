/**
 * 不在イベント自動修正ヘルパー関数
 * test_functions.jsから分離した自動実行用の関数
 */

/**
 * 勤怠管理スプレッドシート設定
 */
const ATTENDANCE_SHEET_CONFIG = {
  spreadsheetId: '1QDMA3DP4Y9XSFRWY9ewwP3Vih2NJEpq7NmNRRgASqRY',
  sheetName: '勤務_予定',

  // 列インデックス（0始まり）
  columns: {
    id: 0,                    // A列: ID
    date: 1,                  // B列: 年月日
    dayOfWeek: 2,             // C列: 曜日
    category: 3,              // D列: 区分
    plannedStartTime: 4,      // E列: 始業時刻_予定
    plannedEndTime: 5,        // F列: 終業時刻_予定
    plannedBreakMinutes: 6,   // G列: 休憩時間/分_予定
    plannedWorkHours: 7,      // H列: 所定労働時間/日_予定
    actualStartTime: 8,       // I列: 始業時刻_実績
    actualEndTime: 9,         // J列: 終業時刻_実績
    actualBreakMinutes: 10,   // K列: 休憩時間/分_実績
    actualWorkHours: 11,      // L列: 所定労働時間/日_実績
    locationStart: 12,        // M列: 位置情報_始業
    locationEnd: 13,          // N列: 位置情報_終業
    employee: 14,             // O列: 社員
    lastUpdated: 15,          // P列: 最終更新日時
    lastUpdatedBy: 16,        // Q列: 最終更新者
    desiredLeave: 17,         // R列: 希望休
    paidLeave: 18,            // S列: 有休
    onCall: 19,               // T列: オンコール
    lockKey: 20,              // U列: ロック_key
    updateKey: 21,            // V列: 更新_key
    employeeLockKey: 22,      // W列: 社員ロック_key
    yearMonth: 23,            // X列: 年月
    outOfOfficeEventId: 24    // Y列: 不在イベントID
  }
};

/**
 * 勤怠管理スプレッドシートから不在イベントIDを取得
 * @private
 * @returns {Array<Object>} 不在イベント情報のリスト [{rowIndex, employee, eventId, date}, ...]
 */
function _getOutOfOfficeEventsFromAttendance() {
  const spreadsheet = SpreadsheetApp.openById(ATTENDANCE_SHEET_CONFIG.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(ATTENDANCE_SHEET_CONFIG.sheetName);
  const data = sheet.getDataRange().getValues();

  const events = [];
  const col = ATTENDANCE_SHEET_CONFIG.columns;

  // ヘッダー行をスキップ（i=1から開始）
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const eventId = row[col.outOfOfficeEventId];

    // 不在イベントIDが入力されているレコードのみ抽出
    if (eventId && eventId.toString().trim() !== '') {
      events.push({
        rowIndex: i + 1, // シート上の行番号（1始まり）
        employee: row[col.employee],
        eventId: eventId.toString().trim(),
        date: row[col.date],
        yearMonth: row[col.yearMonth]
      });
    }
  }

  return events;
}


/**
 * Calendar APIで不在イベントの詳細を取得
 * @private
 * @param {string} ownerEmail - イベント保有者のメールアドレス
 * @param {string} eventId - イベントID
 * @returns {Object|null} イベント詳細 {id, summary, end: {dateTime, timeZone}} または null（エラー時）
 */
function _getEventDetails(ownerEmail, eventId) {
  try {
    const accessToken = AuthService.getAccessTokenForUser(ownerEmail);
    const calendarId = 'primary';
    const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`;

    const options = {
      method: 'get',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();

    if (responseCode >= 200 && responseCode < 300) {
      const event = JSON.parse(response.getContentText());
      return {
        id: event.id,
        summary: event.summary,
        end: event.end
      };
    } else if (responseCode === 404) {
      // イベントが見つからない場合
      return null;
    } else {
      throw new Error(`Calendar API エラー: Status ${responseCode}`);
    }

  } catch (error) {
    throw new Error(`イベント詳細取得失敗: ${error.toString()}`);
  }
}


/**
 * 勤怠管理スプレッドシートから不在イベントを自動修正
 * 不在イベントIDが入力されているレコードを対象に、23:39以降に終了するイベントを修正
 *
 * この関数はトリガーで定期実行することを推奨します。
 *
 * @param {boolean} dryRun - trueの場合は実際の更新なし（デフォルト: true）
 * @returns {Object} 実行結果 {processed, needsFix, updated, errors}
 *
 * @example
 * // ドライラン
 * autoFixOutOfOfficeEventsFromSheet(true);
 *
 * @example
 * // 実際に更新
 * autoFixOutOfOfficeEventsFromSheet(false);
 */
function autoFixOutOfOfficeEventsFromSheet(dryRun = true) {
  try {
    Logger.log('=== 不在イベント自動修正開始（勤怠管理スプレッドシートベース） ===');
    Logger.log(`ドライランモード: ${dryRun}`);

    // 不在イベントIDを取得
    const events = _getOutOfOfficeEventsFromAttendance();
    Logger.log(`不在イベントID登録済み: ${events.length}件`);

    if (events.length === 0) {
      Logger.log('修正対象がありません。処理を終了します。');
      return {
        processed: 0,
        needsFix: 0,
        updated: 0,
        errors: 0
      };
    }

    let processedCount = 0;
    let needsFixCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];

    // 各イベントを順次処理
    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      try {
        Logger.log(`[${i + 1}/${events.length}] 処理中: ${event.employee} - EventID: ${event.eventId}`);

        // バリデーション
        if (!event.employee || !event.eventId) {
          Logger.log(`スキップ: 社員またはイベントIDが未入力 (行${event.rowIndex})`);
          errorCount++;
          errors.push(`行${event.rowIndex}: 社員またはイベントIDが未入力`);
          continue;
        }

        // イベント詳細を取得
        const eventDetails = _getEventDetails(event.employee, event.eventId);

        if (!eventDetails) {
          Logger.log(`イベントが見つかりません: ${event.eventId} (行${event.rowIndex})`);
          errorCount++;
          errors.push(`行${event.rowIndex}: イベントID ${event.eventId} が見つかりません`);
          continue;
        }

        processedCount++;

        // 終了時刻をチェック
        if (!eventDetails.end || !eventDetails.end.dateTime) {
          Logger.log(`スキップ: dateTimeフィールドがありません`);
          continue;
        }

        const endDateTime = new Date(eventDetails.end.dateTime);
        const endHour = endDateTime.getHours();
        const endMinute = endDateTime.getMinutes();

        // 23:39以降かつ00:00でない場合
        if ((endHour === 23 && endMinute >= 39) || (endHour === 23 && endMinute === 59)) {
          needsFixCount++;
          Logger.log(`修正対象: ${eventDetails.summary} - 終了時刻 ${eventDetails.end.dateTime}`);

          if (!dryRun) {
            // 翌日00:00:00の日時を計算
            const newEndDate = new Date(endDateTime);
            newEndDate.setDate(newEndDate.getDate() + 1);
            newEndDate.setHours(0, 0, 0, 0);

            // イベントの終了時刻を更新
            _updateEventEndTime(
              event.employee,
              event.eventId,
              newEndDate,
              eventDetails.end.timeZone || 'Asia/Tokyo'
            );

            updatedCount++;
            Logger.log(`✓ 更新成功: ${eventDetails.summary} → ${newEndDate.toISOString()}`);
          } else {
            Logger.log(`[ドライラン] 更新予定: ${eventDetails.summary}`);
          }
        }

        // API レート制限を考慮して待機（次のイベントがある場合）
        if (i < events.length - 1) {
          Utilities.sleep(500); // 0.5秒待機
        }

      } catch (error) {
        errorCount++;
        const errorMsg = `行${event.rowIndex}: ${error.toString()}`;
        errors.push(errorMsg);
        Logger.log(`✗ 処理エラー: ${errorMsg}`);
        Logger.log(error.stack);
      }
    }

    Logger.log('=== 実行結果 ===');
    Logger.log(`処理: ${processedCount}件`);
    Logger.log(`修正対象: ${needsFixCount}件`);
    Logger.log(`更新: ${updatedCount}件`);
    Logger.log(`エラー: ${errorCount}件`);

    if (dryRun) {
      Logger.log('ドライランモード: 実際の更新は行いませんでした');
    }

    return {
      processed: processedCount,
      needsFix: needsFixCount,
      updated: updatedCount,
      errors: errorCount,
      errorMessages: errors,
      dryRun: dryRun
    };

  } catch (error) {
    Logger.log(`✗ 自動修正エラー: ${error.toString()}`);
    Logger.log(error.stack);
    throw error;
  }
}


/**
 * 勤怠管理スプレッドシートを開く
 * 手動でスプレッドシートを確認する際に使用
 *
 * @example
 * openAttendanceSpreadsheet();
 */
function openAttendanceSpreadsheet() {
  const spreadsheet = SpreadsheetApp.openById(ATTENDANCE_SHEET_CONFIG.spreadsheetId);
  Logger.log('勤怠管理スプレッドシートURL: ' + spreadsheet.getUrl());
  Logger.log('スプレッドシートを開くには、上記URLをクリックしてください');
}
