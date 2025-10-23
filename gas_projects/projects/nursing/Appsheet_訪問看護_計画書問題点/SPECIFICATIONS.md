# Appsheet_訪問看護_計画書問題点 - 詳細仕様書

## 目的

このスクリプトは、訪問看護における利用者様の看護記録を解析し、Vertex AI (Gemini 2.5-Pro) を使用して個別性のある看護計画を自動生成します。利用者様の基本情報、これまでの看護記録、問題点を入力として、観察項目（O-P）と実施項目（E-P/C-P）を含む質の高い看護計画を立案します。

## システム構成

### コンポーネント

1. **Webhook受信ハンドラ** (`doPost`)
   - AppSheetからのPOSTリクエストを受信
   - JSONペイロードをパース
   - CommonWebhookモジュールで重複チェックを実行

2. **重複防止モジュール** (`DuplicationPrevention`)
   - レコードIDベースの重複検出
   - ScriptCacheとPropertiesServiceによる処理済みマーク
   - LockServiceによる排他制御
   - 24時間の自動クリーンアップ

3. **実行ログモジュール** (`GASLogger`)
   - 統合コスト管理シートへのログ記録
   - タイムスタンプ、ステータス、エラー詳細を保存
   - API使用量とコスト情報を記録

4. **Vertex AI統合** (`generateCarePlanWithGemini`)
   - OAuth2認証によるVertex AI API呼び出し
   - Gemini 2.5-Pro モデル使用
   - JSON形式での構造化レスポンス生成
   - Temperature: 0.3（高精度）

5. **AppSheet API連携** (`updatePlanInAppSheet`)
   - VN_Plan_Problemsテーブルへの看護計画更新
   - 状態管理（編集中）
   - 観察項目と実施項目の構造化保存

## 関数一覧

### メイン処理
- `doPost(e)` - Webhookエントリーポイント
- `processRequest(problemId, contextText, problemPoint, problemIdentifiedDate)` - メイン処理関数
- `testProcessRequest()` - テスト実行関数

### AI処理
- `generateCarePlanWithGemini(contextText, problemPoint, identifiedDate)` - Vertex AI APIによる看護計画生成

### AppSheet連携
- `updatePlanInAppSheet(problemId, planData)` - 看護計画テーブル更新

### 通知
- `sendErrorEmail(problemId, errorMessage)` - エラー通知（実行ログで代替）

### 共通モジュール
- `CommonWebhook.handleDoPost()` - Webhook共通処理
- `createLogger()` - ロガーインスタンス作成
- `createDuplicationPrevention()` - 重複防止インスタンス作成
- `CommonTest.runTest()` - テスト実行ラッパー

## データフロー

```
AppSheet Webhook (problemId, contextText, problemPoint, problemIdentifiedDate)
    ↓
doPost(e)
    ↓
CommonWebhook.handleDoPost() → 重複チェック
    ↓
processRequest() - パラメータ検証
    ↓
generateCarePlanWithGemini() → Vertex AI API呼び出し
    ↓ (JSON形式で生成)
問題点、目標、観察項目、実施項目
    ↓
updatePlanInAppSheet() → AppSheet API呼び出し
    ↓
VN_Plan_Problemsテーブル更新
    ↓
実行ログ保存 → 統合コスト管理シート
    ↓
レスポンス返却 (成功/エラー)
```

## 入出力仕様

### 入力パラメータ

| パラメータ | 型 | 必須 | 説明 | 例 |
|-----------|----|----|------|-----|
| problemId | string | ✓ | 看護計画問題レコードID | "P-12345" |
| contextText | string | ✓ | 利用者様の基本情報と看護記録 | "80歳女性、心不全、ADL一部介助..." |
| problemPoint | string | ✓ | 注目している問題点 | "排便コントロール不良" |
| problemIdentifiedDate | string | ✓ | 問題が明らかになった日付 | "2025-10-23" |

### Vertex AI APIリクエスト

**エンドポイント**:
```
https://us-central1-aiplatform.googleapis.com/v1/projects/macro-shadow-458705-v8/locations/us-central1/publishers/google/models/gemini-2.5-pro:generateContent
```

**認証**: OAuth2 (`ScriptApp.getOAuthToken()`)

**モデル設定**:
- Model: `gemini-2.5-pro`
- Response MIME Type: `application/json`
- Temperature: 0.3（高精度、一貫性重視）

### Vertex AI APIレスポンス

**成功時**:
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "{\"problem_statement\":\"排便コントロール不良\",\"goal\":\"定期的な排便リズムを取り戻すことができる\",\"solutions_observation\":\"排便の回数、性状、量...\",\"solutions_implementation\":\"排便状況の観察と記録、水分摂取の促進...\"}"
          }
        ]
      }
    }
  ]
}
```

### AppSheet API更新

**エンドポイント**:
```
https://api.appsheet.com/api/v2/apps/f40c4b11-b140-4e31-a60c-600f3c9637c8/tables/VN_Plan_Problems/Action
```

**リクエストボディ**:
```json
{
  "Action": "Edit",
  "Properties": {"Locale": "ja-JP"},
  "Rows": [{
    "status": "編集中",
    "problem_id": "P-12345",
    "problem_statement": "排便コントロール不良",
    "goal": "定期的な排便リズムを取り戻すことができる",
    "solutions": "△ 観察項目\n...\n\n△ 実施項目\n..."
  }]
}
```

## エラーハンドリング

### エラーレベル

1. **SUCCESS**: 正常終了
2. **WARNING**: 警告（重複リクエストなど）
3. **ERROR**: エラー発生

### エラー記録

すべてのエラーは実行ログスプレッドシートに記録されます:
- エラーメッセージ
- スタックトレース
- 入力データ
- 実行時間

## パフォーマンス考慮事項

### キャッシュ戦略

- **有効期限**: 1時間 (3600秒)
- **用途**: 重複リクエストの検出

### ロック戦略

- **タイムアウト**: 5分 (300,000ミリ秒)
- **スコープ**: スクリプトレベル

## セキュリティ

### 認証

- AppSheet Webhookからのリクエストは認証不要（公開URL）
- 必要に応じてシークレットトークンによる検証を追加可能

### データ保護

- APIキーはスクリプトプロパティで管理（推奨）
- 実行ログには機密情報を含めない

## 制限事項

### Google Apps Script制限

- **実行時間**: 最大6分
- **URL Fetchサイズ**: 50MB
- **同時実行**: ユーザーあたり30

### 推奨事項

- 大量データ処理は分割実行
- タイムアウト対策としてバックグラウンド処理を検討

## テスト

### 単体テスト

```javascript
function testDoPost() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        // Test data here
      })
    }
  };
  
  const result = doPost(testData);
  Logger.log(result);
}
```

### 統合テスト

AppSheetから実際のWebhookを送信してテストします。

## 保守

### ログ確認

定期的に実行ログスプレッドシートを確認:
- エラー率
- 実行時間の傾向
- 重複リクエストの頻度

### アップデート手順

1. スクリプトを更新
2. バージョン作成
3. デプロイメント更新
4. テスト実行
5. ログで動作確認

## 付録

### 設定値

| 項目 | 値 |
|------|-----|
| 実行ログスプレッドシートID | 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE |
| キャッシュ有効期限 | 3600秒 |
| ロックタイムアウト | 300000ミリ秒 |

### 関連リソース

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [AppSheet Automation](https://help.appsheet.com/en/collections/1885643-automation)
