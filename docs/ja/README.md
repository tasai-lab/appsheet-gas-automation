# Google Apps Script 自動化プロジェクト

## プロジェクト概要

Google Driveフォルダー（ID: `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX`）内のGoogle Apps Script（GAS）プロジェクトを管理・最適化するための統合ツールセットです。

### 主な機能

- 📥 GASプロジェクトの自動取得と整理
- 🔄 重複実行の防止機能
- 📊 実行ログの一元管理
- 🤖 Gemini APIによるインテリジェント処理
- 🚀 自動デプロイとバージョン管理

## プロジェクト情報

- **GCPプロジェクトID**: `macro-shadow-458705-v8`
- **対象フォルダーID**: `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX`
- **管理対象**: AppSheet連携スクリプト & Automation系スクリプト

## システム構成

### 管理対象スクリプト（全32プロジェクト）

#### AppSheet連携スクリプト（30プロジェクト）

1. **セキュリティ & データ管理**
   - AppSheetSecureConnector
   - Appsheet_ALL_ファイルID
   - Appsheet_All_ファイル検索＋ID挿入

2. **イベント & コミュニケーション**
   - Appsheet_ALL_Event
   - Appsheet_ALL_スレッド投稿
   - Appsheet_ALL_スレッド更新

3. **利用者管理**
   - Appsheet_利用者_フェースシート
   - Appsheet_利用者_反映
   - Appsheet_利用者_基本情報上書き
   - Appsheet_利用者_家族情報作成
   - Appsheet_利用者_質疑応答

4. **営業支援**
   - Appsheet_名刺取り込み
   - Appsheet_営業_ファイルID取得
   - Appsheet_営業_音声記録
   - Appsheet_営業レポート

5. **訪問看護業務**
   - Appsheet_訪問看護_報告書
   - Appsheet_訪問看護_定期スケジュール
   - Appsheet_訪問看護_書類OCR
   - Appsheet_訪問看護_書類仕分け
   - Appsheet_訪問看護_精神科記録
   - Appsheet_訪問看護_計画書問題点
   - Appsheet_訪問看護_計画書問題点_評価
   - Appsheet_訪問看護_訪問者自動
   - Appsheet_訪問看護_通常記録

6. **通話記録 & タスク管理**
   - Appsheet_通話_イベント作成
   - Appsheet_通話_クエリ
   - Appsheet_通話_スレッド投稿
   - Appsheet_通話_タスク作成
   - Appsheet_通話_ファイルID取得
   - Appsheet_通話_新規依頼作成
   - Appsheet_通話_要約生成

7. **その他**
   - Appsheet_関係機関_作成

#### Automation系スクリプト（2プロジェクト）

- Automation_レシート
- Automation_請求書データ

## 技術仕様

### Gemini APIの使用

#### APIキー統一
- **統一APIキー**: `AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY`
- 全スクリプトで統一されたAPIキーを使用

#### モデル使用方針

**複雑な思考が必要なタスク → `gemini-2.5-pro`**
- 通話の要約生成
- 看護記録の作成
- 質疑応答処理
- 複雑なデータ分析

**シンプルなタスク → `gemini-2.5-flash`**
- データ抽出
- フォーマット変換
- 単純な分類
- テキスト処理

### 重複実行防止機能

Webhook受信時の重複実行を防止するため、以下の機能を実装：

- リクエストIDベースの重複チェック
- タイムスタンプベースの期限切れデータの自動削除
- ScriptPropertiesを使用した軽量な実装

詳細: [重複防止ガイド](./重複防止機能.md)

### 実行ログ管理

全スクリプトの実行履歴を一元管理するスプレッドシートシステム：

- **スプレッドシート名**: GAS実行ログ
- **格納場所**: フォルダーID `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX`
- **記録内容**: 
  - 実行日時
  - スクリプト名
  - ステータス（成功/エラー）
  - エラー詳細
  - 処理時間
  - リクエストデータ

従来のメール送信は廃止され、全てスプレッドシートに記録されます。

詳細: [実行ログ仕様](./実行ログ管理.md)

## セットアップ

### 前提条件

- Python 3.8以上
- Google Cloud Platform アカウント
- 必要なAPIの有効化:
  - Google Drive API
  - Google Apps Script API
  - Google Sheets API

### インストール手順

1. **リポジトリのクローン**
```bash
git clone [repository-url]
cd all-gas
```

