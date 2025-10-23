/**
 * 設定ファイル
 *
 * @version 1.0.0
 * @date 2025-10-23
 */

// スクリプト名
const SCRIPT_NAME = 'Automation_統合管理';

// 為替レート（USD → JPY）
const EXCHANGE_RATE_USD_TO_JPY = 150;

// GCP設定（Vertex AI用）
const GCP_PROJECT_ID = 'macro-shadow-458705-v8';
const GCP_LOCATION = 'us-central1';

// Gemini モデル設定
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// 実行ログスプレッドシート
const EXECUTION_LOG_SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';
const EXECUTION_LOG_SHEET_NAME = 'コスト管理';

/**
 * テスト用のダミー関数
 * ライブラリを使用するため、Script Propertiesの設定は各ライブラリ側で行います
 */
function testLibraryCall() {
  Logger.log('=== ライブラリテスト ===');
  Logger.log('ReceiptLib: ' + (typeof ReceiptLib !== 'undefined' ? '✓ 読み込み成功' : '✗ 読み込み失敗'));
  Logger.log('BusinessCardLib: ' + (typeof BusinessCardLib !== 'undefined' ? '✓ 読み込み成功' : '✗ 読み込み失敗'));
}
