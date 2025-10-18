const AppSheetService = {

  sendSuccessResponse(config, eventId, eventUrl, action) {

    const rowData = {};

    rowData[config.keyColumnName] = config.rowId;

    if (config.eventIdColumnName) rowData[config.eventIdColumnName] = eventId;

    if (config.eventUrlColumnName) rowData[config.eventUrlColumnName] = eventUrl;

    
    // アクションに応じてステータスを変更する

    if (action === 'DELETE') {

      rowData.status = config.deleteStatus || '削除済'; // AppSheet側で削除時のステータスを指定可能に

    } else {

      rowData.status = config.successStatus || '予定';

    }

    
    const payload = { Action: "Edit", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

    Logger.info('AppSheetへの成功通知を送信', { rowId: config.rowId, action });

    this._callApi(config, payload);

  },


  /**

   * 処理失敗をAppSheetに通知する

   * @param {AppSheetConfig} config

   * @param {Error} error

   */

  sendErrorResponse(config, error) {

    const rowData = {};

    rowData[config.keyColumnName] = config.rowId;

    rowData.status = "エラー"; // 固定

    if (config.errorDetailsColumnName) {

      rowData[config.errorDetailsColumnName] = `GAS Script Error: ${error.message}`;

    }


    const payload = { Action: "Edit", Properties: { "Locale": "ja-JP" }, Rows: [rowData] };

    Logger.info('AppSheetへのエラー通知を送信', { rowId: config.rowId, error: error.message });

    this._callApi(config, payload);

  },


  /**

   * AppSheet APIを呼び出す内部関数

   * @private

   * @param {AppSheetConfig} config

   * @param {Object} payload

   */

  _callApi(config, payload) {

    Utilities.sleep(Math.floor(Math.random() * 2000) + 500); // 0.5〜2.5秒の待機

    const apiUrl = `https://api.appsheet.com/api/v2/apps/${config.appId}/tables/${config.tableName}/Action`;

    const options = {

      method: 'post',

      contentType: 'application/json',

      headers: { 'ApplicationAccessKey': config.accessKey },

      payload: JSON.stringify(payload),

      muteHttpExceptions: true

    };

    
    const response = UrlFetchApp.fetch(apiUrl, options);

    const responseCode = response.getResponseCode();

    const responseBody = response.getContentText();


    if (responseCode >= 400) {

      Logger.error('AppSheet APIエラー', new Error(responseBody), { apiUrl, responseCode });

      throw new Error(`AppSheet API Error: ${responseCode} - ${responseBody}`);

    } else {

       Logger.info(`AppSheet API 応答`, { responseCode, responseBody });

    }

  }

};
