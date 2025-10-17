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

const GEMINI_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY'; // Gemini APIキー

const APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8'; // AppSheetのアプリID

const ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY'; // AppSheet APIのアクセスキー



// テーブル名

const PROBLEMS_TABLE_NAME = 'VN_Plan_Problems';



/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 */

function doPost(e) {

  const params = JSON.parse(e.postData.contents);

  const problemId = params.problemId;



  try {

    const { planText, latestRecords, statusToSet, staffId } = params;

    if (!problemId || !planText || !latestRecords || !staffId) {

      throw new Error("必須パラメータ（problemId, planText, latestRecords, staffId）が不足しています。");

    }

    console.log(`処理開始: Problem ID = ${problemId}`);



    // --- AIで評価文を生成 ---

    const evaluationResult = generateEvaluationWithGemini(planText, latestRecords);

    if (!evaluationResult || !evaluationResult.evaluationText) {

      throw new Error("AIからの応答が不正でした。");

    }



    // --- AppSheetに結果を書き込み ---

    updateEvaluationInAppSheet(problemId, evaluationResult.evaluationText, statusToSet, staffId);

    console.log(`処理完了。ID ${problemId} の評価を更新しました。`);



  } catch (error) {

    console.log(`エラーが発生しました: ${error.toString()}`);

    // ここでエラー発生時にAppSheetのステータスを更新したり、メールを送信する処理も追加可能です

  }

}



/**

 * Gemini APIを呼び出し、看護計画の評価文を生成する

 */

function generateEvaluationWithGemini(planText, latestRecords) {

  const prompt = `

あなたは経験豊富な訪問看護師です。

以下の#看護計画と#最新の看護記録を比較・分析し、計画に対する評価を生成してください。



# 指示

- 最新の看護記録に基づき、看護計画の目標がどの程度達成されたか、計画は適切であったかを評価してください。

- 評価文は**50文字未満**で、簡潔明瞭な記録様式の表現（常体）を厳守してください。

- 出力は必ず指定されたJSON形式に従ってください。



# 看護計画

${planText}



# 最新の看護記録

${latestRecords}



# 出力形式（JSON）

以下の形式で、日本語のJSON文字列を生成してください。

{

  "evaluationText": "（ここに50文字未満の評価文を記述）"

}

`;



  const textPart = { text: prompt };

  const model = 'gemini-2.5-pro';

  const generationConfig = { "responseMimeType": "application/json", "temperature": 0.2 };

  const requestBody = { contents: [{ parts: [textPart] }], generationConfig: generationConfig };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(requestBody), muteHttpExceptions: true };



  const response = UrlFetchApp.fetch(url, options);

  const responseText = response.getContentText();

  Logger.log('Gemini API Response: ' + responseText);



  const jsonResponse = JSON.parse(responseText);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {

    throw new Error("AIからの応答に有効な候補が含まれていません: " + responseText);

  }

  let content = jsonResponse.candidates[0].content.parts[0].text;

  

  const startIndex = content.indexOf('{');

  const endIndex = content.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1) throw new Error("AIの応答からJSONを抽出できませんでした。");

  

  return JSON.parse(content.substring(startIndex, endIndex + 1));

}



/**

 * AppSheetのVN_Plan_Problemsテーブルを更新する

 */

function updateEvaluationInAppSheet(problemId, evaluationText, status, staffId) {

  const now = new Date();

  const formattedDate = Utilities.formatDate(now, "JST", "yyyy-MM-dd");

  const formattedDateTime = Utilities.formatDate(now, "JST", "yyyy-MM-dd HH:mm:ss");



  const rowData = {

    "problem_id": problemId,

    "evaluation": evaluationText,

    "evaluation_date": formattedDate,

    "status": status,

    "updated_at": formattedDateTime,

    "updated_by": staffId

  };



  const payload = { 

    Action: "Edit", 

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, 

    Rows: [rowData] 

  };

  

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${PROBLEMS_TABLE_NAME}/Action`;

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