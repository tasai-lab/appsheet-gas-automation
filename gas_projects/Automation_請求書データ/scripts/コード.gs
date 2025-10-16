/**
 * === 設定項目 ===
 * デバッグモードを有効にするか。
 * trueにすると、実行ログに処理の詳細が出力されます。
 * 問題発生時の原因調査に役立ちます。通常運用時はfalseを推奨します。
 */
const DEBUG_MODE = true; 

// --- デバッグログ専用関数 ---
function debugLog(message) {
  if (DEBUG_MODE) {
    Logger.log(message);
  }
}

/**
 * 介護・医療の請求データを集約し、外部マスターを参照してBilling_Itemsシートを更新します。
 */
function aggregateAndWriteBillingItemsAdvanced() {
  debugLog('--- 処理開始 ---');
  
  // --- 基本設定 ---
  const SPREADSHEET_ID = '1KL31iZLNu1pnKH8BMlJ8434TiwNvvJHVcsde33UZ7n8';
  const CARE_SHEET_NAME = 'Billing_Care_Items';
  const MEDI_SHEET_NAME = 'Billing_Medi_Items';
  const TARGET_SHEET_NAME = 'Billing_Items';

  // --- マスターシート情報 ---
  const CARE_MASTER_ID = '1r-ehIg7KMrSPBCI3K1wA8UFvBnKvqp1kmb8r7MCH1tQ';
  const CARE_MASTER_SHEET_NAME = '介護_基本・加算マスター';
  const CARE_MASTER_TYPE_COLUMN = '種類';
  const CARE_MASTER_ITEM_COLUMN = '項目';
  const CARE_MASTER_NAME_COLUMN = 'サービス内容略称';
  const CARE_MASTER_UNITS_COLUMN = '単位'; // ★介護の単位を取得する列

  const MEDI_MASTER_ID = '1iMmlw-A7K1v-CfksGUutap2xYPNLiL1bWaBg8BRO-1M';
  const MEDI_MASTER_SHEET_NAME = '医療_基本テーブルr';
  const MEDI_MASTER_KEY_COLUMN = '訪問看護療養費コード';
  const MEDI_MASTER_NAME_COLUMN = '省略名称';
  const MEDI_MASTER_UNITS_COLUMN = '新又は現金額';

  try {
    debugLog('ステップ1: マスターデータの読み込みを開始します。');
    // ★変更点★ 介護マスターからもサービス名と単位の両方を取得
    const careMasterDataMap = createCareMasterMap(CARE_MASTER_ID, CARE_MASTER_SHEET_NAME, CARE_MASTER_TYPE_COLUMN, CARE_MASTER_ITEM_COLUMN, CARE_MASTER_NAME_COLUMN, CARE_MASTER_UNITS_COLUMN);
    const mediMasterDataMap = createMediMasterMap(MEDI_MASTER_ID, MEDI_MASTER_SHEET_NAME, MEDI_MASTER_KEY_COLUMN, MEDI_MASTER_NAME_COLUMN, MEDI_MASTER_UNITS_COLUMN);
    debugLog(`介護マスターから ${careMasterDataMap.size} 件、医療マスターから ${mediMasterDataMap.size} 件のデータを読み込みました。`);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const aggregatedData = {};

    debugLog(`ステップ2: ${CARE_SHEET_NAME} シートの集計を開始します。`);
    const careSheet = ss.getSheetByName(CARE_SHEET_NAME);
    if (!careSheet) throw new Error(`シートが見つかりません: ${CARE_SHEET_NAME}`);
    const careValues = careSheet.getDataRange().getValues();
    const careHeaders = careValues.shift();
    const careHeaderMap = createHeaderMap(careHeaders, ['client_id', 'service_code', 'record_ym', 'billing_ym']);
    
    careValues.forEach((row, index) => {
      const clientId = row[careHeaderMap.client_id];
      const serviceCode = row[careHeaderMap.service_code];
      const recordYm = row[careHeaderMap.record_ym];
      if (!clientId || !serviceCode || !recordYm) return;

      const key = `${clientId}|${serviceCode}|${recordYm}`;
      const masterData = careMasterDataMap.get(serviceCode.toString());
      if (!masterData) debugLog(`[介護:${index + 2}行目] 警告: 介護マスターにサービスコード '${serviceCode}' が見つかりません。`);

      const serviceName = masterData ? masterData.name : '';
      const serviceUnitsFromMaster = masterData ? masterData.units : 0;
      
      // ★★★★★ 介護の集計ロジックを全面的に変更 ★★★★★
      if (!aggregatedData[key]) {
        // --- このキーが初めて出現した場合 ---
        aggregatedData[key] = {
          count: 1,
          units: serviceUnitsFromMaster, // マスターの単位をそのまま設定
          amount: 0, // amountは後で計算する
          billing_ym: row[careHeaderMap.billing_ym],
          insurance: '介護',
          name: serviceName
        };
         debugLog(`[介護:${index + 2}行目] 新規キー作成: ${key} | 単位(マスター値):${serviceUnitsFromMaster}`);
      } else {
        // --- 既にキーが存在する場合 ---
        aggregatedData[key].count++; // 回数のみを+1
        aggregatedData[key].billing_ym = row[careHeaderMap.billing_ym];
        debugLog(`[介護:${index + 2}行目] 既存キー: ${key} | 回数+1`);
      }
    });

    debugLog(`ステップ3: ${MEDI_SHEET_NAME} シートの集計を開始します。`);
    const mediSheet = ss.getSheetByName(MEDI_SHEET_NAME);
    if (!mediSheet) throw new Error(`シートが見つかりません: ${MEDI_SHEET_NAME}`);
    const mediValues = mediSheet.getDataRange().getValues();
    const mediHeaders = mediValues.shift();
    const mediHeaderMap = createHeaderMap(mediHeaders, ['client_id', 'fee_code', 'record_ym', 'amount', 'billing_ym']);

    mediValues.forEach((row, index) => {
      const clientId = row[mediHeaderMap.client_id];
      const feeCode = row[mediHeaderMap.fee_code];
      const recordYm = row[mediHeaderMap.record_ym];
      if (!clientId || !feeCode || !recordYm) return;
      
      const key = `${clientId}|${feeCode}|${recordYm}`;
      const masterData = mediMasterDataMap.get(feeCode.toString());
      if (!masterData) debugLog(`[医療:${index + 2}行目] 警告: 医療マスターにfee_code '${feeCode}' が見つかりません。`);

      const serviceName = masterData ? masterData.name : '';
      const serviceUnitsFromMaster = masterData ? masterData.units : 0;
      const amountToAdd = parseFloat(row[mediHeaderMap.amount] || 0);

      if (!aggregatedData[key]) {
        aggregatedData[key] = {
          count: 1,
          units: serviceUnitsFromMaster,
          amount: amountToAdd,
          billing_ym: row[mediHeaderMap.billing_ym],
          insurance: '医療',
          name: serviceName
        };
        debugLog(`[医療:${index + 2}行目] 新規キー作成: ${key} | 単位(マスター値):${serviceUnitsFromMaster}, 初期金額:${amountToAdd}`);
      } else {
        aggregatedData[key].count++;
        aggregatedData[key].amount += amountToAdd;
        aggregatedData[key].billing_ym = row[mediHeaderMap.billing_ym];
        debugLog(`[医療:${index + 2}行目] 既存キー: ${key} | 回数+1, 金額+${amountToAdd} => 現在金額:${aggregatedData[key].amount}`);
      }
    });

    // ★★★★★ ステップ3.5: 最終的な計算処理 ★★★★★
    debugLog(`ステップ3.5: 最終計算処理を開始します (介護のamount計算など)。`);
    for (const key in aggregatedData) {
        const data = aggregatedData[key];
        if (data.insurance === '介護') {
            // 介護の場合、amountを「マスター単位 × 回数」で計算する
            data.amount = data.units * data.count;
            debugLog(`[介護-最終計算] キー: ${key} | amount = ${data.units} * ${data.count} = ${data.amount}`);
        }
    }

    debugLog(`ステップ4: ${TARGET_SHEET_NAME} シートへの書き込み処理を開始します。`);
    // (書き込み処理は変更なし)
    const targetSheet = ss.getSheetByName(TARGET_SHEET_NAME);
    if (!targetSheet) throw new Error(`シートが見つかりません: ${TARGET_SHEET_NAME}`);
    const targetRange = targetSheet.getRange(1, 1, Math.max(targetSheet.getLastRow(), 1), Math.max(targetSheet.getLastColumn(), 1));
    const targetValues = targetRange.getValues();
    const targetHeaders = targetValues.shift() || [];
    const targetHeaderMap = createHeaderMap(targetHeaders, ['item_id', 'client_id', 'service_code', 'record_ym', 'service_count', 'service_units', 'amount', 'billing_ym', 'insurance_type', 'service_name']);
    
    const existingDataMap = new Map();
    targetValues.forEach((row, index) => {
      const key = `${row[targetHeaderMap.client_id]}|${row[targetHeaderMap.service_code]}|${row[targetHeaderMap.record_ym]}`;
      existingDataMap.set(key, index + 2);
    });
    debugLog(`${TARGET_SHEET_NAME}シートから既存データを${existingDataMap.size}件読み込みました。`);

    const rowsToAppend = [];
    let updateCount = 0;
    for (const key in aggregatedData) {
      const [clientId, serviceCode, recordYm] = key.split('|');
      const data = aggregatedData[key];

      if (existingDataMap.has(key)) {
        const rowNum = existingDataMap.get(key);
        debugLog(`更新: ${key} (行番号: ${rowNum}) | count:${data.count}, units:${data.units}, amount:${data.amount}`);
        if (targetHeaderMap.service_count !== -1) targetSheet.getRange(rowNum, targetHeaderMap.service_count + 1).setValue(data.count);
        if (targetHeaderMap.service_units !== -1) targetSheet.getRange(rowNum, targetHeaderMap.service_units + 1).setValue(data.units);
        if (targetHeaderMap.amount !== -1) targetSheet.getRange(rowNum, targetHeaderMap.amount + 1).setValue(data.amount);
        if (targetHeaderMap.billing_ym !== -1) targetSheet.getRange(rowNum, targetHeaderMap.billing_ym + 1).setValue(data.billing_ym);
        if (targetHeaderMap.insurance_type !== -1) targetSheet.getRange(rowNum, targetHeaderMap.insurance_type + 1).setValue(data.insurance);
        if (targetHeaderMap.service_name !== -1) targetSheet.getRange(rowNum, targetHeaderMap.service_name + 1).setValue(data.name);
        updateCount++;
      } else {
        debugLog(`新規追加: ${key} | count:${data.count}, units:${data.units}, amount:${data.amount}`);
        const newRow = new Array(targetHeaders.length).fill('');
        newRow[targetHeaderMap.item_id] = `ITM-${Utilities.getUuid().substring(0, 8)}`;
        newRow[targetHeaderMap.client_id] = clientId;
        newRow[targetHeaderMap.service_code] = serviceCode;
        newRow[targetHeaderMap.record_ym] = recordYm;
        newRow[targetHeaderMap.service_count] = data.count;
        newRow[targetHeaderMap.service_units] = data.units;
        newRow[targetHeaderMap.amount] = data.amount;
        newRow[targetHeaderMap.billing_ym] = data.billing_ym;
        newRow[targetHeaderMap.insurance_type] = data.insurance;
        newRow[targetHeaderMap.service_name] = data.name;
        rowsToAppend.push(newRow);
      }
    }

    if (rowsToAppend.length > 0) {
      debugLog(`シートの末尾に${rowsToAppend.length}行をまとめて追加します。`);
      targetSheet.getRange(targetSheet.getLastRow() + 1, 1, rowsToAppend.length, targetHeaders.length).setValues(rowsToAppend);
    }
    
    Logger.log(`処理が完了しました。 更新: ${updateCount}件, 新規追加: ${rowsToAppend.length}件`);
    debugLog('--- 処理正常終了 ---');

  } catch (e) {
    Logger.log(`エラーが発生しました: ${e.message} (スタックトレース: ${e.stack})`);
    debugLog('--- 処理異常終了 ---');
  }
}

