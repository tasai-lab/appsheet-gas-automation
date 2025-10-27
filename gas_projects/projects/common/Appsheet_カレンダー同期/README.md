# Appsheet_カレンダー同期

**Script ID:** 1ZbJa2g-CRIa_dxQhPngHtmi7_VyWLyByTy1seZRQVFlpBVhG6_H3wVQy

**Created:** 2025-10-27

**Version:** 1.0.0（最適化版）

---

## 概要

社内ユーザーのGoogleカレンダーイベント変更を自動検知し、AppSheet（Schedule_Plan）にリアルタイムで同期するGoogle Apps Scriptです。

### 主な機能

- ✅ **自動同期**: カレンダーイベントの作成・更新・削除を自動検知
- ✅ **ユーザー個別設定**: 各スタッフが自分で同期を有効化/無効化
- ✅ **Webアプリ**: ブラウザから簡単に設定可能
- ✅ **監査ログ**: 全ての変更を`Event_Audit_Log`シートに記録
- ✅ **統合ログ記録**: 実行ログを一元管理（コスト追跡）
- ✅ **期間制限**: 過去2日〜未来1年の範囲のみ処理
- ✅ **管理者ツール**: メニューから承認依頼メールを一括送信

---

## クイックスタート

### 1. ユーザー: カレンダー同期を有効化

1. WebアプリのURLにアクセス（管理者から送信されたメール参照）
2. Googleアカウントでログイン
3. 「同期を有効化 (Activate)」ボタンをクリック
4. 権限承認画面で「許可」を選択
5. 「✅ 設定完了」と表示されれば完了

### 2. 管理者: 承認依頼メールを送信

1. スプレッドシート（ID: `11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc`）を開く
2. メニュー「🔧 管理者ツール」→「承認依頼メールを送信」をクリック
3. 確認ダイアログで「はい」を選択
4. `Staff_Members`に登録された全スタッフにメールが送信される

---

## プロジェクト構造

```
Appsheet_カレンダー同期/
├── scripts/
│   ├── config.gs                      # 設定定数（スプレッドシートID、期間設定）
│   ├── main.gs                        # メインロジック（onCalendarChanged）
│   ├── calendar_service.gs            # カレンダー同期ロジック
│   ├── webapp.gs                      # Webアプリ機能（有効化/無効化）
│   ├── admin.gs                       # 管理者機能（メール送信、メニュー）
│   ├── logger.gs                      # ログ記録（共通モジュール）
│   ├── appsheet_client.gs             # AppSheet API操作（共通モジュール）
│   ├── script_properties_manager.gs   # 設定管理（共通モジュール）
│   ├── test_functions.gs              # テスト関数
│   ├── WebApp.html                    # Webアプリインターフェース
│   ├── appsscript.json                # OAuthスコープ設定
│   └── .claspignore                   # デプロイ除外ファイル
├── README.md                           # このファイル
├── SPECIFICATIONS.md                   # 技術仕様
└── FLOW.md                            # 処理フロー図
```

### モジュール構成

**コアモジュール:**
- `config.gs`: 全設定定数とenum定義
- `main.gs`: エントリーポイント（onCalendarChanged）
- `calendar_service.gs`: カレンダー同期ロジック、イベント処理
- `webapp.gs`: Webアプリ機能（doGet, activate/deactivate）
- `admin.gs`: 管理者機能（onOpen, sendAuthorizationEmails）

**共通モジュール:**
- `logger.gs`: 一元化されたログ記録（統合コスト管理シート）
- `appsheet_client.gs`: AppSheet API操作（未使用・将来用）
- `script_properties_manager.gs`: Script Properties管理

---

## Referenced Spreadsheets

- **訪問看護_スケジュール管理** (ID: `11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc`)
  - `Schedule_Plan` シート: 訪問スケジュール予定
  - `Event_Audit_Log` シート: カレンダー変更の監査ログ

