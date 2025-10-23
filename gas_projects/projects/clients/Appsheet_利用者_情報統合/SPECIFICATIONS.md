# Appsheet_利用者_情報統合 - 技術仕様書

## 概要

OCRテキストから利用者基本情報と家族情報をVertex AI（Gemini 2.5 Flash）で抽出し、AppSheetのClientsテーブルとClient_Family_Membersテーブルに反映する統合処理システム。

## システムアーキテクチャ

### コンポーネント構成

```
┌─────────────────────────────────────────────┐
│    外部システム / GASエディタ                 │
│    - updateClientInfo()                     │
│    - updateFamilyInfo()                     │
│    - updateClientAndFamily()                │
└─────────────────────────────────────────────┘
                     │
                     ▼ 関数呼び出し
┌─────────────────────────────────────────────┐
│         main.gs: メイン処理ロジック          │
│         - パラメータ検証                     │
│         - 既存データ取得                     │
│         - AI情報抽出                         │
│         - データ更新                         │
│         - 実行ログ記録                       │
└─────────────────────────────────────────────┘
                     │
                     ▼
       ┌─────────────┴─────────────┐
       │                           │
       ▼                           ▼
┌─────────────────┐   ┌─────────────────────────┐
│  Vertex AI      │   │  AppSheet API           │
│  (Gemini 2.5    │   │  - Find (既存データ取得) │
│   Flash)        │   │  - Add (新規追加)        │
│  - OAuth2認証   │   │  - Edit (既存更新)       │
│  - JSON出力     │   │                         │
│  - コスト追跡   │   │                         │
└─────────────────┘   └─────────────────────────┘
       │                           │
       ▼                           ▼
┌─────────────────┐   ┌─────────────────────────┐
│ 実行ログ        │   │  AppSheetテーブル       │
│ スプレッドシート│   │  - Clients              │
│ (コスト情報含む)│   │  - Client_Family_Members│
└─────────────────┘   └─────────────────────────┘
```

## 処理モード

### 1. 利用者基本情報のみ更新

**関数:** `updateClientInfo(clientId, ocrText)`

- 利用者の基本情報（氏名、生年月日、電話番号など）のみを更新
- 既存情報と比較して変更箇所のみ抽出
- 家族情報は処理しない

**処理フロー:**
1. 既存の利用者情報を取得（AppSheet Find API）
2. Vertex AIで利用者情報を抽出（既存情報を提供）
3. Clientsテーブルを更新（AppSheet Edit API）
4. 実行ログを記録（コスト情報含む）

### 2. 家族情報のみ更新

**関数:** `updateFamilyInfo(clientId, ocrText)`

- 家族情報のみを処理
- 既存家族と名前で照合して、新規追加/更新を判断
- 利用者基本情報は処理しない

**処理フロー:**
1. 既存の家族情報を取得（AppSheet Find API）
2. Vertex AIで家族情報を抽出（既存情報を提供）
3. Geminiのactionフィールド（add/update）に基づいて処理
4. Client_Family_Membersテーブルを更新（AppSheet Add/Edit API）
5. 実行ログを記録（コスト情報含む）

### 3. 利用者＋家族統合更新

**関数:** `updateClientAndFamily(clientId, ocrText)`

- 利用者基本情報と家族情報を一度に処理
- 最も効率的な処理モード（1回のAI呼び出しで完結）

**処理フロー:**
1. 既存の利用者情報と家族情報を取得
2. Vertex AIで両方の情報を統合抽出
3. Clientsテーブルを更新
4. Client_Family_Membersテーブルを更新
5. 実行ログを記録（コスト情報含む）

## API仕様

### 関数シグネチャ

#### updateClientInfo

```javascript
/**
 * 利用者基本情報のみを更新
 *
 * @param {string} clientId - 利用者ID（例: "CLI-12345678"）
 * @param {string} ocrText - OCRで読み取ったテキスト
 * @returns {Object} JSON形式の処理結果
 */
function updateClientInfo(clientId, ocrText)
```

