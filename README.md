# Google Apps Script 自動化プロジェクト

Google Drive上のGoogle Apps Script (GAS)プロジェクトを管理するためのプロフェッショナルな自動化ツールキット

## クイックリンク

- 📚 **[日本語ドキュメント（メイン）](docs/ja/README.md)** - プロジェクト全体の詳細
- 🤖 **[Geminiモデル仕様](docs/ja/Geminiモデル仕様.md)** - API使用ガイド
- 🔒 **[重複防止機能](docs/ja/重複防止機能.md)** - Webhook重複対策
- 📊 **[実行ログ管理](docs/ja/実行ログ管理.md)** - ログシステム
- 🚀 **[デプロイガイド](docs/ja/デプロイガイド.md)** - デプロイ手順

## プロジェクト概要

このツールキットは、AppSheet統合と自動化のための32個のGoogle Apps Scriptプロジェクトを管理します：
- 30個のAppSheet統合スクリプト
- 2個の自動化スクリプト（レシート・請求書処理）
- 一元化された実行ログ記録
- 重複リクエスト防止機能
- Gemini API最適化

## 主要機能

- 🔄 **自動GAS取得** - Google Driveから全スクリプトをダウンロード・整理
- 🛡️ **重複防止** - Webhook実行の重複を防止
- 📊 **一元化ログ** - 単一スプレッドシートで全実行を追跡
- 🤖 **Gemini API統合** - 最適化されたモデル選択と使用
- 🚀 **自動デプロイ** - デプロイとバージョン管理ツール

## クイックスタート

```bash
# 依存関係のインストール
pip install -r requirements.txt

# 全GASプロジェクトの取得
python retrieve_gas.py

# GASへのデプロイ
python ツール/deploy_all_to_gas.py
```

## ツールスクリプトの使い方

### 1. GASプロジェクト取得 (retrieve_gas.py)
Google DriveからGASプロジェクトを取得します。

```bash
# 基本使用法
python retrieve_gas.py

# オプション指定
python retrieve_gas.py --folder-id YOUR_FOLDER_ID --filter "Appsheet" --verbose

# 利用可能な引数
# --folder-id: 検索するGoogle DriveフォルダID
# --filter: プロジェクト名フィルター（部分一致）
# --no-recursive: サブフォルダを検索しない
# --output-dir: 出力先ディレクトリ
# --verbose, -v: 詳細ログを表示
# --clear-cache: 認証キャッシュをクリア
```

### 2. 一括デプロイ (ツール/deploy_all_to_gas.py)
すべてのGASプロジェクトをGoogle Apps Scriptにデプロイします。
**自動的にバージョン管理が行われます**（deployment_versions.jsonに記録）

```bash
# 基本使用法
python ツール/deploy_all_to_gas.py

# オプション指定
python ツール/deploy_all_to_gas.py --filter "Appsheet_通話" --description "バグ修正" --verbose

# 利用可能な引数
# --projects-dir: GASプロジェクトディレクトリ (デフォルト: gas_projects)
# --description: デプロイメントの説明
# --filter: プロジェクト名フィルター（部分一致）
# --credentials: 認証情報ファイルパス
# --token: トークンファイルパス
# --verbose, -v: 詳細ログを表示
```

#### バージョン管理機能
デプロイ時に以下の情報が自動的に記録されます：
- バージョン番号
- デプロイ日時
- デプロイ説明
- ステータス（成功/失敗）
- スクリプトID

### 2-1. デプロイ履歴の確認 (ツール/show_deployment_history.py)
プロジェクトのデプロイ履歴を表示します。

```bash
# 全プロジェクトの履歴を表示
python ツール/show_deployment_history.py

# 特定プロジェクトの詳細履歴
python ツール/show_deployment_history.py --project "Appsheet_通話_要約生成"

# 表示件数を指定
python ツール/show_deployment_history.py --project "Appsheet_通話_要約生成" --limit 10

# 利用可能な引数
# --project, -p: 特定プロジェクトの履歴を表示
# --limit, -l: 表示する履歴の件数 (デフォルト: 5)
# --file, -f: バージョン履歴ファイル (デフォルト: deployment_versions.json)
```

### 3. スクリプト最適化 (ツール/optimize_all_appsheet_scripts.py)
AppSheet GASスクリプトを最適化します（重複防止、ログ記録、モデル選択など）。

```bash
# 基本使用法
python ツール/optimize_all_appsheet_scripts.py

# オプション指定
python ツール/optimize_all_appsheet_scripts.py \
  --spreadsheet-id YOUR_SPREADSHEET_ID \
  --api-key YOUR_API_KEY \
  --flash-model gemini-2.5-flash \
  --pro-model gemini-2.5-pro \
  --filter "Appsheet_通話" \
  --verbose

# 利用可能な引数
# --projects-dir: GASプロジェクトディレクトリ (デフォルト: gas_projects)
# --spreadsheet-id: 実行ログスプレッドシートID
# --api-key: Gemini API キー
# --flash-model: Flashモデル名 (デフォルト: gemini-2.5-flash)
# --pro-model: Proモデル名 (デフォルト: gemini-2.5-pro)
# --filter: プロジェクト名フィルター（部分一致）
# --verbose, -v: 詳細ログを表示
```