2. **依存パッケージのインストール**
```bash
pip install -r requirements.txt
```

3. **認証設定**
```bash
# 認証情報の配置（C:\tools\python\code内に既存）
# credentials.json と token.pickle を確認
```

4. **実行ログスプレッドシートの作成**
```bash
python create_execution_log_spreadsheet.py
```

## 使用方法

### GASプロジェクトの取得

```bash
python gas_retriever.py
```

全てのAppSheet/Automation関連スクリプトを取得し、`gas_projects/` 配下に整理します。

### 全スクリプトの最適化

```bash
python optimize_all_appsheet_scripts.py
```

以下の最適化を実行：
- APIキーの統一化
- モデル名の最適化
- 重複防止機能の追加
- 実行ログ機能の追加
- コードの可読性向上

### デプロイとバージョン管理

```bash
# 全スクリプトのデプロイ
python deploy_all_to_gas.py

# デプロイバージョンの更新
python update_all_deployment_versions.py

# 変更があったスクリプトのみデプロイ
python batch_update_deployments.py
```

## フォルダ構造

```
all-gas/
├── docs/                           # ドキュメント
│   ├── ja/                        # 日本語ドキュメント
│   │   ├── README.md              # このファイル
│   │   ├── Geminiモデル仕様.md    # Geminiモデル情報
│   │   ├── 重複防止機能.md        # 重複防止の詳細
│   │   ├── 実行ログ管理.md        # ログ管理の詳細
│   │   └── デプロイガイド.md      # デプロイ手順
│   └── README.md                   # 英語版ドキュメント（参照用）
│
├── gas_projects/                   # 取得したGASプロジェクト
│   ├── AppSheetSecureConnector/
│   ├── Appsheet_ALL_Event/
│   └── ...                        # 各プロジェクトフォルダ
│
├── src/                            # 共通ライブラリ
│   └── common_modules/            # 共通モジュール
│
├── ツール/                         # Pythonツール
│   ├── gas_retriever.py           # GAS取得ツール
│   ├── optimize_all_appsheet_scripts.py  # 最適化ツール
│   ├── deploy_all_to_gas.py       # デプロイツール
│   └── ...                        # その他ツール
│
├── credentials.json                # Google認証情報
├── token.pickle                    # 認証トークン
├── requirements.txt                # Python依存パッケージ
└── .gitignore                      # Git除外設定
```

## 開発ガイドライン

### コーディング規約

- **命名規則**: キャメルケース（関数）、アッパーキャメルケース（クラス）
- **コメント**: 日本語で記述、複雑なロジックには必ず説明を追加
- **エラーハンドリング**: 必ずtry-catchで例外をキャッチし、ログに記録

### デプロイフロー

1. ローカルでスクリプトを修正
2. 最適化ツールで検証
3. テスト環境でデプロイ
4. 動作確認
5. 本番環境へデプロイ
6. バージョン更新

### Git運用

- **ブランチ戦略**: main（本番）、develop（開発）
- **コミットメッセージ**: 日本語で明確に記述
- **プルリクエスト**: 必ずレビューを実施

## トラブルシューティング

### よくある問題

**認証エラー**
```bash
# トークンを削除して再認証
rm token.pickle
python reauth_with_full_scopes.py
```

**デプロイエラー**
- GCPコンソールでAPIが有効化されているか確認
- スクリプトの権限設定を確認
- 実行ログスプレッドシートでエラー詳細を確認

**重複実行の問題**
- ScriptPropertiesの容量制限を確認（9KBまで）
- 古いデータが自動削除されているか確認

## セキュリティ

### 認証情報の管理

- `credentials.json`、`token.pickle`は**絶対にコミットしない**
- APIキーはGASのスクリプトプロパティに保存（ハードコード禁止）
- 定期的なAPIキーのローテーション

### アクセス制御

- 必要最小限のスコープのみ要求
- サービスアカウントの適切な権限設定
- 実行ログで異常なアクセスを監視

## ライセンス

MIT License

## 更新履歴

### 2025-10-16
- 実行ログ管理機能の実装
- メール送信の廃止
- 重複防止機能の実装
- APIキーの統一化
- Geminiモデルの最適化
- ドキュメントの日本語化と統合

## サポート

問題が発生した場合：
1. 実行ログスプレッドシートでエラー詳細を確認
2. ドキュメントのトラブルシューティングセクションを参照
3. 必要に応じて開発チームに連絡
