# Gemini モデル最適化記録

## 調査日時
2025年10月16日

## 最新モデル情報

### Gemini 2.5 Pro
- **モデル名**: `gemini-2.5-pro`
- **用途**: 複雑な思考が必要なタスク
  - 通話要約生成
  - 看護記録作成（通常記録、精神科記録）
  - 報告書作成
  - 質疑応答
  - 営業レポート作成
- **特徴**:
  - 高度な推論能力
  - コーディング、大規模データ分析に対応
  - 複雑なタスクに最適

### Gemini 2.5 Flash
- **モデル名**: `gemini-2.5-flash`
- **用途**: 一般的なタスク
  - ファイル検索・ID取得
  - スレッド投稿
  - イベント作成
  - タスク作成
  - 書類仕分け、OCR
  - 基本情報の処理
- **特徴**:
  - 高速処理
  - コスト効率が良い
  - 日常的なタスクに最適

## 使用スクリプトの分類

### Pro モデル使用（6スクリプト）
1. Appsheet_通話_要約生成
2. Appsheet_訪問看護_通常記録
3. Appsheet_訪問看護_精神科記録
4. Appsheet_訪問看護_報告書
5. Appsheet_利用者_質疑応答
6. Appsheet_営業レポート

### Flash モデル使用（25スクリプト）
1. Appsheet_ALL_Event
2. Appsheet_ALL_スレッド更新
3. Appsheet_ALL_スレッド投稿
4. AppSheet_ALL_ファイルID
5. Appsheet_All_ファイル検索＋ID挿入
6. Appsheet_営業_ファイルID取得
7. Appsheet_営業_音声記録
8. Appsheet_関係機関_作成
9. Appsheet_通話_イベント作成
10. Appsheet_通話_クエリ
11. Appsheet_通話_スレッド投稿
12. Appsheet_通話_タスク作成
13. Appsheet_通話_ファイルID取得
14. Appsheet_通話_新規依頼作成
15. Appsheet_訪問看護_計画書問題点
16. Appsheet_訪問看護_計画書問題点_評価
17. Appsheet_訪問看護_書類OCR
18. Appsheet_訪問看護_書類仕分け
19. Appsheet_訪問看護_定期スケジュール
20. Appsheet_訪問看護_訪問者自動
21. Appsheet_名刺取り込み
22. Appsheet_利用者_フェースシート
23. Appsheet_利用者_家族情報作成
24. Appsheet_利用者_基本情報上書き
25. Appsheet_利用者_反映
26. AppSheetSecureConnector

## API統一

全スクリプトで以下のAPIキーを使用:
```
AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY
```

## 参考資料

- [Gemini Models - Google AI for Developers](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 2.5 Flash - Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash)
- [Gemini 2.5 Pro - Google DeepMind](https://deepmind.google/models/gemini/pro/)

## 更新内容

1. **APIキー統一**: 全スクリプトで同一のAPIキーを使用
2. **モデル最適化**: タスクの複雑さに応じてFlash/Proを使い分け
3. **ログ記録**: メール通知を削除し、スプレッドシートにログを記録
4. **重複防止**: Webhookの重複受信を防止する機構を実装

## コスト削減効果

- Flash モデルは Pro モデルより約 **10倍安価**
- 25/31 のスクリプト（約80%）でFlashモデルを使用
- 推定コスト削減: 約 **70-80%**