### 4. ログ記録機能追加 (ツール/update_all_scripts_with_logging.py)
全GASスクリプトにログ記録機能を追加します。

```bash
# 基本使用法
python ツール/update_all_scripts_with_logging.py

# オプション指定
python ツール/update_all_scripts_with_logging.py \
  --api-key YOUR_API_KEY \
  --flash-model gemini-2.5-flash \
  --pro-model gemini-2.5-pro \
  --filter "Appsheet" \
  --verbose

# 利用可能な引数
# --projects-dir: GASプロジェクトディレクトリ (デフォルト: gas_projects)
# --common-modules-dir: 共通モジュールディレクトリ (デフォルト: common_modules)
# --api-key: Gemini API キー
# --flash-model: Flashモデル名 (デフォルト: gemini-2.5-flash)
# --pro-model: Proモデル名 (デフォルト: gemini-2.5-pro)
# --filter: プロジェクト名フィルター（部分一致）
# --verbose, -v: 詳細ログを表示
```

### 5. 重複防止機能適用 (ツール/apply_dedup.py)
GASプロジェクトに重複防止ライブラリを適用します。

```bash
# 基本使用法
python ツール/apply_dedup.py

# オプション指定
python ツール/apply_dedup.py --dry-run --verbose

# 利用可能な引数
# --projects-dir: GASプロジェクトディレクトリ (デフォルト: gas_projects)
# --library-file: 重複防止ライブラリファイル
# --dry-run: 実際の変更を行わず、実行内容を表示
# --verbose, -v: 詳細ログを表示
```

### 6. doPost関数のリファクタリング (ツール/refactor_dopost_to_args.py)
doPost関数を引数ベース関数に分離し、テスト実行を容易にします。

```bash
# 基本使用法（全プロジェクトに適用）
python ツール/refactor_dopost_to_args.py

# 特定のプロジェクトのみ
python ツール/refactor_dopost_to_args.py --filter "Appsheet_通話"

# ドライラン（実際の変更なし）
python ツール/refactor_dopost_to_args.py --dry-run --verbose

# 利用可能な引数
# --projects-dir: GASプロジェクトディレクトリ (デフォルト: gas_projects)
# --filter: プロジェクト名フィルター（部分一致）
# --dry-run: 実際の変更を行わず、実行内容を表示
# --backup: 変更前にバックアップを作成（デフォルト: True）
# --verbose, -v: 詳細ログを表示
```

#### リファクタリング後の構造

変更前:
```javascript
function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  // 処理ロジック...
}
```

変更後:
```javascript
// Webhook エントリーポイント（AppSheet互換性維持）
function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  return processRequest(params);
}

// 引数ベースのメイン処理（テスト・手動実行可能）
function processRequest(params) {
  // 処理ロジック...
  return result;
}

// テスト関数（GASエディタから直接実行可能）
function testProcessRequest() {
  const testParams = { /* テストデータ */ };
  const result = processRequest(testParams);
  console.log(result);
}
```

#### メリット

- ✅ **AppSheet互換性維持**: doPost関数は変更不要
- ✅ **テスト容易性**: GASエディタから直接テスト可能
- ✅ **手動実行可能**: 引数を渡して個別に実行
- ✅ **デバッグ簡単**: Webhookなしでテスト実行

## Geminiモデル選択

プロジェクトの複雑度とユースケースに応じて、適切なAPIとモデルが使用されます：

### Vertex AI統一プロジェクト（通話関連）
**GCP統合によるセキュアな処理**
- **Appsheet_通話_要約生成** - 音声解析（gemini-2.5-flash）+ 依頼作成（flash + 思考モード）
- **Appsheet_通話_質疑応答** - ユーザー選択（Pro/Flash + 思考モード）

### Gemini API使用プロジェクト（その他）
- **gemini-2.5-flash**: 高速処理が必要な軽量タスク（デフォルト）
- **gemini-2.5-pro**: 複雑な思考が必要なタスク
  - Appsheet_訪問看護_通常記録
  - Appsheet_訪問看護_精神科記録
  - Appsheet_訪問看護_報告書
  - Appsheet_利用者_質疑応答
  - Appsheet_営業レポート
  - その他、複雑なAI処理を含むプロジェクト

## ドキュメント

全てのドキュメントは `docs/ja/` 配下に日本語で管理されています：

- **README.md** - プロジェクト全体のドキュメント
- **Geminiモデル仕様.md** - Gemini API仕様
- **重複防止機能.md** - 重複防止システム
- **実行ログ管理.md** - 実行ログシステム  
- **デプロイガイド.md** - デプロイ手順

## プロジェクト構成

```
all-gas/
├── docs/ja/              # 日本語ドキュメント（メイン）
├── gas_projects/         # 取得したGASプロジェクト（32プロジェクト）
├── src/                  # 共通ライブラリ
├── ツール/                # Python自動化ツール
│   ├── gas_retriever.py
│   ├── optimize_all_appsheet_scripts.py
│   └── deploy_all_to_gas.py
├── credentials.json      # Google OAuth認証情報
└── requirements.txt      # Python依存関係
```

## License

MIT License
