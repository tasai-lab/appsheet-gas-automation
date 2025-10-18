/**
 * テスト関数
 * GASエディタから直接実行してテスト可能
 */

/**
 * 営業音声分析のテスト（実際の音声ファイルを使用）
 * 
 * 使用方法:
 * 1. テストデータを設定
 * 2. GASエディタで実行
 * 3. ログで結果を確認
 */
function testProcessSalesAudioAnalysis() {
  // ★★★ テストデータを設定してください ★★★
  const testData = {
    activityId: 'TEST-001',              // テスト用活動ID
    audioFileId: 'YOUR_FILE_ID_HERE',    // Google DriveのファイルID
    salespersonName: '山田太郎',         // 営業担当者名
    contactName: '田中花子',             // 面会相手名
    orgName: '株式会社テスト'            // 訪問先機関名
  };
  
  Logger.log('=== 営業音声分析テスト開始 ===');
  Logger.log('テストデータ: ' + JSON.stringify(testData));
  
  try {
    const result = processSalesAudioAnalysisDirect(
      testData.activityId,
      testData.audioFileId,
      testData.salespersonName,
      testData.contactName,
      testData.orgName
    );
    
    Logger.log('=== テスト成功 ===');
    Logger.log('結果: ' + JSON.stringify(result, null, 2));
    
    return result;
    
  } catch (error) {
    Logger.log('=== テスト失敗 ===');
    Logger.log('エラー: ' + error.toString());
    Logger.log('スタックトレース: ' + error.stack);
    
    throw error;
  }
}

/**
 * ★★★ Google AI Studio API接続テスト削除済み ★★★
 *
 * 修正日: 2025-10-18
 * 理由: ユーザー指示「今後gemini apiを使用することが無いようにお願いします。今後、全てvertex apiを使用すること。」
 * このプロジェクトは既にVertex AI専用のため、Google AI Studio APIテスト関数を削除
 *
 * 代わりに、実際の音声ファイルでの処理テスト（testProcessSalesAudioAnalysis）を使用してください
 */

/**
 * AppSheet API接続テスト
 * 
 * Sales_Activitiesテーブルへの書き込みをテスト
 * 注意: 実際にテーブルが更新されます
 */
function testAppSheetApiConnection() {
  Logger.log('=== AppSheet API接続テスト開始 ===');
  
  const testActivityId = 'TEST-API-' + new Date().getTime();
  
  try {
    const testData = {
      activity_id: testActivityId,
      status: 'テスト',
      summary: 'API接続テストによる書き込み'
    };
    
    const payload = {
      Action: 'Add',
      Properties: {
        Locale: 'ja-JP',
        Timezone: 'Asia/Tokyo'
      },
      Rows: [testData]
    };
    
    callAppSheetApi(payload);
    
    Logger.log('=== 接続テスト成功 ===');
    Logger.log(`テストレコードID: ${testActivityId}`);
    Logger.log('※ AppSheetでレコードを確認してください');
    
    return {
      success: true,
      testActivityId: testActivityId
    };
    
  } catch (error) {
    Logger.log('=== 接続テスト失敗 ===');
    Logger.log('エラー: ' + error.toString());
    throw error;
  }
}
