/**
 * Appsheet_名刺取り込み - AppSheetサービス
 * 
 * AppSheet API操作とスプレッドシート検索
 * 
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-23
 */

/**
 * 連絡先のアクションを判定
 * 
 * @param {Object} newInfo - 新規抽出情報
 * @returns {Object} {action: 'CREATE'|'UPDATE'|'DELETE'|'CHECK_ORG', contactId?: string, orgId?: string}
 */
function determineContactAction(newInfo) {
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logInfo(`🔍 連絡先重複チェック開始`);
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logDebug('チェック対象', {
    name: `${newInfo.last_name} ${newInfo.first_name}`,
    org: newInfo.card_org_name,
    postalCode: newInfo.card_org_postal_code,
    phone: newInfo.card_org_phone
  });
  
  const sheet = getContactsSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    logInfo('✅ 既存データなし → CREATE');
    return { action: 'CREATE' };
  }
  
  const headers = data[0];
  const getColIndex = (name) => headers.indexOf(name);
  
  const idx = {
    contactId: getColIndex('contact_id'),
    orgId: getColIndex('org_id'),
    lastName: getColIndex('last_name'),
    firstName: getColIndex('first_name'),
    lastNameKana: getColIndex('last_name_kana'),
    firstNameKana: getColIndex('first_name_kana'),
    postalCode: getColIndex('card_org_postal_code'),
    phone: getColIndex('card_org_phone'),
    cardFront: getColIndex('business_card_front')
  };
  
  // ステップ1: 完全重複チェック（氏名 + 郵便番号 + 電話番号）
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (
      row[idx.lastName] === newInfo.last_name &&
      row[idx.firstName] === newInfo.first_name &&
      row[idx.postalCode] === newInfo.card_org_postal_code &&
      row[idx.phone] === newInfo.card_org_phone
    ) {
      logInfo(`❌ 完全重複検出: ${row[idx.contactId]} → DELETE`);
      return { action: 'DELETE' };
    }
  }
  
  // ステップ2: 同一人物チェック（氏名 + カナ + 名刺未登録）
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (
      row[idx.lastName] === newInfo.last_name &&
      row[idx.firstName] === newInfo.first_name &&
      row[idx.lastNameKana] === newInfo.last_name_kana &&
      row[idx.firstNameKana] === newInfo.first_name_kana &&
      !row[idx.cardFront]  // 名刺未登録
    ) {
      logInfo(`⚠️  同一人物・名刺未登録: ${row[idx.contactId]} → CHECK_ORG`);
      return {
        action: 'CHECK_ORG',
        contactId: row[idx.contactId],
        orgId: row[idx.orgId]
      };
    }
  }
  
  // ステップ3: 該当なし → 新規作成
  logInfo('✅ 該当なし → CREATE');
  return { action: 'CREATE' };
}

/**
 * 事業所情報を取得
 * 
 * @param {string} orgId - 事業所ID
 * @returns {Object|null} {name: string, address: string} または null
 */
function getOrganizationInfo(orgId) {
  logDebug(`事業所情報取得: ${orgId}`);
  
  const sheet = getOrganizationsSheet();
  
  if (!sheet) {
    logError('事業所シートが見つかりません');
    return null;
  }
  
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    logDebug('事業所データなし');
    return null;
  }
  
  const headers = data[0];
  const orgIdIndex = headers.indexOf('org_id');
  const addressIndex = headers.indexOf('address');
  const nameIndex = headers.indexOf('common_name');
  
  if (orgIdIndex === -1 || addressIndex === -1 || nameIndex === -1) {
    logError('事業所シートに必要な列が見つかりません');
    return null;
  }
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (row[orgIdIndex] === orgId) {
      const orgInfo = {
        name: row[nameIndex] || '',
        address: row[addressIndex] || ''
      };
      
      logDebug('事業所情報取得成功', orgInfo);
      return orgInfo;
    }
  }
  
  logDebug('事業所IDに一致するデータなし');
  return null;
}

/**
 * 新しい連絡先IDを生成
 * 
 * @returns {string} 連絡先ID（ORGC-XXXXXXXX形式）
 */
