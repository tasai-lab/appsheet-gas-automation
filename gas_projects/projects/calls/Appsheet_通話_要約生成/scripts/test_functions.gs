/**
 * テスト関数モジュール（統合版）
 * 通話要約処理、質疑応答、Vertex AI音声解析のテスト関数
 * test_vertex_ai.gsから統合
 *
 * @author Fractal Group
 * @version 5.0.0
 * @date 2025-10-22
 */

/**
 * テスト用関数: 通常要約モード
 * callTypeとrequestIdを指定しない場合のテスト
 * GASエディタから直接実行してテスト可能
 * 
 * @return {Object} 処理結果
 */
function testProcessRequest() {
  const testParams = {
    callId: "test_" + new Date().getTime(),
    callDatetime: new Date().toISOString(),
    filePath: "通話ファイル保管/2025-05-09/202505091630_担当者_新規-問い合わせ.通話ファイル.074638.mp3",
    callContextText: "テスト通話",
    userInfoText: "テストユーザー",
    clientId: "test_client"
    // callType, requestId なし → summary_onlyモード
  };
  
  Logger.log('[テスト] パラメータ:', JSON.stringify(testParams, null, 2));
  
  const result = processCallSummary(testParams);
  
  Logger.log('[テスト] 結果:', JSON.stringify(result, null, 2));
  
  return result;
}

/**
 * テスト用関数: 新規依頼作成モード
 * callType='新規依頼'を指定した場合のテスト
 * GASエディタから直接実行してテスト可能
 * 
 * @return {Object} 処理結果
 */
function testProcessRequestCreate() {
  const testParams = {
    callId: "test_" + new Date().getTime(),
    callDatetime: new Date().toISOString(),
    filePath: "通話ファイル保管/2025-05-09/202505091630_担当者_新規-問い合わせ.通話ファイル.074638.mp3",
    callContextText: "新規依頼のテスト通話\n顧客: テスト株式会社",
    userInfoText: "営業担当: テスト太郎",
    clientId: "test_client",
    callType: "新規依頼", // 新規依頼作成モード
    creatorId: "test_creator",
    requesterId: "test_requester",
    requesterOrgId: "test_org"
  };
  
  Logger.log('[テスト:新規依頼] パラメータ:', JSON.stringify(testParams, null, 2));
  
  const result = processCallSummary(testParams);
  
  Logger.log('[テスト:新規依頼] 結果:', JSON.stringify(result, null, 2));
  
  return result;
}

/**
 * テスト用関数: 既存依頼更新モード
 * requestIdを指定した場合のテスト
 * GASエディタから直接実行してテスト可能
 * 
 * @return {Object} 処理結果
 */
function testProcessRequestUpdate() {
  const testParams = {
    callId: "test_" + new Date().getTime(),
    callDatetime: new Date().toISOString(),
    filePath: "通話ファイル保管/2025-05-09/202505091630_担当者_新規-問い合わせ.通話ファイル.074638.mp3",
    callContextText: "既存依頼の更新通話\n追加情報あり",
    userInfoText: "営業担当: テスト太郎",
    clientId: "test_client",
    requestId: "CLRQ-202510151200", // 既存依頼更新モード
    creatorId: "test_creator"
  };
  
  Logger.log('[テスト:依頼更新] パラメータ:', JSON.stringify(testParams, null, 2));
  
  const result = processCallSummary(testParams);
  
  Logger.log('[テスト:依頼更新] 結果:', JSON.stringify(result, null, 2));

  return result;
}

/**
 * テスト用関数: 質疑応答機能
 * query_service.gs の answerQueryDirect 関数をテスト
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 処理結果
 */
function testAnswerQuery() {
  const queryId = "test_query_" + new Date().getTime();
  const promptText = "利用者の主治医は誰ですか？また、現在の服薬状況を教えてください。";
  const userInfoText = `
## 利用者基本情報
- **氏名**: 山田 太郎
- **年齢**: 75歳
- **主治医**: 田中 花子医師（田中クリニック）
- **診断名**: 脳梗塞後遺症、高血圧症、糖尿病

## 服薬情報
- アムロジピン 5mg 朝1錠（降圧剤）
- メトホルミン 500mg 朝夕各1錠（糖尿病）
- アスピリン 100mg 朝1錠（抗血小板薬）
  `;
  const referenceDataText = `
## 最近の通話記録
2025-10-20: 田中医師と電話、血圧が安定していることを確認。次回診察は11月中旬予定。
2025-10-18: 薬局から配薬完了の連絡あり。
  `;

  Logger.log('[質疑応答テスト] 開始');
  Logger.log(`Query ID: ${queryId}`);
  Logger.log(`質問: ${promptText}`);

  const result = answerQueryDirect(queryId, promptText, userInfoText, referenceDataText);

  Logger.log('[質疑応答テスト] 結果:', JSON.stringify(result, null, 2));
  Logger.log('[質疑応答テスト] 回答:');
  Logger.log(result.answer);

  return result;
}

