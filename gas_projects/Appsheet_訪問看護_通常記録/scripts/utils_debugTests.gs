





﻿/**

 * 設定確認とデバッグ用のテスト関数

 * Apps Script Editorで実行してください

 */



/**

 * 現在の設定を確認

 */

function debugCurrentSettings() {

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('■ 現在の設定確認');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

  

  Logger.log('');

  Logger.log('【GCP設定】');

  Logger.log(`  projectId: ${GCP_CONFIG.projectId}`);

  Logger.log(`  location: ${GCP_CONFIG.location}`);

  Logger.log(`  bucketName: ${GCP_CONFIG.bucketName}`);

  Logger.log(`  vertexAI.model: ${GCP_CONFIG.vertexAI.model}`);

  

  Logger.log('');

  Logger.log('【Gemini API設定】');

  Logger.log(`  model: ${GEMINI_CONFIG.model}`);

  Logger.log(`  apiKey: ${GEMINI_CONFIG.apiKey.substring(0, 20)}...`);

  

  Logger.log('');

  Logger.log('【システム設定】');

  Logger.log(`  processingMode: ${SYSTEM_CONFIG.processingMode}`);

  Logger.log(`  enableAsyncProcessing: ${SYSTEM_CONFIG.enableAsyncProcessing}`);

  Logger.log(`  debugMode: ${SYSTEM_CONFIG.debugMode}`);

  

  Logger.log('');

  Logger.log('【重要】');

  if (SYSTEM_CONFIG.processingMode === 'vertex-ai') {

    Logger.log('  ✅ Vertex AIモードで動作します');

    Logger.log('  → Vertex AI API が呼ばれるはずです');

  } else {

    Logger.log('  ⚠️ Gemini APIモードで動作します');

    Logger.log('  → Generative Language API が呼ばれます');

  }

  

  Logger.log('');

  Logger.log('【OAuth Token確認】');

  try {

    const token = ScriptApp.getOAuthToken();

    Logger.log(`  ✅ OAuth Token取得成功: ${token.substring(0, 30)}...`);

  } catch (error) {

    Logger.log(`  ❌ OAuth Token取得失敗: ${error.toString()}`);

  }

  

  Logger.log('');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

}



/**

 * Vertex AI接続テスト（簡易版）

 */

function testVertexAIConnection() {

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('■ Vertex AI 接続テスト');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

  

  try {

    Logger.log('');

    Logger.log('【テスト準備】');

    Logger.log(`  プロジェクトID: ${GCP_CONFIG.projectId}`);

    Logger.log(`  リージョン: ${GCP_CONFIG.location}`);

    Logger.log(`  モデル: ${GCP_CONFIG.vertexAI.model}`);

    

    Logger.log('');

    Logger.log('【OAuth Token確認】');

    const token = ScriptApp.getOAuthToken();

    Logger.log(`  ✅ Token取得成功`);

    

    Logger.log('');

    Logger.log('【API URL構築】');

    const url = `https://${GCP_CONFIG.location}-aiplatform.googleapis.com/v1/projects/${GCP_CONFIG.projectId}/locations/${GCP_CONFIG.location}/publishers/google/models/${GCP_CONFIG.vertexAI.model}:generateContent`;

    Logger.log(`  URL: ${url}`);

    

    Logger.log('');

    Logger.log('【簡易テストリクエスト送信】');

    const requestBody = {

      contents: [{

        role: 'user',

        parts: [{ text: 'こんにちは' }]

      }],

      generationConfig: {

        temperature: 0.3,

        maxOutputTokens: 100

      }

    };

    

    const options = {

      method: 'post',

      contentType: 'application/json',

      payload: JSON.stringify(requestBody),

      headers: {

        'Authorization': `Bearer ${token}`

      },

      muteHttpExceptions: true

    };

    

    const response = UrlFetchApp.fetch(url, options);

    const responseCode = response.getResponseCode();

    const responseText = response.getContentText();

    

    Logger.log('');

    Logger.log('【レスポンス】');

    Logger.log(`  ステータスコード: ${responseCode}`);

    

    if (responseCode === 200) {

      Logger.log('  ✅ Vertex AI 接続成功！');

      const jsonResponse = JSON.parse(responseText);

      if (jsonResponse.candidates && jsonResponse.candidates.length > 0) {

        const generatedText = jsonResponse.candidates[0].content.parts[0].text;

        Logger.log(`  生成されたテキスト: ${generatedText}`);

      }

    } else {

      Logger.log('  ❌ 接続失敗');

      Logger.log(`  エラー詳細: ${responseText}`);

    }

    

    Logger.log('');

    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

    

  } catch (error) {

    Logger.log('');

    Logger.log('【エラー】');

    Logger.log(`  ❌ テスト失敗: ${error.toString()}`);

    Logger.log('');

    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

  }

}



