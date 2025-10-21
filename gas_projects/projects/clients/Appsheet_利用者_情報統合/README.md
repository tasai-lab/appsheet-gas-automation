# Appsheet_利用者_情報統合

OCRテキストから利用者基本情報と家族情報を抽出し、AppSheetに登録・更新する統合処理

## 概要

OCRで読み取ったテキストから、Vertex AI（Gemini 2.5 Flash）を使用して利用者基本情報と家族情報を抽出し、AppSheetのClientsテーブルとClient_Family_Membersテーブルに反映します。既存情報と比較して新規追加・更新を自動判断します。

## 主な機能

### コア機能

- ✅ **利用者基本情報更新**: OCRテキストから利用者情報を抽出・更新
- ✅ **家族情報の追加・更新**: 家族情報を抽出し、重複チェック付きで追加・更新
- ✅ **統合処理**: 利用者＋家族を一度に処理
- ✅ **既存データ比較**: 既存情報をGeminiに提供し、変更箇所のみ更新
- ✅ **AI判断**: Geminiが自動的に新規追加/更新を判断
- ✅ **コスト追跡**: API使用量（トークン数・料金）を自動記録

### Vertex AI統合

- **モデル**: Gemini 2.5 Flash
- **認証**: OAuth2（`ScriptApp.getOAuthToken()`）
- **入力**: OCRテキスト + 既存データ
- **出力**: JSON形式の更新データ（actionフィールド付き）
- **コスト追跡**: トークン数と料金を日本円で記録

## 処理モード

### 1. 利用者基本情報のみ更新

**関数:** `updateClientInfo(clientId, ocrText)`

- 利用者の基本情報（氏名、生年月日、電話番号など）のみを更新
- 既存情報と比較して変更箇所のみ抽出
- 家族情報は処理しない

### 2. 家族情報のみ更新

**関数:** `updateFamilyInfo(clientId, ocrText)`

- 家族情報のみを処理
- 既存家族と名前で照合して、新規追加/更新を判断
- 利用者基本情報は処理しない

### 3. 利用者＋家族統合更新

**関数:** `updateClientAndFamily(clientId, ocrText)`

- 利用者基本情報と家族情報を一度に処理
- 最も効率的な処理モード（1回のAI呼び出しで完結）

## スクリプトファイル構成

### メイン処理
- [main.gs](./scripts/main.gs): メインロジック（3つの処理モード）
- [ai_operations.gs](./scripts/ai_operations.gs): Vertex AI統合（インライン実装）

### ログ・追跡
- [execution_logger.gs](./scripts/execution_logger.gs): 実行ログ記録（コスト情報含む）
- [logger.gs](./scripts/logger.gs): デバッグログ記録

### その他
- `appsscript.json`: プロジェクトマニフェスト

## 設定

### AppSheet API設定

```javascript
const APPSHEET_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';
const APPSHEET_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';

const CLIENTS_TABLE_NAME = 'Clients';
const FAMILY_TABLE_NAME = 'Client_Family_Members';
```

### Vertex AI設定

```javascript
const GCP_PROJECT_ID = 'macro-shadow-458705-v8';
const GCP_LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash';
```

### 実行ログ設定

```javascript
const EXECUTION_LOG_SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';
const EXECUTION_LOG_SHEET_NAME = '実行履歴_利用者情報統合';
```

**記録項目:**
- タイムスタンプ、スクリプト名、ステータス
- 利用者ID、利用者名、処理種別
- 更新件数、処理時間（秒）
- エラーメッセージ、モデル名、実行ユーザー
- Input Tokens、Output Tokens
- Input料金(円)、Output料金(円)、合計料金(円)

## 使用方法

### 利用者基本情報のみ更新

```javascript
const result = updateClientInfo(
  "CLI-12345678",  // clientId
  "氏名: 山田太郎（ヤマダタロウ）\n生年月日: 1950年1月1日（昭和25年）\n性別: 男性\n電話番号: 03-1234-5678（自宅）"
);

console.log(result);
// {
//   status: 'success',
//   clientUpdated: true,
//   familyMembersAdded: 0,
//   familyMembersUpdated: 0,
//   timestamp: '2025-10-21T12:34:56.789Z'
// }
```

