/**
 * 実行ログモジュール
 */
const ExecutionLogger = {
  SPREADSHEET_ID: '15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE',
  SHEET_NAME: 'シート1',
  
  /**
   * ログを記録
   * @param {string} scriptName - スクリプト名
   * @param {string} status - ステータス (SUCCESS/ERROR/WARNING)
   * @param {string} processId - 処理ID
   * @param {string} message - メッセージ
   * @param {string} errorDetail - エラー詳細
   * @param {number} executionTime - 実行時間(秒)
   * @param {Object} inputData - 入力データ
   */
  log: function(scriptName, status, processId, message, errorDetail, executionTime, inputData) {
    try {
      const ss = SpreadsheetApp.openById(this.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(this.SHEET_NAME);
      
      const timestamp = new Date();
      const user = Session.getActiveUser().getEmail();
      const inputDataStr = inputData ? JSON.stringify(inputData).substring(0, 1000) : '';
      
      sheet.appendRow([
        timestamp,
        scriptName,
        status,
        processId || '',
        message || '',
        errorDetail || '',
        executionTime || 0,
        user,
        inputDataStr
      ]);
    } catch (e) {
      Logger.log(`ログ記録エラー: ${e.message}`);
    }
  },
  
  /**
   * 成功ログ
   */
  success: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'SUCCESS', processId, message, '', executionTime, inputData);
  },
  
  /**
   * エラーログ
   */
  error: function(scriptName, processId, message, error, executionTime, inputData) {
    const errorDetail = error ? `${error.message}\n${error.stack}` : '';
    this.log(scriptName, 'ERROR', processId, message, errorDetail, executionTime, inputData);
  },
  
  /**
   * 警告ログ
   */
  warning: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'WARNING', processId, message, '', executionTime, inputData);
  }
};


/**
 * Webhook重複実行防止モジュール
 */
const DuplicationPrevention = {
  LOCK_TIMEOUT: 300000, // 5分
  CACHE_EXPIRATION: 3600, // 1時間
  
  /**
   * リクエストの重複チェック
   * @param {string} requestId - リクエストID（webhookデータのハッシュ値）
   * @return {boolean} - 処理を続行する場合はtrue
   */
  checkDuplicate: function(requestId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `processed_${requestId}`;
    
    // キャッシュチェック
    if (cache.get(cacheKey)) {
      Logger.log(`重複リクエストを検出: ${requestId}`);
      return false;
    }
    
    // ロック取得
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(this.LOCK_TIMEOUT);
      
      // 再度キャッシュチェック（ダブルチェック）
      if (cache.get(cacheKey)) {
        Logger.log(`ロック取得後、重複リクエストを検出: ${requestId}`);
        return false;
      }
      
      // 処理済みマークを設定
      cache.put(cacheKey, 'processed', this.CACHE_EXPIRATION);
      return true;
    } catch (e) {
      Logger.log(`ロック取得エラー: ${e.message}`);
      return false;
    } finally {
      lock.releaseLock();
    }
  },
  
  /**
   * リクエストIDを生成
   * @param {Object} data - Webhookデータ
   * @return {string} - リクエストID
   */
  generateRequestId: function(data) {
    const str = JSON.stringify(data);
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      str,
      Utilities.Charset.UTF_8
    ).map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
  }
};


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