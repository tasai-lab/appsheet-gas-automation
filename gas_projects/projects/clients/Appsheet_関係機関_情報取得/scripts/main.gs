/**
 * Appsheet_関係機関_情報取得
 * Google Mapの登録名称と住所から、Google Places APIで関係機関の詳細情報を取得し、
 * AppSheetのOrganizationsテーブルを更新
 *
 * コスト管理機能:
 * - 既に「確認済」の組織はスキップ
 * - 検索結果を24時間キャッシュ
 * - API呼び出し回数を実行ログに記録
 *
 * @version 2.0.0
 * @date 2025-10-23
 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  const logger = createLogger(SCRIPT_NAME);
  const debugLogger = createDebugLogger('doPost');
  const timer = new ExecutionTimer(); // 共通モジュールパターン
  let recordId = null;
  let status = '成功';
  let apiCallCount = 0;

  try {
    debugLogger.logStep('Webhook受信');

    // リクエストパラメータを解析
    debugLogger.debug('リクエストボディ解析開始', {
      contentType: e.postData?.type,
      contentLength: e.postData?.contents?.length
    });

    const params = JSON.parse(e.postData.contents);
    const orgId = params.org_id || params.orgId;
    const commonName = params.common_name || params.commonName;
    const fullAddress = params.full_address || params.fullAddress;

    recordId = orgId;

    debugLogger.info('パラメータ解析完了', {
      orgId: orgId,
      commonName: commonName,
      fullAddress: fullAddress,
      allParams: params
    });

    logger.info('Webhook受信', { orgId, commonName, fullAddress });

    // 重複チェック
    const dupPrevention = createDuplicationPrevention(SCRIPT_NAME);
    const result = dupPrevention.executeWithRetry(orgId, () => {
      const processResult = processRequest(orgId, commonName, fullAddress);
      apiCallCount = processResult.apiCallCount || 0;
      return processResult;
    }, logger);

    if (result.isDuplicate) {
      status = '重複';
      debugLogger.warn('重複実行を検出');
      logger.warning('重複実行を検出');

      // 共通モジュールパターンでログ記録
      logSkip(recordId, '重複実行', {
        processingTime: timer.getElapsedSeconds(),
        places_api_calls: 0
      });

      return ContentService.createTextOutput('重複実行')
        .setMimeType(ContentService.MimeType.TEXT);
    }

    if (!result.success) {
      throw new Error(result.error);
    }

    logger.success('処理完了', {
      result: result.result,
      apiCalls: apiCallCount,
      skipped: result.result.skipped || false
    });
    return ContentService.createTextOutput('OK')
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    status = 'エラー';
    debugLogger.error('処理エラー発生', {
      errorMessage: error.toString(),
      errorStack: error.stack,
      recordId: recordId,
      apiCalls: apiCallCount
    });

    logger.error(`処理エラー: ${error.toString()}`, {
      stack: error.stack,
      recordId: recordId,
      apiCalls: apiCallCount
    });
    return ContentService.createTextOutput('ERROR')
      .setMimeType(ContentService.MimeType.TEXT);

  } finally {
    // ExecutionTimerで経過時間を計測（共通モジュールパターン）
    const processingTime = timer.getElapsedSeconds();

    debugLogger.info('処理完了', {
      status: status,
      processingTime: `${processingTime}秒`,
      apiCalls: apiCallCount
    });

    // コスト情報を計算（共通モジュールパターン）
    const costDetails = calculateApiCostDetails(apiCallCount, result?.result?.cacheUsed || false);

    // 実行ログにAPI呼び出し回数とデバッグ情報を記録
    const debugNotes = DEBUG_MODE ? debugLogger.toNoteString(500) : '';

    // 共通モジュールパターンでログ記録（コスト情報を含む）
    logger.saveToSpreadsheet(status, recordId, {
      ...costDetails,
      processingTime: processingTime,
      debugNotes: debugNotes,
      searchQuery: `${result?.result?.commonName || ''} ${result?.result?.fullAddress || ''}`.trim(),
      processType: 'Places API検索',
      summary: `組織ID: ${recordId}`
    });

    // デバッグモード: 全ログをコンソール出力
    if (DEBUG_MODE) {
      console.log('\n=== デバッグサマリー ===');
      console.log(JSON.stringify(debugLogger.getSummary(), null, 2));
      console.log('\n=== コスト情報 ===');
      console.log(JSON.stringify(costDetails, null, 2));
    }
  }
}

/**
 * メイン処理関数（引数ベース）
 * @param {string} orgId - 組織ID
 * @param {string} commonName - Google Mapでの登録名称
 * @param {string} fullAddress - 郵便番号＋所在地
 * @returns {Object} - 処理結果
 */
