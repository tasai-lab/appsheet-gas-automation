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

const APP_ID = '27bceb6f-9a2c-4ab6-9438-31fec25a495e'; // AppSheetのアプリID

const ACCESS_KEY = 'V2-A0207-tnP4i-YwteT-Cg55O-7YBvg-zMXQX-sS4Xv-XuaKP'; // AppSheet APIのアクセスキー



// テーブル名

const ACTIVITIES_TABLE_NAME = 'Sales_Activities';



/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  return processRequest(params);
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  const activityId = params.activityId;



  try {

    const { audioFileId, salespersonName, contactName, orgName } = params;



    if (!activityId || !audioFileId) {

      throw new Error("必須パラメータ（activityId, audioFileId）が不足しています。");

    }

    Logger.log(`処理開始: Activity ID = ${activityId}`);



    // --- AIで営業トークを分析・評価 ---

    const analysisResult = analyzeSalesCallWithGemini(params);

    if (!analysisResult) {

      throw new Error("AIからの応答が不正でした。");

    }



    // --- AppSheetに分析結果を書き込み ---

    updateActivityOnSuccess(activityId, analysisResult);



    Logger.log(`処理完了。ID ${activityId} の分析結果を書き込みました。`);



  } catch (error) {

    Logger.log(`エラーが発生しました: ${error.toString()}`);

    if (activityId) {

      updateActivityOnError(activityId, error.toString());

    }

  }
}


/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  // TODO: テストデータを設定してください
  const testParams = {
    // 例: callId: "test-123",
    // 例: recordId: "rec-456",
    // 例: action: "CREATE"
  };

  console.log('=== テスト実行: Appsheet_営業_音声記録 ===');
  console.log('入力パラメータ:', JSON.stringify(testParams, null, 2));

  try {
    const result = processRequest(testParams);
    console.log('処理成功:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('処理エラー:', error.message);
    console.error('スタックトレース:', error.stack);
    throw error;
  }
}






/**

 * Gemini APIを呼び出し、営業トークを分析・評価する

 */

