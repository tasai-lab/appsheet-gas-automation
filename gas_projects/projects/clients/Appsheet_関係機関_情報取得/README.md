# Appsheet_関係機関_情報取得

Google Mapの登録名称と住所から、Google Places APIで関係機関の詳細情報を取得し、AppSheetのOrganizationsテーブルを更新するGoogle Apps Scriptプロジェクト。

## 目次

- [概要](#概要)
- [主な機能](#主な機能)
- [デバッグ機能](#デバッグ機能)
- [使用方法](#使用方法)
- [パラメータ](#パラメータ)
- [レスポンス](#レスポンス)
- [設定](#設定)
- [テスト方法](#テスト方法)
- [トラブルシューティング](#トラブルシューティング)

## 概要

このプロジェクトは、AppSheetから送信されるWebhookを受け取り、Google Places APIを使用して施設情報を取得し、AppSheetのOrganizationsテーブルに詳細情報を書き込みます。

### 処理フロー

1. AppSheetからWebhookを受信（org_id, common_name, full_address）
2. 住所から郵便番号を抽出・整形
3. Google Places API (New) で施設情報を検索
4. 取得した情報（緯度経度、電話番号、ウェブサイト、営業時間）を整形
5. AppSheet Organizationsテーブルを更新

## 主な機能

### 1. Google Places API統合

- **Places API (New)**: 最新のPlaces APIを使用
- **テキスト検索**: 施設名と住所で検索
- **詳細情報取得**: 緯度経度、電話番号、ウェブサイト、営業時間を取得

### 2. データ整形

- **郵便番号抽出**: 住所から郵便番号を抽出し、`xxx-xxxx`形式に整形
- **住所クリーニング**: 郵便番号を除いた住所部分を抽出
- **営業時間整形**: API形式から日本語形式に変換

### 3. 重複防止

- リクエストIDベースの重複検出
- ScriptPropertiesとCacheServiceを使用
- 最大3回のリトライ機能

### 4. 実行ログ記録（共通モジュールパターン）

統合コスト管理シートに詳細な実行履歴とコスト情報を記録します。

#### 主な機能
- **ExecutionTimer**: 経過時間を秒単位で正確に計測
- **ログヘルパー関数**: logStart, logSuccess, logFailure, logSkip
- **コスト計算**: Places APIの料金を自動計算（USD/JPY）
- **デバッグ情報**: デバッグモード時は詳細ログを備考欄に記録

#### 記録される情報
| 項目 | 説明 |
|------|------|
| タイムスタンプ | 実行日時 |
| スクリプト名 | Appsheet_関係機関_情報取得 |
| ステータス | 成功/失敗/スキップ/処理中 |
| レコードID | 組織ID |
| 処理時間(秒) | ExecutionTimerで計測 |
| モデル名 | Places API (New) - Text Search |
| 合計料金(円) | API呼び出し回数 × 単価（¥4.8/回） |
| 処理種別 | Places API検索 |
| ファイル名 | 検索クエリ（施設名 + 住所） |
| 処理結果 | API呼び出し: X回 |
| ログサマリー | 組織ID: XXX |
| エラー詳細 | エラーメッセージとスタック |
| 実行ユーザー | 実行者のメールアドレス |
| 備考 | USD料金、キャッシュ使用状況、デバッグ情報 |

#### コスト情報の例
```
合計料金(円): 4.80
備考: USD: $0.0320, キャッシュ使用: いいえ
```

## デバッグ機能

### 概要

詳細なデバッグ情報を記録・出力する機能を搭載。トラブルシューティングと性能分析を支援します。

### デバッグモードの有効化

`config.gs`の設定:

```javascript
const DEBUG_MODE = true;  // デバッグモード有効
const DEBUG_MODE = false; // 本番環境（推奨）
```

### デバッグロガーの機能

#### 1. **タイムスタンプ付きログ**
- ミリ秒単位の実行時間を記録
- 各ステップの経過時間を追跡

#### 2. **API呼び出しの詳細記録**
- リクエストURL、メソッド、ヘッダー
- レスポンスステータス、実行時間
- APIキーは自動的にマスク（セキュリティ）

#### 3. **キャッシュ操作のトレース**
- キャッシュヒット/ミスを記録
- キャッシュキーとデータサイズを追跡

#### 4. **データ変換の可視化**
- 入力データと出力データを記録
- 各変換ステップを追跡

#### 5. **エラー詳細情報**
- エラーメッセージとスタックトレース
- エラー発生時のコンテキスト情報

### デバッグログの出力先

#### 1. **コンソールログ**
デバッグモード有効時、GASエディタのログに詳細情報が出力されます:

```
[2025-10-23 20:08:47.123] [0ms] [INFO] [doPost] --- Webhook受信 ---
[2025-10-23 20:08:47.125] [2ms] [DEBUG] [doPost] リクエストボディ解析開始
[2025-10-23 20:08:47.150] [27ms] [INFO] [processRequest] --- 処理開始 ---
[2025-10-23 20:08:47.200] [77ms] [INFO] [getPlaceDetails] キャッシュHIT: places_トヨタ自動車_愛知県豊田市
```

#### 2. **実行ログスプレッドシート**
統合コスト管理シートの「備考」列に、デバッグサマリーが記録されます:

```
[デバッグ情報]
実行時間: 1250ms
ログ数: 25 (エラー: 0, 警告: 1)

[警告]
2025-10-23 20:08:47: キャッシュミス: places_xxx

---
USD: $0.0320, キャッシュ使用: いいえ
```

#### 3. **処理結果オブジェクト**
`processRequest()`の戻り値に、デバッグログの配列が含まれます:

```javascript
{
  success: true,
  orgId: "ORG-12345",
  placeData: { ... },
  debugLogs: [
    {
      timestamp: "2025-10-23 20:08:47.123",
      elapsed: "0ms",
      level: "INFO",
      context: "processRequest",
      message: "処理開始",
      data: { ... }
    },
    // ... more logs
  ]
}
```

### デバッグログの構造

各ログエントリには以下の情報が含まれます:

```javascript
{
  timestamp: "2025-10-23 20:08:47.123",  // 実行時刻
  elapsed: "127ms",                       // 開始からの経過時間
  level: "INFO",                          // ログレベル (INFO/DEBUG/WARN/ERROR)
  context: "getPlaceDetails",             // コンテキスト（関数名）
  message: "Places API 取得成功",         // メッセージ
  data: {                                 // 追加データ
    postalCode: "471-8571",
    location: "35.0831,137.1537",
    phone: "0565-28-2121"
  }
}
```

### デバッグモードのテスト

`debug_logger.gs`のテスト関数で動作確認:

```javascript
testDebugLogger();
```

実行すると、以下が出力されます:
- サマリー情報（総ログ数、エラー数、実行時間）
- 備考欄用フォーマット
- 全ログJSON

### パフォーマンスへの影響

- **デバッグモードON**: 約100-200ms のオーバーヘッド
- **デバッグモードOFF**: ほぼ影響なし（ロギング処理はスキップされる）

**推奨**: 本番環境では `DEBUG_MODE = false` に設定してください。

### デバッグログの活用例

#### 1. **API呼び出し失敗の調査**
```javascript
// エラーログから、リクエスト内容と応答を確認
{
  level: "ERROR",
  message: "Places APIエラーレスポンス",
  data: {
    statusCode: 400,
    responseBody: "{ 'error': { 'message': 'Invalid request' } }"
  }
}
```

#### 2. **パフォーマンス分析**
```javascript
// 各ステップの実行時間を比較
- Webhook受信: 0ms
- パラメータ解析: 2ms
- 既存データ確認: 150ms  // ボトルネック発見
- Places API呼び出し: 800ms
- AppSheet更新: 300ms
```

#### 3. **キャッシュ効率の測定**
```javascript
// キャッシュヒット率を計算
- 総リクエスト: 100回
- キャッシュHIT: 75回
- キャッシュMISS: 25回
- ヒット率: 75%
```

## 使用方法

### Webhook設定

AppSheetのBehavior > Webhookで以下を設定:

- **URL**: デプロイしたGASのWebアプリURL
- **HTTPメソッド**: POST
- **リクエストボディ**: JSON形式

### Webhookペイロード例

```json
{
  "org_id": "ORG-12345",
  "common_name": "トヨタ自動車株式会社",
  "full_address": "〒471-8571 愛知県豊田市トヨタ町1番地"
}
```

### GASエディタでのテスト

テスト関数を使用して、Webhookなしで動作確認できます:

#### 基本テスト
```javascript
// メイン処理のテスト
testProcessRequest();

// Places API単体テスト
testPlacesApi();

// AppSheet API単体テスト
testAppSheetApi();

// 郵便番号抽出テスト
testPostalCodeExtraction();

// 営業時間整形テスト
testOpeningHoursFormatting();
```

#### 共通モジュールパターンのテスト
```javascript
// ExecutionTimerのテスト
testExecutionTimer();

// コスト計算ヘルパー関数のテスト
testCalculateApiCostDetails();

// ログヘルパー関数のテスト（実際にスプレッドシートに書き込まれます）
testLogHelpers();

// デバッグロガーのテスト
testDebugLogger();
```

**注意**: `testLogHelpers()`は実際に統合コスト管理シートに書き込みを行います。テスト実行後、スプレッドシート（`16swPUizvdlyPxUjbDpVl9-VBDJZO91kX`）を確認してください。

## パラメータ

### 入力パラメータ

| パラメータ名 | 型 | 必須 | 説明 |
|------------|------|------|------|
| `org_id` | string | ✓ | 組織ID（Organizationsテーブルのキー） |
| `common_name` | string | ✓ | Google Mapでの登録名称 |
| `full_address` | string | ✓ | 郵便番号＋所在地 |

### 出力フィールド（AppSheet更新）

| フィールド名 | 型 | 説明 |
|------------|------|------|
| `org_id` | string | 組織ID |
| `postal_code` | string | 郵便番号（xxx-xxxx形式） |
| `address` | string | 所在地（郵便番号を除く） |
| `latlong` | string | 緯度経度（カンマ区切り） |
| `main_phone` | string | 電話番号 |
| `website_url` | string | ウェブサイトURL |
| `operating_hours` | string | 営業時間（整形済みテキスト） |
| `info_accuracy` | string | 情報精度（固定値: "確認済"） |

## レスポンス

### 成功時

```
OK
```

### 重複検出時

```
重複実行
```

### エラー時

```
ERROR
```

## 設定

### Google Places API設定

1. Google Cloud Consoleで新しいプロジェクトを作成
2. Places API (New) を有効化
3. APIキーを作成し、`config.gs`の`PLACES_API_KEY`に設定
4. APIキーの制限を設定（推奨）:
   - **アプリケーションの制限**: なし
   - **APIの制限**: Places API

### AppSheet API設定

`config.gs`で以下を設定:

- `APPSHEET_APP_ID`: AppSheetアプリID
- `APPSHEET_ACCESS_KEY`: AppSheet APIアクセスキー
- `ORGANIZATIONS_TABLE_NAME`: テーブル名

### OAuth認証スコープ

`appsscript.json`で必要なスコープを定義:

- `https://www.googleapis.com/auth/script.external_request`
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/userinfo.email`

## テスト方法

### 1. Places API動作確認

```javascript
testPlacesApi();
```

実行ログでPlaces APIのレスポンスを確認できます。

### 2. AppSheet API動作確認

```javascript
testAppSheetApi();
```

テスト組織データがAppSheetに書き込まれることを確認します。

### 3. エンドツーエンドテスト

```javascript
testProcessRequest();
```

実際のAPIを呼び出して、全体の動作を確認します。

## トラブルシューティング

### Places APIで情報が見つからない

**原因**: 検索クエリが不正確、または施設が登録されていない

**対処法**:
- `common_name`がGoogle Mapの登録名と一致しているか確認
- 住所が正確か確認
- Google MapでマニュアルでSearch検索を実行して存在を確認

### AppSheet更新が失敗する

**原因**: APIキーが無効、またはテーブル構造が不一致

**対処法**:
- `APPSHEET_ACCESS_KEY`が正しいか確認
- `ORGANIZATIONS_TABLE_NAME`が正しいか確認
- AppSheetのテーブルに必要な列が存在するか確認
- AppSheet APIの権限設定を確認

### 郵便番号が正しく抽出されない

**原因**: 住所フォーマットが想定外

**対処法**:
- `testPostalCodeExtraction()`でテスト
- 正規表現パターンを調整: `/〒?(\d{3})-?(\d{4})/`

### 重複実行が検出されない

**原因**: 重複防止機能が無効化されている

**対処法**:
- ScriptPropertiesで`ENABLE_DUPLICATION_PREVENTION`を確認
- `testDuplicationPrevention()`でテスト

### 実行ログが記録されない

**原因**: ログスプレッドシートIDが無効

**対処法**:
- `config.gs`の`EXECUTION_LOG_SPREADSHEET_ID`を確認
- スプレッドシートへのアクセス権限を確認

## 関連ドキュメント

- [SPECIFICATIONS.md](./SPECIFICATIONS.md) - 技術仕様書
- [FLOW.md](./FLOW.md) - 処理フロー図
- [Google Places API (New) ドキュメント](https://developers.google.com/maps/documentation/places/web-service/op-overview)
- [AppSheet API ドキュメント](https://support.google.com/appsheet/answer/10105769)

## バージョン履歴

- **v1.0.0** (2025-10-23): 初回リリース
  - Google Places API (New) 統合
  - AppSheet API統合
  - 郵便番号抽出・整形機能
  - 営業時間整形機能
  - 重複防止機能
  - 実行ログ記録機能
