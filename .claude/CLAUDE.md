# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

**最終更新**: 2025-10-27
**プロジェクト規模**: 32個以上のGASプロジェクト、221個のGASファイル
**主要技術スタック**: Google Apps Script, Vertex AI (Gemini 2.5), AppSheet, Python自動化

---

## 🚨 最も重要な禁止事項（必読）

以下のパターンは**絶対に使用しない**こと。過去に重大な問題を引き起こしました。

1. ❌ **API呼び出しのリトライループ**: 1回のみ実行（リトライは最上位層のみ）
2. ❌ **ネストされたリトライ**: 指数的増加により200,000+ API呼び出し/日の実績
3. ❌ **Google AI Studio API**: Vertex AI完全移行済み（2025-10-15）
4. ❌ **APIキー認証**: OAuth2認証（`ScriptApp.getOAuthToken()`）のみ使用

詳細は [過去の失敗例と教訓](#過去の失敗例と教訓重要) を必ず参照してください。

---

## 推奨される実装パターン

### 標準テンプレート
- **doPost関数**: パターン1（CommonWebhook.handleDoPost）を使用
- **ロガー**: `createLogger()` + `finally`句で`saveToSpreadsheet()`
- **重複防止**: `DuplicationPrevention.executeWithRetry()`
- **Vertex AI**: OAuth2認証 + `logger.setUsageMetadata()`でコスト追跡

### 実装の統一度
- OAuth2認証: 95%統一
- ログスプレッドシート: 90%統一
- doPost関数構造: 35%統一（**改善中** - 3パターン並存）
- モデル選択ロジック: 30%統一（プロジェクトごとに異なる）

詳細は [重要な実装ノート](#重要な実装ノート) を参照してください。

---

## クイックスタート

### よく使うコマンド

- `/deploy` - GASプロジェクトをデプロイ
- `/retrieve` - Google DriveからGASプロジェクトを取得
- `/analyze-project` - プロジェクト構造を分析
- `/check-logs` - 実行ログを確認
- `/optimize-scripts` - 共通モジュールを適用
- `/test-project` - テスト関数を確認

### 重要な制約

- **機密ファイル保護**: `.env`, `credentials.json`, `token.pickle` は読み書き禁止
- **デプロイ確認**: `git push`, `clasp push` は実行前に確認が必要
- **Python構文チェック**: `.py`ファイルの編集後は自動的にコンパイルチェック実行

## プロジェクト概要

32個以上のAppSheet統合自動化プロジェクトを管理するGoogle Apps Script (GAS) 自動化ツールキット。一元化された実行ログ記録、Webhook重複防止、Gemini API統合、自動デプロイ機能を提供し、業務ワークフローの自動化を実現。

## コアアーキテクチャ

### 3層システム設計

1. **Python自動化レイヤー** (`ツール/`、ルートスクリプト)
   - Google DriveからGASプロジェクトを取得
   - Google Apps Scriptへのデプロイ
   - 共通モジュールによるスクリプト最適化
   - バージョン履歴管理

2. **共通モジュールレイヤー** (`common_modules/`)
   - `logger.gs`: 一元化された実行ログ記録（集中スプレッドシート）
   - `duplication_prevention.gs`: リクエストIDベースの重複検出（ScriptProperties使用）
   - `gemini_client.gs`: Gemini APIクライアント（Pro/Flashモデル選択）
   - `appsheet_client.gs`: AppSheet API操作

3. **GASプロジェクトレイヤー** (`gas_projects/`)
   - 32個以上の独立したAppSheet Webhookハンドラー
   - 各プロジェクトには: `scripts/*.gs`, `FLOW.md`, `SPECIFICATIONS.md`, `README.md`, `project_metadata.json`
   - Vertex AI（通話系プロジェクト）またはGemini API（その他）を使用

### 重要な設計パターン

**Webhook重複防止:**
- リクエストペイロードのSHA-256ハッシュを一意IDとして使用
- ScriptPropertiesに24時間のTTLで保存
- ダブルチェックロックパターンで競合状態を防止
- 実装詳細は `docs/ja/重複防止機能.md` を参照

**一元化ログ記録:**
- 全プロジェクトが単一のスプレッドシートにログを記録: `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX`
- 構造化フォーマット: タイムスタンプ、スクリプト名、ステータス、リクエストID、実行時間、詳細
- 自動クリーンアップ: 90日以上前のログは削除

**モデル選択戦略:**

| プロジェクト | モデル | 思考モード | 用途 | 特徴 |
|------------|--------|-----------|------|------|
| **通話_要約生成** | Vertex AI Gemini 2.5 Flash | なし | 音声解析・要約・アクション抽出・依頼情報抽出 | base64 inlineData使用、非ストリーミング、OAuth2認証 |
| **通話_質疑応答** | Vertex AI Gemini 2.5 Flash/Pro | あり（Budget: -1） | 通話記録への質疑応答 | キーワード「しっかり」でPro切替、深い推論 |
| **利用者_質疑応答** | Vertex AI Gemini 2.5 Flash | なし | 利用者情報への質疑応答 | 非同期タスクキュー、回答+要約同時生成 |
| **看護記録系** | Vertex AI Gemini 2.5 Pro | あり | 看護記録生成・分析 | 高精度な医療文書処理 |
| **その他標準処理** | Vertex AI Gemini 2.5 Flash | なし | OCR、データ抽出、分類 | 高速・低コスト |

**重要な方針:**
- ✅ **全プロジェクトVertex AI使用**: Google AI Studio API（Gemini API）は完全廃止
- ✅ **OAuth2認証**: `ScriptApp.getOAuthToken()`で安全な認証
- ✅ **思考モード活用**: 複雑な推論が必要な質疑応答系でThinking Budgetを設定
- ✅ **モデル切替機能**: ユーザーが「しっかり」キーワードで高精度モード選択可能
- ✅ **コスト最適化**: デフォルトFlash、必要時のみPro使用

## 開発コマンド

### DriveからGASプロジェクトを取得
```bash
# Google Driveから全GASプロジェクトをダウンロード
python retrieve_gas.py

# フィルターとオプション付き
python retrieve_gas.py --folder-id FOLDER_ID --filter "Appsheet" --verbose
```

### GASへのデプロイ
```bash
# 全プロジェクトをデプロイ
python ツール/deploy_all_to_gas.py

# フィルターと説明付きでデプロイ
python ツール/deploy_all_to_gas.py --filter "Appsheet_通話" --description "バグ修正" --verbose

# 単一プロジェクトのデプロイ（統合バージョン方式 - 推奨）
python deploy_unified.py Appsheet_通話_要約生成 "v96: API最適化"

# デプロイ履歴を表示
python ツール/show_deployment_history.py --project "Appsheet_通話_要約生成" --limit 10
```

### スクリプトの最適化
```bash
# 共通モジュール追加（ログ記録、重複防止、APIクライアント）
python ツール/optimize_all_appsheet_scripts.py --filter "Appsheet_通話" --verbose

# 重複防止機能を追加
python ツール/apply_dedup.py --dry-run --verbose

# doPostをテスト可能な関数にリファクタリング
python ツール/refactor_dopost_to_args.py --filter "Appsheet_通話" --dry-run
```

### テストと検証
```bash
# Pythonスクリプトのコンパイル（構文チェック）
python -m py_compile retrieve_gas.py

# 実行ログシートの設定確認
python ツール/check_execution_log_sheet.py

# コード品質分析
python ツール/analyze_code_quality.py
```

## プロジェクト構造規約

### GASプロジェクトのディレクトリ構成
```
gas_projects/Appsheet_通話_要約生成/
├── project_metadata.json          # Driveメタデータ（ID、親、タイムスタンプ）
├── appsscript.json               # GASマニフェスト（OAuthスコープ、タイムゾーン）
├── .clasp.json                   # Clasp設定
├── FLOW.md                       # Mermaidフロー図
├── SPECIFICATIONS.md             # 技術仕様
├── README.md                     # ユーザー向けドキュメント
├── MIGRATION_GUIDE.md           # バージョン移行ノート（該当する場合）
├── scripts/                      # ソースコード
│   ├── webhook.gs               # doPostエントリーポイント
│   ├── config.gs                # 設定定数
│   ├── *_service.gs             # ビジネスロジック
│   ├── duplication_prevention.gs # common_modulesからコピー
│   ├── execution_logger.gs      # common_modulesからコピー
│   └── test_functions.gs        # 手動テスト関数
└── spreadsheets/                # 参照スプレッドシートメタデータ
    └── *_metadata.json
```

### 命名規則
- GASプロジェクト: `Appsheet_<ドメイン>_<機能>` (例: `Appsheet_通話_要約生成`)
- スクリプトファイル: `snake_case.gs`
- 関数: `camelCase` (GAS標準)
- 定数: `UPPER_SNAKE_CASE`

## 重要な実装ノート

### 共通モジュールの正しい使用方法

#### 1. Logger.gs（ロギングモジュール）

**基本的な使用パターン:**
```javascript
// ロガーインスタンス作成
const logger = createLogger('スクリプト名');

// ログレベル
logger.info('情報メッセージ', { details: 'オプションの詳細情報' });
logger.success('成功メッセージ');
logger.warning('警告メッセージ');
logger.error('エラーメッセージ', { stack: error.stack });

// API使用量記録（Vertex AI/Gemini API呼び出し後）
logger.setUsageMetadata({
  model: 'gemini-2.5-flash',
  inputTokens: 1000,
  outputTokens: 500,
  inputCostJPY: 0.045,
  outputCostJPY: 1.25,
  totalCostJPY: 1.295
});

// スプレッドシートに保存（finally句で実行）
logger.saveToSpreadsheet(status, recordId);
```

**統合ログスプレッドシート:**
- スプレッドシートID: `16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA`
- シート名: `コスト管理`
- 保持期間: 90日間
- 37列の詳細情報（タイムスタンプ、スクリプト名、ステータス、API使用量、コストなど）

**重要な注意点:**
- **必ずfinally句で保存**: エラー時でもログを記録するため
- **API使用量は必ず記録**: `logger.setUsageMetadata()` でコスト追跡
- **スプレッドシートが見つからない場合**: 自動的にフォールバック処理（フォルダーID: `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX` に新規作成）

#### 2. Duplication_Prevention.gs（重複防止モジュール）

**基本的な使用パターン:**
```javascript
// インスタンス作成
const dupPrevention = createDuplicationPrevention('スクリプト名');

// executeWithRetry()を使用した標準パターン
const result = dupPrevention.executeWithRetry(recordId, (id) => {
  // ビジネスロジックをここに記述
  return processRequest(params);
}, logger);

if (result.isDuplicate) {
  logger.warning(`既に処理済み: ${recordId}`);
  return ContentService.createTextOutput('重複実行').setMimeType(ContentService.MimeType.TEXT);
}

if (!result.success) {
  throw new Error(result.error);
}

return result.result;
```

**仕組み:**
- ScriptProperties + CacheService（6時間TTL）で処理済みレコードを追跡
- グローバルロック（5秒）+ キャッシュロック（設定可能）のダブルチェック
- 24時間後に自動クリーンアップ（`DuplicationPrevention.cleanupOldRecords()`）
- リトライ設定: 最大3回、1秒間隔

**重要な注意点:**
- **重複防止の無効化**: Script Properties で `ENABLE_DUPLICATION_PREVENTION=false` を設定
- **デバッグ時のリセット**: `dupPrevention.resetProcessingState(recordId)` で状態をリセット可能
- **ScriptPropertiesサイズ制限**: 約9KBの制限に注意（`checkPropertiesSize()` で監視）

#### 3. Gemini_Client.gs / Vertex AI クライアント

**基本的な使用パターン（Vertex AI）:**

```javascript
// クライアント作成（モデル選択）
const gemini = createGeminiFlashClient({
  temperature: 0.3,
  maxOutputTokens: 8192,
  enableThinking: false,  // 思考モード（質疑応答系のみ有効化）
  thinkingBudget: -1      // -1 = 無制限推論
});

// テキスト生成
const response = gemini.generateText(prompt, logger);
const generatedText = response.text;
const usageMetadata = response.usageMetadata;

// API使用量をロガーに記録
if (usageMetadata) {
  logger.setUsageMetadata(usageMetadata);
}
```

**モデル選択ヘルパー関数:**
```javascript
// Proモデル（高精度、高コスト）
const geminiPro = createGeminiProClient({ temperature: 0.2 });

// Flashモデル（標準、コスト効率重視）
const geminiFlash = createGeminiFlashClient({ temperature: 0.3 });

// Flash-Liteモデル（軽量、最小コスト）
const geminiLite = createGeminiFlashLiteClient({ temperature: 0.5 });
```

**認証:**
- 全プロジェクトで OAuth2 認証統一: `ScriptApp.getOAuthToken()`
- エンドポイント: `https://{location}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models/{model}:generateContent`
- 必須スコープ: `https://www.googleapis.com/auth/cloud-platform`

**重要な注意点:**
- **Google AI Studio API完全廃止**: 2025年10月以降、全プロジェクトでVertex AI使用
- **思考モードは慎重に使用**: 複雑な推論が必要な質疑応答系のみ有効化（コスト増加）
- **usageMetadataは必ず記録**: コスト追跡のため logger.setUsageMetadata() を呼び出す

### doPost関数パターン（3パターン並存）

現在、プロジェクト間で3つの異なるdoPost実装パターンが並存しています。**新規プロジェクトではパターン1（CommonWebhook）を推奨**します。

#### パターン1: CommonWebhook.handleDoPost()（推奨）

**使用プロジェクト:** 通話_質疑応答、訪問看護_通常記録、利用者_フェースシート、利用者_基本情報上書き など

```javascript
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    // スクリプト名設定（必須）
    params.scriptName = 'Appsheet_XXX_YYY';

    // ビジネスロジック実行
    return processRequest(params.recordId || params.data?.recordId, params);
  });
}

// ビジネスロジック関数（テスト可能）
function processRequest(recordId, params) {
  const logger = createLogger(params.scriptName);

  try {
    // 実装...
    logger.success('処理完了');
    return { success: true };

  } catch (error) {
    logger.error(`処理エラー: ${error.toString()}`, { stack: error.stack });
    throw error;
  }
}
```

**利点:**
- 標準化されたエラーハンドリング
- スプレッドシートログ自動記録
- 重複防止の自動適用
- コードの一貫性が高い

**CommonWebhook.handleDoPost() の内部動作:**
1. パラメータのJSONパース
2. 重複チェック（`DuplicationPrevention`）
3. ビジネスロジック実行（コールバック関数）
4. エラーハンドリング
5. finally句でログ保存（`logger.saveToSpreadsheet()`）

#### パターン2: executeWebhookWithDuplicationPrevention()（カスタム）

**使用プロジェクト:** 通話_要約生成

```javascript
function doPost(e) {
  try {
    return executeWebhookWithDuplicationPrevention(e,
      processCallSummaryWithErrorHandling, {
        recordIdField: 'callId',
        enableFingerprint: true,
        metadata: {
          processor: 'vertex_ai_unified',
          version: '4.0.0',
          scriptName: 'Appsheet_通話_要約生成'
        }
      });
  } catch (error) {
    Logger.log(`[doPost] エラー: ${error.message}`);
    logFailure(callId, error, { notes: 'doPost実行エラー' });
    throw error;
  }
}
```

**特徴:**
- 直接的なエラーハンドリング
- カスタムメタデータによるリクエスト追跡
- プロジェクト固有のロジック埋め込み可能

**使用を推奨しない理由:**
- コードの重複が発生しやすい
- 統一性が低下
- メンテナンス性が悪い

#### パターン3: 非同期タスク + JSON応答

**使用プロジェクト:** 利用者_質疑応答

```javascript
function doPost(e) {
  const startTime = new Date();

  if (!e || !e.postData || !e.postData.contents) {
    return createJsonResponse({
      status: "error",
      message: "Invalid request body"
    });
  }

  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: "Invalid JSON in request body"
    });
  }

  // ワーカー起動リクエストか判定
  if (params.action === CONFIG.ASYNC_CONFIG.WORKER_ACTION_KEY) {
    processTaskQueueWorker();
    return createJsonResponse({ status: "worker_process_invoked" });
  }

  return processRequest(params, startTime);
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

**特徴:**
- JSON形式の構造化レスポンス
- 非同期タスクキュー対応（ワーカーの自動起動）
- 冪等性ロックベースの重複防止（`acquireIdempotencyLock()`）

**使用ケース:**
- 処理時間が長い（6分を超える可能性）
- 複数の非同期タスクを処理
- 詳細なステータス情報を返す必要がある

### 標準doPost実装テンプレート（パターン1推奨）

```javascript
/**
 * Webhook受信エントリーポイント
 * @param {Object} e - Webhookイベント
 * @return {TextOutput} レスポンス
 */
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'Appsheet_XXX_YYY';  // スクリプト名（必須）

    // レコードID取得
    const recordId = params.recordId || params.data?.recordId;

    // ビジネスロジック実行
    return processRequest(recordId, params);
  });
}