// --- 以下、ヘルパー関数 ---

/**
 * 【介護マスター専用】サービス名と単位数を格納したMapを作成するヘルパー関数
 */
function createCareMasterMap(spreadsheetId, sheetName, typeColName, itemColName, nameColName, unitsColName) {
  const map = new Map();
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(`マスターシートが見つかりません: ${sheetName} (ID: ${spreadsheetId})`);
    
    const values = sheet.getDataRange().getValues();
    const headers = values.shift();
    const typeIndex = headers.indexOf(typeColName);
    const itemIndex = headers.indexOf(itemColName);
    const nameIndex = headers.indexOf(nameColName);
    const unitsIndex = headers.indexOf(unitsColName);

    if ([typeIndex, itemIndex, nameIndex, unitsIndex].includes(-1)) {
      throw new Error(`介護マスターに必要な列が見つかりません: ${typeColName}, ${itemColName}, ${nameColName}, or ${unitsColName}`);
    }

    values.forEach(row => {
      const typeValue = row[typeIndex];
      const itemValue = row[itemIndex];
      if (typeValue && itemValue) {
        const key = `${typeValue}${itemValue}`;
        map.set(key.toString(), {
          name: row[nameIndex],
          units: parseFloat(row[unitsIndex] || 0)
        });
      }
    });
  } catch (e) {
    Logger.log(`介護マスターデータの読み込みに失敗しました: ${e.message}`);
  }
  return map;
}


