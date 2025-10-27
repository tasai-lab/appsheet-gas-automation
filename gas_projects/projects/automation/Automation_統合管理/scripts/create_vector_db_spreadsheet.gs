/**
 * Vector DB Spreadsheet 自動作成スクリプト (Google Apps Script)
 *
 * RAGシステム用の統合Vector DBスプレッドシートを自動作成します。
 *
 * 実行方法:
 *   1. このスクリプトを任意のGASプロジェクトにコピー
 *   2. createVectorDBSpreadsheet() を実行
 *   3. 表示されるSpreadsheet IDをコピー
 *   4. vector_db_sync.gs の VECTOR_DB_CONFIG.spreadsheetId に設定
 */

// 定数
const TARGET_FOLDER_ID = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX';
const SPREADSHEET_NAME = 'RAG_VectorDB_統合ナレッジベース';

// シートスキーマ定義
const SHEET_SCHEMAS = {
  'KnowledgeBase': {
    headers: [
      'id', 'domain', 'source_type', 'source_table', 'source_id',
      'user_id', 'title', 'content', 'structured_data', 'metadata',
      'tags', 'bm25_keywords', 'date', 'created_at', 'updated_at'
    ],
    headerColor: '#4285F4',  // Blue
    textColor: '#FFFFFF'     // White
  },
  'Embeddings': {
    headers: ['kb_id', 'embedding', 'model', 'task_type', 'generated_at'],
    headerColor: '#34A853',  // Green
    textColor: '#FFFFFF'     // White
  },
  'MedicalTerms': {
    headers: ['term_id', 'canonical', 'synonyms', 'category', 'umls_cui', 'frequency', 'created_at'],
    headerColor: '#FBBC04',  // Yellow
    textColor: '#000000'     // Black
  },
  'ChatHistory': {
    headers: ['session_id', 'user_id', 'role', 'message', 'context_ids', 'suggested_terms', 'term_feedback', 'timestamp'],
    headerColor: '#EA4335',  // Red
    textColor: '#FFFFFF'     // White
  }
};

// 医療用語辞書初期データ
const INITIAL_MEDICAL_TERMS = [
  {
    term_id: 'TERM_00001',
    canonical: '膀胱留置カテーテル',
    synonyms: '["バルーン","尿道カテーテル","Foley","フォーリー"]',
    category: '医療機器',
    umls_cui: 'C0085678',
    frequency: 0,
    created_at: '2025-10-27'
  },
  {
    term_id: 'TERM_00002',
    canonical: '血圧',
    synonyms: '["BP","ブラッドプレッシャー","血圧値"]',
    category: 'バイタルサイン',
    umls_cui: 'C0005823',
    frequency: 0,
    created_at: '2025-10-27'
  },
  {
    term_id: 'TERM_00003',
    canonical: '服薬',
    synonyms: '["内服","薬剤服用","投薬","与薬"]',
    category: '看護行為',
    umls_cui: 'C0013227',
    frequency: 0,
    created_at: '2025-10-27'
  },
  {
    term_id: 'TERM_00004',
    canonical: '体温',
    synonyms: '["BT","体温測定","検温"]',
    category: 'バイタルサイン',
    umls_cui: 'C0005903',
    frequency: 0,
    created_at: '2025-10-27'
  },
  {
    term_id: 'TERM_00005',
    canonical: '脈拍',
    synonyms: '["PR","心拍数","脈拍数"]',
    category: 'バイタルサイン',
    umls_cui: 'C0232117',
    frequency: 0,
    created_at: '2025-10-27'
  }
];

/**
 * メイン処理: Vector DB Spreadsheetを作成
 */
