/**

 * テストモジュール

 * システム動作確認用のテスト関数

 * @author Fractal Group

 * @version 2.0.0

 * @date 2025-10-06

 */


/**

 * 設定テスト

 * Script Propertiesの設定を確認

 */

function testConfig() {

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('🧪 設定テスト');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 設定表示

  showCurrentConfig();

  // 設定検証

  const validation = validateConfig();

  if (validation.isValid) {

    Logger.log('');

    Logger.log('✅ テスト成功: 設定は正常です');

  } else {

    Logger.log('');

    Logger.log('❌ テスト失敗: 設定に問題があります');

  }

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

}

/**

 * Vertex AI接続テスト

 * 簡単なテキスト生成でVertex AIの接続を確認

 */

function testVertexAI() {

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('🧪 Vertex AI接続テスト');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const config = getConfig();

  // 設定チェック

  if (!config.gcpProjectId) {

    Logger.log('❌ GCP_PROJECT_ID が未設定です');

    Logger.log('setupScriptProperties() を実行してください');

    return;

  }

  const endpoint = `https://${config.gcpLocation}-aiplatform.googleapis.com/v1/projects/${config.gcpProjectId}/locations/${config.gcpLocation}/publishers/google/models/${config.vertexAIModel}:generateContent`;

  const requestBody = {

    contents: [{

      role: 'user',  // 🔴 重要: roleは必須パラメータ

      parts: [{ text: 'こんにちは。簡単な挨拶を返してください。' }]

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

      'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`

    },

    muteHttpExceptions: true

  };

  try {

    Logger.log('');

    Logger.log('[接続テスト] API呼び出し中...');

    const response = UrlFetchApp.fetch(endpoint, options);

    const statusCode = response.getResponseCode();

    const responseText = response.getContentText();

    Logger.log(`[接続テスト] ステータスコード: ${statusCode}`);

    if (statusCode === 200) {

      const result = JSON.parse(responseText);

      if (result.candidates && result.candidates[0]) {

        const text = result.candidates[0].content.parts[0].text;

        Logger.log('');

        Logger.log('✅ Vertex AI接続成功');

        Logger.log(`レスポンス: ${text}`);

      } else {

        Logger.log('⚠️ レスポンス形式が予期しないものです');

        Logger.log(responseText.substring(0, 500));

      }

    } else {

      Logger.log('');

      Logger.log(`❌ API接続失敗 (HTTP ${statusCode})`);

      Logger.log(responseText.substring(0, 1000));

    }

  } catch (error) {

    Logger.log('');

    Logger.log(`❌ テスト失敗: ${error.message}`);

  }

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

}


/**

 * Cloud Storage接続テスト

 * vertexai.jsの内部関数を使用したテスト

 */

function testCloudStorage() {

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('🧪 Cloud Storage接続テスト');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const config = getConfig();

  if (!config.gcpBucketName) {

    Logger.log('❌ GCP_BUCKET_NAME が未設定です');

    Logger.log('setupScriptProperties() を実行してください');

    return;

  }

  try {

    // テストファイル作成

    const testContent = 'テストファイル - ' + new Date().toISOString();

    const testBlob = Utilities.newBlob(testContent, 'text/plain', 'test.txt');

    Logger.log('');

    Logger.log('[テスト] アップロード中...');

    // アップロード（直接API呼び出し）

    const timestamp = new Date().getTime();

    const fileName = `test_${timestamp}.txt`;

    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${config.gcpBucketName}/o?uploadType=media&name=${encodeURIComponent(fileName)}`;

    const uploadOptions = {

      method: 'post',

      contentType: 'text/plain',

      payload: testBlob.getBytes(),

      headers: {

        'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`

      },

      muteHttpExceptions: true

    };

    const uploadResponse = UrlFetchApp.fetch(uploadUrl, uploadOptions);

    if (uploadResponse.getResponseCode() !== 200) {

      throw new Error(`アップロード失敗: HTTP ${uploadResponse.getResponseCode()}`);

    }

    const gsUri = `gs://${config.gcpBucketName}/${fileName}`;

    Logger.log(`✅ アップロード成功: ${gsUri}`);

    // 削除

    Logger.log('[テスト] 削除中...');

    const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${config.gcpBucketName}/o/${encodeURIComponent(fileName)}`;

    const deleteOptions = {

      method: 'delete',

      headers: {

        'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`

      },

      muteHttpExceptions: true

    };

    UrlFetchApp.fetch(deleteUrl, deleteOptions);

    Logger.log('');

    Logger.log('✅ Cloud Storage接続テスト成功');

  } catch (error) {

    Logger.log('');

    Logger.log(`❌ テスト失敗: ${error.message}`);

  }

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

}


/**

 * Webhookテスト

 * doPost関数の動作を確認

 * ⚠️ 注意: 実際のファイルIDを指定してください

 */

