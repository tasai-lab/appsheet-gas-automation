/**

 * ============================================

 * AppSheet API 連携設定

 * ============================================

 */

const GEMINI_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY'; // ★ Gemini APIキー

const APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';           // ★ AppSheet アプリID

const ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY'; // ★ AppSheet API アクセスキー

const ERROR_NOTIFICATION_EMAIL = "t.asai@fractal-group.co.jp";       // ★ エラー通知先のメールアドレス


// 使用するGeminiモデル

const GEMINI_MODEL = 'gemini-2.5-pro';


/**

 * AppSheetのWebhookからPOSTリクエストを受け取るメイン関数

 */

/**
 * AppSheet Webhook エントリーポイント
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_訪問看護_書類OCR';
    return processRequest(params);
  });
}


/**
 * メイン処理関数（引数ベース）
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} - 処理結果
 */
function processRequest(params) {
  const config = params.config;

  const data = params.data;

  if (!config || !data) {

    const errorMessage = "WebhookのBodyの形式が不正です。'config'と'data'オブジェクトが必要です。";

    console.error(errorMessage);

    sendErrorEmail("Unknown", errorMessage);

    return;

  }

  const rowKey = data.keyValue;

  const fileId = data.fileId;

  const documentType = data.document_type || "汎用ドキュメント";

  const customInstructions = data.custom_instructions;

  const clientContextInfo = data.client_context_info;

  if (!rowKey || !fileId) {

    const errorMessage = `必須パラメータ（keyValue, fileId）がWebhookの'data'オブジェクトに含まれていません。`;

    console.error(errorMessage);

    updateOnError(config, rowKey || "Unknown", errorMessage);

    sendErrorEmail(rowKey || "Unknown", errorMessage);

    return;

  }

  // ★追加: 重複実行防止ロジック

  const properties = PropertiesService.getScriptProperties();

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(15000); // 最大15秒待機してロックを取得

    const status = properties.getProperty(rowKey);

    // 既に処理中または完了済みの場合は、何もせずに終了

    if (status === 'processing' || status === 'completed') {

      console.log(`リクエストは既に処理中または完了済みです。スキップします。 (ID: ${rowKey}, Status: ${status})`);

      lock.releaseLock();

      // AppSheetに正常応答を返し、リトライを防ぐ

      return ContentService.createTextOutput("Skipped: Task is already processing or completed.").setMimeType(ContentService.MimeType.TEXT);

    }

    // 状態を「処理中」に更新

    properties.setProperty(rowKey, 'processing');

    lock.releaseLock();

  } catch (lockError) {

    console.error(`ロックの取得に失敗しました (ID: ${rowKey}): ${lockError.stack}`);

    sendErrorEmail(rowKey, `ロック取得エラー: ${lockError.toString()}`);

    // 異常終了として応答

    return ContentService.createTextOutput(`Error: Could not acquire lock.`).setMimeType(ContentService.MimeType.TEXT);

  }

  // メイン処理

  try {

    // 1. Geminiで書類/音声/動画を解析

    const resultData = analyzeDocumentWithGemini(fileId, documentType, customInstructions, clientContextInfo);

    // 2. 成功したのでAppSheetのテーブルを更新

    updateOnSuccess(config, rowKey, resultData);

    // 3. 抽出したタイトルでファイル名を変更

    const originalFile = DriveApp.getFileById(fileId);

    const originalName = originalFile.getName();

    const extension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';

    const safeTitle = resultData.title.replace(/[\\/?<>*:|"]/g, '_');

    const newFileName = safeTitle + extension;

    renameDriveFile(fileId, newFileName);

    // ★追加: 成功したので状態を「完了」に更新

    properties.setProperty(rowKey, 'completed');

  } catch (error) {

    console.error(error.stack);

    // 4. エラー処理

    updateOnError(config, rowKey, error.toString());

    sendErrorEmail(rowKey, error.stack);

    // ★追加: エラーが発生したので、再実行できるようにプロパティを削除

    properties.deleteProperty(rowKey);

  }
}

/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {
  // TODO: テストデータを設定してください
  const testParams = {
    // 例: action: "test",
    // 例: data: "sample"
  };

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_訪問看護_書類OCR');
}


/**

 * Gemini APIを呼び出し、ファイルから情報を抽出・構造化する

 */

function analyzeDocumentWithGemini(fileId, documentType, customInstructions, clientContextInfo) {

  const file = DriveApp.getFileById(fileId);

  const fileBlob = file.getBlob();

  const fileName = file.getName();

  const driveMimeType = fileBlob.getContentType();

  const mimeType = determineMimeType(fileName, driveMimeType);

  const fileCategory = getFileCategory(mimeType, fileName);

  console.log(`解析開始 - FileName: ${fileName}, Category: ${fileCategory}, DocumentType: ${documentType}`);

  const prompt = generatePrompt(documentType, fileCategory, customInstructions, clientContextInfo);

  const textPart = { text: prompt };

  const filePart = { inlineData: { mimeType: mimeType, data: Utilities.base64Encode(fileBlob.getBytes()) } };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const requestBody = {

    contents: [{ parts: [textPart, filePart] }],

    generationConfig: { "responseMimeType": "application/json", "temperature": 0.3 }

  };

  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(requestBody), muteHttpExceptions: true };

  const response = UrlFetchApp.fetch(url, options);

  const responseText = response.getContentText();

  if (response.getResponseCode() !== 200) throw new Error(`Gemini APIエラー: ${responseText}`);

  const jsonResponse = JSON.parse(responseText);

  if (!jsonResponse.candidates || jsonResponse.candidates.length === 0) {

    throw new Error("AIからの応答に有効な候補が含まれていません（ブロックされた可能性があります）: " + responseText);

  }

  let content = jsonResponse.candidates[0].content.parts[0].text;

  const startIndex = content.indexOf('{');

  const endIndex = content.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1) {

    try {

      return JSON.parse(content);

    } catch (e) {

      console.error("AI応答内容: " + content.substring(0, 500));

      throw new Error("AIの応答からJSONを抽出できませんでした。");

    }

  }

  return JSON.parse(content.substring(startIndex, endIndex + 1));

}

