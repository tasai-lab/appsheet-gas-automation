/**
 * 汎用イベント作成GAS
 *
 * 個別の引数を使用してGoogleカレンダーイベントを作成し、
 * JSON形式で{id, url}を返す
 */

/**
 * 汎用イベント作成関数（個別引数で直接実行可能）
 *
 * @param {string} title - イベントタイトル（必須）
 * @param {string} description - イベントの説明（デフォルト: ''）
 * @param {string} ownerEmail - イベント保有者のメールアドレス（デフォルト: Session.getActiveUser().getEmail()）
 * @param {string} attendees - 同行者のメールアドレス（カンマ区切り、デフォルト: ''）
 * @param {string} colorId - イベントカラーID（1-11、デフォルト: '9'=ブルー）
 * @param {Date|string} startDateTime - 開始日時（デフォルト: 現在時刻+1時間）
 * @param {Date|string} endDateTime - 終了日時（デフォルト: 開始時刻+1時間）
 * @param {string} location - 場所（デフォルト: ''）
 * @param {string} timeZone - タイムゾーン（デフォルト: 'Asia/Tokyo'）
 * @param {boolean} sendUpdates - 参加者への通知（デフォルト: true）
 * @param {Array<string>} recurrence - 繰り返しルール（RRULE形式、デフォルト: なし）
 * @param {Object} reminders - リマインダー設定（デフォルト: デフォルトのリマインダー使用）
 *
 * @returns {{id: string, url: string}} イベントIDとURL
 *
 * @example
 * // 基本的な使用例
 * const result = createGenericEvent(
 *   'ミーティング',
 *   '週次定例会議',
 *   'owner@example.com',
 *   'user1@example.com,user2@example.com',
 *   '11'
 * );
 * console.log(result); // {id: 'event_id', url: 'https://...'}
 */
function createGenericEvent(
  title,
  description = '',
  ownerEmail = null,
  attendees = '',
  colorId = '9',
  startDateTime = null,
  endDateTime = null,
  location = '',
  timeZone = 'Asia/Tokyo',
  sendUpdates = true,
  recurrence = null,
  reminders = null
) {
  const logger = createLogger('Appsheet_汎用_イベント作成');
  let status = '成功';

  try {
    // 必須パラメータのチェック
    if (!title || title.trim() === '') {
      throw new Error('タイトルは必須です');
    }

    // デフォルト値の設定
    const now = new Date();
    const defaultStartTime = new Date(now.getTime() + 60 * 60 * 1000); // 1時間後
    const defaultEndTime = new Date(defaultStartTime.getTime() + 60 * 60 * 1000); // 開始から1時間後

    const config = {
      description: description || '',
      ownerEmail: ownerEmail || Session.getActiveUser().getEmail(),
      attendees: attendees || '',
      colorId: colorId || '9',
      startDateTime: startDateTime || defaultStartTime,
      endDateTime: endDateTime || defaultEndTime,
      location: location || '',
      timeZone: timeZone || 'Asia/Tokyo',
      sendUpdates: sendUpdates !== undefined ? sendUpdates : true,
      recurrence: recurrence || null,
      reminders: reminders || { useDefault: true }
    };

    logger.info('イベント作成開始', { title, config });

    // イベントリソースの構築
    const eventResource = buildEventResource(title, config);

    // Calendar APIでイベント作成
    const result = createCalendarEvent(eventResource, config.ownerEmail, config.sendUpdates);

    logger.success('イベント作成成功', { eventId: result.id, eventUrl: result.url });
    status = '成功';

    return result;

  } catch (error) {
    status = 'エラー';
    logger.error(`イベント作成エラー: ${error.toString()}`, { stack: error.stack, title, description, ownerEmail, attendees });
    throw error;
  }
}