/**
 * ビジネスロジック処理（テスト可能）
 * @param {string} recordId - レコードID
 * @param {Object} params - パラメータ
 * @return {Object} 処理結果
 */
function processRequest(recordId, params) {
  const logger = createLogger(params.scriptName);
  let status = '成功';

  try {
    logger.info('=== 処理開始 ===', { recordId: recordId });

    // 1. パラメータ検証
    if (!recordId) {
      throw new Error('recordIdが指定されていません');
    }

    // 2. ビジネスロジック実装
    // ... 実際の処理 ...

    // 3. API呼び出し（例: Vertex AI）
    const gemini = createGeminiFlashClient({ temperature: 0.3 });
    const response = gemini.generateText(prompt, logger);

    // API使用量記録
    if (response.usageMetadata) {
      logger.setUsageMetadata(response.usageMetadata);
    }

    // 4. 結果をAppSheetに反映
    // ... AppSheet API呼び出し ...

    logger.success('処理完了');
    return { success: true, result: response.text };

  } catch (error) {
    status = 'エラー';
    logger.error(`処理エラー: ${error.toString()}`, {
      recordId: recordId,
      stack: error.stack
    });

    // AppSheetにエラーステータス更新
    try {
      const appsheet = createAppSheetClient(CONFIG.APP_ID, CONFIG.ACCESS_KEY);
      appsheet.updateErrorStatus(CONFIG.TABLE_NAME, CONFIG.KEY_COLUMN, recordId, error.toString());
    } catch (updateError) {
      logger.error(`エラーステータス更新失敗: ${updateError.toString()}`);
    }

    throw error;

  } finally {
    // ログをスプレッドシートに保存（必須）
    logger.saveToSpreadsheet(status, recordId);
  }
}

