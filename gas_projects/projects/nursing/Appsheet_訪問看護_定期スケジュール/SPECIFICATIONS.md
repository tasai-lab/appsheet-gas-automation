# Appsheet_訪問看護_定期スケジュール - 詳細仕様書

## 目的

このスクリプトは、Schedule_Masterシートに登録された定期訪問スケジュールから、Schedule_Planシートに個別の予定を自動生成します。重複防止機能、柔軟な頻度設定（毎週・隔週・毎月）、AppSheet Automation連携によるバッチ処理に対応しています。

## システム構成

### コンポーネント

1. **Webhook受信ハンドラ** (`doPost`)
   - AppSheetからのPOSTリクエストを受信
   - JSONペイロードをパース（master_id、creator_id）
   - 共通Webhookモジュール（`CommonWebhook`）を使用

2. **メイン処理モジュール** (`main.gs`)
   - `createScheduleFromMaster()`: マスターIDから定期スケジュール生成
   - `processRequestByMasterId()`: コア処理オーケストレーション
   - `updateMastersForNextMonth()`: 翌月分バッチ処理

3. **スケジュール計算モジュール** (`schedule_calculator.gs`)
   - `calculatePotentialDates()`: 候補日付計算
   - `isDateMatchRule()`: 頻度ルール判定
   - `isDateMatchBiweekly()`: 隔週判定
   - `isDateMatchMonthly()`: 毎月（第N週）判定

4. **データアクセスモジュール** (`data_access.gs`)
   - `getMasterDataById()`: スプレッドシートからマスターデータ取得
   - `getActiveScheduleMasters()`: 有効なマスター一覧取得
   - `getExistingScheduleData()`: 既存予定と重複チェック用データ取得
   - `createSchedulesInAppSheet()`: AppSheet APIで予定一括作成
   - `updateMasterStatus()`: マスターステータス更新

5. **デバッグモジュール** (`debug_utils.gs`)
   - `DebugLogger`: チェックポイント記録、パフォーマンス計測
   - `validateMasterData()`: マスターデータ検証
   - `dumpObject()`, `dumpArray()`: デバッグ出力

6. **設定モジュール** (`config.gs`)
   - スプレッドシートID、AppSheet設定
   - ステータス定数、頻度定数、曜日定数
   - デバッグモード管理

7. **共通モジュール**
   - `logger.gs`: 一元化されたログ記録
   - `duplication_prevention.gs`: リクエスト重複防止

## 関数一覧

### メイン処理（main.gs）

| 関数名 | 説明 | パラメータ | 戻り値 |
|--------|------|-----------|--------|
| `doPost(e)` | Webhook エントリーポイント | `e`: POSTイベント | TextOutput レスポンス |
| `createScheduleFromMaster(masterId, creatorId)` | マスターIDから定期スケジュール生成 | `masterId`: マスターID<br>`creatorId`: 作成者ID | `{status, message, createdCount}` |
| `processRequestByMasterId(masterId, creatorId)` | メイン処理オーケストレーション | `masterId`: マスターID<br>`creatorId`: 作成者ID | `{status, message, createdCount}` |
| `updateMastersForNextMonth()` | 翌月分バッチ処理 | なし | `{totalMasters, updatedMasters, dateRange}` |
| `filterDuplicateDates(...)` | 重複除外フィルタリング | `potentialDates`, `masterData`, `masterId`, `existingKeys`, `logger` | `Date[]` |

### スケジュール計算（schedule_calculator.gs）

