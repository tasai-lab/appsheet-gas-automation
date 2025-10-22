# Appsheet_訪問看護_書類OCR

**Script ID:** 1a5w4i6tO8CviYE2obxd0aCiU5BtwoNc2Ajrscedi5ceoQWa7DdlZGbP1
**Created:** 2025-07-17T07:50:20.523Z
**Last Modified:** 2025-10-22T12:00:00.000Z
**Version:** v2.2.0

## 概要

訪問看護書類（医療保険証、介護保険証、公費受給者証、口座情報、指示書、負担割合証等）を、**Vertex AI Gemini 2.5-Flash**を使用して**1回のAPI呼び出し**でOCR + 構造化データ抽出を行い、各種テーブルに自動登録するGoogle Apps Scriptプロジェクトです。

### ⚡ 最新の重要変更（2025-10-22）

**全書類タイプにOCRテキスト抽出を適用**
- 変更: 提供票以外の全ての書類タイプでもOCRテキスト（要点のマークダウン形式）をcontextに含めるように修正
- 影響: 全ての書類仕分けハンドラーで`context.ocrText`が利用可能に
- デプロイ: v2.2 (Deployment @43)

### 以前の重要変更（2025-10-20）

**Google AI Studio API完全廃止 → Vertex AI専用化**
- 理由: Google AI Studio API無料枠超過により90%エラー発生
- 変更: **Vertex AI APIのみ使用**（OAuth2認証）
- モデル: **gemini-2.5-flash**（コスト最適化）
- API呼び出し制限: **最大2回/処理**（厳格な制限）

### 主な機能

- ✅ **Vertex AI専用** - OAuth2認証、Google AI Studio API廃止
- ✅ **1回のAPI呼び出しで完結** - OCR + 構造化データ抽出を同時実行
- ✅ **コスト最適化** - Gemini 2.5-Flash使用（Pro比75%削減）
- ✅ **API呼び出し制限** - 1処理あたり最大2回（過度な呼び出し防止）
- ✅ **書類OCR** - Vertex AI Gemini 2.5-Flashによる高精度OCR
- ✅ **書類仕分け** - documentType別に適切なテーブルへレコード作成
- ✅ **自動ファイル名変更** - AIが推奨するタイトルに自動リネーム
- ✅ **完了通知メール** - HTML形式で抽出データを通知
- ✅ **Script Properties管理** - GCP設定を一元管理
- ✅ **エラーハンドリング** - 重複実行防止、構造化ロギング

### 対応書類タイプ

| 書類タイプ | 対象テーブル | 抽出データ例 | 処理方式 |
|----------|------------|-----------|----------|
| 医療保険証 | Client_Medical_Insurances | 保険者番号、記号・番号、給付割合、有効期間 | 1回API |
| 介護保険証 | Client_LTCI_Insurances | 被保険者番号、要介護度、認定期間 | 1回API |
| 公費 | Client_Public_Subsidies | 公費番号、受給者番号、有効期間 | 1回API |
| 口座情報 | Client_Bank_Accounts | 金融機関名、支店名、口座番号 | 1回API |
| 指示書 | VN_Instructions | 指示期間、医療機関名、病名 | 1回API |
| 負担割合証 | Client_LTCI_Copayment_Certificates | 負担割合、適用期間 | 1回API |
| 提供票 | Service_Provision_Form + Details | 適用月、作成日、サービス明細 | ハイブリッド（OCR + 専用API） |
| 汎用ドキュメント | - | OCRのみ（構造化データなし） | OCRのみ |

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
| main.gs | doPost()、processRequest()、直接実行関数、パス解決 | 501 |
| config_settings.gs | 全ての設定値を一元管理（Drive設定、LOG_LEVEL含む） | 203 |
| modules_documentProcessor.gs | 種類別テーブルへのレコード作成（提供票含む） | 842 |
| modules_geminiClient.gs | Gemini API連携、プロンプト生成 | 436 |
| CommonWebhook.gs | Webhook共通処理 | 236 |
| modules_notification.gs | 完了通知・エラー通知メール送信 | 160 |
| utils_logger.gs | 構造化ロギング、パフォーマンス計測 | 139 |
| **合計** | | **2,517行** |

## セットアップ

### 前提条件

- Google Apps Scriptプロジェクト
- AppSheetアプリ
- GCPプロジェクト（Vertex AI API有効化）
- OAuth2スコープ: `https://www.googleapis.com/auth/cloud-platform`

