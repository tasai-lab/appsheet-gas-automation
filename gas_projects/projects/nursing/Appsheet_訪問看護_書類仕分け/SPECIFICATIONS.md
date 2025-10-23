# Appsheet_訪問看護_書類仕分け - 詳細仕様書

## 目的

このスクリプトは、AppSheet Webhookからのリクエストを受信し、OCRテキストデータを解析して訪問看護業務に必要な各種書類情報を構造化データとして抽出し、対応するAppSheetテーブルに自動登録します。

## システム構成

### コンポーネント

1. **Webhook受信ハンドラ** (`doPost`)
   - AppSheetからのPOSTリクエストを受信
   - CommonWebhookモジュールを使用した統一処理
   - リクエストパラメータの検証とパース

2. **重複防止モジュール** (`duplication_prevention.gs`)
   - Script Propertiesによる処理中/完了状態の管理
   - LockServiceによる排他制御（30秒タイムアウト）
   - レコードIDベースの重複チェック

3. **実行ログモジュール** (`logger.gs`)
   - 統合GAS実行ログスプレッドシートへの記録
   - タイムスタンプ、ステータス、処理時間、エラー詳細の保存
   - APIコスト情報の記録（トークン数、料金）

4. **Gemini APIクライアント** (`gemini_client.gs`)
   - Gemini 2.5-Flash/2.5-Proモデルの利用
   - テキスト生成・JSON生成・チャット機能
   - 使用量メタデータの自動取得（USD/JPY両方）

5. **ビジネスロジック** (`main.gs`)
   - 書類種別ごとの情報抽出
   - AppSheetテーブルへのレコード作成
   - データ変換と正規化
   - 完了通知メール送信

6. **Script Properties管理** (`script_properties_manager.gs`)
   - 設定値の一元管理
   - 重複回避機能のon/off切り替え
   - GCP/Vertex AI設定の管理

### 対応書類種別

| 書類種別 | AppSheetテーブル | レコードIDプレフィックス |
|---------|-----------------|---------------------|
| 医療保険証 | Client_Medical_Insurances | MEDI- |
| 介護保険証 | Client_LTCI_Insurances | LTCI- |
| 公費受給者証 | Client_Public_Subsidies | SUBS- |
| 口座情報 | Client_Bank_Accounts | BANK- |
| 訪問看護指示書 | VN_Instructions | INST- |
| 介護保険負担割合証 | Client_LTCI_Copayment_Certificates | COPA- |
| 介護サービス提供票 | Service_Provision_Form, Service_Form_Details | FORM- |

## 関数一覧

### エントリーポイント

- `doPost(e)` - Webhook受信処理（CommonWebhook.handleDoPost使用）
- `processRequest(params)` - メイン処理関数
- `testProcessRequest()` - テスト用関数

### 書類種別ごとの抽出・登録関数

#### 医療保険証
- `extractMedicalInsuranceInfo(ocrText, birthDate, log)` - Gemini APIで情報抽出
- `createMedicalInsuranceRecord(context, extractedInfo, log)` - AppSheetレコード作成

#### 介護保険証
- `extractLtciInsuranceInfo(ocrText, log)` - Gemini APIで情報抽出
- `createLtciInsuranceRecord(context, extractedInfo, log)` - AppSheetレコード作成

#### 公費受給者証
- `extractSubsidyInfo(ocrText, birthDate, log)` - Gemini APIで情報抽出
- `createSubsidyRecord(context, subsidyInfo, log)` - AppSheetレコード作成

#### 口座情報
- `extractBankAccountInfo(ocrText, log)` - Gemini APIで情報抽出
- `createBankAccountRecord(context, bankInfo, log)` - AppSheetレコード作成

#### 訪問看護指示書
- `extractInstructionInfo(ocrText, log)` - Gemini APIで情報抽出
- `createInstructionRecord(context, instructionInfo, log)` - AppSheetレコード作成

#### 負担割合証
- `extractCopayInfo(ocrText, log)` - Gemini APIで情報抽出
- `createCopayCertificateRecord(context, copayInfo, log)` - AppSheetレコード作成

#### 提供票
- `extractFormData(ocrText, log)` - Gemini APIで情報抽出（非同期トリガー処理）
- `createNewServiceFormAndDetails(context, extractedFormData, serviceMasterMap, log)` - ヘッダーと明細の作成

### 共通ヘルパー関数

- `parseCompositeOcrText(compositeText)` - 複合テキストの分解
- `updateDocumentStatus(documentId, status, errorMessage, log)` - 書類管理テーブルのステータス更新
- `callAppSheetApi(tableName, payload, log)` - AppSheet API呼び出し
- `callGeminiApi(prompt, log)` - Gemini API呼び出し
- `sendCompletionNotificationEmail(context, documentType, extractedData, recordId, viewName, log)` - 完了通知メール送信
- `sendProcessLogEmail(documentId, documentType, status, errorMessage, logCollector)` - 処理ログメール送信
- `getPublicSubsidyMasterAsText(log)` - 公費マスターの取得
- `getServiceMasterAsMap(log)` - 介護サービスマスターの取得
- `getPrefectureCode(prefectureName)` - 都道府県コードの取得

