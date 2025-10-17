





/**

 * AppSheet API連携モジュール

 */



/**

 * AppSheet APIを呼び出してレコードを更新する

 * @param {Object} payload - リクエストペイロード

 * @return {Object} APIレスポンス

 */

function callAppSheetApi(payload) {

  try {

    const apiUrl = `https://api.appsheet.com/api/v2/apps/${APPSHEET_CONFIG.appId}/tables/${APPSHEET_CONFIG.tableName}/Action`;

    

    const options = {

      method: 'post',

      contentType: 'application/json',

      headers: {

        'ApplicationAccessKey': APPSHEET_CONFIG.accessKey

      },

      payload: JSON.stringify(payload),

      muteHttpExceptions: true

    };

    

    logDebug('AppSheet API呼び出し', { action: payload.Action });

    

    const response = UrlFetchApp.fetch(apiUrl, options);

    const responseCode = response.getResponseCode();

    const responseText = response.getContentText();

    

    logDebug('AppSheet API応答', { responseCode: responseCode });

    

    if (responseCode >= 400) {

      throw new Error(`AppSheet API Error: ${responseCode} - ${responseText}`);

    }

    

    // 空のレスポンス対応

    if (!responseText || responseText.trim() === '') {

      logStructured(LOG_LEVEL.WARN, 'AppSheet APIから空のレスポンス', { 

        action: payload.Action,

        responseCode: responseCode 

      });

      return { success: true, message: 'Empty response from AppSheet API' };

    }

    

    try {

      return JSON.parse(responseText);

    } catch (parseError) {

      logStructured(LOG_LEVEL.ERROR, 'AppSheet APIレスポンスJSON解析失敗', {

        responseText: responseText.substring(0, 200),

        parseError: parseError.message

      });

      throw new Error(`JSONパースエラー: ${parseError.message}`);

    }

    

  } catch (error) {

    logStructured(LOG_LEVEL.ERROR, 'AppSheet API呼び出しエラー', {

      error: error.message,

      errorCode: ERROR_CODE.APPSHEET_API_ERROR

    });

    throw new Error(`AppSheet APIの呼び出しに失敗しました: ${error.message}`);

  }

}



/**

 * 成功時にレコードを更新

 * @param {string} recordNoteId - レコードID

 * @param {Object} resultData - AI生成結果

 * @param {string} staffId - スタッフID

 * @param {string} recordType - 記録タイプ ('normal' または 'psychiatry')

 * @return {Object} APIレスポンス

 */

function updateRecordOnSuccess(recordNoteId, resultData, staffId, recordType = 'normal') {

  try {

    let rowData;

    

    if (recordType === 'psychiatry') {

      // 精神科訪問看護記録の場合

      rowData = {

        'record_note_id': recordNoteId,

        'status': '編集中',

        'updated_by': staffId,

        'client_condition': resultData.clientCondition || '',

        'daily_living_observation': resultData.dailyLivingObservation || '',

        'mental_state_observation': resultData.mentalStateObservation || '',

        'medication_adherence': resultData.medicationAdherence || '',

        'social_functional_observation': resultData.socialFunctionalObservation || '',

        'care_provided': Array.isArray(resultData.careProvided) 

          ? resultData.careProvided.join(', ') 

          : '',

        'guidance_and_advice': resultData.guidanceAndAdvice || '',

        'remarks': resultData.remarks || '',

        'summary_for_next_visit': resultData.summaryForNextVisit || ''

      };

    } else {

      // 通常の訪問看護記録の場合

      rowData = {

        'record_note_id': recordNoteId,

        'status': '編集中',

        'updated_by': staffId,

        'extracted_text': resultData.processedAudioText || '',

        'client_condition': resultData.userCondition || '',

        'guidance_and_advice': resultData.guidanceAndAdvice || '',

        'care_provided': Array.isArray(resultData.nursingAndRehabilitationItems) 

          ? resultData.nursingAndRehabilitationItems.join(', ') 

          : '',

        'remarks': resultData.specialNotes || '',

        'summary_for_next_visit': resultData.summaryForNextVisit || ''

      };

    }

    

    const payload = {

      Action: 'Edit',

      Properties: {

        'Locale': 'ja-JP',

        'Timezone': 'Asia/Tokyo'

      },

      Rows: [rowData]

    };

    

    logStructured(LOG_LEVEL.INFO, 'レコード更新成功', { 

      recordNoteId: recordNoteId, 

      recordType: recordType 

    });

    return callAppSheetApi(payload);

    

  } catch (error) {

    Logger.log(`レコード更新エラー（成功時）: ${error.toString()}`);

    throw error;

  }

}



/**

 * エラー時にレコードを更新

 * @param {string} recordNoteId - レコードID

 * @param {string} errorMessage - エラーメッセージ

 * @return {Object} APIレスポンス

 */

function updateRecordOnError(recordNoteId, errorMessage) {

  try {

    const payload = {

      Action: 'Edit',

      Properties: {

        'Locale': 'ja-JP',

        'Timezone': 'Asia/Tokyo'

      },

      Rows: [{

        'record_note_id': recordNoteId,

        'status': 'エラー',

        'error_details': `GAS Error: ${errorMessage}`

      }]

    };

    

    logStructured(LOG_LEVEL.INFO, 'レコードエラー状態更新', { recordNoteId: recordNoteId });

    return callAppSheetApi(payload);

    

  } catch (error) {

    Logger.log(`レコード更新エラー（エラー時）: ${error.toString()}`);

    // エラー更新に失敗しても例外をスローしない

    return null;

  }

}



/**

 * 処理中ステータスに更新

 * @param {string} recordNoteId - レコードID

 * @return {Object} APIレスポンス

 */

function updateRecordToProcessing(recordNoteId) {

  try {

    const payload = {

      Action: 'Edit',

      Properties: {

        'Locale': 'ja-JP',

        'Timezone': 'Asia/Tokyo'

      },

      Rows: [{

        'record_note_id': recordNoteId,

        'status': '処理中',

        'error_details': ''

      }]

    };

    

    Logger.log(`レコード更新: ${recordNoteId} - 処理中`);

    return callAppSheetApi(payload);

    

  } catch (error) {

    Logger.log(`レコード更新エラー（処理中）: ${error.toString()}`);

    // 処理中の更新に失敗しても続行

    return null;

  }

}

