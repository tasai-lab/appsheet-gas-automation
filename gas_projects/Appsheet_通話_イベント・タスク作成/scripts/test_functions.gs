/**
 * テスト関数
 * イベント作成とタスク作成のテスト関数
 * 
 * @author Fractal Group
 * @version 1.1.0
 * @date 2025-10-17
 */

/**
 * テスト用関数: イベント作成（英語パラメータ）
 * GASエディタから実行してテスト可能
 * 
 * @return {Object} 処理結果
 */
function testProcessRequestEvent() {
  const now = new Date();
  const start = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 明日
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1時間後
  
  const testParams = {
    actionId: 'test_event_' + now.getTime(),
    actionType: 'event', // 英語パラメータ
    title: 'テストイベント',
    details: 'これはテスト用のイベントです（日本時間JST）',
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    assigneeEmail: 'test@example.com', // ★要変更
    rowUrl: 'https://appsheet.com/sample'
  };
  
  Logger.log('[テスト:イベント] パラメータ:', JSON.stringify(testParams, null, 2));
  
  return processRequest(
    testParams.actionId,
    testParams.actionType,
    testParams.title,
    testParams.details,
    testParams.startDateTime,
    testParams.endDateTime,
    null,
    testParams.assigneeEmail,
    testParams.rowUrl
  );
}

/**
 * テスト用関数: タスク作成（日本語パラメータ）
 * GASエディタから実行してテスト可能
 * 
 * @return {Object} 処理結果
 */
function testProcessRequestTask() {
  const now = new Date();
  const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1週間後
  
  const testParams = {
    actionId: 'test_task_' + now.getTime(),
    actionType: 'タスク', // 日本語パラメータ
    title: 'テストタスク',
    details: 'これはテスト用のタスクです（日本時間JST）',
    dueDateTime: due.toISOString(),
    assigneeEmail: 'test@example.com' // ★要変更
  };
  
  Logger.log('[テスト:タスク] パラメータ:', JSON.stringify(testParams, null, 2));
  
  return processRequest(
    testParams.actionId,
    testParams.actionType,
    testParams.title,
    testParams.details,
    null,
    null,
    testParams.dueDateTime,
    testParams.assigneeEmail,
    null
  );
}