// ============================================

// 解析ヘルパー関数

// ============================================

/**

 * ファイル名とDriveのMIMEタイプから最適なMIMEタイプを決定する

 * 拡張子を優先して判定する

 */

function determineMimeType(fileName, driveMimeType) {

  const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';

  // 拡張子に基づいてMIMEタイプをマッピング

  const extensionMap = {

    // 画像

    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp',

    // ドキュメント

    'pdf': 'application/pdf',

    // 音声・動画

    'm4a': 'audio/mp4', // M4AはMP4コンテナを使用

    'mp3': 'audio/mpeg',

    'wav': 'audio/wav',

    'ogg': 'audio/ogg',

    'flac': 'audio/flac',

    'mp4': 'video/mp4',

    'mov': 'video/quicktime',

    'avi': 'video/x-msvideo',

    '3gp': 'video/3gpp',

    '3gpp': 'video/3gpp',

    'webm': 'video/webm'

  };

  const mimeFromExtension = extensionMap[extension];

  if (mimeFromExtension) {

    // Driveの判定が汎用バイナリ以外で、かつ拡張子からの推測と異なる場合はログに残す

    if (mimeFromExtension !== driveMimeType && driveMimeType !== 'application/octet-stream') {

        console.log(`MIMEタイプを拡張子(${extension})から補正しました: ${driveMimeType} -> ${mimeFromExtension}`);

    }

    return mimeFromExtension;

  }

  // 推測できない場合は、Driveの判定をそのまま返す

  return driveMimeType;

}

/**

 * MIMEタイプに基づいてファイルカテゴリ（DOCUMENT または AUDIO_VISUAL）を判定し、検証する

 */

function getFileCategory(mimeType, fileName) {

  if (!mimeType) {

    throw new Error(`ファイル「${fileName}」のMIMEタイプを取得できませんでした。`);

  }

  const lowerMimeType = mimeType.toLowerCase();

  // MIMEタイプが汎用的すぎる場合（拡張子からも特定できなかった場合）

  const genericMimeTypes = ['application/octet-stream', 'binary/octet-stream'];

  if (genericMimeTypes.includes(lowerMimeType)) {

     throw new Error(`ファイル「${fileName}」のMIMEタイプを特定できませんでした (汎用バイナリ形式: ${mimeType})。拡張子が正しいか確認してください。`);

  }

  // 画像またはPDF

  if (lowerMimeType.startsWith('image/') || lowerMimeType.includes('pdf')) {

    return 'DOCUMENT';

  }

  // 音声（audio/）または動画（video/）

  else if (lowerMimeType.startsWith('audio/') || lowerMimeType.startsWith('video/')) {

    return 'AUDIO_VISUAL';

  } else {

    // サポート外のファイル形式

    throw new Error(`ファイル「${fileName}」はサポートされている形式ではありません。(MIME Type: ${mimeType})。PDF、画像、音声、または動画ファイルを使用してください。`);

  }

}


// ============================================

// プロンプト生成関数

// ============================================


