/**
 * 設定ファイル
 * プロジェクト固有の設定値を管理
 */

// スクリプト名
const SCRIPT_NAME = 'Appsheet_関係機関_情報取得';

// デバッグモード設定
const DEBUG_MODE = true; // 本番環境ではfalseに設定

// Google Places API設定
const PLACES_API_KEY = 'AIzaSyD-V_IwW1flPJif6eYFZPFjLpfonyLKT-Y';

// AppSheet API設定
const APPSHEET_APP_ID = '27bceb6f-9a2c-4ab6-9438-31fec25a495e';
const APPSHEET_ACCESS_KEY = 'V2-A0207-tnP4i-YwteT-Cg55O-7YBvg-zMXQX-sS4Xv-XuaKP';
const ORGANIZATIONS_TABLE_NAME = 'Organizations';

// 実行ログスプレッドシート設定
const EXECUTION_LOG_SPREADSHEET_ID = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX';

// Places API設定
const PLACES_API_CONFIG = {
  // APIエンドポイント
  endpoint: 'https://places.googleapis.com/v1/places:searchText',

  // 取得するフィールド
  fieldMask: [
    'places.location',
    'places.formattedAddress',
    'places.nationalPhoneNumber',
    'places.websiteUri',
    'places.regularOpeningHours'
  ].join(','),

  // 言語設定
  languageCode: 'ja'
};

// AppSheet API設定
const APPSHEET_API_CONFIG = {
  // APIエンドポイント
  baseUrl: 'https://api.appsheet.com/api/v2',

  // タイムゾーン・ロケール
  properties: {
    Locale: 'ja-JP',
    Timezone: 'Asia/Tokyo'
  }
};
