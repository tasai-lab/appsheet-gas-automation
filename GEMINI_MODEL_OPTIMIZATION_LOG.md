# Gemini APIモデル最適化ログ

## 最新モデル情報（2025年10月時点）

### 利用可能なモデル

1. **gemini-2.5-pro**
   - 最も高度なモデル
   - 複雑な問題の推論、コード、数学、STEM分野に最適
   - 大規模データセットやドキュメント分析に対応
   - **用途**: 通話要約、看護記録作成、質疑応答など複雑な思考が必要なタスク

2. **gemini-2.5-flash**
   - 価格とパフォーマンスのバランスが優れている
   - 低レイテンシで大規模処理に適している
   - **用途**: ファイルID取得、データ抽出、シンプルな変換処理など

3. **gemini-2.5-flash-lite**
   - コスト効率と高スループットに最適化
   - Flashモデルの中で最も高速
   - **用途**: 軽量な処理、大量の単純タスク

### 旧バージョン
- gemini-2.0-flash
- gemini-2.0-flash-lite
- gemini-1.5-pro
- gemini-1.5-flash

## 最適化方針

### API キー統一
全てのスクリプトで以下のAPIキーを使用:
```
AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY
```

### モデル選択基準

#### gemini-2.5-pro を使用するスクリプト（複雑な思考が必要）
- Appsheet_通話_要約生成
- Appsheet_訪問看護_通常記録
- Appsheet_訪問看護_精神科記録
- Appsheet_訪問看護_計画書問題点
- Appsheet_訪問看護_計画書問題点_評価
- Appsheet_訪問看護_報告書
- Appsheet_利用者_質疑応答
- Appsheet_利用者_フェースシート
- Appsheet_営業レポート

#### gemini-2.5-flash を使用するスクリプト（標準処理）
- Appsheet_訪問看護_書類OCR
- Appsheet_訪問看護_書類仕分け
- Appsheet_通話_クエリ
- Appsheet_通話_新規依頼作成
- Appsheet_関係機関_作成
- Appsheet_利用者_家族情報作成
- Appsheet_利用者_基本情報上書き
- Appsheet_利用者_反映
- Appsheet_名刺取り込み

#### APIを使用しないスクリプト（データ処理のみ）
- Appsheet_ALL_Event
- Appsheet_ALL_スレッド更新
- Appsheet_ALL_スレッド投稿
- AppSheet_ALL_ファイルID
- Appsheet_All_ファイル検索＋ID挿入
- Appsheet_営業_ファイルID取得
- Appsheet_営業_音声記録
- Appsheet_通話_イベント作成
- Appsheet_通話_タスク作成
- Appsheet_通話_ファイルID取得
- Appsheet_訪問看護_定期スケジュール
- Appsheet_訪問看護_訪問者自動

## 実装予定

1. ✅ 最新モデル情報の調査完了
2. ⏳ 各スクリプトのGemini API使用状況確認
3. ⏳ APIキーとモデル名の統一
4. ⏳ 重複実行防止機能の追加
5. ⏳ エラーログのスプレッドシート記録への変更
6. ⏳ HTMLファイルの削除
7. ⏳ スクリプト名の最適化
8. ⏳ ドキュメント作成（README、仕様書、フロー図）
9. ⏳ GASへのデプロイ

## 実装状況

### ✅ 完了
1. 最新モデル情報調査（gemini-2.5-pro / gemini-2.5-flash）
2. 共通モジュール作成
   - logger.gs - 統合ロガー
   - duplication_prevention.gs - 重複実行防止
   - gemini_client.gs - Gemini APIクライアント
   - appsheet_client.gs - AppSheet APIクライアント
3. サンプルプロジェクト最適化（Appsheet_通話_クエリ）
   - 共通モジュール適用
   - スプレッドシートログ対応
   - メール通知廃止
   - 重複実行防止機能追加
   - gemini-2.5-flash使用
4. ドキュメント作成
   - README.md
   - SPECIFICATION.md
   - FLOW.md（Mermaid記法フロー図）

### ⏳ 進行中
5. 他のプロジェクトへの適用

### 📋 未実施
6. 全プロジェクトのGASデプロイ

## 次のステップ

1. 「Appsheet_通話_クエリ」をテンプレートとして他のプロジェクトを順次最適化
2. 各プロジェクトに適切なモデル（Pro/Flash）を割り当て
3. 全プロジェクトのデプロイとテスト

## 更新履歴
- 2025-10-16 09:30: サンプルプロジェクト最適化完了
- 2025-10-16 08:20: 最新モデル情報調査、最適化方針策定
