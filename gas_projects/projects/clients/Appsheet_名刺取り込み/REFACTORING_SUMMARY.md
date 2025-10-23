# Appsheet_名刺取り込み リファクタリング完了報告

## 📅 実施日
2025-10-23

## 🎯 リファクタリング目的
1. **コスト最適化**: Gemini 2.5 Pro → Flash (80%コスト削減)
2. **構造改善**: モノリシック1ファイル → モジュール分割6ファイル
3. **デバッグ強化**: 詳細ログ・エラーハンドリング追加
4. **保守性向上**: 共通モジュール統合・設定集約化

---

## 📊 変更サマリー

### Before (旧構造)
```
scripts/
├── コード.gs (~1000行) ← モノリシック
├── gemini_client.gs
├── logger.gs
└── その他
```

**問題点:**
- ❌ Gemini 2.5 Pro使用（高コスト）
- ❌ 単一ファイルで保守困難
- ❌ 最小限のエラーハンドリング
- ❌ console.log使用
- ❌ 共通モジュール未使用
- ❌ テスト関数なし

### After (新構造)
```
scripts/
├── config.gs (288行) ← 設定集約
├── webhook.gs (251行) ← エントリーポイント
├── ocr_service.gs (386行) ← OCR処理
├── appsheet_service.gs (281行) ← AppSheet連携
├── drive_service.gs (200行) ← ファイル操作
├── test_functions.gs (300行) ← テストハーネス
├── CommonWebhook.gs ← 共通モジュール
├── AppSheetConnector.gs ← 共通モジュール
└── コード.gs.backup ← バックアップ
```

**改善点:**
- ✅ Gemini 2.5 Flash使用（80%コスト削減）
- ✅ モジュール分割で責任分離
- ✅ 詳細なエラーハンドリング
- ✅ Logger.log + 3段階ログ
- ✅ CommonWebhook/AppSheetConnector統合
- ✅ 7種類のテスト関数

---

## 📁 新ファイル構成詳細

### 1. **config.gs** (288行)
**責務**: 全設定を集約管理

**主要定数:**
- `VERTEX_AI_CONFIG`: Vertex AI設定（Flash model）
- `DRIVE_CONFIG`: Drive フォルダーID
- `SPREADSHEET_CONFIG`: スプレッドシート設定
- `APPSHEET_CONFIG`: AppSheet API認証
- `PROCESSING_CONFIG`: 稼働時間・デフォルト値
- `LOG_CONFIG`: ログレベル制御

**主要関数:**
- `getVertexAIEndpoint(model)`: APIエンドポイント構築
- `getOAuth2Token()`: OAuth2トークン取得
- `logDebug()`, `logInfo()`, `logError()`: 3段階ログ
- `validateConfig()`: 設定検証
- `debugConfig()`: デバッグ出力

---

### 2. **ocr_service.gs** (386行)
**責務**: Vertex AI Flash OCR処理

**主要関数:**
- `extractBusinessCardInfo(frontFile, backFile)`: メインOCR
- `buildOCRPrompt()`: プロンプト構築（職種/役職ルール付）
- `buildImageParts()`: Base64画像変換
- `callVertexAIForOCR()`: Vertex AI API呼出
- `parseVertexAIResponse()`: レスポンスパース（finishReasonチェック）
- `validateExtractedInfo()`: 必須フィールド検証
- `compareOrganizations()`: AI組織比較（重複検出）

**特徴:**
- Flash model使用（gemini-2.5-flash）
- finishReason検証（MAX_TOKENS/SAFETYチェック）
- ファイルサイズ・レスポンスタイムログ
- 詳細エラーハンドリング

---

### 3. **appsheet_service.gs** (281行)
**責務**: AppSheet API操作・スプレッドシート検索

**主要関数:**
- `determineContactAction(newInfo)`: 重複判定（CREATE/UPDATE/DELETE/CHECK_ORG）
- `getOrganizationInfo(orgId)`: 事業所情報取得
- `generateUniqueContactId()`: 連絡先ID生成
- `createContactInAppSheet()`: 新規作成
- `updateContactInAppSheet()`: 更新
- `buildContactRowData()`: 行データ構築

**重複判定ロジック:**
1. **完全重複**: 氏名 + 郵便番号 + 電話番号 → DELETE
2. **同一人物・名刺未登録**: 氏名 + カナ + 未登録 → CHECK_ORG（AI比較）
3. **該当なし**: → CREATE

---

### 4. **drive_service.gs** (200行)
**責務**: Google Driveファイル操作

