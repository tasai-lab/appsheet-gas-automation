# Appsheet_利用者_反映 - 詳細仕様書

## 目的

依頼情報から利用者（クライアント）の基本情報をVertex AI（Gemini 2.5 Pro）で抽出し、AppSheetの利用者テーブルに自動登録するGASプロジェクト。
医療事務スタッフの手作業による利用者登録を自動化し、入力ミスを削減し、業務効率を向上させます。

## システム構成

### コンポーネント

1. **Webhook受信ハンドラ** ([コード.gs:42-47](./scripts/コード.gs#L42-L47))
   - AppSheetからのPOSTリクエストを受信
   - CommonWebhook.handleDoPost()による共通処理
   - リクエストペイロードをparamsオブジェクトに変換

2. **重複防止モジュール** ([duplication_prevention.gs](./scripts/duplication_prevention.gs))
   - SHA-256ハッシュによるリクエスト識別
   - ScriptPropertiesによる処理済みマーク（24時間TTL）
   - LockServiceによる排他制御

3. **実行ログモジュール** ([logger.gs](./scripts/logger.gs))
   - すべての処理結果を記録
   - タイムスタンプ、ステータス、エラー詳細を保存
   - スプレッドシート（15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE）に集約

4. **ビジネスロジック** ([コード.gs:100-148](./scripts/コード.gs#L100-L148))
   - 利用者ID自動採番
   - Vertex AIによる情報抽出
   - AppSheet API連携（利用者作成・依頼更新）
   - エラーハンドリング

5. **Vertex AI統合** ([コード.gs:216-359](./scripts/コード.gs#L216-L359))
   - Gemini 2.5 Proモデル使用
   - OAuth2認証（ScriptApp.getOAuthToken()）
   - JSON構造化レスポンス
   - base64エンコードによる添付資料解析

## 関数一覧

### エントリーポイント

- `doPost(e)` - Webhook受信（CommonWebhook経由）
- `processRequestDirect(requestId, clientInfoTemp, requestReason, documentFileId, staffId, providerOffice)` - 直接実行用関数

### メイン処理

- `processRequest(params)` - メイン処理ロジック
- `getNewClientId()` - 新しい利用者IDを採番
- `extractClientInfoWithGemini(clientInfoTemp, requestReason, fileId)` - AI情報抽出
- `createClientInAppSheet(clientId, extractedInfo, params)` - 利用者作成
- `updateRequestStatus(requestId, status, errorMessage)` - 依頼ステータス更新
- `callAppSheetApi(appId, accessKey, tableName, payload)` - AppSheet API呼び出し

### ヘルパー関数

- `calculateAge(birthDateString)` - 生年月日から年齢を計算

### テスト関数

- `testProcessRequest()` - 標準テスト（paramsオブジェクト渡し）
- `testProcessRequestDirect()` - 直接実行テスト（個別引数渡し）

## データフロー

```
AppSheet Webhook
    ↓
doPost(e) → CommonWebhook.handleDoPost()
    ↓
processRequest(params)
    ├─ getNewClientId() → AppSheet API (Find)
    ├─ extractClientInfoWithGemini() → Vertex AI API
    ├─ createClientInAppSheet() → AppSheet API (Add)
    └─ updateRequestStatus() → AppSheet API (Edit)
    ↓
ExecutionLogger.saveToSpreadsheet()
    ↓
レスポンス返却
```

## APIエンドポイント

### Vertex AI API

**エンドポイント:**

```
https://{GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/{GCP_PROJECT_ID}/locations/{GCP_LOCATION}/publishers/google/models/{VERTEX_AI_MODEL}:generateContent
```

**設定値:**

- `GCP_PROJECT_ID`: macro-shadow-458705-v8
- `GCP_LOCATION`: us-central1
- `VERTEX_AI_MODEL`: gemini-2.5-pro

**認証:** OAuth2（`ScriptApp.getOAuthToken()`）

**リクエストボディ:**

```json
{
  "contents": [
    {
      "parts": [
        { "text": "プロンプトテキスト" },
        {
          "inlineData": {
            "mimeType": "application/pdf",
            "data": "base64エンコードされたファイル"
          }
        }
      ]
    }
  ],
  "generationConfig": {
    "responseMimeType": "application/json",
    "temperature": 0.1,
    "maxOutputTokens": 8192
  }
}
```

**レスポンス構造:**

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "{抽出された利用者情報のJSON}"
          }
        ]
      },
      "finishReason": "STOP"
    }
  ]
}
```

### AppSheet API

**ベースURL:**

```
https://api.appsheet.com/api/v2/apps/{APP_ID}/tables/{TABLE_NAME}/Action
```

**認証:** ApplicationAccessKey（ヘッダー）

**使用するアクション:**

1. **Find** - 既存利用者の一覧取得（ID採番用）

```json
{
  "Action": "Find",
  "Properties": { "Locale": "ja-JP" }
}
```

2. **Add** - 新しい利用者を作成

```json
{
  "Action": "Add",
  "Properties": { "Locale": "ja-JP" },
  "Rows": [
    {
      "client_id": "CL-00123",
      "status": "サービス提供中",
      "request_id": "CR-00456",
      "provider_office": "フラクタル訪問看護ステーション",
      "last_name": "山田",
      "first_name": "太郎",
      "last_name_kana": "ヤマダ",
      "first_name_kana": "タロウ",
      "gender": "男性",
      "birth_date": "1950/05/10",
      "birth_date_nengo": "昭和",
      "birth_date_nengo_year": 25,
      "age": 75,
      "is_welfare_recipient": false,
      "care_level_name": "要介護３",
      "phone1": "090-1234-5678",
      "phone1_destination": "本人",
      "phone2": "03-9876-5432",
      "phone2_destination": "長女",
      "special_notes": "特記事項",
      "created_by": "STF-001",
      "updated_by": "STF-001"
    }
  ]
}
```

3. **Edit** - 依頼ステータスを更新

```json
{
  "Action": "Edit",
  "Properties": { "Locale": "ja-JP" },
  "Rows": [
    {
      "request_id": "CR-00456",
      "status": "反映済み"
    }
  ]
}
```

## データモデル

### 入力パラメータ（Webhook）

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| requestId | string | ○ | 依頼ID（例: CR-00123） |
| clientInfoTemp | string | ○ | 利用者に関するメモ |
| requestReason | string | × | 依頼理由 |
| documentFileId | string | × | 添付資料のGoogle Drive ファイルID |
| staffId | string | ○ | 担当スタッフID（例: STF-001） |
| providerOffice | string | × | 担当事業所名 |

### 抽出される利用者情報（Vertex AI）

| フィールド | 型 | 説明 | 例 |
|-----------|-----|------|-----|
| last_name | string | 姓 | 山田 |
| first_name | string | 名 | 太郎 |
| last_name_kana | string | セイ（カタカナ） | ヤマダ |
| first_name_kana | string | メイ（カタカナ） | タロウ |
| gender | string | 性別 | 男性 / 女性 / その他 |
| birth_date | string | 生年月日（YYYY/MM/DD） | 1931/02/01 |
| birth_date_nengo | string | 年号 | 昭和 |
| birth_date_nengo_year | number | 年号の年数 | 6 |
| is_welfare_recipient | boolean | 生活保護受給 | true / false |
| care_level_name | string | 要介護度（全角数字） | 要介護３ |
| phone1 | string | 電話番号1 | 090-1234-5678 |
| phone1_destination | string | 電話番号1の持ち主 | 本人 |
| phone2 | string | 電話番号2 | 03-9876-5432 |
| phone2_destination | string | 電話番号2の持ち主 | 長女 |
| special_notes | string | 特記事項 | アレルギー、ADLなど |

### AppSheetテーブル構造

#### Clientsテーブル（利用者マスタ）

| カラム | 型 | 説明 |
|--------|-----|------|
| client_id | string | 利用者ID（主キー、CL-00001形式） |
| status | string | ステータス（デフォルト: "サービス提供中"） |
| request_id | string | 元の依頼ID |
| provider_office | string | 担当事業所 |
| last_name | string | 姓 |
| first_name | string | 名 |
| last_name_kana | string | セイ |
| first_name_kana | string | メイ |
| gender | string | 性別 |
| birth_date | date | 生年月日 |
| birth_date_nengo | string | 年号 |
| birth_date_nengo_year | number | 年号の年数 |
| age | number | 年齢（自動計算） |
| is_welfare_recipient | boolean | 生活保護受給 |
| care_level_name | string | 要介護度 |
| phone1 | string | 電話番号1 |
| phone1_destination | string | 電話番号1の持ち主 |
| phone2 | string | 電話番号2 |
| phone2_destination | string | 電話番号2の持ち主 |
| special_notes | string | 特記事項 |
| created_by | string | 作成者ID |
| updated_by | string | 更新者ID |

#### Client_Requestsテーブル（依頼管理）

| カラム | 型 | 説明 |
|--------|-----|------|
| request_id | string | 依頼ID（主キー、CR-00001形式） |
| status | string | ステータス（"反映済み"、"エラー"など） |
| error_details | string | エラー詳細（エラー時のみ） |

## エラーハンドリング

### エラーレベル

1. **成功**: 正常終了
2. **重複**: 重複リクエスト検出
3. **エラー**: 処理失敗

### エラーシナリオ

#### 1. 必須パラメータ不足

**発生タイミング:** processRequest()の最初

**条件:**

```javascript
!requestId || !clientInfoTemp || !staffId
```

**動作:**

- エラーを投げる
- ExecutionLoggerにエラーログ記録
- エラーレスポンス返却

#### 2. Vertex AIエラー

**発生タイミング:** extractClientInfoWithGemini()内

**考えられる原因:**

- API認証失敗（OAuth2トークンエラー）
- レスポンスコードが200以外
- 候補が空（candidates.length === 0）
- finishReason === 'MAX_TOKENS'
- 無効なJSON

**動作:**

- エラーログ記録
- 依頼テーブルにエラー詳細記録（updateRequestStatus()）
- エラーを投げる

#### 3. AppSheet APIエラー

**発生タイミング:** callAppSheetApi()内

**考えられる原因:**

- 認証失敗（ApplicationAccessKey無効）
- テーブル名・カラム名不一致
- バリデーションエラー
- レスポンスコード >= 400

**動作:**

- エラーログ記録
- 依頼テーブルにエラー詳細記録
- エラーを投げる

### エラーログ記録先

1. **実行ログスプレッドシート** (15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)
   - タイムスタンプ
   - スクリプト名（Appsheet_利用者_反映）
   - ステータス（エラー）
   - リクエストID
   - 実行時間
   - エラー詳細（スタックトレース含む）

2. **AppSheet Client_Requestsテーブル**
   - request_id
   - status = "エラー"
   - error_details = "GAS Script Error: {エラーメッセージ}"

## パフォーマンス考慮事項

### 処理時間

**想定処理時間:** 3-8秒

- Webhook受信・パース: 50-100ms
- 重複チェック: 100-200ms
- ID採番（AppSheet API Find）: 500-1000ms
- Vertex AI API（情報抽出）: 2000-5000ms
- 利用者作成（AppSheet API Add）: 500-1000ms
- 依頼更新（AppSheet API Edit）: 500-1000ms
- ログ記録: 200-500ms

### キャッシュ戦略

- **有効期限**: 24時間（86400秒）
- **用途**: 重複リクエストの検出（ScriptProperties）
- **キー形式**: `dup_prev_{scriptName}_{requestId}`

### ロック戦略

- **タイムアウト**: 30秒（30,000ミリ秒）
- **スコープ**: スクリプトレベル
- **用途**: 並行処理時の競合防止

### メモリ最適化

- **添付資料サイズ**: base64エンコード時のメモリ制限に注意（推奨: < 10MB）
- **プロンプト長**: 適切な長さに調整（過度に長いとトークン消費増）

## セキュリティ

### 認証

1. **Vertex AI API**
   - OAuth2認証（`ScriptApp.getOAuthToken()`）
   - GCPプロジェクトのサービスアカウント権限が必要

2. **AppSheet API**
   - ApplicationAccessKeyによる認証
   - 現在はコード内にハードコード（本番環境ではScript Properties推奨）

3. **Webhook**
   - 認証なし（公開URL）
   - 必要に応じてシークレットトークン検証の追加を検討

### データ保護

- APIキー/アクセスキーはコード内に記述（セキュリティリスク）
- 実行ログには機密情報（氏名、生年月日など）が含まれる
- スプレッドシートへのアクセス権限を適切に設定

### OAuthスコープ

**必須スコープ（appsscript.json）:**

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/cloud-platform"
  ]
}
```

