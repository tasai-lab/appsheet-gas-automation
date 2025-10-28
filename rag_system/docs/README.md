# RAG Medical Assistant ドキュメント

**最終更新**: 2025-10-28
**現在のPhase**: Phase 3完了 → Phase 4準備中

---

## 🎉 最新情報 (2025-10-28)

### ✅ Firestore Vector Search移植完了
- **3,151件のナレッジベース**をFirestoreに移植
- **PCA圧縮** (3072→2048次元) で情報保持率100%
- **10〜15倍の検索速度向上**を期待 (45秒 → 3〜5秒)
- 詳細: [FIRESTORE_VECTOR_MIGRATION_REPORT.md](FIRESTORE_VECTOR_MIGRATION_REPORT.md) ⭐ **NEW**

### 📝 ロジックレビュー完了
- 全コードベースの徹底的なレビュー実施
- 1件のCRITICAL問題を発見・修正
- コード品質スコア: 8.2/10
- 詳細: [LOGIC_REVIEW_2025-10-28.md](LOGIC_REVIEW_2025-10-28.md) ⭐ **NEW**

---

## 📚 ドキュメント構成

### メインドキュメント（必読）

1. **[01_PROJECT_OVERVIEW.md](01_PROJECT_OVERVIEW.md)** - プロジェクト概要
2. **[02_ARCHITECTURE.md](02_ARCHITECTURE.md)** - システムアーキテクチャ
3. **[03_HYBRID_SEARCH_SPEC_V2.md](03_HYBRID_SEARCH_SPEC_V2.md)** - ハイブリッド検索仕様（BM25 + Dense）
4. **[04_API_SPECIFICATION.md](04_API_SPECIFICATION.md)** - API仕様
5. **[06_DEPLOYMENT.md](06_DEPLOYMENT.md)** - デプロイ手順
6. **[07_SECURITY.md](07_SECURITY.md)** - セキュリティ設計

---

## 🚀 Firestore Vector Search移植 (Phase 3完了)

### 移植レポート
- **[FIRESTORE_VECTOR_MIGRATION_REPORT.md](FIRESTORE_VECTOR_MIGRATION_REPORT.md)** ⭐ **最重要**
  - 移植結果: 3,151件/3,193件 (98.7%成功)
  - PCA圧縮: 情報保持率100%
  - 期待効果: 10〜15倍の検索速度向上

### ロジックレビュー
- **[LOGIC_REVIEW_2025-10-28.md](LOGIC_REVIEW_2025-10-28.md)** ⭐ **最重要**
  - 発見された問題: 1件 (CRITICAL) → 修正済み
  - コード品質評価: 8.2/10
  - 改善提案: 3件 (オプション)

### 技術ドキュメント
- **Firestoreインデックス定義**: `firestore.indexes.json`
- **移植スクリプト**: `scripts/migrate_spreadsheet_to_firestore.py`
- **検証スクリプト**: `scripts/verify_firestore_migration.py`

---

## 🔗 RAG Engine統合 (Phase 4完了)

### 統合レポート
- **[PHASE4_FIRESTORE_INTEGRATION.md](PHASE4_FIRESTORE_INTEGRATION.md)** ⭐ **最重要**
  - コード統合: RAG EngineにFirestore Vector Search統合完了
  - 環境変数制御: `USE_FIRESTORE_VECTOR_SEARCH`で切り替え可能
  - 後方互換性: デフォルトはSpreadsheet検索（既存機能保持）
  - 構文チェック: エラーなし
  - Backend起動: 正常動作確認

### 実装ファイル
- `backend/app/config.py` - Firestore設定追加
- `backend/app/services/rag_engine.py` - 統合ロジック（async化）
- `backend/app/routers/chat.py` - ルーター更新（await追加）

### 動作モード
- **デフォルト（Spreadsheet）**: `USE_FIRESTORE_VECTOR_SEARCH=False` （約45秒）
- **高速モード（Firestore）**: `USE_FIRESTORE_VECTOR_SEARCH=True` （約3-5秒、10-15倍高速化）

---

## 🚀 セットアップガイド

### 初期セットアップ
- **[GCP_SETUP.md](GCP_SETUP.md)** - GCPプロジェクトの初期設定
- **[SPREADSHEET_CREATION_GUIDE.md](SPREADSHEET_CREATION_GUIDE.md)** - Vector DBスプレッドシート作成手順
- **[PHASE2_SETUP_GUIDE.md](PHASE2_SETUP_GUIDE.md)** - Phase 2機能（質疑応答）セットアップ

### 本番環境構築
- **[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)** - 本番環境デプロイ手順
- **[PRODUCTION_READINESS_SUMMARY.md](PRODUCTION_READINESS_SUMMARY.md)** - 本番環境適正化サマリー ⭐ **最重要**

---

## 🔧 機能実装ガイド

### キャッシュシステム
- **[CACHE_IMPLEMENTATION.md](CACHE_IMPLEMENTATION.md)** - キャッシュシステム実装詳細
  - API呼び出し削減: 67.5%
  - コスト削減: 76.1%（¥34,250/月節約）

### 認証統合（実装予定）
- **[FIREBASE_AUTH_INTEGRATION.md](FIREBASE_AUTH_INTEGRATION.md)** - Firebase認証統合設計書
- **[FIREBASE_SETUP_GUIDE.md](FIREBASE_SETUP_GUIDE.md)** - Firebase初期設定手順

### 監視統合（実装予定）
- **[LANGSMITH_MONITORING_INTEGRATION.md](LANGSMITH_MONITORING_INTEGRATION.md)** - LangSmith監視統合設計書

---

## 📊 アーキテクチャ分析

