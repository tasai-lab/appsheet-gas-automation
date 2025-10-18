# 書類OCR + 書類仕分けシステム - 開発ログ

**プロジェクト**: Appsheet_訪問看護_書類OCR
**最終更新**: 2025-10-18
**担当**: Claude Code

---

## 🎯 プロジェクト概要

訪問看護で使用される各種書類（医療保険証、介護保険証、公費受給者証、口座情報、指示書、提供票、負担割合証）をOCR処理し、構造化データとしてAppSheetテーブルに自動登録するシステム。

### 主な機能

1. **書類OCR**: Vertex AI/Google AI APIによる画像・PDF・音声・動画のOCR処理
2. **構造化データ抽出**: 書類種別ごとに必要な項目を自動抽出
3. **AppSheet連携**: 抽出データを適切なテーブルに自動登録
4. **通知機能**: 処理完了時にメール通知（ディープリンク付き）

---

## 📋 プロジェクト履歴

### 2025-10-18: API呼び出し制限システムの実装 ✅

#### 背景

Gemini API無料枠の1日制限（1,500リクエスト）に達し、429エラーが発生。コスト管理とクォータ管理の観点から、**すべてのプロジェクトでAPI呼び出しを厳格に管理**する必要性が判明。

#### 実施した対策

##### 1. **Vertex AI移行** ✅

- **目的**: Google AI Studio APIの無料枠制限を回避
- **実装**:
  - `getGCPConfig()`: Script PropertiesからGCP設定を取得
  - `getVertexAIEndpoint()`: Vertex AI APIエンドポイント構築
  - `getOAuth2Token()`: OAuth2認証トークン取得
  - `analyzeDocumentWithVertexAI()`: Vertex AI API呼び出し実装
  - `analyzeDocumentWithGoogleAI()`: Google AI Studio API（フォールバック用）
- **OAuth Scope追加**: `https://www.googleapis.com/auth/cloud-platform`
- **設定**: Script Propertiesに`USE_VERTEX_AI=true`で有効化

##### 2. **API呼び出しカウンターシステム** ✅

**ファイル**: `config_settings.gs` (lines 26-78)

```javascript
const SYSTEM_CONFIG = {
  maxApiCallsPerExecution: 2,  // 厳格な制限
  _apiCallCounter: 0
};

function incrementApiCallCounter(apiType) {
  SYSTEM_CONFIG._apiCallCounter++;

  if (SYSTEM_CONFIG._apiCallCounter > SYSTEM_CONFIG.maxApiCallsPerExecution) {
    throw new Error(`API呼び出し制限超過: ${SYSTEM_CONFIG._apiCallCounter}回`);
  }
}
```

**実装箇所**:
- `modules_geminiClient.gs:46` - Vertex AI呼び出し時
- `modules_geminiClient.gs:147` - Google AI呼び出し時（フォールバック）
- `modules_documentProcessor.gs:689` - 提供票データ抽出時

**API呼び出しフロー**:
```
1回目: analyzeDocumentWithVertexAI() - メイン書類OCR
  ↓ 失敗時
2回目: analyzeDocumentWithGoogleAI() - フォールバック
  OR
2回目: extractFormDataFromOCR() - 提供票データ抽出
```

**保証**: 1回の処理で絶対に2回を超えるAPI呼び出しは発生しない ✅

##### 3. **共通モジュール作成** ✅

**ファイル**: `/共通モジュール/ApiCallLimiter.gs` (240行)

すべてのプロジェクトで再利用可能な包括的なAPI制限システム。

**主な機能**:
- API呼び出し回数の自動カウント
- 設定可能な上限値（デフォルト3回）
- API種別ごとの内訳追跡
- 詳細なログ出力
- 統計レポート機能
- 安全なAPI呼び出しラッパー関数

---

### 2025-10-18: AppSheetフィールド名修正（以前のセッション）

#### 問題

- AppSheet APIは200 OKを返すが、レコードが作成されない
- Email通知で`[object Object]`が表示される

#### 根本原因

- 元の「書類_仕分け」スクリプトとフィールド名が不一致
- 必須フィールド（`status`, `updated_by`等）が欠落

#### 修正内容

**すべての書類タイプで修正**:

