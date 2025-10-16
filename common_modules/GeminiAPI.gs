/**
 * Gemini API統合モジュール
 * 
 * Gemini APIの呼び出しを統一管理し、最適なモデルを自動選択します。
 */

// Gemini API設定
const GEMINI_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY';
const GEMINI_MODEL_FLASH = 'gemini-2.0-flash-exp';
const GEMINI_MODEL_PRO = 'gemini-2.0-flash-thinking-exp-01-21';

/**
 * タスクの複雑度
 */
const TaskComplexity = {
  SIMPLE: 'simple',      // 単純な抽出・分類
  MODERATE: 'moderate',  // 中程度の処理
  COMPLEX: 'complex'     // 複雑な思考・要約
};

/**
 * Gemini APIを呼び出し
 * @param {string} prompt - プロンプト
 * @param {Object} options - オプション
 * @param {string} options.complexity - タスクの複雑度（TaskComplexity）
 * @param {Object} options.imageData - 画像データ {mimeType, data}
 * @param {number} options.maxRetries - リトライ回数
 * @return {Object} - APIレスポンス
 */
function callGeminiAPI(prompt, options = {}) {
  const {
    complexity = TaskComplexity.SIMPLE,
    imageData = null,
    maxRetries = 2
  } = options;
  
  // モデル選択
  const model = complexity === TaskComplexity.COMPLEX ? GEMINI_MODEL_PRO : GEMINI_MODEL_FLASH;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  
  // リクエストボディ構築
  const parts = [{ text: prompt }];
  if (imageData) {
    parts.push({
      inline_data: {
        mime_type: imageData.mimeType,
        data: imageData.data
      }
    });
  }
  
  const payload = {
    contents: [{
      parts: parts
    }]
  };
  
  const requestOptions = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  // リトライロジック
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startTime = new Date();
      const response = UrlFetchApp.fetch(url, requestOptions);
      const responseCode = response.getResponseCode();
      const responseBody = response.getContentText();
      const processingTime = ((new Date() - startTime) / 1000).toFixed(2);
      
      if (responseCode === 200) {
        const result = JSON.parse(responseBody);
        
        if (result.candidates && 
            result.candidates[0] && 
            result.candidates[0].content && 
            result.candidates[0].content.parts && 
            result.candidates[0].content.parts[0]) {
          
          const text = result.candidates[0].content.parts[0].text;
          
          return {
            success: true,
            text: text,
            model: model,
            processingTime: processingTime,
            responseSize: responseBody.length
          };
        } else {
          Logger.log(`警告: Gemini APIレスポンス構造不正 - ${responseBody.substring(0, 200)}`);
        }
      } else if (responseCode === 429 && attempt < maxRetries) {
        // レート制限の場合はリトライ
        const waitTime = Math.pow(2, attempt) * 1000;
        Logger.log(`レート制限エラー。${waitTime}ms後にリトライ...`);
        Utilities.sleep(waitTime);
        continue;
      } else {
        Logger.log(`エラー: Gemini API呼び出し失敗 - Status: ${responseCode}, Body: ${responseBody.substring(0, 200)}`);
      }
      
    } catch (e) {
      Logger.log(`エラー: Gemini API呼び出し例外 (試行${attempt + 1}/${maxRetries + 1}) - ${e.message}`);
      
      if (attempt < maxRetries) {
        Utilities.sleep(1000);
        continue;
      }
    }
  }
  
  return {
    success: false,
    error: 'Gemini API呼び出し失敗'
  };
}

/**
 * Gemini APIでJSONを抽出
 * @param {string} prompt - プロンプト
 * @param {Object} options - callGeminiAPIのオプション
 * @return {Object} - パース済みJSON or null
 */
function extractJSONWithGemini(prompt, options = {}) {
  const result = callGeminiAPI(prompt, options);
  
  if (!result.success) {
    return { success: false, error: result.error };
  }
  
  try {
    let jsonText = result.text.trim();
    
    // Markdownコードブロックの除去
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }
    
    const parsedJSON = JSON.parse(jsonText);
    
    return {
      success: true,
      data: parsedJSON,
      model: result.model,
      processingTime: result.processingTime,
      responseSize: result.responseSize
    };
    
  } catch (e) {
    Logger.log(`エラー: JSONパース失敗 - ${e.message}`);
    Logger.log(`レスポンステキスト: ${result.text.substring(0, 500)}`);
    
    return {
      success: false,
      error: 'JSONパース失敗',
      rawText: result.text
    };
  }
}