function testWebhook() {

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('🧪 Webhookテスト');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('');

  Logger.log('⚠️ 注意: 実際のGoogle DriveファイルIDを指定してください');

  Logger.log('');

  const testData = {

    callId: "test_" + new Date().getTime(),

    fileId: "YOUR_TEST_FILE_ID",  // ★ 実際のファイルIDに置き換え

    clientId: "test_client",

    callDatetime: new Date().toISOString(),

    callContextText: "テスト通話: システム動作確認",

    userInfoText: "テストユーザー: システム管理者"

  };

  const e = {

    postData: {

      contents: JSON.stringify(testData)

    }

  };

  Logger.log('[テストデータ]');

  Logger.log(JSON.stringify(testData, null, 2));

  Logger.log('');

  if (testData.fileId === "YOUR_TEST_FILE_ID") {

    Logger.log('❌ fileId を実際のGoogle DriveファイルIDに置き換えてください');

    Logger.log('');

    Logger.log('手順:');

    Logger.log('1. Google Driveで音声ファイルを右クリック');

    Logger.log('2. 「リンクを取得」');

    Logger.log('3. URLの /d/[FILE_ID]/view から FILE_ID をコピー');

    Logger.log('4. この関数のfileIdに貼り付け');

    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return;

  }

  try {

    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    Logger.log('[処理開始]');

    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const result = doPost(e);

    const content = result.getContent();

    Logger.log('');

    Logger.log('[処理結果]');

    Logger.log(content);

    Logger.log('');

    Logger.log('✅ Webhookテスト完了');

  } catch (error) {

    Logger.log('');

    Logger.log(`❌ テスト失敗: ${error.message}`);

    Logger.log(error.stack);

  }

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

}


/**

 * 重複リクエスト対策のテスト

 */

function testDuplicateRequestPrevention() {

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  Logger.log('🧪 重複リクエスト対策テスト');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const testCallId = 'TEST-DUPLICATE-' + new Date().getTime();

  Logger.log('');

  Logger.log(`[テスト通話ID] ${testCallId}`);

  Logger.log('');

  // テスト1: 初回リクエスト

  Logger.log('[テスト1] 初回リクエスト');

  const isDuplicate1 = isDuplicateRequest(testCallId);

  Logger.log(`結果: ${isDuplicate1 ? '❌ 重複' : '✅ 新規'}`);

  if (isDuplicate1) {

    Logger.log('❌ 初回リクエストが重複と判定されました（異常）');

    clearProcessingState(testCallId);

    return;

  }

  // 処理中としてマーク

  markAsProcessing(testCallId);

  Logger.log('');

  Logger.log('[テスト2] 処理中の重複リクエスト');

  const isDuplicate2 = isDuplicateRequest(testCallId);

  Logger.log(`結果: ${isDuplicate2 ? '✅ 重複検出' : '❌ 検出失敗'}`);

  if (!isDuplicate2) {

    Logger.log('❌ 処理中の重複リクエストが検出されませんでした（異常）');

    clearProcessingState(testCallId);

    return;

  }

  // 完了としてマーク

  markAsCompleted(testCallId);

  Logger.log('');

  Logger.log('[テスト3] 完了後の重複リクエスト');

  const isDuplicate3 = isDuplicateRequest(testCallId);

  Logger.log(`結果: ${isDuplicate3 ? '✅ 重複検出' : '❌ 検出失敗'}`);

  if (!isDuplicate3) {

    Logger.log('❌ 完了後の重複リクエストが検出されませんでした（異常）');

    clearProcessingState(testCallId);

    return;

  }

  // クリーンアップ

  clearProcessingState(testCallId);

  Logger.log('');

  Logger.log('[テスト4] クリア後のリクエスト');

  const isDuplicate4 = isDuplicateRequest(testCallId);

  Logger.log(`結果: ${isDuplicate4 ? '❌ 重複' : '✅ 新規'}`);

  if (isDuplicate4) {

    Logger.log('❌ クリア後も重複と判定されました（異常）');

    return;

  }

  Logger.log('');

  Logger.log('✅ 重複リクエスト対策テスト成功');

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

}

/**

 * 全テストを実行

 */

function runAllTests() {

  Logger.log('');

  Logger.log('╔═══════════════════════════════════════════╗');

  Logger.log('║   通話音声処理システム - 全テスト実行     ║');

  Logger.log('╚═══════════════════════════════════════════╝');

  Logger.log('');

  // 1. 設定テスト

  testConfig();

  Logger.log('');

  // 2. Vertex AIテスト

  testVertexAI();

  Logger.log('');

  // 3. Cloud Storageテスト (設定されている場合のみ)

  const config = getConfig();

  if (config.gcpBucketName) {

    testCloudStorage();

    Logger.log('');

  }

  // 4. 通知テスト

  if (config.emailNotificationEnabled && config.errorNotificationEmail) {

    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    Logger.log('🧪 通知テスト');

    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    sendTestNotification();

    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    Logger.log('');

  }

  Logger.log('╔═══════════════════════════════════════════╗');

  Logger.log('║           全テスト実行完了                ║');

  Logger.log('╚═══════════════════════════════════════════╝');

}
