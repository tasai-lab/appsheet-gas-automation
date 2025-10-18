/**
 * テスト関数モジュール
 * 通話要約処理の各モードをテストするための関数群
 * 
 * @author Fractal Group
 * @version 4.0.0
 * @date 2025-10-17
 */

/**
 * テスト用関数: 通常要約モード
 * callTypeとrequestIdを指定しない場合のテスト
 * GASエディタから直接実行してテスト可能
 * 
 * @return {Object} 処理結果
 */
function testProcessRequest() {
  const testParams = {
    callId: "test_" + new Date().getTime(),
    callDatetime: new Date().toISOString(),
    filePath: "test/audio.m4a",
    callContextText: "テスト通話",
    userInfoText: "テストユーザー",
    clientId: "test_client"
    // callType, requestId なし → summary_onlyモード
  };
  
  Logger.log('[テスト] パラメータ:', JSON.stringify(testParams, null, 2));
  
  const result = processCallSummary(testParams);
  
  Logger.log('[テスト] 結果:', JSON.stringify(result, null, 2));
  
  return result;
}

/**
 * テスト用関数: 新規依頼作成モード
 * callType='新規依頼'を指定した場合のテスト
 * GASエディタから直接実行してテスト可能
 * 
 * @return {Object} 処理結果
 */
function testProcessRequestCreate() {
  const testParams = {
    callId: "test_" + new Date().getTime(),
    callDatetime: new Date().toISOString(),
    filePath: "test/audio.m4a",
    callContextText: "新規依頼のテスト通話\n顧客: テスト株式会社",
    userInfoText: "営業担当: テスト太郎",
    clientId: "test_client",
    callType: "新規依頼", // 新規依頼作成モード
    creatorId: "test_creator",
    requesterId: "test_requester",
    requesterOrgId: "test_org"
  };
  
  Logger.log('[テスト:新規依頼] パラメータ:', JSON.stringify(testParams, null, 2));
  
  const result = processCallSummary(testParams);
  
  Logger.log('[テスト:新規依頼] 結果:', JSON.stringify(result, null, 2));
  
  return result;
}

/**
 * テスト用関数: 既存依頼更新モード
 * requestIdを指定した場合のテスト
 * GASエディタから直接実行してテスト可能
 * 
 * @return {Object} 処理結果
 */
function testProcessRequestUpdate() {
  const testParams = {
    callId: "test_" + new Date().getTime(),
    callDatetime: new Date().toISOString(),
    filePath: "test/audio.m4a",
    callContextText: "既存依頼の更新通話\n追加情報あり",
    userInfoText: "営業担当: テスト太郎",
    clientId: "test_client",
    requestId: "CLRQ-202510151200", // 既存依頼更新モード
    creatorId: "test_creator"
  };
  
  Logger.log('[テスト:依頼更新] パラメータ:', JSON.stringify(testParams, null, 2));
  
  const result = processCallSummary(testParams);
  
  Logger.log('[テスト:依頼更新] 結果:', JSON.stringify(result, null, 2));
  
  return result;
}