/**

 * ドキュメントタイプとファイルカテゴリに基づいて最適なプロンプトを生成する

 * ★変更：clientContextInfoを受け取る

 */

function generatePrompt(documentType, fileCategory, customInstructions, clientContextInfo) {

  if (fileCategory === 'DOCUMENT') {

    // ドキュメント解析ではコンテキスト情報は使用しない

    return generateDocumentPrompt(documentType);

  } else if (fileCategory === 'AUDIO_VISUAL') {

    // ★変更：clientContextInfoを渡す

    return generateAudioVisualPrompt(documentType, customInstructions, clientContextInfo);

  }

  // エラーハンドリング強化

  throw new Error(`予期しないファイルカテゴリが指定されました: ${fileCategory}`);

}


/**

 * 画像/PDFファイル用のプロンプト（OCR・構造化）

 */

function generateDocumentPrompt(documentType) {

  return `

# あなたの役割

あなたは、日本の医療・介護分野で使われる様々な書類を、後続のAIが分析しやすいように構造化されたデータとしてデジタル化する、高度なAI OCRエキスパートです。

# 対象書類の種類

この書類は「${documentType}」として分類されています。この前提知識を用いて、情報の抽出と構造化の精度を最大化してください。もし内容が分類と明らかに異なる場合は、その旨を[分析ノート]としてocr_textの冒頭に記述してください。

# 基本方針

目標は、単なる文字の羅列ではなく、情報の関連性や階層構造が明確な「セマンティック（意味的）なマークダウン」を生成することです。

# 実行タスク

提供された書類の画像/PDFから、以下の#出力指示に従って、情報を正確に抽出・再構成してください。

# 出力指示

## 1. 構造化OCRテキスト (ocr_text)

- 書類に含まれる**全ての文字情報**（手書きメモ、印鑑の文字等を含む）を、Markdown形式で構造化してください。

- **重要項目の抽出**: 「${documentType}」に通常含まれる重要な項目（例：処方薬なら薬品名・用法・用量、指示書なら指示期間・指示内容）が明確になるように、見出しやテーブルを適切に使用してください。

- **見出しと階層:** Markdownの見出し（#、##）を使用してください。

- **キーと値のペア:** \`**項目名**: 値\` のように太字にしてください。

- **表組（テーブル）:** データが表形式の場合、必ずMarkdownのテーブル形式で再構成してください。

- **注釈と補足情報:** 手書きや印鑑は、\`> [注記] 内容\` のように記述してください。

- **判読不能な文字:** 読み取れない文字は\`[判読不能]\` と記述し、AIが独自に内容を推測して補完することは絶対にしないでください。

## 2. 要約 (summary)

- 生成したOCRテキストを基に、この書類が「${documentType}」としてどのような目的と結論を持っているのかが200文字程度で簡潔にわかるように、平易な日本語で要約してください。

## 3. 推奨タイトル (title)

- この書類の内容に最もふさわしいファイル名を生成してください。

- 形式は「日付_書類の種類_主要な名前や組織」のように、検索しやすいものにしてください。

- 日付は書類内に記載があればその日付をYYYY-MM-DD形式で、なければ今日の日付を使用してください。

# 出力形式

- 必ず以下のキーを持つJSONオブジェクトとして出力してください。JSON以外の説明文やマーカーは一切含めないでください。

{

  "ocr_text": "（Markdown形式で構造化されたOCRテキスト）",

  "summary": "（200文字程度の要約文）",

  "title": "（推奨ファイル名）"

}

`;

}

/**

 * 音声/動画ファイル用のプロンプト（分析・生成）

 * ★変更：clientContextInfoを受け取り、プロンプトに組み込む

 */

