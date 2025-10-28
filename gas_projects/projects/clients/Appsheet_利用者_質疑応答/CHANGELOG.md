# 変更履歴

## v1.2.2 (2025-01-21)

### 🎨 API改善: 明示的なmode指定をサポート

#### API変更（webhook.gs）

##### `processClientQA()` 関数の改善

**新しいAPI（推奨）**:
```javascript
// モード1: 参照資料ベース
processClientQA(promptText, {
  mode: 'document',
  documentText: documentText
});

// モード2: 通常の質疑応答（2段階AI処理）
processClientQA(promptText, {
  mode: 'normal',
  userId: userId,
  userBasicInfo: userBasicInfo,
  referenceData: referenceData
});
```

**従来のAPI（下位互換）**:
```javascript
// 位置引数形式も引き続きサポート
processClientQA(promptText, documentText);
processClientQA(promptText, null, userId, userBasicInfo, referenceData);
```

**主な改善点**:
- モード指定が明示的になり、コードの可読性が向上
- オプションオブジェクト形式でパラメータの意味が明確に
- 下位互換性を維持したまま新APIを提供
- modeパラメータを省略した場合は自動判別

#### 新しいテスト関数（test_functions.gs）

##### `testNormalQAWithTwoStageNewFormat()`

新しいAPI形式で通常の質疑応答（2段階AI処理）をテスト:

```javascript
const result = processClientQA(promptText, {
  mode: 'normal',
  userId: 'USER001',
  userBasicInfo: userBasicInfo,
  referenceData: referenceData
});
```

##### `testDocumentQANewFormat()`

新しいAPI形式で参照資料ベースの質疑応答をテスト:

```javascript
const result = processClientQA(promptText, {
  mode: 'document',
  documentText: documentText
});
```

#### ドキュメント更新

- **README.md**: 新しいAPI形式の使用例を追加
- **SPECIFICATIONS.md**: API仕様セクションを更新

---

## v1.2.1 (2025-01-21)

### 🔧 重要な修正: 思考モデルの適切な実装

#### 設定の修正（config.gs）

公式ドキュメント（https://ai.google.dev/gemini-api/docs/thinking-mode）に基づき、思考モデルの設定を修正:

```javascript
THINKING_CONFIG: {
  temperature: 1.0,
  thinkingBudget: -1,  // 動的思考: モデルが思考のタイミングと量を決定
  includeThoughts: true  // 思考の要約を含める
}
```

**主な変更点**:
- `thinkingBudget: -1` を追加（動的思考モード）
- `includeThoughts: true` を追加（思考プロセスの要約を取得）

#### 新規関数

##### `_extractThoughtsSummary(jsonResponse)`

思考モデルのレスポンスから思考の要約を抽出:

- APIレスポンスのpartsから`thought: true`のパートを探す
- 思考プロセスの分析情報を提供
- デバッグとステアリングに有用

#### 機能改善

##### `_generateAnswerWithThinkingModel()`

- 思考の要約を抽出して結果に含める
- `thoughtsSummary`フィールドを返り値に追加
- モデルの推論プロセスを可視化

#### 参考資料