- **Staff_Members** (ID: `1F8-HxdTtz4ljW9NVqdLFX3U4mEx3Ux1QOfYCMOBXBB4`)
  - `Staff_Members` シート: スタッフマスター（メール→スタッフID変換）

- **統合GAS実行ログ** (ID: `16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA`)
  - `コスト管理` シート: 全GASプロジェクトの実行ログ・コスト追跡

---

## 関数リファレンス

### メイン関数

#### `onCalendarChanged(e)`

カレンダートリガーによって呼び出されるメイン関数

**トリガー:** カレンダーイベントの更新時

**パラメータ:**
- `e` (Object): トリガーイベント
  - `e.calendarId` (string): カレンダーID（メールアドレス）

**動作:**
1. UserLockで排他制御
2. `syncCalendarEvents`を呼び出してイベントを同期
3. エラー時はログに記録
4. finally句で統合ログシートに保存

### Webアプリ関数

#### `doGet(e)`

Webアプリのエントリーポイント

**戻り値:** HTMLページ（WebApp.html）

#### `activateUserSyncWebApp()`

ユーザーが自身のカレンダー同期を有効化

**動作:**
1. 既存トリガーを確認
2. カレンダートリガーを作成（`onCalendarChanged`）
3. 結果をJSON形式で返す

**戻り値:**
```javascript
{
  status: 'success' | 'error' | 'info',
  title: string,
  message: string,
  isActive: boolean
}
```

#### `deactivateUserSyncWebApp()`

ユーザーが自身のカレンダー同期を無効化

**動作:**
1. カレンダートリガーを削除
2. 同期トークンを削除

### 管理者関数

#### `sendAuthorizationEmails()`

スタッフに承認依頼メールを送信

**実行方法:** スプレッドシートのメニューから実行

**動作:**
1. WebアプリのURLを取得
2. `Staff_Members`から全スタッフのメールアドレスを取得
3. 一括でメールを送信

### テスト関数

#### `testGetStaffMap()`

スタッフマップの取得をテスト

#### `testGetSheetsAndColumns()`

スプレッドシートとカラムマップの取得をテスト

#### `testLogger()`

ロガーの動作をテスト

#### `testGetUserCalendarTrigger()`

ユーザーのカレンダートリガー状態を確認

#### `runAllTests()`

全てのテストを実行する統合テスト

---

## Webhook使用方法（将来用）

現在はカレンダートリガーのみ使用していますが、将来的にWebhook経由での呼び出しも可能です。

### リクエスト

```json
POST https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec

{
  "calendar_id": "user@example.com",
  "action": "sync"
}
```

---

## ドキュメント

- **[SPECIFICATIONS.md](./SPECIFICATIONS.md)** - 技術仕様とAPI詳細
- **[FLOW.md](./FLOW.md)** - 処理フロー図（Mermaid）

---

## バージョン履歴

### v1.0.0 (2025-10-27) - 最適化版

- ✅ **モジュール化**: コードを9つの専門モジュールに分離
  - `config.gs`: 設定定数
  - `main.gs`: エントリーポイント
  - `calendar_service.gs`: カレンダー同期ロジック
  - `webapp.gs`: Webアプリ機能
  - `admin.gs`: 管理者機能
  - `logger.gs`, `appsheet_client.gs`, `script_properties_manager.gs`: 共通モジュール
  - `test_functions.gs`: テスト関数

- ✅ **統合ログ記録**: 一元化されたログ記録システムを適用
  - 実行ログを統合コスト管理シートに記録（ID: `16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA`）
  - エラーハンドリングの強化（try-catch-finally）

- ✅ **ドキュメント整備**: README, SPECIFICATIONS, FLOWを追加

- ✅ **デプロイ準備**: .claspignore作成、バックアップファイル除外

### v0.0.0 (既存バージョン)

- 初回実装（モノリシック構造）

---

## ライセンス

Fractal Group Internal Use Only