### 重複防止関数（duplication_prevention.gs）

- `DuplicationPrevention` - 重複防止クラス
- `isAlreadyProcessed(recordId)` - 処理済みチェック
- `markAsProcessing(recordId, timeout)` - 処理開始記録
- `markAsCompleted(recordId, success)` - 処理完了記録
- `executeWithRetry(recordId, processFunction, logger)` - リトライ付き実行
- `createDuplicationPrevention(scriptName)` - インスタンス作成ヘルパー

### ロガー関数（logger.gs）

- `GASLogger` - ロガークラス
- `log(level, message, details)` - ログ追加
- `info(message, details)` - INFOレベルログ
- `success(message, details)` - SUCCESSレベルログ
- `warning(message, details)` - WARNINGレベルログ
- `error(message, details)` - ERRORレベルログ
- `setUsageMetadata(usageMetadata)` - API使用量情報設定
- `saveToSpreadsheet(status, recordId)` - スプレッドシートに保存
- `createLogger(scriptName)` - ロガーインスタンス作成

### Gemini APIクライアント関数（gemini_client.gs）

- `GeminiClient` - Gemini APIクライアントクラス
- `generateText(prompt, logger)` - テキスト生成
- `generateJSON(prompt, logger)` - JSON生成
- `generateChat(messages, logger)` - チャット形式生成
- `createGeminiFlashClient(options)` - Flashモデルクライアント作成
- `createGeminiProClient(options)` - Proモデルクライアント作成
- `getGeminiPricing(model)` - モデル別価格情報取得

### メンテナンス関数

- `clearAllProcessLocks()` - 全ロック情報のクリア（clean.gs, reset.gs）
- `clearSpecificLock()` - 特定レコードのロック解除（clean.gs, reset.gs）
- `listScriptProperties()` - Script Propertiesの一覧表示（script_properties_manager.gs）
- `enableDuplicationPrevention()` - 重複回避機能の有効化（script_properties_manager.gs）
- `disableDuplicationPrevention()` - 重複回避機能の無効化（script_properties_manager.gs）

## データフロー

```
AppSheet Webhook
    ↓
doPost(e)
    ↓
CommonWebhook.handleDoPost()
    ↓
processRequest(params)
    ↓
parseCompositeOcrText() - OCRテキストの分解
    ↓
LockService + Script Properties - 重複チェック・ロック取得
    ↓
書類種別判定
    ├─ 医療保険証 → extractMedicalInsuranceInfo() → createMedicalInsuranceRecord()
    ├─ 介護保険証 → extractLtciInsuranceInfo() → createLtciInsuranceRecord()
    ├─ 公費 → extractSubsidyInfo() → createSubsidyRecord()
    ├─ 口座情報 → extractBankAccountInfo() → createBankAccountRecord()
    ├─ 指示書 → extractInstructionInfo() → createInstructionRecord()
    ├─ 負担割合証 → extractCopayInfo() → createCopayCertificateRecord()
    └─ 提供票 → トリガーで非同期処理（processProvisionForm）
    ↓
callAppSheetApi() - AppSheetテーブルへのレコード追加
    ↓
updateDocumentStatus() - 書類管理テーブルのステータス更新
    ↓
sendCompletionNotificationEmail() - 完了通知メール送信
    ↓
Script Properties更新（completed）
    ↓
レスポンス返却
```

## Gemini API統合

### 使用モデル
- **Gemini 2.5-Flash**: 標準処理（デフォルト）
- **Gemini 2.5-Pro**: 複雑な思考が必要な場合（オプション）

### プロンプト設計
各書類種別ごとに専用のプロンプトテンプレートを使用：

1. **医療保険証**: 保険分類・給付割合・所得区分・職務上事由・減免区分のコード変換ロジック
2. **介護保険証**: 要介護状態区分のコード変換、次回更新確認日の自動計算（認定終了日の1ヶ月前）
3. **公費受給者証**: 公費制度名のマスターマッチング、給付率計算
4. **口座情報**: カナ変換、口座番号正規化
5. **指示書**: 都道府県コード取得、疾病コード抽出
6. **負担割合証**: 負担割合から給付割合への変換
7. **提供票**: 複数ページにわたるサービス明細の抽出

### レスポンス形式
- JSON形式での構造化データ
- 必須フィールド検証
- エラーハンドリング（JSONパース失敗時のリトライなし）

## エラーハンドリング

### エラーレベル

