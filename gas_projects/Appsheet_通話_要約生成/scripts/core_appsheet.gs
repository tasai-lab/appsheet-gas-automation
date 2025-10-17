





/**

 * AppSheet API連携モジュール

 * Call_Logs と Call_Actions テーブルの更新

 * 

 * @author Fractal Group

 * @version 2.0.0

 * @date 2025-10-06

 */



/**

 * 通話ログを更新

 * Call_Logsテーブルに文字起こしと要約を記録

 * 

 * @param {string} callId - 通話ID

 * @param {string} transcript - 全文文字起こし

 * @param {string} summary - 要約

 * @param {string} recordingFileId - 録音ファイルID

 * @param {string} recordingFileUrl - 録音ファイルURL

 * @param {Object} config - 設定オブジェクト

 */

function updateCallLog(callId, transcript, summary, recordingFileId, recordingFileUrl, config) {

  const payload = {

    Action: "Edit",

    Properties: {

      "Locale": "ja-JP",

      "Timezone": "Asia/Tokyo"

    },

    Rows: [{

      "call_id": callId,

      "full_transcript": transcript,

      "summary_transcript": summary,

      "recording_file_id": recordingFileId,

      "recording_file_url": recordingFileUrl,

      "status": "完了"

    }]

  };

  

  Logger.log(`[AppSheet] Call_Logs更新: ${callId}`);

  Logger.log(`[AppSheet] ファイルID: ${recordingFileId}`);

  Logger.log(`[AppSheet] ファイルURL: ${recordingFileUrl}`);

  callAppSheetAPI(config.logsTableName, payload, config);

}



/**

 * アクションを追加

 * Call_Actionsテーブルに抽出されたアクションを追加

 * 

 * @param {string} callId - 通話ID

 * @param {string} clientId - クライアントID

 * @param {Array} actions - アクション配列

 * @param {Object} config - 設定オブジェクト

 */

function addCallActions(callId, clientId, actions, config) {

  if (!actions || actions.length === 0) {

    Logger.log('[AppSheet] アクションなし - スキップ');

    return;

  }

  

  const rows = actions.map(action => {

    // 日時をJST形式に変換

    let jstStartTime = null;

    if (action.start_datetime) {

      try {

        const utcDate = new Date(action.start_datetime);

        if (!isNaN(utcDate.getTime())) {

          jstStartTime = Utilities.formatDate(

            utcDate, 

            "Asia/Tokyo", 

            "yyyy/MM/dd HH:mm:ss"

          );

        } else {

          Logger.log(`⚠️ 無効な日時: ${action.start_datetime}`);

        }

      } catch (error) {

        Logger.log(`⚠️ 日時変換エラー: ${action.start_datetime} - ${error.message}`);

      }

    }

    

    return {

      "call_id": callId,

      "client_id": clientId || null,

      "title": action.title,

      "details": action.details,

      "action_type": action.action_type,

      "status": "編集待ち",

      "assignee_id": action.assignee_id || null,

      "start_datetime": jstStartTime,

      "duration_minutes": action.duration_minutes || null

    };

  });

  

  const payload = {

    Action: "Add",

    Properties: {

      "Locale": "ja-JP",

      "Timezone": "Asia/Tokyo"

    },

    Rows: rows

  };

  

  Logger.log(`[AppSheet] Call_Actions追加: ${rows.length}件`);

  callAppSheetAPI(config.actionsTableName, payload, config);

}



/**

 * AppSheet APIを呼び出し

 * 共通API呼び出し関数

 * 

 * @param {string} tableName - テーブル名

 * @param {Object} payload - リクエストペイロード

 * @param {Object} config - 設定オブジェクト

 */

function callAppSheetAPI(tableName, payload, config) {

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${config.appsheetAppId}/tables/${tableName}/Action`;

  

  const options = {

    method: 'post',

    contentType: 'application/json',

    headers: {

      'ApplicationAccessKey': config.appsheetAccessKey

    },

    payload: JSON.stringify(payload),

    muteHttpExceptions: true

  };

  

  try {

    const response = UrlFetchApp.fetch(apiUrl, options);

    const statusCode = response.getResponseCode();

    const responseText = response.getContentText();

    

    Logger.log(`[AppSheet API] ${tableName} - Status: ${statusCode}`);

    

    // 200番台以外はエラー

    if (statusCode < 200 || statusCode >= 300) {

      throw new Error(

        `AppSheet APIエラー\n` +

        `テーブル: ${tableName}\n` +

        `ステータス: ${statusCode}\n` +

        `レスポンス: ${responseText}`

      );

    }

    

    Logger.log(`[AppSheet API] ${tableName} - 更新成功`);

    

  } catch (error) {

    Logger.log(`[AppSheet API] ${tableName} - エラー: ${error.message}`);

    throw error;

  }

}



/**

 * エラーを記録

 * Call_Logsテーブルにエラー情報を記録

 * 

 * @param {string} callId - 通話ID

 * @param {string} errorMessage - エラーメッセージ

 * @param {Object} config - 設定オブジェクト

 */

function recordError(callId, errorMessage, config) {

  // callIdが不明な場合はスキップ

  if (!callId || callId === 'ID解析不能' || callId === 'ID不明') {

    Logger.log('[AppSheet] callId不明のためエラー記録をスキップ');

    return;

  }

  

  const payload = {

    Action: "Edit",

    Properties: {

      "Locale": "ja-JP",

      "Timezone": "Asia/Tokyo"

    },

    Rows: [{

      "call_id": callId,

      "status": "エラー",

      "error_details": `GAS処理エラー: ${errorMessage}`

    }]

  };

  

  try {

    Logger.log(`[AppSheet] エラー記録: ${callId}`);

    callAppSheetAPI(config.logsTableName, payload, config);

  } catch (error) {

    Logger.log(`[AppSheet] エラー記録失敗: ${error.message}`);

  }

}

