# Appsheet_通話_要約生成

**Script ID:** 1PK1RNjLaA7g-1-JrJ-AFn1S0D_nL5cGHNJeDtyhIap_otDnYsUAquSz6

**Created:** 2025-07-20T11:00:09.647Z

**Modified:** 2025-10-17

**Current Version:** v100

**Owners:** 

## 概要

通話音声ファイルを解析し、要約・文字起こし・アクション抽出を行うGASプロジェクトです。
v100では、処理モードの条件分岐機能が追加され、新規依頼作成・既存依頼更新・要約のみの3モードに対応しています。

## ドキュメント

- **[PROCESSING_MODE_GUIDE_v100.md](./PROCESSING_MODE_GUIDE_v100.md)** - 処理モード分岐ガイド（シーケンス図付き）
- **[OPTIMIZATION_GUIDE_v95.md](./OPTIMIZATION_GUIDE_v95.md)** - API統合最適化の詳細

## 主な機能

### v100の新機能

- ✅ **callType/requestId条件分岐**: パラメータによる処理モード自動判定
  - `callType='新規依頼'` → 新規依頼作成モード
  - `requestId`指定 → 既存依頼更新モード
  - どちらでもない → 通常要約モード

### v95の最適化

- ✅ **API呼び出し統合**: 2回 → 1回（依頼情報抽出を統合プロンプトで実行）
- ✅ **base64 inlineData**: Cloud Storage不要（アップロード/削除処理を削減）
- ✅ **処理時間短縮**: 15-20秒 → 10-12秒（28%高速化）
- ✅ **コスト削減**: $0.0198 → $0.0191（3.5%削減）

## Structure

### スクリプトファイル構成（役割別）

#### エントリーポイント
- `webhook.gs`: Webhookリクエスト受信・エラーハンドリング

#### メイン処理
- `call_summary_processor.gs`: 通話要約メイン処理ロジック
- `vertex_ai_service.gs`: Vertex AI音声解析（統合プロンプト）
- `request_manager.gs`: 依頼作成・更新・ID生成

#### API連携
- `appsheet_api.gs`: AppSheet API呼び出し（依頼用）
- `appsheet_service.gs`: AppSheet API連携（通話ログ・アクション）

#### ユーティリティ
- `config.gs`: 設定管理
- `notification_service.gs`: 通知サービス
- `execution_logger.gs`: 実行ログ記録
- `drive_utils.gs`: Google Drive操作
- `duplication_prevention.gs`: 重複防止
- `vertex_ai_utils.gs`: Vertex AI汎用ヘルパー
- `timing_utils.gs`: 実行時間計測

#### テスト
- `test_functions.gs`: テスト関数（3モード）

### その他
- `appsscript.json`: プロジェクトマニフェスト
- `project_metadata.json`: プロジェクトメタデータ
- `spreadsheets/`: 参照スプレッドシートメタデータ
- `_backup/`: バックアップファイル（clasp pushから除外）

## Referenced Spreadsheets

- **GAS実行ログ** (ID: 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)

## デプロイ

```bash
# 統合デプロイスクリプトを使用（推奨）
python deploy_unified.py Appsheet_通話_要約生成 "v101: 説明"
```

詳細は [DEPLOY_GUIDE.md](../../DEPLOY_GUIDE.md) を参照してください。
