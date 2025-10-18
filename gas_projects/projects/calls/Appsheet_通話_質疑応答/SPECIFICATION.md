# 通話関連クエリ処理 - 詳細仕様書

## 1. システム概要

### 1.1 目的
通話記録に関するユーザーの質問に対して、AI（Gemini API）を使用して自動的に回答を生成し、AppSheetに書き戻すシステム。

### 1.2 主要機能
1. Webhook経由でAppSheetからリクエストを受信
2. Gemini APIで質問への回答を生成
3. 生成結果をAppSheetに書き戻し
4. 重複実行の防止
5. 実行ログのスプレッドシート記録

## 2. データフロー

```
AppSheet → Webhook → GAS → Gemini API → GAS → AppSheet
                      ↓
                 ログスプレッドシート
```

## 3. 入力仕様

### 3.1 Webhookリクエスト

**エンドポイント**: GASウェブアプリURL

**メソッド**: POST

**Content-Type**: application/json

**リクエストボディ**:
```json
{
  "queryId": "string (必須)",
  "promptText": "string (必須)",
  "callSummary": "string (オプション)",
  "callTranscript": "string (オプション)",
  "call_info": "string (オプション)",
  "modelKeyword": "string (オプション: 'しっかり' | 'はやい')"
}
```

### 3.2 パラメータ詳細

| パラメータ | 型 | 必須 | 説明 | 最大長 |
|----------|---|------|------|--------|
| queryId | String | ✓ | クエリの一意識別子 | 255文字 |
| promptText | String | ✓ | ユーザーからの質問 | 10,000文字 |
| callSummary | String | - | 通話の要約 | 50,000文字 |
| callTranscript | String | - | 通話の文字起こし | 500,000文字 |
| call_info | String | - | 関連情報 | 100,000文字 |
| modelKeyword | String | - | モデル選択('しっかり'/'はやい') | - |

## 4. 出力仕様

### 4.1 正常時レスポンス

**HTTPステータス**: 200

**Content-Type**: text/plain

**ボディ**: `OK`

**AppSheetへの書き込み**:
```json
{
  "query_id": "クエリID",
  "response_text": "生成された回答",
  "status": "完了"
}
```

### 4.2 エラー時レスポンス

**HTTPステータス**: 200

**Content-Type**: text/plain

**ボディ**: `ERROR`

**AppSheetへの書き込み**:
```json
{
  "query_id": "クエリID",
  "status": "エラー",
  "error_details": "エラーメッセージ"
}
```

### 4.3 重複時レスポンス

**HTTPステータス**: 200

**Content-Type**: text/plain

**ボディ**: `DUPLICATE`

**AppSheetへの書き込み**: なし（既存データ保持）

## 5. 処理フロー

### 5.1 メイン処理

1. **Webhook受信**
   - リクエストの妥当性チェック
   - JSONパース

2. **重複チェック**
   - キャッシュでチェック（高速）
   - Script Propertiesでチェック（永続）
   - ロック取得

3. **回答生成**
   - プロンプト構築
   - Gemini API呼び出し
   - レスポンス検証

4. **結果書き戻し**
   - AppSheet API呼び出し
   - ステータス更新

5. **ログ保存**
   - スプレッドシートに記録

### 5.2 エラーハンドリング

**エラー種別と対応**:

| エラー種別 | 検出タイミング | 対応 |
|-----------|--------------|------|
| リクエスト不正 | Webhook受信時 | HTTP 200 + ERROR |
| 必須パラメータ不足 | パース後 | HTTP 200 + ERROR + AppSheet更新 |
| 重複実行 | 重複チェック時 | HTTP 200 + DUPLICATE |
| Gemini APIエラー | API呼び出し時 | リトライ後エラー + AppSheet更新 |
| AppSheet APIエラー | 書き戻し時 | ログ記録のみ |

## 6. Gemini API仕様

### 6.1 使用モデル

**デフォルト**: gemini-2.5-flash

**選択可能モデル**:
- `gemini-2.5-flash`: 高速・低コスト（標準）
- `gemini-2.5-pro`: 高精度・複雑な推論

### 6.2 生成パラメータ

```javascript
{
  temperature: 0.3,      // 一貫性重視
  maxOutputTokens: 20000, // 長文対応
  topP: 0.95,
  topK: 40
}
```

