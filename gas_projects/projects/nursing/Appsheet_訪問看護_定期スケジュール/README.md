# Appsheet_訪問看護_定期スケジュール

**Script ID:** 1SLurZN--rywSjcwKeevBJEPD36rU2V2wNWD7QGP3oVGaAxOJavjtEe31

**Created:** 2025-07-29T09:09:44.254Z

**Modified:** 2025-10-22T16:00:00.000Z

**Version:** 2.2.0

---

## 概要

Schedule_Masterシートに登録された定期訪問スケジュールから、Schedule_Planシートに個別の予定を自動生成するGoogle Apps Scriptです。

### 主な機能

- ✅ **スプレッドシート直接読み取り**: master_idを指定するだけで動作
- ✅ **重複防止**: 既存予定と重複しないようにインテリジェントチェック
- ✅ **柔軟な頻度設定**: 毎週、隔週、毎月（第N週）に対応
- ✅ **直接実行可能**: GASエディタから個別引数で簡単にテスト・実行
- ✅ **Webhook対応**: AppSheetからのWebhook呼び出しに対応
- ✅ **バッチ処理**: 翌月分の全マスターを一括更新（AppSheet Automation連携）

---

## クイックスタート

### 1. マスターID一覧を確認

```javascript
// GASエディタで実行
listAllMasterIds();
```

### 2. スケジュールを生成

```javascript
// GASエディタで実行
createScheduleFromMaster("MASTER_001", "admin@example.com");
```

---

## プロジェクト構造

```
Appsheet_訪問看護_定期スケジュール/
├── scripts/
│   ├── main.gs                        # メインロジック（エントリーポイント）
│   ├── config.gs                      # 設定定数・定義
│   ├── debug_utils.gs                 # デバッグ・検証ユーティリティ
│   ├── schedule_calculator.gs         # 日付計算ロジック
│   ├── data_access.gs                 # データアクセス層（スプレッドシート・API）
│   ├── logger.gs                      # ログ記録（共通モジュール）
│   ├── duplication_prevention.gs      # 重複防止（共通モジュール）
│   ├── gemini_client.gs               # Gemini API（未使用）
│   └── script_properties_manager.gs   # 設定管理（共通モジュール）
├── spreadsheets/
│   ├── GAS実行ログ_metadata.json
│   └── 訪問看護_スケジュール管理_metadata.json
├── README.md                          # このファイル
├── USAGE_GUIDE.md                     # 詳細な使用ガイド
├── SPECIFICATIONS.md                  # 技術仕様
├── FLOW.md                            # 処理フロー図
└── ARCHITECTURE.md                    # アーキテクチャ図

```

### モジュール構成

**コアモジュール:**
- `main.gs`: エントリーポイント（doPost, createScheduleFromMaster）とオーケストレーション
- `config.gs`: 全設定定数とenum定義（スプレッドシートID, AppSheet設定, ステータス等）
- `debug_utils.gs`: デバッグロガー、パフォーマンス計測、データ検証、アサーション

**ビジネスロジック:**
- `schedule_calculator.gs`: 日付計算ロジック（毎週・隔週・毎月対応）
- `data_access.gs`: スプレッドシート読み取り・AppSheet API操作

**共通モジュール:**
- `logger.gs`: 一元化されたログ記録
- `duplication_prevention.gs`: リクエスト重複防止
- `script_properties_manager.gs`: Script Properties管理

---

## Referenced Spreadsheets

- **GAS実行ログ** (ID: `15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE`)
- **訪問看護_スケジュール管理** (ID: `11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc`)
  - `Schedule_Master` シート: 定期スケジュールのマスターデータ
  - `Schedule_Plan` シート: 生成された個別の予定

---

## 関数リファレンス

### メイン関数

#### `createScheduleFromMaster(masterId, creatorId)`

マスターIDから定期スケジュールを生成

**パラメータ:**
- `masterId` (string, 必須): Schedule_MasterシートのマスターID
- `creatorId` (string, オプション): 作成者ID（デフォルト: 'system'）

**戻り値:**
```javascript
{
  status: 'success' | 'error',
  message: string,
  createdCount: number
}
```

**例:**
```javascript
const result = createScheduleFromMaster("MASTER_001", "admin@example.com");
console.log(result.message); // "5件の予定を作成しました。"
```

#### `updateMastersForNextMonth()`

翌月の定期スケジュールを一括生成するバッチ処理関数

