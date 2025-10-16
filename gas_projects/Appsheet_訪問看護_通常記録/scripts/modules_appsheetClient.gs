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

