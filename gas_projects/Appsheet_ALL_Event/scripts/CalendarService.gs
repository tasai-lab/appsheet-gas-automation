





const CalendarService = {

  /**

   * 新しいカレンダーイベントを作成する

   * @param {string} ownerEmail - イベント所有者のメールアドレス

   * @param {EventData} eventData - イベントデータ

   * @returns {{eventId: string, eventUrl: string}}

   */

  createEvent(ownerEmail, eventData) {

    const eventResource = this._buildEventResource(eventData);

    const result = this._callApi(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, 'post', eventResource, ownerEmail);

    Logger.info('イベント作成成功', { eventId: result.id, ownerEmail });

    return { eventId: result.id, eventUrl: result.htmlLink };

  },



  /**

   * 既存のカレンダーイベントを更新する

   * @param {string} ownerEmail - イベント所有者のメールアドレス

   * @param {string} eventId - 更新対象のイベントID

   * @param {EventData} eventData - イベントデータ

   * @returns {{eventId: string, eventUrl: string}}

   */

  updateEvent(ownerEmail, eventId, eventData) {

    const eventResource = this._buildEventResource(eventData);

    const result = this._callApi(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, 'put', eventResource, ownerEmail);

    Logger.info('イベント更新成功', { eventId: result.id, ownerEmail });

    return { eventId: result.id, eventUrl: result.htmlLink };

  },

  

  /**

   * 既存のカレンダーイベントを削除する

   * @param {string} ownerEmail - イベント所有者のメールアドレス

   * @param {string} eventId - 削除対象のイベントID

   */

  deleteEvent(ownerEmail, eventId) {

    this._callApi(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, 'delete', null, ownerEmail);

    Logger.info('イベント削除成功', { eventId, ownerEmail });

  },



  /**

   * 既存のカレンダーイベントを削除する

   * @returns {null} 削除成功時はnullを返す

   */

  deleteEvent(ownerEmail, eventId) {

    this._callApi(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, 'delete', null, ownerEmail);

    Logger.info('イベント削除成功', { eventId, ownerEmail });

    return null; // 削除成功を明示

  },



  /**

   * 既存イベントを削除し、新しい所有者で再作成する（担当者変更）

   */

  transferEvent(ownerData, eventId, eventData) {

    this.deleteEvent(ownerData.oldOwnerEmail, eventId);

    return this.createEvent(ownerData.newOwnerEmail, eventData);

  },



  /**

   * Google Calendar APIに渡すイベントリソースオブジェクトを構築する

   * @private

   * @param {EventData} data - AppSheetからのイベントデータ

   * @returns {Object} Google Calendar APIリソース

   */

  _buildEventResource(data) {

    const resource = {

      'summary': data.title,

      'description': data.details,

      'start': { 'dateTime': new Date(data.startDateTime).toISOString(), 'timeZone': 'Asia/Tokyo' },

      'end': { 'dateTime': new Date(data.endDateTime).toISOString(), 'timeZone': 'Asia/Tokyo' },

    };

    if (data.attendees && data.attendees.trim() !== '') {

      resource.attendees = data.attendees.split(',').map(email => ({ 'email': email.trim() }));

    } else {

      resource.attendees = [];

    }

    if (data.colorId) {

      resource.colorId = data.colorId;

    }

    return resource;

  },



  /**

   * Google Calendar APIを呼び出す内部関数

   * @private

   * @param {string} apiUrl

   * @param {'get'|'post'|'put'|'patch'|'delete'} method

   * @param {Object} payload

   * @param {string} impersonatingUserEmail

   * @returns {Object | null}

   */

  _callApi(apiUrl, method, payload, impersonatingUserEmail) {

    const accessToken = AuthService.getAccessTokenForUser(impersonatingUserEmail);

    const options = {

      method: method,

      contentType: 'application/json',

      headers: { 'Authorization': `Bearer ${accessToken}` },

      muteHttpExceptions: true

    };

    if (payload) {

      options.payload = JSON.stringify(payload);

    }



    const response = UrlFetchApp.fetch(apiUrl, options);

    const responseCode = response.getResponseCode();

    const responseBody = response.getContentText();



    // --- ▼▼▼ ここから修正 ▼▼▼ ---



    // DELETEメソッドの特別なエラーハンドリング

    if (method === 'delete') {

      if (responseCode === 204) { // 204: No Content (正常な削除成功)

        return null;

      }

      if (responseCode === 410 || responseCode === 404) { // 410: Gone, 404: Not Found

        // 既に削除されている場合は、エラーとせず「成功」とみなす

        Logger.info(`イベント削除API: イベントは既に削除済みでした (Code: ${responseCode})。処理を正常終了します。`, { apiUrl, responseCode, impersonatingUserEmail });

        return null; // 正常な削除としてnullを返す

      }

    }



    // --- ▲▲▲ ここまで修正 ▲▲▲ ---



    if (responseCode >= 200 && responseCode < 300) {

      return JSON.parse(responseBody);

    } else {

      Logger.error('Google Calendar APIエラー', new Error(responseBody), { apiUrl, method, responseCode, impersonatingUserEmail });

      throw new Error(`Google Calendar APIエラー: Status ${responseCode}, Body: ${responseBody}`);

    }

  }

};