# API呼び出し監査レポート

**作成日**: 2025-10-18
**監査対象**: すべてのGASプロジェクト
**監査目的**: Gemini/Vertex AI APIの過度な呼び出しを防止し、コスト削減とクォータ管理を実現

---

## 📋 エグゼクティブサマリー

### 監査結果
- **総プロジェクト数**: 34プロジェクト
- **AI API使用プロジェクト**: 13プロジェクト
- **API呼び出し制限実装済み**: 2プロジェクト（書類OCR、通常記録） ✅ **更新**
- **優先対応が必要**: 11プロジェクト

### 主な発見事項
1. **ほとんどのプロジェクトにAPI呼び出し制限が未実装**
   - 1回の処理で無制限にAPI呼び出しが可能な状態
   - エラーリトライやループ処理により、数十回の呼び出しが発生するリスク

2. **優れた最適化事例を発見**
   - `Appsheet_通話_要約生成`: 複数のAPI呼び出しを1回に統合（コスト28%削減）
   - 他のプロジェクトでも同様の最適化が可能

3. **共通モジュール化の必要性**
   - 各プロジェクトで個別に実装するのは非効率
   - 共通モジュール `ApiCallLimiter.gs` を作成済み

---

## 🔍 詳細監査結果

### ✅ API呼び出し制限実装済み

#### 1. **Appsheet_訪問看護_書類OCR**
- **ステータス**: ✅ 実装完了
- **API呼び出し数**: 最大2回/実行
  1. Vertex AI（メイン書類OCR）
  2. Google AI（提供票データ抽出、または上記のフォールバック）
- **制限設定**: `maxApiCallsPerExecution: 2`
- **実装場所**:
  - `config_settings.gs`: カウンター管理関数
  - `modules_geminiClient.gs`: Vertex AI/Google AI呼び出し時
  - `modules_documentProcessor.gs`: 提供票処理時
- **推奨アクション**: なし（完了）

---

### ⚠️ API呼び出し制限未実装（優先対応）

#### 2. **Appsheet_通話_要約生成**（Call Summary Generation）
- **ステータス**: ⚠️ 未実装（優先度: 高）
- **API呼び出し数**: 1回/実行（最適化済み）
  - Vertex AI: 要約+全文+アクション+依頼情報を1回で取得
- **最適化レベル**: ★★★★★（優れた設計）
  - コメント: "コスト削減: 約28%（API呼び出し2回→1回）"
- **API呼び出し箇所**:
  - `vertex_ai_service.gs:333` - `callVertexAIAPIWithInlineData()`
  - `call_summary_processor.gs:123` - `analyzeAudioWithVertexAI()` 呼び出し
- **リスク**: 低（現状1回のみだが、将来の変更で増加する可能性）
- **推奨アクション**:
  ```javascript
  // call_summary_processor.gs の processCallSummary() 関数の先頭に追加
  resetApiCallCounter();
  setApiCallLimit(2);  // 将来の拡張を考慮して2回に設定

  // vertex_ai_service.gs の callVertexAIAPIWithInlineData() 内、API呼び出し前に追加
  incrementApiCallCounter('Vertex_AI', '音声解析統合処理');
  ```

#### 3. **Appsheet_営業_音声記録**（Sales Audio Recording）
- **ステータス**: ⚠️ 未実装（優先度: 高）
- **API呼び出し数**: 推定1-2回/実行
  - Vertex AI: 音声解析
- **API呼び出し箇所**:
  - `vertex_ai_service.gs` - Vertex AI呼び出し
  - `appsheet_api.gs` - AppSheet API（カウント対象外）
- **リスク**: 中
- **推奨アクション**:
  ```javascript
  // メイン処理の開始時
  resetApiCallCounter();
  setApiCallLimit(2);

  // Vertex AI API呼び出し前
  incrementApiCallCounter('Vertex_AI', '営業音声解析');
  ```

#### 4. **Appsheet_訪問看護_通常記録**（Nursing Records）
- **ステータス**: ✅ **実装完了（2025-10-18）**
- **API呼び出し数**: 最大2回/実行（初回 + 1回リトライ）
  - Vertex AI: 看護記録生成（リトライあり）
- **API呼び出し箇所**:
  - `modules_aiProcessor.gs:35` - Vertex AI呼び出し前（リトライループ内）
  - `main.gs:47-48` - カウンター初期化
  - `main.gs:109, 114` - 統計出力