function processRequest(orgId, commonName, fullAddress) {
  const debugLogger = createDebugLogger('processRequest');
  let apiCallCount = 0;

  try {
    debugLogger.logStep('処理開始', {
      orgId: orgId,
      commonName: commonName,
      fullAddress: fullAddress
    });

    // 必須パラメータチェック
    debugLogger.debug('必須パラメータチェック');
    if (!orgId || !commonName || !fullAddress) {
      debugLogger.error('必須パラメータ不足', {
        orgId: orgId || 'なし',
        commonName: commonName || 'なし',
        fullAddress: fullAddress || 'なし'
      });
      throw new Error('必須パラメータ（org_id, common_name, full_address）が不足しています。');
    }

    console.log(`処理開始: Org ID = ${orgId}, Name = ${commonName}`);

    // コスト管理: 既存データを確認
    debugLogger.logStep('既存データ確認');
    const existingOrg = getOrganizationById(orgId);

    debugLogger.debug('既存データ取得結果', {
      found: !!existingOrg,
      info_accuracy: existingOrg?.info_accuracy || 'なし'
    });

    if (existingOrg && existingOrg.info_accuracy === '確認済') {
      debugLogger.info('既に確認済みのためスキップ', { orgId: orgId });
      console.log(`組織 ${orgId} は既に確認済みです。処理をスキップします。`);

      // 共通モジュールパターンでスキップログを記録
      // このログはdoPostのfinallyブロックでも記録されるが、
      // processRequest単体で呼ばれた場合のために保持

      return {
        success: true,
        orgId: orgId,
        skipped: true,
        message: '既に確認済みのためスキップしました',
        apiCallCount: 0,
        cacheUsed: false,
        debugLogs: debugLogger.getAllLogs()
      };
    }

    // Places APIで情報を取得（キャッシュ対応）
    debugLogger.logStep('Places API情報取得');
    const placesApiTimer = new ExecutionTimer();
    const placeDataResult = getPlaceDetailsWithCache(commonName, fullAddress);
    apiCallCount = placeDataResult.apiCalled ? 1 : 0;

    debugLogger.info('Places API結果', {
      apiCalled: placeDataResult.apiCalled,
      hasError: !!placeDataResult.error,
      hasData: !!placeDataResult.data
    });

    if (placeDataResult.error) {
      debugLogger.error('Places APIエラー', { error: placeDataResult.error });

      // Places APIエラーをログに記録
      if (placeDataResult.apiCalled) {
        const apiCostDetails = calculateApiCostDetails(1, false);
        logFailure(orgId, new Error(placeDataResult.error), {
          ...apiCostDetails,
          processingTime: placesApiTimer.getElapsedSeconds(),
          processType: 'Places API検索',
          searchQuery: `${commonName} ${fullAddress}`,
          summary: `Places API失敗: ${orgId}`
        });
      }

      throw new Error(placeDataResult.error);
    }

    const placeData = placeDataResult.data;

    // Places API成功をログに記録
    if (placeDataResult.apiCalled) {
      const apiCostDetails = calculateApiCostDetails(1, false);
      logSuccess(orgId, {
        ...apiCostDetails,
        processingTime: placesApiTimer.getElapsedSeconds(),
        processType: 'Places API検索',
        searchQuery: `${commonName} ${fullAddress}`,
        summary: `Places API成功: ${orgId}`
      });
    }

    debugLogger.logTransformation('Places API → AppSheet', placeDataResult.data, {
      postal_code: placeData.postal_code,
      address: placeData.address,
      latlong: placeData.latlong,
      main_phone: placeData.main_phone,
      website_url: placeData.website_url,
      operating_hours: placeData.operating_hours ? '設定あり' : 'なし'
    });

    // AppSheetに取得結果を書き込み
    debugLogger.logStep('AppSheet更新');
    updateOrganization(orgId, placeData);

    debugLogger.info('処理完了', {
      orgId: orgId,
      apiCallCount: apiCallCount,
      cacheUsed: !placeDataResult.apiCalled
    });

    console.log(`処理完了。ID ${orgId} の情報を更新しました。API呼び出し: ${apiCallCount}回`);

    if (DEBUG_MODE) {
      console.log('\n=== processRequest デバッグサマリー ===');
      console.log(JSON.stringify(debugLogger.getSummary(), null, 2));
    }

    return {
      success: true,
      orgId: orgId,
      placeData: placeData,
      apiCallCount: apiCallCount,
      cacheUsed: !placeDataResult.apiCalled,
      debugLogs: debugLogger.getAllLogs()
    };

  } catch (error) {
    debugLogger.error('processRequest失敗', {
      error: error.message,
      stack: error.stack
    });

    if (DEBUG_MODE) {
      console.log('\n=== processRequest エラーログ ===');
      console.log(debugLogger.toJSON());
    }

    return {
      success: false,
      error: error.message,
      apiCallCount: apiCallCount,
      debugLogs: debugLogger.getAllLogs()
    };
  }
}

