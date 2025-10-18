/**
 * 設定ファイル
 */

// スプレッドシートID
const TARGET_SPREADSHEET_ID = '1KL31iZLNu1pnKH8BMlJ8434TiwNvvJHVcsde33UZ7n8';

// シート名
const CARE_SHEET_NAME = 'Billing_Care_Items';
const MEDI_SHEET_NAME = 'Billing_Medi_Items';
const TARGET_SHEET_NAME = 'Billing_Items';

// マスタースプレッドシート設定
const CARE_MASTER_CONFIG = {
  spreadsheetId: '1r-ehIg7KMrSPBCI3K1wA8UFvBnKvqp1kmb8r7MCH1tQ',
  sheetName: '介護_基本・加算マスター',
  columns: {
    type: '種類',
    item: '項目',
    name: 'サービス内容略称',
    units: '単位'
  }
};

const MEDI_MASTER_CONFIG = {
  spreadsheetId: '1iMmlw-A7K1v-CfksGUutap2xYPNLiL1bWaBg8BRO-1M',
  sheetName: '医療_基本テーブルr',
  columns: {
    code: '訪問看護療養費コード',
    name: '省略名称',
    units: '新又は現金額'
  }
};

// 実行ログスプレッドシート
const EXECUTION_LOG_SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';
const EXECUTION_LOG_SHEET_NAME = '実行履歴';

// デバッグモード
const DEBUG_MODE = false;

/**
 * デバッグログ出力
 */
function debugLog(message) {
  if (DEBUG_MODE) {
    Logger.log(message);
  }
}