- **制限設定**: `maxApiCallsPerExecution: 3`（予備含む）
- **実装内容**:
  - ✅ `modules_apiCallLimiter.gs` を追加（共通モジュールからコピー）
  - ✅ `callVertexAIWithPrompt()` にカウンター追加
  - ✅ `processRequest()` に初期化コード追加
  - ✅ リトライ回数を3→2に削減
- **詳細**: `/API_CALL_SECURITY_AUDIT.md` 参照

#### 5. **Appsheet_訪問看護_報告書**（Reports）
- **ステータス**: ⚠️ 未実装（優先度: 中）
- **API呼び出し数**: 推定1-2回/実行
- **API呼び出し箇所**:
  - `modules_geminiClient.gs` - Gemini API呼び出し
- **リスク**: 中
- **推奨アクション**: 同上

#### 6. **Appsheet_通話_質疑応答**（Q&A System）
- **ステータス**: ⚠️ 未実装（優先度: 中）
- **API呼び出し数**: 推定1-3回/実行
  - 質問解析、回答生成で複数回の可能性
- **API呼び出し箇所**:
  - `gemini_client.gs` - Gemini API呼び出し
  - `utils_vertex_ai.gs` - Vertex AI呼び出し
- **リスク**: 高（複数のAPI呼び出しの可能性）
- **推奨アクション**:
  ```javascript
  resetApiCallCounter();
  setApiCallLimit(3);
  incrementApiCallCounter('Gemini', 'Q&A処理');
  ```

#### 7. **Appsheet_訪問看護_計画書問題点**（Care Plan Analysis）
- **ステータス**: ⚠️ 未実装（優先度: 低）
- **API呼び出し数**: 要調査
- **推奨アクション**: ソースコード確認後に対応

#### 8. **Appsheet_訪問看護_計画書問題点_評価**（Care Plan Evaluation）
- **ステータス**: ⚠️ 未実装（優先度: 低）
- **API呼び出し数**: 要調査
- **推奨アクション**: ソースコード確認後に対応

#### 9-13. **その他のAI使用プロジェクト**
- Appsheet_利用者_質疑応答
- Appsheet_利用者_フェースシート
- Appsheet_利用者_家族情報作成
- Appsheet_営業レポート
- その他

**推奨アクション**: 各プロジェクトのAPI使用状況を個別に調査し、適切な制限を設定

---

## 📊 リスク分析

### 高リスク（即時対応推奨）
1. **Appsheet_通話_質疑応答**
   - Q&A処理で複数回のAPI呼び出しの可能性
   - ユーザー対話型のため、エラー時のリトライが発生しやすい

2. **Appsheet_営業_音声記録**
   - 音声ファイルサイズが大きい場合、処理失敗→リトライのリスク
   - 営業活動で頻繁に使用される可能性

### 中リスク（計画的対応）
1. **Appsheet_訪問看護_通常記録**
2. **Appsheet_訪問看護_報告書**
3. **Appsheet_通話_要約生成** （現状は最適化済みだが、将来の拡張に備える）

### 低リスク（監視継続）
1. 使用頻度が低いプロジェクト
2. API呼び出しが明確に1回のみのプロジェクト

---

## 🛠️ 実装ガイド

### Step 1: 共通モジュールの配置（完了）
✅ `/共通モジュール/ApiCallLimiter.gs` を作成済み

### Step 2: 各プロジェクトでの実装手順

#### 2.1. 共通モジュールをプロジェクトにコピー
```bash
# 各プロジェクトのscriptsフォルダーに配置
cp 共通モジュール/ApiCallLimiter.gs <プロジェクト名>/scripts/
```

#### 2.2. メイン処理の開始時に初期化
```javascript
/**
 * メインWebhook処理またはdoPost()の先頭に追加
 */
function doPost(e) {
  // API呼び出しカウンターをリセット
  resetApiCallCounter();

  // プロジェクトに応じた上限を設定（推奨: 2-3回）
  setApiCallLimit(2);

  // ... 既存の処理 ...
}
```

#### 2.3. すべてのAI API呼び出し箇所に追加
```javascript
/**
 * Vertex AI API呼び出し前
 */
function callVertexAI() {
  // ★ API呼び出し前に必ず追加
  incrementApiCallCounter('Vertex_AI', '処理の説明');

  const response = UrlFetchApp.fetch(endpoint, options);
  // ...
}

/**
 * Google AI API呼び出し前
 */
function callGoogleAI() {
  // ★ API呼び出し前に必ず追加
  incrementApiCallCounter('Google_AI', '処理の説明');

  const response = UrlFetchApp.fetch(url, options);
  // ...
}
```

