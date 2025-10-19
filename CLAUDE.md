# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

### doPost関数パターン
全てのWebhookハンドラーは以下の構造に従う:
```javascript
function doPost(e) {
  const logger = createLogger('ScriptName');
  let recordId = null;
  let status = '成功';

  try {
    const params = JSON.parse(e.postData.contents);
    recordId = params.record_id;

    // 重複チェック
    const dupPrevention = createDuplicationPrevention('ScriptName');
    const result = dupPrevention.executeWithRetry(recordId, (id) => {
      return processRequest(params); // 実際のビジネスロジック
    }, logger);

    if (result.isDuplicate) {
      status = '重複';
      return ContentService.createTextOutput('重複実行').setMimeType(ContentService.MimeType.TEXT);
    }

    logger.success('処理完了');
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    status = 'エラー';
    logger.error(`処理エラー: ${error.toString()}`, { stack: error.stack });
    return ContentService.createTextOutput('ERROR').setMimeType(ContentService.MimeType.TEXT);

  } finally {
    logger.saveToSpreadsheet(status, recordId);
  }
}

// テスト可能なビジネスロジック関数
function processRequest(params) {
  // 実装
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

## よくある問題と解決策

### 問題: "Read-only deployment" エラー
**解決策**: @HEADデプロイメントは設計上読み取り専用。`deploy_unified.py` を使用すれば自動的にスキップされる。

### 問題: 重複リクエストが検出されない
**解決策**: リクエストペイロードが安定していることを確認（タイムスタンプ/ランダム値なし）。ハッシュ生成には静的フィールドのみ使用。

### 問題: 実行ログが表示されない
**解決策**: config.gs の `LOGGER_CONFIG.logFolderId` が `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX` と一致することを確認。

### 問題: APIクォータ超過
**解決策**: Vertex AIクォータはGCPコンソールで確認。Gemini APIの場合は、リクエストのスロットリングを実装するか、Flashモデルに切り替え。

## コード変更時の注意点

1. **常にプロジェクトドキュメントを先に読む**: `README.md`, `SPECIFICATIONS.md`, `FLOW.md`
2. **ローカルでテスト**: `test_functions.gs` を使用するか、テスト関数を作成
3. **図の更新**: ロジックフローが変更された場合は `FLOW.md` を修正
4. **仕様の更新**: APIコントラクトが変更された場合は `SPECIFICATIONS.md` を修正
5. **dry-runの使用**: 自動化スクリプトは `--dry-run` フラグでテスト
6. **段階的デプロイ**: バッチデプロイ前に1プロジェクトでテスト
7. **ログの確認**: デプロイ後は実行ログスプレッドシートをモニタリング

## 追加リソース

- 日本語ドキュメント: `docs/ja/` (メインドキュメント言語)
- API仕様: `docs/ja/API仕様書.md`
- GAS取得: `docs/ja/GAS取得仕様.md`
- Geminiモデル: `docs/ja/Geminiモデル仕様.md`
- データモデル: `docs/ja/データモデル.md`
- サービスクラス: `docs/ja/サービスクラス.md`
- 新規GASの作成先はフォルダーID（16swPUizvdlyPxUjbDpVl9-VBDJZO91kX）にすること。