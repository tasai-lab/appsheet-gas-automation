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
  // AppSheet用にデータを変換（ステータスとVertex AI分析結果のみ）
  // usageMetadataやfileSizeなどの実行ログ用情報は除外
  const updateData = {
    activity_id: activityId,
    status: '編集中'
  };

  // Vertex AIから返された全てのフィールドを追加（実行ログ用を除く）
  const fieldsToInclude = [
    'office_impression',
    'contact_impression',
    'hearing_details',
    'knows_us',
    'our_impression',
    'knows_hours',
    'knows_job_types',
    'knows_time_diff',
    'understands_services',
    'main_partner_vhns',
    'partner_vhns_impression',
    'overall_vhns_impression',
    'coop_issue_details',
    'expectations_for_vhns',
    'info_needs_from_vhns',
    'info_needs_from_sales',
    'work_issue_details',
    'other_issue_details',
    'follow_up_task_details',
    'task_deadline',
    'next_approach',
    'next_action_date',
    'interest_level',
    'sales_frequency_plan',
    'summary'
  ];

  // 各フィールドをupdateDataに追加（nullの場合はそのまま、文字列の場合も空文字に変換しない）
  fieldsToInclude.forEach(field => {
    if (resultData.hasOwnProperty(field)) {
      updateData[field] = resultData[field];
    }
  });

  const payload = {
    Action: 'Edit',
    Properties: {
      Locale: 'ja-JP',
      Timezone: 'Asia/Tokyo'
    },
    Rows: [updateData]
  };

  const responseText = callAppSheetApi(payload);

  Logger.log(`活動ID ${activityId} を「編集中」ステータスで更新しました。`);

  return responseText;
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

  // デバッグ: 送信するペイロードをログ出力
  Logger.log('🔍 AppSheet API リクエストペイロード: ' + JSON.stringify(payload, null, 2));

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

  // レスポンスが空または不正な場合の警告
  if (!responseText || responseText.trim() === '') {
    Logger.log('⚠️ AppSheet APIのレスポンスが空です。レコードが見つからなかった可能性があります。');
    Logger.log('⚠️ 送信したキー: ' + JSON.stringify(payload.Rows[0]));
  } else {
    try {
      const responseJson = JSON.parse(responseText);
      Logger.log('✅ AppSheet API 応答解析成功: ' + JSON.stringify(responseJson, null, 2));
    } catch (e) {
      Logger.log('⚠️ AppSheet API レスポンスのJSON解析に失敗: ' + e.toString());
    }
  }

  return responseText;
}
