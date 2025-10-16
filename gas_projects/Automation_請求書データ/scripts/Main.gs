/**
 * メイン処理
 * 
 * 介護・医療の請求データを集約し、Billing_Itemsシートを更新します。
 */

/**
 * エントリーポイント - トリガーから実行
 */
function aggregateBillingItems() {
  const timer = new ExecutionTimer();
  const requestId = Utilities.getUuid();
  
  debugLog('=== 処理開始 ===');
  
  // 重複実行チェック
  const lockKey = 'billing_aggregation_lock';
  const scriptProperties = PropertiesService.getScriptProperties();
  const existingLock = scriptProperties.getProperty(lockKey);
  
  if (existingLock) {
    const lockTime = new Date(existingLock);
    const now = new Date();
    if ((now - lockTime) < 300000) { // 5分以内
      Logger.log('処理実行中のためスキップします');
      logToExecutionSheet('Automation_請求書データ', 'スキップ', requestId, {
        summary: '他の処理が実行中のためスキップ',
        processingTime: timer.getElapsedSeconds()
      });
      return;
    }
  }
  
  // ロック設定
  scriptProperties.setProperty(lockKey, new Date().toISOString());
  
  try {
    // マスターデータ読み込み
    debugLog('ステップ1: マスターデータの読み込み');
    const careMaster = loadCareMaster();
    const mediMaster = loadMediMaster();
    
    if (careMaster.size === 0 || mediMaster.size === 0) {
      throw new Error('マスターデータの読み込みに失敗しました');
    }
    
    // データ集約
    debugLog('ステップ2: データ集約');
    const aggregatedData = aggregateData(careMaster, mediMaster);
    
    // スプレッドシートへ書き込み
    debugLog('ステップ3: データ書き込み');
    const writeResult = writeToSpreadsheet(aggregatedData);
    
    // 成功ログ
    logToExecutionSheet('Automation_請求書データ', '成功', requestId, {
      summary: `更新: ${writeResult.updated}件, 新規追加: ${writeResult.appended}件`,
      processingTime: timer.getElapsedSeconds(),
      outputSummary: `総件数: ${Object.keys(aggregatedData).length}件`
    });
    
    Logger.log(`処理完了 - 更新: ${writeResult.updated}件, 新規追加: ${writeResult.appended}件`);
    debugLog('=== 処理正常終了 ===');
    
  } catch (e) {
    Logger.log(`エラー: ${e.message}\n${e.stack}`);
    
    logToExecutionSheet('Automation_請求書データ', '失敗', requestId, {
      errorMessage: e.message,
      processingTime: timer.getElapsedSeconds()
    });
    
    debugLog('=== 処理異常終了 ===');
    
  } finally {
    // ロック解除
    scriptProperties.deleteProperty(lockKey);
  }
}

/**
 * データ集約処理
 */
function aggregateData(careMaster, mediMaster) {
  const ss = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const aggregatedData = {};
  
  // 介護データの集約
  debugLog(`介護データ集約開始: ${CARE_SHEET_NAME}`);
  aggregateCareData(ss, aggregatedData, careMaster);
  
  // 医療データの集約
  debugLog(`医療データ集約開始: ${MEDI_SHEET_NAME}`);
  aggregateMediData(ss, aggregatedData, mediMaster);
  
  // 最終計算（介護のamount計算）
  debugLog('最終計算処理');
  finalizeCalculations(aggregatedData);
  
  return aggregatedData;
}

/**
 * 介護データを集約
 */
function aggregateCareData(ss, aggregatedData, careMaster) {
  const sheet = ss.getSheetByName(CARE_SHEET_NAME);
  if (!sheet) {
    throw new Error(`シートが見つかりません: ${CARE_SHEET_NAME}`);
  }
  
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const headerMap = createHeaderMap(headers, ['client_id', 'service_code', 'record_ym', 'billing_ym']);
  
  values.forEach((row, index) => {
    const clientId = row[headerMap.client_id];
    const serviceCode = row[headerMap.service_code];
    const recordYm = row[headerMap.record_ym];
    
    if (!clientId || !serviceCode || !recordYm) return;
    
    const key = `${clientId}|${serviceCode}|${recordYm}`;
    const masterData = careMaster.get(serviceCode.toString());
    
    if (!masterData) {
      debugLog(`[介護:${index + 2}行目] 警告: マスターにサービスコード '${serviceCode}' が見つかりません`);
    }
    
    const serviceName = masterData ? masterData.name : '';
    const serviceUnits = masterData ? masterData.units : 0;
    
    if (!aggregatedData[key]) {
      aggregatedData[key] = {
        count: 1,
        units: serviceUnits,
        amount: 0, // 後で計算
        billing_ym: row[headerMap.billing_ym],
        insurance: '介護',
        name: serviceName
      };
      debugLog(`[介護:${index + 2}行目] 新規キー: ${key}, 単位: ${serviceUnits}`);
    } else {
      aggregatedData[key].count++;
      aggregatedData[key].billing_ym = row[headerMap.billing_ym];
      debugLog(`[介護:${index + 2}行目] 既存キー: ${key}, 回数+1`);
    }
  });
  
  debugLog(`介護データ集約完了: ${Object.keys(aggregatedData).length}件`);
}

/**
 * 医療データを集約
 */
