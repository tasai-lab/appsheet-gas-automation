/**
 * 設定ファイル
 * Appsheet_汎用_イベント作成
 *
 * 注意: LOGGER_CONFIGはlogger.gsで定義されているため、ここでは定義しません
 */

// イベントカラーID参考
// 1: ラベンダー
// 2: セージ
// 3: ブドウ
// 4: フラミンゴ
// 5: バナナ
// 6: タンジェリン
// 7: ピーコック
// 8: グラファイト
// 9: ブルーベリー
// 10: バジル
// 11: トマト

// デフォルト設定
const DEFAULT_CONFIG = {
  colorId: '9', // デフォルト: ブルーベリー（ブルー）
  timeZone: 'Asia/Tokyo',
  sendUpdates: true, // 参加者への通知を送信
  defaultDuration: 60 * 60 * 1000, // 1時間（ミリ秒）
  reminders: {
    useDefault: true // Googleカレンダーのデフォルトリマインダーを使用
  }
};

// Calendar API設定
const CALENDAR_API_CONFIG = {
  baseUrl: 'https://www.googleapis.com/calendar/v3',
  calendarId: 'primary' // プライマリカレンダー
};