/**
 * Webhookエントリーポイント
 * JSONペイロードを受け取り、actionに応じて処理を振り分ける
 *
 * @param {GoogleAppsScript.Events.DoPost} e - POSTリクエスト
 * @returns {GoogleAppsScript.Content.TextOutput} JSON形式のレスポンス
 *
 * @example
 * // イベント作成のWebhookペイロード例
 * {
 *   "action": "CREATE",
 *   "title": "ミーティング",
 *   "description": "週次定例会議",
 *   "ownerEmail": "owner@example.com",
 *   "attendees": "user1@example.com,user2@example.com",
 *   "colorId": "11",
 *   "startDateTime": "2025-10-22T10:00:00+09:00",
 *   "endDateTime": "2025-10-22T11:00:00+09:00",
 *   "location": "会議室A"
 * }
 *
 * @example
 * // イベント削除のWebhookペイロード例
 * {
 *   "action": "DELETE",
 *   "ownerEmail": "owner@example.com",
 *   "eventId": "event_id_here"
 * }
 *
 * @example
 * // 不在イベント作成のWebhookペイロード例
 * {
 *   "action": "CREATE_OOO",
 *   "title": "夏季休暇",
 *   "reason": "VACATION",
 *   "ownerEmail": "user@example.com",
 *   "startDate": "2025-08-01",
 *   "endDate": "2025-08-05",
 *   "declineMessage": "この期間は休暇中です",
 *   "allDay": true
 * }
 *
 * @example
 * // 不在イベント削除のWebhookペイロード例
 * {
 *   "action": "DELETE_OOO",
 *   "ownerEmail": "user@example.com",
 *   "eventId": "event_id_here"
 * }
 */