| 関数名 | 説明 | パラメータ | 戻り値 |
|--------|------|-----------|--------|
| `calculatePotentialDates(masterData)` | 候補日付計算 | `masterData`: マスターデータ | `Date[]` 候補日付配列 |
| `isDateMatchRule(date, masterData, targetDayOfWeek)` | 頻度ルール判定 | `date`: 判定対象日付<br>`masterData`: マスターデータ<br>`targetDayOfWeek`: 対象曜日 | `boolean` |
| `isDateMatchBiweekly(date, masterData)` | 隔週判定 | `date`: 判定対象日付<br>`masterData`: マスターデータ | `boolean` |
| `isDateMatchMonthly(date, masterData)` | 毎月（第N週）判定 | `date`: 判定対象日付<br>`masterData`: マスターデータ | `boolean` |
| `formatDates(dates, format)` | 日付配列を文字列化 | `dates`: 日付配列<br>`format`: 日付フォーマット | `string[]` |
| `isValidFrequency(frequency)` | 頻度検証 | `frequency`: 頻度文字列 | `boolean` |

### データアクセス（data_access.gs）

| 関数名 | 説明 | パラメータ | 戻り値 |
|--------|------|-----------|--------|
| `getMasterDataById(masterId)` | マスターデータ取得 | `masterId`: マスターID | `Object` または `null` |
| `getActiveScheduleMasters()` | 有効マスター一覧取得 | なし | `Array<Object>` |
| `getExistingScheduleData()` | 既存予定データ取得 | なし | `{masterKeys: Set, visitorMap: Map}` |
| `createSchedulesInAppSheet(...)` | 予定一括作成 | `masterData`, `dates`, `creatorId`, `visitorMap` | なし（例外スロー） |
| `updateMasterStatus(masterId, status, errorMessage)` | ステータス更新 | `masterId`, `status`, `errorMessage` | なし |
| `formatTimeValue(timeValue)` | 時刻を HH:MM 形式に変換 | `timeValue`: 時刻データ | `string` |

### デバッグ（debug_utils.gs）

| 関数名 | 説明 | パラメータ | 戻り値 |
|--------|------|-----------|--------|
| `createDebugLogger(context)` | デバッグロガー生成 | `context`: コンテキスト名 | `DebugLogger` インスタンス |
| `DebugLogger.debug(message, data)` | デバッグログ出力 | `message`, `data` | なし |
| `DebugLogger.checkpoint(label)` | チェックポイント記録 | `label`: ラベル | なし |
| `DebugLogger.summary()` | パフォーマンスサマリー出力 | なし | なし |
| `validateMasterData(masterData)` | マスターデータ検証 | `masterData` | `{valid: boolean, errors: string[]}` |
| `dumpObject(obj, label)` | オブジェクト整形出力 | `obj`, `label` | なし |
| `dumpArray(arr, label, limit)` | 配列整形出力 | `arr`, `label`, `limit` | なし |
| `assert(condition, message)` | アサーション | `condition`, `message` | なし（例外スロー） |

### テスト関数

| 関数名 | 説明 |
|--------|------|
| `testCreateSchedule()` | 個別スケジュール生成テスト |
| `listAllMasterIds()` | 全マスターID一覧表示 |
| `testGetActiveScheduleMasters()` | 有効マスター取得テスト |
| `testAllModules()` | 全モジュール統合テスト |
| `testScheduleCalculator()` | スケジュール計算テスト |
| `testDataAccess()` | データアクセステスト |
| `testDebugUtils()` | デバッグユーティリティテスト |

## データフロー

### 個別スケジュール生成フロー

```
AppSheet Webhook (master_id, creator_id)
    ↓
doPost(e) → CommonWebhook.handleDoPost()
    ↓
processRequestByMasterId(masterId, creatorId)
    ├─ 1. パラメータ検証
    ├─ 2. getMasterDataById() → スプレッドシート読み取り
    ├─ 3. updateMasterStatus('処理中')
    ├─ 4. getExistingScheduleData() → 重複チェック用データ取得
    ├─ 5. calculatePotentialDates() → 候補日付計算
    ├─ 6. filterDuplicateDates() → 重複除外
    ├─ 7. createSchedulesInAppSheet() → AppSheet API 予定作成
    └─ 8. updateMasterStatus('完了' or 'エラー')
    ↓
レスポンス返却
```

### バッチ処理フロー（翌月分一括生成）

