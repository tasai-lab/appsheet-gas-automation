/**
 * Appsheet_名刺取り込み - Webhookエントリーポイント
 * 
 * 外部からのWebhook呼び出しとメイン処理オーケストレーション
 * 
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-23
 */

/**
 * Webhook POST リクエスト受信
 * 
 * @param {Object} e - POSTイベント
 * @returns {GoogleAppsScript.Content.TextOutput} レスポンス
 */
function doPost(e) {
  try {
    // 時間制限チェック
    if (!isWithinOperatingHours()) {
      logInfo('⏰ 稼働時間外のため処理をスキップ');
      return CommonWebhook.createSuccessResponse({
        message: '稼働時間外です',
        operatingHours: `${PROCESSING_CONFIG.startHour}:${PROCESSING_CONFIG.startMinute} - ${PROCESSING_CONFIG.endHour}:00`
      });
    }
    
    logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logInfo(`🚀 Webhook処理開始`);
    logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // 設定検証
    validateConfig();
    
    // メイン処理実行
    const results = processAllBusinessCards();
    
    logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logInfo(`✅ Webhook処理完了`);
    logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    return CommonWebhook.createSuccessResponse({
      processedCount: results.length,
      results: results
    });
    
  } catch (error) {
    logError('Webhook処理エラー', error);
    
    return CommonWebhook.createErrorResponse(
      'PROCESSING_ERROR',
      error.message,
      500
    );
  }
}

/**
 * 稼働時間内かチェック
 * 
 * @returns {boolean}
 */
function isWithinOperatingHours() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // 開始時刻チェック
  if (currentHour < PROCESSING_CONFIG.startHour) {
    return false;
  }
  
  if (currentHour === PROCESSING_CONFIG.startHour && currentMinute < PROCESSING_CONFIG.startMinute) {
    return false;
  }
  
  // 終了時刻チェック
  if (currentHour >= PROCESSING_CONFIG.endHour) {
    return false;
  }
  
  return true;
}

/**
 * 全名刺処理（メイン処理）
 * 
 * @returns {Array<Object>} 処理結果配列
 */