## 制限事項

### Google Apps Script制限

- **実行時間**: 最大6分（Webhook）
- **URL Fetchサイズ**: 50MB
- **同時実行**: ユーザーあたり30
- **ScriptPropertiesサイズ**: 合計約9KB

### Vertex AI制限

- **トークン制限**: maxOutputTokens 8192
- **レート制限**: GCPプロジェクトごとのクォータ
- **ファイルサイズ**: base64エンコード時のメモリ制限

### AppSheet API制限

- **レート制限**: API呼び出し回数の制限あり
- **ペイロードサイズ**: 大きすぎると失敗

### 推奨事項

- 大量データ処理は分割実行
- タイムアウト対策としてエラーハンドリングを適切に実装
- 定期的にScriptPropertiesのクリーンアップを実行

## テスト

### 単体テスト

**テスト関数:**

```javascript
function testProcessRequest() {
  const testParams = {
    requestId: 'CR-TEST001',
    clientInfoTemp: '山田太郎様、昭和30年5月10日生まれ、男性、要介護3、電話: 090-1234-5678（本人）、生活保護受給中',
    requestReason: '新規利用者の登録依頼',
    documentFileId: null,
    staffId: 'STF-001',
    providerOffice: 'フラクタル訪問看護ステーション'
  };

  return CommonTest.runTest(processRequest, testParams, 'Appsheet_利用者_反映');
}
```