```
Trigger または 手動実行
    ↓
updateMastersForNextMonth()
    ├─ 翌月の日付範囲を計算（1日〜末日）
    ├─ getActiveScheduleMasters() → 有効マスター取得（is_active=TRUE）
    ├─ AppSheet API 一括更新
    │   - status = '処理中'
    │   - apply_start_date = 翌月1日
    │   - apply_end_date = 翌月末日
    └─ AppSheet Automation が各マスターのWebhookを起動
        ↓
    複数の doPost() が並行実行
    （各マスターごとに個別スケジュール生成フローが実行される）
```

### 重複チェックロジック

```
getExistingScheduleData()
    ├─ Schedule_Plan シート読み取り
    ├─ 重複判定キー生成: "masterId|visitDate|startTime|endTime"
    ├─ Set<string> に格納
    └─ 担当者マップ生成: "visitDate|routeCategory" → "visitorName"
    ↓
filterDuplicateDates()
    ├─ 候補日付ごとに重複判定キーを生成
    ├─ Set に存在するかチェック
    ├─ 重複していない日付のみを抽出
    └─ 作成対象日付配列を返却
```

## エラーハンドリング

### エラーレベル

1. **SUCCESS**: 正常終了
   - status: 'success'
   - message: "N件の予定を作成しました。"

2. **WARNING**: 警告（作成対象なし）
   - status: 'success'
   - message: "作成すべき新しい予定はありませんでした。"

3. **ERROR**: エラー発生
   - status: 'error'
   - message: エラー詳細メッセージ
   - マスターステータス: 'エラー'

### エラー記録

すべてのエラーは以下の場所に記録されます:
- 実行ログスプレッドシート（共通モジュール `logger.gs`）
- マスターデータの `status` フィールド（'エラー'）
- マスターデータの `error_details` フィールド（エラー詳細）
- GASログ（`Logger.log`）

### エラーハンドリングパターン

```javascript
try {
  // 処理
  updateMasterStatus(masterId, MasterStatus.COMPLETED, null);
  return { status: 'success', message: '...', createdCount: N };
} catch (error) {
  logger.error('処理中にエラーが発生', error);
  updateMasterStatus(masterId, MasterStatus.ERROR, error.message);
  return { status: 'error', message: error.message, createdCount: 0 };
}
```

## パフォーマンス考慮事項

### API呼び出し制限対策

1. **レート制限対策**
   - 各API呼び出し前にランダム待機（0〜3000ms）
   - `API_CALL_DELAY_MS = 1000`（設定可能）

2. **リトライ設定**
   - `MAX_RETRY_COUNT = 3`
   - AppSheet APIエラー時にリトライ（実装予定）

### キャッシュ戦略

- **重複判定用Set**: メモリ内キャッシュ（Set<string>）
- **担当者マップ**: メモリ内キャッシュ（Map<string, string>）
- **有効期限**: 1回の実行内のみ（永続化なし）

### パフォーマンス計測

- `DebugLogger.checkpoint()`: 各処理ステップの実行時間記録
- `DebugLogger.summary()`: 全体サマリー出力
- デバッグモード有効時のみ計測（`DEBUG_MODE = true`）

## セキュリティ

### 認証

- **AppSheet Webhook**: `ApplicationAccessKey` による認証
- **スプレッドシート**: Google Apps Script の OAuth2 認証
- **AppSheet API**: `ACCESS_KEY` ヘッダー認証

### データ保護

- **APIキー管理**: `config.gs` で定数定義（推奨: Script Properties）
- **ログ記録**: 機密情報を含めない（client_id、master_id のみ）
- **エラーメッセージ**: ユーザー情報を含めない

### アクセス制御

- **スプレッドシート**: 編集権限が必要
- **AppSheet API**: アプリケーションレベルのアクセス制御
- **GASスクリプト**: デプロイ時のアクセス制御設定

## 制限事項

### Google Apps Script制限

- **実行時間**: 最大6分（Webhook）
- **URL Fetchサイズ**: 50MB
- **同時実行**: ユーザーあたり30

