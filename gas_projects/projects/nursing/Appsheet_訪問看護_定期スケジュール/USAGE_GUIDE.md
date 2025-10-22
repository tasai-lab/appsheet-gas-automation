# Appsheet_訪問看護_定期スケジュール - 使用ガイド

## 概要

Schedule_Masterシートに登録された定期訪問スケジュールから、Schedule_Planシートに個別の予定を自動生成するスクリプトです。

## 主な機能

- ✅ **スプレッドシート連携**: Schedule_Masterシートからマスターデータを読み取り
- ✅ **重複防止**: 既存の予定と重複しないようにチェック
- ✅ **柔軟な頻度設定**: 毎週、隔週、毎月（第N週）に対応
- ✅ **担当者自動割り当て**: 既存のルートパターンから担当者を自動割り当て
- ✅ **直接実行可能**: GASエディタから個別引数で直接実行可能

---

## スプレッドシート構造

### Schedule_Master シート

定期訪問スケジュールのマスターデータ

| 列名 | 説明 | 例 |
|------|------|-----|
| master_id | マスターID（主キー） | `MASTER_001` |
| status | ステータス | `未処理`, `処理中`, `完了`, `エラー` |
| is_active | 有効/無効 | `TRUE` / `FALSE` |
| client_id | 利用者ID | `CLIENT_001` |
| client_name_temporary | 利用者名 | `山田 太郎` |
| job_type | 業務種別 | `訪問看護` |
| insurance_type | 保険種別 | `医療保険` |
| service_duration_minutes | サービス時間（分） | `60` |
| frequency | 頻度 | `毎週`, `隔週`, `毎月` |
| day_of_week | 曜日 | `1`（月曜）～ `7`（日曜） |
| target_week | 対象週（毎月の場合） | `第1週`, `第2週`, etc. |
| start_time | 開始時刻 | `09:00` |
| end_time | 終了時刻 | `10:00` |
| visitor_name | 訪問者名 | `看護師A` |
| companion_names | 同行者名 | `看護師B` |
| route_category | ルートカテゴリ | `ルート1` |
| route_tag | ルートタグ | `午前` |
| apply_start_date | 適用開始日 | `2025-01-01` |
| apply_end_date | 適用終了日 | `2025-12-31` |

### Schedule_Plan シート

生成された個別の訪問予定

| 列名 | 説明 |
|------|------|
| plan_id | 予定ID（自動生成） |
| master_id | 元となったマスターID |
| client_id | 利用者ID |
| visit_date | 訪問日 |
| start_time | 開始時刻 |
| end_time | 終了時刻 |
| visitor_name | 担当者 |
| status | ステータス |

---

## 使用方法

### 1. GASエディタから直接実行

#### パターンA: 特定のマスターIDからスケジュール生成

```javascript
// 1. マスターID一覧を確認
listAllMasterIds();
// ログに全マスターIDが表示されます

// 2. 特定のマスターIDでスケジュール生成
createScheduleFromMaster("MASTER_001", "admin@example.com");
```

#### パターンB: テスト関数を使用

```javascript
// テスト関数を実行（事前にmaster_idを修正）
testCreateSchedule();
```

### 2. AppSheet Webhookから実行

