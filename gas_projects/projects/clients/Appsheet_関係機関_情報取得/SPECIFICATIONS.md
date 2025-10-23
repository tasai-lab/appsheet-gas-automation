# 技術仕様書 - Appsheet_関係機関_情報取得

## 目次

- [システムアーキテクチャ](#システムアーキテクチャ)
- [API仕様](#api仕様)
- [データモデル](#データモデル)
- [Google Places API統合](#google-places-api統合)
- [AppSheet API統合](#appsheet-api統合)
- [エラーハンドリング](#エラーハンドリング)
- [パフォーマンス](#パフォーマンス)
- [セキュリティ](#セキュリティ)
- [デプロイメント](#デプロイメント)

## システムアーキテクチャ

### コンポーネント構成

```
┌─────────────────┐
│   AppSheet      │
│   (Webhook)     │
└────────┬────────┘
         │ POST
         ▼
┌─────────────────────────────────────┐
│  Google Apps Script                 │
│  ┌───────────────────────────────┐  │
│  │ main.gs                       │  │
│  │ - doPost()                    │  │
│  │ - processRequest()            │  │
│  └───────┬───────────────────────┘  │
│          │                          │
│  ┌───────▼───────────────────────┐  │
│  │ duplication_prevention.gs     │  │
│  │ - executeWithRetry()          │  │
│  └───────┬───────────────────────┘  │
│          │                          │
│  ┌───────▼───────────────────────┐  │
│  │ places_api_service.gs         │  │
│  │ - getPlaceDetails()           │  │
│  │ - formatOpeningHours()        │  │
│  └───────┬───────────────────────┘  │
│          │                          │
│  ┌───────▼───────────────────────┐  │
│  │ appsheet_service.gs           │  │
│  │ - updateOrganization()        │  │
│  └───────┬───────────────────────┘  │
│          │                          │
│  ┌───────▼───────────────────────┐  │
│  │ execution_logger.gs           │  │
│  │ - saveToSpreadsheet()         │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         │                  │
         ▼                  ▼
┌─────────────────┐  ┌──────────────────┐
│ Google Places   │  │   AppSheet       │
│ API (New)       │  │   Database       │
└─────────────────┘  └──────────────────┘
```

### ファイル構成

```
Appsheet_関係機関_情報取得/
├── appsscript.json              # マニフェスト
├── .clasp.json                  # Clasp設定
├── project_metadata.json        # プロジェクトメタデータ
├── README.md                    # ユーザー向けドキュメント
├── SPECIFICATIONS.md            # 技術仕様書（本ファイル）
├── FLOW.md                      # 処理フロー図
└── scripts/
    ├── main.gs                  # メインエントリーポイント
    ├── config.gs                # 設定定数
    ├── places_api_service.gs    # Places API統合
    ├── appsheet_service.gs      # AppSheet API統合
    ├── execution_logger.gs      # 実行ログ記録
    ├── duplication_prevention.gs # 重複防止
    └── test_functions.gs        # テスト関数
```

## API仕様

### Webhook API

#### エンドポイント

```
POST https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

#### リクエスト

**ヘッダー:**
```
Content-Type: application/json
```

**ボディ:**
```json
{
  "org_id": "ORG-12345",
  "common_name": "トヨタ自動車株式会社",
  "full_address": "〒471-8571 愛知県豊田市トヨタ町1番地"
}
```

**パラメータ仕様:**

| フィールド | 型 | 必須 | 説明 | 例 |
|----------|------|------|------|-----|
| `org_id` | string | ✓ | 組織ID | "ORG-12345" |
| `common_name` | string | ✓ | Google Mapでの登録名称 | "トヨタ自動車株式会社" |
| `full_address` | string | ✓ | 郵便番号＋所在地 | "〒471-8571 愛知県豊田市トヨタ町1番地" |

#### レスポンス

**成功時 (200 OK):**
```
OK
```

**重複検出時 (200 OK):**
```
重複実行
```

**エラー時 (200 OK):**
```
ERROR
```

※ GASのdoPost関数は常に200を返すため、ステータスコードではなくレスポンステキストでエラーを判定

## データモデル

### 入力データ構造

```typescript
interface WebhookRequest {
  org_id: string;           // 組織ID
  common_name: string;      // Google Map登録名称
  full_address: string;     // 郵便番号＋所在地
}
```

### Places APIレスポンス構造

```typescript
interface PlaceData {
  postal_code: string | null;      // 郵便番号（xxx-xxxx形式）
  address: string;                 // 所在地（郵便番号除く）
  latlong: string | null;          // 緯度経度（カンマ区切り）
  main_phone: string | null;       // 電話番号
  website_url: string | null;      // ウェブサイトURL
  operating_hours: string | null;  // 営業時間（整形済み）
  error?: string;                  // エラーメッセージ（エラー時のみ）
}
```

### AppSheet更新データ構造

```typescript
interface OrganizationUpdate {
  org_id: string;                  // 組織ID（必須）
  postal_code?: string;            // 郵便番号
  address?: string;                // 所在地
  latlong?: string;                // 緯度経度
  main_phone?: string;             // 電話番号
  website_url?: string;            // ウェブサイトURL
  operating_hours?: string;        // 営業時間
  info_accuracy: string;           // 情報精度（固定値: "確認済"）
}
```

## Google Places API統合

### Places API (New) 仕様

**エンドポイント:**
```
POST https://places.googleapis.com/v1/places:searchText
```

**認証:**
- APIキーヘッダー: `X-Goog-Api-Key`

**リクエスト:**
```json
{
  "textQuery": "トヨタ自動車株式会社 愛知県豊田市トヨタ町1番地",
  "languageCode": "ja"
}
```

**ヘッダー:**
```
X-Goog-Api-Key: {API_KEY}
X-Goog-FieldMask: places.location,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.regularOpeningHours
```

**レスポンス:**
```json
{
  "places": [
    {
      "location": {
        "latitude": 35.0833,
        "longitude": 137.1556
      },
      "formattedAddress": "愛知県豊田市トヨタ町1番地",
      "nationalPhoneNumber": "0565-28-2121",
      "websiteUri": "https://www.toyota.co.jp/",
      "regularOpeningHours": {
        "periods": [
          {
            "open": { "day": 1, "hour": 9, "minute": 0 },
            "close": { "day": 1, "hour": 18, "minute": 0 }
          }
        ]
      }
    }
  ]
}
```

### 郵便番号抽出ロジック

**正規表現:**
```javascript
/〒?(\d{3})-?(\d{4})/
```

**対応フォーマット:**
- `〒471-8571`
- `4718571`
- `471-8571`

**整形後:**
```
471-8571
```

### 営業時間整形ロジック

**入力形式 (Places API):**
```json
{
  "periods": [
    {
      "open": { "day": 1, "hour": 9, "minute": 0 },
      "close": { "day": 1, "hour": 18, "minute": 0 }
    }
  ]
}
```

**出力形式:**
```
月曜日: 09時00分～18時00分
火曜日: 09時00分～18時00分
水曜日: 09時00分～18時00分
木曜日: 09時00分～18時00分
金曜日: 09時00分～18時00分
土曜日: 定休日
日曜日: 定休日
```

**曜日マッピング:**
```javascript
const weekdays = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
```

## AppSheet API統合

### AppSheet API仕様

**エンドポイント:**
```
POST https://api.appsheet.com/api/v2/apps/{APP_ID}/tables/{TABLE_NAME}/Action
```

**認証:**
- ヘッダー: `ApplicationAccessKey: {ACCESS_KEY}`

**リクエスト (Edit Action):**
```json
{
  "Action": "Edit",
  "Properties": {
    "Locale": "ja-JP",
    "Timezone": "Asia/Tokyo"
  },
  "Rows": [
    {
      "org_id": "ORG-12345",
      "postal_code": "471-8571",
      "address": "愛知県豊田市トヨタ町1番地",
      "latlong": "35.0833,137.1556",
      "main_phone": "0565-28-2121",
      "website_url": "https://www.toyota.co.jp/",
      "operating_hours": "月曜日: 09時00分～18時00分\n...",
      "info_accuracy": "確認済"
    }
  ]
}
```

**レスポンス (成功時):**
```json
{
  "Rows": [
    {
      "org_id": "ORG-12345",
      ...
    }
  ]
}
```

### Editアクションの動作

- `org_id`をキーとして既存レコードを検索
- 見つかった場合: 更新
- 見つからない場合: エラー（Addアクションではない）

## エラーハンドリング

### エラーの種類

#### 1. パラメータエラー

**発生条件:**
- 必須パラメータ（org_id, common_name, full_address）が不足

**処理:**
```javascript
throw new Error('必須パラメータ（org_id, common_name, full_address）が不足しています。');
```

**ログ:**
- ステータス: エラー
- 詳細: パラメータ不足

#### 2. Places APIエラー

**発生条件:**
- API呼び出し失敗（ネットワークエラー、APIキー無効）
- 検索結果なし

**処理:**
```javascript
return { error: 'Places API エラー: ...' };
```

**ログ:**
- ステータス: エラー
- 詳細: APIレスポンス

#### 3. AppSheet APIエラー

**発生条件:**
- API呼び出し失敗（認証エラー、テーブル構造不一致）
- レスポンスコード >= 400

**処理:**
```javascript
throw new Error('AppSheet API エラー: ...');
```

**ログ:**
- ステータス: エラー
- 詳細: APIレスポンス

#### 4. 重複実行エラー

**発生条件:**
- 同じorg_idで処理が既に実行済み
- 同じorg_idで処理が実行中

**処理:**
```javascript
return { isDuplicate: true };
```

**ログ:**
- ステータス: 重複
- 詳細: レコードID

### エラーリトライ戦略

**リトライ条件:**
- Places API: ネットワークエラーのみリトライ
- AppSheet API: 5xx系エラーのみリトライ

**リトライ設定:**
- 最大リトライ回数: 3回
- リトライ間隔: 1秒、2秒、3秒（指数バックオフ）

## パフォーマンス

### 実行時間目標

- 通常処理: 3-5秒
- Places API呼び出し: 1-2秒
- AppSheet API呼び出し: 1-2秒
- ログ記録: 0.5-1秒

### 最適化戦略

1. **キャッシュ利用:**
   - 重複チェックでCacheServiceを優先使用
   - 6時間のキャッシュTTL

2. **並列処理:**
   - 現在は直列処理（Places API → AppSheet API）
   - 将来的に非同期化を検討

3. **データ最小化:**
   - FieldMaskで必要なフィールドのみ取得
   - null値はAppSheet APIに送信しない

### リソース制限

- GAS実行時間制限: 6分（Webhook）
- ScriptPropertiesサイズ制限: 約9KB
- CacheServiceサイズ制限: 100KB

## セキュリティ

### APIキー管理

**Places API Key:**
- `config.gs`に直接記述（プライベートリポジトリのみ）
- 本番環境ではScriptPropertiesに保存推奨

**AppSheet Access Key:**
- `config.gs`に直接記述
- AppSheet側でIP制限を設定推奨

### OAuth認証スコープ

**必要なスコープ:**
```json
[
  "https://www.googleapis.com/auth/script.external_request",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email"
]
```

**スコープの用途:**
- `script.external_request`: Places API / AppSheet API呼び出し
- `spreadsheets`: 実行ログ記録
- `userinfo.email`: ユーザー識別

### データ保護

- **入力検証**: 必須パラメータチェック
- **出力サニタイゼーション**: AppSheet APIに送信する前にnull値を除外
- **ログマスキング**: APIキーはログに記録しない

## デプロイメント

### デプロイ手順

1. **claspでログイン:**
   ```bash
   clasp login
   ```

2. **プロジェクトを作成:**
   ```bash
   cd gas_projects/projects/clients/Appsheet_関係機関_情報取得
   clasp create --type standalone --title "Appsheet_関係機関_情報取得"
   ```

3. **スクリプトをプッシュ:**
   ```bash
   clasp push
   ```

4. **Webアプリとしてデプロイ:**
   ```bash
   clasp deploy --description "v1.0.0: 初回リリース"
   ```

   または、統合デプロイスクリプトを使用:
   ```bash
   cd ../../..
   python deploy_unified.py Appsheet_関係機関_情報取得 "v1: 初回リリース"
   ```

5. **WebアプリURLを取得:**
   ```bash
   clasp deployments
   ```

6. **AppSheetでWebhook URLを設定**

### 設定項目チェックリスト

- [ ] `PLACES_API_KEY`: Google Places APIキー
- [ ] `APPSHEET_APP_ID`: AppSheetアプリID
- [ ] `APPSHEET_ACCESS_KEY`: AppSheet APIアクセスキー
- [ ] `ORGANIZATIONS_TABLE_NAME`: テーブル名（デフォルト: Organizations）
- [ ] `EXECUTION_LOG_SPREADSHEET_ID`: ログスプレッドシートID
- [ ] OAuthスコープの承認

### バージョン管理

- Gitでソースコード管理
- `deployment_versions.json`でデプロイ履歴管理
- バージョン番号形式: `v{major}.{minor}.{patch}`

### ロールバック手順

1. **以前のバージョンを確認:**
   ```bash
   clasp deployments
   ```

2. **デプロイメントを削除:**
   ```bash
   clasp undeploy {DEPLOYMENT_ID}
   ```

3. **以前のバージョンをデプロイ:**
   ```bash
   git checkout {COMMIT_HASH}
   clasp push
   clasp deploy --description "Rollback to v{VERSION}"
   ```

## 監視とメンテナンス

### ログ監視

- **ログスプレッドシート**: `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX`
- **監視項目**:
  - ステータス（成功/エラー/重複）
  - 処理時間
  - エラー詳細

### 定期メンテナンス

- **重複防止データクリーンアップ**: 24時間ごと
- **実行ログクリーンアップ**: 90日以上前のログを削除

### トリガー設定

```javascript
function createCleanupTrigger() {
  ScriptApp.newTrigger('DuplicationPrevention.cleanupOldRecords')
    .timeBased()
    .everyDays(1)
    .create();

  ScriptApp.newTrigger('GASLogger.cleanupOldLogs')
    .timeBased()
    .everyDays(1)
    .create();
}
```

## 今後の拡張予定

1. **非同期処理**: 長時間実行に対応
2. **バッチ処理**: 複数組織の一括処理
3. **Places API詳細検索**: レビュー、写真などの追加情報取得
4. **エラー通知**: Slack/Email通知機能
5. **管理画面**: 処理状況をダッシュボード表示
