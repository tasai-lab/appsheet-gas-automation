# Appsheet_訪問看護_書類OCR

**Script ID:** 1a5w4i6tO8CviYE2obxd0aCiU5BtwoNc2Ajrscedi5ceoQWa7DdlZGbP1
**Created:** 2025-07-17T07:50:20.523Z
**Last Modified:** 2025-10-18T18:00:00.000Z
**Version:** v2.0.0

## 概要

訪問看護書類（医療保険証、介護保険証、公費受給者証、口座情報、指示書、負担割合証等）を、Gemini 2.5-proを使用して**1回のAPI呼び出し**でOCR + 構造化データ抽出を行い、各種テーブルに自動登録するGoogle Apps Scriptプロジェクトです。

### 主な機能

- ✅ **1回のAPI呼び出しで完結** - OCR + 構造化データ抽出を同時実行（従来の2回→1回に削減）
- ✅ **書類OCR** - Gemini 2.5-proによる高精度OCR、Markdown形式で構造化
- ✅ **書類仕分け** - documentType別に適切なテーブルへレコード作成
- ✅ **自動ファイル名変更** - AIが推奨するタイトルに自動リネーム
- ✅ **完了通知メール** - HTML形式で抽出データを通知
- ✅ **エラーハンドリング** - 重複実行防止、構造化ロギング

### 対応書類タイプ

| 書類タイプ | 対象テーブル | 抽出データ例 |
|----------|------------|-----------|
| 医療保険証 | Client_Medical_Insurances | 保険者番号、記号・番号、給付割合、有効期間 |
| 介護保険証 | Client_LTCI_Insurances | 被保険者番号、要介護度、認定期間 |
| 公費 | Client_Public_Subsidies | 公費番号、受給者番号、有効期間 |
| 口座情報 | Client_Bank_Accounts | 金融機関名、支店名、口座番号 |
| 指示書 | VN_Instructions | 指示期間、医療機関名、病名 |
| 負担割合証 | Client_LTCI_Copayment_Certificates | 負担割合、適用期間 |
| 汎用ドキュメント | - | OCRのみ（構造化データなし） |

## プロジェクト構成

```
Appsheet_訪問看護_書類OCR/
├── scripts/
│   ├── main.gs                           # メインエントリーポイント
│   ├── config_settings.gs                 # 設定ファイル
│   ├── modules_geminiClient.gs            # Gemini API連携（OCR+構造化データ抽出）
│   ├── modules_documentProcessor.gs       # 書類仕分け（種類別テーブル更新）
│   ├── modules_notification.gs            # 通知処理
│   ├── CommonWebhook.gs                   # Webhook共通処理
│   ├── utils_logger.gs                    # ロギングユーティリティ
│   └── appsscript.json                    # プロジェクトマニフェスト
├── FLOW.md                                # 処理フロー図
└── README.md                              # 本ファイル
```

### スクリプト説明

| ファイル | 役割 | 行数 |
|---------|------|------|
| main.gs | doPost()、processRequest()、直接実行関数 | 394 |
| config_settings.gs | 全ての設定値を一元管理 | 171 |
| modules_geminiClient.gs | Gemini API連携、プロンプト生成 | 455 |
| modules_documentProcessor.gs | 種類別テーブルへのレコード作成 | 361 |
| modules_notification.gs | 完了通知・エラー通知メール送信 | 165 |
| CommonWebhook.gs | Webhook共通処理 | 236 |
| utils_logger.gs | 構造化ロギング、パフォーマンス計測 | 139 |
| **合計** | | **1,921行** |

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
  apiKey: 'YOUR_GEMINI_API_KEY',
  model: 'gemini-2.5-pro',
  temperature: 0.3,
  maxOutputTokens: 8192
};

// AppSheet設定
const APPSHEET_CONFIG = {
  appId: 'YOUR_APPSHEET_APP_ID',
  accessKey: 'YOUR_APPSHEET_ACCESS_KEY',
  appName: '訪問看護_利用者管理-XXXXXXXX'
};

// 通知設定
const NOTIFICATION_CONFIG = {
  errorEmail: 'error@example.com',
  completionEmails: 'user1@example.com, user2@example.com'
};
```

## 使用方法

### Webhook経由での実行

AppSheetから以下のJSONペイロードをPOSTします:

```json
{
  "config": {
    "tableName": "Client_Documents",
    "keyColumn": "document_id",
    "titleColumn": "title",
    "summaryColumn": "summary",
    "ocrColumn": "ocr_text",
    "statusColumn": "status"
  },
  "data": {
    "keyValue": "DOC-001",
    "fileId": "1a2b3c4d5e6f...",
    "document_type": "医療保険証",
    "client_id": "CLIENT-001",
    "staff_id": "staff@example.com",
    "client_name": "山田太郎",
    "staff_name": "鈴木花子",
    "client_birth_date": "1950/01/01"
  }
}
```

### GASエディタからの直接実行

`directProcessRequest`関数を使用して簡単にテスト実行できます:

```javascript
// 基本的な使い方（ファイル名のみ指定）
directProcessRequest('テスト保険証.pdf')

