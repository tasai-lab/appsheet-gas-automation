/**
 * Appsheet_名刺取り込み - 設定ファイル
 * 
 * 全ての設定値を一元管理
 * 
 * 【重要】Vertex AI API呼び出しの実装ルール:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ✅ 必ず createVertexAIRequestBody() を使用すること
 * ✅ 必ず createVertexAIFetchOptions() を使用すること
 * ❌ 直接 contents: [{...}] を記述しないこと
 * 
 * 理由: Vertex AI APIは role: 'user' プロパティが必須。
 *       手動で記述すると漏れやすく、HTTP 400エラーになる。
 *       共通関数を使うことで、正しい形式を保証する。
 * 
 * 例:
 * // ❌ 悪い例（roleプロパティが漏れやすい）
 * const requestBody = {
 *   contents: [{parts: [{ text: prompt }]}]  // role がない！
 * };
 * 
 * // ✅ 良い例（roleプロパティが自動的に含まれる）
 * const requestBody = createVertexAIRequestBody([{ text: prompt }]);
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-23
 */

// ==========================================
// Vertex AI設定
// ==========================================

const VERTEX_AI_CONFIG = {
  projectId: 'macro-shadow-458705-v8',
  location: 'us-central1',
  
  // OCR用モデル（コスト最適化: Pro → Flash Lite）
  ocrModel: 'gemini-2.5-flash-lite',
  ocrTemperature: 0.1,
  ocrMaxOutputTokens: 2048,
  
  // 事業所比較用モデル
  comparisonModel: 'gemini-2.5-flash-lite',
  comparisonTemperature: 0.0,
  comparisonMaxOutputTokens: 10,
  
  // レート制限対策
  apiCallDelayMs: 1000,  // API呼び出し間の待機時間（ミリ秒）
  maxRetries: 3,         // 429エラー時の最大リトライ回数
  retryDelayMs: 5000,    // リトライ時の待機時間（ミリ秒）
  
  // コスト計算（2025年10月時点の価格）
  // 参考: https://ai.google.dev/pricing
  pricing: {
    'gemini-2.5-flash-lite': {
      inputPer1MTokens: 0.0375,   // $0.0375 per 1M input tokens
      outputPer1MTokens: 0.15     // $0.15 per 1M output tokens
    },
    'gemini-2.0-flash-exp': {
      inputPer1MTokens: 0,        // Free tier
      outputPer1MTokens: 0
    }
  }
};

/**
 * Vertex AI APIエンドポイントを取得
 * @param {string} model - モデル名
 * @returns {string} APIエンドポイントURL
 */
function getVertexAIEndpoint(model) {
  return `https://${VERTEX_AI_CONFIG.location}-aiplatform.googleapis.com/v1/projects/${VERTEX_AI_CONFIG.projectId}/locations/${VERTEX_AI_CONFIG.location}/publishers/google/models/${model}:generateContent`;
}

/**
 * OAuth2トークンを取得
 * @returns {string} アクセストークン
 */
function getOAuth2Token() {
  return ScriptApp.getOAuthToken();
}

// ==========================================
// Google Drive設定
// ==========================================

const DRIVE_CONFIG = {
  // 名刺画像のソースフォルダー（共有ドライブ）
  sourceFolderId: '1eOzeBli1FcusgKL6MEyhnZQUoDca-RLd',
  
  // 処理済み名刺の移動先フォルダー
  destinationFolderId: '1c2fguK-hSuF_zgSFkAk9MTgPo1wcboiB',
  
  // アーカイブフォルダー（重複・エラーファイル用）
  // ※共有ドライブでは削除権限がない場合があるため、削除の代わりにここへ移動
  archiveFolderId: '17kpk5HXOS9iKCpxjxWqSXxiZiK4FHRz_',
  
  // AppSheet用フォルダーパス
  appsheetFolderPath: '名刺_格納'
};

// ==========================================
// スプレッドシート設定
// ==========================================

const SPREADSHEET_CONFIG = {
  // 関係機関スプレッドシートID
  spreadsheetId: '1ctSjcAlu9VSloPT9S9hsTyTd7yCw5XvNtF7-URyBeKo',
  
  // シート名
  contactsSheet: 'Organization_Contacts',
  organizationsSheet: 'Organizations',
  
  // 列インデックス（キャッシュ用）
  contactsColumns: null,
  organizationsColumns: null
};