/**
 * テスト関数（GASエディタで直接実行）
 */
function testProcessRequest() {
  const testParams = {
    scriptName: 'Appsheet_XXX_YYY',
    recordId: 'test-123',
    // ... その他のテストデータ
  };

  const result = processRequest(testParams.recordId, testParams);
  console.log(JSON.stringify(result, null, 2));
}
```

### Vertex AI統合（全プロジェクト共通）

**重要:** 2025年10月以降、全プロジェクトでVertex AIを使用。Google AI Studio API（Gemini API）は完全廃止。

**実装パターン:**

1. **通話_要約生成プロジェクト**（音声解析専用）:
   - `vertex_ai_service.gs`: 音声ファイル専用API（base64 inlineData使用）
   - `config.gs`: GCPプロジェクト設定（PROJECT_ID, LOCATION, MODEL）
   - 非ストリーミングAPI: レスポンス切断回避
   - 統合プロンプト: 1回のAPI呼び出しで要約+アクション+依頼情報抽出
   - **重要**: リトライループを削除（1回のみ実行）

2. **通話_質疑応答プロジェクト**（テキスト処理）:
   - `gemini_client.gs`: 共通モジュールのVertex AIクライアント
   - 思考モード有効: `thinkingBudget: -1`（無制限推論）
   - モデル選択: Flash（デフォルト）/ Pro（キーワード「しっかり」）

3. **利用者_質疑応答プロジェクト**（非同期処理）:
   - `vertex_ai_client.gs`: Vertex AI専用クライアント
   - 非同期タスクキュー: 長時間実行対応
   - JSON構造化レスポンス: `{answer, summary}`

4. **その他プロジェクト**:
   - `common_modules/gemini_client.gs`: Vertex AIエンドポイント使用
   - OAuth2認証: `ScriptApp.getOAuthToken()`

**認証設定:**
```javascript
// OAuth2認証（全プロジェクト共通）
headers: { 'Authorization': `Bearer ${ScriptApp.getOAuthToken()}` }

