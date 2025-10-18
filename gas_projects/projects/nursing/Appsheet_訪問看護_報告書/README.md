# Appsheet_訪問看護_報告書

**Script ID:** 1FfRoozBGOfvGl5USWhe4VuYu7bkIIY0yEuzZjiQnBfc7k6osfw02u7ZB
**Created:** 2025-08-05T01:10:39.809Z
**Last Modified:** 2025-10-18T17:15:00.000Z
**Version:** v2.1.0

## 概要

訪問看護記録をもとに、Gemini 2.5-proを使用して医療機関向けの報告書を自動生成するGoogle Apps Scriptプロジェクトです。

### 主な機能

- AppSheetからのWebhook受信
- Gemini 2.5-proによる報告書自動生成
- AppSheetテーブルへの自動更新
- エラーハンドリングとメール通知
- 構造化ロギング

## プロジェクト構成

```
Appsheet_訪問看護_報告書/
├── scripts/
│   ├── main.gs                         # メインエントリーポイント
│   ├── modules_geminiClient.gs         # Gemini API連携
│   ├── modules_appsheetClient.gs       # AppSheet API連携
│   ├── modules_notification.gs         # 通知処理
│   ├── CommonWebhook.gs                # Webhook共通処理
│   ├── config_settings.gs              # 設定ファイル
│   ├── utils_logger.gs                 # ロギングユーティリティ
│   └── appsscript.json                 # プロジェクトマニフェスト
├── FLOW.md                             # 処理フロー図
├── SPECIFICATIONS.md                   # 技術仕様書
├── README.md                           # 本ファイル
└── project_metadata.json               # プロジェクトメタデータ
```

### スクリプト説明

| ファイル | 役割 | 行数 |
|---------|------|------|
| main.gs | doPost()、processRequest()、テスト関数 | 113 |
| modules_geminiClient.gs | Gemini APIとの通信、プロンプト構築 | 153 |
| modules_appsheetClient.gs | AppSheetへのデータ更新 | 85 |
| modules_notification.gs | エラー通知メール送信 | 42 |
| CommonWebhook.gs | Webhook共通処理（リクエストパース、レスポンス生成） | 193 |
| config_settings.gs | 全ての設定値を一元管理 | 77 |
| utils_logger.gs | 構造化ロギング、パフォーマンス計測 | 139 |
| **合計** | | **802行** |

## セットアップ

### 前提条件

- Google Apps Scriptプロジェクト
- AppSheetアプリ
- Gemini API キー

### 設定

`config_settings.gs`を環境に合わせて編集してください:

```javascript
// Gemini API設定
const GEMINI_CONFIG = {
  apiKey: "YOUR_GEMINI_API_KEY",
  model: 'gemini-2.5-pro',
  temperature: 0.2,
  maxOutputTokens: 8192
};

// AppSheet設定
const APPSHEET_CONFIG = {
  appId: 'YOUR_APPSHEET_APP_ID',
  accessKey: 'YOUR_APPSHEET_ACCESS_KEY',
  tableName: 'VN_Reports'
};
```

## 使用方法

### Webhook経由での実行

AppSheetから以下のJSONペイロードをPOSTします:

```json
{
  "reportId": "REPORT-001",
  "clientName": "山田太郎",
  "targetMonth": "2025年10月",
  "visitRecords": "10/1訪問: BT36.5℃ BP120/70mmHg...",
  "staffId": "staff@example.com"
}
```

### GASエディタからのテスト実行

`testReportGeneration`関数を使用して、引数を個別に設定してテスト実行できます:

```javascript
function testReportGeneration(
  reportId = "TEST-REPORT-001",
  clientName = "山田太郎",
  targetMonth = "2025年10月",
  visitRecords = "10/1訪問: BT36.5℃ BP120/70mmHg...",
  staffId = "test@fractal-group.co.jp"
) {
  // テスト実行
}
```

**実行方法:**
1. GASエディタで`main.gs`を開く
2. 関数選択で`testReportGeneration`を選択
3. 実行ボタンをクリック

デフォルト値を使用する場合は、そのまま実行してください。
カスタム値を使用する場合は、関数内の引数を直接編集してから実行してください。

## パラメータ

| パラメータ | 型 | 必須 | 説明 |
|----------|------|------|------|
| reportId | string | ✓ | 報告書ID |
| clientName | string | ✓ | 利用者名 |
| targetMonth | string | ✓ | 対象月（例: "2025年10月"） |
| visitRecords | string | ✓ | 訪問記録テキスト |
| staffId | string | ✓ | スタッフID（メールアドレス） |

## レスポンス形式

### 成功時

```json
{
  "status": "success",
  "timestamp": "2025-10-18T16:59:00.000Z",
  "data": {
    "success": true,
    "reportId": "REPORT-001"
  }
}
```

### エラー時

```json
{
  "status": "error",
  "timestamp": "2025-10-18T16:59:00.000Z",
  "error": {
    "message": "エラーメッセージ",
    "stack": "スタックトレース",
    "params": {...}
  }
}
```

## AppSheetフィールドマッピング

| 内部名 | AppSheetフィールド名 | 説明 |
|-------|-------------------|------|
| reportId | report_id | 報告書ID |
| status | status | ステータス（編集中/エラー） |
| symptomProgress | symptom_progress | 生成された報告書テキスト |
| errorDetails | error_details | エラー詳細 |
| updatedBy | updated_by | 更新者 |

## エラーハンドリング

### エラーログ

全てのエラーは構造化ログとして記録されます:

```javascript
{
  "timestamp": "2025-10-18T16:59:00.000Z",
  "level": "ERROR",
  "message": "エラー発生",
  "reportId": "REPORT-001",
  "errorMessage": "エラー詳細",
  "errorStack": "スタックトレース"
}
```

### エラー通知

- AppSheetの該当レコードのstatusが「エラー」に更新されます
- error_detailsフィールドにエラー内容が記録されます
- （オプション）管理者にエラー通知メールが送信されます

## トラブルシューティング

### よくある問題

**問題1: 「必須パラメータが不足しています」エラー**

- 原因: reportId, clientName, targetMonth, visitRecordsのいずれかが欠けています
- 解決: 全ての必須パラメータを含めてリクエストを送信してください

**問題2: Gemini APIエラー**

- 原因: APIキーが無効、または使用量制限に達しています
- 解決: `config_settings.gs`のAPIキーを確認してください

**問題3: AppSheet更新エラー**

- 原因: AppSheetのアクセスキーやアプリIDが無効です
- 解決: `config_settings.gs`のAppSheet設定を確認してください

## デプロイメント履歴

| バージョン | 日時 | 説明 | ステータス |
|---------|------|------|----------|
| v2.1 | 2025-10-18 17:15 | スクリプト最適化 - 役割ごとに分割、命名規則統一、不要コード削除 (802行に削減) | ✓ 成功 |
| v2.0 | 2025-10-18 16:59 | リファクタリング完了 - Gemini 2.5-pro統合、共通モジュール採用、構造化ロギング実装 | ✓ 成功 |

## 参照ドキュメント

- [FLOW.md](./FLOW.md) - 処理フロー図
- [SPECIFICATIONS.md](./SPECIFICATIONS.md) - 技術仕様書

## Referenced Spreadsheets

- **GAS実行ログ** (ID: 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)

## ライセンス

Internal use only - Fractal Group
