/**
 * Google Places API統合サービス
 * Places API (New) を使用して施設情報を取得
 *
 * コスト最適化:
 * - CacheServiceで検索結果を24時間キャッシュ
 * - API呼び出し回数を追跡
 */

/**
 * キャッシュ付きでPlaces API情報を取得
 * @param {string} name - Google Mapでの登録名称
 * @param {string} address - 郵便番号＋所在地
 * @returns {Object} { data: 取得した情報, apiCalled: API呼び出しフラグ, error?: エラーメッセージ }
 */
function getPlaceDetailsWithCache(name, address) {
  const debugLogger = createDebugLogger('getPlaceDetailsWithCache');

  // キャッシュキーを生成
  const cacheKey = `places_${name}_${address}`.replace(/\s+/g, '_');
  const cache = CacheService.getScriptCache();

  debugLogger.debug('キャッシュキー生成', {
    name: name,
    address: address,
    cacheKey: cacheKey
  });

  // キャッシュから取得を試みる
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    debugLogger.logCache('HIT', cacheKey, {
      dataSize: `${cachedData.length} bytes`
    });
    console.log(`キャッシュヒット: ${cacheKey}`);

    try {
      const data = JSON.parse(cachedData);
      debugLogger.info('キャッシュからデータ取得成功', {
        postal_code: data.postal_code,
        latlong: data.latlong,
        main_phone: data.main_phone
      });

      return {
        data: data,
        apiCalled: false
      };
    } catch (error) {
      debugLogger.error('キャッシュデータのパースエラー', {
        error: error.toString(),
        cachedDataPreview: cachedData.substring(0, 100)
      });
      console.error(`キャッシュデータのパースエラー: ${error.toString()}`);
      // キャッシュが壊れている場合は削除して再取得
      cache.remove(cacheKey);
    }
  }

  // キャッシュミス - API呼び出し
  debugLogger.logCache('MISS', cacheKey);
  console.log(`キャッシュミス: ${cacheKey} - Places APIを呼び出します`);
  const placeData = getPlaceDetails(name, address);

  if (placeData.error) {
    return {
      error: placeData.error,
      apiCalled: true
    };
  }

  // 成功した場合、キャッシュに保存（24時間 = 86400秒）
  try {
    cache.put(cacheKey, JSON.stringify(placeData), 86400);
    console.log(`キャッシュに保存: ${cacheKey} (24時間)`);
  } catch (error) {
    console.error(`キャッシュ保存エラー: ${error.toString()}`);
    // キャッシュ保存失敗は致命的ではないので処理を続行
  }

  return {
    data: placeData,
    apiCalled: true
  };
}

/**
 * Google Places APIを呼び出し、事業所の詳細情報を取得する
 * @param {string} name - Google Mapでの登録名称
 * @param {string} address - 郵便番号＋所在地
 * @returns {Object} 取得した情報 or エラー
 */
