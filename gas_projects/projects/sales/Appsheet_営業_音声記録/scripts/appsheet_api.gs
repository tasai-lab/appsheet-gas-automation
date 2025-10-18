/**
 * AppSheet API連携サービス
 * Sales_Activitiesテーブルの更新を実行
 * 
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-17
 */

/**
 * AppSheet設定
 */
const APP_ID = '27bceb6f-9a2c-4ab6-9438-31fec25a495e';
const ACCESS_KEY = 'V2-A0207-tnP4i-YwteT-Cg55O-7YBvg-zMXQX-sS4Xv-XuaKP';
const ACTIVITIES_TABLE_NAME = 'Sales_Activities';

/**
 * 分析成功時にAppSheetのSales_Activitiesテーブルを更新
 * 
 * @param {string} activityId - 更新対象の活動ID
 * @param {Object} resultData - AIが生成した分析結果のJSONオブジェクト
 */
function updateActivityOnSuccess(activityId, resultData) {
  // 結果データにactivity_idとstatusを追加
  const updateData = Object.assign({}, resultData, {
    activity_id: activityId,
    status: '編集中'
  });
  
  const payload = {
    Action: 'Edit',
    Properties: {
      Locale: 'ja-JP',
      Timezone: 'Asia/Tokyo'
    },
    Rows: [updateData]
  };
  
  callAppSheetApi(payload);
  
  Logger.log(`活動ID ${activityId} を「編集中」ステータスで更新しました。`);
}

/**
 * エラー発生時にAppSheetのSales_Activitiesテーブルを更新
 * 
 * @param {string} activityId - 更新対象の活動ID
 * @param {string} errorMessage - エラーメッセージ
 */
function updateActivityOnError(activityId, errorMessage) {
  const payload = {
    Action: 'Edit',
    Properties: {
      Locale: 'ja-JP',
      Timezone: 'Asia/Tokyo'
    },
    Rows: [{
      activity_id: activityId,
      status: 'エラー',
      error_details: `GAS Script Error: ${errorMessage}`
    }]
  };
  
  callAppSheetApi(payload);
  
  Logger.log(`活動ID ${activityId} を「エラー」ステータスで更新しました。`);
}

/**
 * AppSheet APIを呼び出す共通関数
 * 
 * @param {Object} payload - APIリクエストペイロード
 * @throws {Error} - API呼び出しに失敗した場合
 */
function callAppSheetApi(payload) {
  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${ACTIVITIES_TABLE_NAME}/Action`;
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      ApplicationAccessKey: ACCESS_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  Logger.log(`AppSheet API 応答: ${responseCode} - ${responseText}`);
  
  if (responseCode >= 400) {
    throw new Error(`AppSheet API Error: ${responseCode} - ${responseText}`);
  }
}