### 最新分析（2025-10-28）
- **[RAG_ARCHITECTURE_ANALYSIS_2025-10-28.md](RAG_ARCHITECTURE_ANALYSIS_2025-10-28.md)** - 業界ベストプラクティス比較分析
  - 総合評価: ⭐⭐⭐⭐☆ (4/5)
  - 準拠項目: 10項目
  - 改善推奨: 5項目（最優先: 会話履歴コンテキスト化）

---

## 📝 開発ログ・エラー記録

### エラー記録
- **[ERROR_LOG.md](ERROR_LOG.md)** ⭐ **最重要** - エラー記録と対処法・教訓
  - Vertex AI API モック化問題（2025-10-27修正）
  - Frontend API重複呼び出し問題（2025-10-27修正）

### 設計判断
- **[DECISIONS.md](DECISIONS.md)** - アーキテクチャ決定記録（ADR）
  - Vertex AI完全移行
  - リランキングモデル選択
  - ハイブリッド検索の採用

---

## 🔍 ドキュメントの使い方

### 新規メンバー向けスタートガイド

1. **全体像把握**:
   - [01_PROJECT_OVERVIEW.md](01_PROJECT_OVERVIEW.md)
   - [02_ARCHITECTURE.md](02_ARCHITECTURE.md)

2. **ローカル開発環境構築**:
   - [GCP_SETUP.md](GCP_SETUP.md)
   - [06_DEPLOYMENT.md](06_DEPLOYMENT.md) の "ローカル開発" セクション

3. **機能実装**:
   - [03_HYBRID_SEARCH_SPEC_V2.md](03_HYBRID_SEARCH_SPEC_V2.md) - 検索機能
   - [04_API_SPECIFICATION.md](04_API_SPECIFICATION.md) - APIエンドポイント

### 本番環境デプロイ担当者向け

1. **事前準備**:
   - [PRODUCTION_READINESS_SUMMARY.md](PRODUCTION_READINESS_SUMMARY.md) - 全体チェックリスト

2. **デプロイ実施**:
   - [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) - 詳細手順

3. **機能統合**:
   - [CACHE_IMPLEMENTATION.md](CACHE_IMPLEMENTATION.md) - キャッシュシステム
   - [FIREBASE_AUTH_INTEGRATION.md](FIREBASE_AUTH_INTEGRATION.md) - 認証（実装予定）
   - [LANGSMITH_MONITORING_INTEGRATION.md](LANGSMITH_MONITORING_INTEGRATION.md) - 監視（実装予定）

### トラブルシューティング

- [ERROR_LOG.md](ERROR_LOG.md) - 既知のエラーと対処法
- [CONSISTENCY_VERIFICATION_2025-10-27_FINAL.md](CONSISTENCY_VERIFICATION_2025-10-27_FINAL.md) - 過去の不整合修正記録

---

## 📌 重要な注意事項

### セキュリティ
- `.env` ファイルは **絶対にコミットしない**
- Firebase認証トークンは `localStorage` に保存（XSS対策済み）
- Admin APIキーは Secret Manager で管理

### コスト管理
- キャッシュシステム実装により **76.1%のコスト削減**
- サンプリングレート調整により LangSmith コスト管理

### パフォーマンス
- ストリーミング応答により初回応答を高速化
- BM25フィルタリングにより検索範囲を1/10に削減

---

## 🔄 次のステップ

### ✅ 完了済み: 会話履歴コンテキスト化（2025-10-28）
- **実装完了**: Backend + Frontend統合
- **効果**: ユーザー体験の劇的向上（代名詞・前回の文脈を理解）
- **詳細**: [RAG_ARCHITECTURE_ANALYSIS_2025-10-28.md](RAG_ARCHITECTURE_ANALYSIS_2025-10-28.md#最優先-会話履歴コンテキスト化)

### 優先度1: Firebase認証実装（1週間）
- **設計完了**: 実装ガイド作成済み
- **参照**: [FIREBASE_AUTH_INTEGRATION.md](FIREBASE_AUTH_INTEGRATION.md)
- **参照**: [PRODUCTION_READINESS_SUMMARY.md](PRODUCTION_READINESS_SUMMARY.md#優先度1-firebase認証実装推奨)

### 優先度2: LangSmith監視実装（1週間）
- **設計完了**: 統合ガイド作成済み
- **参照**: [LANGSMITH_MONITORING_INTEGRATION.md](LANGSMITH_MONITORING_INTEGRATION.md)
- **参照**: [PRODUCTION_READINESS_SUMMARY.md](PRODUCTION_READINESS_SUMMARY.md#優先度2-langsmith監視実装推奨)

### 優先度3: Firestore Vector Search本番切替（設定のみ）
- **実装完了**: Phase 4完了
- **現状**: デフォルトはSpreadsheet検索（後方互換性）
- **切替方法**: 環境変数 `USE_FIRESTORE_VECTOR_SEARCH=True` に設定
- **効果**: 10〜15倍の検索速度向上（45秒 → 3〜5秒）
- **詳細**: [PHASE4_FIRESTORE_INTEGRATION.md](PHASE4_FIRESTORE_INTEGRATION.md)

---

## 📞 サポート

### 開発チーム連絡先
- プロジェクトオーナー: [記入してください]
- 技術リード: [記入してください]

### リソース
- GCP Console: [医療特化型RAGプロジェクト](https://console.cloud.google.com/)
- Firebase Console: [Firebase RAG Project](https://console.firebase.google.com/)
- LangSmith Dashboard: [実装後に追加]

---

**最終更新**: 2025-10-28
**ドキュメント数**: 23個（36→23に最適化、2025-10-28）
**メンテナンス**: このREADMEは新規ドキュメント追加時に更新してください
