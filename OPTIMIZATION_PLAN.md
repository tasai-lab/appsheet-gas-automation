# GASプロジェクト最適化実装計画

## 実施日: 2025-10-16

## 目的
Gemini APIを使用しているGASプロジェクトを統一的に最適化し、保守性と効率性を向上させる

## 実施内容

### 1. Gemini APIキーとモデルの統一
#### 対象スクリプト（18プロジェクト）
全てのGemini API使用スクリプトで以下を統一:
- **APIキー**: `AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY`

#### モデル選択基準

**gemini-2.5-pro を使用（複雑な思考が必要）**
1. Appsheet_通話_要約生成 ✅ （既にgemini-2.5-pro使用中）
2. Appsheet_訪問看護_通常記録 ✅ （既にgemini-2.5-pro使用中）
3. Appsheet_訪問看護_精神科記録
4. Appsheet_訪問看護_計画書問題点
5. Appsheet_訪問看護_計画書問題点_評価
6. Appsheet_訪問看護_報告書
7. Appsheet_利用者_質疑応答
8. Appsheet_利用者_フェースシート
9. Appsheet_営業レポート

**gemini-2.5-flash を使用（標準処理）**
10. Appsheet_訪問看護_書類OCR
11. Appsheet_訪問看護_書類仕分け
12. Appsheet_通話_クエリ ✅ （既にgemini-2.5-flash使用中）
13. Appsheet_通話_新規依頼作成
14. Appsheet_関係機関_作成
15. Appsheet_利用者_家族情報作成
16. Appsheet_利用者_基本情報上書き
17. Appsheet_利用者_反映
18. Appsheet_ALL_スレッド更新
19. Appsheet_営業_音声記録

### 2. 重複実行防止機能の追加
全てのWebhook受信スクリプトに以下を実装:
- リクエストIDベースの重複チェック
- PropertiesServiceを使用したロック機構
- タイムアウト付き処理（5分）

### 3. エラーログのスプレッドシート化
- メール送信を廃止
- 共有ドライブの「GAS」フォルダーにログスプレッドシートを作成
- ログ項目: タイムスタンプ、スクリプト名、ステータス、実行時間、エラー詳細、リクエストID

### 4. HTMLファイルの削除
不要なHTMLファイルを全て削除

### 5. スクリプト名の最適化
わかりやすく統一的な命名規則に変更:
- `main.gs` - メインエントリポイント
- `config.gs` - 設定管理
- `gemini_client.gs` - Gemini API連携
- `appsheet_client.gs` - AppSheet API連携
- `logger.gs` - ログ管理
- `duplication_prevention.gs` - 重複防止
- `validator.gs` - バリデーション

### 6. ドキュメント作成
各プロジェクトに以下を作成:
- `README.md` - 概要と使い方
- `SPECIFICATION.md` - 詳細仕様
- `FLOW.md` - フロー図（Mermaid記法）

## 実装順序

### Phase 1: 共通モジュールの作成 ✅
1. 統一ロガーモジュール作成
2. 重複防止モジュール作成
3. Gemini APIクライアント作成
4. AppSheet APIクライアント作成

### Phase 2: 各プロジェクトの最適化（優先度順）
1. 通話_要約生成（参照実装として先行）
2. 訪問看護_通常記録（既に最適化済み）
3. その他の複雑な思考が必要なスクリプト（pro使用）
4. 標準処理スクリプト（flash使用）

### Phase 3: デプロイとテスト
1. 各プロジェクトのデプロイ
2. 動作確認
3. ドキュメント最終化

## 進捗状況

- [ ] Phase 1: 共通モジュール作成
- [ ] Phase 2: プロジェクト最適化
- [ ] Phase 3: デプロイとテスト

## 備考
- 既存の動作を維持しながら段階的に最適化
- 各スクリプトのビジネスロジックは変更しない
- テスト環境での確認後、本番環境にデプロイ