function createVectorDBSpreadsheet() {
  Logger.log('='.repeat(60));
  Logger.log('Vector DB Spreadsheet 自動作成開始');
  Logger.log('='.repeat(60));
  Logger.log('');

  try {
    // 1. スプレッドシートを作成
    Logger.log('1. スプレッドシートを作成中...');
    const spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
    const spreadsheetId = spreadsheet.getId();
    Logger.log(`   ✅ 作成完了: ${spreadsheetId}`);
    Logger.log('');

    // 2. フォルダに移動
    Logger.log('2. 指定フォルダに移動中...');
    const file = DriveApp.getFileById(spreadsheetId);
    const folder = DriveApp.getFolderById(TARGET_FOLDER_ID);
    file.moveTo(folder);
    Logger.log('   ✅ 移動完了');
    Logger.log('');

    // 3. デフォルトのシートを削除して、必要なシートを作成
    Logger.log('3. シート構造を作成中...');
    const defaultSheet = spreadsheet.getSheets()[0];

    // 各シートを作成
    const sheets = {};
    Object.keys(SHEET_SCHEMAS).forEach((sheetName, index) => {
      if (index === 0) {
        // 最初のシートはデフォルトシートをリネーム
        defaultSheet.setName(sheetName);
        sheets[sheetName] = defaultSheet;
      } else {
        sheets[sheetName] = spreadsheet.insertSheet(sheetName);
      }
      Logger.log(`   ✅ ${sheetName} シート作成完了`);
    });
    Logger.log('');

    // 4. 各シートをフォーマット
    Logger.log('4. シートをフォーマット中...');
    Object.keys(SHEET_SCHEMAS).forEach(sheetName => {
      formatSheet(sheets[sheetName], SHEET_SCHEMAS[sheetName]);
      Logger.log(`   ✅ ${sheetName} シートフォーマット完了`);
    });
    Logger.log('');

    // 5. 医療用語辞書に初期データを追加
    Logger.log('5. 医療用語辞書に初期データを追加中...');
    addInitialMedicalTerms(sheets['MedicalTerms']);
    Logger.log(`   ✅ 初期データ追加完了 (${INITIAL_MEDICAL_TERMS.length}件)`);
    Logger.log('');

    // 6. 完了メッセージ
    Logger.log('='.repeat(60));
    Logger.log('✅ Vector DB Spreadsheet 作成完了！');
    Logger.log('='.repeat(60));
    Logger.log('');
    Logger.log(`スプレッドシートID: ${spreadsheetId}`);
    Logger.log(`URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
    Logger.log('');
    Logger.log('次のステップ:');
    Logger.log('1. common_modules/vector_db_sync.gs の VECTOR_DB_CONFIG.spreadsheetId を更新');
    Logger.log(`   spreadsheetId: '${spreadsheetId}'`);
    Logger.log('');
    Logger.log('2. rag_system/backend/.env に VECTOR_DB_SPREADSHEET_ID を追加');
    Logger.log(`   VECTOR_DB_SPREADSHEET_ID=${spreadsheetId}`);
    Logger.log('');
    Logger.log('3. common_modules/test_rag_modules.gs の testAllRAGModules() を実行して検証');
    Logger.log('');

    // UIで結果を表示
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '✅ Vector DB Spreadsheet 作成完了',
      `スプレッドシートID: ${spreadsheetId}\n\n` +
      `URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit\n\n` +
      '次のステップ:\n' +
      '1. vector_db_sync.gs の spreadsheetId を更新\n' +
      '2. backend/.env に VECTOR_DB_SPREADSHEET_ID を追加',
      ui.ButtonSet.OK
    );

    return spreadsheetId;

  } catch (error) {
    Logger.log(`❌ エラー: ${error.toString()}`);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * シートのヘッダーとフォーマットを設定
 */
function formatSheet(sheet, schema) {
  try {
    // 1. ヘッダー行を設定
    const headerRange = sheet.getRange(1, 1, 1, schema.headers.length);
    headerRange.setValues([schema.headers]);
    headerRange.setBackground(schema.headerColor);
    headerRange.setFontColor(schema.textColor);
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');

    // 2. 列Aを固定、行1を固定
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(1);

    // 3. フィルターを有効化
    const dataRange = sheet.getRange(1, 1, 1000, schema.headers.length);
    dataRange.createFilter();

    // 4. 列幅を自動調整
    for (let i = 1; i <= schema.headers.length; i++) {
      sheet.autoResizeColumn(i);
    }

  } catch (error) {
    Logger.log(`  ⚠️  シート ${sheet.getName()} のフォーマットに失敗: ${error.toString()}`);
  }
}

/**
 * 医療用語辞書に初期データを追加
 */
function addInitialMedicalTerms(sheet) {
  try {
    const headers = SHEET_SCHEMAS['MedicalTerms'].headers;
    const data = [];

    INITIAL_MEDICAL_TERMS.forEach(term => {
      data.push([
        term.term_id,
        term.canonical,
        term.synonyms,
        term.category,
        term.umls_cui,
        term.frequency,
        term.created_at
      ]);
    });

    // データを一括で追加
    const range = sheet.getRange(2, 1, data.length, headers.length);
    range.setValues(data);

  } catch (error) {
    Logger.log(`  ⚠️  医療用語辞書の初期データ追加に失敗: ${error.toString()}`);
  }
}

/**
 * テスト実行: スプレッドシートが正しく作成されたか確認
 */
function testVectorDBSpreadsheet(spreadsheetId) {
  Logger.log('Vector DB Spreadsheet テスト開始');
  Logger.log('');

  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);

    // 各シートの存在確認
    Logger.log('1. シート存在確認:');
    Object.keys(SHEET_SCHEMAS).forEach(sheetName => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (sheet) {
        Logger.log(`   ✅ ${sheetName} - 存在`);

        // ヘッダー行確認
        const headers = sheet.getRange(1, 1, 1, SHEET_SCHEMAS[sheetName].headers.length).getValues()[0];
        const expectedHeaders = SHEET_SCHEMAS[sheetName].headers;
        const headersMatch = headers.every((h, i) => h === expectedHeaders[i]);

        if (headersMatch) {
          Logger.log(`      ✅ ヘッダー: 正常`);
        } else {
          Logger.log(`      ⚠️  ヘッダー: 不一致`);
        }
      } else {
        Logger.log(`   ❌ ${sheetName} - 存在しない`);
      }
    });
    Logger.log('');

    // MedicalTermsの初期データ確認
    Logger.log('2. 医療用語辞書 初期データ確認:');
    const termsSheet = spreadsheet.getSheetByName('MedicalTerms');
    const dataRange = termsSheet.getRange(2, 1, INITIAL_MEDICAL_TERMS.length, 1);
    const termIds = dataRange.getValues();
    Logger.log(`   データ件数: ${termIds.filter(row => row[0]).length}件`);
    Logger.log(`   期待件数: ${INITIAL_MEDICAL_TERMS.length}件`);
    Logger.log('');

    Logger.log('✅ テスト完了');

  } catch (error) {
    Logger.log(`❌ テスト失敗: ${error.toString()}`);
  }
}