#### updateFamilyInfo

```javascript
/**
 * 家族情報のみを更新
 *
 * @param {string} clientId - 利用者ID
 * @param {string} ocrText - OCRで読み取ったテキスト
 * @returns {Object} JSON形式の処理結果
 */
function updateFamilyInfo(clientId, ocrText)
```

#### updateClientAndFamily

```javascript
/**
 * 利用者基本情報＋家族情報の両方を更新
 *
 * @param {string} clientId - 利用者ID
 * @param {string} ocrText - OCRで読み取ったテキスト
 * @returns {Object} JSON形式の処理結果
 */
function updateClientAndFamily(clientId, ocrText)
```

### レスポンスフォーマット

#### 成功時

```json
{
  "status": "success",
  "clientUpdated": true,
  "familyMembersAdded": 1,
  "familyMembersUpdated": 0,
  "timestamp": "2025-10-21T12:34:56.789Z"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| status | String | "success"固定 |
| clientUpdated | Boolean | 利用者情報が更新されたか |
| familyMembersAdded | Number | 追加された家族の数 |
| familyMembersUpdated | Number | 更新された家族の数 |
| timestamp | String | 処理時刻（ISO 8601形式） |

#### エラー時

```json
{
  "status": "error",
  "error": "エラーメッセージ",
  "timestamp": "2025-10-21T12:34:56.789Z"
}
```

## データモデル

### Clientsテーブル（利用者基本情報）

#### 更新対象カラム

| カラム名 | 型 | 説明 |
|---------|-----|------|
| last_name | String | 利用者の姓 |
| first_name | String | 利用者の名 |
| last_name_kana | String | 姓のカタカナ |
| first_name_kana | String | 名のカタカナ |
| gender | String | 性別（男性/女性） |
| birth_date | String | 生年月日（YYYY-MM-DD形式） |
| birth_date_nengo | String | 元号（昭和/平成/令和） |
| birth_date_nengo_year | String | 元号の年（例: 45） |
| age | Number | 満年齢 |
| phone1 | String | 主な電話番号 |
| phone1_destination | String | 電話番号1の宛先（例: 自宅/携帯） |
| phone2 | String | その他の電話番号 |
| phone2_destination | String | 電話番号2の宛先 |
| email | String | 連絡用メールアドレス |
| primary_contact_person | String | 主要連絡者の氏名 |
| special_notes | String | 特記事項 |
| care_level_name | String | 要介護度（例: 要介護１） |
| end_of_visit_date | String | 訪問終了日 |

#### 更新対象外カラム

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

### Client_Family_Membersテーブル（家族情報）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| family_member_id | String | 家族ID（CLFM-xxxxxxxx形式） |
| client_id | String | 利用者ID |
| action | String | 処理種別（add/update）※Geminiが決定、DB保存時は削除 |
| relationship | String | 続柄（例: 妻/長男） |
| last_name | String | 家族の姓 |
| first_name | String | 家族の名 |
| last_name_kana | String | 姓カナ（カタカナ） |
| first_name_kana | String | 名カナ（カタカナ） |
| is_cohabiting | String | 同居の有無（同居/別居） |
| living_area | String | 在住エリア |
| phone1 | String | 電話番号1 |
| phone2 | String | 電話番号2 |
| email | String | メールアドレス |
| preferred_contact_method | String | 希望連絡手段 |
| available_contact_time | String | 連絡可能時間帯 |
| wants_email_updates | String | メール配信希望（Y/N） |
| emergency_contact_priority | String | 緊急連絡優先順位 |
| is_key_person | String | キーパーソンか（Y/N） |
| relationship_details | String | 関係性詳細 |
| has_caution_notes | String | 注意点有無（Y/N） |
| caution_notes | String | 注意点詳細 |

## Vertex AI統合

### 認証

**方式:** OAuth2（`ScriptApp.getOAuthToken()`）

**必須スコープ:**
```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}
```

### エンドポイント

```
https://{location}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models/{model}:generateContent
```

**設定値:**
- Project ID: `macro-shadow-458705-v8`
- Location: `us-central1`
- Model: `gemini-2.5-flash`

### リクエストフォーマット

```javascript
{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "プロンプト" }]
    }
  ],
  "generationConfig": {
    "responseMimeType": "application/json",
    "temperature": 0.1,
    "maxOutputTokens": 8192
  }
}
```

### プロンプト戦略

#### 利用者基本情報抽出

**入力:**
- OCRテキスト
- 既存の利用者情報（比較用）

**出力:**
- JSON形式の利用者情報
- 既存情報と同じ内容の場合は`null`

**プロンプト特徴:**
- カタカナ出力の明示的指示
- 日付の正規化（YYYY-MM-DD形式）
- 満年齢の自動計算
- 元号の抽出と変換

#### 家族情報抽出

**入力:**
- OCRテキスト
- 既存の家族情報配列（照合用）

**出力:**
- JSON形式の家族情報配列
- 各家族に`action`フィールド付き（add/update）
- 更新の場合は`family_member_id`を含む

**自動判断機能:**
- 名前の照合（表記揺れ対応）
- 新規追加/既存更新の判定
- 空欄フィールドのみ補完

### コスト追跡

#### トークン使用量の記録

| 項目 | 説明 |
|-----|------|
| Input Tokens | プロンプト（既存データ + OCRテキスト）のトークン数 |
| Output Tokens | Geminiの応答のトークン数 |
| Input料金(円) | Input Tokens × 単価 × 150円 |
| Output料金(円) | Output Tokens × 単価 × 150円 |
| 合計料金(円) | Input料金 + Output料金 |

#### 価格表（2025年1月時点）

| モデル | Input (USD/1M tokens) | Output (USD/1M tokens) | Input (円/1M tokens) | Output (円/1M tokens) |
|--------|----------------------|----------------------|---------------------|---------------------|
| Gemini 2.5 Flash | $0.075 | $0.30 | ¥11.25 | ¥45.00 |
| Gemini 2.5 Pro | $1.25 | $10.00 | ¥187.50 | ¥1500.00 |

**為替レート:** 1 USD = 150 JPY

#### エラー時のコスト記録

処理が失敗した場合でも、Vertex AIからのレスポンスにトークン数情報が含まれていれば、コストを記録します。

## AppSheet API統合

### 設定

```javascript
const APPSHEET_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';
const APPSHEET_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';
```

### エンドポイント

```
https://api.appsheet.com/api/v2/apps/{appId}/tables/{tableName}/Action
```

### アクション

#### Find（既存データ取得）

```javascript
{
  "Action": "Find",
  "Properties": { "Locale": "ja-JP" },
  "Selector": "FILTER(Clients, [client_id] = \"CLI-12345678\")"
}
```

#### Add（新規追加）

```javascript
{
  "Action": "Add",
  "Properties": { "Locale": "ja-JP" },
  "Rows": [
    {
      "family_member_id": "CLFM-12345678",
      "client_id": "CLI-12345678",
      "relationship": "妻",
      "last_name": "山田",
      "first_name": "花子"
    }
  ]
}
```

#### Edit（既存更新）

```javascript
{
  "Action": "Edit",
  "Properties": { "Locale": "ja-JP" },
  "Rows": [
    {
      "client_id": "CLI-12345678",
      "phone1": "03-1234-5678",
      "age": 75
    }
  ]
}
```

## 実行ログ記録

### ログスプレッドシート設定

```javascript
const EXECUTION_LOG_SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA';
const EXECUTION_LOG_SHEET_NAME = '実行履歴_利用者情報統合';
```

### 記録項目

| カラム | 説明 |
|-------|------|
| タイムスタンプ | 処理開始時刻 |
| スクリプト名 | "Appsheet_利用者_情報統合"固定 |
| ステータス | "成功"/"失敗" |
| 利用者ID | 処理対象の利用者ID |
| 利用者名 | 利用者の氏名 |
| 処理種別 | "利用者基本情報更新"/"家族情報更新"/"利用者＋家族統合更新" |
| 更新件数 | 更新されたレコード数 |
| 処理時間（秒） | 実行時間（秒） |
| エラーメッセージ | エラー時のメッセージ |
| モデル名 | 使用したVertex AIモデル |
| 実行ユーザー | スクリプト実行ユーザー |
| Input Tokens | プロンプトのトークン数 |
| Output Tokens | 応答のトークン数 |
| Input料金(円) | Input Tokensのコスト |
| Output料金(円) | Output Tokensのコスト |
| 合計料金(円) | 合計コスト |

## エラーハンドリング

### エラータイプ

1. **パラメータエラー**
   - 原因: clientIdまたはocrTextが未指定/空文字列
   - エラーメッセージ例: `"clientIdは必須です（文字列）"`
   - 対処: パラメータを正しく指定

2. **Vertex AIエラー**
   - 原因: API呼び出し失敗、レスポンスパースエラー
   - エラーメッセージ例: `"Vertex AI APIエラー (400): Invalid request"`
   - 対処: プロンプト内容、認証情報、クォータを確認

3. **AppSheet APIエラー**
   - 原因: テーブル名誤り、データ型不一致、権限不足
   - エラーメッセージ例: `"AppSheet API (Clients) エラー (400): Invalid column"`
   - 対処: テーブル構造、アクセスキー、データ型を確認

4. **JSONパースエラー**
   - 原因: Geminiの応答がJSON形式でない
   - エラーメッセージ例: `"AI応答からJSONを抽出できませんでした"`
   - 対処: プロンプトの`responseMimeType: "application/json"`を確認

### エラーログ記録

エラー時でも以下の情報を記録：
- エラーメッセージ
- スタックトレース
- トークン使用量（Vertex AIエラーの場合）
- コスト情報（利用可能な場合）

## パフォーマンス

### 実行時間

| 処理モード | 平均実行時間 | 備考 |
|----------|------------|------|
| 利用者基本情報のみ | 3〜5秒 | Vertex AI: 1〜2秒 + AppSheet: 1〜2秒 |
| 家族情報のみ | 4〜6秒 | 家族数により変動 |
| 統合更新 | 5〜8秒 | 最も効率的（1回のAI呼び出し） |

### 制限事項

1. **GAS実行時間**: 最大6分（通常の処理では十分）
2. **Vertex AIクォータ**:
   - ユーザーあたりのクエリ数: 制限なし（GCPプロジェクトのクォータに依存）
   - プロジェクトあたりのクエリ数: 60/分（デフォルト）
3. **AppSheet APIクォータ**:
   - 無料プラン: 1,200リクエスト/月
   - 有料プラン: 制限緩和

## セキュリティ

### アクセス制御

1. **GASの実行権限**
   - スクリプト実行ユーザー: スクリプトのオーナー
   - Vertex AI権限: GCPプロジェクトのIAM設定に依存

2. **OAuth Scope**
   - `https://www.googleapis.com/auth/cloud-platform` - Vertex AI
   - `https://www.googleapis.com/auth/script.external_request` - AppSheet API
   - `https://www.googleapis.com/auth/spreadsheets` - ログ記録