function processAllBusinessCards() {
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logInfo(`🎴 名刺一括処理開始`);
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // 実行タイマー開始
  const executionTimer = new ExecutionTimer();
  
  // コスト計算機初期化
  initializeCostCalculator();
  
  const results = [];
  
  try {
    // ソースフォルダー取得
    const sourceFolder = getSourceFolder();
    const files = sourceFolder.getFiles();
    
    // ペアリング
    const pairedCards = pairBusinessCards(files);
    
    if (pairedCards.length === 0) {
      logInfo('📭 処理対象なし');
      
      // 実行ログ記録
      logExecution(
        'Appsheet_名刺取り込み',
        'スキップ',
        Utilities.getUuid(),
        {
          summary: '処理対象の名刺なし',
          processingTime: `${executionTimer.getElapsedSeconds()}秒`,
          apiUsed: 'Vertex AI',
          modelName: VERTEX_AI_CONFIG.ocrModel,
          cost: '$0.000000'
        }
      );
      
      return results;
    }
    
    // 移動先フォルダー
    const destinationFolder = getDestinationFolder();
    
    // 各名刺を処理
    for (let i = 0; i < pairedCards.length; i++) {
      const card = pairedCards[i];
      
      logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logInfo(`📇 名刺 ${i + 1}/${pairedCards.length} 処理開始`);
      logInfo(`   表面: ${card.front.getName()}`);
      if (card.back) {
        logInfo(`   裏面: ${card.back.getName()}`);
      }
      logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      try {
        const result = processSingleBusinessCard(card, destinationFolder);
        results.push(result);
        
        logInfo(`✅ 名刺 ${i + 1} 処理完了: ${result.action} - ${result.fullName}`);
        
      } catch (error) {
        logError(`名刺 ${i + 1} 処理エラー`, error);
        
        results.push({
          action: 'ERROR',
          error: error.message,
          frontFileName: card.front.getName(),
          backFileName: card.back ? card.back.getName() : null
        });
      }
      
      // レート制限対策（少し待機）
      Utilities.sleep(500);
    }
    
    // コスト計算
    const costCalc = getCostCalculator();
    const costSummary = costCalc.getSummary(VERTEX_AI_CONFIG.ocrModel);
    
    // 統計計算
    const successCount = results.filter(r => r.action === 'CREATE' || r.action === 'UPDATE').length;
    const skipCount = results.filter(r => r.action === 'SKIP').length;
    const deleteCount = results.filter(r => r.action === 'DELETE').length;
    const errorCount = results.filter(r => r.action === 'ERROR').length;
    
    logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logInfo(`📊 処理統計`);
    logInfo(`   合計: ${results.length}件`);
    logInfo(`   登録/更新: ${successCount}件`);
    logInfo(`   スキップ: ${skipCount}件 (名刺既存)`);
    logInfo(`   重複削除: ${deleteCount}件`);
    logInfo(`   エラー: ${errorCount}件`);
    logInfo(`💰 コスト情報`);
    logInfo(`   API呼び出し: ${costSummary.totalApiCalls}回`);
    logInfo(`   入力トークン: ${costSummary.totalInputTokens}`);
    logInfo(`   出力トークン: ${costSummary.totalOutputTokens}`);
    logInfo(`   総コスト: ${costSummary.costFormatted}`);
    logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // 実行ログ記録
    logExecution(
      'Appsheet_名刺取り込み',
      errorCount === 0 ? '成功' : (successCount > 0 ? '一部成功' : '失敗'),
      Utilities.getUuid(),
      {
        summary: `${results.length}件処理 (登録/更新:${successCount}, スキップ:${skipCount}, 重複:${deleteCount}, エラー:${errorCount})`,
        processingTime: `${executionTimer.getElapsedSeconds()}秒`,
        apiUsed: 'Vertex AI',
        modelName: VERTEX_AI_CONFIG.ocrModel,
        tokens: costCalc.getLogString(VERTEX_AI_CONFIG.ocrModel),
        cost: costSummary.costFormatted,
        inputSummary: `${results.length}枚の名刺画像`,
        outputSummary: `${successCount}件登録/更新, ${skipCount}件スキップ`,
        notes: errorCount > 0 ? `${errorCount}件のエラーあり` : (skipCount > 0 ? `${skipCount}件は名刺既存のためスキップ` : '')
      }
    );
    
    return results;
    
  } catch (error) {
    logError('名刺一括処理エラー', error);
    
    // エラー時もログ記録
    logExecution(
      'Appsheet_名刺取り込み',
      '失敗',
      Utilities.getUuid(),
      {
        summary: '処理中に致命的エラー発生',
        errorMessage: error.message,
        processingTime: `${executionTimer.getElapsedSeconds()}秒`,
        apiUsed: 'Vertex AI',
        modelName: VERTEX_AI_CONFIG.ocrModel
      }
    );
    
    throw error;
  }
}

/**
 * 単一名刺処理
 * 
 * @param {Object} card - {front: File, back: File | null}
 * @param {GoogleAppsScript.Drive.Folder} destinationFolder - 移動先フォルダー
 * @returns {Object} 処理結果
 */
