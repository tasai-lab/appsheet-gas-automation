# Appsheet_利用者_質疑応答

**Script ID:** 1ylxzHrg6eYAqienPOL65uxxUCMCB0bkT3BNNujMmqQg5iXypsaFo3Gvi

**Created:** 2025-07-31T07:37:21.746Z

**Modified:** 2025-10-20

**Current Version:** v1.0.0

**Owners:** Fractal Group

## 概要

利用者の情報（フェースシート、看護記録など）に対するユーザーの質問に、Vertex AI Gemini APIで自動回答を生成するGASプロジェクトです。
非同期タスクキュー方式により、長時間実行を安定して処理します。

## 主な機能

### AI駆動の質疑応答システム

- ✅ **Vertex AI Gemini 2.5 Flash**: OAuth2認証による安全なAPI呼び出し
- ✅ **非同期タスクキュー**: 6分の実行制限を回避する自動ワーカー起動
- ✅ **コンテキスト理解**: 参照資料を深く分析し的確な回答を生成
- ✅ **回答+要約**: 詳細回答と簡潔な要約を同時生成

### システム機能

- ✅ **重複防止機能**: リクエストIDベースの冪等性保証
- ✅ **一元化ログ記録**: 全実行履歴を集中スプレッドシートに記録
- ✅ **エラーハンドリング**: AppSheetへのエラーステータス自動反映
- ✅ **API使用量追跡**: トークン数とコスト（日本円）を自動記録

## 技術仕様

### 使用モデル

- **モデル**: Vertex AI Gemini 2.5 Flash
- **認証方式**: OAuth2（ScriptApp.getOAuthToken()）
- **Temperature**: 0.2（一貫性重視）
- **ResponseMimeType**: application/json

### 非同期タスクキュー

```javascript
ASYNC_CONFIG: {
  WORKER_FUNCTION_NAME: 'processTaskQueueWorker',
  WORKER_ACTION_KEY: 'start_worker_v1',
  QUEUE_KEY: 'TASK_QUEUE',
  CACHE_EXPIRATION_SECONDS: 600, // 10分
  MAX_EXECUTION_TIME_MS: 300000  // 5分
}
```

### レスポンス形式

```json
{
  "answer": "詳細な回答テキスト",
  "summary": "回答の簡潔な要約"
}
```

## Structure

### スクリプトファイル構成

#### エントリーポイント
- `webhook.gs`: Webhookリクエスト受信・タスクキュー登録

#### コアモジュール
- `task_queue.gs`: タスクキュー管理（ScriptProperties使用）
- `task_worker.gs`: 非同期ワーカー処理
- `vertex_ai_client.gs`: Vertex AI Gemini APIクライアント
- `appsheet_client.gs`: AppSheet API連携（Client_Analyticsテーブル更新）
- `duplication_prevention.gs`: 重複実行防止
- `logger.gs`: 実行ログ記録

#### ユーティリティ
- `config.gs`: 設定管理
- `utilities.gs`: 共通ユーティリティ関数
- `test_functions.gs`: テスト関数

### その他
- `appsscript.json`: プロジェクトマニフェスト
- `project_metadata.json`: プロジェクトメタデータ
- `spreadsheets/`: 参照スプレッドシートメタデータ
- `FILE_STRUCTURE.md`: ファイル構造詳細

## Referenced Spreadsheets

- **GAS実行ログ** (ID: 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)

## デプロイ

```bash
# 統合デプロイスクリプトを使用（推奨）
python deploy_unified.py Appsheet_利用者_質疑応答 "v1.x: 説明"
```

詳細は [DEPLOY_GUIDE.md](../../DEPLOY_GUIDE.md) を参照してください。

## 設定

### CONFIG設定（config.gs）

```javascript
const CONFIG = {
  GEMINI: {
    MODEL_NAME: 'gemini-2.5-flash',
    GCP_PROJECT_ID: 'macro-shadow-458705-v8',
    GCP_LOCATION: 'us-central1',
    GENERATION_CONFIG: {
      "responseMimeType": "application/json",
      "temperature": 0.2
    }
  },
  APPSHEET: {
    APP_ID: 'f40c4b11-b140-4e31-a60c-600f3c9637c8',
    ACCESS_KEY: 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY',
    TABLE_NAME: 'Client_Analytics'
  }
};
```

## テスト

### GASエディタでのテスト実行

```javascript
// webhook.gsのtestDoPost()関数を実行
function testDoPost() {
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        record_id: 'test_' + new Date().getTime(),
        document_text: 'テスト用の参照資料',
        prompt_text: 'テスト質問: この利用者の主な問題は何ですか？'
      })
    }
  };

  const result = doPost(testEvent);
  Logger.log(result.getContent());
}
```

## ドキュメント

- **[SPECIFICATIONS.md](./SPECIFICATIONS.md)** - 技術仕様書
- **[FLOW.md](./FLOW.md)** - フロー図
- **[FILE_STRUCTURE.md](./FILE_STRUCTURE.md)** - ファイル構造詳細
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - バージョン移行ガイド
