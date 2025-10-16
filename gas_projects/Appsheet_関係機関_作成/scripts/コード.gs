/**
 * 実行ログモジュール
 */
const ExecutionLogger = {
  SPREADSHEET_ID: '15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE',
  SHEET_NAME: 'シート1',
  
  /**
   * ログを記録
   * @param {string} scriptName - スクリプト名
   * @param {string} status - ステータス (SUCCESS/ERROR/WARNING)
   * @param {string} processId - 処理ID
   * @param {string} message - メッセージ
   * @param {string} errorDetail - エラー詳細
   * @param {number} executionTime - 実行時間(秒)
   * @param {Object} inputData - 入力データ
   */
  log: function(scriptName, status, processId, message, errorDetail, executionTime, inputData) {
    try {
      const ss = SpreadsheetApp.openById(this.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(this.SHEET_NAME);
      
      const timestamp = new Date();
      const user = Session.getActiveUser().getEmail();
      const inputDataStr = inputData ? JSON.stringify(inputData).substring(0, 1000) : '';
      
      sheet.appendRow([
        timestamp,
        scriptName,
        status,
        processId || '',
        message || '',
        errorDetail || '',
        executionTime || 0,
        user,
        inputDataStr
      ]);
    } catch (e) {
      Logger.log(`ログ記録エラー: ${e.message}`);
    }
  },
  
  /**
   * 成功ログ
   */
  success: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'SUCCESS', processId, message, '', executionTime, inputData);
  },
  
  /**
   * エラーログ
   */
  error: function(scriptName, processId, message, error, executionTime, inputData) {
    const errorDetail = error ? `${error.message}\n${error.stack}` : '';
    this.log(scriptName, 'ERROR', processId, message, errorDetail, executionTime, inputData);
  },
  
  /**
   * 警告ログ
   */
  warning: function(scriptName, processId, message, executionTime, inputData) {
    this.log(scriptName, 'WARNING', processId, message, '', executionTime, inputData);
  }
};


/**
 * Webhook重複実行防止モジュール
 */
const DuplicationPrevention = {
  LOCK_TIMEOUT: 300000, // 5分
  CACHE_EXPIRATION: 3600, // 1時間
  
  /**
   * リクエストの重複チェック
   * @param {string} requestId - リクエストID（webhookデータのハッシュ値）
   * @return {boolean} - 処理を続行する場合はtrue
   */
  checkDuplicate: function(requestId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `processed_${requestId}`;
    
    // キャッシュチェック
    if (cache.get(cacheKey)) {
      Logger.log(`重複リクエストを検出: ${requestId}`);
      return false;
    }
    
    // ロック取得
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(this.LOCK_TIMEOUT);
      
      // 再度キャッシュチェック（ダブルチェック）
      if (cache.get(cacheKey)) {
        Logger.log(`ロック取得後、重複リクエストを検出: ${requestId}`);
        return false;
      }
      
      // 処理済みマークを設定
      cache.put(cacheKey, 'processed', this.CACHE_EXPIRATION);
      return true;
    } catch (e) {
      Logger.log(`ロック取得エラー: ${e.message}`);
      return false;
    } finally {
      lock.releaseLock();
    }
  },
  
  /**
   * リクエストIDを生成
   * @param {Object} data - Webhookデータ
   * @return {string} - リクエストID
   */
  generateRequestId: function(data) {
    const str = JSON.stringify(data);
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      str,
      Utilities.Charset.UTF_8
    ).map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
  }
};


// --- 1. 基本設定 (★ご自身の環境に合わせて全て修正してください) ---

const PLACES_API_KEY = 'AIzaSyD-V_IwW1flPJif6eYFZPFjLpfonyLKT-Y'; // ★ Google Places APIのキー

const APP_ID = '27bceb6f-9a2c-4ab6-9438-31fec25a495e'; // AppSheetのアプリID

const ACCESS_KEY = 'V2-A0207-tnP4i-YwteT-Cg55O-7YBvg-zMXQX-sS4Xv-XuaKP'; // AppSheet APIのアクセスキー



// テーブル名

const ORGS_TABLE_NAME = 'Organizations';



/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 */

