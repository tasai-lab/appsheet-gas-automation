/**
 * 実行ログスプレッドシートに新しいカラムを追加
 * API使用量とコスト情報のカラムを追加する一回限りのスクリプト
 *
 * 実行方法:
 * 1. このスクリプトをGASエディタにコピー
 * 2. updateLogSheetHeaders()関数を実行
 * 3. 実行結果をログで確認
 */

const LOG_FOLDER_ID = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX';
const LOG_SPREADSHEET_NAME = 'GAS実行ログ_統合';

/**
 * 実行ログシートのヘッダーを更新
 */
function updateLogSheetHeaders() {
  try {
    Logger.log('スプレッドシート検索開始...');

    // スプレッドシートを取得
    const folder = DriveApp.getFolderById(LOG_FOLDER_ID);
    const files = folder.getFilesByName(LOG_SPREADSHEET_NAME);

    if (!files.hasNext()) {
      Logger.log('エラー: スプレッドシートが見つかりません: ' + LOG_SPREADSHEET_NAME);
      return;
    }

    const file = files.next();
    const spreadsheet = SpreadsheetApp.openById(file.getId());
    Logger.log('スプレッドシート取得成功: ' + spreadsheet.getUrl());

    // 「実行ログ」シートを取得
    let sheet = spreadsheet.getSheetByName('実行ログ');
    if (!sheet) {
      Logger.log('エラー: 「実行ログ」シートが見つかりません');
      return;
    }

    Logger.log('シート取得成功');

    // 現在のヘッダー行を取得
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('現在のカラム数: ' + currentHeaders.length);
    Logger.log('現在のヘッダー: ' + currentHeaders.join(', '));

    // 新しいヘッダー定義（完全版）
    const newHeaders = [
      '開始時刻',
      '終了時刻',
      '実行時間(秒)',
      'スクリプト名',
      'ステータス',
      'レコードID',
      'リクエストID',
      'ログサマリー',
      'エラー詳細',
      'モデル',
      'Input Tokens',
      'Output Tokens',
      'Input料金(円)',
      'Output料金(円)',
      '合計料金(円)'
    ];

    // 既存のヘッダーと新しいヘッダーを比較
    if (currentHeaders.length >= newHeaders.length) {
      Logger.log('既に新しいカラムが存在します');
      // 念のため、ヘッダー名を確認・更新
      sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
      Logger.log('ヘッダー名を更新しました');
    } else {
      // 新しいカラムを追加
      Logger.log('新しいカラムを追加します...');

      // ヘッダー行を更新
      sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);

      // 新しく追加されたカラムの列幅を設定
      const startCol = currentHeaders.length + 1;
      for (let i = startCol; i <= newHeaders.length; i++) {
        if (i === 10) {
          sheet.setColumnWidth(i, 180); // モデル
        } else if (i === 11 || i === 12) {
          sheet.setColumnWidth(i, 120); // Input/Output Tokens
        } else if (i >= 13 && i <= 15) {
          sheet.setColumnWidth(i, 120); // 料金カラム
        }
      }

      Logger.log('カラム追加完了');
    }

    // ヘッダー行のフォーマットを再適用
    const headerRange = sheet.getRange(1, 1, 1, newHeaders.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');

    Logger.log('=== 完了 ===');
    Logger.log('スプレッドシートURL: ' + spreadsheet.getUrl());
    Logger.log('更新後のカラム数: ' + newHeaders.length);
    Logger.log('新しいヘッダー: ' + newHeaders.join(', '));

  } catch (e) {
    Logger.log('エラー発生: ' + e.toString());
    Logger.log('スタックトレース: ' + e.stack);
  }
}

/**
 * スプレッドシートの現在の状態を確認
 */
function checkCurrentState() {
  try {
    const folder = DriveApp.getFolderById(LOG_FOLDER_ID);
    const files = folder.getFilesByName(LOG_SPREADSHEET_NAME);

    if (!files.hasNext()) {
      Logger.log('スプレッドシートが見つかりません');
      return;
    }

    const file = files.next();
    const spreadsheet = SpreadsheetApp.openById(file.getId());
    const sheet = spreadsheet.getSheetByName('実行ログ');

    if (!sheet) {
      Logger.log('「実行ログ」シートが見つかりません');
      return;
    }

    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    Logger.log('=== 現在の状態 ===');
    Logger.log('スプレッドシートURL: ' + spreadsheet.getUrl());
    Logger.log('カラム数: ' + currentHeaders.length);
    Logger.log('ヘッダー:');
    currentHeaders.forEach((header, index) => {
      Logger.log(`  ${index + 1}. ${header}`);
    });

  } catch (e) {
    Logger.log('エラー: ' + e.toString());
  }
}