function generateAudioVisualPrompt(documentType, customInstructions, clientContextInfo) {

  let specificInstructions = "";

  let instructionSource = "デフォルト設定"; // 指示のソースを示す

  // カスタム指示が提供されている場合は、それを優先する

  if (customInstructions && customInstructions.trim() !== "") {

    specificInstructions = `

### カスタム指示（ユーザー提供）

${customInstructions}

`;

    instructionSource = "ユーザー指定のカスタム指示";

    console.log("カスタム指示を使用します。");

  } else {

    // カスタム指示がない場合、documentTypeに基づいてデフォルトの構成要素を定義する

    console.log("デフォルトの指示（DocumentType別）を使用します。");

    switch (documentType) {

      case "カンファレンス議事録":

      case "サービス担当者会議の議事録":

        specificInstructions = `

### ${documentType}の必須構成要素

以下の要素を必ず含め、公式な議事録として整形してください。音声や映像から情報を抽出し、要点をまとめて記述してください。

1.  **会議名**

2.  **開催日時・場所**

3.  **出席者**（役職や所属も特定できれば明記。映像やコンテキスト情報から特定できる場合もあります）

4.  **議題と討議内容**

    *   各議題について、誰がどのような発言をしたか、どのような経緯で結論に至ったかを明確に記述してください。発言の要点をまとめ、冗長な表現は避けてください。

5.  **決定事項（サマリー）**

    *   会議で決定したことを箇条書きで明確に記述してください。

6.  **次回予定・ToDo（ネクストアクション）**

    *   誰が、いつまでに、何をするのかを明確に記述してください。

`;

        break;

      case "利用者関連情報の資料":

        specificInstructions = `

### 利用者関連情報の必須構成要素

聴取した内容から、利用者の状況に関する情報を整理してください。

1.  **聴取日時・場所・担当者**

2.  **情報提供元**（誰からの情報か）

3.  **利用者の基本情報**（氏名、年齢、病状など、メディア内やコンテキスト情報で言及された範囲で）

4.  **現在の状況と課題（ADL/IADL）**

    *   生活状況、心身の状態、医療的なケアの状況など、具体的なエピソードを基に記述してください。

5.  **今後の方向性・要望**

    *   本人や家族がどのような支援を望んでいるか、今後の方針について記述してください。

6.  **特記事項・共有すべき情報**

`;

        break;

      case "往診同席で聴取した内容のまとめ資料":

        specificInstructions = `

### 往診同席記録の必須構成要素

医師の診察内容と、それに対する患者・家族の反応を整理してください。

1.  **往診日時・場所**

2.  **担当医師（医療機関名・氏名）・同席者**

3.  **患者の状態・主訴**（バイタルサインなど、メディア内やコンテキスト情報で言及された範囲で）

4.  **医師の診察所見・説明内容**

    *   診断結果、治療方針、処方変更など、医師が説明した内容を正確に記述してください。

5.  **質疑応答**

    *   患者・家族・スタッフからの質問と、それに対する医師の回答を記述してください。

6.  **今後の対応・指示事項**

    *   医師からの指示や、今後スタッフが対応すべき事項について記述してください。

`;

        break;

      default:

        // その他の音声/動画ファイルの場合（汎用的な文字起こしと要約）

        specificInstructions = `

### 構造化の指示

1.  **発言者分離**: 可能であれば発言者を特定し（コンテキスト情報も参考に）、誰の発言かわかるように記述してください。タイムスタンプも付与してください。

2.  **トピック整理**: 会話全体の要点をまとめ、重要なトピックごとに整理してください。

3.  **決定事項/ToDo**: 会話の中で決定したことや、今後のアクションがあれば明確に記述してください。

`;

        break;

    }

  }

  // ★追加：コンテキスト情報セクションを構築

  let contextSection = "";

  if (clientContextInfo && clientContextInfo.trim() !== "") {

    console.log("利用者コンテキスト情報をプロンプトに追加します。");

    contextSection = `

# コンテキスト情報（重要）

以下の情報は、この音声/動画に関する背景情報（利用者情報、関連する経緯、頻出する固有名詞など）です。

この情報を最大限に活用し、会話内容の理解、登場人物の特定、専門用語や名前の認識精度を向上させてください。

【提供された背景情報】

${clientContextInfo}

---

`;

  }

  return `

# あなたの役割

あなたは、医療・介護現場での会議や面談の音声/動画を分析し、指定された形式の公式な記録として文書化する、高度なAIアシスタントです。

${contextSection}

# 入力情報

提供された音声/動画ファイルは「${documentType}」として記録する必要があります。

適用される指示のソース：${instructionSource}

# 実行タスク

音声/動画ファイルの内容（主に音声トラック）を正確に聞き取り、分析し、以下の指示に従って「${documentType}」を作成してください。単なる文字起こしではなく、内容を理解し、要点をまとめ、公式な記録としてふさわしい体裁（客観的な記述、適切な敬語）に整えることが求められます。

【動画の場合の重要指示】動画が入力された場合は、映像も参考にしながら状況理解（例：発言者の特定、表情、提示された資料の確認）の精度を高めてください。ただし、最終的な出力は音声情報に基づいたテキスト記録としてください。

# 出力指示

## 1. 構造化テキスト (ocr_text)

- 内容を基に、以下の「構成要素/指示」に従ってMarkdown形式で文書を作成してください。

${specificInstructions}

## 2. 要約 (summary)

- 作成した文書全体の目的と結論（どのようなトピックについて話し合われ、何が決まったか）が200文字程度で簡潔にわかるように、平易な日本語で要約してください。

## 3. 推奨タイトル (title)

- この記録の内容に最もふさわしいファイル名を生成してください。

- 形式は「日付_記録の種類_主要な名前や組織」のように、後から検索しやすいものにしてください。

- 日付は記録内で言及があればその日付をYYYY-MM-DD形式で、なければ今日の日付を使用してください。

# 出力形式

- 以上の3つの項目を、必ず以下のキーを持つJSONオブジェクトとして出力してください。

- ※重要：ocr_textには文字起こし原文ではなく、生成された構造化ドキュメント（議事録など）を入れてください。

- JSON以外の説明文や\`\`\`マーカーは一切含めないでください。

{

  "ocr_text": "（Markdown形式で構造化されたテキスト）",

  "summary": "（200文字程度の要約文）",

  "title": "（推奨ファイル名）"

}

`;

}

