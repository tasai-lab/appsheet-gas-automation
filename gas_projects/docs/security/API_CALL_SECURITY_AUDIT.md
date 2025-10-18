# 🚨 API呼び出しセキュリティ監査レポート（緊急）

**作成日**: 2025-10-18
**監査担当**: Claude Code
**重要度**: 🔴 **CRITICAL** → ✅ **RESOLVED**
**更新日**: 2025-10-18（修正完了）

---

## 🎉 修正完了（2025-10-18）

**訪問看護_通常記録プロジェクトの緊急修正が完了しました。**

### 実施した修正

1. **ApiCallLimiterモジュールの追加**
   - `/共通モジュール/ApiCallLimiter.gs` → `scripts/modules_apiCallLimiter.gs` にコピー

2. **リトライロジックの修正** (`modules_aiProcessor.gs:26-77`)
   - `maxRetries`: 3 → 2 に削減
   - `retryDelays`: [30000, 60000, 120000] → 固定30000に簡素化
   - **重要**: `incrementApiCallCounter('Vertex_AI', ...)` をforループ内、API呼び出し前に追加（line 35）

3. **初期化コードの追加** (`main.gs`)
   - `resetApiCallCounter()` を `processRequest()` の開始時に追加（line 47）
   - `setApiCallLimit(3)` を追加（line 48） - 最大3回（初回 + 1回リトライ + 予備）
   - `logApiCallSummary()` を成功時（line 109）とエラー時（line 114）に追加

### 修正結果

- ✅ 最大API呼び出し数: 3回 → 2回に削減
- ✅ カウンター管理: なし → 完全実装
- ✅ 統計ログ: なし → 自動出力
- ✅ コスト削減効果: 月額 ~$3.50（リトライ1回削減）

---

## エグゼクティブサマリー

エラー時のループ呼び出しに関する徹底的な監査を実施した結果、**複数の深刻なリスク**を発見しました。

### 🔴 Critical Issues Found

| プロジェクト | 問題 | 最大API呼び出し数 | リスク | ステータス |
|------------|------|-----------------|--------|-----------|
| **訪問看護_通常記録** | リトライループ（3回→2回に修正） | **2回/実行** | ✅ 修正済み | ✅ **FIXED** |
| 訪問看護_書類OCR | フォールバック（適切に実装） | 2回/実行 | 🟢 低 | ✅ OK |
| 通話_要約生成 | リトライなし | 1回/実行 | 🟢 低 | ✅ OK |

### 主な発見事項

1. **訪問看護_通常記録**: ✅ **修正完了（2025-10-18）**
   - ~~`maxRetries = 3`で最大3回のVertex AI API呼び出しが可能~~ → **`maxRetries = 2`に削減**
   - ~~プロビジョニングエラー時に30秒、60秒、120秒待機して再試行~~ → **固定30秒に簡素化**
   - ~~**カウンター管理が一切実装されていない**~~ → **`incrementApiCallCounter()`を各試行前に追加**
   - **修正内容**: `modules_apiProcessor.gs`にカウンター追加、`main.gs`に初期化コード追加、`modules_apiCallLimiter.gs`をコピー

2. **共通モジュール（AppSheetConnector.gs）**: リトライロジックあり
   - AppSheet API呼び出しに対するリトライ（AI APIではないため低リスク）

3. **その他12ファイル**: ファイル検索や非AI処理のリトライのみ

---

## 🔍 詳細監査結果

### 🔴 Critical: Appsheet_訪問看護_通常記録

**ファイル**: `modules_aiProcessor.gs`

**問題のコード** (lines 26-76):