**動作:**
1. 有効なスケジュールマスター（`is_active = TRUE`）を取得
2. AppSheet APIで全マスターを一括更新:
   - `status` = '処理中'
   - `apply_start_date` = 翌月1日
   - `apply_end_date` = 翌月末日
3. AppSheet Automationが更新を検知してWebhookを起動
4. 各マスターごとに既存の`createScheduleFromMaster()`が実行される

**パラメータ:** なし

**戻り値:**
```javascript
{
  totalMasters: number,      // 更新したマスター数
  updatedMasters: string[],  // 更新したマスターIDの配列
  nextMonthRange: {
    startDateStr: string,    // '2025-11-01'
    endDateStr: string       // '2025-11-30'
  }
}
```

**例:**
```javascript
// GASエディタまたはトリガーで実行
const result = updateMastersForNextMonth();
console.log(`${result.totalMasters}件のマスターを更新しました。`);
console.log(`対象期間: ${result.nextMonthRange.startDateStr} 〜 ${result.nextMonthRange.endDateStr}`);
```

**推奨設定:**
- 毎月25日の深夜0時に実行するトリガーを設定
- これにより翌月分のスケジュールが自動生成されます

### ユーティリティ関数

#### `listAllMasterIds()`

Schedule_Masterシートから全マスターIDを一覧表示

#### `testCreateSchedule()`

テスト用関数（master_idを事前に編集して実行）

#### `testCalculateNextMonthRange()`

翌月の日付範囲計算をテスト

#### `testGetActiveScheduleMasters()`

有効なスケジュールマスター取得をテスト

---

## Webhook使用方法

### リクエスト

```json
POST https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec

{
  "master_id": "MASTER_001",
  "creator_id": "user@example.com"
}
```

### レスポンス

**成功:**
```json
{
  "status": "success",
  "message": "5件の予定を作成しました。",
  "createdCount": 5
}
```

**エラー:**
```json
{
  "status": "error",
  "message": "master_id: MASTER_001 のマスターデータが見つかりません。",
  "createdCount": 0
}
```

---

## ドキュメント

- **[USAGE_GUIDE.md](./USAGE_GUIDE.md)** - 詳細な使用方法とトラブルシューティング
- **[SPECIFICATIONS.md](./SPECIFICATIONS.md)** - 技術仕様とAPI詳細
- **[FLOW.md](./FLOW.md)** - 処理フロー図

---

## バージョン履歴

### v2.2.0 (2025-10-22)
- ✅ **バッチ処理機能追加**: 翌月分の定期スケジュール一括生成
  - `updateMastersForNextMonth()`: AppSheet API経由でマスター一括更新
  - `calculateNextMonthRange()`: 翌月の日付範囲計算
  - `getActiveScheduleMasters()`: 有効なマスター取得
- ✅ **AppSheet Automation連携**: マスター更新をトリガーに既存ワークフローを活用
- ✅ **テスト関数追加**: `testCalculateNextMonthRange()`, `testGetActiveScheduleMasters()`
- ✅ **ドキュメント更新**: バッチ処理の使用方法とトリガー設定例を追加

### v2.1.0 (2025-10-22)
- ✅ **モジュール化リファクタリング**: コードを5つの専門モジュールに分離
  - `main.gs`: エントリーポイントとオーケストレーション
  - `config.gs`: 全設定定数・enum定義
  - `debug_utils.gs`: デバッグ・検証ユーティリティ
  - `schedule_calculator.gs`: 日付計算ロジック
  - `data_access.gs`: データアクセス層
- ✅ **可読性向上**: JSDocコメント追加、一貫した命名規則
- ✅ **保守性向上**: 関心の分離、単一責任の原則
- ✅ **デバッグ機能強化**: DebugLoggerクラス、パフォーマンス計測、データ検証
- ✅ **テスト関数拡充**: `testAllModules()` で全モジュール統合テスト

### v2.0.0 (2025-10-22)
- ✅ **スプレッドシート直接読み取り**: `getMasterDataById()` 関数を追加
- ✅ **直接実行対応**: `createScheduleFromMaster()` 関数で個別引数で実行可能
- ✅ **重複防止強化**: 既存予定との重複チェックを最適化
- ✅ **ログ強化**: デバッグログを全関数に追加
- ✅ **テスト関数追加**: `testCreateSchedule()`, `listAllMasterIds()` を追加
- ✅ **ドキュメント整備**: USAGE_GUIDE.md, ARCHITECTURE.md, FLOW.md を追加

### v1.0.0 (2025-07-29)
- 初回リリース

---

## ライセンス

Fractal Group Internal Use Only