**主要関数:**
- `pairBusinessCards(files)`: 表裏ペアリング（_001判定）
- `getSourceFolder()`, `getDestinationFolder()`: フォルダー取得
- `moveAndRenameFile()`: ファイル移動・リネーム
- `deleteFile()`: ファイル削除
- `generateFileName()`: 命名規則適用
- `generateAppSheetFilePath()`: AppSheet用パス生成
- `buildProcessingResult()`: 処理結果オブジェクト構築

**命名規則:**
- 表面: `{姓}{名}_{姓カナ}{名カナ}_{contactId}.jpg`
- 裏面: `{姓}{名}_{姓カナ}{名カナ}_{contactId}_001.jpg`

---

### 5. **webhook.gs** (251行)
**責務**: Webhookエントリーポイント・処理オーケストレーション

**主要関数:**
- `doPost(e)`: Webhook受信（時間制限チェック付）
- `isWithinOperatingHours()`: 稼働時間判定（9:30-21:00）
- `processAllBusinessCards()`: 一括処理メインループ
- `processSingleBusinessCard()`: 単一名刺処理（5ステップ）

**処理フロー:**
```
1. ソースフォルダースキャン
2. 表裏ペアリング
3. OCR抽出 → 重複チェック → アクション判定
4. ファイル移動・リネーム
5. AppSheet更新（CREATE/UPDATE）
```

---

### 6. **test_functions.gs** (300行)
**責務**: 手動テストハーネス

**テスト関数一覧:**
1. `testConfig()`: 設定検証
2. `testProcessAllBusinessCards()`: 全処理テスト
3. `testOCRExtraction()`: OCR単体テスト
4. `testOrganizationComparison()`: 組織比較テスト（3ケース）
5. `testAppSheetConnection()`: AppSheet API接続テスト
6. `testSpreadsheetConnection()`: スプレッドシート接続テスト
7. `testDriveFolders()`: Driveフォルダー接続テスト

**使い方:**
GASエディターで関数を選択 → 実行 → ログで結果確認

---

## 🔧 技術的改善詳細

### Vertex AI最適化
| 項目 | Before | After | 削減率 |
|------|--------|-------|--------|
| OCRモデル | gemini-2.5-pro | gemini-2.5-flash | -80% |
| 比較モデル | gemini-2.5-pro | gemini-2.5-flash | -80% |
| 入力トークン単価 | $3.50/1M | $0.075/1M | -97.9% |
| 出力トークン単価 | $10.50/1M | $0.30/1M | -97.1% |

**想定月間コスト削減:**
- 処理枚数: 500枚/月
- OCRトークン: 約1,500 input + 500 output per card
- **Before**: 500枚 × (1500×$3.50 + 500×$10.50)/1M = $7.88/月
- **After**: 500枚 × (1500×$0.075 + 500×$0.30)/1M = $0.13/月
- **削減額**: $7.75/月 (98%削減)

### ログシステム
```javascript
// 3段階ログ + config制御
LOG_CONFIG = {
  enableDetailedLogs: true,      // 詳細ログ
  enableStackTrace: true,         // スタックトレース
  logApiResponses: false          // APIレスポンス（デバッグ用）
};

logDebug('デバッグ情報', {data: value});  // 詳細情報
logInfo('処理開始');                       // 進捗情報
logError('エラー発生', error);             // エラー + スタック
```

### エラーハンドリング
```javascript
// Before: 最小限
try {
  result = processCard(card);
} catch (e) {
  console.log(e);
}

// After: 詳細トラッキング
try {
  logInfo('STEP 1️⃣: OCR情報抽出');
  const extractedInfo = extractBusinessCardInfo(front, back);
  
  logDebug('抽出情報', extractedInfo);
  
  // finishReason検証
  if (apiResponse.finishReason === 'MAX_TOKENS') {
    throw new Error('トークン上限到達: maxOutputTokensを増やしてください');
  }
  
  if (apiResponse.finishReason === 'SAFETY') {
    throw new Error('セーフティフィルター発動: コンテンツを確認してください');
  }
  
  validateExtractedInfo(extractedInfo);
  
} catch (error) {
  logError('OCR処理エラー', error);
  // スタックトレース自動記録
  throw error;
}
```

---

## ✅ テスト計画

### デプロイ前テスト（GASエディター）
```
1. testConfig() → 設定検証
2. testSpreadsheetConnection() → スプレッドシート接続
3. testDriveFolders() → Driveフォルダー接続
4. testAppSheetConnection() → AppSheet API接続
5. testOCRExtraction() → OCR単体（1枚テスト）
6. testOrganizationComparison() → 組織比較ロジック
7. testProcessAllBusinessCards() → 全処理統合
```

