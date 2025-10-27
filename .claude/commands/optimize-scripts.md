---
description: GASスクリプトに共通モジュールを適用する
---

指定されたGASプロジェクトに共通モジュール（ログ記録、重複防止、APIクライアント）を適用して最適化してください。

## 実行手順

1. 対象プロジェクトを確認
2. 以下のコマンドを実行（dry-runで確認）:
   ```bash
   python ツール/optimize_all_appsheet_scripts.py --filter "プロジェクト名" --dry-run --verbose
   ```
3. 変更内容を確認
4. 問題がなければ本番実行:
   ```bash
   python ツール/optimize_all_appsheet_scripts.py --filter "プロジェクト名" --verbose
   ```
5. 結果を報告

## 適用される機能

- `execution_logger.gs`: 一元化されたログ記録
- `duplication_prevention.gs`: リクエスト重複防止
- `gemini_client.gs`: Vertex AI/Gemini APIクライアント
- `appsheet_client.gs`: AppSheet API操作

## 注意事項

- 必ずdry-runで変更内容を確認してからコミット
- 既存の実装を壊さないように注意
