# Automation_統合管理

レシート処理と名刺取り込みの統合管理Webアプリケーション

**Script ID:** 13fAIBhJw6HrhQSzgIOrZNwBhrrcK2A0w_4F2F8scr6Z-3p4W3GvKJju5

## 概要

このプロジェクトは、レシート処理（個人・法人）と名刺取り込みを1つのWebインターフェースから実行できる統合管理アプリケーションです。

### 主な機能

1. **レシート処理（個人）** - 個人用レシートの自動OCR・データ抽出・スプレッドシート記録
2. **レシート処理（法人）** - 法人用レシートの自動OCR・データ抽出・スプレッドシート記録
3. **名刺取り込み** - 名刺画像からのOCR・AppSheet連携
4. **リアルタイムログ表示** - 処理中の進捗をリアルタイムで確認
5. **コスト表示** - 処理完了後のトークン数とコスト（USD/JPY）を表示

## セットアップ

### 1. ライブラリの設定確認

このプロジェクトは以下のライブラリを使用しています（自動で読み込まれます）：

- **ReceiptLib** - Automation_レシート（個人・法人レシート処理）
- **BusinessCardLib** - Appsheet_名刺取り込み

各ライブラリのScript Propertiesは、それぞれのプロジェクトで設定してください。

### 2. ライブラリ動作確認（オプション）

GASエディタで`config.gs`の`testLibraryCall()`関数を実行し、ライブラリが正しく読み込まれているか確認できます。

### 3. Webアプリとしてデプロイ

1. GASエディタで「デプロイ」→「新しいデプロイ」を選択
2. 種類: Webアプリ
3. 次のユーザーとして実行: 自分
4. アクセスできるユーザー: 全員
5. デプロイをクリック

### 3. WebアプリURLにアクセス

デプロイ後に表示されるURLにアクセスすると、統合管理画面が表示されます。

## 使用方法

### レシート処理（個人）

1. Webアプリで「📄 レシート処理（個人）」ボタンをクリック
2. リアルタイムログで処理進捗を確認
3. 処理完了後、コスト情報が表示されます

### レシート処理（法人）

1. Webアプリで「🏢 レシート処理（法人）」ボタンをクリック
2. リアルタイムログで処理進捗を確認
3. 処理完了後、コスト情報が表示されます

### 名刺取り込み

1. Webアプリで「👤 名刺取り込み」ボタンをクリック
2. リアルタイムログで処理進捗を確認
3. 処理完了後、コスト情報が表示されます

## ファイル構成

```
scripts/
├── index.html              # Webインターフェース（UI）
├── web_app.gs             # メイン処理・doGet関数
├── process_adapters.gs    # レシート・名刺処理のアダプター
├── config.gs              # 設定ファイル
├── appsscript.json        # GASマニフェスト
└── .clasp.json            # Clasp設定
```

## 技術仕様

### 使用API

- **Vertex AI Gemini 2.5 Flash Lite** - OCR・データ抽出
- **Google Drive API** - ファイル操作
- **Google Sheets API** - データ記録（レシート）
- **AppSheet API** - データ登録（名刺）

### コスト計算

- Input Tokens × $0.075 / 1M
- Output Tokens × $0.30 / 1M
- 為替レート: 1 USD = 150 JPY

### OAuth Scopes

- `spreadsheets` - スプレッドシート操作
- `drive` - ドライブファイル操作
- `script.external_request` - 外部API呼び出し
- `cloud-platform` - Vertex AI使用
- `userinfo.email` - ユーザー情報取得

## トラブルシューティング

### エラー: ライブラリが読み込めません

**原因**: ライブラリの設定が正しくない

**解決策**:
1. `config.gs`の`testLibraryCall()`を実行してライブラリの読み込み状態を確認
2. `appsscript.json`のライブラリ設定を確認
3. 開発モードがtrueになっていることを確認

### エラー: レシート/名刺処理のScript Propertiesが未設定

**原因**: ライブラリ側（Automation_レシート、Appsheet_名刺取り込み）のScript Propertiesが未設定

**解決策**: 各ライブラリプロジェクトでScript Propertiesを設定

### エラー: OAuth承認が必要

**原因**: 初回実行時のOAuth承認が必要

**解決策**: GASエディタで任意の関数を実行し、OAuth承認画面で承認

### エラー: Vertex AI APIエラー

**原因**: Vertex AI APIが有効化されていない

**解決策**: GCP コンソールでVertex AI APIを有効化

## デプロイ

### clasp push

```bash
cd projects/automation/Automation_統合管理/scripts
clasp push
```

### clasp deploy

```bash
clasp deploy --description "v1: 初回デプロイ"
```

## バージョン履歴

- **v2.0.0** (2025-10-23): ライブラリ統合版
  - ライブラリを使用した既存プロジェクトの呼び出し
  - ReceiptLib（Automation_レシート）統合
  - BusinessCardLib（Appsheet_名刺取り込み）統合
  - コードの重複を排除

- **v1.0.0** (2025-10-23): 初回リリース
  - レシート処理（個人・法人）
  - 名刺取り込み
  - Webインターフェース
  - リアルタイムログ表示
  - コスト表示機能

## 作成者

Fractal Group

## ライセンス

Proprietary