// エンドポイント形式
`https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`
```

**必須スコープ（appsscript.json）:**
```json
"https://www.googleapis.com/auth/cloud-platform"
```

### デプロイのベストプラクティス
1. **常に `deploy_unified.py` を使用** - バージョン番号の乱立を防止
2. **バージョン説明**: `v##: <説明>` の形式（例: "v96: バグ修正 - 依頼作成エラー"）
3. **バックアップファイルの除外**: `.claspignore` により `_backup/`, `*_backup.gs`, `*_v[0-9]*.gs` を除外
4. **デプロイ後の確認**: `cd gas_projects/<project> && clasp deployments`
5. **バージョン履歴**: `deployment_versions.json` に自動記録

### OAuthスコープ管理
必要な共通スコープ（`appsscript.json` で定義）:
```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}
```

スコープの追加は慎重に - ユーザーの再認証が必要になる。

## ドキュメント標準

### Mermaid図
- 配色スキームは `docs/ARCHITECTURE_DIAGRAM_COLOR_GUIDE.md` で定義
- 全ての `FLOW.md` ファイルで一貫した色分けの状態遷移図を使用
- 含むもの: メインフロー、重複防止、データフロー、エラーハンドリング、状態遷移

### 必須ドキュメント
各GASプロジェクトには以下が必要:
1. **FLOW.md**: 実行フローを示すMermaid図
2. **SPECIFICATIONS.md**: 技術仕様、APIエンドポイント、データモデル
3. **README.md**: ユーザー向けドキュメント、目的、使用方法
4. **MIGRATION_GUIDE.md**: バージョン移行ノート（破壊的変更がある場合）

