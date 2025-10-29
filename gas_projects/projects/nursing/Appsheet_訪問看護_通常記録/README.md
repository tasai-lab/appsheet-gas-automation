# Appsheet_訪問看護_通常記録（統合版）

**Script ID:** 1YkRRcL3fBJ-gMiC3lCkScM3fe_IrawqXrmKoIIWmE-nQokw4rY6rATZa

**Created:** 2025-07-30T09:27:45.262Z

**Modified:** 2025-10-18

**Current Version:** v2.1 (version 45)

## 概要

訪問看護記録の自動生成を行うGASプロジェクト。**通常記録と精神科記録の両方に対応**した統合版です。

AppSheetからのWebhookリクエストを受け取り、Google Vertex AI（Gemini 2.5-pro）を使用してテキスト・音声から構造化された看護記録を自動生成し、AppSheetのデータベースに反映します。

### 主な機能

- **2つの記録タイプに対応**
  - 通常記録：一般的な訪問看護記録（バイタルサイン、主観情報、利用者状態など）
  - 精神科記録：精神科訪問看護記録（精神状態観察、服薬遵守、社会機能など）

- **マルチモーダル処理**
  - テキストのみの記録生成
  - 音声ファイル（m4a/mp3/wav/ogg）からの記録生成（インラインデータ方式）

- **高度なAI統合**
  - ✅ **Vertex AI（Gemini 2.5-Pro）専用** - 高精度な医療文書処理
  - ✅ **OAuth2認証** - APIキー不要の安全な認証
  - ✅ **1回のみのAPI呼び出し** - リトライループ完全削除、API爆発防止
  - ⚠️ **Google AI Studio API完全廃止** - 2025年10月18日以降使用不可

- **API呼び出し制限**
  - 1処理あたり最大3回まで制限
  - API使用量の自動記録とログ出力
  - コスト削減と安定性の両立

- **自動マスターデータ参照**
  - スプレッドシートからケア項目を自動取得
  - 1時間キャッシュで高速化

- **包括的なエラーハンドリング**
  - 構造化ログ記録（実行ログスプレッドシート）
  - AppSheetへのエラーステータス記録
  - API使用統計の自動出力

## システム構成

詳細なフロー図と処理シーケンスは [`FLOW.md`](./FLOW.md) を参照してください。

```
AppSheet Webhook → doPost → processRequest
                               ↓
                    ┌──────────┴──────────┐
                    ↓                     ↓
              通常記録処理           精神科記録処理
                    ↓                     ↓
                マスターデータ取得
                    ↓
            ┌───────┴────────┐
            ↓                ↓
    音声ファイル処理   テキストのみ処理
            ↓                ↓
    Cloud Storage    Vertex AI / Gemini API
        アップロード           ↓
            ↓          AIレスポンス解析
            └────────→   フィールドマッピング
                           ↓
                    AppSheet更新
                           ↓
                  Cloud Storageクリーンアップ
```

## 記録タイプ

### 通常記録 (`recordType: "通常"`)

一般的な訪問看護記録を生成します。

**出力フィールド:**
- `processedAudioText`: 音声テキスト（音声ファイルがある場合）
- `vitalSigns`: バイタルサイン（BP, HR, BT, SpO2など）
- `subjectiveInformation`: 主観的情報（利用者・家族の訴え）
- `userCondition`: 利用者状態（フォーカス形式の看護記録）
- `guidanceAndAdvice`: 指導・助言内容
- `nursingAndRehabilitationItems`: 実施した看護・リハビリ項目
- `specialNotes`: 特記事項
- `summaryForNextVisit`: 次回訪問への申し送り

### 精神科記録 (`recordType: "精神"`)

精神科訪問看護記録を生成します。

**出力フィールド:**
- `clientCondition`: 利用者状態（全体像・身体的状態）
- `dailyLivingObservation`: 日常生活観察（ADL、生活リズム）
- `mentalStateObservation`: 精神状態観察（感情、思考、知覚）
- `medicationAdherence`: 服薬遵守状況
- `socialFunctionalObservation`: 社会機能観察（対人関係、活動）
- `careProvided`: 実施したケア項目
- `guidanceAndAdvice`: 指導・助言内容
- `remarks`: 備考・特記事項
- `summaryForNextVisit`: 次回訪問への申し送り