/**
 * AppSheet APIで組織情報を取得
 * @param {string} orgId - 組織ID
 * @returns {Object|null} 組織情報、存在しない場合はnull
 */
function getOrganizationById(orgId) {
  const debugLogger = createDebugLogger('getOrganizationById');

  try {
    debugLogger.logStep('AppSheet Find API呼び出し', { orgId: orgId });

    const findPayload = {
      Action: 'Find',
      Properties: APPSHEET_API_CONFIG.properties,
      Selector: `Filter(${ORGANIZATIONS_TABLE_NAME}, [org_id] = "${orgId}")`
    };

    const apiUrl = `${APPSHEET_API_CONFIG.baseUrl}/apps/${APPSHEET_APP_ID}/tables/${ORGANIZATIONS_TABLE_NAME}/Action`;

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'ApplicationAccessKey': APPSHEET_ACCESS_KEY
      },
      payload: JSON.stringify(findPayload),
      muteHttpExceptions: true
    };

    debugLogger.logApiRequest('AppSheet Find', 'POST', apiUrl, findPayload, options.headers);

    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    debugLogger.logApiResponse('AppSheet Find', responseCode, responseBody.substring(0, 200), null);

    console.log(`AppSheet API レスポンス: ${responseCode}`);

    if (responseCode >= 400) {
      debugLogger.error('AppSheet Find APIエラー', {
        statusCode: responseCode,
        responseBody: responseBody
      });
      console.error(`AppSheet API 呼び出しエラー: Error: AppSheet API エラー: ${responseCode} - ${responseBody}`);
      // エラーが発生しても処理を続行（新規作成の可能性）
      return null;
    }

    const organizations = JSON.parse(responseBody);

    debugLogger.debug('Find結果解析', {
      resultType: typeof organizations,
      isArray: Array.isArray(organizations),
      length: organizations?.length
    });

    if (organizations && organizations.length > 0) {
      debugLogger.info('既存組織発見', {
        orgId: orgId,
        info_accuracy: organizations[0].info_accuracy || '未設定'
      });
      console.log(`既存の組織情報を取得: ${orgId}, info_accuracy = ${organizations[0].info_accuracy || '未設定'}`);
      return organizations[0];
    } else {
      debugLogger.info('組織情報なし', { orgId: orgId });
      console.log(`組織情報が見つかりません: ${orgId}`);
      return null;
    }

  } catch (error) {
    debugLogger.error('組織情報取得エラー', {
      error: error.toString(),
      stack: error.stack
    });
    console.error(`組織情報取得エラー: ${error.toString()}`);
    // エラーが発生しても処理を続行（新規作成の可能性）
    return null;
  }
}