- [Gemini 思考モード公式ドキュメント](https://ai.google.dev/gemini-api/docs/thinking-mode)
- [思考予算の設定](https://ai.google.dev/gemini-api/docs/thinking?hl=ja#set-budget)
- [思考の要約](https://ai.google.dev/gemini-api/docs/thinking?hl=ja#summaries)

---

## v1.2.0 (2025-01-21)

### 🎉 メジャーアップデート: 2段階AI処理システムの実装

#### 新機能

##### モード2: 通常の質疑応答（2段階AI処理）

利用者ID、基本情報、参考資料を使った高度な質疑応答システムを実装:

- **第1段階（情報抽出）**: gemini-2.5-flashで質問に関連する情報を抽出
- **第2段階（回答生成）**: gemini-2.5-flash-thinking-exp-01-21で深い分析と回答を生成

##### 新しいモデル設定（config.gs）

```javascript
EXTRACTOR_MODEL_NAME: 'gemini-2.5-flash'  // 情報抽出用
THINKING_MODEL_NAME: 'gemini-2.5-flash-thinking-exp-01-21'  // 思考モデル
THINKING_CONFIG: {
  temperature: 1.0  // 思考モデル推奨設定
}
```

#### 新規関数（vertex_ai_client.gs）

##### `processNormalQAWithTwoStage(promptText, userId, userBasicInfo, referenceData)`

2段階AI処理のオーケストレーター関数:

- 引数:
  - `promptText`: 質問文
  - `userId`: 利用者ID
  - `userBasicInfo`: 利用者の基本情報
  - `referenceData`: 参考資料（訪問記録、既往歴など）
- 戻り値:
  ```javascript
  {
    answer: "詳細な回答",
    summary: "回答の要約",
    extractedInfo: "抽出された関連情報",
    usageMetadata: { ... }
  }
  ```

##### `extractRelevantInfo(promptText, userBasicInfo, referenceData)`

第1段階: 情報抽出関数:

- gemini-2.5-flashを使用
- 質問に関連する情報のみを基本情報と参考資料から抽出
- JSON形式で抽出結果を返す

##### `generateAnswerWithThinkingModel(promptText, userId, extractedInfo)`

第2段階: 回答生成関数:

- gemini-2.5-flash-thinking-exp-01-21を使用
- 抽出された情報を用いて深い分析と回答を生成
- 思考過程を含む詳細な回答を返す

#### 関数の改善

##### `processClientQA()`

**新しいシグネチャ**:

```javascript
processClientQA(
  promptText,
  documentText = null,
  userId = null,
  userBasicInfo = null,
  referenceData = null,
  analysisId = null,
  updateAppSheet = false
)
```

**処理モードの自動判定**:

- **モード1**: `documentText`が提供された場合 → 参照資料ベースの回答
- **モード2**: `userId`, `userBasicInfo`, `referenceData`が提供された場合 → 2段階AI処理

##### `validateParameters()`

両方の処理モードに対応したパラメータ検証:

- モード1: `promptText` + `documentText` の検証
- モード2: `promptText` + `userId` + `userBasicInfo` + `referenceData` の検証

##### `executeTask()` (task_worker.gs)

- 処理モードの自動検出とルーティング
- モード情報をログに記録
- 各モードに応じた適切な処理関数を呼び出し

#### 新規テスト関数

##### `testNormalQAWithTwoStage()`

サンプルデータを使った2段階AI処理のテスト:

```javascript
function testNormalQAWithTwoStage() {
  // 利用者ID: USER001
  // 質問: "今後必要な支援内容を具体的に提案してください。"
  // 基本情報と訪問記録を用いてテスト
}
```

##### `testNormalQAWithTwoStageCustom()`

カスタムデータでの2段階AI処理テスト:

```javascript
function testNormalQAWithTwoStageCustom(
  promptText,
  userId,
  userBasicInfo,
  referenceData
) {
  // 任意のデータで2段階AI処理をテスト
}
```

### ドキュメント更新

- `README.md` - モード2の説明を追加、使用モデルの詳細を記載
- `CHANGELOG.md` - v1.2.0の詳細な変更履歴を記載

### 技術仕様

#### モード2の処理フロー

```
1. promptText + userBasicInfo + referenceData
   ↓
2. extractRelevantInfo() [gemini-2.5-flash]
   ↓
3. extractedInfo（JSON形式）
   ↓
4. generateAnswerWithThinkingModel() [gemini-2.5-flash-thinking]
   ↓
5. 最終回答 + 要約
```

#### API使用量

- 第1段階と第2段階の両方のトークン使用量を記録
- 合計コスト（日本円）を自動計算

### 使用例

#### モード1: 参照資料ベースの回答

```javascript
const result = processClientQA(
  '転倒リスクを減らすための対策は?',
  '利用者情報: 田中花子、82歳、歩行不安定'
);
```

#### モード2: 2段階AI処理

```javascript
const result = processClientQA(
  '今後必要な支援内容を具体的に提案してください。',
  null,  // documentText
  'USER001',  // userId
  '利用者ID: USER001\n氏名: 山田花子\n年齢: 82歳...',  // userBasicInfo
  '2024年10月20日 訪問記録\n・歩行が不安定...'  // referenceData
);

// 戻り値
{
  answer: "...",
  summary: "...",
  extractedInfo: "..."  // モード2のみ
}
```

### 互換性

- v1.1.0からの引数順序は変更なし
- 既存のモード1の処理は完全に互換性を維持
- 新しいパラメータ（userId, userBasicInfo, referenceData）はオプション

---

## v1.1.0 (2025-10-28)

### 新機能

#### 通常の質疑応答モードの追加

- **参照資料なしの処理をサポート**: `documentText`パラメータをオプション化し、参照資料がない場合でも通常の質疑応答が可能に
- **2つの処理モード**:
  1. 参照資料ベースの回答（従来の使い方）
  2. 通常の質疑応答（新機能）

### 関数の改善

#### `processClientQA()`

**引数の順序変更**（破壊的変更）:

- **旧**: `processClientQA(documentText, promptText, analysisId, updateAppSheet)`
- **新**: `processClientQA(promptText, documentText, analysisId, updateAppSheet)`

**理由**: promptTextが必須でdocumentTextがオプションになったため、より自然な順序に変更

**変更点**:

- `documentText`がオプション（デフォルト: `null`）になりました
- `documentText`が`null`の場合、通常の質疑応答として動作します
- promptTextのみで実行できるようになりました

#### `generateAnswerAndSummaryWithGemini()`

**引数の順序変更**:

- **旧**: `generateAnswerAndSummaryWithGemini(documentText, promptText)`
- **新**: `generateAnswerAndSummaryWithGemini(promptText, documentText = null)`

#### `createGeminiPrompt()`

**引数の順序変更と条件分岐追加**:

- **旧**: `createGeminiPrompt(documentText, promptText)`
- **新**: `createGeminiPrompt(promptText, documentText = null)`
- `documentText`がある場合とない場合で異なるプロンプトを生成

#### `validateParameters()`

- `documentText`の必須チェックを削除
- `documentText`が空文字列の場合は`null`に置き換え
- `promptText`のみを必須パラメータとして検証

#### `executeTask()`

- 引数の順序を変更してVertex AI関数呼び出しに対応
- ログに`hasDocument`フラグを追加

### テスト関数の追加

#### 新規テスト関数

- `testNormalQA()` - 通常の質疑応答（参照資料なし）をテスト
- `testProcessClientQANormal()` - processClientQA()の通常モードをテスト
- `testVertexAIWithCustomData()` - 引数の順序を更新

#### 更新されたテスト関数

- `testVertexAIWithLog()` - 引数の順序を更新
- `testProcessClientQA()` - 引数の順序を更新
- `testProcessClientQAWithAppSheet()` - 引数の順序を更新
- `testSaveResultToAppSheet()` - 引数の順序を更新
- `testProcessClientQAAndSave()` - 引数の順序を更新
- `testProcessClientQAErrorHandling()` - documentTextなしのテストを追加

### ドキュメント更新

- `README.md` - 2つの処理モードについて説明を追加
- `SPECIFICATIONS.md` - 新しい使用例を追加
- `CHANGELOG.md` - この変更履歴ファイルを新規作成

### 使用例

#### 参照資料ベースの質疑応答（従来の使い方）

```javascript
const result = processClientQA(
  '転倒リスクを減らすための対策は？',
  '利用者情報: 田中花子、82歳、歩行不安定'
);
```

#### 通常の質疑応答（新機能）

```javascript
const result = processClientQA(
  'JavaScriptでデバウンス処理を実装する方法を教えてください',
  null  // documentTextをnullにする
);
```

### 互換性への影響

**破壊的変更**: `processClientQA()`および関連関数の引数順序が変更されました

**移行方法**:

```javascript
// 旧コード
processClientQA(documentText, promptText, analysisId, updateAppSheet)

// 新コード
processClientQA(promptText, documentText, analysisId, updateAppSheet)
```

**注意**: 既存のコードは引数の順序を変更する必要があります

---

## v1.0.0 (2025-10-20)

### 初回リリース

- Vertex AI Gemini 2.5 Proによる質疑応答機能
- 非同期タスクキュー方式の実装
- AppSheet連携
- 実行ログ記録機能
- 重複防止機能