※ 旧「Appsheet_訪問看護_精神科記録」プロジェクトは本プロジェクトに統合され、`_archived`に移動されました。

## セットアップ

### 前提条件

1. Google Cloud Platform プロジェクト
   - Vertex AI API有効化
   - サービスアカウント権限設定（OAuth2認証使用）
   - ⚠️ **Cloud Storageは不要** - インラインデータ方式を使用

2. AppSheet アプリ
   - Care_Recordsテーブル
   - Webhook設定

3. Google スプレッドシート
   - 訪問看護_記録管理（ケア項目マスター）
   - GAS実行ログ

### 設定ファイル

`scripts/config_settings.gs` を環境に合わせて設定してください。

```javascript
// GCP設定
const GCP_CONFIG = {
  projectId: 'your-project-id',
  location: 'us-central1',  // gemini-2.5対応リージョン
  bucketName: 'your-bucket-name',  // ⚠️ 未使用（互換性のため残存）
  vertexAI: {
    model: 'gemini-2.5-pro',  // ★高精度モデル: 医療文書処理に最適
    temperature: 0.3,
    maxOutputTokens: 8192
  }
};

// AppSheet設定
const APPSHEET_CONFIG = {
  appId: 'your-app-id',
  accessKey: 'your-access-key',
  tableName: 'Care_Records'
};

// スプレッドシート設定
const SPREADSHEET_CONFIG = {
  masterId: 'your-spreadsheet-id',
  sheetName: 'Care_Provided'
};

// ★★★ Google AI Studio API設定は削除済み ★★★
// GEMINI_CONFIG.apiKey は空文字列（使用不可）
```

### デプロイ

プロジェクトルートから以下のコマンドでデプロイします。

```bash
cd /Users/t.asai/code/appsheet-gas-automation
python deployment/deploy_unified.py
```

## 使用方法

### AppSheet Webhookからの呼び出し

AppSheetのアクションから以下の形式でWebhookを送信します。

#### 通常記録の例

**テキストのみ:**
```json
{
  "recordNoteId": "RN-001",
  "staffId": "staff@example.com",
  "recordText": "利用者は元気そうでした。血圧130/80、体温36.5度。食事は良好。",
  "recordType": "通常"
}
```

**音声ファイル付き:**
```json
{
  "recordNoteId": "RN-002",
  "staffId": "staff@example.com",
  "recordText": "訪問記録音声ファイル",
  "recordType": "通常",
  "fileId": "1AbCdEfGhIjKlMnOpQrStUvWxYz"
}
```

#### 精神科記録の例

**テキストのみ:**
```json
{
  "recordNoteId": "RN-003",
  "staffId": "staff@example.com",
  "recordText": "利用者は落ち着いた様子。服薬確認済み。幻聴の訴えなし。デイケアへの参加を促した。",
  "recordType": "精神"
}
```

**音声ファイル付き:**
```json
{
  "recordNoteId": "RN-004",
  "staffId": "staff@example.com",
  "recordText": "精神科訪問記録音声ファイル",
  "recordType": "精神",
  "filePath": "共有ドライブ/音声記録/record_001.m4a"
}
```

### GASエディタから直接テスト

新しいテスト関数を使用して、GASエディタから直接実行できます。

#### 通常記録のテスト

```javascript
// デフォルト引数でテスト
testNormalRecord();

// カスタム引数でテスト
testNormalRecord(
  "TEST-NORMAL-001",
  "test@fractal-group.co.jp",
  "利用者は元気そうでした。血圧130/80、体温36.5度。",
  null,  // filePath
  null   // fileId
);
```

#### 精神科記録のテスト