**実行方法:** GASエディタから直接実行

### 統合テスト

AppSheetから実際のWebhookを送信してテストします。

**テスト手順:**

1. AppSheetアプリで新しい依頼を作成
2. Webhookが自動的にトリガーされる
3. 実行ログスプレッドシートで結果を確認
4. AppSheetのClientsテーブルに新しい利用者が作成されたことを確認
5. 依頼のステータスが「反映済み」になったことを確認

## 保守

### ログ確認

**定期的に実行ログスプレッドシートを確認:**

- エラー率（エラー数 / 全実行数）
- 実行時間の傾向（平均、最大、最小）
- 重複リクエストの頻度
- エラーメッセージのパターン分析

### ScriptPropertiesクリーンアップ

**トリガー設定:** 毎日実行

```javascript
function cleanupOldDuplicationFlags() {
  // script_properties_manager.gsで実装
}
```

### アップデート手順

1. スクリプトを更新
2. ローカルでテスト（testProcessRequestDirect()）
3. デプロイメント作成（`python deploy_unified.py Appsheet_利用者_反映 "v##: 説明"`）
4. AppSheetから実際のテスト実行
5. ログで動作確認

## 付録

### 設定値

| 項目 | 値 |
|------|-----|
| 実行ログスプレッドシートID | 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE |
| GCPプロジェクトID | macro-shadow-458705-v8 |
| GCPロケーション | us-central1 |
| Vertex AIモデル | gemini-2.5-pro |
| キャッシュ有効期限 | 86400秒（24時間） |
| ロックタイムアウト | 30000ミリ秒（30秒） |

### 関連リソース

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [AppSheet Automation](https://help.appsheet.com/en/collections/1885643-automation)
- [Vertex AI Gemini API](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [CLAUDE.md](../../../CLAUDE.md) - プロジェクト全体のガイド

### バージョン履歴

- **2025-10-18**: Google AI Studio API削除、Vertex AI完全移行
- **2025-10-21**: ドキュメント全面更新（README、SPECIFICATIONS、FLOW）
