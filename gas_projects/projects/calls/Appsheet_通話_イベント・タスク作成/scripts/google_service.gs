/**
 * Googleサービス統合
 * GoogleカレンダーとGoogleタスクのAPI呼び出し
 * 
 * @author Fractal Group
 * @version 1.1.0
 * @date 2025-10-17
 */

// =================================================================
// Googleカレンダーイベント作成
// =================================================================

/**
 * Googleカレンダーにイベントを作成
 * 
 * @param {Object} params - イベント作成パラメータ
 * @param {string} params.title - イベントタイトル
 * @param {string} params.details - イベント詳細
 * @param {string} params.startDateTime - 開始日時（ISO形式、日本時間）
 * @param {string} params.endDateTime - 終了日時（ISO形式、日本時間）
 * @param {string} params.assigneeEmail - 担当者メールアドレス
 * @param {string} params.rowUrl - AppSheet行URL
 * @return {Object} 処理結果 {status, externalId, externalUrl, errorMessage}
 */
function createGoogleCalendarEvent(params) {
  const result = {
    status: 'FAILURE',
    externalId: null,
    externalUrl: null,
    errorMessage: null
  };
  
  const { title, details, startDateTime, endDateTime, assigneeEmail, rowUrl } = params;
  
  try {
    const calendarScope = ['https://www.googleapis.com/auth/calendar'];
    const servicePrefix = 'CalendarImpersonation';
    
    // 認証
    const calendarService = createOAuth2ServiceForUser(assigneeEmail, calendarScope, servicePrefix);
    const accessToken = getAccessToken(calendarService);
    
    const apiUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    
    // AppSheetのHTMLタグからURL抽出
    let cleanUrl = rowUrl || '';
    if (cleanUrl.startsWith('<a href=')) {
      cleanUrl = cleanUrl.split('"')[1];
    }
    
    const descriptionText = `${details || ''}\n\nAppSheetで詳細を確認:\n${cleanUrl}`;
    
    // 日本時間(JST)の日時オブジェクトを作成
    const startDateJST = new Date(startDateTime);
    const endDateJST = new Date(endDateTime);
    
    // イベントリソース作成（タイムゾーンを明示的にAsia/Tokyoに設定）
    const eventResource = {
      'summary': title,
      'description': descriptionText,
      'start': {
        'dateTime': startDateJST.toISOString(),
        'timeZone': 'Asia/Tokyo'
      },
      'end': {
        'dateTime': endDateJST.toISOString(),
        'timeZone': 'Asia/Tokyo'
      }
    };
    
    Logger.log(`[カレンダー] イベント作成 - 開始: ${startDateJST.toISOString()}, 終了: ${endDateJST.toISOString()}`);
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      payload: JSON.stringify(eventResource),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    if (responseCode === 200) {
      const createdEvent = JSON.parse(responseBody);
      result.status = 'SUCCESS';
      result.externalId = createdEvent.id;
      result.externalUrl = createdEvent.htmlLink;
      Logger.log(`[イベント作成成功] ID: ${result.externalId}`);
    } else {
      throw new Error(`Google Calendar APIエラー: Status ${responseCode}, Body: ${responseBody}`);
    }
    
  } catch (e) {
    result.errorMessage = e.message;
    Logger.log(`[イベント作成エラー] ${result.errorMessage}`);
  }
  
  return result;
}

// =================================================================
// Googleタスク作成
// =================================================================

/**
 * Googleタスクを作成
 * 
 * @param {Object} params - タスク作成パラメータ
 * @param {string} params.title - タスクタイトル
 * @param {string} params.details - タスク詳細
 * @param {string} params.dueDateTime - 期限日時（ISO形式、日本時間）
 * @param {string} params.assigneeEmail - 担当者メールアドレス
 * @return {Object} 処理結果 {status, externalId, externalUrl, errorMessage}
 */
function createGoogleTask(params) {
  const result = {
    status: 'FAILURE',
    externalId: null,
    externalUrl: null,
    errorMessage: null
  };
  
  const { title, details, dueDateTime, assigneeEmail } = params;
  
  try {
    const tasksScope = ['https://www.googleapis.com/auth/tasks'];
    const servicePrefix = 'TasksImpersonation';
    
    // 認証
    const tasksService = createOAuth2ServiceForUser(assigneeEmail, tasksScope, servicePrefix);
    const accessToken = getAccessToken(tasksService);
    
    const apiUrl = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks';
    
    // タスクの期限（日本時間でRFC3339形式）
    // Google Tasks APIは日付のみを使用（時刻は無視される）
    const dueDateJST = new Date(dueDateTime);
    const dueDateRFC3339 = dueDateJST.toISOString();
    
    const taskResource = {
      'title': title,
      'notes': details || '',
      'due': dueDateRFC3339
    };
    
    Logger.log(`[タスク] タスク作成 - 期限: ${dueDateRFC3339} (JST)`);
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      payload: JSON.stringify(taskResource),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    if (responseCode === 200) {
      const createdTask = JSON.parse(responseBody);
      result.status = 'SUCCESS';
      result.externalId = createdTask.id;
      result.externalUrl = createdTask.selfLink;
      Logger.log(`[タスク作成成功] ID: ${result.externalId}`);
    } else {
      throw new Error(`Google Tasks APIエラー: Status ${responseCode}, Body: ${responseBody}`);
    }
    
  } catch (e) {
    result.errorMessage = e.message;
    Logger.log(`[タスク作成エラー] ${result.errorMessage}`);
  }
  
  return result;
}
