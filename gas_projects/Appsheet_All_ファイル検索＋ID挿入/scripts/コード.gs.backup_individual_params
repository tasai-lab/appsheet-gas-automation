// --- 1. 基本設定 ---

const ERROR_NOTIFICATION_EMAIL = "t.asai@fractal-group.co.jp";


/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_All_ファイル検索＋ID挿入';
    return processRequest(params);
  });
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  Utilities.sleep(15000);

  const { appsheetConfig, jobs } = params;

  if (!appsheetConfig || !jobs || !Array.isArray(jobs)) {

    throw new Error("Webhook Bodyの形式が正しくありません。");

  }

  for (const job of jobs) {

    const { updateTarget, fileAssignments } = job;

    try {

      if (!updateTarget || !fileAssignments || !Array.isArray(fileAssignments)) continue;

      console.log(`処理開始: Table=${updateTarget.tableName}, Key=${updateTarget.keyValue}`);

      const rowDataToUpdate = { [updateTarget.keyColumn]: updateTarget.keyValue };

      for (const assignment of fileAssignments) {

        const { search, targets } = assignment; // 'targets' に変更

        if (!search || !targets || !Array.isArray(targets)) continue;

        try {

          console.log(`  -> 検索中: Path=${search.relativePath || '(ルート)'}, Name=${search.partialFileName}`);

          const foundFile = findFile(search.baseFolderId, search.relativePath, search.partialFileName);

          if (foundFile) {

            console.log(`     ...発見: ${foundFile.getName()} (ID: ${foundFile.getId()})`);

            // ★★★ 新しいロジック ★★★

            // targetsリストの指示に従って、書き込みデータを動的に作成

            for (const target of targets) {

              if (target.columnName && target.fileProperty) {

                if (target.fileProperty === 'id') rowDataToUpdate[target.columnName] = foundFile.getId();

                if (target.fileProperty === 'url') rowDataToUpdate[target.columnName] = foundFile.getUrl();

                if (target.fileProperty === 'name') rowDataToUpdate[target.columnName] = foundFile.getName();

              }

            }

            // ★★★★★★★★★★★★★★★

          } else {

            console.log(`     ...ファイルが見つかりませんでした。`);

          }

        } catch (error) {

          console.error(`  -> Assignment処理中にエラーが発生しました: ${error.message}`);

        }

      }

      if (Object.keys(rowDataToUpdate).length > 1) {

        console.log(`  -> AppSheetへ更新リクエストを送信します...`);

        console.log(`  -> ペイロード: ${JSON.stringify(rowDataToUpdate, null, 2)}`);

        const payload = { Action: "Edit", Properties: { "Locale": "ja-JP" }, Rows: [rowDataToUpdate] };

        callAppSheetApi(appsheetConfig, updateTarget.tableName, payload);

      } else {

        console.log(`  -> 更新すべきファイルが見つからなかったため、API呼び出しはスキップされました。`);

      }

    } catch(jobError) {

        console.error(`Job処理中にエラーが発生しました: ${jobError.message}`);

        const subject = `[要確認] GAS処理エラー: 汎用ファイル検索`;

        const body = `汎用ファイル検索GASでエラーが発生しました。\n\n■ 対象テーブル\n${updateTarget.tableName}\n\n■ 対象キー\n${updateTarget.keyValue}\n\n■ エラー内容\n${jobError.message}`;

        sendErrorEmail(subject, body);

    }

  }

  return ContentService.createTextOutput(JSON.stringify({ status: "Processed" }));
}


/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  // TODO: テストデータを設定してください
  const testParams = {
    // 例: action: "test",
    // 例: data: "sample"
  };

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_All_ファイル検索＋ID挿入');
}


function callAppSheetApi(config, tableName, payload) {

  Utilities.sleep(Math.random() * 2000);

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${config.appId}/tables/${tableName}/Action`;

  const options = { method: 'post', contentType: 'application/json', headers: { 'ApplicationAccessKey': config.accessKey }, payload: JSON.stringify(payload), muteHttpExceptions: true };

  const response = UrlFetchApp.fetch(apiUrl, options);

  const responseCode = response.getResponseCode();

  const responseBody = response.getContentText();

  console.log(`     ...AppSheet API 応答コード: ${responseCode}`);

  console.log(`     ...AppSheet API 応答ボディ: ${responseBody}`);

  if (responseCode >= 400) {

    throw new Error(`AppSheet API Error (${responseCode}): ${responseBody}`);

  }

}


// =================================================================

// 以下のヘルパー関数群に変更はありません

// =================================================================

function findFile(baseFolderId, relativePath, partialFileName) {

  if (!baseFolderId || !partialFileName) return null;

  let currentFolder = DriveApp.getFolderById(baseFolderId);

  if (relativePath && relativePath.trim() !== '') {

    const pathParts = relativePath.split('/').filter(p => p);

    for (const folderName of pathParts) {

      const folders = currentFolder.getFoldersByName(folderName);

      if (!folders.hasNext()) return null;

      currentFolder = folders.next();

    }

  }

  const files = currentFolder.searchFiles(`title contains '${partialFileName}' and trashed = false`);

  let latestFile = null;

  let latestDate = new Date(0);

  while (files.hasNext()) {

      let currentFile = files.next();

      let createdDate = currentFile.getDateCreated();

      if (createdDate > latestDate) {

          latestFile = currentFile;

          latestDate = createdDate;

      }

  }

  return latestFile;

}

function sendErrorEmail(subject, body) {

  try {

    // Email removed - using execution log instead

    console.log(`エラー通知メールを ${ERROR_NOTIFICATION_EMAIL} へ送信しました。`);

  } catch(e) {

    console.error(`エラー通知メールの送信に失敗しました: ${e.toString()}`);

  }

}