### 初期設定（必須）

**⚠️ 重要**: 初回実行前に必ずScript Propertiesを設定してください。

詳細は [`SETUP_SCRIPT_PROPERTIES.md`](./SETUP_SCRIPT_PROPERTIES.md) または [`🚨_READ_THIS_FIRST.md`](./🚨_READ_THIS_FIRST.md) を参照。

#### 自動セットアップ（推奨）

GASエディタで以下の関数を実行:

```javascript
setupScriptPropertiesForDocumentOCR()  // 自動設定
checkScriptPropertiesSetup()            // 設定確認
```

#### 設定される項目

Script Propertiesに以下が設定されます:

| キー | 値 | 説明 |
|------|-----|------|
| `GCP_PROJECT_ID` | `macro-shadow-458705-v8` | GCPプロジェクトID |
| `GCP_LOCATION` | `us-central1` | Vertex AIリージョン |
| `VERTEX_AI_MODEL` | `gemini-2.5-flash` | 使用モデル |
| `VERTEX_AI_TEMPERATURE` | `0.1` | 生成温度（精度重視） |
| `VERTEX_AI_MAX_OUTPUT_TOKENS` | `20000` | 最大出力トークン数 |
| `USE_VERTEX_AI` | `true` | Vertex AI使用フラグ |
| `ENABLE_DUPLICATION_PREVENTION` | `true` | 重複実行防止 |

### その他の設定

`config_settings.gs`で以下の設定が可能:

- **AppSheet設定**: アプリID、アクセスキー
- **Google Drive設定**: 基準フォルダーID
- **通知設定**: エラー通知先、完了通知先
- **API呼び出し制限**: 最大呼び出し回数（デフォルト: 2回）

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
// ファイル名で指定（基準フォルダー配下を再帰検索）
directProcessRequest('テスト保険証.pdf')

// ファイルパスで指定（基準フォルダーからの相対パス）
directProcessRequest('利用者A/書類/保険証.pdf')

// ファイル名と書類種類を指定
directProcessRequest('テスト保険証.pdf', '医療保険証')

// 完全な引数指定（ファイル名/パス版）
directProcessRequest(
  '利用者A/書類/保険証.pdf',  // driveFileName
  '医療保険証',                 // documentType
  'CLIENT-001',                // clientId
  'staff@example.com',         // staffId
  '山田太郎',                   // clientName
  'テスト担当者',               // staffName
  '1950/01/01',                // clientBirthDate
  null,                        // documentId (自動生成)
  null                         // fileId (driveFileNameから検索)
)

// ファイルIDで指定（ファイル名変更後も確実に実行可能）
directProcessRequest(
  null,                        // driveFileName (fileIdが優先されるので不要)
  '医療保険証',                 // documentType
  'CLIENT-001',                // clientId
  'staff@example.com',         // staffId
  '山田太郎',                   // clientName
  'テスト担当者',               // staffName
  '1950/01/01',                // clientBirthDate
  null,                        // documentId (自動生成)
  '1a2b3c4d5e6f...'           // fileId（優先）
)
```

**引数:**
1. `driveFileName` (string) - ファイル名、ファイルパス、Drive URL、またはファイルID（fileIdとどちらか必須）
2. `documentType` (string) - 書類種類（デフォルト: '医療保険証'）
3. `clientId` (string) - 利用者ID
4. `staffId` (string) - スタッフID
5. `clientName` (string) - 利用者名
6. `staffName` (string) - スタッフ名
7. `clientBirthDate` (string) - 生年月日（yyyy/mm/dd）
8. `documentId` (string|null) - 書類ID（省略時は自動生成）
9. `fileId` (string|null) - ファイルID（指定時はdriveFileNameより優先、ファイル名変更後も確実に実行可能）

**ファイル指定方法:**
- **ファイル名**: `config_settings.gs`で設定した基準フォルダー配下（サブフォルダー含む）を再帰的に検索
  - 例: `'テスト保険証.pdf'`
- **ファイルパス**: 基準フォルダーからの相対パス（フォルダ階層を指定）
  - 例: `'利用者A/書類/保険証.pdf'`
  - 例: `'/サブフォルダA/サブフォルダB/ファイル.pdf'`
- **Drive URL**: URLから直接ファイルIDを抽出
  - 例: `'https://drive.google.com/file/d/1a2b3c4d5e6f.../view'`
- **ファイルID**: 直接指定（ファイル名変更後も確実に実行可能）
  - 例: `'1a2b3c4d5e6f...'`

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

#### 問題1: Script Propertiesエラー

**エラー例**: `Cannot read properties of undefined (reading 'match')`

**原因**: Script Propertiesが未設定

**解決方法**:
1. `setupScriptPropertiesForDocumentOCR()` を実行
2. `checkScriptPropertiesSetup()` で設定確認

#### 問題2: Vertex AI APIエラー

**エラー例**: `Vertex AI APIエラー（ステータス: 403）`

**原因**:
- Vertex AI APIが有効化されていない
- OAuth2スコープ不足

**解決方法**:
1. GCPコンソールでVertex AI API有効化
2. `appsscript.json`に`https://www.googleapis.com/auth/cloud-platform`追加
3. GASエディタで再認証

