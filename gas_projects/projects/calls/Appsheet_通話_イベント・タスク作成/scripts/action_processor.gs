/**
 * アクション処理プロセッサ
 * イベント/タスク作成のメインロジックと分岐処理
 * 
 * @author Fractal Group
 * @version 1.1.0
 * @date 2025-10-17
 */

/**
 * メイン処理関数（統合版）
 * actionTypeによりイベント作成またはタスク作成に分岐
 * 
 * @param {string} actionId - アクションID
 * @param {string} actionType - アクションタイプ（'event'/'イベント' または 'task'/'タスク'）
 * @param {string} title - タイトル
 * @param {string} details - 詳細
 * @param {string} startDateTime - 開始日時（イベント用、日本時間JST ISO形式）
 * @param {string} endDateTime - 終了日時（イベント用、日本時間JST ISO形式）
 * @param {string} dueDateTime - 期限日時（タスク用、日本時間JST ISO形式）
 * @param {string} assigneeEmail - 担当者メールアドレス
 * @param {string} rowUrl - AppSheet行URL
 * @return {Object} 処理結果
 */
function processRequest(
  actionId,
  actionType,
  title,
  details,
  startDateTime,
  endDateTime,
  dueDateTime,
  assigneeEmail,
  rowUrl
) {
  Logger.log(`[処理開始] actionId: ${actionId}, actionType: ${actionType}, title: ${title}`);
  
  try {
    // 基本パラメータ検証
    if (!actionId || !actionType || !title || !assigneeEmail) {
      throw new Error('必須パラメータ（actionId, actionType, title, assigneeEmail）が不足しています');
    }
    
    // actionTypeの正規化
    const normalizedActionType = (actionType || '').toLowerCase().trim();
    
    let result;
    
    // アクションタイプによる分岐（日本語にも対応）
    if (normalizedActionType === 'event' || normalizedActionType === 'イベント') {
      Logger.log('[処理モード] Googleカレンダーイベント作成');
      
      // イベント用パラメータ検証
      if (!startDateTime || !endDateTime) {
        throw new Error('イベント作成には startDateTime と endDateTime が必要です');
      }
      
      result = createGoogleCalendarEvent({
        title,
        details,
        startDateTime,
        endDateTime,
        assigneeEmail,
        rowUrl
      });
      
    } else if (normalizedActionType === 'task' || normalizedActionType === 'タスク') {
      Logger.log('[処理モード] Googleタスク作成');
      
      // タスク用パラメータ検証
      if (!dueDateTime) {
        throw new Error('タスク作成には dueDateTime が必要です');
      }
      
      result = createGoogleTask({
        title,
        details,
        dueDateTime,
        assigneeEmail
      });
      
    } else {
      throw new Error(`未対応のアクションタイプ: ${actionType}（'event'/'イベント' または 'task'/'タスク' を指定してください）`);
    }
    
    // 成功時のAppSheet更新
    if (result.status === 'SUCCESS') {
      updateActionOnSuccess(actionId, result.externalId, result.externalUrl);
      Logger.log(`[処理完了] ${normalizedActionType} ID: ${result.externalId}`);
      
      return {
        success: true,
        actionId: actionId,
        actionType: normalizedActionType,
        externalId: result.externalId,
        externalUrl: result.externalUrl
      };
      
    } else {
      throw new Error(result.errorMessage || '不明なエラー');
    }
    
  } catch (error) {
    Logger.log(`[エラー] ${error.message}`);
    
    if (actionId) {
      updateActionOnError(actionId, error.message);
    }
    
    return {
      success: false,
      actionId: actionId,
      error: error.message
    };
  }
}
