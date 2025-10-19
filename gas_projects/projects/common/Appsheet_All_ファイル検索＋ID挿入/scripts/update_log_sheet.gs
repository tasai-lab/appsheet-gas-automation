/**
 * 実行ログスプレッドシートのヘッダーを更新
 * スプレッドシートID: 16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA
 */

const LOG_SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';

function updateLogSheetHeaders() {
  try {
    Logger.log('=== 実行ログスプレッドシート更新開始 ===');

    // スプレッドシートを直接開く
    const spreadsheet = SpreadsheetApp.openById(LOG_SPREADSHEET_ID);
    Logger.log('✓ スプレッドシート取得成功');
    Logger.log('  URL: ' + spreadsheet.getUrl());

    // 「実行ログ」シートを取得
    let sheet = spreadsheet.getSheetByName('実行ログ');
    if (!sheet) {
      throw new Error('「実行ログ」シートが見つかりません');
    }

    Logger.log('✓ シート取得成功');

    // 現在のヘッダー行を取得
    const lastCol = sheet.getLastColumn();
    const currentHeaders = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
      : [];

    Logger.log('現在のカラム数: ' + currentHeaders.length);
    Logger.log('現在のヘッダー:');
    currentHeaders.forEach((header, index) => {
      Logger.log('  ' + (index + 1) + '. ' + header);
    });

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

    Logger.log('');
    Logger.log('ヘッダー更新中...');

    // ヘッダー行を更新
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);

    // 列幅を設定
    sheet.setColumnWidth(1, 150);   // 開始時刻
    sheet.setColumnWidth(2, 150);   // 終了時刻
    sheet.setColumnWidth(3, 100);   // 実行時間
    sheet.setColumnWidth(4, 250);   // スクリプト名
    sheet.setColumnWidth(5, 100);   // ステータス
    sheet.setColumnWidth(6, 150);   // レコードID
    sheet.setColumnWidth(7, 250);   // リクエストID
    sheet.setColumnWidth(8, 400);   // ログサマリー
    sheet.setColumnWidth(9, 400);   // エラー詳細
    sheet.setColumnWidth(10, 180);  // モデル
    sheet.setColumnWidth(11, 120);  // Input Tokens
    sheet.setColumnWidth(12, 120);  // Output Tokens
    sheet.setColumnWidth(13, 120);  // Input料金(円)
    sheet.setColumnWidth(14, 120);  // Output料金(円)
    sheet.setColumnWidth(15, 120);  // 合計料金(円)

    // ヘッダー行のフォーマットを適用
    const headerRange = sheet.getRange(1, 1, 1, newHeaders.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    headerRange.setHorizontalAlignment('center');

    Logger.log('✓ ヘッダー更新完了');
    Logger.log('更新後のカラム数: ' + newHeaders.length);
    Logger.log('');
    Logger.log('新しいヘッダー:');
    newHeaders.forEach((header, index) => {
      const marker = (index >= currentHeaders.length) ? '🆕 ' : '   ';
      Logger.log(marker + (index + 1) + '. ' + header);
    });

    Logger.log('');
    Logger.log('=== 完了 ===');
    Logger.log('スプレッドシートURL: ' + spreadsheet.getUrl());

    return {
      success: true,
      spreadsheetUrl: spreadsheet.getUrl(),
      columnCount: newHeaders.length,
      previousColumnCount: currentHeaders.length
    };

  } catch (e) {
    Logger.log('=== エラー発生 ===');
    Logger.log('エラー: ' + e.toString());
    Logger.log('スタックトレース: ' + e.stack);
    throw e;
  }
}
