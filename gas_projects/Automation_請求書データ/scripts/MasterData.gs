/**
 * マスターデータ管理
 */

/**
 * 介護マスターデータをMapとして取得
 */
function loadCareMaster() {
  const map = new Map();
  
  try {
    const ss = SpreadsheetApp.openById(CARE_MASTER_CONFIG.spreadsheetId);
    const sheet = ss.getSheetByName(CARE_MASTER_CONFIG.sheetName);
    
    if (!sheet) {
      throw new Error(`シートが見つかりません: ${CARE_MASTER_CONFIG.sheetName}`);
    }
    
    const values = sheet.getDataRange().getValues();
    const headers = values.shift();
    
    const typeIdx = headers.indexOf(CARE_MASTER_CONFIG.columns.type);
    const itemIdx = headers.indexOf(CARE_MASTER_CONFIG.columns.item);
    const nameIdx = headers.indexOf(CARE_MASTER_CONFIG.columns.name);
    const unitsIdx = headers.indexOf(CARE_MASTER_CONFIG.columns.units);
    
    if ([typeIdx, itemIdx, nameIdx, unitsIdx].includes(-1)) {
      throw new Error('介護マスターに必要な列が見つかりません');
    }
    
    values.forEach(row => {
      const typeValue = row[typeIdx];
      const itemValue = row[itemIdx];
      
      if (typeValue && itemValue) {
        const key = `${typeValue}${itemValue}`;
        map.set(key.toString(), {
          name: row[nameIdx] || '',
          units: parseFloat(row[unitsIdx] || 0)
        });
      }
    });
    
    debugLog(`介護マスター読み込み完了: ${map.size}件`);
    
  } catch (e) {
    Logger.log(`エラー: 介護マスター読み込み失敗 - ${e.message}`);
  }
  
  return map;
}

/**
 * 医療マスターデータをMapとして取得
 */
function loadMediMaster() {
  const map = new Map();
  
  try {
    const ss = SpreadsheetApp.openById(MEDI_MASTER_CONFIG.spreadsheetId);
    const sheet = ss.getSheetByName(MEDI_MASTER_CONFIG.sheetName);
    
    if (!sheet) {
      throw new Error(`シートが見つかりません: ${MEDI_MASTER_CONFIG.sheetName}`);
    }
    
    const values = sheet.getDataRange().getValues();
    const headers = values.shift();
    
    const codeIdx = headers.indexOf(MEDI_MASTER_CONFIG.columns.code);
    const nameIdx = headers.indexOf(MEDI_MASTER_CONFIG.columns.name);
    const unitsIdx = headers.indexOf(MEDI_MASTER_CONFIG.columns.units);
    
    if ([codeIdx, nameIdx, unitsIdx].includes(-1)) {
      throw new Error('医療マスターに必要な列が見つかりません');
    }
    
    values.forEach(row => {
      const code = row[codeIdx];
      
      if (code) {
        map.set(code.toString(), {
          name: row[nameIdx] || '',
          units: parseFloat(row[unitsIdx] || 0)
        });
      }
    });
    
    debugLog(`医療マスター読み込み完了: ${map.size}件`);
    
  } catch (e) {
    Logger.log(`エラー: 医療マスター読み込み失敗 - ${e.message}`);
  }
  
  return map;
}