function processSingleBusinessCard(card, destinationFolder) {
  // STEP 1: OCR抽出
  logInfo('STEP 1️⃣: OCR情報抽出');
  const extractedInfo = extractBusinessCardInfo(card.front, card.back);
  
  logDebug('抽出情報', extractedInfo);
  
  // 表裏入れ替えフラグをチェック
  let actualFront = card.front;
  let actualBack = card.back;
  
  if (extractedInfo._swapped) {
    logInfo('🔄 表裏入れ替え: 裏面を表面として使用');
    actualFront = card.back;
    actualBack = card.front;
  }
  
  // STEP 2: 重複チェック
  logInfo('STEP 2️⃣: 重複チェック');
  const actionResult = determineContactAction(extractedInfo);
  
  logInfo(`   判定: ${actionResult.action}`);
  
  // STEP 3: アクション実行
  logInfo('STEP 3️⃣: アクション実行');
  
  let finalAction = actionResult.action;
  let contactId = actionResult.contactId;
  
  if (actionResult.action === 'DELETE') {
    // 完全重複 → ファイルをアーカイブ（削除の代わり）
    logInfo('   ⚠️  完全重複のためファイルをアーカイブ');
    archiveFile(getFileId(actualFront));
    
    if (actualBack) {
      archiveFile(getFileId(actualBack));
    }
    
    return buildProcessingResult(
      'DELETE',
      null,
      extractedInfo,
      actualFront.getName(),
      actualBack ? actualBack.getName() : null
    );
    
  } else if (actionResult.action === 'CHECK_ORG') {
    // 組織比較が必要
    logInfo('   🔍 組織情報を比較');
    
    const existingOrg = getOrganizationInfo(actionResult.orgId);
    
    if (!existingOrg) {
      logInfo('   ⚠️  既存組織情報なし → 新規作成');
      finalAction = 'CREATE';
      
    } else {
      // AI比較
      const isSameOrg = compareOrganizations(
        existingOrg.name,
        existingOrg.address,
        extractedInfo.card_org_name,
        extractedInfo.card_org_address
      );
      
      if (isSameOrg) {
        logInfo('   ✅ 同一組織 → UPDATE');
        finalAction = 'UPDATE';
      } else {
        logInfo('   ❌ 別組織 → CREATE');
        finalAction = 'CREATE';
      }
    }
  }
  
  // STEP 4: 連絡先ID確定
  if (!contactId) {
    contactId = generateUniqueContactId();
  }
  
  // STEP 5: ファイル名生成（入れ替え済みのファイルを使用）
  const frontFileName = generateFileName(extractedInfo, contactId, false);
  const backFileName = actualBack ? generateFileName(extractedInfo, contactId, true) : null;
  
  logDebug('ファイル名生成結果', {
    swapped: extractedInfo._swapped || false,
    hasFront: !!actualFront,
    hasBack: !!actualBack,
    frontFileName: frontFileName,
    backFileName: backFileName,
    actualFrontName: actualFront.getName(),
    actualBackName: actualBack ? actualBack.getName() : 'なし'
  });
  
  // STEP 6: ファイル移動（入れ替え済みのファイルを使用）
  logInfo('STEP 4️⃣: ファイル移動');
  logInfo(`   表面: ${actualFront.getName()} → ${frontFileName}`);
  moveAndRenameFile(actualFront, destinationFolder, frontFileName);
  
  if (actualBack) {
    logInfo(`   裏面: ${actualBack.getName()} → ${backFileName}`);
    moveAndRenameFile(actualBack, destinationFolder, backFileName);
    logInfo(`   ✅ 裏面ファイル移動完了`);
  } else {
    logInfo(`   ⚠️  裏面ファイルなし`);
  }
  
  // STEP 7: AppSheet更新
  logInfo('STEP 5️⃣: AppSheet更新');
  
  let actionExecuted = finalAction;
  
  if (finalAction === 'CREATE') {
    createContactInAppSheet(contactId, extractedInfo, frontFileName, backFileName);
    
  } else if (finalAction === 'UPDATE') {
    // 名刺が既に存在する場合はスキップされる可能性がある
    try {
      updateContactInAppSheet(contactId, extractedInfo, frontFileName, backFileName);
    } catch (error) {
      // スキップの場合は特別なエラーメッセージをチェック
      if (error.message && error.message.includes('名刺画像が既に存在')) {
        logInfo('   ⚠️  名刺画像が既に存在するため更新スキップ');
        logInfo('   📦 ファイルをアーカイブへ移動');
        
        // 移動済みファイルを元に戻してからアーカイブ
        // ※既にdestinationFolderに移動済みなので、そこから取得
        const movedFrontFile = destinationFolder.getFilesByName(frontFileName).hasNext() 
          ? destinationFolder.getFilesByName(frontFileName).next() 
          : null;
        
        if (movedFrontFile) {
          archiveFile(movedFrontFile.getId());
        }
        
        if (backFileName) {
          const movedBackFile = destinationFolder.getFilesByName(backFileName).hasNext() 
            ? destinationFolder.getFilesByName(backFileName).next() 
            : null;
          
          if (movedBackFile) {
            archiveFile(movedBackFile.getId());
          }
        }
        
        actionExecuted = 'SKIP';
      } else {
        throw error;
      }
    }
  }
  
  return buildProcessingResult(
    actionExecuted,
    contactId,
    extractedInfo,
    frontFileName,
    backFileName
  );
}
