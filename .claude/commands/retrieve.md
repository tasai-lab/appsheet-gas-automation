---
description: Google DriveからGASプロジェクトを取得する
---

Google Driveから全てのGASプロジェクトを最新の状態で取得してください。

## 実行手順

1. 以下のコマンドを実行:
   ```bash
   python retrieve_gas.py --verbose
   ```
2. ダウンロードされたプロジェクト数を確認
3. エラーがあれば報告

## オプション

- `--filter "プロジェクト名"`: 特定のプロジェクトのみ取得
- `--folder-id FOLDER_ID`: 特定のフォルダから取得
- `--verbose`: 詳細なログを表示