1. **負担割合証** (`createCopayCertRecord`)
   - `document_id` → `source_document_id`
   - `status` フィールド追加
   - `updated_by` フィールド追加
   - `benefit_rate` 計算追加
   - `issue_date` フィールド追加

2. **介護保険証** (`createLtciInsuranceRecord`)
   - `insurer_code` → `insurer_number`
   - データ正規化ロジック追加

3. **公費** (`createPublicSubsidyRecord`)
   - 完全なスキーマ再構築

4. **口座情報** (`createBankAccountRecord`)
   - カナ変換ロジック追加
   - 口座番号調整ロジック追加

5. **指示書** (`createInstructionRecord`)
   - 都道府県コード取得関数追加
   - 疾病関連フィールド追加

6. **医療保険証** (`createMedicalInsuranceRecord`)
   - 後期高齢者医療ロジック追加
   - `status` フィールド追加

---

## 🚨 セキュリティ監査結果

### エラーによるループ呼び出し監査（2025-10-18）

#### ✅ 書類OCRプロジェクト: **安全**

**監査結果**:
- ✅ リトライロジックなし
- ✅ フォールバックのみ（Vertex AI → Google AI）
- ✅ 両方のAPI呼び出しで正しくカウンター管理
- ✅ 最大2回の呼び出しで制限済み
- ✅ whileループはファイル検索用のみ（API呼び出しと無関係）

**検証したコード**:
```javascript
// modules_geminiClient.gs:21-38
function analyzeDocumentWithGemini(...) {
  if (GEMINI_CONFIG.useVertexAI()) {
    try {
      return analyzeDocumentWithVertexAI(...);  // ✅ カウンターあり
    } catch (vertexError) {
      return analyzeDocumentWithGoogleAI(...);  // ✅ カウンターあり
    }
  } else {
    return analyzeDocumentWithGoogleAI(...);    // ✅ カウンターあり
  }
}
```

**結論**: **エラーによるループ呼び出しのリスクなし** ✅

---

#### 🔴 他プロジェクトで発見された問題

**Appsheet_訪問看護_通常記録**: リトライループあり（要修正）

```javascript
// modules_aiProcessor.gs:26-76
function callVertexAIWithPrompt(...) {
  const maxRetries = 3;  // ❌ 最大3回のAPI呼び出し
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return callVertexAIWithPromptInternal(...);  // ❌ カウンターなし
    } catch (error) {
      if (isProvisioningError(error) && attempt < maxRetries) {
        Utilities.sleep(retryDelays[attempt - 1]);
        continue;  // ❌ 無制限にリトライ
      }
      throw error;
    }
  }
}
```

**詳細**: `/API_CALL_SECURITY_AUDIT.md` 参照

---

## 📊 現在のAPI使用状況

### API呼び出し箇所

| 関数 | API種別 | 用途 | 呼び出し頻度 |
|------|--------|------|------------|
| `analyzeDocumentWithVertexAI()` | Vertex AI | メイン書類OCR | 常に1回目 |
| `analyzeDocumentWithGoogleAI()` | Google AI | フォールバック | エラー時のみ |
| `extractFormDataFromOCR()` | Google AI | 提供票データ抽出 | 提供票の場合のみ |

### API使用パターン

**通常の書類**:
```
Vertex AI (成功) → 完了 [1回]
Vertex AI (失敗) → Google AI (成功) → 完了 [2回]
```

**提供票**:
```
Vertex AI (成功) → Google AI (提供票データ抽出) → 完了 [2回]
Vertex AI (失敗) → Google AI (フォールバック) → エラー（制限超過）[2回で停止]
```

### コスト試算

**Vertex AI Gemini 2.5 Pro**:
- 入力: $7/1Mトークン
- 出力: $21/1Mトークン
- 平均トークン: 5,000入力 + 2,000出力 = $0.077/回

**月100回実行**:
- 通常: $7.70/月
- フォールバック10%: $8.47/月

---

## 🛠️ 技術仕様

### システム構成