function doPost(e) {

  const params = JSON.parse(e.postData.contents);

  const orgId = params.orgId;



  try {

    const { commonName, fullAddress } = params;

    if (!orgId || !commonName || !fullAddress) {

      throw new Error("必須パラメータ（orgId, commonName, fullAddress）が不足しています。");

    }

    Logger.log(`処理開始: Org ID = ${orgId}, Name = ${commonName}`);



    // --- Places APIで情報を取得 ---

    const placeData = getPlaceDetails(commonName, fullAddress);

    if (placeData.error) {

      throw new Error(placeData.error);

    }



    // --- AppSheetに取得結果を書き込み ---

    updateOrganizationOnSuccess(orgId, placeData);



    Logger.log(`処理完了。ID ${orgId} の情報を更新しました。`);



  } catch (error) {

    Logger.log(`エラーが発生しました: ${error.toString()}`);

    if (orgId) {

      // Organizationsテーブルにerror_details列があれば、そこに書き込むことも可能です

      // updateOrganizationOnError(orgId, error.toString());

    }

  }

}



/**

 * Google Places APIを呼び出し、事業所の詳細情報を取得する

 */

function getPlaceDetails(name, address) {

  // 住所から郵便番号を抽出・整形

  let postalCode = null;

  let cleanAddress = address;

  const postalCodeMatch = address.match(/〒?(\d{3})-?(\d{4})/);

  if (postalCodeMatch) {

    postalCode = `${postalCodeMatch[1]}-${postalCodeMatch[2]}`;

    // 住所から郵便番号部分を削除

    cleanAddress = address.replace(/〒?\d{3}-?\d{4}\s*/, '').trim();

  }



  // Places API (Text Search) のエンドポイント

  const apiUrl = 'https://places.googleapis.com/v1/places:searchText';

  

  const requestBody = {

    textQuery: `${name} ${cleanAddress}`,

    languageCode: 'ja'

  };



  const options = {

    method: 'post',

    contentType: 'application/json',

    headers: {

      'X-Goog-Api-Key': PLACES_API_KEY,

      'X-Goog-FieldMask': 'places.location,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.regularOpeningHours'

    },

    payload: JSON.stringify(requestBody),

    muteHttpExceptions: true

  };



  const response = UrlFetchApp.fetch(apiUrl, options);

  const responseBody = response.getContentText();

  const jsonResponse = JSON.parse(responseBody);



  if (!jsonResponse.places || jsonResponse.places.length === 0) {

    return { error: `「${name} ${cleanAddress}」に一致する情報が見つかりませんでした。` };

  }



  // 最も関連性の高い最初の結果を使用

  const place = jsonResponse.places[0];

  const location = place.location ? `${place.location.latitude},${place.location.longitude}` : null;

  

  // 営業時間を指定フォーマットに整形

  const operatingHours = place.regularOpeningHours ? formatOpeningHours(place.regularOpeningHours) : null;



  return {

    postal_code: postalCode,

    address: cleanAddress,

    latlong: location,

    main_phone: place.nationalPhoneNumber || null,

    website_url: place.websiteUri || null,

    operating_hours: operatingHours

  };

}



/**

 * Places APIから返された営業時間を指定のテキスト形式に整形する

 */

function formatOpeningHours(openingHoursData) {

  const weekdays = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

  const dailyHours = {};



  if (openingHoursData.periods) {

    openingHoursData.periods.forEach(period => {

      const day = weekdays[period.open.day];

      const openTime = `${String(period.open.hour).padStart(2, '0')}時${String(period.open.minute).padStart(2, '0')}分`;

      const closeTime = `${String(period.close.hour).padStart(2, '0')}時${String(period.close.minute).padStart(2, '0')}分`;

      

      if (!dailyHours[day]) {

        dailyHours[day] = [];

      }

      dailyHours[day].push(`${openTime}～${closeTime}`);

    });

  }



  return weekdays.map(day => {

    if (dailyHours[day]) {

      return `${day}: ${dailyHours[day].join(', ')}`;

    } else {

      return `${day}: 定休日`;

    }

  }).join('\n');

}



/**

 * 成功時にAppSheetのOrganizationsテーブルを更新する

 */

function updateOrganizationOnSuccess(orgId, placeData) {

  // placeDataに "org_id" と "info_accuracy" を追加

  placeData.org_id = orgId;

  placeData.info_accuracy = "確認済";



  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [placeData]

  };

  

  callAppSheetApi(payload);

}



/**

 * AppSheet APIを呼び出す共通関数

 */

function callAppSheetApi(payload) {

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${ORGS_TABLE_NAME}/Action`;

  const options = {

    method: 'post',

    contentType: 'application/json',

    headers: { 'ApplicationAccessKey': ACCESS_KEY },

    payload: JSON.stringify(payload),

    muteHttpExceptions: true

  };

  const response = UrlFetchApp.fetch(apiUrl, options);

  Logger.log(`AppSheet API 応答: ${response.getResponseCode()} - ${response.getContentText()}`);

  if (response.getResponseCode() >= 400) {

    throw new Error(`AppSheet API Error: ${response.getResponseCode()} - ${response.getContentText()}`);

  }

}