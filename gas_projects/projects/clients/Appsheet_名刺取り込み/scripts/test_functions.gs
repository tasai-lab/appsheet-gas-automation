/**
 * Appsheet_名刺取り込み - テスト関数
 * 
 * GASエディターから手動実行可能なテスト関数群
 * 
 * @author Fractal Group
 * @version 2.0.0
 * @date 2025-10-23
 */

/**
 * OAuth2承認テスト（初回実行時に認証画面が表示される）
 */
function testOAuth2Authorization() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🔐 OAuth2承認テスト');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // OAuth2トークン取得（スコープ承認を強制）
    const token = ScriptApp.getOAuthToken();
    Logger.log('✅ OAuth2トークン取得成功');
    Logger.log(`トークン: ${token.substring(0, 20)}...`);
    
    // 必要なスコープを表示
    Logger.log('\n📋 必要なOAuth2スコープ:');
    const requiredScopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/script.external_request',
      'https://www.googleapis.com/auth/cloud-platform  ← Vertex AI用（重要!）'
    ];
    
    requiredScopes.forEach(scope => {
      Logger.log(`  ✓ ${scope}`);
    });
    
    Logger.log('\n💡 初回実行時は認証画面が表示されます:');
    Logger.log('  1. 「権限を確認」をクリック');
    Logger.log('  2. Googleアカウントを選択');
    Logger.log('  3. 「詳細」→「～（安全ではないページ）に移動」');
    Logger.log('  4. 全てのスコープを確認して「許可」');
    
    Logger.log('\n✅ OAuth2承認テスト完了');
    
  } catch (error) {
    Logger.log('❌ OAuth2エラー: ' + error.message);
    Logger.log(error.stack);
    Logger.log('\n⚠️  認証が必要です。上記の手順で承認してください。');
  }
}

/**
 * 設定デバッグ出力
 */
