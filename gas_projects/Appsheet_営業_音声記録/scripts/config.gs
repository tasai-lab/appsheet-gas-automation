/**
 * 設定管理モジュール
 * Script Propertiesから設定を取得・管理
 * 
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-17
 */

/**
 * 設定を取得
 * Script Propertiesから全ての設定値を取得
 * @returns {Object} 設定オブジェクト
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  
  return {
    // GCP設定
    gcpProjectId: props.getProperty('GCP_PROJECT_ID') || '',
    gcpLocation: props.getProperty('GCP_LOCATION') || 'us-central1',
    
    // Vertex AI設定
    vertexAIModel: props.getProperty('VERTEX_AI_MODEL') || 'gemini-2.5-pro',
    temperature: parseFloat(props.getProperty('TEMPERATURE') || '0.7'),
    maxOutputTokens: parseInt(props.getProperty('MAX_OUTPUT_TOKENS') || '8000'),
    
    // AppSheet API設定
    appId: props.getProperty('APP_ID') || '',
    accessKey: props.getProperty('ACCESS_KEY') || '',
    tableName: props.getProperty('TABLE_NAME') || 'Sales_Activities',
    
    // Google Drive設定
    sharedDriveFolderId: props.getProperty('SHARED_DRIVE_FOLDER_ID') || '1OX2l_PmpyUaqKtT77INW8o2FR6OHE9B1',
    
    // 実行ログ設定
    executionLogSpreadsheetId: props.getProperty('EXECUTION_LOG_SPREADSHEET_ID') || '',
    
    // ファイルサイズ制限（MB）
    maxFileSizeMB: parseInt(props.getProperty('MAX_FILE_SIZE_MB') || '25')
  };
}

/**
 * 必須設定のバリデーション
 * @throws {Error} - 必須設定が不足している場合
 */
function validateConfig() {
  const config = getConfig();
  const requiredFields = [
    { key: 'gcpProjectId', name: 'GCP_PROJECT_ID' }
  ];
  
  const missingFields = requiredFields
    .filter(field => !config[field.key])
    .map(field => field.name);
  
  if (missingFields.length > 0) {
    throw new Error(
      `必須設定が不足しています: ${missingFields.join(', ')}\n` +
      `Script Propertiesで設定してください。`
    );
  }
  
  return config;
}

/**
 * Vertex AI APIエンドポイントURLを取得
 * @returns {string} - Vertex AI APIエンドポイント
 */
function getVertexAIEndpoint() {
  const config = getConfig();
  // 非ストリーミングエンドポイントを使用（通話_要約生成と同じ）
  // ストリーミングAPIは分割応答を返す可能性があるため
  return `https://${config.gcpLocation}-aiplatform.googleapis.com/v1/projects/${config.gcpProjectId}/locations/${config.gcpLocation}/publishers/google/models/${config.vertexAIModel}:generateContent`;
}

/**
 * OAuth2トークンを取得
 * @returns {string} - アクセストークン
 */
function getOAuth2Token() {
  return ScriptApp.getOAuthToken();
}

/**
 * 設定のデバッグ出力（テスト用）
 * Script Propertiesの値を確認
 */
function debugConfig() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🔍 Script Properties デバッグ');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  
  Logger.log('登録されているプロパティ数: ' + Object.keys(allProps).length);
  Logger.log('');
  
  // 全てのプロパティを表示（機密情報はマスク）
  Object.keys(allProps).sort().forEach(key => {
    let value = allProps[key];
    
    // 機密情報をマスク
    if (key.includes('KEY') || key.includes('TOKEN') || key.includes('SECRET')) {
      value = value ? '***' + value.slice(-4) : '(空)';
    } else if (value && value.length > 50) {
      value = value.substring(0, 50) + '...';
    }
    
    Logger.log(`${key}: ${value || '(空)'}`);
  });
  
  Logger.log('');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 設定オブジェクトを取得して表示
  try {
    const config = getConfig();
    Logger.log('');
    Logger.log('📋 getConfig()の結果:');
    Logger.log('  gcpProjectId: ' + (config.gcpProjectId || '(空)'));
    Logger.log('  gcpLocation: ' + config.gcpLocation);
    Logger.log('  vertexAIModel: ' + config.vertexAIModel);
    Logger.log('  appId: ' + (config.appId ? '***' + config.appId.slice(-4) : '(空)'));
    Logger.log('  accessKey: ' + (config.accessKey ? '***' + config.accessKey.slice(-4) : '(空)'));
    Logger.log('  tableName: ' + config.tableName);
    Logger.log('  sharedDriveFolderId: ' + (config.sharedDriveFolderId || '(空)'));
    Logger.log('  maxFileSizeMB: ' + config.maxFileSizeMB);
  } catch (error) {
    Logger.log('❌ getConfig()エラー: ' + error.message);
  }
  
  // バリデーション結果
  Logger.log('');
  try {
    validateConfig();
    Logger.log('✅ バリデーション成功');
  } catch (error) {
    Logger.log('❌ バリデーション失敗: ' + error.message);
  }
}