function getPlaceDetails(name, address) {
  const debugLogger = createDebugLogger('getPlaceDetails');
  const apiStartTime = new Date();

  debugLogger.logStep('住所解析');

  // 住所から郵便番号を抽出・整形
  let postalCode = null;
  let cleanAddress = address;

  const postalCodeMatch = address.match(/〒?(\d{3})-?(\d{4})/);
  if (postalCodeMatch) {
    postalCode = `${postalCodeMatch[1]}-${postalCodeMatch[2]}`;
    // 住所から郵便番号部分を削除
    cleanAddress = address.replace(/〒?\d{3}-?\d{4}\s*/, '').trim();
  }

  debugLogger.debug('住所解析結果', {
    originalAddress: address,
    postalCode: postalCode,
    cleanAddress: cleanAddress
  });

  console.log(`Places API検索: "${name} ${cleanAddress}"`);

  // Places API (Text Search) のリクエスト
  const requestBody = {
    textQuery: `${name} ${cleanAddress}`,
    languageCode: PLACES_API_CONFIG.languageCode
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': PLACES_API_CONFIG.fieldMask
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  debugLogger.logApiRequest('Places API', 'POST', PLACES_API_CONFIG.endpoint, requestBody, options.headers);

  try {
    const response = UrlFetchApp.fetch(PLACES_API_CONFIG.endpoint, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    const apiDuration = new Date() - apiStartTime;

    console.log(`Places API レスポンス: ${responseCode}`);

    debugLogger.logApiResponse('Places API', responseCode, null, apiDuration);

    if (responseCode !== 200) {
      debugLogger.error('Places APIエラーレスポンス', {
        statusCode: responseCode,
        responseBody: responseBody
      });
      return {
        error: `Places API エラー: ${responseCode} - ${responseBody}`
      };
    }

    debugLogger.debug('レスポンスボディ解析', {
      bodyLength: responseBody.length,
      bodyPreview: responseBody.substring(0, 200)
    });

    const jsonResponse = JSON.parse(responseBody);

    debugLogger.debug('Places API レスポンス解析', {
      placesCount: jsonResponse.places ? jsonResponse.places.length : 0
    });

    if (!jsonResponse.places || jsonResponse.places.length === 0) {
      debugLogger.warn('検索結果なし', {
        searchQuery: `${name} ${cleanAddress}`
      });
      return {
        error: `「${name} ${cleanAddress}」に一致する情報が見つかりませんでした。`
      };
    }

    // 最も関連性の高い最初の結果を使用
    const place = jsonResponse.places[0];

    debugLogger.debug('取得したPlaceデータ', {
      hasLocation: !!place.location,
      hasPhone: !!place.nationalPhoneNumber,
      hasWebsite: !!place.websiteUri,
      hasOpeningHours: !!place.regularOpeningHours
    });

    // 緯度経度を文字列に変換
    const location = place.location
      ? `${place.location.latitude},${place.location.longitude}`
      : null;

    // 営業時間を指定フォーマットに整形
    const operatingHours = place.regularOpeningHours
      ? formatOpeningHours(place.regularOpeningHours)
      : null;

    debugLogger.info('Places API 取得成功', {
      postalCode: postalCode,
      location: location,
      phone: place.nationalPhoneNumber || 'なし',
      website: place.websiteUri || 'なし',
      operatingHours: operatingHours ? '設定あり' : 'なし'
    });

    console.log('Places API 取得成功', {
      postalCode,
      location,
      phone: place.nationalPhoneNumber || null,
      website: place.websiteUri || null
    });

    return {
      postal_code: postalCode,
      address: cleanAddress,
      latlong: location,
      main_phone: place.nationalPhoneNumber || null,
      website_url: place.websiteUri || null,
      operating_hours: operatingHours
    };

  } catch (error) {
    console.error(`Places API 呼び出しエラー: ${error.toString()}`);
    return {
      error: `Places API 呼び出しエラー: ${error.toString()}`
    };
  }
}

/**
 * Places APIから返された営業時間を指定のテキスト形式に整形する
 * @param {Object} openingHoursData - Places APIのregularOpeningHoursオブジェクト
 * @returns {string} 整形された営業時間テキスト
 */
function formatOpeningHours(openingHoursData) {
  const weekdays = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  const dailyHours = {};

  // periodsがない場合は処理しない
  if (!openingHoursData.periods) {
    return null;
  }

  // 各営業時間帯を曜日ごとに分類
  openingHoursData.periods.forEach(period => {
    // openとcloseが存在するか確認
    if (!period.open || !period.close) {
      return;
    }

    const day = weekdays[period.open.day];
    const openTime = formatTime(period.open.hour, period.open.minute);
    const closeTime = formatTime(period.close.hour, period.close.minute);

    if (!dailyHours[day]) {
      dailyHours[day] = [];
    }

    dailyHours[day].push(`${openTime}～${closeTime}`);
  });

  // 曜日順に整形
  return weekdays.map(day => {
    if (dailyHours[day]) {
      return `${day}: ${dailyHours[day].join(', ')}`;
    } else {
      return `${day}: 定休日`;
    }
  }).join('\n');
}

/**
 * 時刻をフォーマット
 * @param {number} hour - 時
 * @param {number} minute - 分
 * @returns {string} フォーマット済み時刻
 */
function formatTime(hour, minute) {
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `${h}時${m}分`;
}

/**
 * キャッシュをクリア（テスト・デバッグ用）
 * @param {string} name - 施設名（省略時は全キャッシュクリア）
 * @param {string} address - 住所（省略時は全キャッシュクリア）
 */
function clearPlacesCache(name, address) {
  const cache = CacheService.getScriptCache();

  if (name && address) {
    const cacheKey = `places_${name}_${address}`.replace(/\s+/g, '_');
    cache.remove(cacheKey);
    console.log(`キャッシュクリア: ${cacheKey}`);
  } else {
    cache.removeAll(cache.getKeys());
    console.log('全キャッシュクリア完了');
  }
}