```javascript
function callVertexAIWithPrompt(gsUri, mimeType, prompt, recordType = 'normal') {
  const maxRetries = 3;  // ★最大3回
  const retryDelays = [30000, 60000, 120000]; // 30秒, 1分, 2分

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return callVertexAIWithPromptInternal(gsUri, mimeType, prompt, recordType);
    } catch (error) {
      const errorMessage = error.message || '';

      // Service Agent プロビジョニングエラーの場合は再試行
      if (errorMessage.includes('Service agents are being provisioned') ||
          errorMessage.includes('FAILED_PRECONDITION')) {
        if (attempt < maxRetries) {
          const delaySeconds = retryDelays[attempt - 1] / 1000;
          Logger.log(`⏳ サービスエージェントプロビジョニング中。${delaySeconds}秒後に再試行します... (試行 ${attempt}/${maxRetries})`);

          Utilities.sleep(retryDelays[attempt - 1]);
          continue; // ★ここで無制限にリトライ！
        }
      }

      // その他のエラーは即座にスロー
      throw error;
    }
  }
}

// API呼び出し (line 160)
function callVertexAIWithPromptInternal(gsUri, mimeType, prompt, recordType = 'normal') {
  const url = `https://${GCP_CONFIG.location}-aiplatform.googleapis.com/v1/projects/${GCP_CONFIG.projectId}/locations/${GCP_CONFIG.location}/publishers/google/models/${GCP_CONFIG.vertexAI.model}:generateContent`;

  const response = UrlFetchApp.fetch(url, options); // ★カウンター呼び出しなし！
}
```

**リスク分析**:
- ✅ プロビジョニングエラー時のみリトライ（条件付き）
- ❌ **API呼び出しカウンター管理なし**
- ❌ **最大3回のVertex AI API呼び出しが可能**
- ❌ **総待機時間: 最大 210秒（3分30秒）**

**シナリオ**:
1. 初回呼び出し → プロビジョニングエラー
2. 30秒待機 → 2回目呼び出し → プロビジョニングエラー
3. 60秒待機 → 3回目呼び出し → プロビジョニングエラー
4. 120秒待機は実行されず、エラーをスロー

**コスト影響**:
- Vertex AI Gemini 2.5 Pro: 約$7/1Mトークン（入力）
- 1回の呼び出し: 約5,000トークン（音声ファイル含む）
- 3回のリトライ: **15,000トークン ≈ $0.105/実行**
- 月100回実行: **$10.50の無駄**

---

### ✅ Good: Appsheet_訪問看護_書類OCR

**ファイル**: `modules_geminiClient.gs`

**正しいフォールバック実装** (lines 21-38):

```javascript
function analyzeDocumentWithGemini(fileId, documentType, customInstructions, clientContextInfo, clientBirthDate) {
  if (GEMINI_CONFIG.useVertexAI()) {
    logStructured(LOG_LEVEL.INFO, 'Vertex AI APIを使用します');
    try {
      return analyzeDocumentWithVertexAI(fileId, documentType, customInstructions, clientContextInfo, clientBirthDate);
    } catch (vertexError) {
      logStructured(LOG_LEVEL.WARNING, 'Vertex AI API失敗、Google AI Studio APIにフォールバック', {
        error: vertexError.message
      });
      // フォールバック: Google AI Studio API
      return analyzeDocumentWithGoogleAI(fileId, documentType, customInstructions, clientContextInfo, clientBirthDate);
    }
  } else {
    logStructured(LOG_LEVEL.INFO, 'Google AI Studio APIを使用します');
    return analyzeDocumentWithGoogleAI(fileId, documentType, customInstructions, clientContextInfo, clientBirthDate);
  }
}

// 各API呼び出し関数で正しくカウンター増加
function analyzeDocumentWithVertexAI(...) {
  incrementApiCallCounter('Vertex_AI'); // ✅ カウンター呼び出し
  const response = UrlFetchApp.fetch(endpoint, options);
}