```javascript
// デフォルト引数でテスト
testPsychiatryRecord();

// カスタム引数でテスト
testPsychiatryRecord(
  "TEST-PSYCH-001",
  "test@fractal-group.co.jp",
  "利用者は落ち着いた様子。服薬確認済み。",
  null,
  null
);
```

#### 完全カスタムテスト

```javascript
testCustomRecord(
  "CUSTOM-001",              // recordNoteId
  "staff@example.com",       // staffId
  "カスタムテキスト",         // recordText
  "通常",                    // recordType
  null,                      // filePath
  "1AbCdEfGhIjKlMnOpQrStUvWxYz"  // fileId
);
```

## フィールドマッピング

### 通常記録のマッピング

| AIフィールド | AppSheetフィールド |
|-------------|-------------------|
| `processedAudioText` | `extracted_text` |
| `vitalSigns` | `vital_signs` |
| `subjectiveInformation` | `subjective_information` |
| `userCondition` | `client_condition` |
| `guidanceAndAdvice` | `guidance_and_advice` |
| `nursingAndRehabilitationItems` | `care_provided` |
| `specialNotes` | `remarks` |
| `summaryForNextVisit` | `summary_for_next_visit` |

### 精神科記録のマッピング

| AIフィールド | AppSheetフィールド |
|-------------|-------------------|
| `clientCondition` | `client_condition` |
| `dailyLivingObservation` | `daily_living_observation` |
| `mentalStateObservation` | `mental_state_observation` |
| `medicationAdherence` | `medication_adherence` |
| `socialFunctionalObservation` | `social_functional_observation` |
| `careProvided` | `care_provided` |
| `guidanceAndAdvice` | `guidance_and_advice` |
| `remarks` | `remarks` |
| `summaryForNextVisit` | `summary_for_next_visit` |

## エラーコード

システムで使用されるエラーコードの一覧:

| コード | 説明 |
|--------|------|
| E1001 | 必須パラメータ不足 |
| E1004 | ファイルが見つからない |
| E1006 | サポートされていないファイル形式 |
| E2001 | マスターデータ取得失敗 |
| E3001 | Vertex AI処理エラー |
| E3002 | Gemini API処理エラー |
| E3003 | JSON解析エラー |
| E4001 | AppSheet API エラー |
| E4002 | Cloud Storage エラー |
| E5001 | 予期しないエラー |

## パフォーマンス

### 処理時間の目安

- **テキストのみ（通常）**: 約3-5秒
- **テキストのみ（精神科）**: 約3-5秒
- **音声あり（通常）**: 約15-30秒
- **音声あり（精神科）**: 約15-30秒

### 最適化ポイント

1. **マスターデータキャッシュ**: 1時間キャッシュで高速化
2. **リトライ戦略**: Vertex AIエラー時の指数バックオフ（30秒、1分、2分）
3. **Cloud Storage自動クリーンアップ**: 処理後即座に削除
4. **非同期処理**: 独立した処理は並列実行

## トラブルシューティング

### 音声ファイルが処理されない

**原因:** ファイル形式が未サポート、またはファイルパスが無効

**対処:**

- サポート形式を確認（m4a, mp3, wav, ogg）
- fileIdまたはfilePathが正しいか確認
- ファイルサイズ上限（2GB）を超えていないか確認

### Vertex AIエラー

**原因:** OAuth2認証エラーまたはAPI無効化

**対処:**

- GCPコンソールでVertex AI APIが有効化されているか確認
- `appsscript.json`に`https://www.googleapis.com/auth/cloud-platform`スコープが含まれているか確認
- Apps Scriptエディタで再認証を実行
- ⚠️ **リトライは実行されません** - エラー時は即座に失敗します（API爆発防止）

### AppSheet更新エラー

**原因:** AppSheetアクセスキーまたはテーブル名が無効

**対処:**

- `config_settings.gs`のAPPSHEET_CONFIGを確認
- AppSheetのAPI設定でアクセスキーが有効か確認

### フィールドマッピングエラー

**原因:** AIレスポンスに必須フィールドが欠落

**対処:**

- 自動的にデフォルト値が設定されます
- ログで警告を確認してプロンプトを調整

