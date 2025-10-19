/**
 * スクリプトプロパティ管理モジュール
 *
 * 全プロジェクトで共通のスクリプトプロパティ管理機能を提供
 * - スクリプトプロパティの設定・取得・削除
 * - 重複回避機能のon/off切り替え
 * - 一括初期化機能
 *
 * @author Fractal Group
 * @version 1.0.0
 * @date 2025-10-20
 */

/**
 * スクリプトプロパティの設定
 * @param {string} key - プロパティキー
 * @param {string} value - プロパティ値
 */
function setScriptProperty(key, value) {
  try {
    PropertiesService.getScriptProperties().setProperty(key, value);
    Logger.log(`[Script Property] 設定成功: ${key} = ${value}`);
  } catch (error) {
    Logger.log(`[Script Property] 設定失敗: ${key}, エラー: ${error.message}`);
    throw error;
  }
}

/**
 * スクリプトプロパティの取得
 * @param {string} key - プロパティキー
 * @param {string} [defaultValue=''] - デフォルト値
 * @return {string} プロパティ値
 */
function getScriptProperty(key, defaultValue = '') {
  try {
    const value = PropertiesService.getScriptProperties().getProperty(key);
    return value !== null ? value : defaultValue;
  } catch (error) {
    Logger.log(`[Script Property] 取得失敗: ${key}, エラー: ${error.message}`);
    return defaultValue;
  }
}

/**
 * スクリプトプロパティの削除
 * @param {string} key - プロパティキー
 */
function deleteScriptProperty(key) {
  try {
    PropertiesService.getScriptProperties().deleteProperty(key);
    Logger.log(`[Script Property] 削除成功: ${key}`);
  } catch (error) {
    Logger.log(`[Script Property] 削除失敗: ${key}, エラー: ${error.message}`);
    throw error;
  }
}

/**
 * 複数のスクリプトプロパティを一括設定
 * @param {Object} properties - キーと値のペア
 */
function setScriptProperties(properties) {
  try {
    // バリデーション: undefinedやnullのキー・値を除外
    const validProperties = {};
    let skippedCount = 0;

    for (const key in properties) {
      const value = properties[key];

      // キーと値のチェック
      if (!key || key === 'undefined' || key === 'null') {
        Logger.log(`[Script Property] 警告: 不正なキーをスキップ: ${key}`);
        skippedCount++;
        continue;
      }

      if (value === undefined || value === null) {
        Logger.log(`[Script Property] 警告: 不正な値をスキップ: ${key} = ${value}`);
        skippedCount++;
        continue;
      }

      // 値を文字列に変換
      validProperties[key] = String(value);
    }

    if (Object.keys(validProperties).length === 0) {
      throw new Error('有効なプロパティがありません。全てスキップされました。');
    }

    // 一括設定を実行
    PropertiesService.getScriptProperties().setProperties(validProperties);
    Logger.log(`[Script Property] 一括設定成功: ${Object.keys(validProperties).length}件` +
      (skippedCount > 0 ? ` (スキップ: ${skippedCount}件)` : ''));
  } catch (error) {
    Logger.log(`[Script Property] 一括設定失敗: ${error.message}`);
    Logger.log(`[Script Property] デバッグ情報: ${JSON.stringify(properties)}`);
    throw error;
  }
}

/**
 * 全スクリプトプロパティを取得
 * @return {Object} 全プロパティのキーと値
 */
function getAllScriptProperties() {
  try {
    return PropertiesService.getScriptProperties().getProperties();
  } catch (error) {
    Logger.log(`[Script Property] 全取得失敗: ${error.message}`);
    return {};
  }
}

/**
 * スクリプトプロパティの一覧を表示
 */
function listScriptProperties() {
  const properties = getAllScriptProperties();
  Logger.log('=== スクリプトプロパティ一覧 ===');

  if (Object.keys(properties).length === 0) {
    Logger.log('(プロパティが設定されていません)');
    return;
  }

  for (const key in properties) {
    const value = properties[key];
    // パスワードやAPIキーなどの機密情報をマスク
    const maskedValue = shouldMaskValue(key) ? maskValue(value) : value;
    Logger.log(`${key}: ${maskedValue}`);
  }
}

/**
 * 値をマスクすべきかを判定
 * @private
 * @param {string} key - プロパティキー
 * @return {boolean} マスクすべきか
 */