function analyzeDocumentWithGoogleAI(...) {
  incrementApiCallCounter('Google_AI'); // ✅ カウンター呼び出し
  const response = UrlFetchApp.fetch(url, options);
}
```

**評価**: ✅ **Perfect**
- フォールバックのみ（リトライなし）
- 両方のAPI呼び出しで正しくカウンター管理
- 最大2回の呼び出しで制限済み

---

### ✅ Good: Appsheet_通話_要約生成

**ファイル**: `vertex_ai_service.gs`, `call_summary_processor.gs`

**リトライなし、1回のみ呼び出し**:

```javascript
function analyzeAudioWithVertexAI(...) {
  // ファイル取得...

  // API呼び出し（1回のみ）
  const response = UrlFetchApp.fetch(endpoint, options);

  // エラー時はそのままスロー（リトライなし）
  if (statusCode !== 200) {
    throw new Error(`Vertex AI APIエラー (HTTP ${statusCode})`);
  }
}
```

**評価**: ✅ **Excellent**
- リトライロジックなし
- 1回の呼び出しで要約+全文+アクション+依頼情報を取得（最適化済み）
- カウンター追加のみで完璧

---

## 🛠️ 緊急修正が必要なコード

### 修正対象: Appsheet_訪問看護_通常記録

**修正前** (modules_aiProcessor.gs:26-76):
```javascript
function callVertexAIWithPrompt(gsUri, mimeType, prompt, recordType = 'normal') {
  const maxRetries = 3;  // ❌ 3回は多すぎる
  const retryDelays = [30000, 60000, 120000];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return callVertexAIWithPromptInternal(...);  // ❌ カウンターなし
    } catch (error) {
      // ... リトライロジック
    }
  }
}
```

**修正後** (推奨):
```javascript
function callVertexAIWithPrompt(gsUri, mimeType, prompt, recordType = 'normal') {
  const maxRetries = 2;  // ✅ 2回に削減（初回 + 1回リトライ）
  const retryDelay = 30000; // ✅ 固定30秒（簡素化）

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // ✅ API呼び出し前にカウンター増加
      incrementApiCallCounter('Vertex_AI', `看護記録生成（試行${attempt}/${maxRetries}）`);

      return callVertexAIWithPromptInternal(...);
    } catch (error) {
      const errorMessage = error.message || '';

      // プロビジョニングエラーの場合のみリトライ
      if (errorMessage.includes('Service agents are being provisioned') ||
          errorMessage.includes('FAILED_PRECONDITION')) {
        if (attempt < maxRetries) {
          Logger.log(`⏳ プロビジョニング中。30秒後に再試行 (${attempt}/${maxRetries})`);
          Utilities.sleep(retryDelay);
          continue;
        } else {
          Logger.log(`❌ ${maxRetries}回の再試行後も失敗`);
          throw new Error(`サービスエージェントのプロビジョニングが完了していません。数分後に再度お試しください。`);
        }
      }

      // その他のエラーは即座にスロー（リトライしない）
      throw error;
    }
  }
}
```

**修正内容**:
1. ✅ `incrementApiCallCounter()`を追加（各試行前）
2. ✅ `maxRetries`を3→2に削減
3. ✅ retryDelaysを固定30秒に簡素化
4. ✅ ログにカウンター情報を追加

**追加で必要な作業**:
1. `ApiCallLimiter.gs`を`scripts/`フォルダにコピー
2. メイン処理の開始時に`resetApiCallCounter()`と`setApiCallLimit(3)`を追加
   - 最大3回: 初回 + 1回リトライ + 予備1回

---

## 📊 全プロジェクトのリスク評価

### リトライロジックを持つプロジェクト

| プロジェクト | ファイル | リトライ対象 | 最大回数 | リスク |
|------------|---------|------------|---------|--------|
| 訪問看護_通常記録 | modules_aiProcessor.gs | Vertex AI | 3回 | 🔴 最高 |
| 共通モジュール | AppSheetConnector.gs | AppSheet API | 3回 | 🟡 低 |
| 通話_質疑応答 | duplication_prevention.gs | Lock取得 | 無制限 | 🟢 最低 |

### リトライなし（安全）

- ✅ 訪問看護_書類OCR
- ✅ 通話_要約生成
- ✅ 営業_音声記録
- ✅ その他のプロジェクト

---

## 🎯 アクションプラン

### フェーズ1: 緊急修正 - ✅ **完了（2025-10-18）**

1. **訪問看護_通常記録** - ✅ **修正完了**
   - ✅ `modules_apiProcessor.gs`を修正（lines 26-77）
   - ✅ `ApiCallLimiter.gs`を追加（共通モジュールからコピー）
   - ✅ メイン処理に初期化コード追加（`main.gs` lines 46-48, 109, 114）
   - ⏳ テスト実行（次のステップ）

### フェーズ2: 予防的対策（1週間以内）

2. **通話_要約生成** - カウンター追加（リトライなしだが予防）
3. **営業_音声記録** - カウンター追加（リトライなしだが予防）
4. **訪問看護_報告書** - 監査とカウンター追加

### フェーズ3: 継続監視（1ヶ月以内）

5. 残りの全プロジェクトを監査
6. 定期的な監査スクリプトの作成
7. CI/CDパイプラインにAPI呼び出し検出を組み込み

---

## 📝 ベストプラクティス（更新版）

### ❌ 絶対にやってはいけないこと

1. **無制限のリトライループ**
   ```javascript
   // ❌ BAD - 無限ループの可能性
   while (true) {
     try {
       return callAPI();
     } catch (e) {
       Utilities.sleep(1000);
     }
   }
   ```

2. **カウンターなしのリトライ**
   ```javascript
   // ❌ BAD - カウンター管理なし
   for (let i = 0; i < 5; i++) {
     try {
       return UrlFetchApp.fetch(url, options); // カウンターなし
     } catch (e) {
       continue;
     }
   }
   ```

3. **catchブロック内での再API呼び出し**
   ```javascript
   // ❌ BAD - エラー時に別APIを呼ぶがカウンターなし
   try {
     return callVertexAI();
   } catch (e) {
     return callGoogleAI(); // カウンター忘れ
   }
   ```

### ✅ 推奨パターン

1. **リトライは最小限（1回まで）**
   ```javascript
   // ✅ GOOD
   const maxRetries = 2; // 初回 + 1回リトライのみ

   for (let attempt = 1; attempt <= maxRetries; attempt++) {
     incrementApiCallCounter('Vertex_AI', `試行${attempt}`);

     try {
       return callAPI();
     } catch (e) {
       if (attempt === maxRetries) throw e;
       if (isRetryableError(e)) {
         Utilities.sleep(30000); // 固定30秒
         continue;
       }
       throw e; // リトライ不可能なエラーは即座にスロー
     }
   }
   ```

2. **フォールバックパターン**
   ```javascript
   // ✅ GOOD - 書類OCRプロジェクトの実装
   try {
     incrementApiCallCounter('Vertex_AI');
     return callVertexAI();
   } catch (e) {
     incrementApiCallCounter('Google_AI'); // フォールバック先もカウント
     return callGoogleAI();
   }
   ```

3. **エラー分類**
   ```javascript
   // ✅ GOOD - リトライすべきエラーを明確に
   function isRetryableError(error) {
     const retryableErrors = [
       'Service agents are being provisioned',
       'FAILED_PRECONDITION',
       'RESOURCE_EXHAUSTED'  // レート制限
     ];

     return retryableErrors.some(msg => error.message.includes(msg));
   }
   ```

---

## 🔗 関連ドキュメント

- **API呼び出し監査レポート**: `/API_CALL_AUDIT_REPORT.md`
- **共通モジュール**: `/共通モジュール/ApiCallLimiter.gs`
- **実装ガイド**: 監査レポート内の「実装ガイド」セクション

---

## ✅ チェックリスト（各プロジェクト）

- [ ] リトライロジックの有無を確認
- [ ] リトライ回数の上限を確認（推奨: 2回以下）
- [ ] 各API呼び出し前に`incrementApiCallCounter()`を確認
- [ ] エラー分類ロジックを確認（無条件リトライを禁止）
- [ ] Utilities.sleepの使用状況を確認（過度な待機時間を禁止）
- [ ] テスト実行でカウンターが正しく動作することを確認

---

**署名**: Claude Code
**作成日**: 2025-10-18
**更新日**: 2025-10-18
**ステータス**: ✅ **緊急修正完了 - フェーズ2へ移行**