3. **AppSheet API認証**
   - ApplicationAccessKey方式
   - キーは環境変数で管理推奨

### データ保護

- 利用者情報はAppSheet内のみで管理
- Vertex AIへの送信データはトランスポート層で暗号化
- ログスプレッドシートへのアクセス制限設定推奨

## テスト

### 手動テスト（GASエディタ）

#### 利用者基本情報のみ更新

```javascript
function testUpdateClientInfo() {
  const clientId = "CLI-xxxxxxxx";  // 実際の利用者ID
  const ocrText = `
    氏名: 山田太郎（ヤマダタロウ）
    生年月日: 1950年1月1日（昭和25年）
    性別: 男性
    電話番号: 03-1234-5678（自宅）
  `;

  const result = updateClientInfo(clientId, ocrText);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
```

#### 家族情報のみ更新

```javascript
function testUpdateFamilyInfo() {
  const clientId = "CLI-xxxxxxxx";
  const ocrText = `
    家族情報:
    - 妻: 山田花子（ヤマダハナコ）
      電話: 090-9876-5432
      同居: 同居
      キーパーソン: Y
  `;

  const result = updateFamilyInfo(clientId, ocrText);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
```

#### 統合更新

```javascript
function testUpdateClientAndFamily() {
  const clientId = "CLI-xxxxxxxx";
  const ocrText = `
    【基本情報】
    氏名: 山田太郎（ヤマダタロウ）
    要介護度: 要介護3

    【家族情報】
    - 妻: 山田花子、同居、キーパーソン
  `;

  const result = updateClientAndFamily(clientId, ocrText);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
```

