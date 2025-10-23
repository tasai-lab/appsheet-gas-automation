/**
 * AppSheet API統合サービス
 * OrganizationsテーブルのCRUD操作を管理
 */

/**
 * Organizationsテーブルを更新する
 * @param {string} orgId - 組織ID
 * @param {Object} placeData - Places APIから取得したデータ
 */
function updateOrganization(orgId, placeData) {
  const debugLogger = createDebugLogger('updateOrganization');
  const apiStartTime = new Date();

  debugLogger.logStep('AppSheet更新開始', { orgId: orgId });
  console.log(`AppSheet更新開始: org_id=${orgId}`);

  // placeDataに org_id と info_accuracy を追加
  const rowData = {
    org_id: orgId,
    postal_code: placeData.postal_code,
    address: placeData.address,
    latlong: placeData.latlong,
    main_phone: placeData.main_phone,
    website_url: placeData.website_url,
    operating_hours: placeData.operating_hours,
    info_accuracy: '確認済'
  };

  debugLogger.debug('更新データ準備', rowData);

  // null値のフィールドを除外
  const cleanedRowData = {};
  for (const key in rowData) {
    if (rowData[key] !== null && rowData[key] !== undefined) {
      cleanedRowData[key] = rowData[key];
    }
  }

  debugLogger.debug('null値除外後', {
    originalFields: Object.keys(rowData).length,
    cleanedFields: Object.keys(cleanedRowData).length,
    removedFields: Object.keys(rowData).filter(k => !cleanedRowData.hasOwnProperty(k))
  });

  const payload = {
    Action: 'Edit',
    Properties: APPSHEET_API_CONFIG.properties,
    Rows: [cleanedRowData]
  };

  console.log('AppSheet APIペイロード:', JSON.stringify(payload, null, 2));

  const apiUrl = `${APPSHEET_API_CONFIG.baseUrl}/apps/${APPSHEET_APP_ID}/tables/${ORGANIZATIONS_TABLE_NAME}/Action`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'ApplicationAccessKey': APPSHEET_ACCESS_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  debugLogger.logApiRequest('AppSheet', 'POST', apiUrl, payload, options.headers);

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    const apiDuration = new Date() - apiStartTime;

    console.log(`AppSheet API レスポンス: ${responseCode} - ${responseBody}`);

    debugLogger.logApiResponse('AppSheet', responseCode, responseBody.length > 500 ? { preview: responseBody.substring(0, 500) } : JSON.parse(responseBody), apiDuration);

    if (responseCode >= 400) {
      debugLogger.error('AppSheet APIエラー', {
        statusCode: responseCode,
        responseBody: responseBody
      });
      throw new Error(`AppSheet API エラー: ${responseCode} - ${responseBody}`);
    }

    debugLogger.info('AppSheet更新成功', {
      orgId: orgId,
      duration: `${apiDuration}ms`
    });

    console.log('AppSheet更新成功');

  } catch (error) {
    debugLogger.error('AppSheet API呼び出しエラー', {
      error: error.toString(),
      stack: error.stack
    });
    console.error(`AppSheet API 呼び出しエラー: ${error.toString()}`);
    throw error;
  }
}

/**
 * AppSheet APIを直接呼び出す汎用関数
 * @param {string} action - アクション名 (Add/Edit/Delete/Find)
 * @param {Array} rows - 処理対象の行データ
 * @returns {Object} APIレスポンス
 */
function callAppSheetApi(action, rows) {
  const payload = {
    Action: action,
    Properties: APPSHEET_API_CONFIG.properties,
    Rows: rows
  };

  const apiUrl = `${APPSHEET_API_CONFIG.baseUrl}/apps/${APPSHEET_APP_ID}/tables/${ORGANIZATIONS_TABLE_NAME}/Action`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'ApplicationAccessKey': APPSHEET_ACCESS_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    console.log(`AppSheet API レスポンス: ${responseCode}`);

    if (responseCode >= 400) {
      throw new Error(`AppSheet API エラー: ${responseCode} - ${responseBody}`);
    }

    return JSON.parse(responseBody);

  } catch (error) {
    console.error(`AppSheet API 呼び出しエラー: ${error.toString()}`);
    throw error;
  }
}
