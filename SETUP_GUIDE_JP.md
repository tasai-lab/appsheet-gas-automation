# Google Apps Script Retriever - セットアップガイド

## プロジェクト情報
- **Google Cloud Project ID**: `macro-shadow-458705-v8`
- **有効化済みAPI**:
  - Google Drive API ✓
  - Google Apps Script API ✓
  - Google Sheets API ✓

## セットアップ手順

### 1. OAuth 2.0 認証情報の作成

#### オプションA: Google Cloud Consoleを使用（推奨）

1. 以下のURLにアクセス:
   ```
   https://console.cloud.google.com/apis/credentials?project=macro-shadow-458705-v8
   ```

2. **OAuth同意画面の設定**（初回のみ）:
   - 左メニューから「OAuth同意画面」をクリック
   - User Type: **外部** を選択
   - アプリ名: `GAS Retriever`
   - ユーザーサポートメール: 自分のメールアドレス
   - 開発者の連絡先情報: 自分のメールアドレス
   - 「保存して次へ」をクリック
   - スコープページ:
     - 「スコープを追加または削除」をクリック
     - 以下を追加:
       - `.../auth/drive.readonly`
       - `.../auth/script.projects.readonly`
       - `.../auth/spreadsheets.readonly`
   - テストユーザー: 自分のGmailアドレスを追加
   - 「保存して次へ」で完了

3. **OAuth クライアントIDの作成**:
   - 「認証情報」タブに戻る
   - 「認証情報を作成」→「OAuth クライアントID」をクリック
   - アプリケーションの種類: **デスクトップアプリ**
   - 名前: `GAS Retriever Desktop Client`
   - 「作成」をクリック
   - **JSONをダウンロード**ボタンをクリック
   - ダウンロードしたファイルを `credentials.json` にリネーム
   - このディレクトリ（`C:\tools\python\code\all-gas\`）に配置

#### オプションB: gcloud CLIを使用

```bash
# OAuth同意画面を手動で設定後、以下を実行
gcloud alpha iap oauth-brands create \
    --application_title="GAS Retriever" \
    --support_email=YOUR_EMAIL@gmail.com \
    --project=macro-shadow-458705-v8
```

### 2. 依存パッケージのインストール

```bash
pip install -r requirements.txt
```

または Windows の場合:
```bash
setup.bat
```

### 3. スクリプトの実行

```bash
python gas_retriever.py
```

初回実行時:
- ブラウザが自動的に開きます
- Googleアカウントでログイン
- アプリの権限リクエストを承認
- 認証情報が `token.pickle` に保存されます（次回から不要）

### 4. 出力の確認

スクリプトが完了すると、`gas_projects/` ディレクトリに以下の構造でファイルが保存されます:

```
gas_projects/
├── [GASプロジェクト名1]/
│   ├── README.md
│   ├── project_metadata.json
│   ├── appsscript.json
│   ├── scripts/
│   │   ├── Code.gs
│   │   └── ...
│   └── spreadsheets/
│       └── [スプレッドシート名]_metadata.json
├── [GASプロジェクト名2]/
│   └── ...
└── ...
```

## トラブルシューティング

### 「credentials.json not found」エラー

**原因**: OAuth認証情報ファイルが見つからない

**解決策**:
1. Google Cloud Consoleから credentials.json をダウンロード
2. ファイル名が正確に `credentials.json` であることを確認
3. `C:\tools\python\code\all-gas\` ディレクトリに配置

### 「API not enabled」エラー

**原因**: 必要なAPIが有効化されていない

**解決策**:
```bash
gcloud services enable drive.googleapis.com script.googleapis.com sheets.googleapis.com --project=macro-shadow-458705-v8
```

### 「Access denied」エラー

**原因**: OAuth同意画面でテストユーザーが追加されていない

**解決策**:
1. https://console.cloud.google.com/apis/credentials/consent?project=macro-shadow-458705-v8
2. 「テストユーザー」セクションで使用するGmailアドレスを追加

### 「No files found」エラー

**原因**: 
- フォルダーIDが間違っている
- フォルダーにアクセス権がない
- "Appsheet"を含むGASファイルが存在しない

**解決策**:
1. フォルダーIDを確認: `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX`
2. 認証したGoogleアカウントでフォルダーにアクセスできることを確認
3. フォルダー内に"Appsheet"を含む名前のGASファイルが存在することを確認

## セキュリティ上の注意

⚠️ **重要**: 以下のファイルは絶対にGitにコミットしないでください:
- `credentials.json` - OAuth クライアント認証情報
- `token.pickle` - アクセストークン

これらは `.gitignore` に既に追加されています。

## サポート

問題が発生した場合:
1. README.md の詳細な手順を確認
2. エラーメッセージを確認
3. Google Cloud Console でプロジェクト設定を確認

## 参考リンク

- [Google Cloud Console - プロジェクト](https://console.cloud.google.com/home/dashboard?project=macro-shadow-458705-v8)
- [API認証情報](https://console.cloud.google.com/apis/credentials?project=macro-shadow-458705-v8)
- [OAuth同意画面](https://console.cloud.google.com/apis/credentials/consent?project=macro-shadow-458705-v8)
- [有効なAPI](https://console.cloud.google.com/apis/dashboard?project=macro-shadow-458705-v8)