#### 問題3: API呼び出し制限超過

**エラー例**: `API呼び出し制限超過: 3回 (上限: 2回)`

**原因**: 1処理で2回を超えるAPI呼び出しが発生

**解決方法**:
- `config_settings.gs`の`maxApiCallsPerExecution`を確認
- 提供票処理の場合は想定内（OCR + 専用抽出で2回）
- それ以外の場合はログを確認して原因特定

#### 問題4: 書類仕分けがスキップされる

**原因**:
- `structured_data`がnull
- `client_id`または`staff_id`が不足

**解決方法**:
- `documentType`が対応書類タイプか確認
- Webhookペイロードに`client_id`と`staff_id`を含める

#### 問題5: ファイルが見つからない

**エラー例**: `ファイルが見つかりません: テスト.pdf`

**解決方法**:
- ファイルが基準フォルダー（`DRIVE_CONFIG.baseFolderId`）配下に存在するか確認
- ファイル名が正確か確認
- ファイルIDで直接指定を試す

## デプロイメント履歴

| バージョン | 日時 | 説明 | ステータス |
|---------|------|------|------------|
| v2.1 | 2025-10-20 12:00 | Vertex AI専用化、gemini-2.5-flash採用、API呼び出し制限追加 | ✓ 本番稼働中 |
| v2.0 | 2025-10-18 18:00 | 書類OCR + 書類仕分け統合、1回のAPI呼び出しで完結 | ✓ 廃止 |
| v1.0 | 2025-07-17 08:00 | 初期バージョン（OCRのみ） | ✓ 廃止 |

## 参照ドキュメント

- [`🚨_READ_THIS_FIRST.md`](./🚨_READ_THIS_FIRST.md) - **最初に読むべきドキュメント**（Script Properties設定手順）
- [`SETUP_SCRIPT_PROPERTIES.md`](./SETUP_SCRIPT_PROPERTIES.md) - Script Properties詳細設定ガイド
- [`FLOW.md`](./FLOW.md) - 処理フロー図
- [`SPECIFICATIONS.md`](./SPECIFICATIONS.md) - 技術仕様書
- [`CLAUDE.md`](./CLAUDE.md) - 開発ログ
- [`MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md) - 移行ガイド

## Referenced Spreadsheets

- **GAS実行ログ** (ID: 16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA)

## バージョン履歴

### v2.1.0 (2025-10-20)

**重要な変更**:
- ✅ **Google AI Studio API完全廃止** → Vertex AI専用化
- ✅ **gemini-2.5-flash採用** → コスト75%削減
- ✅ **API呼び出し制限追加** → 1処理最大2回
- ✅ **Script Properties管理** → GCP設定の一元化

**技術的変更**:
- `analyzeDocumentWithGemini()`: Vertex AIのみ使用（フォールバック削除）
- `config_settings.gs`: GEMINI_CONFIG廃止マーク追加
- `script_properties_manager.gs`: GCP設定管理追加
- `test_functions.gs`: Script Properties自動設定関数追加

**破壊的変更**:
- Google AI Studio API完全削除（APIキー不要）
- `GEMINI_CONFIG.apiKey`は空文字列（互換性のため残存）
- OAuth2認証必須（`https://www.googleapis.com/auth/cloud-platform`）

### v2.0.0 (2025-10-18)

**主な機能**:
- 書類OCR + 書類仕分け統合
- 1回のAPI呼び出しでOCR + 構造化データ抽出
- 提供票対応（ハイブリッド処理）

### v1.0.0 (2025-07-17)

**初期リリース**:
- 基本的なOCR機能
- Google AI Studio API使用

## ライセンス

Internal use only - Fractal Group