function shouldMaskValue(key) {
  const sensitiveKeys = [
    'API_KEY',
    'APIKEY',
    'PASSWORD',
    'SECRET',
    'TOKEN',
    'ACCESS_KEY',
    'PRIVATE_KEY'
  ];

  const upperKey = key.toUpperCase();
  return sensitiveKeys.some(sensitiveKey => upperKey.includes(sensitiveKey));
}

/**
 * 値をマスク表示
 * @private
 * @param {string} value - 元の値
 * @return {string} マスクされた値
 */
function maskValue(value) {
  if (!value || value.length === 0) return '';
  if (value.length <= 8) return '***';

  const start = value.substring(0, 4);
  const end = value.substring(value.length - 4);
  return `${start}...${end}`;
}

// ========================================
// 重複回避機能のon/off管理
// ========================================

const DUPLICATION_PREVENTION_KEY = 'ENABLE_DUPLICATION_PREVENTION';

/**
 * 重複回避機能を有効化
 */
function enableDuplicationPrevention() {
  setScriptProperty(DUPLICATION_PREVENTION_KEY, 'true');
  Logger.log('[重複回避] 機能を有効化しました');
}

/**
 * 重複回避機能を無効化
 */
function disableDuplicationPrevention() {
  setScriptProperty(DUPLICATION_PREVENTION_KEY, 'false');
  Logger.log('[重複回避] 機能を無効化しました');
}

/**
 * 重複回避機能が有効かを確認
 * @return {boolean} 有効ならtrue、無効ならfalse
 */
function isDuplicationPreventionEnabled() {
  const value = getScriptProperty(DUPLICATION_PREVENTION_KEY, 'true');
  return value === 'true';
}

/**
 * 重複回避機能の状態を表示
 */
function showDuplicationPreventionStatus() {
  const enabled = isDuplicationPreventionEnabled();
  Logger.log('[重複回避] 現在の状態: ' + (enabled ? '有効' : '無効'));
  return enabled;
}

// ========================================
// 書類全文出力機能のon/off管理
// ========================================

const FULL_TEXT_OUTPUT_KEY = 'ENABLE_FULL_TEXT_OUTPUT';

/**
 * 書類全文出力を有効化
 */
function enableFullTextOutput() {
  setScriptProperty(FULL_TEXT_OUTPUT_KEY, 'true');
  Logger.log('[全文出力] 機能を有効化しました');
}

/**
 * 書類全文出力を無効化
 */
function disableFullTextOutput() {
  setScriptProperty(FULL_TEXT_OUTPUT_KEY, 'false');
  Logger.log('[全文出力] 機能を無効化しました');
}

/**
 * 書類全文出力が有効かを確認
 * @return {boolean} 有効ならtrue、無効ならfalse
 */
function isFullTextOutputEnabled() {
  const value = getScriptProperty(FULL_TEXT_OUTPUT_KEY, 'false');
  return value === 'true';
}

/**
 * 書類全文出力の状態を表示
 */
function showFullTextOutputStatus() {
  const enabled = isFullTextOutputEnabled();
  Logger.log('[全文出力] 現在の状態: ' + (enabled ? '有効' : '無効'));
  return enabled;
}

/**
 * OCR全文テキストを省略版に変換
 * ENABLE_FULL_TEXT_OUTPUT が false の場合、先頭と末尾のみ表示
 * @param {string} fullText - 全文テキスト
 * @param {number} headLength - 先頭文字数（デフォルト: 100）
 * @param {number} tailLength - 末尾文字数（デフォルト: 100）
 * @return {string} 省略版または全文
 */
function truncateOcrText(fullText, headLength, tailLength) {
  if (!fullText) {
    return '';
  }

  // デフォルト値
  if (headLength === undefined) headLength = 100;
  if (tailLength === undefined) tailLength = 100;

  // 全文出力が有効な場合はそのまま返す
  if (isFullTextOutputEnabled()) {
    return fullText;
  }

  // 短いテキストはそのまま返す
  if (fullText.length <= headLength + tailLength + 10) {
    return fullText;
  }

  // 省略版を作成
  const head = fullText.substring(0, headLength);
  const tail = fullText.substring(fullText.length - tailLength);
  const omittedLength = fullText.length - headLength - tailLength;

  return head + '\n\n... (' + omittedLength + '文字省略) ...\n\n' + tail;
}

// ========================================
// 初期化とセットアップ
// ========================================

