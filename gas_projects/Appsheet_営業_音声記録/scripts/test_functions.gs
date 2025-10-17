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
 * Gemini API接続テスト（シンプルなテキストプロンプト）
 * 
 * 音声ファイルなしでGemini APIの接続を確認
 */
function testGeminiApiConnection() {
  Logger.log('=== Gemini API接続テスト開始 ===');
  
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    const requestBody = {
      contents: [{
        parts: [{
          text: 'こんにちは。接続テストです。「OK」と返答してください。'
        }]
      }],
      generationConfig: {
        temperature: 0.1
      }
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`レスポンスコード: ${responseCode}`);
    Logger.log(`レスポンス: ${responseText}`);
    
    if (responseCode === 200) {
      Logger.log('=== 接続テスト成功 ===');
      return JSON.parse(responseText);
    } else {
      throw new Error(`API Error: ${responseCode} - ${responseText}`);
    }
    
  } catch (error) {
    Logger.log('=== 接続テスト失敗 ===');
    Logger.log('エラー: ' + error.toString());
    throw error;
  }
}

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