function generateUniqueContactId() {
  logDebug('新規連絡先ID生成');
  
  const sheet = getContactsSheet();
  const contactIdColumn = sheet.getRange('A:A').getValues().flat();
  
  let newId;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;
  
  while (!isUnique && attempts < maxAttempts) {
    newId = 'ORGC-' + Utilities.getUuid().substring(0, 8);
    
    if (!contactIdColumn.includes(newId)) {
      isUnique = true;
    }
    
    attempts++;
  }
  
  if (!isUnique) {
    throw new Error('連絡先IDの生成に失敗しました（重複回避不可）');
  }
  
  logDebug(`✅ 連絡先ID生成: ${newId}`);
  return newId;
}

/**
 * AppSheetに新規連絡先を作成
 * 
 * @param {string} contactId - 連絡先ID
 * @param {Object} info - 抽出情報
 * @param {string} frontFileName - 表面ファイル名
 * @param {string} [backFileName] - 裏面ファイル名
 * @param {string} [creatorId] - 作成者ID
 */
function createContactInAppSheet(contactId, info, frontFileName, backFileName = null, creatorId = 'SYSTEM') {
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logInfo(`➕ AppSheet新規連絡先作成: ${contactId}`);
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  logDebug('ファイル名情報', {
    frontFileName: frontFileName,
    backFileName: backFileName,
    hasBack: backFileName !== null && backFileName !== undefined
  });
  
  const rowData = buildContactRowData(contactId, info, frontFileName, backFileName);
  rowData.created_by = creatorId;
  rowData.created_at = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  
  logDebug('作成データ', {
    contact_id: rowData.contact_id,
    business_card_front: rowData.business_card_front,
    business_card_back: rowData.business_card_back
  });
  
  const config = {
    appId: APPSHEET_CONFIG.appId,
    accessKey: APPSHEET_CONFIG.accessKey,
    tableName: APPSHEET_CONFIG.tableName
  };
  
  try {
    AppSheetConnector.addRow(config, rowData);
    logInfo(`✅ 連絡先作成成功: ${contactId}`);
    
  } catch (error) {
    logError(`連絡先作成エラー: ${contactId}`, error);
    throw error;
  }
}

/**
 * AppSheetの連絡先を更新
 * ※既存データ（org_idなど）を保持し、名刺情報のみを上書き
 * 
 * @param {string} contactId - 連絡先ID
 * @param {Object} info - 抽出情報
 * @param {string} frontFileName - 表面ファイル名
 * @param {string} [backFileName] - 裏面ファイル名
 * @param {string} [updaterId] - 更新者ID
 */