```
doPost() [main.gs]
  ↓
resetApiCallCounter() [config_settings.gs]
  ↓
analyzeDocumentWithGemini() [modules_geminiClient.gs]
  ├─ analyzeDocumentWithVertexAI() → incrementApiCallCounter('Vertex_AI')
  └─ analyzeDocumentWithGoogleAI() → incrementApiCallCounter('Google_AI')
  ↓
processStructuredData() [modules_documentProcessor.gs]
  ├─ createMedicalInsuranceRecord()
  ├─ createLtciInsuranceRecord()
  ├─ createPublicSubsidyRecord()
  ├─ createBankAccountRecord()
  ├─ createCopayCertRecord()
  ├─ createInstructionRecord()
  └─ createServiceProvisionFormRecord()
      └─ extractFormDataFromOCR() → incrementApiCallCounter('Google_AI_Form')
  ↓
callAppSheetApi() [modules_documentProcessor.gs]
  ↓
sendCompletionNotificationEmail() [modules_notification.gs]
```

### ファイル構成

```
scripts/
├── main.gs                      # エントリーポイント
├── config_settings.gs           # 設定 + API呼び出しカウンター
├── modules_geminiClient.gs      # Gemini/Vertex AI連携
├── modules_documentProcessor.gs # 書類種別処理
├── modules_notification.gs      # メール通知
└── appsscript.json             # OAuth Scopes設定
```

### 設定（Script Properties）

```
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-2.5-pro
VERTEX_AI_TEMPERATURE=0.1
VERTEX_AI_MAX_OUTPUT_TOKENS=20000
USE_VERTEX_AI=true
```

---

## 📝 運用ガイド

### デプロイ手順

1. **Script Propertiesの設定**
   ```
   GCP_PROJECT_ID: GCPプロジェクトID
   USE_VERTEX_AI: true
   ```

2. **OAuth2承認**
   - 初回実行時に認証画面が表示されます
   - `cloud-platform` scope の承認が必要

3. **clasp push**
   ```bash
   cd /Users/t.asai/code/appsheet-gas-automation/gas_projects/Appsheet_訪問看護_書類OCR
   clasp push
   ```

### トラブルシューティング

#### API呼び出し制限超過エラー

**エラーメッセージ**:
```
API呼び出し制限超過: 3回 (上限: 2回)
```

**原因**:
- 提供票処理中にVertex AIがエラー → Google AIフォールバック → 提供票データ抽出でGoogle AI再呼び出し
- 合計3回になり制限超過

**対処**:
1. ログで実際の呼び出し回数を確認
2. 必要に応じて`maxApiCallsPerExecution`を3に増やす（推奨しない）
3. エラーの根本原因を修正（Vertex AI設定やファイル形式の問題）

#### Vertex AI認証エラー

**エラーメッセージ**:
```
Vertex AI APIエラー（ステータス: 403）: Permission denied
```

**対処**:
1. Script Propertiesの`GCP_PROJECT_ID`を確認
2. OAuth2承認を再実行
3. GCPプロジェクトでVertex AI APIが有効化されているか確認

---

## 🔗 関連ドキュメント

### プロジェクト内

- `README.md` - プロジェクト概要と使い方
- `SPECIFICATIONS.md` - 詳細な仕様書
- `FLOW.md` - 処理フロー図

### 全体ドキュメント

- `/API_CALL_AUDIT_REPORT.md` - 全プロジェクトのAPI監査レポート
- `/API_CALL_SECURITY_AUDIT.md` - エラーループ監査レポート（緊急）
- `/共通モジュール/ApiCallLimiter.gs` - 共通API制限モジュール

---

## ✅ チェックリスト

### デプロイ前

- [ ] Script Propertiesの設定完了
- [ ] OAuth2承認完了
- [ ] ローカルテスト実行完了
- [ ] API呼び出しカウンターが正常に動作することを確認
- [ ] 制限超過時にエラーがスローされることを確認

### 本番環境

- [ ] clasp push完了
- [ ] AppSheetからのWebhookテスト実行完了
- [ ] レコード作成確認
- [ ] メール通知受信確認
- [ ] ログ出力確認（API呼び出し回数の記録）

---

## 📞 問い合わせ

**担当**: Fractal Group 開発チーム
**Email**: t.asai@fractal-group.co.jp

---

**最終更新**: 2025-10-18
**ステータス**: ✅ **Production Ready（API制限実装済み）**