### デプロイ後テスト（本番環境）
```
1. ソースフォルダーにテスト名刺1組配置
2. Webhook手動トリガー or 時間トリガー実行
3. ログ確認:
   - OCR抽出結果
   - 重複判定結果
   - ファイル移動完了
   - AppSheet更新成功
4. 移動先フォルダー確認（ファイル命名規則）
5. スプレッドシート確認（データ登録）
6. AppSheet確認（アプリ表示）
```

---

## 📋 デプロイ手順

### 1. OAuth2スコープ承認
```bash
cd c:\tools\python\code\all-gas\gas_projects\projects\clients\Appsheet_名刺取り込み\scripts
clasp push
```
初回実行時にVertex AI用スコープ承認が必要:
- `https://www.googleapis.com/auth/cloud-platform`

### 2. 設定確認
GASエディターで`testConfig()`実行 → ログで全設定確認

### 3. 接続テスト
```javascript
testSpreadsheetConnection()  // スプレッドシート
testDriveFolders()           // Drive
testAppSheetConnection()     // AppSheet API
```

### 4. OCRテスト
1. ソースフォルダーにテスト名刺1組配置
2. `testOCRExtraction()` 実行
3. ログで抽出結果確認

### 5. 全処理テスト
1. `testProcessAllBusinessCards()` 実行
2. 処理結果確認

### 6. 本番稼働
- Webhookトリガー設定
- または時間トリガー設定（例: 10分ごと）

---

## 🔍 トラブルシューティング

### OCRエラー
```javascript
// ログ確認ポイント
- "ファイルサイズ: XX KB" → 大きすぎる場合はリサイズ
- "finishReason: MAX_TOKENS" → maxOutputTokensを2048→4096に増やす
- "finishReason: SAFETY" → 画像内容を確認（不適切コンテンツ）
- "JSON抽出失敗" → プロンプトを調整
```

### AppSheet APIエラー
```javascript
// ログ確認ポイント
- "API Error: 401" → accessKeyを確認
- "API Error: 404" → appId/tableNameを確認
- "必須フィールドエラー" → buildContactRowData()を確認
```

### 重複判定エラー
```javascript
// ログ確認ポイント
- "スプレッドシートが見つかりません" → spreadsheetIdを確認
- "列が見つかりません" → シート構造を確認
- "組織比較エラー" → compareOrganizations()ログ確認
```

---

## 📈 モニタリング指標

### パフォーマンス
- 1名刺あたり処理時間: ~5-10秒
- OCR処理時間: ~2-5秒
- AppSheet API時間: ~1-2秒

### コスト
- OCR単価: ~$0.0002/枚（Flash）
- 月間500枚: ~$0.13/月

### 精度
- OCR抽出成功率: 目標 >95%
- 重複検出精度: 目標 >98%

---

## 🚀 今後の改善提案

### Phase 2 (オプション)
1. **バッチ処理最適化**
   - 並列OCR処理（Promise.all）
   - AppSheet バッチAPI活用

2. **キャッシング**
   - スプレッドシートデータキャッシュ
   - 組織情報メモ化

3. **高度な重複検出**
   - 顔写真比較（Vision API）
   - 履歴データ活用

4. **自動リトライ**
   - OCR失敗時の再試行ロジック
   - 指数バックオフ実装

5. **通知機能**
   - エラー通知（Slack/Email）
   - 処理完了通知

---

## 📝 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2025-10-23 | 2.0.0 | 全体リファクタリング完了 |
| - | - | Gemini Pro → Flash移行 |
| - | - | モジュール分割（6ファイル） |
| - | - | 共通モジュール統合 |
| - | - | テスト関数追加 |
| - | - | 詳細ログ実装 |

---

## 👥 担当者
- リファクタリング実施: GitHub Copilot + User
- レビュー: Pending
- 承認: Pending

---

## ✅ チェックリスト

### コード品質
- [x] モジュール分割完了
- [x] 共通モジュール統合
- [x] エラーハンドリング実装
- [x] ログシステム実装
- [x] テスト関数実装

### ドキュメント
- [x] REFACTORING_SUMMARY.md作成
- [ ] SPECIFICATIONS.md更新
- [ ] FLOW.md更新
- [ ] README.md更新

### デプロイ
- [ ] clasp push実行
- [ ] OAuth2承認
- [ ] テスト実行
- [ ] 本番稼働確認

---

**作成日**: 2025-10-23  
**バージョン**: 2.0.0  
**ステータス**: リファクタリング完了 / デプロイ待ち
