# Appsheet_通話_質疑応答

**Script ID:** 151jaxVN56L8NWPJlNmQ3txhUB0-SJMF3JC-LNreXyPu7BiFerEppR46I

**Created:** 2025-07-20T13:35:28.251Z

**Modified:** 2025-10-20

**Current Version:** v2.0.0

**Owners:** Fractal Group

## 概要

通話記録（要約・文字起こし）に対するユーザーの質問に、Vertex AI Gemini APIで自動回答を生成するGASプロジェクトです。
思考モード（Thinking Mode）を活用し、複雑な質問にも深い推論で答えます。

## 主な機能

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

### スクリプトファイル構成

#### エントリーポイント
- `main.gs`: Webhookリクエスト受信・処理フロー制御

#### コアモジュール
- `gemini_client.gs`: Vertex AI Gemini APIクライアント（Flash/Pro対応）
- `appsheet_client.gs`: AppSheet API連携（Call_Queriesテーブル更新）
- `duplication_prevention.gs`: 重複実行防止
- `logger.gs`: 実行ログ記録

#### ユーティリティ
- `test_functions.gs`: テスト関数
- `debug_logger.gs`: デバッグログ出力

#### レガシー（非推奨）
- `コード.gs`: 旧バージョンコード（後方互換性のため保持）
- `utils_*.gs`: 旧ユーティリティモジュール

### その他
- `appsscript.json`: プロジェクトマニフェスト
- `project_metadata.json`: プロジェクトメタデータ
- `spreadsheets/`: 参照スプレッドシートメタデータ

## Referenced Spreadsheets

- **GAS実行ログ** (ID: 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)

## デプロイ

```bash
# 統合デプロイスクリプトを使用（推奨）
python deploy_unified.py Appsheet_通話_質疑応答 "v2.x: 説明"
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