// ============================================

// ユーティリティ関数（AppSheet連携・その他）

// ============================================

/**

 * 成功時にAppSheetのテーブルを更新する

 */

function updateOnSuccess(config, keyValue, resultData) {

  const rowData = {

    [config.keyColumn]: keyValue,

    [config.titleColumn]: resultData.title,

    [config.summaryColumn]: resultData.summary,

    [config.ocrColumn]: resultData.ocr_text,

    [config.statusColumn]: "完了"

  };

  const payload = { Action: "Edit", Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: [rowData] };

  callAppSheetApi(config.tableName, payload);

}


/**

 * 失敗時にAppSheetのテーブルを更新する

 */

function updateOnError(config, keyValue, errorMessage) {

  // configが不正な場合に備える

  if (!config || !config.tableName || !config.keyColumn || !config.statusColumn) {

    console.error("config情報が不足しているため、AppSheetへのエラー書き込みをスキップします。");

    return;

  }

  const rowData = {

    [config.keyColumn]: keyValue,

    [config.statusColumn]: "エラー",

    "error_details": `GAS Script Error: ${errorMessage}`

  };

  const payload = { Action: "Edit", Properties: { "Locale": "ja-JP", "Timezone": "Asia/Tokyo" }, Rows: [rowData] };

  callAppSheetApi(config.tableName, payload);

}


/**

 * Google Drive上のファイル名を変更する

 */

function renameDriveFile(fileId, newName) {

  try {

    const file = DriveApp.getFileById(fileId);

    // ファイル名が変更されていない場合はスキップ

    if (file.getName() === newName) {

      console.log(`ファイル名は既に「${newName}」です。変更をスキップします。`);

      return;

    }

    console.log(`ファイル名を変更します: ${file.getName()} → ${newName}`);

    file.setName(newName);

  } catch (e) {

    // ファイル名変更は失敗しても致命的ではないため、警告ログのみ出力

    console.log(`警告: ファイル名の変更に失敗しました。File ID: ${fileId}, Error: ${e.toString()}`);

  }

}


/**

 * 処理失敗時にメールでエラー内容を通知する

 */

function sendErrorEmail(keyValue, errorMessage) {

  const subject = `[要確認] GAS処理エラー: 書類・メディア自動処理 (ID: ${keyValue})`;

  const body = `AppSheetの自動処理（OCR/音声・動画解析）でエラーが発生しました。\n\n■ 対象ID\n${keyValue}\n\n■ エラー内容\n${errorMessage}\n\nGASのログをご確認ください。`;

  try {

    if (ERROR_NOTIFICATION_EMAIL) {

        // Email removed - using execution log instead

    }

  } catch (e) {

    console.error(`エラー通知メールの送信に失敗しました: ${e.toString()}`);

  }

}


/**

 * AppSheet APIを呼び出す共通関数

 */

function callAppSheetApi(tableName, payload) {

  // tableNameはURLエンコードする

  const apiUrl = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${encodeURIComponent(tableName)}/Action`;

  const options = {

    method: 'post',

    contentType: 'application/json',

    headers: { 'ApplicationAccessKey': ACCESS_KEY },

    payload: JSON.stringify(payload),

    muteHttpExceptions: true

  };

  const response = UrlFetchApp.fetch(apiUrl, options);

  console.log(`AppSheet API (${tableName}) 応答コード: ${response.getResponseCode()}`);

  if (response.getResponseCode() >= 400) {

    const errorDetails = response.getContentText();

    console.error(`AppSheet API Error詳細: ${errorDetails}`);

    throw new Error(`AppSheet API Error (${tableName}): ${response.getResponseCode()} - ${errorDetails}`);

  }

}
