# Appsheet_通話_質疑応答

**Script ID:** 151jaxVN56L8NWPJlNmQ3txhUB0-SJMF3JC-LNreXyPu7BiFerEppR46I

**Created:** 2025-07-20T13:35:28.251Z

**Modified:** 2025-10-22

**Current Version:** v2.3.0

**Owners:** Fractal Group

## 概要

通話記録（要約・文字起こし）に対するユーザーの質問に、Vertex AI Gemini APIで自動回答を生成するGASプロジェクトです。
思考モード（Thinking Mode）を活用し、複雑な質問にも深い推論で答えます。

## 主な機能

### v2.3.0の改善（2025-10-22）

- ✅ **エラー時コスト記録**: API呼び出し失敗時でもusageMetadataが存在すれば必ずコストを記録
- ✅ **重複回避機能廃止**: より柔軟な実行を実現
- ✅ **エラーハンドリング強化**: 失敗時にAppSheet APIでステータスを"エラー"に更新
- ✅ **コスト記録の一元化**: usageMetadataの記録をgemini_client.gs内で完結

### v2.2.0の改善（2025-10-22）

- ✅ **OAuth2スコープ追加**: cloud-platformスコープ追加でVertex AI認証エラー修正

### v2.1.0の改善（2025-10-22）

- ✅ **ファイル構造の最適化**: 保守性向上のため11ファイル→6ファイルに整理
  - 重複防止・デバッグ関数を統合
  - 未使用ファイルを削除（utils_*、script_properties_manager、コード.gs）
  - 役割が明確なモジュール構成に改善

### v2.0.0の改善（2025-10-22）

- ✅ **Vertex AI完全移行**: Google AI Studio APIからVertex AIに完全移行
  - OAuth2認証（ScriptApp.getOAuthToken()）で安全性向上
  - APIキー管理不要に
  - エンドポイント形式を統一

### AI駆動の質疑応答システム
- ✅ **Vertex AI Gemini 2.5 Flash/Pro**: OAuth2認証による安全なAPI呼び出し
- ✅ **思考モード（Thinking Budget: -1）**: 複雑な質問に対する深い推論
- ✅ **モデル自動選択**: キーワード「しっかり」でProモデルに切り替え
- ✅ **コンテキスト理解**: 通話要約・文字起こし・関連情報を総合分析

### システム機能
- ✅ **重複防止機能**: ScriptCacheとLockServiceによる重複実行防止
- ✅ **一元化ログ記録**: 全実行履歴を集中スプレッドシートに記録
- ✅ **エラーハンドリング**: AppSheetへのエラーステータス自動反映
- ✅ **API使用量追跡**: トークン数とコスト（日本円）を自動記録

## 技術仕様

### 使用モデル
- **デフォルト**: Vertex AI Gemini 2.5 Flash（高速・低コスト）
- **高精度モード**: Vertex AI Gemini 2.5 Pro（`modelKeyword='しっかり'`で有効化）
- **思考モード**: `thinkingBudget: -1`（無制限推論）

### API設定
- **認証方式**: OAuth2（ScriptApp.getOAuthToken()）
- **Temperature**: 0.3（バランスの取れた創造性）
- **MaxOutputTokens**: 20000（長文回答対応）

## Structure

### スクリプトファイル構成（最適化済み v2.1.0）

#### エントリーポイント
- `main.gs`: Webhookリクエスト受信・処理フロー制御

#### コアモジュール（4ファイル）
- `gemini_client.gs`: Vertex AI Gemini APIクライアント（Flash/Pro対応、OAuth2認証）
- `appsheet_client.gs`: AppSheet API連携（Call_Queriesテーブル更新）
- `duplication_prevention.gs`: 重複実行防止
- `logger.gs`: 実行ログ記録

#### テスト・デバッグ（1ファイル）
- `test_functions.gs`: テスト関数・デバッグ関数（debug_logger.gsから統合）

**削除されたファイル（v2.1.0で統合・整理）:**
- ~~`debug_logger.gs`~~ → `test_functions.gs`に統合
- ~~`utils_duplicationPrevention.gs`~~ → 未使用のため削除
- ~~`utils_vertex_ai.gs`~~ → 未使用のため削除
- ~~`script_properties_manager.gs`~~ → 未使用のため削除
- ~~`コード.gs`~~ → レガシーコードのため削除

### その他
- `appsscript.json`: プロジェクトマニフェスト
- `project_metadata.json`: プロジェクトメタデータ
- `spreadsheets/`: 参照スプレッドシートメタデータ

## Referenced Spreadsheets

- **GAS実行ログ** (ID: 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)

## デプロイ

```bash
# 統合デプロイスクリプトを使用（推奨）
python deploy_unified.py Appsheet_通話_質疑応答 "v2.1: ファイル構造最適化"
```

詳細は [DEPLOY_GUIDE.md](../../DEPLOY_GUIDE.md) を参照してください。

## 設定

### CONFIG設定（main.gs）

```javascript
const CONFIG = {
  SCRIPT_NAME: '通話関連クエリ',
  APP_ID: '4762f34f-3dbc-4fca-9f84-5b6e809c3f5f',
  ACCESS_KEY: 'V2-I1zMZ-90iua-47BBk-RBjO1-N0mUo-kY25j-VsI4H-eRvwT',
  TABLE_NAME: 'Call_Queries',
  KEY_COLUMN: 'query_id',
  USE_PRO_MODEL: false  // デフォルトはFlash
};
```

### モデル選択ロジック

```javascript
const usePro = modelKeyword === 'しっかり' || CONFIG.USE_PRO_MODEL;
```

## テスト

### GASエディタでのテスト実行

```javascript
// testQuery() 関数を実行
function testQuery() {
  const testParams = {
    queryId: 'test_' + new Date().getTime(),
    promptText: 'テスト質問: 通話の主な内容は何ですか？',
    callSummary: 'これはテスト用の要約です。',
    callTranscript: 'これはテスト用の文字起こしです。',
    call_info: 'これはテスト用の関連情報です。',
    modelKeyword: 'はやい'  // または 'しっかり'
  };
  // ...
}
```

## ドキュメント

- **[SPECIFICATIONS.md](./SPECIFICATIONS.md)** - 技術仕様書
- **[FLOW.md](./FLOW.md)** - フロー図
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - バージョン移行ガイド