/**
 * テスト用関数: 質疑応答機能（参照データなし）
 * 利用者情報のみで質問に回答するテスト
 *
 * @return {Object} 処理結果
 */
function testAnswerQuerySimple() {
  const queryId = "test_query_simple_" + new Date().getTime();
  const promptText = "利用者のADL状況について教えてください。";
  const userInfoText = `
## 利用者基本情報
- **氏名**: 佐藤 花子
- **年齢**: 82歳
- **要介護度**: 要介護3

## ADL状況
- **移動**: 車椅子使用、一部介助
- **食事**: 自立
- **排泄**: 一部介助（トイレ移乗時）
- **入浴**: 全介助
- **更衣**: 一部介助
  `;

  Logger.log('[質疑応答テスト(シンプル)] 開始');
  Logger.log(`Query ID: ${queryId}`);
  Logger.log(`質問: ${promptText}`);

  const result = answerQueryDirect(queryId, promptText, userInfoText, '');

  Logger.log('[質疑応答テスト(シンプル)] 結果:', JSON.stringify(result, null, 2));
  Logger.log('[質疑応答テスト(シンプル)] 回答:');
  Logger.log(result.answer);

  return result;
}

/**
 * テスト用関数: JSON修正機能
 * 不正なJSONをGemini 2.5 Proで修正するテスト
 * GASエディタから直接実行してテスト可能
 *
 * @return {Object} 修正結果
 */
function testFixMalformedJSON() {
  Logger.log('[JSON修正テスト] 開始');

  // テスト用の不正なJSON（閉じ括弧が欠けている、カンマが不足、など）
  const malformedJson = `
{
  "summary": "通話の要約です。",
  "transcript": "スタッフ: こんにちは。\\n相手: はい、お願いします
  "actions": [
    {
      "title": "フォローアップ",
      "details": "1週間後に連絡",
      "action_type": "タスク"
    }
  ]
`;

  Logger.log('[JSON修正テスト] 不正なJSON:');
  Logger.log(malformedJson);

  const config = getConfig();

  try {
    const fixedJson = fixMalformedJSONWithVertexAI(
      malformedJson,
      config,
      false, // includeRequestDetails
      true   // enableTranscript
    );

    Logger.log('[JSON修正テスト] ✓ 修正成功');
    Logger.log('[JSON修正テスト] 修正後のJSON:');
    Logger.log(JSON.stringify(fixedJson, null, 2));

    return {
      success: true,
      fixedJson: fixedJson
    };

  } catch (error) {
    Logger.log('[JSON修正テスト] ❌ 修正失敗');
    Logger.log(`エラー: ${error.message}`);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * テスト用関数: JSON修正機能（複雑なケース）
 * より複雑な不正JSONのテスト
 *
 * @return {Object} 修正結果
 */
function testFixMalformedJSONComplex() {
  Logger.log('[JSON修正テスト(複雑)] 開始');

  // より複雑な不正JSON（request_detailsあり、途中で切れている）
  const malformedJson = `
{
  "summary": "新規依頼の通話です。\\n\\n**通話の概要**\\n- 日時: 2025/10/23\\n- 対応者: 田中\\n",
  "transcript": "スタッフ: お電話ありがとうございます。\\n相手: 訪問看護の依頼をしたいのですが...\\nスタッフ: 承知しました。詳細を
  "actions": [
    {
      "title": "初回訪問",
      "details": "来週月曜日に訪問",
      "action_type": "イベント",
      "start_datetime": "2025-10-28T10:00:00Z"
    }
  ],
  "request_details": {
    "priority": "高",
    "request_type": "新規依頼",
    "request_reason": "独居高齢者の見守り依頼
`;

  Logger.log('[JSON修正テスト(複雑)] 不正なJSON:');
  Logger.log(malformedJson);

  const config = getConfig();

  try {
    const fixedJson = fixMalformedJSONWithVertexAI(
      malformedJson,
      config,
      true, // includeRequestDetails
      true  // enableTranscript
    );

    Logger.log('[JSON修正テスト(複雑)] ✓ 修正成功');
    Logger.log('[JSON修正テスト(複雑)] 修正後のJSON:');
    Logger.log(JSON.stringify(fixedJson, null, 2));

    return {
      success: true,
      fixedJson: fixedJson
    };

  } catch (error) {
    Logger.log('[JSON修正テスト(複雑)] ❌ 修正失敗');
    Logger.log(`エラー: ${error.message}`);

    return {
      success: false,
      error: error.message
    };
  }
}