/**
 * スプレッドシートを取得
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_CONFIG.spreadsheetId);
}

/**
 * 連絡先シートを取得
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getContactsSheet() {
  return getSpreadsheet().getSheetByName(SPREADSHEET_CONFIG.contactsSheet);
}

/**
 * 事業所シートを取得
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrganizationsSheet() {
  return getSpreadsheet().getSheetByName(SPREADSHEET_CONFIG.organizationsSheet);
}

// ==========================================
// AppSheet API設定
// ==========================================

const APPSHEET_CONFIG = {
  appId: '27bceb6f-9a2c-4ab6-9438-31fec25a495e',
  accessKey: 'V2-A0207-tnP4i-YwteT-Cg55O-7YBvg-zMXQX-sS4Xv-XuaKP',
  tableName: 'Organization_Contacts',
  locale: 'ja-JP',
  timezone: 'Asia/Tokyo'
};

// ==========================================
// 処理設定
// ==========================================

const PROCESSING_CONFIG = {
  // 実行時間制限（時間）
  allowedStartHour: 9,
  allowedStartMinute: 30,
  allowedEndHour: 21,
  
  // デフォルト実行者ID
  defaultCreatorId: 'SYSTEM',
  
  // デフォルトステータス
  defaultContactStatus: '在職',
  
  // ファイル名パターン
  fileNamePattern: {
    front: '{lastName}{firstName}_{lastNameKana}{firstNameKana}_{contactId}.jpg',
    back: '{lastName}{firstName}_{lastNameKana}{firstNameKana}_{contactId}_001.jpg'
  },
  
  // 名刺ペアリング用サフィックス
  backCardSuffix: '_001'
};

// ==========================================
// ログ設定
// ==========================================

const LOG_CONFIG = {
  // 詳細ログを有効化（デバッグ用）
  enableDetailedLogs: true,
  
  // エラー時のスタックトレース出力
  enableStackTrace: true,
  
  // API応答をログ出力
  logApiResponses: false
};

/**
 * 詳細ログを出力
 * @param {string} message - ログメッセージ
 * @param {Object} [data] - 追加データ
 */
function logDebug(message, data = null) {
  if (LOG_CONFIG.enableDetailedLogs) {
    Logger.log(`[DEBUG] ${message}`);
    if (data) {
      Logger.log(JSON.stringify(data, null, 2));
    }
  }
}

/**
 * エラーログを出力
 * @param {string} message - エラーメッセージ
 * @param {Error} [error] - エラーオブジェクト
 */
function logError(message, error = null) {
  Logger.log(`[ERROR] ${message}`);
  if (error && LOG_CONFIG.enableStackTrace) {
    Logger.log(`[ERROR] スタックトレース:\n${error.stack}`);
  }
}

/**
 * 情報ログを出力
 * @param {string} message - ログメッセージ
 */
function logInfo(message) {
  Logger.log(`[INFO] ${message}`);
}

// ==========================================
// 設定バリデーション
// ==========================================

/**
 * 全設定をバリデーション
 * @throws {Error} 設定が不正な場合
 */
function validateConfig() {
  const errors = [];
  
  // Vertex AI設定チェック
  if (!VERTEX_AI_CONFIG.projectId) {
    errors.push('GCP_PROJECT_IDが設定されていません');
  }
  
  // Drive設定チェック
  if (!DRIVE_CONFIG.sourceFolderId) {
    errors.push('ソースフォルダーIDが設定されていません');
  }
  
  if (!DRIVE_CONFIG.destinationFolderId) {
    errors.push('移動先フォルダーIDが設定されていません');
  }
  
  // スプレッドシート設定チェック
  if (!SPREADSHEET_CONFIG.spreadsheetId) {
    errors.push('スプレッドシートIDが設定されていません');
  }
  
  // AppSheet設定チェック
  if (!APPSHEET_CONFIG.appId || !APPSHEET_CONFIG.accessKey) {
    errors.push('AppSheet API設定が不完全です');
  }
  
  if (errors.length > 0) {
    throw new Error('設定エラー:\n' + errors.join('\n'));
  }
  
  logInfo('設定バリデーション完了');
}

