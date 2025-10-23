# Appsheet_通話_要約生成

**Script ID:** 1PK1RNjLaA7g-1-JrJ-AFn1S0D_nL5cGHNJeDtyhIap_otDnYsUAquSz6

**Created:** 2025-07-20T11:00:09.647Z

**Modified:** 2025-10-23

**Current Version:** v104

**Owners:** 

## 概要

通話音声ファイルの解析と、テキストベースの質疑応答を行うGASプロジェクトです。

**主要機能:**
1. **通話要約生成**: 音声ファイルから要約・文字起こし・アクション抽出（v100以前から）
2. **質疑応答**: 利用者情報と参照データを基にAIが質問に回答（v101で追加）

v101では、個別引数での直接実行が可能な質疑応答機能が追加されました。
v100では、処理モードの条件分岐機能が追加され、新規依頼作成・既存依頼更新・要約のみの3モードに対応しています。

## ドキュメント

- **[PROCESSING_MODE_GUIDE_v100.md](./PROCESSING_MODE_GUIDE_v100.md)** - 処理モード分岐ガイド（シーケンス図付き）
- **[OPTIMIZATION_GUIDE_v95.md](./OPTIMIZATION_GUIDE_v95.md)** - API統合最適化の詳細

## 主な機能

### v104のバグ修正（2025-10-23）

- 🐛 **transcript空文字列対応**: `transcript`が空文字列の場合にエラーが発生する問題を修正
  - `hasOwnProperty()`でキーの存在をチェック（空文字列は許容）
  - Pro修正でtranscriptが空になる場合に対応

### v103のバグ修正（2025-10-23）

- 🐛 **requestId配列対応**: `requestId`が配列の場合に`trim()`エラーが発生する問題を修正
  - 配列の場合は最初の要素を取得して文字列化
  - すべてのケースで安全に処理できるよう正規化処理を追加
  - エラー: `TypeError: requestId.trim is not a function` を解消

### v102の新機能（2025-10-23）

- ✅ **JSON修正機能**: AIレスポンスのJSONパースエラー時に自動修正
  - Gemini 2.5 Proでテキストベースの修正を実行
  - 1回のみリトライ（無限ループ防止）
  - 修正失敗時は詳細なエラーメッセージをAppSheetに記録
  - コスト効率: テキスト処理のみで約¥1-2/回
  - テスト関数: `testFixMalformedJSON()`, `testFixMalformedJSONComplex()`

### v101の新機能（2025-10-22）

- ✅ **質疑応答機能**: テキストベースの質疑応答が可能に
  - `answerQueryDirect(queryId, promptText, userInfoText, referenceDataText)` 関数を追加
  - 利用者情報と参照データを基に、AI（gemini-2.5-flash）が質問に回答
  - 個別引数での直接実行をサポート
  - テストモード: `testAnswerQuery()`, `testAnswerQuerySimple()`

- ✅ **ファイル構造の最適化**: 保守性向上のため18ファイル→13ファイルに整理
  - 重複機能を統合（AppSheet API、Vertex AI、テスト関数）
  - 未使用ファイルを削除（logger.gs、gemini_client.gs等）
  - 役割が明確なモジュール構成に改善

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

### スクリプトファイル構成（最適化済み v101）

#### エントリーポイント
- `webhook.gs`: Webhookリクエスト受信・エラーハンドリング

#### メイン処理（コアロジック）
- `call_summary_processor.gs`: 通話要約メイン処理ロジック
- `query_service.gs`: 質疑応答サービス（Vertex AIテキストモード）
- `request_manager.gs`: 依頼作成・更新・ID生成

#### AI/API連携（統合版）
- `vertex_ai_service.gs`: Vertex AI統合（音声解析・モデル定義）
- `appsheet_service.gs`: AppSheet API統合（Call_Logs, Call_Actions, Client_Requests）

#### ユーティリティ
- `config.gs`: 設定管理
- `execution_logger.gs`: 実行ログ記録
- `duplication_prevention.gs`: 重複防止
- `notification_service.gs`: 通知サービス
- `drive_utils.gs`: Google Drive操作
- `timing_utils.gs`: 実行時間計測

#### テスト
- `test_functions.gs`: 統合テスト関数（通話要約・質疑応答・音声解析）

**削除されたファイル（v101で統合・整理）:**
- ~~`appsheet_api.gs`~~ → `appsheet_service.gs`に統合
- ~~`vertex_ai_utils.gs`~~ → `vertex_ai_service.gs`に統合
- ~~`test_vertex_ai.gs`~~ → `test_functions.gs`に統合
- ~~`logger.gs`~~ → `execution_logger.gs`を使用
- ~~`gemini_client.gs`~~ → Vertex AI専用のため削除
- ~~`script_properties_manager.gs`~~ → 未使用のため削除

### その他
- `appsscript.json`: プロジェクトマニフェスト
- `project_metadata.json`: プロジェクトメタデータ
- `spreadsheets/`: 参照スプレッドシートメタデータ
- `_backup/`: バックアップファイル（clasp pushから除外）

## Referenced Spreadsheets

- **GAS実行ログ** (ID: 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)

## 使用方法

### 質疑応答機能の使い方

GASエディタで直接実行する場合：

```javascript
// 基本的な質疑応答
function myQuery() {
  const result = answerQueryDirect(
    "query_001",                    // クエリID
    "利用者の主治医は誰ですか？",   // 質問
    "氏名: 山田太郎\n主治医: 田中医師", // 利用者情報
    "2025-10-20: 血圧安定"          // 参照データ（オプション）
  );

  Logger.log(result.answer);
}
```

AppSheetから呼び出す場合：
- Webhookまたはカスタムスクリプトから `answerQueryDirect` 関数を呼び出す
- 引数: `queryId`, `promptText`, `userInfoText`, `referenceDataText`

### テスト実行

GASエディタから以下の関数を実行してテスト可能：

```javascript
// 質疑応答テスト（参照データあり）
testAnswerQuery()

// 質疑応答テスト（シンプル版）
testAnswerQuerySimple()

// 通話要約テスト（通常モード）
testProcessRequest()

// 通話要約テスト（新規依頼作成モード）
testProcessRequestCreate()

// 通話要約テスト（既存依頼更新モード）
testProcessRequestUpdate()
```

## デプロイ

```bash
# 統合デプロイスクリプトを使用（推奨）
python deploy_unified.py Appsheet_通話_要約生成 "v101: 質疑応答機能追加"
```

詳細は [DEPLOY_GUIDE.md](../../DEPLOY_GUIDE.md) を参照してください。