/**

 * GCPプロジェクト紐付け確認

 */

function checkGCPProjectBinding() {

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('■ GCPプロジェクト紐付け確認');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

  

  Logger.log('');

  Logger.log('【設定ファイルの値】');

  Logger.log(`  GCP_CONFIG.projectId: ${GCP_CONFIG.projectId}`);

  Logger.log('  期待値: macro-shadow-458705-v8');

  

  if (GCP_CONFIG.projectId === 'macro-shadow-458705-v8') {

    Logger.log('  ✅ 設定ファイルは正しい');

  } else {

    Logger.log('  ❌ 設定ファイルが間違っている');

  }

  

  Logger.log('');

  Logger.log('【GASプロジェクトの紐付け確認方法】');

  Logger.log('  1. Apps Script Editor で');

  Logger.log('  2. ⚙️ プロジェクトの設定 をクリック');

  Logger.log('  3. "Google Cloud Platform (GCP) プロジェクト" セクションを確認');

  Logger.log('  4. プロジェクト番号が 894359947651 であることを確認');

  Logger.log('');

  Logger.log('  もし違う番号（例: 803533819282）の場合:');

  Logger.log('    → "プロジェクトを変更" をクリック');

  Logger.log('    → 894359947651 を入力');

  Logger.log('    → "プロジェクトを設定" をクリック');

  

  Logger.log('');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

}



/**

 * Cloud Storage接続テスト

 */

function testCloudStorageConnection() {

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('■ Cloud Storage 接続テスト');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

  

  try {

    Logger.log('');

    Logger.log('【テスト準備】');

    const bucketName = GCP_CONFIG.bucketName;

    const testFileName = 'test_' + new Date().getTime() + '.txt';

    const testBlob = Utilities.newBlob('test content from GAS', 'text/plain', testFileName);

    

    Logger.log(`  バケット名: ${bucketName}`);

    Logger.log(`  テストファイル: ${testFileName}`);

    

    Logger.log('');

    Logger.log('【アップロードテスト】');

    const uploadResult = uploadToCloudStorage(testBlob, bucketName, testFileName);

    Logger.log(`  ✅ アップロード成功`);

    Logger.log(`  GCS URI: ${uploadResult.gsUri}`);

    

    Logger.log('');

    Logger.log('【削除テスト】');

    deleteFromCloudStorage(bucketName, uploadResult.fileName);

    Logger.log(`  ✅ 削除成功`);

    

    Logger.log('');

    Logger.log('✅ Cloud Storage接続テスト完了');

    Logger.log('正しいプロジェクト (macro-shadow-458705-v8) に接続されています');

    

    Logger.log('');

    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

    

  } catch (error) {

    Logger.log('');

    Logger.log('【エラー】');

    Logger.log(`  ❌ テスト失敗: ${error.toString()}`);

    

    Logger.log('');

    Logger.log('【考えられる原因】');

    Logger.log('  1. GASプロジェクトが間違ったGCPプロジェクトに紐付いている');

    Logger.log('  2. バケットが存在しない');

    Logger.log('  3. 権限が不足している');

    

    Logger.log('');

    Logger.log('【解決方法】');

    Logger.log('  checkGCPProjectBinding() を実行して紐付けを確認してください');

    

    Logger.log('');

    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

  }

}



/**

 * すべてのテストを実行

 */

function runAllTests() {

  debugCurrentSettings();

  Logger.log('\n\n');

  

  checkGCPProjectBinding();

  Logger.log('\n\n');

  

  testCloudStorageConnection();

  Logger.log('\n\n');

  

  testVertexAIConnection();

}