**Webhook URL:**
```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

**リクエストボディ:**
```json
{
  "master_id": "MASTER_001",
  "creator_id": "user@example.com"
}
```

**レスポンス（成功）:**
```json
{
  "status": "success",
  "message": "5件の予定を作成しました。",
  "createdCount": 5
}
```

**レスポンス（エラー）:**
```json
{
  "status": "error",
  "message": "master_id: MASTER_001 のマスターデータが見つかりません。",
  "createdCount": 0
}
```

---

## 関数リファレンス

### メイン関数

#### `createScheduleFromMaster(masterId, creatorId)`

マスターIDから定期スケジュールを生成する（直接実行用）

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

**使用例:**
```javascript
const result = createScheduleFromMaster("MASTER_001", "admin@example.com");
console.log(result.message); // "5件の予定を作成しました。"
```

---

### ユーティリティ関数

#### `listAllMasterIds()`

Schedule_Masterシートから全マスターIDを一覧表示

**使用例:**
```javascript
listAllMasterIds();
// ログ出力:
// ============================================================
// 📋 Schedule_Master 一覧
// ============================================================
// 1. master_id: MASTER_001 | status: 完了 | client: 山田 太郎
// 2. master_id: MASTER_002 | status: 未処理 | client: 鈴木 花子
// ...
```

#### `getMasterDataById(masterId)`

スプレッドシートからマスターIDに対応するデータを取得

**パラメータ:**
- `masterId` (string): マスターID

**戻り値:**
- マスターデータオブジェクト、または見つからない場合は `null`

---

## 重複防止の仕組み

### 重複判定キー

以下の4つの要素を組み合わせて一意キーを生成：

```
master_id | visit_date | start_time | end_time
```

**例:**
```
MASTER_001|2025-01-15|09:00|10:00
```

### 処理フロー

1. Schedule_Planシートから既存の予定を全て読み取り
2. 各予定の重複判定キーを生成してSetに格納
3. 新しい予定候補の日付を計算
4. 各候補日付で重複判定キーを生成
5. Setに存在する場合はスキップ、存在しない場合のみ作成

---

## 頻度設定のルール

### 毎週

指定した曜日に毎週訪問

**設定例:**
- `frequency`: `毎週`
- `day_of_week`: `2`（火曜日）

**結果:**
- 2025-01-07 (火)
- 2025-01-14 (火)
- 2025-01-21 (火)
- ...

### 隔週

指定した曜日に隔週で訪問（開始日から2週間ごと）

**設定例:**
- `frequency`: `隔週`
- `day_of_week`: `3`（水曜日）
- `apply_start_date`: `2025-01-08`

**結果:**
- 2025-01-08 (水) - 初回
- 2025-01-22 (水) - 2週間後
- 2025-02-05 (水) - 4週間後
- ...

### 毎月（第N週）

指定した曜日の第N週に毎月訪問

**設定例:**
- `frequency`: `毎月`
- `day_of_week`: `5`（金曜日）
- `target_week`: `第2週`

**結果:**
- 2025-01-10 (金) - 1月の第2金曜日
- 2025-02-14 (金) - 2月の第2金曜日
- 2025-03-14 (金) - 3月の第2金曜日
- ...

---

## トラブルシューティング

### エラー: "master_id が指定されていません"

**原因:** `createScheduleFromMaster()` の第1引数が未指定またはnull

**解決策:**
```javascript
// ❌ NG
createScheduleFromMaster();

// ✅ OK
createScheduleFromMaster("MASTER_001");
```

### エラー: "master_id: XXX のマスターデータが見つかりません"

**原因:** 指定したmaster_idがSchedule_Masterシートに存在しない

**解決策:**
```javascript
// 1. マスターID一覧を確認
listAllMasterIds();

// 2. 存在するmaster_idを指定
createScheduleFromMaster("MASTER_001");
```

### 予定が作成されない（"作成すべき新しい予定はありませんでした"）

**原因:** 全ての候補日が既存の予定と重複している

**確認方法:**
1. Schedule_Planシートで既存の予定を確認
2. master_id, visit_date, start_time, end_time が完全一致していないか確認
3. 必要に応じて手動で既存予定を削除

### ステータスが「エラー」のまま

**原因:** 処理中に例外が発生

**解決策:**
1. GASエディタの「実行ログ」を確認
2. エラーメッセージから原因を特定
3. Schedule_Masterシートのstatusを手動で「未処理」に戻す

---

## ベストプラクティス

### 1. テスト実行

本番データで実行する前に、テスト用のmaster_idで動作確認：

```javascript
// テスト用マスターIDを作成
// master_id: TEST_001
// apply_start_date: 今日
// apply_end_date: 1週間後

createScheduleFromMaster("TEST_001", "test@example.com");

// 結果を確認後、Schedule_Planから削除
```

### 2. バッチ処理

複数のマスターIDを一括処理する場合：

```javascript
function batchCreateSchedules() {
  const masterIds = ["MASTER_001", "MASTER_002", "MASTER_003"];
  const creatorId = "admin@example.com";

  for (const masterId of masterIds) {
    Logger.log(`処理開始: ${masterId}`);
    const result = createScheduleFromMaster(masterId, creatorId);
    Logger.log(`結果: ${result.message}`);
    Utilities.sleep(1000); // API制限対策
  }
}
```

### 3. 定期実行

GASのトリガーで毎週自動実行：

1. GASエディタで「トリガー」を開く
2. 新しいトリガーを追加
3. 関数: `batchCreateSchedules`
4. イベントソース: 時間主導型
5. 時間ベースのトリガー: 週ベースのタイマー（月曜日 9:00-10:00）

---

## 制限事項

1. **実行時間**: GASの6分制限に注意（大量データの場合はバッチ分割）
2. **APIレート制限**: AppSheet API の呼び出し制限（1分あたり60リクエスト）
3. **スプレッドシート行数**: 最大10万行（それ以上の場合はデータベース移行を推奨）

---

## サポート

問題が解決しない場合は、以下の情報を添えて問い合わせてください：

- エラーメッセージ
- 実行ログ（GASエディタの「実行ログ」タブ）
- master_idと対象期間
- 再現手順