function createMediMasterMap(spreadsheetId, sheetName, keyColName, nameColName, unitsColName) {
  const map = new Map();
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(`マスターシートが見つかりません: ${sheetName} (ID: ${spreadsheetId})`);
    
    const values = sheet.getDataRange().getValues();
    const headers = values.shift();
    const keyIndex = headers.indexOf(keyColName);
    const nameIndex = headers.indexOf(nameColName);
    const unitsIndex = headers.indexOf(unitsColName);

    if (keyIndex === -1 || nameIndex === -1 || unitsIndex === -1) {
      throw new Error(`医療マスターに必要な列が見つかりません: ${keyColName}, ${nameColName}, or ${unitsColName}`);
    }

    values.forEach(row => {
      const key = row[keyIndex];
      if (key) {
        map.set(key.toString(), {
          name: row[nameIndex],
          units: parseFloat(row[unitsIndex] || 0)
        });
      }
    });
  } catch (e) {
    Logger.log(`医療マスターデータの読み込みに失敗しました: ${e.message}`);
  }
  return map;
}

function createHeaderMap(headers, requiredHeaders) {
    const map = {};
    requiredHeaders.forEach(header => {
        const index = headers.indexOf(header);
        map[header] = index;
    });
    if(headers.includes('fee_code')){ map.fee_code = headers.indexOf('fee_code'); }
    if(headers.includes('billing_ym')){ map.billing_ym = headers.indexOf('billing_ym'); }
    return map;
}