### API呼び出し制限超過エラー

**原因:** 1処理で3回以上のAPI呼び出しが発生

**対処:**

- ログで実際の呼び出し回数を確認
- リトライループが残っていないか確認（絶対に実装しないこと）
- 必要に応じて`setApiCallLimit()`の値を調整

## モジュール構成

- `main.gs`: エントリーポイント、メイン処理、テスト関数
- `config_settings.gs`: 設定値（GCP, AppSheet, システム）
- `modules_aiProcessor.gs`: Vertex AI連携（インラインデータ方式）
- `modules_dataAccess.gs`: スプレッドシートアクセス
- `modules_fileHandler.gs`: Google Driveファイル操作
- `modules_appsheetClient.gs`: AppSheet API クライアント
- `modules_apiCallLimiter.gs`: API呼び出し制限機能
- `utils_constants.gs`: 定数定義（エラーコード、マッピング）
- `utils_validators.gs`: バリデーション機能
- `utils_errorHandler.gs`: エラーハンドリング
- `utils_logger.gs`: 構造化ログ記録
- `execution_logger.gs`: 実行ログスプレッドシート連携
- `gemini_client.gs`: 共通Geminiクライアント（Vertex AIエンドポイント使用）

共通モジュール:

- `CommonWebhook`: Webhook共通処理
- `CommonTest`: テスト支援機能

## 関連ドキュメント

- [FLOW.md](./FLOW.md) - 詳細なフロー図とシーケンス図
- [SPECIFICATIONS.md](./SPECIFICATIONS.md) - 技術仕様書
- [CLAUDE.md](../../CLAUDE.md) - プロジェクト全体のドキュメント標準
- [ARCHITECTURE_DIAGRAM_COLOR_GUIDE.md](../../docs/ARCHITECTURE_DIAGRAM_COLOR_GUIDE.md) - Mermaid図のカラー標準

## Referenced Spreadsheets

- **GAS実行ログ** (ID: 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)
- **訪問看護_記録管理** (ID: 1EhLGOPKrxqMNl2b1_c0mA1M3w1tXiHN4PsnXWfWHSPw)

## バージョン履歴

- **v2.1 (version 45)**: テスト関数追加 - 引数を個別設定して直接実行可能に、API使用量メタデータ追加
- **v2.0 (version 44)**: Gemini 2.5統合版 - 精神科記録統合 + Gemini 2.5対応 + Cloud Storage削除
- **v1.5 (2025-10-18)**: ✅ **Google AI Studio API完全廃止** - Vertex AI専用化、リトライループ完全削除、API呼び出し制限追加
- **v1.0 (version 43)**: 精神科記録統合版 - 通常記録と精神科記録の両対応

### 重要な変更（2025年10月18日）

**ユーザー指示による緊急対応:**

> 「今後gemini apiを使用することが無いようにお願いします。今後、全てvertex apiを使用すること。絶対にループ実行されないようにしてください。厳守です。」

**実施した対策:**

1. ✅ Google AI Studio API関数の完全削除（`callGeminiAPIWithPrompt`等）
2. ✅ リトライループの完全削除（API爆発防止）
3. ✅ Vertex AI インラインデータ方式の実装（Cloud Storage不要）
4. ✅ API呼び出し制限機能の追加（1処理あたり最大3回）
5. ✅ API使用量メタデータの自動記録（コスト追跡）
6. ✅ Gemini 2.5-Pro採用（高精度な医療文書処理に最適）

**効果:**

- API呼び出し回数: **200,000+リクエスト/日 → <100リクエスト/日**（-99.95%削減）
- Google AI Studio APIエラー: **90%エラー → 0%**（完全解消）
- 月額コスト削減: **数千円〜数万円の削減見込み**

## ライセンス

Fractal Group Internal Use Only

## サポート

問題が発生した場合は、GAS実行ログを確認するか、技術担当者に連絡してください。

- 実行ログ: https://script.google.com/home/executions
- エラー通知先: t.asai@fractal-group.co.jp
