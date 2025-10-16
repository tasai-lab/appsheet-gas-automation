
# Gemini API → Vertex AI 移行レポート

## サマリー

- **総プロジェクト数**: 19
  - Gemini API のみ: 17
  - Vertex AI のみ: 1
  - 両方使用: 1

## 移行優先度別

### 🔴 高優先度（医療・個人情報）: 12プロジェクト

これらのプロジェクトは個人情報・医療データを扱うため、**即座に移行を推奨**します。

#### Appsheet_利用者_フェースシート
- 現在のAPI: gemini
- Gemini呼び出し数: 1
- Vertex呼び出し数: 0
- 影響ファイル数: 1
- **アクション**: Vertex AIへの移行が必要

#### Appsheet_利用者_反映
- 現在のAPI: gemini
- Gemini呼び出し数: 1
- Vertex呼び出し数: 0
- 影響ファイル数: 1
- **アクション**: Vertex AIへの移行が必要

#### Appsheet_利用者_基本情報上書き
- 現在のAPI: gemini
- Gemini呼び出し数: 1
- Vertex呼び出し数: 0
- 影響ファイル数: 1
- **アクション**: Vertex AIへの移行が必要

#### Appsheet_利用者_家族情報作成
- 現在のAPI: gemini
- Gemini呼び出し数: 1
- Vertex呼び出し数: 0
- 影響ファイル数: 1
- **アクション**: Vertex AIへの移行が必要

#### Appsheet_利用者_質疑応答
- 現在のAPI: gemini
- Gemini呼び出し数: 1
- Vertex呼び出し数: 0
- 影響ファイル数: 1
- **アクション**: Vertex AIへの移行が必要

#### Appsheet_訪問看護_報告書
- 現在のAPI: gemini
- Gemini呼び出し数: 1
- Vertex呼び出し数: 0
- 影響ファイル数: 1
- **アクション**: Vertex AIへの移行が必要

#### Appsheet_訪問看護_書類OCR
- 現在のAPI: gemini
- Gemini呼び出し数: 1
- Vertex呼び出し数: 0
- 影響ファイル数: 1
- **アクション**: Vertex AIへの移行が必要

#### Appsheet_訪問看護_書類仕分け
- 現在のAPI: gemini
- Gemini呼び出し数: 1
- Vertex呼び出し数: 0
- 影響ファイル数: 1
- **アクション**: Vertex AIへの移行が必要

#### Appsheet_訪問看護_精神科記録
- 現在のAPI: gemini
- Gemini呼び出し数: 1
- Vertex呼び出し数: 0
- 影響ファイル数: 1
- **アクション**: Vertex AIへの移行が必要

#### Appsheet_訪問看護_計画書問題点
- 現在のAPI: gemini
- Gemini呼び出し数: 1
- Vertex呼び出し数: 0
- 影響ファイル数: 1
- **アクション**: Vertex AIへの移行が必要

#### Appsheet_訪問看護_計画書問題点_評価
- 現在のAPI: gemini
- Gemini呼び出し数: 1
- Vertex呼び出し数: 0
- 影響ファイル数: 1
- **アクション**: Vertex AIへの移行が必要

#### Appsheet_訪問看護_通常記録
- 現在のAPI: both
- Gemini呼び出し数: 1
- Vertex呼び出し数: 19
- 影響ファイル数: 4
- **アクション**: Gemini API呼び出しをVertex AIに統一


### 🟡 中優先度（業務クリティカル）: 5プロジェクト

- **Appsheet_営業_音声記録** (gemini): Gemini 1回, Vertex 0回
- **Appsheet_営業レポート** (gemini): Gemini 1回, Vertex 0回
- **Appsheet_通話_クエリ** (gemini): Gemini 1回, Vertex 0回
- **Appsheet_通話_新規依頼作成** (gemini): Gemini 1回, Vertex 0回
- **Appsheet_通話_要約生成** (vertex): Gemini 0回, Vertex 19回

### 🟢 低優先度（内部ツール）: 2プロジェクト

- **Appsheet_ALL_スレッド更新** (gemini): Gemini 1回, Vertex 0回
- **Appsheet_名刺取り込み** (gemini): Gemini 2回, Vertex 0回

## 推奨移行スケジュール

### フェーズ1（Week 1-2）: 高優先度プロジェクト

1. Appsheet_利用者_フェースシート
2. Appsheet_利用者_反映
3. Appsheet_利用者_基本情報上書き
4. Appsheet_利用者_家族情報作成
5. Appsheet_利用者_質疑応答

### フェーズ2（Week 3-4）: 高優先度残り + 中優先度

1. Appsheet_訪問看護_報告書
2. Appsheet_訪問看護_書類OCR
3. Appsheet_訪問看護_書類仕分け
4. Appsheet_訪問看護_精神科記録
5. Appsheet_訪問看護_計画書問題点
6. Appsheet_訪問看護_計画書問題点_評価
7. Appsheet_訪問看護_通常記録
8. Appsheet_営業_音声記録
9. Appsheet_営業レポート
10. Appsheet_通話_クエリ

### フェーズ3（Week 5-6）: その他全プロジェクト

残りのプロジェクトを順次移行

## 移行ファイル詳細


### Appsheet_利用者_フェースシート

修正が必要なファイル:
- `コード.gs`

### Appsheet_利用者_反映

修正が必要なファイル:
- `コード.gs`

### Appsheet_利用者_基本情報上書き

修正が必要なファイル:
- `コード.gs`

### Appsheet_利用者_家族情報作成

修正が必要なファイル:
- `コード.gs`

### Appsheet_利用者_質疑応答

修正が必要なファイル:
- `コード.gs`

### Appsheet_訪問看護_報告書

修正が必要なファイル:
- `コード.gs`

### Appsheet_訪問看護_書類OCR

修正が必要なファイル:
- `コード.gs`

### Appsheet_訪問看護_書類仕分け

修正が必要なファイル:
- `main.gs`

### Appsheet_訪問看護_精神科記録

修正が必要なファイル:
- `コード.gs`

### Appsheet_訪問看護_計画書問題点

修正が必要なファイル:
- `コード.gs`

### Appsheet_訪問看護_計画書問題点_評価

修正が必要なファイル:
- `コード.gs`

### Appsheet_訪問看護_通常記録

修正が必要なファイル:
- `config_settings.gs`
- `main.gs`
- `modules_aiProcessor.gs`
- `utils_debugTests.gs`

### Appsheet_営業_音声記録

修正が必要なファイル:
- `コード.gs`

### Appsheet_営業レポート

修正が必要なファイル:
- `コード.gs`

### Appsheet_通話_クエリ

修正が必要なファイル:
- `コード.gs`

### Appsheet_通話_新規依頼作成

修正が必要なファイル:
- `コード.gs`

### Appsheet_ALL_スレッド更新

修正が必要なファイル:
- `コード.gs`

### Appsheet_名刺取り込み

修正が必要なファイル:
- `コード.gs`


## 次のアクション

1. **appsscript.json更新**: 全プロジェクトで以下を追加
   ```json
   {
     "oauthScopes": [
       "https://www.googleapis.com/auth/cloud-platform"
     ]
   }
   ```

2. **共通ライブラリ作成**: `vertex_ai_helper.gs`を作成して全プロジェクトで使用

3. **段階的移行**: 優先度順に移行・テスト

4. **監視設定**: Cloud Monitoringでアラート設定

---

**生成日時**: 自動生成