## テストとデバッグ

### GASエディタでの手動テスト
`refactor_dopost_to_args.py` でリファクタリング後、各プロジェクトにはテスト関数がある:
```javascript
function testProcessRequest() {
  const testParams = {
    record_id: 'test-123',
    // ... その他のテストデータ
  };
  const result = processRequest(testParams);
  console.log(result);
}
```

Webhookをトリガーせずに、GASエディタで直接実行できる。

### 実行ログのモニタリング
- スプレッドシートでログを確認: `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX`
- フィルタ条件: スクリプト名、ステータス（成功/エラー/重複）、リクエストID、タイムスタンプ
- `ツール/check_execution_log_sheet.py` でログ設定を検証

## 主要な技術的制約

1. **ScriptPropertiesの制限**: 合計約9KB
   - 重複防止機能がリクエスト追跡に使用
   - トリガーで毎日自動クリーンアップ実行
   - `checkPropertiesSize()` 関数で監視

2. **実行時間制限**: Webhookは6分まで
   - 長時間実行操作は非同期パターンを使用
   - 大量データはバッチ処理を検討

3. **APIレート制限**:
   - Gemini API: モデルごとに分単位のクォータが異なる
   - Vertex AI: GCP課金でより寛容なクォータ
   - リトライには指数バックオフを実装