function doPost(e) {
  const logger = createLogger('Appsheet_汎用_イベント作成');
  let status = '成功';
  let recordId = null;

  try {
    // リクエストボディのパース
    const params = JSON.parse(e.postData.contents);
    const action = params.action || 'CREATE'; // デフォルトはCREATE
    recordId = params.record_id || params.eventId || params.title;

    logger.info('Webhook受信', { action, params });

    // 重複防止チェック
    const dupPrevention = createDuplicationPrevention('Appsheet_汎用_イベント作成');
    const result = dupPrevention.executeWithRetry(recordId, () => {
      // actionに応じて処理を振り分け
      if (action === 'DELETE') {
        // イベント削除
        return deleteGenericEvent(
          params.ownerEmail,
          params.eventId,
          params.sendUpdates
        );
      } else if (action === 'CREATE_OOO') {
        // 不在イベント作成
        // 日付の文字列をDateオブジェクトに変換
        const startDate = params.startDate && typeof params.startDate === 'string'
          ? new Date(params.startDate)
          : params.startDate;
        const endDate = params.endDate && typeof params.endDate === 'string'
          ? new Date(params.endDate)
          : params.endDate;

        return createOutOfOfficeEvent(
          params.title,
          params.reason,
          params.ownerEmail,
          startDate,
          endDate,
          params.declineMessage,
          params.sendUpdates,
          params.timeZone,
          params.allDay
        );
      } else if (action === 'DELETE_OOO') {
        // 不在イベント削除
        return deleteOutOfOfficeEvent(
          params.ownerEmail,
          params.eventId,
          params.sendUpdates
        );
      } else {
        // イベント作成（デフォルト）
        // 日時の文字列をDateオブジェクトに変換
        const startDateTime = params.startDateTime && typeof params.startDateTime === 'string'
          ? new Date(params.startDateTime)
          : params.startDateTime;
        const endDateTime = params.endDateTime && typeof params.endDateTime === 'string'
          ? new Date(params.endDateTime)
          : params.endDateTime;

        // 個別引数で関数を呼び出し
        return createGenericEvent(
          params.title,
          params.description,
          params.ownerEmail,
          params.attendees,
          params.colorId,
          startDateTime,
          endDateTime,
          params.location,
          params.timeZone,
          params.sendUpdates,
          params.recurrence,
          params.reminders
        );
      }
    }, logger);

    if (result.isDuplicate) {
      status = '重複';
      logger.info('重複実行を検知', { recordId });
      return ContentService.createTextOutput(JSON.stringify({
        duplicate: true
      })).setMimeType(ContentService.MimeType.JSON);
    }

    status = '成功';
    // シンプルに {id, url} のみを返す
    return ContentService.createTextOutput(JSON.stringify(
      result.result
    )).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    status = 'エラー';
    logger.error(`doPostエラー: ${error.toString()}`, { stack: error.stack, recordId });

    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * Google Calendar APIリソースオブジェクトを構築
 * @private
 */
function buildEventResource(title, config) {
  const resource = {
    summary: title,
    description: config.description,
    start: {
      dateTime: new Date(config.startDateTime).toISOString(),
      timeZone: config.timeZone
    },
    end: {
      dateTime: new Date(config.endDateTime).toISOString(),
      timeZone: config.timeZone
    }
  };

  // 同行者の設定
  if (config.attendees && config.attendees.trim() !== '') {
    resource.attendees = config.attendees.split(',').map(email => ({
      email: email.trim()
    }));
  }

  // イベントカラーの設定
  if (config.colorId) {
    resource.colorId = String(config.colorId);
  }

  // 場所の設定
  if (config.location) {
    resource.location = config.location;
  }

  // 繰り返しルールの設定
  if (config.recurrence && Array.isArray(config.recurrence)) {
    resource.recurrence = config.recurrence;
  }

  // リマインダーの設定
  if (config.reminders) {
    resource.reminders = config.reminders;
  }

  return resource;
}


/**
 * Google Calendar APIを呼び出してイベントを作成
 * OAuth2なりすまし認証を使用
 * @private
 */
function createCalendarEvent(eventResource, ownerEmail, sendUpdates) {
  try {
    // OAuth2でownerEmailユーザーのアクセストークンを取得
    const accessToken = AuthService.getAccessTokenForUser(ownerEmail);

    // Calendar APIエンドポイント
    const calendarId = 'primary'; // プライマリカレンダー
    let apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

    // sendUpdatesパラメータの追加
    if (sendUpdates) {
      apiUrl += '?sendUpdates=all';
    }

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      payload: JSON.stringify(eventResource),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode >= 200 && responseCode < 300) {
      const result = JSON.parse(responseBody);
      return {
        id: result.id,
        url: result.htmlLink
      };
    } else {
      throw new Error(`Calendar APIエラー: Status ${responseCode}, Body: ${responseBody}`);
    }

  } catch (error) {
    throw new Error(`イベント作成失敗: ${error.toString()}`);
  }
}


/**
 * イベント削除関数（個別引数で直接実行可能）
 * OAuth2なりすまし認証を使用して指定ユーザーのイベントを削除
 *
 * @param {string} ownerEmail - イベント保有者のメールアドレス（必須）
 * @param {string} eventId - 削除するイベントID（必須）
 * @param {boolean} sendUpdates - 参加者への通知（デフォルト: true）
 *
 * @returns {{success: boolean, message: string}} 削除結果
 *
 * @example
 * // 基本的な使用例
 * const result = deleteGenericEvent(
 *   'owner@example.com',
 *   'event_id_here'
 * );
 * console.log(result); // {success: true, message: 'イベントを削除しました'}
 */
function deleteGenericEvent(
  ownerEmail,
  eventId,
  sendUpdates = true
) {
  const logger = createLogger('Appsheet_汎用_イベント作成');
  let status = '成功';

  try {
    // 必須パラメータのチェック
    if (!ownerEmail || ownerEmail.trim() === '') {
      throw new Error('ownerEmailは必須です');
    }
    if (!eventId || eventId.trim() === '') {
      throw new Error('eventIdは必須です');
    }

    logger.info('イベント削除開始', { ownerEmail, eventId });

    // Calendar APIでイベント削除
    deleteCalendarEvent(eventId, ownerEmail, sendUpdates);

    logger.success('イベント削除成功', { eventId, ownerEmail });
    status = '成功';

    return {
      success: true,
      message: 'イベントを削除しました'
    };

  } catch (error) {
    status = 'エラー';
    logger.error(`イベント削除エラー: ${error.toString()}`, { stack: error.stack, ownerEmail, eventId });
    throw error;
  }
}


/**
 * Google Calendar APIを呼び出してイベントを削除
 * OAuth2なりすまし認証を使用
 * @private
 */
function deleteCalendarEvent(eventId, ownerEmail, sendUpdates) {
  try {
    // OAuth2でownerEmailユーザーのアクセストークンを取得
    const accessToken = AuthService.getAccessTokenForUser(ownerEmail);

    // Calendar APIエンドポイント
    const calendarId = 'primary'; // プライマリカレンダー
    let apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`;

    // sendUpdatesパラメータの追加
    if (sendUpdates) {
      apiUrl += '?sendUpdates=all';
    }

    const options = {
      method: 'delete',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    // 204 No Content = 削除成功
    if (responseCode === 204) {
      return true;
    }

    // 410 Gone または 404 Not Found = 既に削除済み
    if (responseCode === 410 || responseCode === 404) {
      Logger.log(`イベントは既に削除済みです (Code: ${responseCode})`);
      return true;
    }

    // その他のエラー
    if (responseCode >= 400) {
      throw new Error(`Calendar APIエラー: Status ${responseCode}, Body: ${responseBody}`);
    }

    return true;

  } catch (error) {
    throw new Error(`イベント削除失敗: ${error.toString()}`);
  }
}


/**
 * 不在イベント作成関数（個別引数で直接実行可能）
 * Google Calendar API の Out of Office イベントを作成
 *
 * @param {string} title - 不在イベントタイトル（必須）
 * @param {string} reason - 不在理由（デフォルト: 'OTHER'）
 *                          利用可能な値: 'VACATION', 'SICK_LEAVE', 'MATERNITY_LEAVE', 'PATERNITY_LEAVE', 'OTHER'
 * @param {string} ownerEmail - イベント保有者のメールアドレス（デフォルト: Session.getActiveUser().getEmail()）
 * @param {Date|string} startDate - 開始日（必須）
 * @param {Date|string} endDate - 終了日（必須）
 * @param {string} declineMessage - 自動辞退時のメッセージ（デフォルト: ''）
 * @param {boolean} sendUpdates - 参加者への通知（デフォルト: true）
 * @param {string} timeZone - タイムゾーン（デフォルト: 'Asia/Tokyo'）
 * @param {boolean} allDay - 終日イベントとして設定（デフォルト: true）
 *
 * @returns {{id: string, url: string}} イベントIDとURL
 *
 * @example
 * // 基本的な使用例（終日休暇）
 * const result = createOutOfOfficeEvent(
 *   '夏季休暇',
 *   'VACATION',
 *   'user@example.com',
 *   new Date('2025-08-01'),
 *   new Date('2025-08-05'),
 *   'この期間は休暇中です。緊急の場合は〇〇までご連絡ください。'
 * );
 * console.log(result); // {id: 'event_id', url: 'https://...'}
 *
 * @example
 * // 病欠の例
 * const result = createOutOfOfficeEvent(
 *   '病気休暇',
 *   'SICK_LEAVE',
 *   'user@example.com',
 *   new Date('2025-10-23'),
 *   new Date('2025-10-24')
 * );
 */
function createOutOfOfficeEvent(
  title,
  reason = 'OTHER',
  ownerEmail = null,
  startDate = null,
  endDate = null,
  declineMessage = '',
  sendUpdates = true,
  timeZone = 'Asia/Tokyo',
  allDay = true
) {
  const logger = createLogger('Appsheet_汎用_イベント作成');
  let status = '成功';

  try {
    // 必須パラメータのチェック
    if (!title || title.trim() === '') {
      throw new Error('タイトルは必須です');
    }
    if (!startDate) {
      throw new Error('開始日は必須です');
    }
    if (!endDate) {
      throw new Error('終了日は必須です');
    }

    // デフォルト値の設定
    const config = {
      reason: reason || 'OTHER',
      ownerEmail: ownerEmail || Session.getActiveUser().getEmail(),
      startDate: startDate,
      endDate: endDate,
      declineMessage: declineMessage || '',
      sendUpdates: sendUpdates !== undefined ? sendUpdates : true,
      timeZone: timeZone || 'Asia/Tokyo',
      allDay: allDay !== undefined ? allDay : true
    };

    logger.info('不在イベント作成開始', { title, config });

    // 不在イベントリソースの構築
    const eventResource = buildOutOfOfficeEventResource(title, config);

    // Calendar APIで不在イベント作成
    const result = createCalendarEvent(eventResource, config.ownerEmail, config.sendUpdates);

    logger.success('不在イベント作成成功', { eventId: result.id, eventUrl: result.url });
    status = '成功';

    return result;

  } catch (error) {
    status = 'エラー';
    logger.error(`不在イベント作成エラー: ${error.toString()}`, {
      stack: error.stack,
      title,
      reason,
      ownerEmail,
      startDate,
      endDate
    });
    throw error;
  }
}


/**
 * 不在イベント削除関数（個別引数で直接実行可能）
 * 既存のdeleteGenericEventを使用（不在イベントも通常のイベントと同じ方法で削除）
 *
 * @param {string} ownerEmail - イベント保有者のメールアドレス（必須）
 * @param {string} eventId - 削除する不在イベントID（必須）
 * @param {boolean} sendUpdates - 参加者への通知（デフォルト: true）
 *
 * @returns {{success: boolean, message: string}} 削除結果
 *
 * @example
 * const result = deleteOutOfOfficeEvent(
 *   'user@example.com',
 *   'event_id_here'
 * );
 */
function deleteOutOfOfficeEvent(ownerEmail, eventId, sendUpdates = true) {
  // 不在イベントも通常イベントと同じ削除メソッドを使用
  return deleteGenericEvent(ownerEmail, eventId, sendUpdates);
}


/**
 * Google Calendar API 不在イベントリソースオブジェクトを構築
 * @private
 */
function buildOutOfOfficeEventResource(title, config) {
  const resource = {
    summary: title,
    eventType: 'outOfOffice'
  };

  // 終日イベントまたは時間指定イベント
  if (config.allDay) {
    // 終日イベント（dateフィールドを使用）
    const startDate = new Date(config.startDate);
    const endDate = new Date(config.endDate);

    // 終了日は翌日を指定（Googleカレンダーの仕様）
    endDate.setDate(endDate.getDate() + 1);

    resource.start = {
      date: formatDateOnly(startDate),
      timeZone: config.timeZone
    };
    resource.end = {
      date: formatDateOnly(endDate),
      timeZone: config.timeZone
    };
  } else {
    // 時間指定イベント（dateTimeフィールドを使用）
    resource.start = {
      dateTime: new Date(config.startDate).toISOString(),
      timeZone: config.timeZone
    };
    resource.end = {
      dateTime: new Date(config.endDate).toISOString(),
      timeZone: config.timeZone
    };
  }

  // 不在理由の設定
  resource.outOfOfficeProperties = {
    autoDeclineMode: 'declineAllConflictingInvitations',
    declineMessage: config.declineMessage || `${title}のため不在です。`
  };

  return resource;
}


/**
 * 日付を YYYY-MM-DD 形式にフォーマット
 * @private
 */
function formatDateOnly(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


/**
 * テスト関数 - 基本的なイベント作成
 */
function testCreateBasicEvent() {
  const result = createGenericEvent(
    'テストイベント',
    'これはテストイベントです',
    null, // ownerEmail - デフォルト使用
    'test@example.com',
    '11'
  );

  Logger.log('作成されたイベント:');
  Logger.log('ID: ' + result.id);
  Logger.log('URL: ' + result.url);

  return result;
}


/**
 * テスト関数 - 詳細設定付きイベント作成
 */
function testCreateDetailedEvent() {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() + 2);

  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + 1);

  const result = createGenericEvent(
    '詳細テストイベント',
    '場所とリマインダー付きのテストイベント',
    null, // ownerEmail - デフォルト使用
    'user1@example.com,user2@example.com',
    '5',
    startTime,
    endTime,
    '東京オフィス 会議室A',
    'Asia/Tokyo',
    true,
    null,
    {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1日前
        { method: 'popup', minutes: 30 } // 30分前
      ]
    }
  );

  Logger.log('作成されたイベント:');
  Logger.log('ID: ' + result.id);
  Logger.log('URL: ' + result.url);

  return result;
}


/**
 * テスト関数 - 繰り返しイベント作成
 */
function testCreateRecurringEvent() {
  const startTime = new Date();
  startTime.setHours(10, 0, 0, 0); // 10:00 AM

  const endTime = new Date(startTime);
  endTime.setHours(11, 0, 0, 0); // 11:00 AM

  const result = createGenericEvent(
    '週次ミーティング',
    '毎週月曜日の定例会議',
    null, // ownerEmail - デフォルト使用
    'team@example.com',
    '9',
    startTime,
    endTime,
    'オンライン',
    'Asia/Tokyo',
    true,
    ['RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10'] // 毎週月曜日、10回繰り返し
  );

  Logger.log('作成された繰り返しイベント:');
  Logger.log('ID: ' + result.id);
  Logger.log('URL: ' + result.url);

  return result;
}


/**
 * テスト関数 - イベント削除
 * 注意: 実行前に有効なeventIdに変更してください
 */
function testDeleteEvent() {
  // テスト用のイベントIDを設定（実際のイベントIDに変更してください）
  const testEventId = 'YOUR_EVENT_ID_HERE';
  const testOwnerEmail = Session.getActiveUser().getEmail();

  const result = deleteGenericEvent(
    testOwnerEmail,
    testEventId
  );

  Logger.log('削除結果:');
  Logger.log('Success: ' + result.success);
  Logger.log('Message: ' + result.message);

  return result;
}


/**
 * テスト関数 - イベント作成して削除（統合テスト）
 */
function testCreateAndDeleteEvent() {
  // まずイベントを作成
  Logger.log('=== イベント作成 ===');
  const createResult = createGenericEvent(
    '削除テストイベント',
    'このイベントは削除テスト用です',
    null,
    '',
    '11'
  );

  Logger.log('作成されたイベント:');
  Logger.log('ID: ' + createResult.id);
  Logger.log('URL: ' + createResult.url);

  // 少し待つ
  Utilities.sleep(2000);

  // 作成したイベントを削除
  Logger.log('\n=== イベント削除 ===');
  const deleteResult = deleteGenericEvent(
    Session.getActiveUser().getEmail(),
    createResult.id
  );

  Logger.log('削除結果:');
  Logger.log('Success: ' + deleteResult.success);
  Logger.log('Message: ' + deleteResult.message);

  return {
    created: createResult,
    deleted: deleteResult
  };
}


/**
 * テスト関数 - 不在イベント作成（終日休暇）
 */
function testCreateOutOfOfficeEvent() {
  // 明日から3日間の休暇
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 2); // 3日間

  const result = createOutOfOfficeEvent(
    'テスト休暇',
    'VACATION',
    null, // ownerEmail - デフォルト使用
    startDate,
    endDate,
    'テスト期間中は不在です。緊急の場合は〇〇までご連絡ください。',
    false // テストなので通知なし
  );

  Logger.log('作成された不在イベント:');
  Logger.log('ID: ' + result.id);
  Logger.log('URL: ' + result.url);

  return result;
}


/**
 * テスト関数 - 不在イベント作成（病欠）
 */
function testCreateSickLeaveEvent() {
  // 今日1日の病欠
  const today = new Date();

  const result = createOutOfOfficeEvent(
    'テスト病欠',
    'SICK_LEAVE',
    null, // ownerEmail - デフォルト使用
    today,
    today, // 同じ日
    '体調不良のため本日は不在です。',
    false // テストなので通知なし
  );

  Logger.log('作成された病欠イベント:');
  Logger.log('ID: ' + result.id);
  Logger.log('URL: ' + result.url);

  return result;
}


/**
 * テスト関数 - 不在イベント削除
 * 注意: 実行前に有効なeventIdに変更してください
 */
function testDeleteOutOfOfficeEvent() {
  // テスト用のイベントIDを設定（実際のイベントIDに変更してください）
  const testEventId = 'YOUR_EVENT_ID_HERE';
  const testOwnerEmail = Session.getActiveUser().getEmail();

  const result = deleteOutOfOfficeEvent(
    testOwnerEmail,
    testEventId
  );

  Logger.log('削除結果:');
  Logger.log('Success: ' + result.success);
  Logger.log('Message: ' + result.message);

  return result;
}


/**
 * テスト関数 - 不在イベント作成して削除（統合テスト）
 */
function testCreateAndDeleteOutOfOfficeEvent() {
  // まず不在イベントを作成
  Logger.log('=== 不在イベント作成 ===');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 7); // 1週間後

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1); // 2日間

  const createResult = createOutOfOfficeEvent(
    '削除テスト不在イベント',
    'OTHER',
    null,
    startDate,
    endDate,
    'このイベントは削除テスト用です',
    false // テストなので通知なし
  );

  Logger.log('作成された不在イベント:');
  Logger.log('ID: ' + createResult.id);
  Logger.log('URL: ' + createResult.url);

  // 少し待つ
  Utilities.sleep(2000);

  // 作成した不在イベントを削除
  Logger.log('\n=== 不在イベント削除 ===');
  const deleteResult = deleteOutOfOfficeEvent(
    Session.getActiveUser().getEmail(),
    createResult.id
  );

  Logger.log('削除結果:');
  Logger.log('Success: ' + deleteResult.success);
  Logger.log('Message: ' + deleteResult.message);

  return {
    created: createResult,
    deleted: deleteResult
  };
}