### 6.3 プロンプトテンプレート

```
# 指示
以下の#参照情報に基づいて、#ユーザーからの質問に的確に回答してください。
**重要: 回答には「はい、わかりました」などの前置きや挨拶を含めず、質問に対する答えそのものだけを生成してください。**

# 参照情報
## 通話の要約
{callSummary}

## 通話の全文文字起こし
{callTranscript}

## 通話関連情報
{call_info}

---
# ユーザーからの質問
{promptText}
```

## 7. AppSheet API仕様

### 7.1 エンドポイント

```
https://api.appsheet.com/api/v2/apps/{APP_ID}/tables/{TABLE_NAME}/Action
```

### 7.2 認証

**ヘッダー**:
```
ApplicationAccessKey: {ACCESS_KEY}
```

### 7.3 アクション仕様

**更新アクション（成功時）**:
```json
{
  "Action": "Edit",
  "Properties": {
    "Locale": "ja-JP",
    "Timezone": "Asia/Tokyo"
  },
  "Rows": [{
    "query_id": "クエリID",
    "response_text": "生成された回答",
    "status": "完了"
  }]
}
```

**更新アクション（エラー時）**:
```json
{
  "Action": "Edit",
  "Properties": {
    "Locale": "ja-JP",
    "Timezone": "Asia/Tokyo"
  },
  "Rows": [{
    "query_id": "クエリID",
    "status": "エラー",
    "error_details": "エラーメッセージ（最大1000文字）"
  }]
}
```

## 8. ログ仕様

### 8.1 ログスプレッドシート

**場所**: 共有ドライブ「GAS」フォルダー
**ファイル名**: `GAS実行ログ_統合`

### 8.2 ログ項目

| 列 | 説明 | データ型 |
|----|------|---------|
| 開始時刻 | 処理開始日時 | DateTime |
| 終了時刻 | 処理終了日時 | DateTime |
| 実行時間(秒) | 処理時間 | Number |
| スクリプト名 | '通話関連クエリ' | String |
| ステータス | '成功'/'エラー'/'重複' | String |
| レコードID | query_id | String |
| リクエストID | UUID | String |
| ログサマリー | 処理ログ | LongText |
| エラー詳細 | エラー情報 | LongText |

### 8.3 ログレベル

- **INFO**: 通常の処理情報
- **SUCCESS**: 成功した処理
- **WARNING**: 警告（重複検出など）
- **ERROR**: エラー発生

## 9. 重複実行防止仕様

### 9.1 重複チェック方法

1. **CacheService**: 6時間保持（高速チェック）
2. **PropertiesService**: 永続保持（確実なチェック）

### 9.2 ロック機構

- **ロックタイムアウト**: 5分
- **リトライ回数**: 最大3回
- **リトライ間隔**: 1秒 × 試行回数

### 9.3 クリーンアップ

- **処理済みレコード**: 24時間後に自動削除
- **実行方法**: 定期トリガー（日次）

## 10. パフォーマンス

### 10.1 処理時間目標

- **標準処理**: 10-30秒
- **最大処理時間**: 120秒（タイムアウト）

### 10.2 制限事項

- **同時実行数**: GASの制限に準拠（通常30並列）
- **1日の実行回数**: 無制限（GASクォータの範囲内）
- **最大レスポンス長**: 20,000トークン（約15,000文字）

## 11. セキュリティ

### 11.1 認証

- Gemini API: APIキー認証
- AppSheet API: Application Access Key認証

### 11.2 データ保護

- APIキーはスクリプト内に保持（Script Propertiesは不使用）
- ログスプレッドシートは共有ドライブに限定

## 12. エラーコード

| コード | 説明 | 対応 |
|-------|------|------|
| E001 | POSTデータ不正 | Webhook設定確認 |
| E002 | JSON パースエラー | リクエスト形式確認 |
| E003 | 必須パラメータ不足 | パラメータ確認 |
| E004 | Gemini APIエラー | APIキー・クォータ確認 |
| E005 | AppSheet APIエラー | 認証情報確認 |
| E006 | 重複実行検出 | 正常動作（処理スキップ） |

## 13. 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| 2.0.0 | 2025-10-16 | 共通モジュール化、ログスプレッドシート対応 |
| 1.0.0 | 2025-09-01 | 初版リリース |