4. **バージョン管理**:
   - Gitでローカル変更を追跡
   - ClaspでGASに同期
   - `deployment_versions.json` でデプロイ履歴を追跡
   - これらを手動で同期する必要がある

## メンテナンスタスク

### 定期クリーンアップ
```bash
# プロジェクト間の重複コードを削除
python ツール/cleanup_code.py --verbose

# 高度な重複排除でディープクリーンアップ
python ツール/deep_cleanup_code.py

# バックアップファイルを削除
python ツール/remove_duplicate_files.py
```

### バッチ操作
```bash
# 全デプロイバージョンを更新
python ツール/update_all_deployment_versions.py

# 特定のデプロイメントをバッチ更新
python ツール/batch_update_deployments.py --filter "Appsheet_通話"

# 全プロジェクトのドキュメント生成
python ツール/generate_all_documentation.py
```

## 重要なファイルパス

- **ログフォルダーID**: `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX`
- **Gemini APIキー**: 各プロジェクトの `config.gs` に保存
- **認証トークン**: `token.pickle` (ローカル、gitignore)
- **認証情報**: `credentials.json` (ローカル、gitignore)
- **デプロイ履歴**: `deployment_versions.json` (git追跡)

## 過去の失敗例と教訓（重要）

### 🔴 致命的な失敗例1: API呼び出しリトライループ爆発

**発生日**: 2025-10-18
**影響**: 1日あたり200,000+ API呼び出し、90%エラー率、無料枠枯渇

**原因:**
```javascript
// ❌ 危険なパターン（絶対に使用しない）
function callAPIWithRetry(params) {
  const maxRetries = 2;  // 初回 + 2回リトライ = 合計3回
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return callAPI(params);
    } catch (error) {
      if (attempt < maxRetries) {
        Utilities.sleep(30000);  // 30秒待機
        continue;  // リトライ
      }
      throw error;
    }
  }
}
```

**問題点:**
1. **ネストされたリトライ**: 複数のレイヤーでリトライが発生（doPost → processRequest → callAPI）
2. **エラーの伝播不足**: エラーが上位層に伝播せず、各層で個別にリトライ
3. **指数的増加**: 3層 × 3回リトライ = 最大27回のAPI呼び出し

**修正方法:**
```javascript
// ✅ 正しいパターン（1回のみ実行）
function callAPI(params) {
  // リトライループを完全削除
  incrementApiCallCounter('Vertex_AI', '処理名（1回のみ）');
  return callAPIInternal(params);  // 1回のみ
}
```

**結果:**
- API呼び出し: 200,000+/日 → <100/日（99.95%削減）
- Google AI Studio無料枠エラー: 完全解消
- 月額コスト削減: 数千円〜数万円

**教訓:**
- ✅ **リトライは最上位層でのみ実装**: `DuplicationPrevention.executeWithRetry()` を使用
- ✅ **API呼び出しは常に1回のみ**: エラー時は即座に上位層に伝播
- ✅ **ネストされたリトライ禁止**: 指数的増加のリスク

**参考ファイル:**
- [Appsheet_訪問看護_通常記録/CLAUDE.md](gas_projects/projects/nursing/Appsheet_訪問看護_通常記録/CLAUDE.md) - 詳細な修正履歴

---

### 🟡 重要な失敗例2: Google AI Studio API vs Vertex AI の混在

**発生期間**: 2025-09-01 〜 2025-10-15
**影響**: 無料枠制限、認証エラー、コスト管理の複雑化

**原因:**
- プロジェクト間でGoogle AI Studio API（旧Gemini API）とVertex AIが混在
- APIキー認証とOAuth2認証の混在
- 価格体系の違いによるコスト計算の複雑化

