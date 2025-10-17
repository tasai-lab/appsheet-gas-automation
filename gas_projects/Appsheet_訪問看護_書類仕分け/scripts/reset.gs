





/**

 * ★★★ メンテナンス用関数 ★★★

 * PropertiesServiceに保存されている、このスクリプトのロック情報

 * ('processing' または 'completed' の状態) をすべてクリアします。

 * 処理が途中で止まってしまい、ロックが残ってしまった場合などに手動で実行します。

 */

function clearAllProcessLocks() {

  const properties = PropertiesService.getScriptProperties();

  const allKeys = properties.getKeys();

  let clearedCount = 0;



  for (const key of allKeys) {

    // このスクリプトで使われるキー（書類ID、または提供票のCONTEXT）を対象とする

    if (key.startsWith('CLDC-') || key.startsWith('CONTEXT_')) {

      properties.deleteProperty(key);

      console.log(`ロックを解除しました: ${key}`);

      clearedCount++;

    }

  }



  if (clearedCount === 0) {

    console.log("クリア対象のロック情報はありませんでした。");

  } else {

    console.log(`合計 ${clearedCount} 件のロック情報をクリアしました。`);

  }

}



/**

 * ★★★ メンテナンス用関数 (個別指定版) ★★★

 * 指定した単一のdocumentIdに関連するロック情報

 * ('processing', 'completed', または 'CONTEXT_...') をクリアします。

 * 特定の書類だけがロックされたままになってしまった場合に使用します。

 */

function clearSpecificLock() {

  // ★★★ 1. このIDを、リセットしたい書類IDに書き換えてください ★★★

  const documentIdToClear = 'CLDC-148ddbe7'; // 例: 'CLDC-148ddbe7'



  // --- ここから下は変更しないでください ---

  if (!documentIdToClear || documentIdToClear === 'ここにIDをペーストしてください') {

    console.error("エラー: 関数内の`documentIdToClear`に、リセットしたい書類IDを正しく入力してから実行してください。");

    return;

  }



  const properties = PropertiesService.getScriptProperties();

  let cleared = false;



  // メインのロックキーを削除 ('processing' or 'completed')

  if (properties.getProperty(documentIdToClear) !== null) {

    properties.deleteProperty(documentIdToClear);

    console.log(`ロックを解除しました: ${documentIdToClear}`);

    cleared = true;

  }



  // 提供票用のCONTEXTキーも削除

  const contextKey = `CONTEXT_${documentIdToClear}`;

  if (properties.getProperty(contextKey) !== null) {

    properties.deleteProperty(contextKey);

    console.log(`提供票の待機データを削除しました: ${contextKey}`);

    cleared = true;

  }



  if (cleared) {

    console.log(`ID: ${documentIdToClear} に関連するロック情報を正常に解除しました。`);

  } else {

    console.log(`ID: ${documentIdToClear} に関連するロックや待機データは見つかりませんでした。`);

  }

}