/**
 * 設定をデバッグ出力
 */
function debugConfig() {
  logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logInfo('🔍 設定情報デバッグ');
  logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  logInfo('Vertex AI設定:');
  logInfo(`  Project ID: ${VERTEX_AI_CONFIG.projectId}`);
  logInfo(`  Location: ${VERTEX_AI_CONFIG.location}`);
  logInfo(`  OCR Model: ${VERTEX_AI_CONFIG.ocrModel}`);
  logInfo(`  Comparison Model: ${VERTEX_AI_CONFIG.comparisonModel}`);
  
  logInfo('Drive設定:');
  logInfo(`  Source Folder: ${DRIVE_CONFIG.sourceFolderId}`);
  logInfo(`  Destination Folder: ${DRIVE_CONFIG.destinationFolderId}`);
  
  logInfo('Spreadsheet設定:');
  logInfo(`  Spreadsheet ID: ${SPREADSHEET_CONFIG.spreadsheetId}`);
  logInfo(`  Contacts Sheet: ${SPREADSHEET_CONFIG.contactsSheet}`);
  logInfo(`  Organizations Sheet: ${SPREADSHEET_CONFIG.organizationsSheet}`);
  
  logInfo('AppSheet設定:');
  logInfo(`  App ID: ${APPSHEET_CONFIG.appId}`);
  logInfo(`  Table Name: ${APPSHEET_CONFIG.tableName}`);
  
  logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * Vertex AI用の標準リクエストボディを生成
 * ※role: 'user'プロパティを必ず含む正しい形式を保証
 * 
 * @param {Array<Object>} parts - partsの配列 [{text: "..."}, {inlineData: {...}}]
 * @param {Object} generationConfig - 生成設定（オプション）
 * @returns {Object} Vertex AI APIリクエストボディ
 */
function createVertexAIRequestBody(parts, generationConfig = {}) {
  // デフォルト設定をマージ
  const config = {
    temperature: generationConfig.temperature ?? VERTEX_AI_CONFIG.ocrTemperature,
    maxOutputTokens: generationConfig.maxOutputTokens ?? VERTEX_AI_CONFIG.ocrMaxOutputTokens,
    ...generationConfig
  };
  
  // 標準形式のリクエストボディ（role: 'user'を必ず含む）
  return {
    contents: [{
      role: 'user',  // ✅ 必須プロパティ - Vertex AI APIの仕様
      parts: parts
    }],
    generationConfig: config
  };
}

/**
 * Vertex AI API呼び出しの標準オプションを生成
 * 
 * @returns {Object} UrlFetchApp.fetchのオプション
 */
function createVertexAIFetchOptions(requestBody) {
  return {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${getOAuth2Token()}`
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };
}

/**
 * Vertex AIリクエストボディの妥当性を検証
 * ※開発時のデバッグ用。本番環境では無効化可能
 * 
 * @param {Object} requestBody - 検証するリクエストボディ
 * @throws {Error} 不正な形式の場合
 */
function validateVertexAIRequestBody(requestBody) {
  if (!LOG_CONFIG.enableDetailedLogs) {
    return; // デバッグログ無効時はスキップ
  }
  
  // contents配列の存在確認
  if (!requestBody.contents || !Array.isArray(requestBody.contents)) {
    throw new Error('❌ Vertex AIリクエストエラー: contentsプロパティが配列ではありません');
  }
  
  // 各contentのrole確認
  for (let i = 0; i < requestBody.contents.length; i++) {
    const content = requestBody.contents[i];
    
    if (!content.role) {
      throw new Error(
        `❌ Vertex AIリクエストエラー: contents[${i}]にroleプロパティがありません\n` +
        '修正方法: createVertexAIRequestBody()関数を使用してください'
      );
    }
    
    if (content.role !== 'user' && content.role !== 'model') {
      throw new Error(
        `❌ Vertex AIリクエストエラー: contents[${i}].role="${content.role}"は無効です\n` +
        '有効な値: "user" または "model"'
      );
    }
    
    if (!content.parts || !Array.isArray(content.parts)) {
      throw new Error(
        `❌ Vertex AIリクエストエラー: contents[${i}].partsが配列ではありません`
      );
    }
  }
  
  logDebug('✅ Vertex AIリクエストボディ検証: 正常');
}