## デプロイ

### 通常デプロイ

```bash
cd "gas_projects/projects/clients/Appsheet_利用者_情報統合"
clasp push --force
```

### 統合デプロイツール

```bash
cd gas_projects
python deploy_unified.py "Appsheet_利用者_情報統合" "v2: 家族情報のaction判定を改善"
```

## トラブルシューティング

### よくある問題

#### 問題1: "Vertex AI APIエラー (403): Permission denied"

**原因:** GCPプロジェクトでVertex AIが有効化されていない、または権限不足

**対処:**
1. GCPコンソールでVertex AIを有効化
2. サービスアカウントに`Vertex AI User`ロールを付与
3. OAuth2のスコープ設定を確認

#### 問題2: "AppSheet API (Clients) エラー (400): Invalid column"

**原因:** テーブルのカラム名が誤っている、または存在しない

**対処:**
1. AppSheetでClientsテーブルのカラム名を確認
2. `getTableColumns()`関数でカラム一覧を取得して確認
3. `EXCLUDED_CLIENT_COLUMNS`に該当カラムを追加

#### 問題3: "AI応答からJSONを抽出できませんでした"

**原因:** Geminiの応答がJSON形式でない、またはマーカーが含まれる

**対処:**
1. プロンプトで`responseMimeType: "application/json"`を確認
2. temperature設定を低くする（0.1推奨）
3. Geminiの応答をログで確認

#### 問題4: "家族情報が重複して追加される"

**原因:** Geminiの名前照合が失敗している

**対処:**
1. 既存家族情報をプロンプトで明示的に提供
2. 名前の表記揺れ対応を強化
3. `processFamilyMembersWithAction()`で手動マッチング実装

## バージョン履歴

### v1.0.0 (2025-10-21)
- 初回リリース
- 3つの処理モード実装
- Vertex AI統合（Gemini 2.5 Flash）
- コスト追跡機能実装
- 既存データ比較機能実装
- 家族情報のaction自動判定機能

## 関連ドキュメント

- [README.md](./README.md) - ユーザー向けドキュメント
- [FLOW.md](./FLOW.md) - 処理フロー図
- [実行ログスプレッドシート](https://docs.google.com/spreadsheets/d/16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA/edit)

## 技術スタック

- **言語**: JavaScript（Google Apps Script）
- **ランタイム**: V8 Engine
- **AI**: Vertex AI（Gemini 2.5 Flash）
- **API**:
  - AppSheet API v2
  - Vertex AI API
  - Google Sheets API
- **デプロイ**: Clasp
- **バージョン管理**: Git

## ライセンス

Fractal Group Internal Use Only
