# ツール一覧

このディレクトリには、Google Apps Script管理のための各種Pythonツールが含まれています。

## 取得・管理ツール

### gas_retriever.py
**機能**: Google DriveからGASプロジェクトを取得

**使用方法**:
```bash
python gas_retriever.py
```

**説明**:
- フォルダーID `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX` から全GASプロジェクトを取得
- "Appsheet"または"Automation"を含むプロジェクトを対象
- `gas_projects/` 配下に各プロジェクトを整理して保存

---

## 最適化ツール

### optimize_all_appsheet_scripts.py
**機能**: 全スクリプトの最適化

**使用方法**:
```bash
python optimize_all_appsheet_scripts.py
```

**最適化内容**:
- APIキーの統一（`AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY`）
- Geminiモデルの最適化（Flash vs Thinking）
- 重複防止機能の追加
- 実行ログ機能の追加
- コードの可読性向上

### optimize_gemini.py
**機能**: Gemini APIの最適化のみ実行

**使用方法**:
```bash
python optimize_gemini.py
```

**説明**:
- APIキーとモデル名のみ更新
- 他の変更は行わない

---

## デプロイツール

### deploy_all_to_gas.py
**機能**: 全スクリプトをGASにデプロイ

**使用方法**:
```bash
python deploy_all_to_gas.py
```

**説明**:
- `gas_projects/` 内の全プロジェクトをGASにアップロード
- 既存のプロジェクトIDを使用して更新

### deploy_all_with_clasp.py
**機能**: claspを使用したデプロイ（代替方法）

**使用方法**:
```bash
python deploy_all_with_clasp.py
```

**説明**:
- clasp CLIツールを使用したデプロイ
- より高度な制御が可能

### batch_update_deployments.py
**機能**: 変更があったスクリプトのみデプロイ

**使用方法**:
```bash
python batch_update_deployments.py
```

**説明**:
- Gitの変更を検出
- 変更されたプロジェクトのみデプロイ
- 効率的なデプロイが可能

### batch_update_all_deployments.py
**機能**: 全デプロイの一括更新

**使用方法**:
```bash
python batch_update_all_deployments.py
```

---

## バージョン管理ツール

### update_all_deployment_versions.py
**機能**: 全デプロイのバージョンを更新

**使用方法**:
```bash
python update_all_deployment_versions.py
```

**説明**:
- 既存のデプロイのバージョンを新しくする
- デプロイURLは変わらない

### update_deployment_version.py
**機能**: 個別デプロイのバージョン更新

**使用方法**:
```bash
python update_deployment_version.py --project <プロジェクト名>
```

---

## ログ管理ツール

### create_execution_log_spreadsheet.py
**機能**: 実行ログスプレッドシートの作成

**使用方法**:
```bash
python create_execution_log_spreadsheet.py
```

**説明**:
- フォルダーID `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX` に作成
- 実行ログ、エラー詳細、統計の3シートを作成
- スプレッドシートIDを保存

### create_execution_log_sheet_simple.py
**機能**: シンプルなログシート作成

**使用方法**:
```bash
python create_execution_log_sheet_simple.py
```

### create_execution_log_sheet_info.py
**機能**: 詳細情報付きログシート作成

**使用方法**:
```bash
python create_execution_log_sheet_info.py
```

### check_execution_log_sheet.py
**機能**: 実行ログの確認

**使用方法**:
```bash
python check_execution_log_sheet.py
```

**説明**:
- 最新のログエントリを表示
- エラー統計を表示
- ログの健全性をチェック

---

## 重複防止ツール

### apply_duplication_prevention.py
**機能**: 重複防止機能を全スクリプトに追加

**使用方法**:
```bash
python apply_duplication_prevention.py
```

**説明**:
- DuplicationPrevention.gsのコードを各プロジェクトに追加
- doPost関数を重複チェック対応に修正

### apply_dedup.py
**機能**: 重複防止の簡易適用

**使用方法**:
```bash
python apply_dedup.py
```

---

## 認証ツール

### reauth_with_full_scopes.py
**機能**: 完全なスコープで再認証

**使用方法**:
```bash
python reauth_with_full_scopes.py
```

**説明**:
- 全ての必要なスコープを含めて再認証
- token.pickleを更新

### reauth_for_deployment.py
**機能**: デプロイ用の再認証

**使用方法**:
```bash
python reauth_for_deployment.py
```

### create_oauth_client.py
**機能**: OAuth クライアントの作成

**使用方法**:
```bash
python create_oauth_client.py
```

### show_account.py
**機能**: 現在の認証アカウントを表示

**使用方法**:
```bash
python show_account.py
```

---

## フォルダー管理ツール

### check_folder.py
**機能**: Google Driveフォルダーの内容確認

**使用方法**:
```bash
python check_folder.py
```

**説明**:
- フォルダー内のファイル一覧を表示
- GASプロジェクトを検出

### verify_folder.py
**機能**: フォルダーアクセスの検証

**使用方法**:
```bash
python verify_folder.py
```

---

## その他ツール

### analyze_migration.py
**機能**: 移行分析

**使用方法**:
```bash
python analyze_migration.py
```

**説明**:
- 既存スクリプトの分析
- 移行計画の生成

### update_all_scripts_with_logging.py
**機能**: ログ機能を全スクリプトに追加

**使用方法**:
```bash
python update_all_scripts_with_logging.py
```

### update_api_model_only.py
**機能**: APIモデルのみ更新

**使用方法**:
```bash
python update_api_model_only.py
```

### generate_all_documentation.py
**機能**: ドキュメント自動生成

**使用方法**:
```bash
python generate_all_documentation.py
```

---

## 推奨ワークフロー

### 初回セットアップ
```bash
# 1. 認証
python reauth_with_full_scopes.py

# 2. GASプロジェクト取得
python gas_retriever.py

# 3. 実行ログスプレッドシート作成
python create_execution_log_spreadsheet.py

# 4. スクリプト最適化
python optimize_all_appsheet_scripts.py

# 5. デプロイ
python deploy_all_to_gas.py
```

### 定期的な更新
```bash
# 1. 最新スクリプトを取得
python gas_retriever.py

# 2. 必要な最適化を実行
python optimize_gemini.py

# 3. 変更があったものだけデプロイ
python batch_update_deployments.py

# 4. バージョン更新
python update_all_deployment_versions.py
```

### トラブルシューティング
```bash
# ログ確認
python check_execution_log_sheet.py

# 認証問題の場合
python reauth_with_full_scopes.py

# フォルダーアクセス確認
python verify_folder.py
```

---

## 注意事項

1. **認証情報**: 初回実行時はブラウザで認証が必要です
2. **スコープ**: 必要なAPIスコープが認証されているか確認してください
3. **レート制限**: Google APIのレート制限に注意してください
4. **バックアップ**: 重要な変更前はバックアップを取ってください

## サポート

問題が発生した場合は、実行ログスプレッドシートを確認するか、各ツールのエラーメッセージを参照してください。