function aggregateMediData(ss, aggregatedData, mediMaster) {
  const sheet = ss.getSheetByName(MEDI_SHEET_NAME);
  if (!sheet) {
    throw new Error(`シートが見つかりません: ${MEDI_SHEET_NAME}`);
  }
  
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const headerMap = createHeaderMap(headers, ['client_id', 'fee_code', 'record_ym', 'amount', 'billing_ym']);
  
  values.forEach((row, index) => {
    const clientId = row[headerMap.client_id];
    const feeCode = row[headerMap.fee_code];
    const recordYm = row[headerMap.record_ym];
    
    if (!clientId || !feeCode || !recordYm) return;
    
    const key = `${clientId}|${feeCode}|${recordYm}`;
    const masterData = mediMaster.get(feeCode.toString());
    
    if (!masterData) {
      debugLog(`[医療:${index + 2}行目] 警告: マスターにfee_code '${feeCode}' が見つかりません`);
    }
    
    const serviceName = masterData ? masterData.name : '';
    const serviceUnits = masterData ? masterData.units : 0;
    const amountToAdd = parseFloat(row[headerMap.amount] || 0);
    
    if (!aggregatedData[key]) {
      aggregatedData[key] = {
        count: 1,
        units: serviceUnits,
        amount: amountToAdd,
        billing_ym: row[headerMap.billing_ym],
        insurance: '医療',
        name: serviceName
      };
      debugLog(`[医療:${index + 2}行目] 新規キー: ${key}, 単位: ${serviceUnits}, 金額: ${amountToAdd}`);
    } else {
      aggregatedData[key].count++;
      aggregatedData[key].amount += amountToAdd;
      aggregatedData[key].billing_ym = row[headerMap.billing_ym];
      debugLog(`[医療:${index + 2}行目] 既存キー: ${key}, 回数+1, 金額+${amountToAdd}`);
    }
  });
  
  debugLog(`医療データ集約完了: ${Object.keys(aggregatedData).length}件`);
}

/**
 * 最終計算処理
 */
function finalizeCalculations(aggregatedData) {
  for (const key in aggregatedData) {
    const data = aggregatedData[key];
    
    if (data.insurance === '介護') {
      // 介護の場合: amount = units × count
      data.amount = data.units * data.count;
      debugLog(`[介護-最終計算] ${key}: amount = ${data.units} × ${data.count} = ${data.amount}`);
    }
  }
}

/**
 * スプレッドシートへ書き込み
 */
function writeToSpreadsheet(aggregatedData) {
  const ss = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(TARGET_SHEET_NAME);
  
  if (!sheet) {
    throw new Error(`シートが見つかりません: ${TARGET_SHEET_NAME}`);
  }
  
  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values.shift() || [];
  
  const headerMap = createHeaderMap(headers, [
    'item_id', 'client_id', 'service_code', 'record_ym', 
    'service_count', 'service_units', 'amount', 'billing_ym', 
    'insurance_type', 'service_name'
  ]);
  
  // 既存データのマップを作成
  const existingDataMap = new Map();
  values.forEach((row, index) => {
    const key = `${row[headerMap.client_id]}|${row[headerMap.service_code]}|${row[headerMap.record_ym]}`;
    existingDataMap.set(key, index + 2); // 行番号（ヘッダー除く）
  });
  
  debugLog(`既存データ: ${existingDataMap.size}件`);
  
  const rowsToAppend = [];
  let updateCount = 0;
  
  for (const key in aggregatedData) {
    const [clientId, serviceCode, recordYm] = key.split('|');
    const data = aggregatedData[key];
    
    if (existingDataMap.has(key)) {
      // 更新
      const rowNum = existingDataMap.get(key);
      debugLog(`更新: ${key} (行: ${rowNum})`);
      
      if (headerMap.service_count !== -1) {
        sheet.getRange(rowNum, headerMap.service_count + 1).setValue(data.count);
      }
      if (headerMap.service_units !== -1) {
        sheet.getRange(rowNum, headerMap.service_units + 1).setValue(data.units);
      }
      if (headerMap.amount !== -1) {
        sheet.getRange(rowNum, headerMap.amount + 1).setValue(data.amount);
      }
      if (headerMap.billing_ym !== -1) {
        sheet.getRange(rowNum, headerMap.billing_ym + 1).setValue(data.billing_ym);
      }
      if (headerMap.insurance_type !== -1) {
        sheet.getRange(rowNum, headerMap.insurance_type + 1).setValue(data.insurance);
      }
      if (headerMap.service_name !== -1) {
        sheet.getRange(rowNum, headerMap.service_name + 1).setValue(data.name);
      }
      
      updateCount++;
      
    } else {
      // 新規追加
      debugLog(`新規追加: ${key}`);
      
      const newRow = new Array(headers.length).fill('');
      newRow[headerMap.item_id] = `ITM-${Utilities.getUuid().substring(0, 8)}`;
      newRow[headerMap.client_id] = clientId;
      newRow[headerMap.service_code] = serviceCode;
      newRow[headerMap.record_ym] = recordYm;
      newRow[headerMap.service_count] = data.count;
      newRow[headerMap.service_units] = data.units;
      newRow[headerMap.amount] = data.amount;
      newRow[headerMap.billing_ym] = data.billing_ym;
      newRow[headerMap.insurance_type] = data.insurance;
      newRow[headerMap.service_name] = data.name;
      
      rowsToAppend.push(newRow);
    }
  }
  
  if (rowsToAppend.length > 0) {
    debugLog(`新規行を一括追加: ${rowsToAppend.length}件`);
    sheet.getRange(
      sheet.getLastRow() + 1, 
      1, 
      rowsToAppend.length, 
      headers.length
    ).setValues(rowsToAppend);
  }
  
  return {
    updated: updateCount,
    appended: rowsToAppend.length
  };
}
