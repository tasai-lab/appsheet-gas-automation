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
    vertexAIModel: props.getProperty('VERTEX_AI_MODEL') || 'gemini-2.0-flash-exp',
    temperature: parseFloat(props.getProperty('TEMPERATURE') || '0.7'),
    maxOutputTokens: parseInt(props.getProperty('MAX_OUTPUT_TOKENS') || '20000'),
    
    // AppSheet API設定
    appId: props.getProperty('APP_ID') || '',
    accessKey: props.getProperty('ACCESS_KEY') || '',
    tableName: props.getProperty('TABLE_NAME') || 'Sales_Activities',
    
    // Google Drive設定
    sharedDriveFolderId: props.getProperty('SHARED_DRIVE_FOLDER_ID') || '',
    
    // 実行ログ設定
    executionLogSpreadsheetId: props.getProperty('EXECUTION_LOG_SPREADSHEET_ID') || '',
    
    // ファイルサイズ制限（MB）
    maxFileSizeMB: parseInt(props.getProperty('MAX_FILE_SIZE_MB') || '20')
  };
}

/**
 * 必須設定のバリデーション
 * @throws {Error} - 必須設定が不足している場合
 */
function validateConfig() {
  const config = getConfig();
  const requiredFields = [
    { key: 'gcpProjectId', name: 'GCP_PROJECT_ID' },
    { key: 'appId', name: 'APP_ID' },
    { key: 'accessKey', name: 'ACCESS_KEY' }
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
 * Vertex AI APIのエンドポイントURLを生成
 * @returns {string} - Vertex AI APIエンドポイント
 */
function getVertexAIEndpoint() {
  const config = getConfig();
  return `https://${config.gcpLocation}-aiplatform.googleapis.com/v1/projects/${config.gcpProjectId}/locations/${config.gcpLocation}/publishers/google/models/${config.vertexAIModel}:streamGenerateContent`;
}

/**
 * OAuth2トークンを取得
 * @returns {string} - アクセストークン
 */
function getOAuth2Token() {
  return ScriptApp.getOAuthToken();
}