1. **処理中**: 重複リクエスト検知（Script Properties確認）
2. **エラー**: 処理失敗時のロールバック
   - 書類管理テーブルのステータスを「エラー」に更新
   - Script Propertiesのロック解除
   - エラーメールの送信

### エラー記録

すべてのエラーは以下に記録：
- 統合GAS実行ログスプレッドシート（16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA）
- 処理ログメール（ERROR_NOTIFICATION_EMAIL宛）

### エラー詳細
- エラーメッセージ
- スタックトレース
- 入力データ（ocrText、documentType等）
- 実行時間

## パフォーマンス考慮事項

### ロック戦略

- **タイムアウト**: 30秒（メイン処理）、10秒（エラー時）
- **スコープ**: スクリプトレベル（LockService.getScriptLock()）
- **リリース**: finally句で確実に解放

### Script Properties管理

- **キー形式**: `{documentId}` （例: CLDC-211f6fc6）
- **値**: `processing` または `completed`
- **クリーンアップ**: 手動（clearAllProcessLocks関数）

### 非同期処理

- **提供票**: タイムアウト回避のため、トリガーで3秒後に非同期実行
- **Context保存**: `CONTEXT_{documentId}` キーでScript Propertiesに一時保存

## セキュリティ

### 認証

- AppSheet Webhook: ACCESS_KEYによる認証
- AppSheet API: ACCESS_KEYによる認証
- Gemini API: Google AI Studio APIキー（GEMINI_API_KEYは削除済み、Vertex AI使用推奨）

### データ保護

- APIキーはスクリプト内で管理（Script Properties推奨）
- 実行ログには機密情報を含めない
- エラーメールは管理者のみに送信

## 制限事項

### Google Apps Script制限

- **実行時間**: 最大6分（提供票は非同期で回避）
- **Script Properties**: 約500KB（キーと値の合計）
- **同時実行**: ロックにより排他制御

### AppSheet API制限

- **レート制限**: 毎分60リクエスト
- **ペイロードサイズ**: 1MB
- **タイムアウト**: 30秒

### Gemini API制限

- **1日あたり**: 1,500リクエスト（無料枠）
- **トークン制限**: モデルごとに異なる
- **レスポンスサイズ**: 最大8,192トークン（maxOutputTokens設定）

## テスト

### 単体テスト

```javascript
function testProcessRequest() {
  const testParams = {
    documentId: 'CLDC-test123',
    clientId: 'CL-test456',
    documentType: '医療保険証',
    staffId: 'ST-test789',
    ocrText: '保険者番号: 12345678...',
    driveFileId: 'test_file_id',
    clientBirthDate: '1950/01/01',
    clientName: 'テスト 太郎',
    staffName: 'スタッフ 花子'
  };

  return CommonTest.runTest(
    (params) => processRequest(params),
    testParams,
    'Appsheet_訪問看護_書類仕分け'
  );
}
```

### 統合テスト

AppSheetから実際のWebhookを送信してテストします。

## 保守

### ログ確認

定期的に統合GAS実行ログスプレッドシートを確認：
- エラー率
- 処理時間の傾向
- Gemini APIコスト
- 重複リクエストの頻度

### ロック状態の確認

Script Propertiesに残留しているロックを確認：
```javascript
// GASエディタで実行
listScriptProperties();
```

### 強制ロック解除

処理が途中で止まった場合：
```javascript
// 全ロック解除
clearAllProcessLocks();

// 特定IDのみ解除
clearSpecificLock(); // 関数内でdocumentIdを指定
```

### アップデート手順

1. スクリプトを更新
2. バージョン作成
3. `clasp push`でデプロイ
4. テスト実行
5. ログで動作確認

## 付録

### 設定値

| 項目 | 値 | 説明 |
|------|-----|------|
| APP_ID | f40c4b11-b140-4e31-a60c-600f3c9637c8 | AppSheetアプリID |
| ACCESS_KEY | V2-s6fif-... | AppSheet APIアクセスキー |
| 統合ログスプレッドシートID | 16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA | GAS実行ログ |
| ロックタイムアウト | 30000ミリ秒 | LockService |
| Geminiモデル | gemini-2.5-flash | デフォルト |

### 外部マスタースプレッドシート

| マスター名 | スプレッドシートID | シート名 |
|-----------|------------------|---------|
| 公費マスター | 1ZUDnN-gkgfC0BMuwdZp2hP6yQhhMp3bCt_VA-NqTl9g | Public_Subsidy_Master |
| 介護サービスマスター | 1r-ehIg7KMrSPBCI3K1wA8UFvBnKvqp1kmb8r7MCH1tQ | 介護_基本・加算マスター |
| 提供票データ | 11ciS14lVjl1Ka_QyysD_ZPGLe6wRx9iBhxFkmr8a1Kc | - |

### 関連リソース

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [AppSheet API Documentation](https://support.google.com/appsheet/answer/10105769)
- [Gemini API Documentation](https://ai.google.dev/docs)