#### 2.4. 処理完了時に統計を出力（オプション）
```javascript
/**
 * メイン処理の最後に追加（推奨）
 */
function processRequest() {
  try {
    resetApiCallCounter();
    setApiCallLimit(2);

    // ... 処理 ...

    // 正常終了時
    logApiCallSummary();  // 統計をログ出力

  } catch (error) {
    // エラー処理
    logApiCallSummary();  // エラー時も統計を出力
    throw error;
  }
}
```

---

## 📈 期待される効果

### コスト削減
- **予防**: 無制限のAPI呼び出しによるコスト爆発を防止
- **可視化**: API使用状況をログで追跡可能
- **推定削減額**: プロジェクトあたり月額数千円～数万円（エラー時のリトライ防止）

### クォータ管理
- **Gemini API無料枠**: 1日あたりの呼び出し制限に達するリスクを低減
- **Vertex AI API**: 予期しないコスト増加を防止

### 運用改善
- **エラー検知**: 異常な呼び出し回数を早期に検知
- **デバッグ効率化**: API呼び出しのトレースが容易に

---

## ⏰ 実装スケジュール（推奨）

### フェーズ1（即時対応）- 完了目標: 1週間以内
1. ✅ `Appsheet_訪問看護_書類OCR` - 完了
2. ✅ `Appsheet_訪問看護_通常記録` - ✅ **完了（2025-10-18）**
3. ⏳ `Appsheet_通話_要約生成` - 優先度: 最高
4. ⏳ `Appsheet_営業_音声記録` - 優先度: 最高
5. ⏳ `Appsheet_通話_質疑応答` - 優先度: 高

### フェーズ2（計画的対応）- 完了目標: 2週間以内
6. `Appsheet_訪問看護_報告書`
7. その他の中リスクプロジェクト

### フェーズ3（継続監視）- 完了目標: 1ヶ月以内
8. すべての低リスクプロジェクト
9. アーカイブされたプロジェクトの確認

---

## 📝 ベストプラクティス

### API呼び出し最適化の原則
1. **1回の呼び出しで複数の情報を取得**
   - 良い例: `Appsheet_通話_要約生成`（要約+全文+アクション+依頼情報を1回で取得）
   - 悪い例: 要約用に1回、アクション抽出用に1回、など分割して呼び出す

2. **プロンプトの最適化**
   - JSON形式での出力を指定して、パース処理を簡素化
   - 必要な情報のみを要求（過剰な情報は不要）

3. **エラーハンドリング**
   - リトライ処理は慎重に（無限ループを避ける）
   - フォールバック先もカウンターに含める

4. **制限値の設定基準**
   - 通常処理: 2回以内（メイン1回 + フォールバック1回）
   - 複雑な処理: 3回以内
   - 4回以上は設計の見直しを検討

---

## 🔗 関連リソース

- **共通モジュール**: `/共通モジュール/ApiCallLimiter.gs`
- **実装例**: `/Appsheet_訪問看護_書類OCR/scripts/`
  - `config_settings.gs` - 設定とカウンター管理
  - `modules_geminiClient.gs` - API呼び出し実装
  - `modules_documentProcessor.gs` - 提供票処理

---

## ✅ チェックリスト

各プロジェクトの実装完了時にチェック:

- [ ] `ApiCallLimiter.gs` をプロジェクトに配置
- [ ] メイン処理開始時に `resetApiCallCounter()` と `setApiCallLimit()` を呼び出し
- [ ] すべてのAI API呼び出し箇所に `incrementApiCallCounter()` を追加
- [ ] ローカルテスト実行でカウンターが正常に動作することを確認
- [ ] ログ出力で API呼び出し回数が記録されることを確認
- [ ] 制限超過時にエラーがスローされることを確認
- [ ] 本番環境にデプロイ
- [ ] 本監査レポートの該当プロジェクトを ✅ に更新

---

## 📞 問い合わせ

本監査レポートに関する質問や実装支援が必要な場合:
- **担当**: Fractal Group 開発チーム
- **Email**: t.asai@fractal-group.co.jp