// 書類種類も指定
directProcessRequest('テスト保険証.pdf', '医療保険証')

// 利用者情報も指定
directProcessRequest(
  'テスト保険証.pdf',
  '医療保険証',
  'CLIENT-001',
  'staff@example.com',
  '山田太郎',
  'テスト担当者'
)

// Drive URLから実行
directProcessRequest('https://drive.google.com/file/d/1a2b3c4d5e6f.../view')

// ファイルIDで実行
directProcessRequest('1a2b3c4d5e6f...')
```

**実行方法:**
1. GASエディタで`main.gs`を開く
2. 関数選択で`directProcessRequest`を選択
3. 引数を指定して実行ボタンをクリック

**戻り値:**
```javascript
{
  success: true,
  documentId: 'DIRECT-1729267200000',
  recordId: 'MEDI-12345678',
  fileId: '1a2b3c4d5e6f...',
  fileUrl: 'https://drive.google.com/file/d/1a2b3c4d5e6f.../view'
}
```

## パラメータ

### 必須パラメータ

| パラメータ | 型 | 説明 |
|----------|------|------|
| config.tableName | string | 書類管理テーブル名 |
| config.keyColumn | string | キー列名 |
| config.statusColumn | string | ステータス列名 |
| data.keyValue | string | 書類ID |
| data.fileId | string | Google DriveファイルID |

### 任意パラメータ

| パラメータ | 型 | 説明 |
|----------|------|------|
| data.document_type | string | 書類種類（デフォルト: "汎用ドキュメント"） |
| data.client_id | string | 利用者ID（書類仕分け用） |
| data.staff_id | string | スタッフID（書類仕分け用） |
| data.client_birth_date | string | 利用者生年月日（医療保険証・公費で使用） |
| data.custom_instructions | string | カスタム指示（音声/動画用） |
| data.client_context_info | string | 利用者コンテキスト（音声/動画用） |

## レスポンス形式

### 成功時

```json
{
  "status": "success",
  "timestamp": "2025-10-18T18:00:00.000Z",
  "data": {
    "success": true,
    "documentId": "DOC-001",
    "recordId": "MEDI-12345678"
  }
}
```

### エラー時

```json
{
  "status": "error",
  "timestamp": "2025-10-18T18:00:00.000Z",
  "error": {
    "message": "エラーメッセージ",
    "stack": "スタックトレース",
    "params": {...}
  }
}
```

## 処理フロー

詳細は[FLOW.md](./FLOW.md)を参照してください。

**概要:**
1. Webhook受信 → パラメータ検証
2. 重複実行防止チェック
3. **Gemini API呼び出し（1回）** → OCR + 構造化データ抽出
4. 書類管理テーブル更新
5. ファイル名変更
6. 書類仕分け（種類別テーブルにレコード作成）
7. 完了通知メール送信
8. 成功レスポンス返却

## エラーハンドリング

### エラーログ

全てのエラーは構造化ログとして記録されます:

```javascript
{
  "timestamp": "2025-10-18T18:00:00.000Z",
  "level": "ERROR",
  "message": "エラー発生",
  "documentId": "DOC-001",
  "errorMessage": "エラー詳細",
  "errorStack": "スタックトレース"
}
```

### エラー通知

- 書類管理テーブルのstatusが「エラー」に更新
- error_detailsフィールドにエラー内容を記録
- 管理者にエラー通知メールを送信

## トラブルシューティング

### よくある問題

**問題1: 「必須パラメータが不足しています」エラー**

- 原因: keyValue, fileIdが欠けています
- 解決: 全ての必須パラメータを含めてリクエストを送信してください

**問題2: Gemini APIエラー**

- 原因: APIキーが無効、または使用量制限に達しています
- 解決: `config_settings.gs`のAPIキーを確認してください

**問題3: 書類仕分けがスキップされる**

- 原因: structured_dataがnull、またはclient_id/staff_idが不足
- 解決: documentTypeが対応書類タイプか確認、必須パラメータを追加してください

## デプロイメント履歴

| バージョン | 日時 | 説明 | ステータス |
|---------|------|------|------------|
| v2.0 | 2025-10-18 18:00 | 書類OCR + 書類仕分け統合、1回のAPI呼び出しで完結 | ⏳ 準備中 |
| v1.0 | 2025-07-17 08:00 | 初期バージョン（OCRのみ） | ✓ 廃止 |

## 参照ドキュメント

- [FLOW.md](./FLOW.md) - 処理フロー図

## Referenced Spreadsheets

- **GAS実行ログ** (ID: 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)

## ライセンス

Internal use only - Fractal Group