function updateContactInAppSheet(contactId, info, frontFileName, backFileName = null, updaterId = 'SYSTEM') {
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logInfo(`📝 AppSheet連絡先更新: ${contactId}`);
  logInfo(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const config = {
    appId: APPSHEET_CONFIG.appId,
    accessKey: APPSHEET_CONFIG.accessKey,
    tableName: APPSHEET_CONFIG.tableName
  };
  
  try {
    // STEP 1: 既存データを取得
    logDebug('既存データ取得中...', { contactId });
    const existingData = getContactByIdFromAppSheet(contactId);
    
    if (!existingData) {
      throw new Error(`連絡先が見つかりません: ${contactId}`);
    }
    
    logDebug('既存データ取得成功', {
      org_id: existingData.org_id,
      status: existingData.status,
      existing_front: existingData.business_card_front,
      existing_back: existingData.business_card_back
    });
    
    // STEP 2: 名刺画像が既に存在するかチェック
    const hasFrontCard = existingData.business_card_front && existingData.business_card_front.trim() !== '';
    const hasBackCard = existingData.business_card_back && existingData.business_card_back.trim() !== '';
    
    if (hasFrontCard) {
      logInfo(`⚠️  名刺画像が既に存在します - 更新をスキップ: ${contactId}`);
      logInfo(`   既存の表面: ${existingData.business_card_front}`);
      if (hasBackCard) {
        logInfo(`   既存の裏面: ${existingData.business_card_back}`);
      }
      
      // スキップを示すエラーをスロー（実際はエラーではなく正常なスキップ）
      throw new Error('名刺画像が既に存在するため更新をスキップしました');
    }
    
    logDebug('ファイル名情報', {
      frontFileName: frontFileName,
      backFileName: backFileName,
      hasBack: backFileName !== null && backFileName !== undefined
    });
    
    // STEP 3: 名刺情報のみを更新（既存フィールドは保持）
    const updateData = {
      contact_id: contactId,  // キー
      
      // 既存データを保持（名刺情報では更新しない）
      org_id: existingData.org_id,  // ✅ 保持
      status: existingData.status,   // ✅ 保持
      
      // 名刺から抽出した情報で更新
      last_name: info.last_name || existingData.last_name || '',
      first_name: info.first_name || existingData.first_name || '',
      last_name_kana: info.last_name_kana || existingData.last_name_kana || '',
      first_name_kana: info.first_name_kana || existingData.first_name_kana || '',
      job_type: info.job_type || existingData.job_type || '',
      job_title: info.job_title || existingData.job_title || '',
      phone_number: info.phone_number || existingData.phone_number || '',
      email: info.email || existingData.email || '',
      
      // 名刺画像パスを更新
      business_card_front: generateAppSheetFilePath(frontFileName),
      business_card_back: backFileName ? generateAppSheetFilePath(backFileName) : existingData.business_card_back || '',
      
      // 名刺に記載された組織情報を更新
      card_org_name: info.card_org_name || existingData.card_org_name || '',
      card_org_postal_code: info.card_org_postal_code || existingData.card_org_postal_code || '',
      card_org_address: info.card_org_address || existingData.card_org_address || '',
      card_org_phone: info.card_org_phone || existingData.card_org_phone || '',
      card_org_fax: info.card_org_fax || existingData.card_org_fax || '',
      card_org_website: info.card_org_website || existingData.card_org_website || '',
      special_notes: info.special_notes || existingData.special_notes || '',
      
      // 更新メタ情報
      updated_by: updaterId,
      updated_at: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')
    };
    
    logDebug('更新データ', {
      org_id: updateData.org_id,
      name: `${updateData.last_name} ${updateData.first_name}`,
      business_card_front: updateData.business_card_front,
      business_card_back: updateData.business_card_back
    });
    
    // STEP 4: AppSheet更新実行
    AppSheetConnector.updateRow(config, updateData);
    logInfo(`✅ 連絡先更新成功: ${contactId}`);
    
  } catch (error) {
    logError(`連絡先更新エラー: ${contactId}`, error);
    throw error;
  }
}

/**
 * AppSheetから連絡先IDで既存データを取得
 * 
 * @param {string} contactId - 連絡先ID
 * @returns {Object|null} 既存データ、見つからない場合はnull
 */
function getContactByIdFromAppSheet(contactId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(SPREADSHEET_CONFIG.contactsSheet);
  
  if (!sheet) {
    throw new Error(`シートが見つかりません: ${SPREADSHEET_CONFIG.contactsSheet}`);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // contact_id列のインデックスを取得
  const contactIdColIndex = headers.indexOf('contact_id');
  if (contactIdColIndex === -1) {
    throw new Error('contact_id列が見つかりません');
  }
  
  // 該当行を検索
  for (let i = 1; i < data.length; i++) {
    if (data[i][contactIdColIndex] === contactId) {
      // 行データをオブジェクトに変換
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = data[i][index];
      });
      return rowData;
    }
  }
  
  return null;  // 見つからない
}

/**
 * 連絡先行データを構築
 * 
 * @param {string} contactId - 連絡先ID
 * @param {Object} info - 抽出情報
 * @param {string} frontFileName - 表面ファイル名
 * @param {string} [backFileName] - 裏面ファイル名
 * @returns {Object} 行データ
 */
function buildContactRowData(contactId, info, frontFileName, backFileName = null) {
  return {
    contact_id: contactId,
    status: PROCESSING_CONFIG.defaultContactStatus,
    last_name: info.last_name || '',
    first_name: info.first_name || '',
    last_name_kana: info.last_name_kana || '',
    first_name_kana: info.first_name_kana || '',
    job_type: info.job_type || '',
    job_title: info.job_title || '',
    phone_number: info.phone_number || '',
    email: info.email || '',
    business_card_front: generateAppSheetFilePath(frontFileName),
    business_card_back: backFileName ? generateAppSheetFilePath(backFileName) : '',
    card_org_name: info.card_org_name || '',
    card_org_postal_code: info.card_org_postal_code || '',
    card_org_address: info.card_org_address || '',
    card_org_phone: info.card_org_phone || '',
    card_org_fax: info.card_org_fax || '',
    card_org_website: info.card_org_website || '',
    special_notes: info.special_notes || ''
  };
}
