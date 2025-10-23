# 共通モジュール - コスト管理・実行ログ

gas_projects/shared/modules/common に保存された共通モジュール群です。
全プロジェクトで使用可能なコスト計算機能と実行ログ記録機能を提供します。

## モジュール一覧

### 1. CostManager.gs
Vertex AIのトークン使用量から日本円でのコストを計算するモジュール。

#### 主要機能
- **extractVertexAIUsageMetadata**: APIレスポンスからusageMetadataを抽出してコスト計算
- **getVertexAIPricing**: モデル名と入力タイプに応じた価格情報を取得
- **normalizeModelName**: モデル名の正規化（バージョン番号削除）
- **calculateCostFromTokens**: トークン数から直接コスト計算

#### 対応モデル
- Gemini 2.5 Flash (text/audio)
- Gemini 2.5 Pro (text/audio)
- Gemini 1.5 Flash (text/audio)
- Gemini 1.5 Pro (text/audio)

#### 使用例
```javascript
// APIレスポンスからコスト情報を抽出
const jsonResponse = JSON.parse(responseText);
const usageMetadata = extractVertexAIUsageMetadata(
  jsonResponse,
  'gemini-2.5-flash',
  'audio'
);

Logger.log(`Input: ${usageMetadata.inputTokens} tokens`);
Logger.log(`Output: ${usageMetadata.outputTokens} tokens`);
Logger.log(`合計コスト: ¥${usageMetadata.totalCostJPY.toFixed(2)}`);

// トークン数から直接計算
const cost = calculateCostFromTokens(1000, 500, 'gemini-2.5-flash', 'text');
Logger.log(`合計コスト: ¥${cost.totalCostJPY.toFixed(2)}`);
```

### 2. ExecutionLogger.gs
統合実行ログスプレッドシートに実行履歴を記録するモジュール。
コスト情報を含む詳細なログを記録します。

#### 主要機能
- **ExecutionLoggerクラス**: プロジェクトごとのログ記録インスタンス
- **log**: 基本的なログ記録
- **logStart/logSuccess/logFailure/logSkip**: ステータス別ログ記録
- **logWithCost**: Vertex AIのコスト情報付きログ記録
- **ExecutionTimerクラス**: 実行時間計測

#### ログフォーマット（37列）
1. タイムスタンプ
2. スクリプト名
3. ステータス (成功/失敗/スキップ/処理中)
4. レコードID
5. リクエストID
6. 処理時間(秒)
7. モデル名
8-12. トークン数とコスト情報
13-37. プロジェクト固有の詳細情報

#### 使用例
```javascript
// ロガーインスタンスを作成
const logger = createLogger('Appsheet_通話_要約生成');

try {
  // 処理開始ログ
  logger.logStart(callId, { fileId: audioFileId });

  // Vertex AI API呼び出し
  const result = analyzeAudioWithVertexAI(...);

  // 成功ログ（コスト情報付き）
  logger.logWithCost('成功', callId, result.usageMetadata, {
    fileSize: result.fileSize,
    actionsCount: result.actions.length,
    summary: result.summary.substring(0, 100)
  });

} catch (error) {
  // 失敗ログ
  logger.logFailure(callId, error, { fileId: audioFileId });
}
```

## 統合先について

### 統合実行ログスプレッドシート
- **ID**: `16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA`
- **シート名**: `コスト管理`
- **用途**: 全プロジェクトの実行履歴とコスト情報を一元管理

## 為替レート

現在のUSD→JPYレート: **150円**
（2025年1月時点の想定レート）

価格改定時は `CostManager.gs` の `EXCHANGE_RATE_USD_TO_JPY_VERTEX` を更新してください。

## 価格テーブル（2025年1月時点）

| モデル | 入力タイプ | Input価格（$/100万トークン） | Output価格（$/100万トークン） |
|--------|-----------|-------------------------|--------------------------|
| Gemini 2.5 Flash | text | 0.075 | 0.30 |
| Gemini 2.5 Flash | audio | 1.00 | 2.50 |
| Gemini 2.5 Pro | text | 1.25 | 10.00 |
| Gemini 2.5 Pro | audio | 1.25 | 10.00 |

※ 最新の価格は [GCP公式ドキュメント](https://cloud.google.com/vertex-ai/generative-ai/pricing) を参照してください。

## 元のプロジェクト

これらのモジュールは以下のプロジェクトから抽出されました:

- **通話_要約生成**: [gas_projects/projects/calls/Appsheet_通話_要約生成](../../projects/calls/Appsheet_通話_要約生成/)
  - `vertex_ai_service.gs`: コスト計算関数
  - `execution_logger.gs`: 実行ログ記録機能

## プロジェクトへの統合方法

1. **コスト計算機能のみ必要な場合**:
   - `CostManager.gs` をプロジェクトの `scripts/` フォルダーにコピー
   - Vertex AI APIレスポンスから `extractVertexAIUsageMetadata()` を呼び出し

2. **実行ログ記録機能のみ必要な場合**:
   - `ExecutionLogger.gs` をプロジェクトの `scripts/` フォルダーにコピー
   - `createLogger(スクリプト名)` でインスタンス作成

3. **両方必要な場合（推奨）**:
   - 両ファイルをコピー
   - `logWithCost()` メソッドでコスト情報付きログを記録

## メンテナンス

### 価格改定時
1. `CostManager.gs` の `getVertexAIPricing()` 内の価格テーブルを更新
2. 必要に応じて `EXCHANGE_RATE_USD_TO_JPY_VERTEX` を更新
3. このREADMEの価格テーブルも更新

### 新モデル追加時
1. `CostManager.gs` の価格テーブルに新モデルを追加
2. `normalizeModelName()` で正規化パターンを確認・更新

### ログフォーマット変更時
1. `ExecutionLogger.gs` のヘッダー配列を更新
2. `log()` メソッドの行配列を更新
3. 列数を調整（現在37列）

## バージョン履歴

- **v2.0.0** (2025-10-23): 共通モジュールとして抽出・統合
- **v1.0.0** (2025-10-17): 通話_要約生成プロジェクトで初期実装

## 関連ドキュメント

- [CLAUDE.md](../../../.claude/CLAUDE.md): プロジェクト全体のガイド
- [Vertex AI価格情報（GCP公式）](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- [通話_要約生成プロジェクト](../../projects/calls/Appsheet_通話_要約生成/README.md)
