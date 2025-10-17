





/**

 * データアクセスモジュール

 * スプレッドシートからのマスターデータ取得

 */



/**

 * 指導・助言マスターをテキスト形式で取得

 * @return {string} マスターリストのテキスト

 */

function getGuidanceMasterAsText() {

  try {

    const sheet = SpreadsheetApp

      .openById(SPREADSHEET_CONFIG.masterId)

      .getSheetByName(SPREADSHEET_CONFIG.sheetName);

    

    if (!sheet) {

      throw new Error(`シートが見つかりません: ${SPREADSHEET_CONFIG.sheetName}`);

    }

    

    const data = sheet.getDataRange().getValues();

    

    if (data.length === 0) {

      throw new Error('マスタースプレッドシートにデータがありません');

    }

    

    const headers = data.shift(); // ヘッダー行を取得

    const careProvidedIndex = headers.indexOf('Care_Provided');

    

    if (careProvidedIndex === -1) {

      throw new Error('マスタースプレッドシートに "Care_Provided" 列が見つかりません');

    }

    

    // "Care_Provided"列の値だけをリスト化

    const masterList = data

      .map(row => row[careProvidedIndex])

      .filter(value => value && value.toString().trim() !== '')

      .map(value => `- ${value}`)

      .join('\n');

    

    logStructured(LOG_LEVEL.INFO, 'マスターデータ取得成功', { count: data.length });

    

    return masterList;

    

  } catch (error) {

    logStructured(LOG_LEVEL.ERROR, 'マスターデータ取得エラー', { 

      error: error.message,

      errorCode: ERROR_CODE.MASTER_DATA_FETCH_FAILED 

    });

    throw new Error(`マスターデータの取得に失敗しました: ${error.message}`);

  }

}



/**

 * マスターデータをキャッシュから取得（パフォーマンス最適化）

 * @return {string} マスターリストのテキスト

 */

function getGuidanceMasterCached() {

  const cache = CacheService.getScriptCache();

  const cacheKey = 'guidance_master_text';

  const cacheDuration = 3600; // 1時間

  

  // キャッシュから取得を試みる

  let masterText = cache.get(cacheKey);

  

  if (masterText) {

    logDebug('マスターデータをキャッシュから取得');

    return masterText;

  }

  

  // キャッシュにない場合は取得してキャッシュに保存

  masterText = getGuidanceMasterAsText();

  cache.put(cacheKey, masterText, cacheDuration);

  

  return masterText;

}