### スプレッドシート制限

- **読み取り**: getDataRange() で全データ取得（大量データは非推奨）
- **書き込み**: AppSheet API経由（スプレッドシート直接書き込みなし）

### 推奨事項

- **大量データ処理**: バッチサイズを制限（現在未実装）
- **タイムアウト対策**: AppSheet Automation経由で分散実行
- **頻度設定の制約**: 毎週・隔週・毎月のみサポート（毎日は未対応）

## テスト

### 単体テスト関数

```javascript
// マスターデータ取得テスト
testDataAccess();

// スケジュール計算テスト
testScheduleCalculator();

// デバッグユーティリティテスト
testDebugUtils();

// 全モジュール統合テスト
testAllModules();
```

### 統合テスト

```javascript
// 個別実行テスト（GASエディタで実行）
testCreateSchedule();

// 有効マスター取得テスト
testGetActiveScheduleMasters();

// マスター一覧表示
listAllMasterIds();
```

### AppSheetからのWebhookテスト

```json
POST https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec

{
  "master_id": "MASTER_001",
  "creator_id": "test_user@example.com"
}
```

## 保守

### ログ確認

定期的に以下を確認:
- 実行ログスプレッドシート（GAS実行ログ）
- マスターデータの `status` フィールド
- マスターデータの `error_details` フィールド
- GASログ（実行履歴）

### アップデート手順

1. スクリプトを更新
2. `clasp push` でデプロイ
3. `testAllModules()` でテスト実行
4. `testCreateSchedule()` で実データテスト
5. ログで動作確認
6. AppSheetからWebhookテスト
7. バージョン履歴を記録

### デバッグモード

```javascript
// デバッグモード有効化（詳細ログ出力）
enableDebugMode();

// デバッグモード無効化
disableDebugMode();

// デバッグモード状態確認
isDebugMode(); // => true or false
```

## 付録

### 設定値

| 項目 | 値 |
|------|-----|
| スプレッドシートID | `11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc` |
| マスターシート名 | `Schedule_Master` |
| 予定シート名 | `Schedule_Plan` |
| AppSheet アプリID | `f40c4b11-b140-4e31-a60c-600f3c9637c8` |
| AppSheet アクセスキー | `V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY` |
| タイムゾーン | `JST` |
| ロケール | `ja-JP` |
| デフォルト適用期間 | 90日 |

### ステータス定数

| 定数 | 値 |
|------|-----|
| MasterStatus.PENDING | '未処理' |
| MasterStatus.PROCESSING | '処理中' |
| MasterStatus.COMPLETED | '完了' |
| MasterStatus.ERROR | 'エラー' |
| PlanStatus.UNCONFIRMED | '未確定' |
| PlanStatus.PROCESSING | '処理中' |
| PlanStatus.CONFIRMED | '確定' |
| PlanStatus.CANCELLED | 'キャンセル' |

### 頻度定数

| 定数 | 値 |
|------|-----|
| Frequency.WEEKLY | '毎週' |
| Frequency.BIWEEKLY | '隔週' |
| Frequency.MONTHLY | '毎月' |

### 曜日定数

| 定数 | 値 | 説明 |
|------|-----|------|
| DayOfWeek.SUNDAY | 0 | 日曜 |
| DayOfWeek.MONDAY | 1 | 月曜 |
| DayOfWeek.TUESDAY | 2 | 火曜 |
| DayOfWeek.WEDNESDAY | 3 | 水曜 |
| DayOfWeek.THURSDAY | 4 | 木曜 |
| DayOfWeek.FRIDAY | 5 | 金曜 |
| DayOfWeek.SATURDAY | 6 | 土曜 |

### 関連リソース

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [AppSheet Automation](https://help.appsheet.com/en/collections/1885643-automation)
- [AppSheet API Documentation](https://api.appsheet.com/api/v2/documentation)

---

**最終更新**: 2025-10-23
**バージョン**: 2.2.0