function analyzeSalesCallWithGemini(context) {

  const file = DriveApp.getFileById(context.audioFileId);

  const audioBlob = file.getBlob();

  const fileName = file.getName();



  // MIMEタイプ判定

  let determinedMimeType = null;

  const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';

  const audioExtensionMap = { 'm4a': 'audio/mp4', 'mp3': 'audio/mpeg' };

  if (audioExtensionMap[extension]) {

    determinedMimeType = audioExtensionMap[extension];

  } else {

    determinedMimeType = audioBlob.getContentType();

  }

  if (!determinedMimeType || !determinedMimeType.startsWith('audio/')) {

    throw new Error(`ファイル「${fileName}」はサポートされている音声形式ではありません。`);

  }



  // ★★★ AIへの指示プロンプト（評価指標を全て内蔵） ★★★

  const prompt = `

# あなたの役割

あなたは、営業コンサルタント兼データアナリストです。提供された営業担当者と面会相手との音声記録を分析し、以下の#評価指標に基づいて、営業活動の評価とサマリーを作成してください。



# 背景情報

- 営業担当者: ${context.salespersonName || '不明'}

- 訪問先（機関）: ${context.orgName || '不明'}

- 面会相手: ${context.contactName || '不明'}



# 評価指標

## 関心度 (interest_level)

- **INT-01**: 非常に関心がある - 具体的な検討段階に入っており、前向きな発言や質問が多い。サービス導入に意欲的。

- **INT-02**: 関心がある - 依頼の可能性が高い。サービス内容に強い関心を示し、質問や確認が多い。

- **INT-03**: 普通 - 興味はあるが、判断材料が不足している状態。情報収集段階。

- **INT-04**: あまり関心がない - 関心が薄い、または現状では必要性を感じていない。

- **INT-05**: 関心がない - 全く関心がない、または否定的な状態。



## 当社を知っているか (knows_us)

- **AWR-01**: よく知っている - ステーション名、所在地など基本情報を正確に認知。

- **AWR-02**: 聞いたことがある - ステーション名は聞いたことがあるが、詳細は曖昧。

- **AWR-03**: ほとんど知らない - ほとんど、または全く知らない。



## 当社の印象 (our_impression)

- **IMP-01**: 非常に良い - 信頼感、専門性、対応力など、総合的に非常に高い評価。パートナーとして強く認識。

- **IMP-02**: 良い - 信頼感、専門性、対応力など、全体的に良い評価。連携に前向き。

- **IMP-03**: 普通 - 特に良いとも悪いとも思われていない状態。可もなく不可もなく。

- **IMP-04**: あまり良くない - 何らかの懸念点や不満がある状態。改善を求める点がある。

- **IMP-05**: 非常に悪い - 強い不満や不信感がある状態。重大な問題がある。



## 営業時間を知っているか (knows_hours)

- **HRS-01**: 正確に把握 - 平日の営業時間、土日祝の対応、緊急時連絡体制などを正確に把握。

- **HRS-02**: 大体知っている - 平日の大体の営業時間は知っているが、時間外等の対応は不確か。

- **HRS-03**: ほとんど知らない - ほとんど知らない、または誤解している。



## 当社の専門職の種別を知っているか (knows_job_types)

- **STF-01**: 具体的に知っている - 看護師に加え、配置しているリハビリ専門職（PT/OT/ST）の種類や構成まで具体的に知っている。

- **STF-02**: なんとなく知っている - 看護師とリハビリ専門職がいることは知っているが、職種の詳細までは知らない。

- **STF-03**: ほとんど知らない - 看護師のみと思っている、またはスタッフ構成についてほとんど知らない。



## 看護とリハで訪問可能時間が異なることを知っているか (knows_time_diff)

- **TIM-01**: 理解している - 時間帯の違いやその背景（例: リハ職の勤務体系）を理解している。

- **TIM-02**: 知っている - 異なる場合があることは知っているが、具体的な時間帯や理由は不明確。

- **TIM-03**: 知らない - 全く知らない、または同じだと思っている。

- **TIM-04**: 該当しない/不明 - 該当しない/不明。



## 提供サービスへの理解度 (understands_services)

- **UND-01**: よく理解している - 健康管理、医療処置、リハビリ、ターミナルケアなど、訪問看護の多様な役割を広く正しく理解している。

- **UND-02**: 部分的に理解 - 日常的な健康管理等が中心というイメージが強いなど、理解が限定的・部分的。

- **UND-03**: ほとんど知らない - ヘルパーサービスとの違いが不明瞭、またはサービス内容についてほとんど知らない・誤解がある。



## 訪問看護全体の印象 (overall_vhns_impression)

- **OVL-01**: 高く評価 - 在宅療養支援の重要なパートナーとして高く評価し、積極的に連携・活用したいという明確な意向がある。

- **OVL-02**: 必要性は認識 - 必要性は認識しているが、連携の手間や過去の経験から、利用や連携に多少の障壁を感じている様子。

- **OVL-03**: ネガティブ - あまり重要視していない、または訪問看護全体に対してネガティブな印象を持っている。



## 連携における悩みの有無 (has_coop_issues)

- **CWP-01**: なし - 悩みや不満、課題はない。

- **CWP-02**: ある - 何らかの悩みや不満、課題があることが表明される。



## 業務における悩み (has_work_issues)

- **WKP-01**: ある（具体的） - 自身の業務上の課題や困りごとについて、具体的な相談や意見交換を持ちかけてくる。

- **WKP-02**: ありそう - 一般的な業界の動向や当たり障りのない業務の話はするが、具体的な相談には至らない。

- **WKP-03**: なし - 業務に関する個人的な悩みや相談は全くされない。



## その他の悩み (has_other_issues)

- **OTH-01**: あり - 業務外の個人的なことや、業界全般に関する雑談・相談など、何らかの話がある。

- **OTH-02**: なし - 業務に関する話以外はほとんどしない、または全くない。



## 営業頻度 (sales_frequency_plan)

- **FRQ-01**: 週1回 - 非常に高い頻度での情報交換を希望。

- **FRQ-02**: 2週間に1回程度 - 定期的な情報交換を希望。

- **FRQ-03**: 月1回程度 - 一定の頻度での情報交換を希望。

- **FRQ-04**: 2-3ヶ月に1回、または必要時 - 情報提供は必要だが、頻度は高くない。

- **FRQ-05**: 営業の希望なし - 現時点では情報提供を希望していない。



# 出力指示

- 音声記録の内容を分析し、以下のキーを持つJSONオブジェクトを生成してください。

- **重要**: 定量評価項目には**評価指標ID**（例：「INT-02」）を文字列として設定してください。

- 定性評価項目には、会話から推測される内容を要約して記述してください。

- 該当する情報が会話にない場合は、値にnullを設定してください。

- **特に指定がない限り、詳細記述用の項目（..._details）は、対応する悩みや宿題が会話中に存在した場合にのみ内容を記述し、存在しない場合はnullにしてください。**



{

  "office_impression": "訪問した事業所の雰囲気や状況など、感じたこと",

  "contact_impression": "面会した担当者の反応や人柄など、感じたこと",

  "hearing_details": "面会中にヒアリングした内容の要点（箇条書きテキスト）",

  "knows_us": "（評価指標ID）",

  "our_impression": "（評価指標ID）",

  "knows_hours": "（評価指標ID）",

  "knows_job_types": "（評価指標ID）",

  "knows_time_diff": "（評価指標ID）",

  "understands_services": "（評価指標ID）",

  "main_partner_vhns": "現在、主に連携している訪問看護ステーション名",

  "partner_vhns_impression": "連携先の印象について、具体的な内容",

  "overall_vhns_impression": "（評価指標ID）",

  "coop_issue_details": "もし連携における悩みについて話があれば、その具体的な内容",

  "expectations_for_vhns": "訪問看護というサービスに期待すること",

  "info_needs_from_vhns": "訪問看護からどのような情報が欲しいか",

  "info_needs_from_sales": "営業担当者からどのような情報が欲しいか",

  "work_issue_details": "もし業務における悩みについて話があれば、その具体的な内容",

  "other_issue_details": "もしその他の悩みについて話があれば、その具体的な内容",

  "follow_up_task_details": "もし営業先からの宿題（依頼事項）があれば、その具体的な内容",

  "task_deadline": "もし宿題の対応期限について話があれば、その日付をISO 8601形式（YYYY-MM-DD）で推測",

  "next_approach": "次回どのようなアプローチをすべきか、具体的な方針や計画",

  "next_action_date": "次にアプローチすべき日付をISO 8601形式（YYYY-MM-DD）で推測",

  "interest_level": "（評価指標ID）",

  "sales_frequency_plan": "（評価指標ID）",

  "summary": "今回の営業活動全体の要約"

}

`;

  const textPart = { text: prompt };

  const filePart = { inlineData: { data: Utilities.base64Encode(audioBlob.getBytes()), mimeType: determinedMimeType }};

  const model = 'gemini-2.5-pro';

  const generationConfig = {

    "responseMimeType": "application/json",

    "temperature": 0.7

  };

  const requestBody = {

    contents: [{ parts: [textPart, filePart] }],

    generationConfig: generationConfig,

  };



  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(requestBody), muteHttpExceptions: true };



  const response = UrlFetchApp.fetch(url, options);

  const responseText = response.getContentText();

  Logger.log('Gemini API Response: ' + responseText);



  const jsonResponse = JSON.parse(responseText);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {

    throw new Error("AIからの応答に有効な候補が含まれていません: " + responseText);

  }

  return JSON.parse(jsonResponse.candidates[0].content.parts[0].text);

}





// =================================================================

// AppSheet更新用ヘルパー関数群

// =================================================================



/**

 * 成功時にAppSheetに分析結果を書き込む

 * @param {string} activityId - 更新対象のID

 * @param {object} resultData - AIが生成した分析結果のJSONオブジェクト

 */

function updateActivityOnSuccess(activityId, resultData) {

  // resultDataにはAIが生成したJSONがそのまま入る

  resultData.activity_id = activityId; // キーを上書き

  resultData.status = "編集中";       // ステータスを上書き

  

  // ★★★ "Y" / "N" を true / false に変換する処理を【削除】します ★★★

  // AIが生成した "Y" または "N" を、そのままAppSheetに送信するのが正しい挙動です。

  

  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [resultData] // AIの応答をそのまま使用

  };

  callAppSheetApi(payload);

}



function updateActivityOnError(activityId, errorMessage) {

  const payload = {

    Action: "Edit",

    Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" },

    Rows: [{

      "activity_id": activityId,

      "status": "エラー",

      "error_details": `GAS Script Error: ${errorMessage}`

    }]

  };

  callAppSheetApi(payload);

}



function callAppSheetApi(payload) {

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${ACTIVITIES_TABLE_NAME}/Action`;

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