**修正方針（2025-10-15完了）:**

**全プロジェクトでVertex AI統一:**

```javascript
// ❌ 旧パターン（Google AI Studio API）
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

// ✅ 新パターン（Vertex AI）
const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
const headers = { 'Authorization': `Bearer ${ScriptApp.getOAuthToken()}` };
```

**必須スコープ（appsscript.json）:**

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/cloud-platform"
  ]
}
```

**教訓:**
- ✅ **全プロジェクトでVertex AI使用**: Google AI Studio API完全廃止
- ✅ **OAuth2認証統一**: `ScriptApp.getOAuthToken()` のみ使用
- ✅ **GCPプロジェクト統一**: コスト管理の簡素化

**移行状況:**
- 通話_要約生成: ✅ 完了（2025-10-12）
- 通話_質疑応答: ✅ 完了（2025-10-15）
- 利用者_質疑応答: ✅ 完了（2025-10-10）
- 訪問看護_通常記録: ✅ 完了（2025-10-18）
- その他全プロジェクト: ✅ 完了（2025-10-15）

---

### 🟡 失敗例3: 共通モジュールのコピー&ペースト管理

**発生期間**: 2024-01-01 〜 現在（未解決）
**影響**: バージョンの乱立、一元的な更新困難、デバッグの複雑化

**原因:**
- `logger.gs`, `duplication_prevention.gs`, `gemini_client.gs` を各プロジェクトにコピー
- 各プロジェクトで微妙に異なるバージョンが存在
- 中央管理されていないため、バグ修正が全プロジェクトに伝播しない

**現状:**
- `logger.gs`: 各プロジェクトに複製（6ファイル以上）
- `duplication_prevention.gs`: 各プロジェクトに複製（7ファイル以上）
- `gemini_client.gs`: 各プロジェクトに複製（異なるバージョン）

**検討中の解決策:**
1. **GAS共有ライブラリ化** - Google Apps Scriptのライブラリ機能を使用
2. **中央リポジトリ管理** - `common_modules/` から自動デプロイ
3. **バージョン管理の厳格化** - セマンティックバージョニング導入

**暫定対応:**
- 各プロジェクトのドキュメントに「共通モジュールのバージョン」を記載
- 重要なバグ修正は全プロジェクトに手動反映
- デプロイ前に`common_modules/`との差分チェック

**教訓:**
- ⚠️ **共通コードのコピー&ペーストは避ける**: バージョン管理が困難
- ⚠️ **ライブラリ化の検討**: GAS共有ライブラリまたはnpmパッケージ化
- ⚠️ **自動デプロイの強化**: `deploy_unified.py` で共通モジュールの同期

---

### 🟢 軽微な失敗例4: doPost関数パターンの乱立

**発生期間**: 2024-01-01 〜 現在（改善中）
**影響**: コードの一貫性低下、新規メンバーの学習コスト増加

**原因:**
- プロジェクトごとに異なるdoPost実装パターン（3パターン並存）
- 標準パターンの明確なドキュメントがなかった
- プロジェクト間でのコードレビューが不十分

**対応策:**
- **パターン1（CommonWebhook）を標準として推奨** - CLAUDE.mdに明記
- 新規プロジェクトは必ずパターン1を使用
- 既存プロジェクトは段階的に移行（強制はしない）

**教訓:**
- ✅ **標準パターンの明確化**: CLAUDE.mdに実装テンプレートを記載
- ✅ **段階的な統一**: 既存プロジェクトは無理に変更しない
- ✅ **ドキュメントの充実**: 各パターンの利点・欠点を明記

---

## よくある問題と解決策

### 問題: "Read-only deployment" エラー

**解決策**: @HEADデプロイメントは設計上読み取り専用。`deploy_unified.py` を使用すれば自動的にスキップされる。

### 問題: 重複リクエストが検出されない

**解決策**: リクエストペイロードが安定していることを確認（タイムスタンプ/ランダム値なし）。ハッシュ生成には静的フィールドのみ使用。

### 問題: 実行ログが表示されない

**解決策**: [config.gs](gas_projects/*/scripts/config.gs) の `LOGGER_CONFIG.logFolderId` が `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX` と一致することを確認。

### 問題: APIクォータ超過

**解決策**: Vertex AIクォータはGCPコンソールで確認。リクエストのスロットリングを実装するか、Flashモデルに切り替え。

### 問題: 共通モジュールのバージョン不一致

**解決策**:
1. `common_modules/` ディレクトリのファイルを最新版として扱う
2. 各プロジェクトの共通モジュールは `common_modules/` からコピー
3. `deploy_unified.py` 実行前に差分チェック

## コード変更時の注意点（重要）

### 変更前の確認事項

1. **プロジェクトドキュメントを先に読む**
   - `README.md`: プロジェクトの目的と概要
   - `SPECIFICATIONS.md`: 技術仕様とAPIエンドポイント
   - `FLOW.md`: 実行フローと状態遷移
   - `CLAUDE.md`（プロジェクト固有）: 過去の失敗例と教訓

2. **過去の失敗例を確認**
   - このCLAUDE.mdの「過去の失敗例と教訓」セクションを必読
   - プロジェクト固有のCLAUDE.mdも確認（特に看護記録系）
   - 同じ過ちを繰り返さない

3. **共通モジュールのバージョン確認**
   - `common_modules/` ディレクトリの最新版を確認
   - 各プロジェクトの共通モジュールとの差分を確認
   - バージョン不一致がある場合は最新版をコピー

### 実装時の注意点

4. **禁止パターンの厳守**
   - ❌ **API呼び出しのリトライループ**: 絶対に実装しない（1回のみ実行）
   - ❌ **ネストされたリトライ**: 複数層でのリトライ禁止
   - ❌ **Google AI Studio API**: Vertex AI完全移行済み、使用禁止
   - ❌ **APIキー認証**: OAuth2認証のみ使用

5. **推奨パターンの使用**
   - ✅ **doPost関数**: パターン1（CommonWebhook）を使用
   - ✅ **ロガー**: `createLogger()` + `finally`句で保存
   - ✅ **重複防止**: `DuplicationPrevention.executeWithRetry()`
   - ✅ **Vertex AI**: OAuth2認証 + usageMetadata記録

6. **ローカルでテスト**
   - GASエディタで `test_functions.gs` を実行
   - テスト関数を作成してWebhookをトリガーせずに動作確認
   - エラーハンドリングの動作を確認

### 変更後の作業

7. **ドキュメントの更新**
   - ロジックフロー変更時: `FLOW.md` を修正
   - APIコントラクト変更時: `SPECIFICATIONS.md` を修正
   - 破壊的変更がある場合: `MIGRATION_GUIDE.md` を作成

8. **段階的デプロイ**
   - まず1プロジェクトでテスト（`deploy_unified.py`）
   - 実行ログで動作確認（スプレッドシートID: `16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA`）
   - 問題なければバッチデプロイ（`--dry-run` → 本番）

9. **デプロイ後の確認**
   - 実行ログスプレッドシートをモニタリング
   - エラーステータスの確認
   - API使用量とコストの確認
   - 24時間以内に異常がないか確認

### 新機能開発時の注意点

10. **計画フェーズ**
    - 類似プロジェクトを参照（実装パターンを再利用）
    - 共通モジュールで対応可能か検討
    - 新しいAPI呼び出しパターンを避ける（既存パターンを使用）

11. **実装フェーズ**
    - 標準テンプレートを使用（CLAUDE.mdの「標準doPost実装テンプレート」）
    - エラーハンドリングを必ず実装
    - ログ記録を必ず実装（finally句）

12. **テストフェーズ**
    - ローカルテスト → 1プロジェクトデプロイ → バッチデプロイ
    - 実行ログで動作確認
    - エッジケースのテスト（エラー時、タイムアウト時など）

## 追加リソース

- 日本語ドキュメント: `docs/ja/` (メインドキュメント言語)
- API仕様: `docs/ja/API仕様書.md`
- GAS取得: `docs/ja/GAS取得仕様.md`
- Geminiモデル: `docs/ja/Geminiモデル仕様.md`
- データモデル: `docs/ja/データモデル.md`
- サービスクラス: `docs/ja/サービスクラス.md`
- 新規GASの作成先はフォルダーID（16swPUizvdlyPxUjbDpVl9-VBDJZO91kX）にすること。

## Claude Code設定ファイル

### 設定ファイルの階層

1. `.claude/settings.json` - プロジェクト共有設定（Git管理対象）
2. `.claude/settings.local.json` - 個人用設定（Git除外）
3. `.claudeignore` - Claude Codeがアクセスすべきでないファイル

### カスタムコマンド

`.claude/commands/` ディレクトリに配置されたMarkdownファイルは、`/コマンド名` でアクセス可能なカスタムコマンドとして利用できます。

### ファイル参照のベストプラクティス

- ファイル参照は必ずマークダウンリンク形式を使用: `[filename.gs](path/to/filename.gs)`
- 特定行の参照: `[filename.gs:42](path/to/filename.gs#L42)`
- 行範囲の参照: `[filename.gs:42-51](path/to/filename.gs#L42-L51)`