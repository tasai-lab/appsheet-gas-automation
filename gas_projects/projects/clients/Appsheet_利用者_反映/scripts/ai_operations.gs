/**
 * AI処理モジュール
 *
 * Vertex AI（Gemini）を使用した利用者情報の抽出処理
 *
 * @version 1.0.0
 * @date 2025-10-21
 */

// ========================================
// AI処理
// ========================================

/**
 * Vertex AI (Gemini) を使用して、依頼情報から利用者情報を抽出する
 *
 * @param {string} clientInfoTemp - 利用者に関するメモ
 * @param {string} requestReason - 依頼理由
 * @param {string} fileId - 添付資料のGoogle Drive ファイルID（オプション）
 * @return {Object} 抽出された利用者情報のJSONオブジェクト
 */
function extractClientInfoWithGemini(clientInfoTemp, requestReason, fileId) {
  const prompt = buildExtractionPrompt(clientInfoTemp, requestReason);
  const parts = buildRequestParts(prompt, fileId);
  const requestBody = buildVertexAIRequest(parts);

  const response = callVertexAI(requestBody);

  return parseVertexAIResponse(response);
}

/**
 * 情報抽出用のプロンプトを構築
 * @private
 */
function buildExtractionPrompt(clientInfoTemp, requestReason) {
  return `
# あなたの役割

あなたは、訪問看護ステーションの優秀な医療事務スタッフです。以下の#依頼情報と#添付資料（もしあれば）を精査し、新しい利用者（クライアント）の基本情報を日本の公的書類の形式に準拠して、極めて正確に抽出してください。

# 依頼情報

## 依頼理由

${requestReason || '記載なし'}

## 利用者に関するメモ

${clientInfoTemp}

# 抽出ルールと出力形式

- 全ての情報を元に、以下のJSONオブジェクトのキーに対応する値を抽出・推測してください。

- 該当する情報がない場合は、値にnullを設定してください。

- JSON以外の説明文は一切含めないでください。

{

  "last_name": "姓",

  "first_name": "名",

  "last_name_kana": "セイ（カタカナ）",

  "first_name_kana": "メイ（カタカナ）",

  "gender": "性別（「男性」「女性」「その他」のいずれか）",

  "birth_date": "生年月日を西暦のYYYY/MM/DD形式で抽出。例えば「昭和6年2月1日」は「1931/02/01」と変換。",

  "birth_date_nengo": "生年月日の年号を「大正」「昭和」「平成」「令和」のいずれかで抽出。",

  "birth_date_nengo_year": "生年月日の年号の年数を数値で抽出。例えば「昭和6年」なら 6。",

  "is_welfare_recipient": "生活保護を受給している事実があれば true, なければ false のブール値。",

  "care_level_name": "要介護度を抽出。必ず「要支援１」「要介護５」のように数字を全角にしてください。",

  "phone1": "可能な限り利用者本人の電話番号を抽出。",

  "phone1_destination": "phone1の電話番号の持ち主（例：「本人」「自宅」「妻」「長男」）",

  "phone2": "本人以外の緊急連絡先など、2つ目の電話番号を抽出。",

  "phone2_destination": "phone2の電話番号の持ち主（例：「長女」「キーパーソン」）",

  "special_notes": "特記事項（ADL、アレルギー、キーパーソン、その他注意点など）を要約"

}

`;
}

/**
 * リクエストパーツを構築（テキスト + 画像）
 * @private
 */
function buildRequestParts(prompt, fileId) {
  const textPart = { text: prompt };
  const parts = [textPart];

  if (fileId) {
    const file = DriveApp.getFileById(fileId);
    const fileBlob = file.getBlob();
    parts.push({
      inlineData: {
        mimeType: fileBlob.getContentType(),
        data: Utilities.base64Encode(fileBlob.getBytes())
      }
    });
  }

  return parts;
}

/**
 * Vertex AIリクエストボディを構築
 * @private
 */
function buildVertexAIRequest(parts) {
  const generationConfig = {
    responseMimeType: "application/json",
    temperature: VERTEX_AI_CONFIG.temperature,
    maxOutputTokens: VERTEX_AI_CONFIG.maxOutputTokens
  };

  return {
    contents: [{ parts: parts }],
    generationConfig: generationConfig
  };
}

/**
 * Vertex AI APIを呼び出す
 * @private
 */
function callVertexAI(requestBody) {
  const url = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${VERTEX_AI_MODEL}:generateContent`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${ScriptApp.getOAuthToken()}` },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  Logger.log('[Vertex AI] API呼び出し開始');
  const startTime = new Date().getTime();

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  const endTime = new Date().getTime();
  const responseTime = endTime - startTime;

  Logger.log(`[Vertex AI] API応答: ${responseCode}, 処理時間: ${responseTime}ms`);

  if (responseCode !== 200) {
    Logger.log(`[Vertex AI] エラーレスポンス: ${responseText}`);
    throw new Error(`Vertex AI API Error: ${responseCode} - ${responseText.substring(0, 200)}`);
  }

  return responseText;
}

/**
 * Vertex AIのレスポンスをパースして抽出情報を返す
 * @private
 */
function parseVertexAIResponse(responseText) {
  const jsonResponse = JSON.parse(responseText);

  // 非ストリーミングAPIの構造: { candidates: [...] }
  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {
    throw new Error("AIからの応答に有効な候補が含まれていません: " + responseText.substring(0, 200));
  }

  const candidate = jsonResponse.candidates[0];

  // finishReasonチェック
  if (candidate.finishReason) {
    Logger.log(`[Vertex AI] finishReason: ${candidate.finishReason}`);
    if (candidate.finishReason === 'MAX_TOKENS') {
      throw new Error('Vertex AIの応答がトークン制限により途中で終了しました。');
    }
  }

  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    throw new Error('Vertex AIからの応答に有効なコンテンツが含まれていません');
  }

  const extractedText = candidate.content.parts[0].text;
  Logger.log(`[Vertex AI] 応答テキスト長: ${extractedText.length}文字`);

  return JSON.parse(extractedText);
}