### 家族情報のみ更新

```javascript
const result = updateFamilyInfo(
  "CLI-12345678",
  "家族情報:\n- 妻: 山田花子（ヤマダハナコ）\n  電話: 090-9876-5432\n  同居: 同居\n  キーパーソン: Y"
);
```

### 利用者＋家族統合更新

```javascript
const result = updateClientAndFamily(
  "CLI-12345678",
  "【基本情報】\n氏名: 山田太郎（ヤマダタロウ）\n生年月日: 1950年1月1日\n\n【家族情報】\n妻: 山田花子、同居、キーパーソン"
);
```

## レスポンス形式

### 成功時

```json
{
  "status": "success",
  "clientUpdated": true,
  "familyMembersAdded": 1,
  "familyMembersUpdated": 0,
  "timestamp": "2025-10-21T12:34:56.789Z"
}
```

### エラー時

```json
{
  "status": "error",
  "error": "エラーメッセージ",
  "timestamp": "2025-10-21T12:34:56.789Z"
}
```

## Geminiの自動判断機能

### 家族情報の処理

Geminiが既存家族情報とOCRテキストを比較して、自動的にactionを決定します：

**例:**
```json
{
  "family_members": [
    {
      "action": "add",  // 新規追加
      "relationship": "妻",
      "last_name": "山田",
      "first_name": "花子"
    },
    {
      "action": "update",  // 既存更新
      "family_member_id": "CLFM-12345",
      "phone1": "090-9876-5432"  // 空欄フィールドのみ補完
    }
  ]
}
```

### 利用者情報の処理

既存情報と同じ内容の場合は`null`を設定し、変更箇所のみ更新します。

## 更新対象外カラム

以下のカラムは自動更新の対象外です：

```javascript
const EXCLUDED_CLIENT_COLUMNS = [
  'status', 'date_of_death', 'initial_visit_date', 'contract_office',
  'full_name', 'full_name_kana', 'provider_office', 'insurance_type',
  'is_welfare_recipient', 'mhlw_annex7_disease', 'independence_level',
  'billing_code', 'address_label', 'address_id', 'clinic_id', 'doctor_id',
  'support_office_id', 'care_manager_id', 'service_type', 'main_staff', 'sub_staff'
];
```

## テスト関数

```javascript
// 利用者基本情報のみ更新テスト
testUpdateClientInfo()

// 家族情報のみ更新テスト
testUpdateFamilyInfo()

// 統合更新テスト
testUpdateClientAndFamily()
```

## エラーハンドリング

### エラー時の動作

1. **パラメータエラー**: エラーを投げて処理中断
2. **Vertex AIエラー**: エラーログ記録 + コスト記録
3. **AppSheet APIエラー**: エラーログ記録

### エラーログ記録先

- 実行ログスプレッドシート（16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA）
  - シート: `実行履歴_利用者情報統合`
  - エラー時もトークン数・コストを記録

## コスト追跡

### トークン使用量の記録

- **Input Tokens**: プロンプト（既存データ + OCRテキスト）のトークン数
- **Output Tokens**: Geminiの応答のトークン数
- **料金計算**: USD/100万トークン → 日本円換算（為替レート150円）

### 価格表（2025年1月時点）

| モデル | Input (USD/1M tokens) | Output (USD/1M tokens) |
|--------|----------------------|----------------------|
| Gemini 2.5 Flash | $0.075 | $0.30 |
| Gemini 2.5 Pro | $1.25 | $10.00 |

### エラー時のコスト記録

処理が失敗した場合でも、Vertex AIからのレスポンスにトークン数情報が含まれていれば、コストを記録します。

## 技術仕様

### 必要なAPI
- Vertex AI API (Gemini)
- AppSheet API v2

### GCPプロジェクト
- Project ID: `macro-shadow-458705-v8`
- Location: `us-central1`

## デプロイ

```bash
cd "gas_projects/projects/clients/Appsheet_利用者_情報統合"
clasp push --force
```

## バージョン履歴

### v1.0.0 (2025-10-21)
- 初回リリース
- 3つの処理モード実装
- コスト追跡機能実装
- 既存データ比較機能実装

## ライセンス

Fractal Group Internal Use Only