/**
 * スクリプトプロパティの初期化（プロジェクト固有の設定）
 * 各プロジェクトでこの関数をカスタマイズして使用
 *
 * @param {Object} config - プロジェクト固有の設定
 * @example
 * initializeScriptPropertiesForProject({
 *   GCP_PROJECT_ID: 'your-project-id',
 *   GCP_LOCATION: 'us-central1',
 *   VERTEX_AI_MODEL: 'gemini-2.5-flash',
 *   ENABLE_DUPLICATION_PREVENTION: 'true'
 * });
 */
function initializeScriptPropertiesForProject(config) {
  Logger.log('[初期化] スクリプトプロパティを初期化します...');

  // 引数チェック
  if (!config || typeof config !== 'object') {
    config = {};
  }

  // デフォルト設定
  var defaultConfig = {
    ENABLE_DUPLICATION_PREVENTION: 'true',
    ENABLE_FULL_TEXT_OUTPUT: 'false',  // 書類全文のログ出力（デフォルト: OFF）
    LOG_LEVEL: 'INFO',
    TIMEZONE: 'Asia/Tokyo'
  };

  // デフォルト設定とカスタム設定をマージ（互換性のある方法）
  var mergedConfig = {};

  // デフォルト設定をコピー
  for (var key in defaultConfig) {
    if (defaultConfig.hasOwnProperty(key)) {
      mergedConfig[key] = defaultConfig[key];
    }
  }

  // カスタム設定で上書き
  for (var key in config) {
    if (config.hasOwnProperty(key)) {
      mergedConfig[key] = config[key];
    }
  }

  Logger.log('[初期化] マージ後の設定: ' + JSON.stringify(mergedConfig, null, 2));

  // 一括設定
  setScriptProperties(mergedConfig);

  Logger.log('[初期化] 完了: ' + Object.keys(mergedConfig).length + '件のプロパティを設定しました');

  // 設定内容を表示（デバッグ用）
  listScriptProperties();
}

/**
 * スクリプトプロパティの全削除（危険な操作）
 * 開発・テスト時のみ使用
 *
 * ⚠️ 警告: この関数は全てのScript Propertiesを削除します
 *
 * 安全のため、関数名を変更してください：
 * clearAllScriptProperties → confirmClearAllScriptProperties
 */
function clearAllScriptProperties() {
  Logger.log('[削除エラー] 安全のため、この関数は無効化されています');
  Logger.log('[削除エラー] 全削除を実行するには confirmClearAllScriptProperties() を使用してください');
  throw new Error('安全のため無効化されています。confirmClearAllScriptProperties() を使用してください。');
}

/**
 * スクリプトプロパティの全削除（確認用）
 * この関数名を明示的に呼び出すことで実行されます
 */
function confirmClearAllScriptProperties() {
  Logger.log('[削除警告] 全てのスクリプトプロパティを削除します...');
  PropertiesService.getScriptProperties().deleteAllProperties();
  Logger.log('[削除] 全スクリプトプロパティを削除しました');
}

// ========================================
// GCP / Vertex AI関連のヘルパー関数
// ========================================

/**
 * GCP設定をスクリプトプロパティに保存
 * @param {Object} gcpConfig - GCP設定
 * @param {string} gcpConfig.projectId - GCPプロジェクトID
 * @param {string} [gcpConfig.location='us-central1'] - GCPロケーション
 * @param {string} [gcpConfig.model='gemini-2.5-flash'] - Vertex AIモデル
 * @param {number} [gcpConfig.temperature=0.1] - Temperature
 * @param {number} [gcpConfig.maxOutputTokens=20000] - 最大出力トークン数
 */
function setGCPConfig(gcpConfig) {
  const config = {
    GCP_PROJECT_ID: gcpConfig.projectId,
    GCP_LOCATION: gcpConfig.location || 'us-central1',
    VERTEX_AI_MODEL: gcpConfig.model || 'gemini-2.5-flash',
    VERTEX_AI_TEMPERATURE: String(gcpConfig.temperature || 0.1),
    VERTEX_AI_MAX_OUTPUT_TOKENS: String(gcpConfig.maxOutputTokens || 20000),
    USE_VERTEX_AI: 'true'
  };

  setScriptProperties(config);
  Logger.log('[GCP] 設定を保存しました');
}

/**
 * GCP設定をスクリプトプロパティから取得
 * @return {Object} GCP設定
 */
