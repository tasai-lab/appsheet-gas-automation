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
    PropertiesService.getScriptProperties().setProperties(properties);
    Logger.log(`[Script Property] 一括設定成功: ${Object.keys(properties).length}件`);
  } catch (error) {
    Logger.log(`[Script Property] 一括設定失敗: ${error.message}`);
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
  Logger.log(`[重複回避] 現在の状態: ${enabled ? '有効' : '無効'}`);
  return enabled;
}

// ========================================
// 初期化とセットアップ
// ========================================

/**
 * スクリプトプロパティの初期化（プロジェクト固有の設定）
 * 各プロジェクトでこの関数をカスタマイズして使用
 *
 * @param {Object} [config={}] - プロジェクト固有の設定
 * @example
 * initializeScriptPropertiesForProject({
 *   GCP_PROJECT_ID: 'your-project-id',
 *   GCP_LOCATION: 'us-central1',
 *   VERTEX_AI_MODEL: 'gemini-2.5-flash',
 *   ENABLE_DUPLICATION_PREVENTION: 'true'
 * });
 */
function initializeScriptPropertiesForProject(config = {}) {
  Logger.log('[初期化] スクリプトプロパティを初期化します...');

  // デフォルト設定
  const defaultConfig = {
    ENABLE_DUPLICATION_PREVENTION: 'true',
    LOG_LEVEL: 'INFO',
    TIMEZONE: 'Asia/Tokyo'
  };

  // デフォルト設定とカスタム設定をマージ
  const mergedConfig = { ...defaultConfig, ...config };

  // 一括設定
  setScriptProperties(mergedConfig);

  Logger.log(`[初期化] 完了: ${Object.keys(mergedConfig).length}件のプロパティを設定しました`);

  // 設定内容を表示（デバッグ用）
  listScriptProperties();
}

/**
 * スクリプトプロパティの全削除（危険な操作）
 * 開発・テスト時のみ使用
 */
function clearAllScriptProperties() {
  const confirmation = Browser.msgBox(
    '確認',
    '全てのスクリプトプロパティを削除します。本当によろしいですか？',
    Browser.Buttons.YES_NO
  );

  if (confirmation === 'yes') {
    PropertiesService.getScriptProperties().deleteAllProperties();
    Logger.log('[削除] 全スクリプトプロパティを削除しました');
  } else {
    Logger.log('[削除] キャンセルされました');
  }
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