function testConfig() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🔧 設定デバッグ');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    validateConfig();
    debugConfig();
    
    Logger.log('✅ 設定検証成功');
    
  } catch (error) {
    Logger.log('❌ 設定検証エラー: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * メイン処理テスト（全名刺処理）
 */
function testProcessAllBusinessCards() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🧪 全名刺処理テスト');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // 設定検証
    validateConfig();
    
    // 稼働時間チェック
    if (!isWithinOperatingHours()) {
      Logger.log('⚠️ 稼働時間外です');
      Logger.log(`稼働時間: ${PROCESSING_CONFIG.startHour}:${PROCESSING_CONFIG.startMinute} - ${PROCESSING_CONFIG.endHour}:00`);
      
      const now = new Date();
      Logger.log(`現在時刻: ${now.getHours()}:${now.getMinutes()}`);
      
      return;
    }
    
    // 処理実行
    const results = processAllBusinessCards();
    
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log('📊 処理結果');
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log(JSON.stringify(results, null, 2));
    Logger.log('✅ テスト完了');
    
  } catch (error) {
    Logger.log('❌ テストエラー: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * OCR抽出のみテスト
 * 
 * 使用方法:
 * 1. ソースフォルダーに1組の名刺を配置
 * 2. この関数を実行
 * 3. ログで抽出結果を確認
 */
function testOCRExtraction() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🔍 OCR抽出テスト');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    validateConfig();
    
    // ソースフォルダーからファイル取得
    const sourceFolder = getSourceFolder();
    const files = sourceFolder.getFiles();
    
    // ペアリング
    const pairedCards = pairBusinessCards(files);
    
    if (pairedCards.length === 0) {
      Logger.log('❌ テスト対象ファイルなし');
      return;
    }
    
    // 最初の1組をテスト
    const card = pairedCards[0];
    
    Logger.log(`表面: ${card.front.getName()}`);
    if (card.back) {
      Logger.log(`裏面: ${card.back.getName()}`);
    }
    
    // OCR実行
    const extractedInfo = extractBusinessCardInfo(card.front, card.back);
    
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log('📋 抽出結果');
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log(JSON.stringify(extractedInfo, null, 2));
    Logger.log('✅ OCRテスト完了');
    
  } catch (error) {
    Logger.log('❌ OCRテストエラー: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * 組織比較テスト
 * 
 * 使用方法:
 * 1. 下記のテストケースを編集
 * 2. この関数を実行
 * 3. ログで比較結果を確認
 */
function testOrganizationComparison() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🏢 組織比較テスト');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    validateConfig();
    
    // テストケース
    const testCases = [
      {
        name: 'ケース1: 同一組織（完全一致）',
        existingName: '株式会社サンプル',
        existingAddress: '東京都渋谷区渋谷1-1-1',
        newName: '株式会社サンプル',
        newAddress: '東京都渋谷区渋谷1-1-1',
        expected: true
      },
      {
        name: 'ケース2: 同一組織（表記揺れ）',
        existingName: '株式会社サンプル',
        existingAddress: '東京都渋谷区渋谷1-1-1',
        newName: '(株)サンプル',
        newAddress: '東京都渋谷区渋谷一丁目1番1号',
        expected: true
      },
      {
        name: 'ケース3: 別組織',
        existingName: '株式会社サンプル',
        existingAddress: '東京都渋谷区渋谷1-1-1',
        newName: '株式会社テスト',
        newAddress: '東京都新宿区新宿1-1-1',
        expected: false
      }
    ];
    
    for (const testCase of testCases) {
      Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.log(testCase.name);
      Logger.log(`既存: ${testCase.existingName} / ${testCase.existingAddress}`);
      Logger.log(`新規: ${testCase.newName} / ${testCase.newAddress}`);
      
      const isSame = compareOrganizations(
        testCase.existingName,
        testCase.existingAddress,
        testCase.newName,
        testCase.newAddress
      );
      
      Logger.log(`結果: ${isSame ? '同一' : '別組織'}`);
      Logger.log(`期待: ${testCase.expected ? '同一' : '別組織'}`);
      Logger.log(`判定: ${isSame === testCase.expected ? '✅ 正解' : '❌ 不正解'}`);
      
      // レート制限対策
      Utilities.sleep(1000);
    }
    
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log('✅ 組織比較テスト完了');
    
  } catch (error) {
    Logger.log('❌ テストエラー: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * AppSheet API接続テスト
 * 
 * 使用方法:
 * 1. この関数を実行
 * 2. ログでAPI接続結果を確認
 */
function testAppSheetConnection() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🔌 AppSheet API接続テスト');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    validateConfig();
    
    const config = {
      appId: APPSHEET_CONFIG.appId,
      accessKey: APPSHEET_CONFIG.accessKey,
      tableName: APPSHEET_CONFIG.tableName
    };
    
    Logger.log('AppSheet設定:');
    Logger.log(`  App ID: ${config.appId}`);
    Logger.log(`  Table: ${config.tableName}`);
    
    // テストデータ
    const testContactId = 'TEST-' + Utilities.getUuid().substring(0, 8);
    
    const testData = {
      contact_id: testContactId,
      status: '有効',
      last_name: 'テスト',
      first_name: '太郎',
      last_name_kana: 'テスト',
      first_name_kana: 'タロウ',
      created_by: 'TEST',
      created_at: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')
    };
    
    Logger.log('テストデータ作成:');
    Logger.log(JSON.stringify(testData, null, 2));
    
    // API呼び出し
    AppSheetConnector.addRow(config, testData);
    
    Logger.log('✅ API接続成功');
    Logger.log(`テスト連絡先ID: ${testContactId}`);
    Logger.log('⚠️ 注意: テストデータが実際に登録されました。必要に応じて削除してください。');
    
  } catch (error) {
    Logger.log('❌ API接続エラー: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * スプレッドシート接続テスト
 */
function testSpreadsheetConnection() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📊 スプレッドシート接続テスト');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    validateConfig();
    
    // スプレッドシート取得
    const spreadsheet = getSpreadsheet();
    Logger.log(`スプレッドシート: ${spreadsheet.getName()}`);
    Logger.log(`ID: ${spreadsheet.getId()}`);
    
    // 連絡先シート
    const contactsSheet = getContactsSheet();
    Logger.log(`連絡先シート: ${contactsSheet.getName()}`);
    Logger.log(`行数: ${contactsSheet.getLastRow()}`);
    
    // 事業所シート
    const organizationsSheet = getOrganizationsSheet();
    Logger.log(`事業所シート: ${organizationsSheet.getName()}`);
    Logger.log(`行数: ${organizationsSheet.getLastRow()}`);
    
    Logger.log('✅ スプレッドシート接続成功');
    
  } catch (error) {
    Logger.log('❌ スプレッドシート接続エラー: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * Driveフォルダー接続テスト
 */
function testDriveFolders() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📁 Driveフォルダー接続テスト');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    validateConfig();
    
    // ソースフォルダー
    const sourceFolder = getSourceFolder();
    Logger.log(`ソースフォルダー: ${sourceFolder.getName()}`);
    Logger.log(`ID: ${sourceFolder.getId()}`);
    
    const sourceFiles = sourceFolder.getFiles();
    let sourceCount = 0;
    while (sourceFiles.hasNext()) {
      sourceFiles.next();
      sourceCount++;
    }
    Logger.log(`ファイル数: ${sourceCount}`);
    
    // 移動先フォルダー
    const destinationFolder = getDestinationFolder();
    Logger.log(`移動先フォルダー: ${destinationFolder.getName()}`);
    Logger.log(`ID: ${destinationFolder.getId()}`);
    
    const destFiles = destinationFolder.getFiles();
    let destCount = 0;
    while (destFiles.hasNext()) {
      destFiles.next();
      destCount++;
    }
    Logger.log(`ファイル数: ${destCount}`);
    
    Logger.log('✅ Driveフォルダー接続成功');
    
  } catch (error) {
    Logger.log('❌ Driveフォルダー接続エラー: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * Vertex AI実装検証テスト
 * ※共通関数を正しく使用しているかチェック
 */
function testVertexAIImplementation() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🔍 Vertex AI実装検証テスト');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // テスト1: 正しいリクエストボディの生成
    Logger.log('\n[テスト1] 正しいリクエストボディ生成');
    const validRequestBody = createVertexAIRequestBody(
      [{ text: 'テストプロンプト' }],
      { temperature: 0.1 }
    );
    
    Logger.log('✅ リクエストボディ生成成功');
    Logger.log(`  - role プロパティ: ${validRequestBody.contents[0].role}`);
    Logger.log(`  - parts 数: ${validRequestBody.contents[0].parts.length}`);
    
    // テスト2: バリデーション（正常系）
    Logger.log('\n[テスト2] バリデーション（正常系）');
    validateVertexAIRequestBody(validRequestBody);
    Logger.log('✅ バリデーション成功: 正しい形式');
    
    // テスト3: バリデーション（異常系 - roleなし）
    Logger.log('\n[テスト3] バリデーション（異常系 - roleなし）');
    const invalidRequestBody = {
      contents: [{
        // role プロパティなし（意図的なエラー）
        parts: [{ text: 'テスト' }]
      }]
    };
    
    try {
      validateVertexAIRequestBody(invalidRequestBody);
      Logger.log('❌ バリデーションが期待通りエラーを検出しませんでした');
    } catch (validationError) {
      Logger.log('✅ バリデーション成功: エラーを正しく検出');
      Logger.log(`  エラーメッセージ: ${validationError.message}`);
    }
    
    // テスト4: 画像付きリクエストボディ
    Logger.log('\n[テスト4] 画像付きリクエストボディ生成');
    const imageRequestBody = createVertexAIRequestBody(
      [
        { text: 'この画像を分析してください' },
        { inlineData: { mimeType: 'image/jpeg', data: 'base64data...' } }
      ]
    );
    
    Logger.log('✅ 画像付きリクエストボディ生成成功');
    Logger.log(`  - role プロパティ: ${imageRequestBody.contents[0].role}`);
    Logger.log(`  - parts 数: ${imageRequestBody.contents[0].parts.length}`);
    
    validateVertexAIRequestBody(imageRequestBody);
    Logger.log('✅ 画像付きリクエストボディのバリデーション成功');
    
    Logger.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log('✅ 全てのVertex AI実装検証テストに合格');
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    Logger.log('\n📝 実装ガイドライン:');
    Logger.log('  ✅ createVertexAIRequestBody() を使用');
    Logger.log('  ✅ createVertexAIFetchOptions() を使用');
    Logger.log('  ✅ validateVertexAIRequestBody() で検証');
    Logger.log('  ❌ 直接 contents: [{...}] を記述しない');
    
  } catch (error) {
    Logger.log('❌ Vertex AI実装検証エラー: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * 裏面ファイルパス補完テスト
 * ※表面のみ登録されている連絡先に対して、裏面ファイルパスを自動補完
 */
function testFixMissingBackCardPaths() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🔧 裏面ファイルパス補完テスト');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // STEP 1: スプレッドシート取得
    const ss = SpreadsheetApp.openById(SPREADSHEET_CONFIG.spreadsheetId);
    const sheet = ss.getSheetByName(SPREADSHEET_CONFIG.contactsSheet);
    
    if (!sheet) {
      throw new Error(`シートが見つかりません: ${SPREADSHEET_CONFIG.contactsSheet}`);
    }
    
    Logger.log(`✅ シート取得成功: ${sheet.getName()}`);
    
    // STEP 2: データ取得
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    Logger.log(`データ行数: ${data.length - 1}行`);
    
    // 必要な列のインデックスを取得
    const contactIdColIndex = headers.indexOf('contact_id');
    const frontColIndex = headers.indexOf('business_card_front');
    const backColIndex = headers.indexOf('business_card_back');
    
    if (contactIdColIndex === -1 || frontColIndex === -1 || backColIndex === -1) {
      throw new Error('必要な列が見つかりません');
    }
    
    Logger.log(`列インデックス確認:`);
    Logger.log(`  - contact_id: ${contactIdColIndex}`);
    Logger.log(`  - business_card_front: ${frontColIndex}`);
    Logger.log(`  - business_card_back: ${backColIndex}`);
    
    // STEP 3: 裏面が空の行を検索
    const missingBackRows = [];
    
    for (let i = 1; i < data.length; i++) {
      const contactId = data[i][contactIdColIndex];
      const frontPath = data[i][frontColIndex];
      const backPath = data[i][backColIndex];
      
      // 表面はあるが、裏面が空の場合
      if (frontPath && (!backPath || backPath.toString().trim() === '')) {
        missingBackRows.push({
          rowIndex: i + 1,  // スプレッドシートの行番号（1-indexed）
          contactId: contactId,
          frontPath: frontPath
        });
      }
    }
    
    Logger.log(`\n裏面が空の行: ${missingBackRows.length}件`);
    
    if (missingBackRows.length === 0) {
      Logger.log('✅ 全ての行に裏面パスが設定されています');
      return;
    }
    
    // STEP 4: 各行の裏面パスを推定して確認
    Logger.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log('裏面パス推定結果:');
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const destinationFolder = DriveApp.getFolderById(DRIVE_CONFIG.destinationFolderId);
    const updates = [];
    
    for (const row of missingBackRows) {
      Logger.log(`\n[行 ${row.rowIndex}] ${row.contactId}`);
      Logger.log(`  表面: ${row.frontPath}`);
      
      // 表面パスから裏面パスを推定
      // 例: "名刺_格納/佐藤太郎_サトウタロウ_CNT20250123001.jpg"
      //  → "名刺_格納/佐藤太郎_サトウタロウ_CNT20250123001_001.jpg"
      
      let estimatedBackPath = null;
      
      if (row.frontPath.includes('.jpg') || row.frontPath.includes('.jpeg') || 
          row.frontPath.includes('.png') || row.frontPath.includes('.JPG')) {
        
        // 拡張子の前に "_001" を挿入（PROCESSING_CONFIG.backCardSuffix）
        estimatedBackPath = row.frontPath.replace(/\.(jpg|jpeg|png|JPG|JPEG|PNG)$/, '_001.$1');
        
        Logger.log(`  推定裏面: ${estimatedBackPath}`);
        
        // ファイルの存在確認
        const fileName = estimatedBackPath.split('/').pop();  // ファイル名のみ抽出
        const files = destinationFolder.getFilesByName(fileName);
        
        if (files.hasNext()) {
          const file = files.next();
          Logger.log(`  ✅ ファイル存在確認: ${file.getName()}`);
          
          updates.push({
            rowIndex: row.rowIndex,
            contactId: row.contactId,
            backPath: estimatedBackPath
          });
        } else {
          Logger.log(`  ⚠️  ファイルが見つかりません: ${fileName}`);
        }
      } else {
        Logger.log(`  ⚠️  対応していないファイル形式`);
      }
    }
    
    // STEP 5: 更新確認
    Logger.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log(`更新対象: ${updates.length}件`);
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (updates.length === 0) {
      Logger.log('更新対象がありません');
      return;
    }
    
    // STEP 6: スプレッドシート更新
    Logger.log('\nスプレッドシート更新を開始します...');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const update of updates) {
      try {
        // セルを直接更新
        sheet.getRange(update.rowIndex, backColIndex + 1).setValue(update.backPath);
        
        Logger.log(`✅ [行 ${update.rowIndex}] ${update.contactId}: 更新成功`);
        successCount++;
        
        // レート制限対策
        Utilities.sleep(100);
        
      } catch (error) {
        Logger.log(`❌ [行 ${update.rowIndex}] ${update.contactId}: 更新エラー - ${error.message}`);
        errorCount++;
      }
    }
    
    // STEP 7: 結果サマリー
    Logger.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log('📊 更新結果サマリー');
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log(`裏面なし行: ${missingBackRows.length}件`);
    Logger.log(`ファイル確認済: ${updates.length}件`);
    Logger.log(`更新成功: ${successCount}件`);
    Logger.log(`更新失敗: ${errorCount}件`);
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (successCount > 0) {
      Logger.log(`\n✅ ${successCount}件の裏面パスを補完しました`);
    }
    
  } catch (error) {
    Logger.log('❌ 裏面ファイルパス補完エラー: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * 裏面ファイルパス補完（ドライレン）
 * ※実際には更新せず、対象を表示するのみ
 */
function testFixMissingBackCardPathsDryRun() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🔍 裏面ファイルパス補完（ドライラン）');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_CONFIG.spreadsheetId);
    const sheet = ss.getSheetByName(SPREADSHEET_CONFIG.contactsSheet);
    
    if (!sheet) {
      throw new Error(`シートが見つかりません: ${SPREADSHEET_CONFIG.contactsSheet}`);
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const contactIdColIndex = headers.indexOf('contact_id');
    const frontColIndex = headers.indexOf('business_card_front');
    const backColIndex = headers.indexOf('business_card_back');
    
    if (contactIdColIndex === -1 || frontColIndex === -1 || backColIndex === -1) {
      throw new Error('必要な列が見つかりません');
    }
    
    const destinationFolder = DriveApp.getFolderById(DRIVE_CONFIG.destinationFolderId);
    let foundCount = 0;
    let notFoundCount = 0;
    
    Logger.log('\n裏面が空の行の確認結果:\n');
    
    for (let i = 1; i < data.length; i++) {
      const contactId = data[i][contactIdColIndex];
      const frontPath = data[i][frontColIndex];
      const backPath = data[i][backColIndex];
      
      if (frontPath && (!backPath || backPath.toString().trim() === '')) {
        const estimatedBackPath = frontPath.replace(/\.(jpg|jpeg|png|JPG|JPEG|PNG)$/, '_001.$1');
        const fileName = estimatedBackPath.split('/').pop();
        
        const files = destinationFolder.getFilesByName(fileName);
        
        if (files.hasNext()) {
          Logger.log(`✅ [行${i + 1}] ${contactId}`);
          Logger.log(`   表面: ${frontPath}`);
          Logger.log(`   裏面: ${estimatedBackPath}`);
          Logger.log(`   ファイル: 存在\n`);
          foundCount++;
        } else {
          Logger.log(`⚠️  [行${i + 1}] ${contactId}`);
          Logger.log(`   表面: ${frontPath}`);
          Logger.log(`   裏面: ${estimatedBackPath}`);
          Logger.log(`   ファイル: 見つかりません\n`);
          notFoundCount++;
        }
      }
    }
    
    Logger.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log(`更新可能: ${foundCount}件`);
    Logger.log(`ファイルなし: ${notFoundCount}件`);
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.log('\n💡 実際に更新するには testFixMissingBackCardPaths() を実行してください');
    
  } catch (error) {
    Logger.log('❌ エラー: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * ソースフォルダーのファイル名一覧とペアリング結果を表示
 * ※裏面がペアリングされていない原因を調査
 */
function testDebugPairing() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🔍 ペアリングデバッグ');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const sourceFolder = DriveApp.getFolderById(DRIVE_CONFIG.sourceFolderId);
    Logger.log(`ソースフォルダー: ${sourceFolder.getName()}`);
    Logger.log(`ID: ${DRIVE_CONFIG.sourceFolderId}\n`);
    
    // 全ファイル一覧を取得
    const files = sourceFolder.getFiles();
    const fileNames = [];
    
    while (files.hasNext()) {
      const file = files.next();
      fileNames.push(file.getName());
    }
    
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    Logger.log(`ファイル一覧（合計: ${fileNames.length}件）`);
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // ファイル名でソートして表示
    fileNames.sort();
    
    const filesByBaseName = {};
    
    for (const name of fileNames) {
      // ベース名を取得（_001を除去）
      const baseName = name.replace(/_001\.(jpg|jpeg|png|JPG|JPEG|PNG)$/i, '');
      const isBack = name.includes('_001.');
      
      if (!filesByBaseName[baseName]) {
        filesByBaseName[baseName] = {
          front: null,
          back: null
        };
      }
      
      if (isBack) {
        filesByBaseName[baseName].back = name;
      } else {
        filesByBaseName[baseName].front = name;
      }
    }
    
    // ペアリング結果を表示
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    Logger.log(`ペアリング結果`);
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    let bothCount = 0;
    let frontOnlyCount = 0;
    let backOnlyCount = 0;
    
    const baseNames = Object.keys(filesByBaseName).sort();
    
    for (const baseName of baseNames) {
      const pair = filesByBaseName[baseName];
      
      if (pair.front && pair.back) {
        Logger.log(`✅ [両面] ベース名: ${baseName}`);
        Logger.log(`   表面: ${pair.front}`);
        Logger.log(`   裏面: ${pair.back}\n`);
        bothCount++;
      } else if (pair.front && !pair.back) {
        Logger.log(`⚠️  [表面のみ] ベース名: ${baseName}`);
        Logger.log(`   表面: ${pair.front}`);
        Logger.log(`   裏面: なし\n`);
        frontOnlyCount++;
      } else if (!pair.front && pair.back) {
        Logger.log(`❌ [裏面のみ] ベース名: ${baseName}`);
        Logger.log(`   表面: なし`);
        Logger.log(`   裏面: ${pair.back}\n`);
        backOnlyCount++;
      }
    }
    
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    Logger.log(`📊 統計`);
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    Logger.log(`両面あり: ${bothCount}組`);
    Logger.log(`表面のみ: ${frontOnlyCount}組`);
    Logger.log(`裏面のみ: ${backOnlyCount}組`);
    Logger.log(`合計ファイル数: ${fileNames.length}件`);
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    if (frontOnlyCount > 0) {
      Logger.log(`\n💡 表面のみのファイル名を確認して、裏面ファイルが正しく命名されているか確認してください`);
      Logger.log(`   裏面の命名規則: {表面ファイル名}_001.jpg`);
    }
    
  } catch (error) {
    Logger.log('❌ エラー: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * ログから裏面ファイルをリネーム・移動
 * ※実行ログの「ファイル移動:」行から元ファイル名と新ファイル名の対応を抽出
 * 
 * 使い方:
 * 1. このスクリプトの LOG_DATA 変数に実行ログをコピペ
 * 2. testRestoreBackCardsFromLog() を実行
 */
function testRestoreBackCardsFromLog() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🔧 ログから裏面ファイル復元');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // ここに実行ログをコピーペースト
  const LOG_DATA = `
[DEBUG] ファイル移動: つばさ在宅クリニツク｜_会指導 匡.jpg → 神田敏博_カンダトシヒロ_ORGC-7a5830d6.jpg
[DEBUG] ファイル移動: 一般社団法人船橋市医師会_総 括者.jpg → 佐々木ゆかり_ササキユカリ_ORGC-fc082d2d.jpg
`;
  // ↑ このブロックにログをコピーペースト
  
  try {
    // STEP 1: ログから元ファイル名→新ファイル名のマッピングを抽出
    const lines = LOG_DATA.split('\n');
    const fileMappings = [];
    
    for (const line of lines) {
      // "ファイル移動: xxx.jpg → yyy.jpg" の行を抽出
      const match = line.match(/ファイル移動.*?:\s*(.+?\.(?:jpg|jpeg|png))\s*→\s*(.+?\.(?:jpg|jpeg|png))/i);
      
      if (match) {
        const originalName = match[1].trim();
        const newName = match[2].trim();
        
        fileMappings.push({
          original: originalName,
          new: newName
        });
      }
    }
    
    Logger.log(`\n✅ ログ解析完了: ${fileMappings.length}件のファイル移動を検出\n`);
    
    if (fileMappings.length === 0) {
      Logger.log('⚠️  ログにファイル移動情報が見つかりませんでした');
      Logger.log('\n使い方:');
      Logger.log('1. 実行ログをコピー');
      Logger.log('2. この関数のLOG_DATA変数にペースト');
      Logger.log('3. 再実行');
      return;
    }
    
    // STEP 2: 移動先フォルダーから裏面ファイル(_001.jpg)を取得
    // ※表面ファイルは既に移動先フォルダーでリネーム済み
    // ※裏面ファイルも移動先フォルダーに移動されているが、元の名前のまま
    const destinationFolder = DriveApp.getFolderById(DRIVE_CONFIG.destinationFolderId);  // '1c2fguK-hSuF_zgSFkAk9MTgPo1wcboiB' (名刺_格納)
    
    Logger.log(`検索フォルダー: ${destinationFolder.getName()} (ID: ${DRIVE_CONFIG.destinationFolderId})\n`);
    
    const files = destinationFolder.getFiles();
    const backFiles = [];
    
    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName();
      
      // _001.jpg で終わるファイル（裏面）
      if (name.match(/_001\.(jpg|jpeg|png|JPG|JPEG|PNG)$/i)) {
        backFiles.push(file);
      }
    }
    
    Logger.log(`移動先フォルダーの裏面ファイル（元の名前のまま）: ${backFiles.length}件\n`);
    
    // STEP 3: スプレッドシート取得（AppSheet更新用）
    const ss = SpreadsheetApp.openById(SPREADSHEET_CONFIG.spreadsheetId);
    const sheet = ss.getSheetByName(SPREADSHEET_CONFIG.contactsSheet);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const contactIdColIndex = headers.indexOf('contact_id');
    const backColIndex = headers.indexOf('business_card_back');
    
    // STEP 4: 各裏面ファイルを処理
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    Logger.log(`裏面ファイル処理開始`);
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    let successCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    
    for (const backFile of backFiles) {
      const backFileName = backFile.getName();
      
      // 裏面のベース名（_001を除去）
      const baseName = backFileName.replace(/_001\.(jpg|jpeg|png|JPG|JPEG|PNG)$/i, '');
      
      Logger.log(`\n[裏面] ${backFileName}`);
      Logger.log(`  ベース名: ${baseName}`);
      
      // マッピングから対応する表面ファイルを検索
      let matchedMapping = null;
      
      for (const mapping of fileMappings) {
        const mappingBase = mapping.original.replace(/\.(jpg|jpeg|png|JPG|JPEG|PNG)$/i, '');
        
        // ベース名が一致するか確認
        if (baseName === mappingBase) {
          matchedMapping = mapping;
          break;
        }
      }
      
      if (!matchedMapping) {
        Logger.log(`  ⚠️  対応する表面ファイルが見つかりません`);
        notFoundCount++;
        continue;
      }
      
      Logger.log(`  ✅ 対応する表面発見: ${matchedMapping.original}`);
      Logger.log(`  新表面名: ${matchedMapping.new}`);
      
      try {
        // 新しいファイル名から連絡先IDを抽出
        const contactIdMatch = matchedMapping.new.match(/_(ORGC-[a-f0-9]+)\.jpg$/i);
        
        if (!contactIdMatch) {
          Logger.log(`  ❌ 連絡先IDが抽出できません`);
          errorCount++;
          continue;
        }
        
        const contactId = contactIdMatch[1];
        Logger.log(`  連絡先ID: ${contactId}`);
        
        // 新しい裏面ファイル名を生成（表面の_001.jpg版）
        const newBackFileName = matchedMapping.new.replace(/\.jpg$/i, '_001.jpg');
        Logger.log(`  新裏面名: ${newBackFileName}`);
        
        // ファイルをリネーム（既に移動先フォルダーにあるのでリネームのみ）
        backFile.setName(newBackFileName);
        Logger.log(`  ✅ ファイルリネーム完了`);
        
        // スプレッドシートを更新
        const backPath = `${DRIVE_CONFIG.appsheetFolderPath}/${newBackFileName}`;
        
        // 該当行を検索
        for (let i = 1; i < data.length; i++) {
          if (data[i][contactIdColIndex] === contactId) {
            sheet.getRange(i + 1, backColIndex + 1).setValue(backPath);
            Logger.log(`  ✅ スプレッドシート更新完了（行${i + 1}）`);
            Logger.log(`     business_card_back: ${backPath}`);
            break;
          }
        }
        
        successCount++;
        
        // レート制限対策
        Utilities.sleep(500);
        
      } catch (error) {
        Logger.log(`  ❌ エラー: ${error.message}`);
        errorCount++;
      }
    }
    
    // STEP 5: 結果サマリー
    Logger.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    Logger.log(`📊 復元結果サマリー`);
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    Logger.log(`ログ解析: ${fileMappings.length}件`);
    Logger.log(`裏面ファイル: ${backFiles.length}件`);
    Logger.log(`復元成功: ${successCount}件`);
    Logger.log(`対応なし: ${notFoundCount}件`);
    Logger.log(`エラー: ${errorCount}件`);
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    if (successCount > 0) {
      Logger.log(`\n✅ ${successCount}件の裏面ファイルを復元しました！`);
    }
    
  } catch (error) {
    Logger.log('❌ 裏面ファイル復元エラー: ' + error.message);
    Logger.log(error.stack);
  }
}