function getGCPConfig() {
  return {
    projectId: getScriptProperty('GCP_PROJECT_ID'),
    location: getScriptProperty('GCP_LOCATION', 'us-central1'),
    model: getScriptProperty('VERTEX_AI_MODEL', 'gemini-2.5-flash'),
    temperature: parseFloat(getScriptProperty('VERTEX_AI_TEMPERATURE', '0.1')),
    maxOutputTokens: parseInt(getScriptProperty('VERTEX_AI_MAX_OUTPUT_TOKENS', '20000')),
    useVertexAI: getScriptProperty('USE_VERTEX_AI', 'false') === 'true'
  };
}

/**
 * Google AI Studio APIキーを設定
 * @param {string} apiKey - APIキー
 */
function setGoogleAIApiKey(apiKey) {
  setScriptProperty('GOOGLE_AI_API_KEY', apiKey);
  Logger.log('[Google AI] APIキーを設定しました');
}

/**
 * Google AI Studio APIキーを取得
 * @return {string} APIキー
 */
function getGoogleAIApiKey() {
  return getScriptProperty('GOOGLE_AI_API_KEY');
}

// ========================================
// テスト・デバッグ用関数
// ========================================

/**
 * スクリプトプロパティ管理のテスト
 */
function testScriptPropertiesManager() {
  Logger.log('=== スクリプトプロパティ管理のテスト ===');

  // 1. 単一プロパティの設定・取得
  Logger.log('\n[テスト1] 単一プロパティの設定・取得');
  setScriptProperty('TEST_KEY', 'test_value');
  const value = getScriptProperty('TEST_KEY');
  Logger.log(`取得した値: ${value}`);

  // 2. デフォルト値の動作確認
  Logger.log('\n[テスト2] デフォルト値');
  const defaultValue = getScriptProperty('NON_EXISTENT_KEY', 'default');
  Logger.log(`デフォルト値: ${defaultValue}`);

  // 3. 一括設定
  Logger.log('\n[テスト3] 一括設定');
  setScriptProperties({
    TEST_KEY1: 'value1',
    TEST_KEY2: 'value2',
    TEST_KEY3: 'value3'
  });

  // 4. 全プロパティの一覧表示
  Logger.log('\n[テスト4] 全プロパティの一覧');
  listScriptProperties();

  // 5. 重複回避機能のテスト
  Logger.log('\n[テスト5] 重複回避機能');
  showDuplicationPreventionStatus();
  disableDuplicationPrevention();
  showDuplicationPreventionStatus();
  enableDuplicationPrevention();
  showDuplicationPreventionStatus();

  // 6. テストプロパティの削除
  Logger.log('\n[テスト6] プロパティの削除');
  deleteScriptProperty('TEST_KEY');
  deleteScriptProperty('TEST_KEY1');
  deleteScriptProperty('TEST_KEY2');
  deleteScriptProperty('TEST_KEY3');

  Logger.log('\n=== テスト完了 ===');
}

/**
 * サンプル：書類OCRプロジェクトの初期化
 */
function initializeScriptPropertiesForDocumentOCR() {
  initializeScriptPropertiesForProject({
    // GCP設定
    GCP_PROJECT_ID: 'macro-shadow-458705-v8',
    GCP_LOCATION: 'us-central1',
    VERTEX_AI_MODEL: 'gemini-2.5-flash',
    VERTEX_AI_TEMPERATURE: '0.1',
    VERTEX_AI_MAX_OUTPUT_TOKENS: '8000',
    USE_VERTEX_AI: 'true',

    // 重複回避機能
    ENABLE_DUPLICATION_PREVENTION: 'true',

    // その他の設定
    LOG_LEVEL: 'INFO',
    TIMEZONE: 'Asia/Tokyo'
  });
}

/**
 * サンプル：通話要約プロジェクトの初期化
 */
function initializeScriptPropertiesForCallSummary() {
  initializeScriptPropertiesForProject({
    // GCP設定
    GCP_PROJECT_ID: 'your-gcp-project-id',
    GCP_LOCATION: 'us-central1',
    VERTEX_AI_MODEL: 'gemini-2.5-flash',
    VERTEX_AI_TEMPERATURE: '0.1',
    VERTEX_AI_MAX_OUTPUT_TOKENS: '8000',
    USE_VERTEX_AI: 'false',

    // 音声文字起こし設定
    ENABLE_TRANSCRIPT: 'false',  // コスト削減のため無効化

    // 重複回避機能
    ENABLE_DUPLICATION_PREVENTION: 'true',

    // その他の設定
    LOG_LEVEL: 'INFO',
    TIMEZONE: 'Asia/Tokyo'
  });
}
